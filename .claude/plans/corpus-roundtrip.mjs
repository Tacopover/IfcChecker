// Corpus round-trip: import every real .ids file and export it again, then compare what a
// conforming reader sees on both sides. The safety net for any change to the draft model —
// the number of files reproduced must never fall, and the number of specifications the
// importer has to pass through verbatim must never rise.
//
//   node .claude/plans/corpus-roundtrip.mjs [corpus-root]
//
// Default root is /tmp/ids-corpus. The corpus is not in the repo; see the plan for how it was
// assembled. Run with npx tsx so the validator's TypeScript sources load directly.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { idsXmlToDrafts } from "/root/IfcChecker/packages/ids-validator/src/import-ids.ts";
import { buildIdsXml } from "/root/IfcChecker/packages/ids-validator/src/build-ids.ts";
import { parseIdsXml } from "/root/IfcChecker/packages/ids-validator/src/parse-ids.ts";
import { idsSchemaViolations } from "/root/IfcChecker/packages/ids-validator/src/ids-schema-shape.ts";

const ROOT = process.argv[2] ?? "/tmp/ids-corpus";

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walk(path, out);
    else if (entry.toLowerCase().endsWith(".ids")) out.push(path);
  }
  return out;
}

/** RegExp instances never compare equal, so compare their sources instead. */
function comparable(specifications) {
  return JSON.stringify(specifications, (_key, value) =>
    value instanceof RegExp ? { regexSource: value.source } : value
  );
}

const files = walk(ROOT);
if (files.length === 0) {
  console.error(`no .ids files under ${ROOT}`);
  process.exit(1);
}

/**
 * How many facet elements each specification's `<requirements>` holds, counted from the text.
 *
 * Crude on purpose: it exists only to be compared against the importer's own count, and a reader
 * sharing the importer's parser could share its mistake. Facet tags are the six ids.xsd allows.
 */
const FACET_TAG = /<(?:[A-Za-z0-9_.-]+:)?(entity|partOf|classification|attribute|property|material)\b/g;
// A partOf wraps an <entity> of its own, which would otherwise count as a second facet.
const PART_OF_ELEMENT = /<(?:[A-Za-z0-9_.-]+:)?partOf\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_.-]+:)?partOf>/g;
const REQUIREMENTS =
  /<(?:[A-Za-z0-9_.-]+:)?requirements\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?requirements>/;

const SPECIFICATION_ELEMENT =
  /<(?:[A-Za-z0-9_.-]+:)?specification\b[^>]*>[\s\S]*?<\/(?:[A-Za-z0-9_.-]+:)?specification>/g;

function sourceFacetCount(specificationXml) {
  const requirements = REQUIREMENTS.exec(specificationXml);
  if (!requirements) return 0;
  const flattened = requirements[1].replace(PART_OF_ELEMENT, "<partOf/>");
  return [...flattened.matchAll(FACET_TAG)].length;
}

function documentFacetCount(idsXml) {
  return [...idsXml.matchAll(SPECIFICATION_ELEMENT)].reduce(
    (total, match) => total + sourceFacetCount(match[0]),
    0
  );
}

let reproduced = 0;
let facetsLost = 0;
const facetLossExamples = [];
let drifted = 0;
let importFailed = 0;
let specifications = 0;
let refusedSpecifications = 0;
let passThroughFacets = 0;
let violationsIn = 0;
let violationsOut = 0;
const driftExamples = [];
const refusalReasons = new Map();
const passThroughConstructs = new Map();
// `readFacet` reports the first reason that fires and stops, so removing one exposes the next.
// The construct alone cannot show that; the reason is what says which piece of work is left.
const passThroughReasons = new Map();
const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

for (const file of files) {
  const source = readFileSync(file, "utf8");
  let out;
  let imported;
  try {
    imported = idsXmlToDrafts(source);
    out = buildIdsXml(imported.rules, {
      title: imported.title ?? undefined,
      date: "2026-08-06",
      extraInfo: imported.extraInfo,
      untouched: imported.refused.map((entry) => entry.passThrough),
    });
  } catch (error) {
    importFailed++;
    continue;
  }

  specifications += imported.rules.length + imported.refused.length;
  refusedSpecifications += imported.refused.length;
  for (const rule of imported.rules) {
    passThroughFacets += rule.imported?.passThrough.length ?? 0;
    for (const entry of rule.imported?.passThrough ?? []) {
      bump(passThroughConstructs, entry.construct);
      bump(passThroughReasons, `${entry.construct}: ${entry.reason ?? "no reason recorded"}`);
    }
  }
  for (const entry of imported.refused) {
    for (const reason of entry.reasons) bump(refusalReasons, `${reason.section}/${reason.construct}`);
  }

  // Every requirement facet is either shown or kept, never neither. A facet read into the model
  // and then not compiled would leave `isEvaluable` calling a specification checked when part of
  // it is not — the one way this import can produce a false pass.
  const kept =
    imported.rules.reduce(
      (total, rule) => total + rule.conditions.length + (rule.imported?.passThrough.length ?? 0),
      0
    ) +
    imported.refused.reduce((total, entry) => total + sourceFacetCount(entry.passThrough.xml), 0);
  if (kept !== documentFacetCount(source)) {
    facetsLost++;
    if (facetLossExamples.length < 10) {
      facetLossExamples.push(`${file} (source ${documentFacetCount(source)}, held ${kept})`);
    }
  }

  if (idsSchemaViolations(source).length > 0) violationsIn++;
  if (idsSchemaViolations(out).length > 0) violationsOut++;

  let same;
  try {
    same = comparable(parseIdsXml(source)) === comparable(parseIdsXml(out));
  } catch {
    same = false;
  }
  if (same) reproduced++;
  else {
    drifted++;
    if (driftExamples.length < 10) driftExamples.push(file);
  }
}

console.log(`corpus root                      ${ROOT}`);
console.log(`files                            ${files.length}`);
console.log(`reproduced (a reader agrees)     ${reproduced} / ${files.length}`);
console.log(`drifted                          ${drifted}`);
console.log(`import threw                     ${importFailed}`);
console.log(`specifications                   ${specifications}`);
console.log(`  refused whole                  ${refusedSpecifications}`);
console.log(`  facets passed through verbatim ${passThroughFacets}`);
console.log(`schema-invalid in / out          ${violationsIn} / ${violationsOut}`);
console.log(`files losing a requirement facet ${facetsLost}`);
const rank = (map) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => `  ${String(count).padStart(6)}  ${key}`);
console.log(`\nwhy a specification was refused (reasons, not specifications):\n${rank(refusalReasons).join("\n")}`);
console.log(`\nfacets passed through verbatim, by construct:\n${rank(passThroughConstructs).join("\n")}`);
console.log(`\nfacets passed through verbatim, by reason:\n${rank(passThroughReasons).join("\n")}`);
if (driftExamples.length) console.log(`\nfirst drifted files:\n  ${driftExamples.join("\n  ")}`);
if (facetLossExamples.length) {
  console.log(`\nfirst files losing a facet:\n  ${facetLossExamples.join("\n  ")}`);
}
