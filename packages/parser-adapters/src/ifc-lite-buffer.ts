import { IfcParser, extractPropertiesOnDemand, extractAllEntityAttributes, type IfcDataStore } from "@ifc-lite/parser";
import { IfcTypeEnumToString, type SpatialNode } from "@ifc-lite/data";
import type { ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult } from "./types.js";
import { ELEMENT_TYPE_NAMES } from "./element-types.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue } from "./normalize-property-value.js";

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" && normalized !== "" ? normalized.replace(/^\.|\.$/g, "") : null;
}

// @ifc-lite/parser already builds the project/site/building/storey tree
// (store.spatialHierarchy.project) as part of parseColumnar() — this just
// reshapes it into our engine-agnostic ModelStructureNode, matching what
// web-ifc-buffer.ts derives by hand from raw IFCRELAGGREGATES/
// IFCRELCONTAINEDINSPATIALSTRUCTURE relationships.
function toModelStructureNode(
  node: SpatialNode,
  elementTypeByExpressId: Map<number, string>
): ModelStructureNode {
  const elementCounts: Record<string, number> = {};
  for (const expressId of node.elements) {
    const ifcType = elementTypeByExpressId.get(expressId);
    if (!ifcType) continue;
    elementCounts[ifcType] = (elementCounts[ifcType] ?? 0) + 1;
  }

  return {
    expressId: node.expressId,
    ifcType: IfcTypeEnumToString(node.type).toUpperCase(),
    name: node.name !== "" ? node.name : null,
    elementCounts,
    children: node.children.map((child) => toModelStructureNode(child, elementTypeByExpressId)),
  };
}

function buildIfcLiteModelStructure(
  store: IfcDataStore,
  elementTypeByExpressId: Map<number, string>
): ModelStructureNode | null {
  const project = store.spatialHierarchy?.project;
  return project ? toModelStructureNode(project, elementTypeByExpressId) : null;
}

// Buffer-based entry point shared by the Node adapter (ifc-lite-adapter.ts,
// which reads the file itself) and the browser client (apps/web), which only
// ever has an in-memory ArrayBuffer from a <input type="file"> — never a
// filesystem path. This module deliberately has no Node-only imports so it's
// safe to import from a browser bundle via the package's "./browser" export.
export async function parseIfcLiteBuffer(raw: Uint8Array): Promise<IfcParseResult> {
  const start = performance.now();
  assertWellFormedStepFile(raw);

  const parser = new IfcParser();
  const store = await parser.parseColumnar(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  );

  const elements: NormalizedElement[] = [];
  const elementTypeByExpressId = new Map<number, string>();

  for (const typeName of ELEMENT_TYPE_NAMES) {
    const expressIds = store.entityIndex.byType.get(typeName) ?? [];

    for (const expressId of expressIds) {
      elementTypeByExpressId.set(expressId, typeName);
      const psets = extractPropertiesOnDemand(store, expressId);
      const propertySets: Record<string, Record<string, string | number | boolean | null>> = {};
      for (const pset of psets) {
        const props: Record<string, string | number | boolean | null> = {};
        for (const prop of pset.properties) {
          props[prop.name] = normalizePropertyValue(prop.value);
        }
        propertySets[pset.name] = props;
      }

      // store.entities.getPredefinedType/getTag are optional and not
      // populated on this in-process parseColumnar() path (confirmed
      // empirically against the real installed package: both return
      // `undefined` for a wall parsed via parseColumnar()) —
      // extractAllEntityAttributes always works because it re-derives
      // named attributes from the source buffer.
      const attrs = extractAllEntityAttributes(store, expressId);
      const findAttr = (name: string) => attrs.find((a) => a.name === name)?.value ?? null;

      const name = store.entities.getName(expressId);

      elements.push({
        globalId: store.entities.getGlobalId(expressId),
        ifcType: typeName,
        predefinedType: stripEnumDots(findAttr("PredefinedType")),
        name: name === "" ? null : name,
        attributes: {
          tag: normalizePropertyValue(findAttr("Tag")),
          description: normalizePropertyValue(findAttr("Description")),
          objectType: normalizePropertyValue(findAttr("ObjectType")),
        },
        propertySets,
      });
    }
  }

  const modelStructure = buildIfcLiteModelStructure(store, elementTypeByExpressId);
  return { elements, parseMs: performance.now() - start, modelStructure };
}
