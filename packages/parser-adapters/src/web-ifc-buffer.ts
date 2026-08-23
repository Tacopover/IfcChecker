import * as WebIFC from "web-ifc";
import {
  simpleAttributeNamesFor,
  type ClassificationReference,
  type ModelStructureNode,
  type NormalizedElement,
  type NormalizedValue,
} from "@ifc-qa/shared-types";
import type { IfcParseResult, UnrecognizedEntityType } from "./types.js";
import { classifyEntityType, warnAboutUnrecognizedTypes } from "./element-filter.js";
import { identifyEntity } from "./entity-identity.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue, normalizeValue } from "./normalize-property-value.js";
import { UnitScaleCollector, siUnitScale } from "./unit-scales.js";
import { resolvePartOf } from "./part-of.js";
import { resolvePredefinedType, type PredefinedTypeSource } from "./predefined-type.js";

type WebIfcLine = Record<string, any>;

/**
 * The SI factor for one entry of an `IfcUnitAssignment`, or `null` when this engine cannot say.
 *
 * ifc-lite hands its whole unit graph over already resolved; web-ifc hands back lines, so the two
 * kinds that carry a scale are read here. An `IfcDerivedUnit` is composed of several units with
 * exponents and is deliberately not resolved — returning `null` leaves the measure unscaled, which
 * matches what the engine can honestly claim to know.
 */
function unitEntryScale(ifcApi: WebIFC.IfcAPI, modelID: number, unit: WebIfcLine): [string, number] | null {
  const unitType = stripEnumDots(unit.UnitType);
  if (unitType === null) return null;

  if (unit.type === WebIFC.IFCSIUNIT) {
    const name = stripEnumDots(unit.Name);
    if (name === null) return null;
    const scale = siUnitScale(stripEnumDots(unit.Prefix), name);
    return scale === undefined ? null : [unitType, scale];
  }

  if (unit.type === WebIFC.IFCCONVERSIONBASEDUNIT) {
    // The factor is an IfcMeasureWithUnit: a number, and the unit that number is itself in.
    const factor = ifcApi.GetLine(modelID, unit.ConversionFactor?.value, true) as WebIfcLine | null;
    const component = normalizePropertyValue(factor?.ValueComponent);
    if (typeof component !== "number" || !factor?.UnitComponent) return null;
    const base = unitEntryScale(ifcApi, modelID, factor.UnitComponent as WebIfcLine);
    return base === null ? null : [unitType, component * base[1]];
  }

  return null;
}

function webIfcUnitScales(ifcApi: WebIFC.IfcAPI, modelID: number): (unitType: string) => number | undefined {
  const byUnitType = new Map<string, number>();
  const assignmentIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCUNITASSIGNMENT);

  for (let i = 0; i < assignmentIds.size(); i++) {
    const assignment = ifcApi.GetLine(modelID, assignmentIds.get(i), true) as WebIfcLine;
    for (const unit of assignment.Units ?? []) {
      const resolved = unitEntryScale(ifcApi, modelID, unit as WebIfcLine);
      if (resolved) byUnitType.set(resolved[0], resolved[1]);
    }
  }

  return (unitType) => byUnitType.get(unitType);
}

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" ? normalized.replace(/^\.|\.$/g, "") : null;
}

/**
 * web-ifc wraps a defined type as `{ name: "IFCMASSMEASURE", value }`, so the measure type the
 * file stored survives on this engine too — it is the only thing that can say whether a stored
 * value is the type the specification asked for. Wrappers with no measure semantics (IFCLABEL on
 * a plain string) are kept as well; the comparison decides what to do with them.
 */
function measureTypeOf(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const name = (raw as { name?: unknown }).name;
  return typeof name === "string" && name !== "" ? name : undefined;
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
  const modelID = ifcApi.OpenModel(raw);

  try {
    const idsScope: NormalizedElement[] = [];
    // Kept parallel to idsScope so partOf can be resolved in a second pass, once every entity's
    // identity is known — a whole is often normalized after the part that points at it.
    const scopeExpressIds: number[] = [];
    const elementTypeByExpressId = new Map<number, string>();
    const unitScales = new UnitScaleCollector(webIfcUnitScales(ifcApi, modelID));

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

    // What a type object says about its predefined type. IDS reads the type first and the
    // occurrence only where the type defines nothing, so an IfcWall stating none still has one if
    // its IfcWallType does. Cached per type object because one type defines many occurrences.
    const typePredefinedTypeCache = new Map<number, PredefinedTypeSource>();
    function readTypePredefinedType(typeId: number): PredefinedTypeSource {
      const cached = typePredefinedTypeCache.get(typeId);
      if (cached) return cached;

      const typeLine = ifcApi.GetLine(modelID, typeId) as WebIfcLine;
      const source: PredefinedTypeSource = {
        predefinedType: stripEnumDots(typeLine.PredefinedType),
        elementType: typeLine.ElementType,
        processType: typeLine.ProcessType,
      };
      typePredefinedTypeCache.set(typeId, source);
      return source;
    }

    // Element expressId -> the classification references associated with it, from every
    // IFCRELASSOCIATESCLASSIFICATION. ifc-lite resolves this graph itself; web-ifc has no
    // equivalent, so the chain is walked by hand here — leaving it out would make the engine
    // picker decide whether a classified model passes.
    const classificationRefsByElement = new Map<number, number[]>();
    const classificationRelIds = ifcApi.GetLineIDsWithType(
      modelID,
      WebIFC.IFCRELASSOCIATESCLASSIFICATION
    );
    for (let i = 0; i < classificationRelIds.size(); i++) {
      const rel = ifcApi.GetLine(modelID, classificationRelIds.get(i)) as WebIfcLine;
      const referenceId = rel.RelatingClassification?.value;
      if (typeof referenceId !== "number") continue;
      for (const ref of rel.RelatedObjects ?? []) {
        const elementId = ref?.value;
        if (typeof elementId !== "number") continue;
        const bucket = classificationRefsByElement.get(elementId);
        if (bucket) bucket.push(referenceId);
        else classificationRefsByElement.set(elementId, [referenceId]);
      }
    }

    /**
     * Resolve one classification reference to the strings IDS compares it by.
     *
     * The system is only found by following `ReferencedSource` to the `IfcClassification` at the
     * top, and each reference passed on the way contributes its own identification — which is what
     * lets a rule naming a parent code match an element classified under one of its children.
     * IFC2X3 spells that identification `ItemReference`, so both names are read.
     *
     * Cached per reference because one classification reference is typically shared by many
     * elements, and the walk is otherwise repeated for each of them.
     */
    const classificationCache = new Map<number, ClassificationReference>();
    function readClassificationReference(referenceId: number): ClassificationReference {
      const cached = classificationCache.get(referenceId);
      if (cached) return cached;

      const identifications: string[] = [];
      let system: string | null = null;
      let currentId: number | undefined = referenceId;
      // A malformed file can point a ReferencedSource chain back at itself; the seen set makes
      // that a truncated answer rather than a hung parse.
      const seen = new Set<number>();

      while (typeof currentId === "number" && !seen.has(currentId)) {
        seen.add(currentId);
        const line = ifcApi.GetLine(modelID, currentId) as WebIfcLine | null;
        if (!line) break;

        if (line.type === WebIFC.IFCCLASSIFICATION) {
          const name = normalizePropertyValue(line.Name);
          system = typeof name === "string" && name !== "" ? name : null;
          break;
        }

        const identification = normalizePropertyValue(line.Identification ?? line.ItemReference);
        if (typeof identification === "string" && identification !== "") {
          identifications.push(identification);
        }
        currentId = line.ReferencedSource?.value;
      }

      const resolved: ClassificationReference = { system, identifications };
      classificationCache.set(referenceId, resolved);
      return resolved;
    }

    // Element expressId -> the material definitions associated with it. Same shape as the
    // classification map above, and needed for the same reason: ifc-lite resolves materials
    // itself and web-ifc does not, so an unported engine would report every element unmaterialed.
    const materialDefsByElement = new Map<number, number[]>();
    const materialRelIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELASSOCIATESMATERIAL);
    for (let i = 0; i < materialRelIds.size(); i++) {
      const rel = ifcApi.GetLine(modelID, materialRelIds.get(i)) as WebIfcLine;
      const defId = rel.RelatingMaterial?.value;
      if (typeof defId !== "number") continue;
      for (const ref of rel.RelatedObjects ?? []) {
        const elementId = ref?.value;
        if (typeof elementId !== "number") continue;
        const bucket = materialDefsByElement.get(elementId);
        if (bucket) bucket.push(defId);
        else materialDefsByElement.set(elementId, [defId]);
      }
    }

    /**
     * Every string an IDS material facet may match behind one material definition.
     *
     * IFC reaches a material five ways — plainly, or through a layer, profile, constituent or list
     * set — and IDS matches a name *or* a category at every level of whichever shape is used,
     * including the set's own name. A `*Usage` is a placement wrapper around its set, so it is
     * unwrapped rather than treated as a kind of its own.
     *
     * Cached per definition: a layer set defined once on a type is typically shared by every
     * occurrence of it.
     */
    const materialCache = new Map<number, string[]>();
    function readMaterialDefinition(defId: number | undefined): string[] {
      if (typeof defId !== "number") return [];
      const cached = materialCache.get(defId);
      if (cached) return cached;

      const names: string[] = [];
      const add = (...candidates: unknown[]) => {
        for (const candidate of candidates) {
          const value = normalizePropertyValue(candidate);
          if (typeof value === "string" && value !== "" && !names.includes(value)) names.push(value);
        }
      };
      // A member's own name and category, plus those of the IfcMaterial behind it.
      const addMember = (member: WebIfcLine | null | undefined) => {
        if (!member) return;
        add(member.Name, member.Category);
        const materialId = member.Material?.value;
        if (typeof materialId !== "number") return;
        const material = ifcApi.GetLine(modelID, materialId) as WebIfcLine | null;
        if (material) add(material.Name, material.Category);
      };
      const members = (refs: unknown): Array<WebIfcLine | null> =>
        (Array.isArray(refs) ? refs : [])
          .map((ref) => (ref as WebIfcLine)?.value)
          .filter((id): id is number => typeof id === "number")
          .map((id) => ifcApi.GetLine(modelID, id) as WebIfcLine | null);

      const line = ifcApi.GetLine(modelID, defId) as WebIfcLine | null;
      if (!line) return [];

      switch (line.type) {
        case WebIFC.IFCMATERIAL:
          add(line.Name, line.Category);
          break;
        case WebIFC.IFCMATERIALLAYERSETUSAGE:
          return readMaterialDefinition(line.ForLayerSet?.value);
        case WebIFC.IFCMATERIALPROFILESETUSAGE:
          return readMaterialDefinition(line.ForProfileSet?.value);
        case WebIFC.IFCMATERIALLAYERSET:
          add(line.LayerSetName);
          for (const layer of members(line.MaterialLayers)) addMember(layer);
          break;
        case WebIFC.IFCMATERIALPROFILESET:
          add(line.Name);
          for (const profile of members(line.MaterialProfiles)) addMember(profile);
          break;
        case WebIFC.IFCMATERIALCONSTITUENTSET:
          add(line.Name);
          for (const constituent of members(line.MaterialConstituents)) addMember(constituent);
          break;
        case WebIFC.IFCMATERIALLIST:
          for (const material of members(line.Materials)) {
            if (material) add(material.Name, material.Category);
          }
          break;
      }

      materialCache.set(defId, names);
      return names;
    }

    // Part expressId -> the wholes it belongs to, one entry per relationship. ifc-lite reads this
    // off its relationship graph; web-ifc has no graph, so the six relationships IDS names are
    // walked directly. Each names its whole and its parts through different attributes, which is
    // the only reason this is a table rather than a loop over one shape.
    const PART_OF_RELATIONSHIPS = [
      { type: WebIFC.IFCRELAGGREGATES, name: "IFCRELAGGREGATES", whole: "RelatingObject", parts: "RelatedObjects" },
      { type: WebIFC.IFCRELNESTS, name: "IFCRELNESTS", whole: "RelatingObject", parts: "RelatedObjects" },
      {
        type: WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
        name: "IFCRELCONTAINEDINSPATIALSTRUCTURE",
        whole: "RelatingStructure",
        parts: "RelatedElements",
      },
      { type: WebIFC.IFCRELASSIGNSTOGROUP, name: "IFCRELASSIGNSTOGROUP", whole: "RelatingGroup", parts: "RelatedObjects" },
      {
        type: WebIFC.IFCRELVOIDSELEMENT,
        name: "IFCRELVOIDSELEMENT",
        whole: "RelatingBuildingElement",
        parts: "RelatedOpeningElement",
      },
      {
        type: WebIFC.IFCRELFILLSELEMENT,
        name: "IFCRELFILLSELEMENT",
        whole: "RelatingOpeningElement",
        parts: "RelatedBuildingElement",
      },
    ] as const;

    const wholesByPart = new Map<number, Array<{ relation: string; wholeId: number }>>();
    for (const shape of PART_OF_RELATIONSHIPS) {
      if (shape.type === undefined) continue;
      const relIds = ifcApi.GetLineIDsWithType(modelID, shape.type);
      for (let i = 0; i < relIds.size(); i++) {
        const rel = ifcApi.GetLine(modelID, relIds.get(i)) as WebIfcLine;
        const wholeId = (rel[shape.whole] as WebIfcLine | undefined)?.value;
        if (typeof wholeId !== "number") continue;
        // Voids and fills name a single part; the other four name a list.
        const partRefs = rel[shape.parts];
        for (const ref of Array.isArray(partRefs) ? partRefs : [partRefs]) {
          const partId = (ref as WebIfcLine | undefined)?.value;
          if (typeof partId !== "number") continue;
          const bucket = wholesByPart.get(partId);
          if (bucket) bucket.push({ relation: shape.name, wholeId });
          else wholesByPart.set(partId, [{ relation: shape.name, wholeId }]);
        }
      }
    }

    // One property set is typically shared by many elements, so reading and
    // flattening it once per definition rather than once per element saves the
    // dominant remaining cost.
    const propertySetCache = new Map<number, [string, Record<string, NormalizedValue>] | null>();
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
      let entry: [string, Record<string, NormalizedValue>] | null = null;
      if (typeof psetName === "string" && isPropertySet) {
        const props: Record<string, NormalizedValue> = {};
        for (const prop of propSet.HasProperties ?? []) {
          const propName = normalizePropertyValue(prop.Name);
          if (typeof propName !== "string") continue;
          // Only NominalValue, so only IfcPropertySingleValue: the other five subtypes still read
          // as absent here where ifc-lite reads them. `values` is therefore never populated on this
          // engine, and adapter-parity.test.ts states that gap rather than leaving it to be found.
          const dataType = measureTypeOf(prop.NominalValue);
          unitScales.observe(dataType);
          props[propName] = normalizeValue(prop.NominalValue, { dataType });
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
    const typePropertySetsCache = new Map<number, Array<[string, Record<string, NormalizedValue>]>>();
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
        .filter((entry): entry is [string, Record<string, NormalizedValue>] => entry !== null);
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
        const propertySets: Record<string, Record<string, NormalizedValue>> = {};
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
        const attributes: Record<string, NormalizedValue> = {};
        for (const attributeName of simpleAttributeNamesFor(typeName)) {
          // No dataType here on purpose: IDS declares `dataType` on <property> and never on
          // <attribute>, so reading web-ifc's wrapper name for an attribute would carry an
          // IFCIDENTIFIER or IFCTEXT that nothing consults, and diverge from ifc-lite — which
          // reports a type for property values only — on every attribute in the model.
          attributes[attributeName] = normalizeValue(line[attributeName]);
        }

        // Occurrence first, then the type's own — IDS inherits a type's classification down to its
        // occurrences, the same way a type's property sets reach them.
        const classifications = [
          ...(classificationRefsByElement.get(expressID) ?? []),
          ...(typeId === undefined ? [] : (classificationRefsByElement.get(typeId) ?? [])),
        ].map(readClassificationReference);

        // Occurrence overrides type, rather than adding to it: an element that states its own
        // material has replaced the type's, and ifc-lite resolves it the same way. The suite pins
        // both halves — one case inherits, the next overrides.
        const materialDefs =
          materialDefsByElement.get(expressID) ??
          (typeId === undefined ? undefined : materialDefsByElement.get(typeId));
        const materials =
          materialDefs === undefined ? null : materialDefs.flatMap(readMaterialDefinition);

        idsScope.push({
          globalId: identifyEntity(typeName, globalId, expressID),
          ifcType: typeName,
          ...resolvePredefinedType(
            {
              predefinedType: stripEnumDots(line.PredefinedType),
              objectType: line.ObjectType,
              elementType: line.ElementType,
              processType: line.ProcessType,
            },
            typeId === undefined ? null : readTypePredefinedType(typeId)
          ),
          name: typeof name === "string" ? name : null,
          attributes,
          propertySets,
          classifications,
          materials,
        });
        scopeExpressIds.push(expressID);
      }
    }

    const identityByExpressId = new Map(
      scopeExpressIds.map((expressId, index) => [
        expressId,
        { ifcType: idsScope[index].ifcType, predefinedType: idsScope[index].predefinedType },
      ])
    );
    const wholesOf = resolvePartOf(
      (expressId) => wholesByPart.get(expressId) ?? [],
      (expressId) => {
        const known = identityByExpressId.get(expressId);
        if (known) return known;
        // A whole outside the normalized set can still be named by type; it has no predefined
        // type to offer, so a facet asking for one correctly fails against it.
        const line = ifcApi.GetLine(modelID, expressId) as WebIfcLine | null;
        const typeName = line ? (ifcApi.GetNameFromTypeCode(line.type) ?? "").toUpperCase() : "";
        return typeName === "" ? null : { ifcType: typeName, predefinedType: null };
      }
    );
    for (const [index, expressId] of scopeExpressIds.entries()) {
      idsScope[index].partOf = wholesOf(expressId);
    }

    warnAboutUnrecognizedTypes(unrecognized);
    const modelStructure = buildWebIfcModelStructure(ifcApi, modelID, elementTypeByExpressId);
    // Filtered out of the sorted superset rather than collected separately, so
    // the element list keeps exactly the order it had before the wider scope
    // existed — the two engines have to agree element-for-element.
    const elements = idsScope.filter((entity) => reviewerTypeNames.has(entity.ifcType));
    return {
      elements,
      idsScope,
      unitScales: unitScales.result(),
      parseMs: performance.now() - start,
      modelStructure,
      unrecognizedTypes: unrecognized,
    };
  } finally {
    ifcApi.CloseModel(modelID);
  }
}
