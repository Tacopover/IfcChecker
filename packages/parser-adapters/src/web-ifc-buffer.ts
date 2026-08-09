import * as WebIFC from "web-ifc";
import { simpleAttributeNamesFor, type ModelStructureNode, type NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult, UnrecognizedEntityType } from "./types.js";
import { classifyEntityType, warnAboutUnrecognizedTypes } from "./element-filter.js";
import { identifyEntity } from "./entity-identity.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue } from "./normalize-property-value.js";

type WebIfcLine = Record<string, any>;

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" ? normalized.replace(/^\.|\.$/g, "") : null;
}

// The spatial-structure backbone every IFC model is expected to declare,
// aggregated top-down via IFCRELAGGREGATES (Project -> Site -> Building ->
// Storey). Deliberately excludes IFCSPACE — spaces are kept as elements (see
// element-filter.ts) and counted into their storey's elementCounts, not made
// into a nested tree node.
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
  assertWellFormedStepFile(raw);

  const ifcApi = new WebIFC.IfcAPI();
  await ifcApi.Init(locateWasm, true);
  const modelID = ifcApi.OpenModel(new Uint8Array(raw));

  try {
    const idsScope: NormalizedElement[] = [];
    const elementTypeByExpressId = new Map<number, string>();

    // Element expressId -> the property-definition lines that describe it.
    // Built once by walking the relationships; the previous shape re-scanned
    // every IFCRELDEFINESBYPROPERTIES for every element, which is quadratic
    // and dominated parse time on a large model.
    const propertyDefsByElement = new Map<number, number[]>();
    const relLineIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
    for (let i = 0; i < relLineIds.size(); i++) {
      const rel = ifcApi.GetLine(modelID, relLineIds.get(i)) as WebIfcLine;
      const defId = rel.RelatingPropertyDefinition?.value;
      if (defId === undefined) continue;
      for (const ref of rel.RelatedObjects ?? []) {
        const elementId = ref?.value;
        if (typeof elementId !== "number") continue;
        const bucket = propertyDefsByElement.get(elementId);
        if (bucket) bucket.push(defId);
        else propertyDefsByElement.set(elementId, [defId]);
      }
    }

    // Element expressId -> the type object it is an occurrence of, from every
    // IFCRELDEFINESBYTYPE. A property the model states once on the type is
    // reachable only through this relationship: nothing points an
    // IFCRELDEFINESBYPROPERTIES at the instance for it, so an adapter that
    // reads instance relationships alone sees the type's properties as absent.
    const typeIdByElement = new Map<number, number>();
    const typeRelLineIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYTYPE);
    for (let i = 0; i < typeRelLineIds.size(); i++) {
      const rel = ifcApi.GetLine(modelID, typeRelLineIds.get(i)) as WebIfcLine;
      const typeId = rel.RelatingType?.value;
      if (typeId === undefined) continue;
      for (const ref of rel.RelatedObjects ?? []) {
        if (typeof ref?.value === "number") typeIdByElement.set(ref.value, typeId);
      }
    }

    // One property set is typically shared by many elements, so reading and
    // flattening it once per definition rather than once per element saves the
    // dominant remaining cost.
    const propertySetCache = new Map<number, [string, Record<string, string | number | boolean | null>] | null>();
    function readPropertySet(defId: number) {
      const cached = propertySetCache.get(defId);
      if (cached !== undefined) return cached;

      const propSet = ifcApi.GetLine(modelID, defId, true) as WebIfcLine;
      const psetName = normalizePropertyValue(propSet.Name);
      // HasProperties is what makes a definition an IfcPropertySet. A type's
      // HasPropertySets list may also hold IfcElementQuantity, which carries
      // Quantities instead; without this guard those arrive as a named set with
      // no properties in it. Quantities are not read at either level today.
      const isPropertySet = Array.isArray(propSet.HasProperties);
      let entry: [string, Record<string, string | number | boolean | null>] | null = null;
      if (typeof psetName === "string" && isPropertySet) {
        const props: Record<string, string | number | boolean | null> = {};
        for (const prop of propSet.HasProperties ?? []) {
          const propName = normalizePropertyValue(prop.Name);
          if (typeof propName !== "string") continue;
          props[propName] = normalizePropertyValue(prop.NominalValue);
        }
        entry = [psetName, props];
      }
      propertySetCache.set(defId, entry);
      return entry;
    }

    // A type object holds its sets two ways: inline on IfcTypeObject.
    // HasPropertySets, and — IFC4 only — via an IFCRELDEFINESBYPROPERTIES aimed
    // at the type, which the instance-level sweep above already collected under
    // the type's own expressId. Read once per type, not once per occurrence.
    const typePropertySetsCache = new Map<number, Array<[string, Record<string, string | number | boolean | null>]>>();
    function readTypePropertySets(typeId: number) {
      const cached = typePropertySetsCache.get(typeId);
      if (cached !== undefined) return cached;

      const typeLine = ifcApi.GetLine(modelID, typeId) as WebIfcLine;
      const defIds = [
        ...(typeLine.HasPropertySets ?? []).map((ref: WebIfcLine) => ref?.value),
        ...(propertyDefsByElement.get(typeId) ?? []),
      ].filter((id: unknown): id is number => typeof id === "number");

      const entries = defIds
        .map(readPropertySet)
        .filter((entry): entry is [string, Record<string, string | number | boolean | null>] => entry !== null);
      typePropertySetsCache.set(typeId, entries);
      return entries;
    }

    // Ask the model what it contains rather than asking for a fixed list of
    // type names: anything off such a list — every concrete MEP class a Revit
    // export writes, for one — could never produce an element.
    //
    // Swept line by line rather than via GetAllTypesOfModel, which only reports
    // types belonging to the schema the file declares: an IFC4X3 class in an
    // IFC4-headed file is simply absent from it, which is the same silent gap
    // this whole change exists to close. The sweep costs ~0.4s per 400k lines,
    // small next to OpenModel itself.
    const countByTypeCode = new Map<number, number>();
    const allLineIds = ifcApi.GetAllLines(modelID);
    for (let i = 0; i < allLineIds.size(); i++) {
      const typeCode = ifcApi.GetLineType(modelID, allLineIds.get(i)) as number;
      countByTypeCode.set(typeCode, (countByTypeCode.get(typeCode) ?? 0) + 1);
    }

    const unrecognized: UnrecognizedEntityType[] = [];
    const keptTypeNames: string[] = [];
    const reviewerTypeNames = new Set<string>();
    const typeCodeByName = new Map<string, number>();
    for (const [typeCode, count] of countByTypeCode) {
      // web-ifc has no name for a type outside its own schema; keep whatever it
      // does say plus the code, so the entry stays traceable instead of blank.
      const rawName = ifcApi.GetNameFromTypeCode(typeCode);
      const typeName = /^ifc/i.test(rawName) ? rawName.toUpperCase() : `${rawName} (type code ${typeCode})`;
      const verdict = classifyEntityType(typeName);
      if (verdict === "ignored") continue;
      if (verdict === "unrecognized") {
        unrecognized.push({ ifcType: typeName, count });
        continue;
      }
      keptTypeNames.push(typeName);
      if (verdict === "element") reviewerTypeNames.add(typeName);
      typeCodeByName.set(typeName, typeCode);
    }
    // Sorted so the element order is a property of the model, not of whichever
    // order an engine happens to report its types in — the two adapters have to
    // agree element-for-element.
    keptTypeNames.sort();
    unrecognized.sort((a, b) => a.ifcType.localeCompare(b.ifcType));

    for (const typeName of keptTypeNames) {
      const lineIds = ifcApi.GetLineIDsWithType(modelID, typeCodeByName.get(typeName)!);
      const isReviewerElement = reviewerTypeNames.has(typeName);
      for (let i = 0; i < lineIds.size(); i++) {
        const expressID = lineIds.get(i);
        // Reviewer elements only: this map feeds the model-structure tree's
        // per-storey counts, which are about what a person is looking at.
        if (isReviewerElement) elementTypeByExpressId.set(expressID, typeName);
        const line = ifcApi.GetLine(modelID, expressID) as WebIfcLine;

        // Type first, instance second: IFC overrides per *property*, not per
        // set, so a set named on both levels ends up the union of the two with
        // the occurrence's own value winning on any shared key. Replacing the
        // set wholesale instead would keep hiding every type-only property in
        // it. Copied, not aliased: the caches exist to avoid re-reading a line,
        // and elements must not share a mutable bag with each other.
        const propertySets: Record<string, Record<string, string | number | boolean | null>> = {};
        const typeId = typeIdByElement.get(expressID);
        if (typeId !== undefined) {
          for (const [setName, props] of readTypePropertySets(typeId)) {
            propertySets[setName] = { ...propertySets[setName], ...props };
          }
        }
        for (const defId of propertyDefsByElement.get(expressID) ?? []) {
          const entry = readPropertySet(defId);
          if (entry) propertySets[entry[0]] = { ...propertySets[entry[0]], ...entry[1] };
        }

        const globalId = normalizePropertyValue(line.GlobalId);
        const name = normalizePropertyValue(line.Name);

        // Every attribute the schema says holds a comparable value, not the
        // three this adapter used to hand-pick. The schema decides rather than
        // the line's shape, so the two engines carry the same set: web-ifc
        // returns a reference as a handle object and ifc-lite as a bare number,
        // and neither is something a rule should compare against.
        const attributes: Record<string, string | number | boolean | null> = {};
        for (const attributeName of simpleAttributeNamesFor(typeName)) {
          attributes[attributeName] = normalizePropertyValue(line[attributeName]);
        }

        idsScope.push({
          globalId: identifyEntity(typeName, globalId, expressID),
          ifcType: typeName,
          predefinedType: stripEnumDots(line.PredefinedType),
          name: typeof name === "string" ? name : null,
          attributes,
          propertySets,
        });
      }
    }

    warnAboutUnrecognizedTypes(unrecognized);
    const modelStructure = buildWebIfcModelStructure(ifcApi, modelID, elementTypeByExpressId);
    // Filtered out of the sorted superset rather than collected separately, so
    // the element list keeps exactly the order it had before the wider scope
    // existed — the two engines have to agree element-for-element.
    const elements = idsScope.filter((entity) => reviewerTypeNames.has(entity.ifcType));
    return { elements, idsScope, parseMs: performance.now() - start, modelStructure, unrecognizedTypes: unrecognized };
  } finally {
    ifcApi.CloseModel(modelID);
  }
}
