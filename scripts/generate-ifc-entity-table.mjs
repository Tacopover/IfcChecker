#!/usr/bin/env node
// Regenerates packages/shared-types/src/ifc-entity-table.generated.ts from the
// schema tables shipped by @ifc-lite/data.
//
//   node scripts/generate-ifc-entity-table.mjs [--check]
//
// --check re-derives the table and exits non-zero if the committed file is
// stale, without writing anything.
//
// Why generate rather than hand-write: the previous hand-curated 17-name list
// meant an IfcValve or IfcAirTerminal simply did not exist as far as this tool
// was concerned. The schema is 900+ entities; only the publisher of the schema
// can keep that list honest.
//
// @ifc-lite/data is a dependency of @ifc-qa/parser-adapters, not of the repo
// root, so it is resolved from that package rather than imported directly.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "packages/shared-types/src/ifc-entity-table.generated.ts");
const CHECK = process.argv.includes("--check");

const require = createRequire(join(ROOT, "packages/parser-adapters/package.json"));
const { getEntities, getAttributes } = await import(require.resolve("@ifc-lite/data"));

// IFC4 is the schema this tool targets. IFC2X3 is merged in because Revit and
// Archicad still export it in the field, and dropping its names would gut a
// 2x3 model — but only names IFC4 lacks are taken, so IFC4's parentage wins
// wherever the two disagree.
const BASE_VERSION = "IFC4";
const LEGACY_VERSION = "IFC2X3";

function childIndex(entities) {
  const children = new Map();
  for (const entity of entities) {
    if (!entity.parent) continue;
    const bucket = children.get(entity.parent);
    if (bucket) bucket.push(entity.name);
    else children.set(entity.parent, [entity.name]);
  }
  return children;
}

const base = await getEntities(BASE_VERSION);
const legacy = await getEntities(LEGACY_VERSION);
const baseChildren = childIndex(base);
const legacyByName = new Map(legacy.map((entity) => [entity.name, entity]));

// Depth-first from every EXPRESS root so the emitted map reads as the forest it
// is, and so every entry's parent is always declared before it — consumers
// flatten the ancestor chains in one pass and rely on that ordering.
//
// The map used to stop at IfcProduct, on the reasoning that IfcObject and
// IfcRoot are shared with actors, tasks and resources and so cannot
// discriminate between things in a model. That holds for picking out elements
// to show a reviewer, and is wrong for IDS: an applicability may name any
// entity in the schema, and a type it cannot resolve silently matches nothing.
const parents = new Map();
for (const entity of base) {
  if (entity.parent) continue;
  parents.set(entity.name, null);
  (function walk(name) {
    for (const child of baseChildren.get(name) ?? []) {
      parents.set(child, name);
      walk(child);
    }
  })(entity.name);
}

// A 2x3-only name is grafted onto the nearest ancestor IFC4 still has, so it
// participates in the same tree rather than forming an island: IfcEdgeFeature
// lands under IfcFeatureElementSubtraction, IfcElectricalElement under
// IfcElement. A 2x3-only name that is a root in its own right keeps that.
const legacyOnly = [];
function graftLegacy(name) {
  if (parents.has(name)) return true;
  const entity = legacyByName.get(name);
  if (!entity) return false;
  if (entity.parent && !graftLegacy(entity.parent)) return false;
  parents.set(name, entity.parent ?? null);
  legacyOnly.push(name);
  return true;
}
for (const entity of legacy) graftLegacy(entity.name);
legacyOnly.sort();

// Every entity name either schema declares, upper-cased to the spelling a STEP
// file carries. Consumers use it to tell "a type we know about and chose not to
// keep" from "a type this build has never heard of" — the second is a gap worth
// shouting about, the first is routine.
const recognised = [...new Set([...base, ...legacy].map((entity) => entity.name.toUpperCase()))].sort();

// Which entities EXPRESS declares ABSTRACT, so no instance can ever carry the
// name. IDS matches an entity name exactly, which makes an abstract name a rule
// that selects nothing — the builder expands one into its concrete subtypes
// instead. IFC4 wins where the two schemas disagree, as it does for parentage.
const abstractNames = new Set();
for (const entity of legacy) if (entity.abstract) abstractNames.add(entity.name);
for (const entity of base) {
  if (entity.abstract) abstractNames.add(entity.name);
  else abstractNames.delete(entity.name);
}
const abstractEntities = [...abstractNames].filter((name) => parents.has(name)).sort();

// Which of an entity's attributes hold a value a rule can be compared against,
// as opposed to a reference to another entity or an aggregate of them. The
// schema is the only thing that can answer this: both parsers hand back a
// reference as a bare number, indistinguishable from a real numeric attribute,
// so filtering on the value alone would let a rule compare against an express
// id. `getAttributes` reports it per entity and already accounts for
// inheritance, which is why this is a flat map rather than own-attributes-only
// — 30 entities disagree with what walking the parent chain would produce.
//
// GlobalId, Name and PredefinedType are left out: they have dedicated fields on
// NormalizedElement, and carrying them twice would cost memory on every entity
// in a model to say the same thing.
const PROMOTED_TO_FIELDS = new Set(["GlobalId", "Name", "PredefinedType"]);

async function simpleAttributesByEntity(version) {
  const byEntity = new Map();
  for (const attribute of await getAttributes(version)) {
    if (PROMOTED_TO_FIELDS.has(attribute.name)) continue;
    for (const entity of attribute.simpleValueEntities ?? []) {
      const bucket = byEntity.get(entity);
      if (bucket) bucket.add(attribute.name);
      else byEntity.set(entity, new Set([attribute.name]));
    }
  }
  return byEntity;
}

// Which of those attributes the schema types as a whole number. IDS compares by casting the
// literal a specification wrote to the type the model holds, and "42.0" is a valid double but not
// a valid integer — so an integer attribute must reject it. Both are the JS number 42 by the time
// either parser is done, so only the schema can tell NumberOfRisers from RefractionIndex.
//
// Exactly `xs:integer` and nothing else: `getAttributes` reports a list because a SELECT may admit
// several types, and an attribute that could also be a double or a dateTime does accept "42.0".
async function integerAttributesByEntity(version) {
  const byEntity = new Map();
  for (const attribute of await getAttributes(version)) {
    if (PROMOTED_TO_FIELDS.has(attribute.name)) continue;
    for (const [entity, xsdTypes] of Object.entries(attribute.xsdTypesByEntity ?? {})) {
      if (xsdTypes.length !== 1 || xsdTypes[0] !== "xs:integer") continue;
      const bucket = byEntity.get(entity);
      if (bucket) bucket.add(attribute.name);
      else byEntity.set(entity, new Set([attribute.name]));
    }
  }
  return byEntity;
}

const baseAttributes = await simpleAttributesByEntity(BASE_VERSION);
const legacyAttributes = await simpleAttributesByEntity(LEGACY_VERSION);
// IFC4 wins where the two disagree, matching how the parent map is merged.
const simpleAttributes = new Map(baseAttributes);
for (const [entity, names] of legacyAttributes) {
  if (!simpleAttributes.has(entity)) simpleAttributes.set(entity, names);
}
const simpleAttributeEntries = [...simpleAttributes]
  .map(([entity, names]) => [entity, [...names].sort()])
  .sort(([left], [right]) => left.localeCompare(right));

const baseIntegers = await integerAttributesByEntity(BASE_VERSION);
const legacyIntegers = await integerAttributesByEntity(LEGACY_VERSION);
const integerAttributes = new Map(baseIntegers);
for (const [entity, names] of legacyIntegers) {
  if (!integerAttributes.has(entity)) integerAttributes.set(entity, names);
}
const integerAttributeEntries = [...integerAttributes]
  .map(([entity, names]) => [entity, [...names].sort()])
  .sort(([left], [right]) => left.localeCompare(right));

const header = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-ifc-entity-table.mjs
// Source: @ifc-lite/data schema tables, ${BASE_VERSION} merged with ${LEGACY_VERSION}-only names.
`;

const body = `${header}
/**
 * Every IFC entity either schema declares, mapped to its direct EXPRESS
 * supertype; an entity with no supertype maps to \`null\`. Declaration order is
 * depth-first from each root, so a parent always appears before its children.
 *
 * The whole schema and not just the product subtree, because an IDS
 * applicability may name any entity — a type this table cannot resolve matches
 * nothing, and a rule that matches nothing used to report the model clean.
 */
export const IFC_ENTITY_PARENTS: Readonly<Record<string, string | null>> = {
${[...parents].map(([name, parent]) => `  ${name}: ${parent === null ? "null" : JSON.stringify(parent)},`).join("\n")}
};

/**
 * Names that exist only in ${LEGACY_VERSION}. They are part of
 * \`IFC_ENTITY_PARENTS\` so a 2x3 export is not gutted, but a rule written
 * against one will not match anything in an ${BASE_VERSION} model.
 */
export const IFC_LEGACY_TYPE_NAMES: readonly string[] = [
${legacyOnly.map((name) => `  ${JSON.stringify(name)},`).join("\n")}
];

/**
 * Upper-case names of every entity in ${BASE_VERSION} or ${LEGACY_VERSION},
 * product or not. Membership answers "is this type known to this build at
 * all?"; it says nothing about whether the type is worth keeping.
 */
export const IFC_RECOGNISED_ENTITY_NAMES: readonly string[] = \`
${recognised.join("\n")}
\`.trim().split("\\n");

/**
 * Entities EXPRESS declares ABSTRACT. No instance in any model carries one of
 * these names, so an IDS facet naming one matches nothing under the exact
 * matching \`entity-facet.md\` requires — which is why the builder expands a
 * selected type into its concrete subtypes before it writes the file.
 *
 * Schema spelling, not the upper case a STEP file uses, so it reads against
 * \`IFC_ENTITY_PARENTS\` directly.
 */
export const IFC_ABSTRACT_ENTITY_NAMES: readonly string[] = [
${abstractEntities.map((name) => `  ${JSON.stringify(name)},`).join("\n")}
];

/**
 * Per entity, the attributes that hold a comparable value rather than a
 * reference to another entity or an aggregate of them. Upper-case entity names,
 * as a STEP file spells them; attribute names in their schema spelling.
 *
 * Only the schema can draw this line: both parsers hand back a reference as a
 * bare number, so filtering on the value alone would let a rule compare against
 * an express id. Inheritance is already accounted for, so each list is complete
 * on its own.
 *
 * \`GlobalId\`, \`Name\` and \`PredefinedType\` are deliberately absent — they have
 * dedicated fields on \`NormalizedElement\`.
 */
export const IFC_SIMPLE_ATTRIBUTE_NAMES: Readonly<Record<string, readonly string[]>> = {
${simpleAttributeEntries
  .map(([entity, names]) => `  ${JSON.stringify(entity)}: [${names.map((n) => JSON.stringify(n)).join(", ")}],`)
  .join("\n")}
};

/**
 * Of those, the ones the schema types as exactly \`xs:integer\`.
 *
 * IDS compares by casting the literal a specification wrote to the type the model holds, and
 * "42.0" is a valid double but not a valid integer. Both arrive as the JS number 42, so only the
 * schema separates \`NumberOfRisers\` — which must reject "42.0" — from \`RefractionIndex\`, which
 * must accept it. Attributes admitting several types are left out: one that may also be a double
 * does accept "42.0".
 *
 * No table for the other XSD types: string, boolean, date and duration place no constraint on the
 * literal that comparing them as text does not already place.
 */
export const IFC_INTEGER_ATTRIBUTE_NAMES: Readonly<Record<string, readonly string[]>> = {
${integerAttributeEntries
  .map(([entity, names]) => `  ${JSON.stringify(entity)}: [${names.map((n) => JSON.stringify(n)).join(", ")}],`)
  .join("\n")}
};
`;

const previous = (() => {
  try {
    return readFileSync(OUTPUT, "utf8");
  } catch {
    return null;
  }
})();

if (CHECK) {
  if (previous === body) {
    console.log(`up to date — ${parents.size} entity types, ${legacyOnly.length} legacy, ${recognised.length} recognised`);
    process.exit(0);
  }
  console.error(`STALE: ${OUTPUT} does not match @ifc-lite/data. Run: node scripts/generate-ifc-entity-table.mjs`);
  process.exit(1);
}

writeFileSync(OUTPUT, body);
console.log(
  `wrote ${OUTPUT}\n  ${parents.size} entity types across both schemas` +
    `\n  ${simpleAttributeEntries.length} entities with simple-valued attributes` +
    `\n  ${integerAttributeEntries.length} entities with integer-typed attributes` +
    `\n  ${legacyOnly.length} ${LEGACY_VERSION}-only: ${legacyOnly.join(", ")}` +
    `\n  ${recognised.length} recognised entity names` +
    `\n  ${abstractEntities.length} abstract entities`
);
