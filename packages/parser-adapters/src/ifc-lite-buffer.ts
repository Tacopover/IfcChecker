import { IfcParser, extractPropertiesOnDemand, extractAllEntityAttributes, type IfcDataStore } from "@ifc-lite/parser";
import { IfcTypeEnumToString, type SpatialNode } from "@ifc-lite/data";
import type { ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult, UnrecognizedEntityType } from "./types.js";
import { classifyEntityType, warnAboutUnrecognizedTypes } from "./element-filter.js";
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
  const elementIdsByType: Record<string, number[]> = {};
  for (const expressId of node.elements) {
    const ifcType = elementTypeByExpressId.get(expressId);
    if (!ifcType) continue;
    (elementIdsByType[ifcType] ??= []).push(expressId);
  }
  for (const ids of Object.values(elementIdsByType)) ids.sort((a, b) => a - b);

  return {
    expressId: node.expressId,
    ifcType: IfcTypeEnumToString(node.type).toUpperCase(),
    name: node.name !== "" ? node.name : null,
    elementIdsByType,
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

  // store.entityIndex.byType is keyed by the raw type name the file carries, so
  // the model itself decides what is on offer here. Asking for a fixed list of
  // names instead meant every concrete MEP class — IfcValve, IfcAirTerminal,
  // IfcDuctFitting — silently produced nothing.
  const unrecognized: UnrecognizedEntityType[] = [];
  const keptTypeNames: string[] = [];
  for (const [typeName, expressIds] of store.entityIndex.byType) {
    const verdict = classifyEntityType(typeName);
    if (verdict === "ignored") continue;
    if (verdict === "unrecognized") unrecognized.push({ ifcType: typeName.toUpperCase(), count: expressIds.length });
    else keptTypeNames.push(typeName.toUpperCase());
  }
  // Sorted so element order is a property of the model rather than of this
  // engine's internal index order — the two adapters have to agree
  // element-for-element, not just in aggregate.
  keptTypeNames.sort();
  unrecognized.sort((a, b) => a.ifcType.localeCompare(b.ifcType));

  for (const typeName of keptTypeNames) {
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
        expressId,
        ifcType: typeName,
        predefinedType: stripEnumDots(findAttr("PredefinedType")),
        name: name === "" ? null : name,
        attributes: {
          Tag: normalizePropertyValue(findAttr("Tag")),
          Description: normalizePropertyValue(findAttr("Description")),
          ObjectType: normalizePropertyValue(findAttr("ObjectType")),
        },
        propertySets,
      });
    }
  }

  warnAboutUnrecognizedTypes(unrecognized);
  const modelStructure = buildIfcLiteModelStructure(store, elementTypeByExpressId);
  return { elements, parseMs: performance.now() - start, modelStructure, unrecognizedTypes: unrecognized };
}
