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
const { getEntities } = await import(require.resolve("@ifc-lite/data"));

// IFC4 is the schema this tool targets. IFC2X3 is merged in because Revit and
// Archicad still export it in the field, and dropping its names would gut a
// 2x3 model — but only names IFC4 lacks are taken, so IFC4's parentage wins
// wherever the two disagree.
const BASE_VERSION = "IFC4";
const LEGACY_VERSION = "IFC2X3";
// The subtree that carries everything with a physical or spatial presence.
// Above IfcProduct sit IfcObject/IfcObjectDefinition/IfcRoot, which are shared
// with actors, tasks and resources and can never discriminate between things
// in a model.
const SUBTREE_ROOT = "IfcProduct";

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

// Depth-first from the root so the emitted map reads as the tree it is, and so
// every entry's parent is always declared before it.
const parents = new Map([[SUBTREE_ROOT, null]]);
(function walk(name) {
  for (const child of baseChildren.get(name) ?? []) {
    parents.set(child, name);
    walk(child);
  }
})(SUBTREE_ROOT);

// A 2x3-only name is grafted onto the nearest ancestor IFC4 still has, so it
// participates in the same tree rather than forming an island: IfcEdgeFeature
// lands under IfcFeatureElementSubtraction, IfcElectricalElement under
// IfcElement.
const legacyOnly = [];
function graftLegacy(name) {
  if (parents.has(name)) return true;
  const entity = legacyByName.get(name);
  if (!entity?.parent) return false;
  if (!graftLegacy(entity.parent)) return false;
  parents.set(name, entity.parent);
  legacyOnly.push(name);
  return true;
}
for (const entity of legacy) {
  if (parents.has(entity.name)) continue;
  // Only graft what 2x3 itself considered part of the product subtree.
  let cursor = legacyByName.get(entity.name);
  const seen = new Set();
  while (cursor?.parent && !seen.has(cursor.parent)) {
    seen.add(cursor.parent);
    if (cursor.parent === SUBTREE_ROOT) {
      graftLegacy(entity.name);
      break;
    }
    cursor = legacyByName.get(cursor.parent);
  }
}
legacyOnly.sort();

// Every entity name either schema declares, upper-cased to the spelling a STEP
// file carries. Consumers use it to tell "a type we know about and chose not to
// keep" from "a type this build has never heard of" — the second is a gap worth
// shouting about, the first is routine.
const recognised = [...new Set([...base, ...legacy].map((entity) => entity.name.toUpperCase()))].sort();

const header = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-ifc-entity-table.mjs
// Source: @ifc-lite/data schema tables, ${BASE_VERSION} merged with ${LEGACY_VERSION}-only names.
`;

const body = `${header}
/**
 * Every IFC entity in the \`${SUBTREE_ROOT}\` subtree, mapped to its direct
 * EXPRESS supertype. \`${SUBTREE_ROOT}\` itself maps to \`null\` — the chain is
 * deliberately cut there (see the generator for why). Declaration order is
 * depth-first, so a parent always appears before its children.
 */
export const IFC_PRODUCT_PARENTS: Readonly<Record<string, string | null>> = {
${[...parents].map(([name, parent]) => `  ${name}: ${parent === null ? "null" : JSON.stringify(parent)},`).join("\n")}
};

/**
 * Names that exist only in ${LEGACY_VERSION}. They are part of
 * \`IFC_PRODUCT_PARENTS\` so a 2x3 export is not gutted, but a rule written
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
    console.log(`up to date — ${parents.size} product types, ${legacyOnly.length} legacy, ${recognised.length} recognised`);
    process.exit(0);
  }
  console.error(`STALE: ${OUTPUT} does not match @ifc-lite/data. Run: node scripts/generate-ifc-entity-table.mjs`);
  process.exit(1);
}

writeFileSync(OUTPUT, body);
console.log(
  `wrote ${OUTPUT}\n  ${parents.size} types in the ${SUBTREE_ROOT} subtree` +
    `\n  ${legacyOnly.length} ${LEGACY_VERSION}-only: ${legacyOnly.join(", ")}` +
    `\n  ${recognised.length} recognised entity names`
);
