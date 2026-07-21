import * as WebIFC from "web-ifc";
import type { ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult } from "./types.js";
import { ELEMENT_TYPE_NAMES } from "./element-types.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue } from "./normalize-property-value.js";

type WebIfcLine = Record<string, any>;

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" ? normalized.replace(/^\.|\.$/g, "") : null;
}

// The spatial-structure backbone every IFC model is expected to declare,
// aggregated top-down via IFCRELAGGREGATES (Project -> Site -> Building ->
// Storey). Deliberately excludes IFCSPACE — spaces are a physical element
// type (see ELEMENT_TYPE_NAMES) counted into their storey's elementCounts,
// not a nested tree node.
const SPATIAL_TYPE_NAMES = ["IFCPROJECT", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY"] as const;

function nameOf(line: WebIfcLine): string | null {
  const name = normalizePropertyValue(line.Name);
  return typeof name === "string" && name !== "" ? name : null;
}

function buildWebIfcModelStructure(
  ifcApi: WebIFC.IfcAPI,
  modelID: number,
  elementTypeByExpressId: Map<number, string>
): ModelStructureNode | null {
  const spatialTypeByExpressId = new Map<number, string>();
  for (const typeName of SPATIAL_TYPE_NAMES) {
    const typeCode = (WebIFC as unknown as Record<string, number>)[typeName];
    if (typeCode === undefined) continue;
    const lineIds = ifcApi.GetLineIDsWithType(modelID, typeCode);
    for (let i = 0; i < lineIds.size(); i++) {
      spatialTypeByExpressId.set(lineIds.get(i), typeName);
    }
  }

  const projectId = [...spatialTypeByExpressId.entries()].find(([, type]) => type === "IFCPROJECT")?.[0];
  if (projectId === undefined) return null;

  // Parent expressId -> child expressIds, from every IFCRELAGGREGATES in the model.
  const childrenByParent = new Map<number, number[]>();
  const aggregatesLineIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELAGGREGATES);
  for (let i = 0; i < aggregatesLineIds.size(); i++) {
    const rel = ifcApi.GetLine(modelID, aggregatesLineIds.get(i)) as WebIfcLine;
    const parentId = rel.RelatingObject?.value;
    if (parentId === undefined) continue;
    const childIds: number[] = (rel.RelatedObjects ?? [])
      .map((ref: WebIfcLine) => ref?.value)
      .filter((id: unknown): id is number => typeof id === "number");
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), ...childIds]);
  }

  // Spatial structure expressId -> counts of directly-contained physical
  // elements by type, from every IFCRELCONTAINEDINSPATIALSTRUCTURE.
  const elementCountsByStructure = new Map<number, Record<string, number>>();
  const containedLineIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
  for (let i = 0; i < containedLineIds.size(); i++) {
    const rel = ifcApi.GetLine(modelID, containedLineIds.get(i)) as WebIfcLine;
    const structureId = rel.RelatingStructure?.value;
    if (structureId === undefined) continue;
    const counts = elementCountsByStructure.get(structureId) ?? {};
    for (const ref of rel.RelatedElements ?? []) {
      const ifcType = elementTypeByExpressId.get(ref?.value);
      if (!ifcType) continue;
      counts[ifcType] = (counts[ifcType] ?? 0) + 1;
    }
    elementCountsByStructure.set(structureId, counts);
  }

  function buildNode(expressId: number): ModelStructureNode {
    const line = ifcApi.GetLine(modelID, expressId) as WebIfcLine;
    const childIds = (childrenByParent.get(expressId) ?? []).filter((id) => spatialTypeByExpressId.has(id));
    return {
      expressId,
      ifcType: spatialTypeByExpressId.get(expressId) as string,
      name: nameOf(line),
      elementCounts: elementCountsByStructure.get(expressId) ?? {},
      children: childIds.map(buildNode),
    };
  }

  return buildNode(projectId);
}

// Buffer-based entry point shared by the Node adapter (web-ifc-adapter.ts,
// which reads the file itself) and the browser client (apps/web), which only
// ever has an in-memory ArrayBuffer from a <input type="file"> — never a
// filesystem path. This module deliberately has no Node-only imports (no
// node:fs, node:url, etc.) so it's safe to import from a browser bundle via
// the package's "./browser" export — even a top-level `import { readFile }
// from "node:fs/promises"` elsewhere would crash a Vite browser build the
// instant the importing module is evaluated, regardless of whether it's ever
// called (confirmed empirically: "Cannot access ... in client code").
//
// `locateWasm` lets a browser caller override where web-ifc's .wasm binary is
// fetched from. web-ifc's default lookup (relative to the *importing script's*
// URL) is Node-build-specific; a Vite-bundled browser build has no filesystem
// to resolve that path against, so it must supply the real served URL itself
// (see apps/web/src/local/webIfcWasm.ts). The Node adapter never passes one,
// so web-ifc's own Node-condition build resolves its default path as before.
export async function parseWebIfcBuffer(
  raw: Uint8Array,
  locateWasm?: (path: string, prefix: string) => string
): Promise<IfcParseResult> {
  const start = performance.now();
  assertWellFormedStepFile(new TextDecoder("utf-8").decode(raw));

  const ifcApi = new WebIFC.IfcAPI();
  await ifcApi.Init(locateWasm, true);
  const modelID = ifcApi.OpenModel(new Uint8Array(raw));

  try {
    const elements: NormalizedElement[] = [];
    const elementTypeByExpressId = new Map<number, string>();

    // Collect every IFCRELDEFINESBYPROPERTIES relationship once so each
    // element doesn't re-scan the whole model for its property sets.
    const relLineIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
    const rels: WebIfcLine[] = [];
    for (let i = 0; i < relLineIds.size(); i++) {
      rels.push(ifcApi.GetLine(modelID, relLineIds.get(i)) as WebIfcLine);
    }

    for (const typeName of ELEMENT_TYPE_NAMES) {
      const typeCode = (WebIFC as unknown as Record<string, number>)[typeName];
      if (typeCode === undefined) continue;

      const lineIds = ifcApi.GetLineIDsWithType(modelID, typeCode);
      for (let i = 0; i < lineIds.size(); i++) {
        const expressID = lineIds.get(i);
        elementTypeByExpressId.set(expressID, typeName);
        const line = ifcApi.GetLine(modelID, expressID) as WebIfcLine;

        const propertySets: Record<string, Record<string, string | number | boolean | null>> = {};
        for (const rel of rels) {
          const related: WebIfcLine[] = rel.RelatedObjects ?? [];
          const isForThisElement = related.some((ref) => ref?.value === expressID);
          if (!isForThisElement) continue;

          const defId = rel.RelatingPropertyDefinition?.value;
          if (defId === undefined) continue;

          const propSet = ifcApi.GetLine(modelID, defId, true) as WebIfcLine;
          const psetName = normalizePropertyValue(propSet.Name);
          if (typeof psetName !== "string") continue;

          const props: Record<string, string | number | boolean | null> = {};
          for (const prop of propSet.HasProperties ?? []) {
            const propName = normalizePropertyValue(prop.Name);
            if (typeof propName !== "string") continue;
            props[propName] = normalizePropertyValue(prop.NominalValue);
          }
          propertySets[psetName] = props;
        }

        const globalId = normalizePropertyValue(line.GlobalId);
        const name = normalizePropertyValue(line.Name);

        elements.push({
          globalId: typeof globalId === "string" ? globalId : String(globalId ?? ""),
          ifcType: typeName,
          predefinedType: stripEnumDots(line.PredefinedType),
          name: typeof name === "string" ? name : null,
          attributes: {
            tag: normalizePropertyValue(line.Tag),
            description: normalizePropertyValue(line.Description),
            objectType: normalizePropertyValue(line.ObjectType),
          },
          propertySets,
        });
      }
    }

    const modelStructure = buildWebIfcModelStructure(ifcApi, modelID, elementTypeByExpressId);
    return { elements, parseMs: performance.now() - start, modelStructure };
  } finally {
    ifcApi.CloseModel(modelID);
  }
}
