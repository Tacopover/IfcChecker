import {
  IfcParser,
  extractPropertiesOnDemand,
  extractTypePropertiesOnDemand,
  extractAllEntityAttributes,
  extractAllMaterialsOnDemand,
  extractClassificationsOnDemand,
  extractProjectUnits,
  type IfcDataStore,
} from "@ifc-lite/parser";
import { IfcTypeEnumToString, type SpatialNode } from "@ifc-lite/data";
import {
  simpleAttributeNamesFor,
  type ModelStructureNode,
  type NormalizedElement,
  type NormalizedValue,
} from "@ifc-qa/shared-types";
import type { ClassificationReference } from "@ifc-qa/shared-types";
import { resolvePartOf } from "./part-of.js";
import type { IfcParseResult, UnrecognizedEntityType } from "./types.js";
import { classifyEntityType, warnAboutUnrecognizedTypes } from "./element-filter.js";
import { identifyEntity } from "./entity-identity.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue, normalizeValue } from "./normalize-property-value.js";
import { UnitScaleCollector } from "./unit-scales.js";

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

/**
 * The element's classification references, as the strings IDS compares them by.
 *
 * ifc-lite resolves the `ReferencedSource` chain itself: `system` is already the root
 * `IfcClassification`'s name even for a reference nested two deep, and `path` carries the
 * ancestors' identifications. Concatenating the leaf with its path is what makes a rule asking for
 * a parent code match an element classified under one of its children.
 */
function readClassifications(store: IfcDataStore, expressId: number): ClassificationReference[] {
  return extractClassificationsOnDemand(store, expressId).map((reference) => ({
    system: reference.system ?? null,
    identifications: [reference.identification, ...(reference.path ?? [])].filter(
      (identification): identification is string => typeof identification === "string" && identification !== ""
    ),
  }));
}

/**
 * Every string an IDS material facet may match, or `null` when the element has no material at all.
 *
 * A material reaches an element as a plain `IfcMaterial` or through a layer, profile, constituent
 * or list set, and IDS matches the name *or* the category at every level of that structure — the
 * set's own name included, which is why `MaterialInfo.name` is read alongside its members'.
 * ifc-lite resolves the whole shape, occurrence overriding type, so this only flattens it.
 */
function readMaterials(store: IfcDataStore, expressId: number): string[] | null {
  const associations = extractAllMaterialsOnDemand(store, expressId);
  if (associations.length === 0) return null;

  const names = new Set<string>();
  const add = (...candidates: Array<string | undefined>) => {
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate !== "") names.add(candidate);
    }
  };

  for (const association of associations) {
    add(association.name, association.category);
    for (const layer of association.layers ?? []) {
      add(layer.name, layer.category, layer.materialName, layer.materialCategory);
    }
    for (const profile of association.profiles ?? []) {
      add(profile.name, profile.category, profile.materialName, profile.materialCategory);
    }
    for (const constituent of association.constituents ?? []) {
      add(constituent.name, constituent.category, constituent.materialName, constituent.materialCategory);
    }
    for (const material of association.materials ?? []) {
      add(material.name, material.category);
    }
  }

  return [...names];
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

  const idsScope: NormalizedElement[] = [];
  // Kept parallel to idsScope so partOf can be resolved in a second pass: the walk needs every
  // entity's identity, including wholes that appear later in the type-sorted order.
  const scopeExpressIds: number[] = [];
  const elementTypeByExpressId = new Map<number, string>();

  // ifc-lite already resolves the whole IfcUnitAssignment — SI prefixes, derived, conversion-based
  // and monetary units — against parity vectors shared with its Rust core, so this reads that
  // rather than re-deriving it.
  const projectUnits = extractProjectUnits(
    raw,
    store.entityIndex as unknown as Parameters<typeof extractProjectUnits>[1]
  );
  const unitScales = new UnitScaleCollector(
    (unitType) => projectUnits.resolvedForUnitType(unitType)?.siScale
  );

  // store.entityIndex.byType is keyed by the raw type name the file carries, so
  // the model itself decides what is on offer here. Asking for a fixed list of
  // names instead meant every concrete MEP class — IfcValve, IfcAirTerminal,
  // IfcDuctFitting — silently produced nothing.
  const unrecognized: UnrecognizedEntityType[] = [];
  const keptTypeNames: string[] = [];
  const reviewerTypeNames = new Set<string>();
  for (const [typeName, expressIds] of store.entityIndex.byType) {
    const verdict = classifyEntityType(typeName);
    if (verdict === "ignored") continue;
    if (verdict === "unrecognized") {
      unrecognized.push({ ifcType: typeName.toUpperCase(), count: expressIds.length });
      continue;
    }
    keptTypeNames.push(typeName.toUpperCase());
    if (verdict === "element") reviewerTypeNames.add(typeName.toUpperCase());
  }
  // Sorted so element order is a property of the model rather than of this
  // engine's internal index order — the two adapters have to agree
  // element-for-element, not just in aggregate.
  keptTypeNames.sort();
  unrecognized.sort((a, b) => a.ifcType.localeCompare(b.ifcType));

  for (const typeName of keptTypeNames) {
    const expressIds = store.entityIndex.byType.get(typeName) ?? [];

    const isReviewerElement = reviewerTypeNames.has(typeName);

    for (const expressId of expressIds) {
      // Reviewer elements only: this map feeds the model-structure tree's
      // per-storey counts, which are about what a person is looking at.
      if (isReviewerElement) elementTypeByExpressId.set(expressId, typeName);
      // Type first, instance second: a property the model states once on the
      // IfcTypeObject reaches its occurrences only through IFCRELDEFINESBYTYPE,
      // and IFC overrides per *property*, not per set — so a set named on both
      // levels ends up the union of the two, the occurrence's own value winning
      // on any shared key. extractTypePropertiesOnDemand walks the type
      // relationship and reads both the type's inline HasPropertySets and any
      // IFC4 IFCRELDEFINESBYPROPERTIES aimed at it.
      // ifc-lite already reads all six IfcProperty subtypes and hands back the candidates behind a
      // multi-valued one plus the stored measure type; taking only `value` here threw both away and
      // left a bounded property as the display string "3000 [1000 – 5000]" with nothing to compare.
      const propertySets: Record<string, Record<string, NormalizedValue>> = {};
      const addPsets = (
        psets: Array<{
          name: string;
          properties: Array<{ name: string; value: unknown; values?: unknown[]; dataType?: string; unit?: string }>;
        }>
      ) => {
        for (const pset of psets) {
          const props: Record<string, NormalizedValue> = { ...propertySets[pset.name] };
          for (const prop of pset.properties) {
            unitScales.observe(prop.dataType);
            props[prop.name] = normalizeValue(prop.value, {
              values: prop.values,
              dataType: prop.dataType,
              unit: prop.unit,
            });
          }
          propertySets[pset.name] = props;
        }
      };
      addPsets(extractTypePropertiesOnDemand(store, expressId)?.properties ?? []);
      addPsets(extractPropertiesOnDemand(store, expressId));

      // store.entities.getPredefinedType/getTag are optional and not
      // populated on this in-process parseColumnar() path (confirmed
      // empirically against the real installed package: both return
      // `undefined` for a wall parsed via parseColumnar()) —
      // extractAllEntityAttributes always works because it re-derives
      // named attributes from the source buffer.
      const attrs = extractAllEntityAttributes(store, expressId);
      const findAttr = (name: string) => attrs.find((a) => a.name === name)?.value ?? null;

      // Every attribute the schema says holds a comparable value, not the three
      // this adapter used to hand-pick. A rule may name any of them —
      // IsCritical on an IfcTaskTime, RefractionIndex on a surface style — and
      // an attribute we did not carry read as one the model was missing.
      const attributes: Record<string, NormalizedValue> = {};
      for (const attributeName of simpleAttributeNamesFor(typeName)) {
        attributes[attributeName] = normalizeValue(findAttr(attributeName));
      }

      // store.entities is indexed for object definitions; it answers nothing
      // for relationships or property sets, so an IfcPropertySet arrived
      // nameless while web-ifc read its name. extractAllEntityAttributes covers
      // any entity because it re-derives from the source buffer.
      //
      // An empty Name is kept as "" rather than folded into null: IDS separates an attribute the
      // model does not state from one it states as empty — the first satisfies an optional
      // requirement and the second fails it. web-ifc already kept that difference, so this engine
      // was the one out of step.
      const storedName = store.entities.getName(expressId);
      const name = normalizePropertyValue(
        typeof storedName === "string" && storedName !== "" ? storedName : findAttr("Name")
      );

      idsScope.push({
        globalId: identifyEntity(typeName, store.entities.getGlobalId(expressId), expressId),
        ifcType: typeName,
        predefinedType: stripEnumDots(findAttr("PredefinedType")),
        name: typeof name === "string" ? name : null,
        attributes,
        propertySets,
        classifications: readClassifications(store, expressId),
        materials: readMaterials(store, expressId),
      });
      scopeExpressIds.push(expressId);
    }
  }

  // Second pass: every normalized entity's identity is known, so a whole can be described with the
  // same predefinedType the element itself would report. An ancestor outside the normalized set
  // falls back to the type the entity index names, with no predefined type to offer.
  const identityByExpressId = new Map(
    scopeExpressIds.map((expressId, index) => [
      expressId,
      { ifcType: idsScope[index].ifcType, predefinedType: idsScope[index].predefinedType },
    ])
  );
  // ifc-lite's graph maps IFCRELNESTS onto the same `Aggregates` edge type as IFCRELAGGREGATES —
  // sensible for a viewer, a false pass for IDS, which asks about one or the other. The edge
  // carries the relationship entity's express id, so its real type is recoverable here without
  // patching the library.
  const wholesOf = resolvePartOf(
    (expressId) =>
      store.relationships.inverse.getEdges(expressId).flatMap((edge) => {
        const relation = store.entityIndex.byId.get(edge.relationshipId)?.type?.toUpperCase();
        return relation === undefined ? [] : [{ relation, wholeId: edge.target }];
      }),
    (expressId) => {
      const known = identityByExpressId.get(expressId);
      if (known) return known;
      const indexed = store.entityIndex.byId.get(expressId);
      return indexed ? { ifcType: indexed.type.toUpperCase(), predefinedType: null } : null;
    }
  );
  for (const [index, expressId] of scopeExpressIds.entries()) {
    idsScope[index].partOf = wholesOf(expressId);
  }

  warnAboutUnrecognizedTypes(unrecognized);
  const modelStructure = buildIfcLiteModelStructure(store, elementTypeByExpressId);
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
}
