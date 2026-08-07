// Goal 3a: measure what real IDS files actually contain, versus what our parser + RuleDraft model.
// Reads a corpus of .ids files and reports construct frequency plus per-specification
// representability against the builder's model.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "/root/IfcChecker/packages/ids-validator/node_modules/fast-xml-parser/src/fxp.js";

const ATTRS = ":@";
const TEXT = "#text";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  preserveOrder: true,
});

const tagOf = (n) => Object.keys(n).find((k) => k !== ATTRS) ?? null;
const kidsOf = (n, t) => (Array.isArray(n[t]) ? n[t] : []);
const attrsOf = (n) => (n[ATTRS] && typeof n[ATTRS] === "object" ? n[ATTRS] : {});
const named = (ns, t) => ns.filter((n) => tagOf(n) === t);
const descend = (ns, t) => {
  const n = ns.find((c) => tagOf(c) === t);
  return n ? kidsOf(n, t) : [];
};
const textOf = (ns) => {
  for (const n of ns) if (TEXT in n) return String(n[TEXT]);
  return "";
};

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(p, out);
    else if (entry.toLowerCase().endsWith(".ids")) out.push(p);
  }
  return out;
}

// ---- counters -------------------------------------------------------------
const bump = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

class Corpus {
  constructor(label) {
    this.label = label;
    this.files = 0;
    this.specs = 0;
    this.parseFailures = 0;
    this.applicabilityFacets = new Map();
    this.requirementFacets = new Map();
    this.valueForms = new Map();
    this.xsFacets = new Map();
    this.restrictionBases = new Map();
    this.propertyDataTypes = new Map();
    this.attributeNames = new Map();
    this.specAttrs = new Map();
    this.infoFields = new Map();
    this.cardinalities = new Map();
    this.entityNameForms = new Map();
    this.predefinedTypeUse = new Map();
    this.partOfRelations = new Map();
    this.ifcVersions = new Map();
    this.blockers = new Map(); // reason -> spec count
    this.severities = new Map(); // direction of meaning-drift -> spec count
    this.groups = new Map(); // candidate change -> DISTINCT spec count
    this.fullyRepresentable = 0;
    this.filesWithAnyBlocker = new Set();
  }
}

// Inspect a <value> child list: what form does the value take, and which xs facets appear?
function inspectValue(c, facetChildren, where) {
  const valueNode = facetChildren.find((n) => tagOf(n) === "value");
  if (!valueNode) {
    bump(c.valueForms, `${where}: (no value — existence check)`);
    return { form: "none", xs: [] };
  }
  const vc = kidsOf(valueNode, "value");
  if (vc.some((n) => tagOf(n) === "simpleValue")) {
    bump(c.valueForms, `${where}: simpleValue`);
    return { form: "simpleValue", xs: [] };
  }
  const r = vc.find((n) => tagOf(n) === "restriction");
  if (!r) {
    bump(c.valueForms, `${where}: (empty value)`);
    return { form: "empty", xs: [] };
  }
  const rc = kidsOf(r, "restriction");
  const base = String(attrsOf(r)["@_base"] ?? "(none)");
  bump(c.restrictionBases, base);
  const xs = [...new Set(rc.map(tagOf).filter((t) => t && t !== TEXT))];
  for (const f of xs) bump(c.xsFacets, f);
  bump(c.valueForms, `${where}: xs:restriction`);
  return { form: "restriction", xs, base };
}

// Which xs facets the builder can round-trip.
const XS_SUPPORTED = new Set(["enumeration", "pattern"]);

function analyseFile(c, path) {
  let root;
  try {
    root = parser.parse(readFileSync(path, "utf8"));
  } catch {
    c.parseFailures += 1;
    return;
  }
  c.files += 1;
  const ids = descend(root, "ids");

  for (const infoNode of descend(ids, "info")) {
    const t = tagOf(infoNode);
    if (t && t !== TEXT) bump(c.infoFields, t);
  }

  for (const specNode of named(descend(ids, "specifications"), "specification")) {
    c.specs += 1;
    const sa = attrsOf(specNode);
    for (const k of Object.keys(sa)) bump(c.specAttrs, k.replace("@_", ""));
    if (sa["@_ifcVersion"]) {
      for (const v of String(sa["@_ifcVersion"]).split(/\s+/).filter(Boolean)) bump(c.ifcVersions, v);
    }
    const sc = kidsOf(specNode, "specification");
    const blockers = [];

    // --- applicability ---
    const applicability = descend(sc, "applicability");
    const appAttrs = attrsOf(sc.find((n) => tagOf(n) === "applicability") ?? {});
    if (appAttrs["@_minOccurs"] !== undefined || appAttrs["@_maxOccurs"] !== undefined) {
      bump(c.specAttrs, `applicability@minOccurs/maxOccurs`);
    }
    for (const facet of applicability) {
      const tag = tagOf(facet);
      if (!tag || tag === TEXT) continue;
      bump(c.applicabilityFacets, tag);
      const fc = kidsOf(facet, tag);
      if (tag === "entity") {
        const nameChildren = descend(fc, "name");
        const form = nameChildren.some((n) => tagOf(n) === "simpleValue")
          ? "simpleValue"
          : "restriction";
        bump(c.entityNameForms, form);
        if (form !== "simpleValue") blockers.push("applicability: entity name is an xs:restriction, not a plain name");
        if (fc.some((n) => tagOf(n) === "predefinedType")) {
          bump(c.predefinedTypeUse, "applicability entity/predefinedType");
          blockers.push("applicability: entity/predefinedType");
        }
      } else {
        blockers.push(`applicability: <${tag}> facet`);
      }
    }
    if (applicability.filter((n) => tagOf(n) && tagOf(n) !== TEXT).length === 0) {
      blockers.push("applicability: empty (matches every element)");
    }

    // --- requirements ---
    const reqNode = sc.find((n) => tagOf(n) === "requirements");
    const requirements = reqNode ? kidsOf(reqNode, "requirements") : [];
    for (const facet of requirements) {
      const tag = tagOf(facet);
      if (!tag || tag === TEXT) continue;
      bump(c.requirementFacets, tag);
      const fa = attrsOf(facet);
      const card = String(fa["@_cardinality"] ?? "(absent → required)");
      bump(c.cardinalities, card);
      if (card === "optional") blockers.push('requirement: cardinality="optional"');
      const fc = kidsOf(facet, tag);

      if (tag === "attribute") {
        const nameChildren = descend(fc, "name");
        if (!nameChildren.some((n) => tagOf(n) === "simpleValue")) {
          blockers.push("requirement: attribute name is an xs:restriction");
        } else {
          bump(c.attributeNames, textOf(kidsOf(nameChildren.find((n) => tagOf(n) === "simpleValue"), "simpleValue")));
        }
        const v = inspectValue(c, fc, "attribute");
        for (const f of v.xs) if (!XS_SUPPORTED.has(f)) blockers.push(`requirement: xs:${f} restriction`);
      } else if (tag === "property") {
        bump(c.propertyDataTypes, String(fa["@_dataType"] ?? "(absent)"));
        for (const part of ["propertySet", "baseName"]) {
          const pc = descend(fc, part);
          if (pc.length && !pc.some((n) => tagOf(n) === "simpleValue")) {
            blockers.push(`requirement: property ${part} is an xs:restriction`);
          }
        }
        const v = inspectValue(c, fc, "property");
        for (const f of v.xs) if (!XS_SUPPORTED.has(f)) blockers.push(`requirement: xs:${f} restriction`);
        const dt = String(fa["@_dataType"] ?? "");
        if (dt && dt !== "IFCLABEL") blockers.push(`requirement: property dataType="${dt}" (we always emit IFCLABEL)`);
      } else {
        blockers.push(`requirement: <${tag}> facet`);
        if (tag === "partof") {
          bump(c.partOfRelations, String(fa["@_relation"] ?? "(absent)"));
        }
      }
    }
    if (!reqNode) blockers.push("requirements: absent (applicability-only specification)");
    else if (requirements.filter((n) => tagOf(n) && tagOf(n) !== TEXT).length === 0) {
      blockers.push("requirements: empty");
    }

    // spec-level metadata we do not model
    for (const k of ["@_identifier", "@_description", "@_instructions"]) {
      if (sa[k] !== undefined) blockers.push(`spec metadata: ${k.replace("@_", "")} attribute is dropped`);
    }

    const unique = [...new Set(blockers)];
    if (unique.length === 0) c.fullyRepresentable += 1;
    else {
      c.filesWithAnyBlocker.add(path);
      for (const b of unique) bump(c.blockers, b);
      for (const sev of new Set(unique.map(severityOf))) bump(c.severities, sev);
      for (const g of new Set(unique.map(groupOf).filter(Boolean))) bump(c.groups, g);
    }
  }
}

/**
 * The question 3b actually turns on: if we imported lossily and re-exported, which direction would
 * the meaning move? "looser" is the dangerous one — the re-exported file passes elements the
 * original failed, and nothing on screen says so.
 */
function severityOf(blocker) {
  if (blocker.startsWith("spec metadata:")) return "metadata (meaning unchanged)";
  if (blocker.startsWith("requirements: absent") || blocker.startsWith("requirements: empty")) {
    return "LOOSER (silently passes what the original failed)";
  }
  if (blocker.startsWith("applicability:")) return "stricter (checks elements it should not — loud)";
  if (/^requirement: <(partof|material|classification|entity)> facet$/i.test(blocker)) {
    return "LOOSER (silently passes what the original failed)";
  }
  if (/^requirement: xs:(minInclusive|maxInclusive|minExclusive|maxExclusive|length|minLength|maxLength|totalDigits|fractionDigits)/.test(blocker)) {
    return "LOOSER (silently passes what the original failed)";
  }
  if (blocker.includes('cardinality="optional"')) return "stricter (checks elements it should not — loud)";
  if (blocker.includes("dataType=")) return "type change (external checker may match differently)";
  if (blocker.includes("xs:restriction")) return "LOOSER (silently passes what the original failed)";
  if (blocker.startsWith("requirement: xs:annotation")) return "metadata (meaning unchanged)";
  return "other";
}

/** Candidate capability that would unblock a spec, counted once per spec rather than per reason. */
function groupOf(r) {
  if (r.includes("dataType=")) return "carry dataType through instead of hardcoding IFCLABEL";
  if (r.startsWith("applicability: <attribute>") || r.startsWith("applicability: <property>"))
    return "applicability by attribute/property value";
  if (/xs:(min|max)(In|Ex)clusive/.test(r)) return "numeric bounds";
  if (/xs:(min|max)?[Ll]ength/.test(r)) return "length restrictions";
  if (r.includes("optional")) return 'cardinality="optional"';
  if (/requirement: <(classification|material|partof)>/i.test(r))
    return "classification/material/partOf requirement facets";
  if (r.startsWith("requirement: <entity>")) return "entity requirement facet";
  if (r.startsWith("spec metadata:")) return "spec-level metadata";
  if (r.includes("entity name is an xs:restriction") || r.includes("predefinedType"))
    return "entity name pattern / predefinedType in applicability";
  if (r.includes("is an xs:restriction")) return "propertySet/baseName/attribute name as restriction";
  if (r.startsWith("applicability: <")) return "classification/material facets in applicability";
  if (r.startsWith("requirements:")) return "applicability-only or empty specification";
  return null;
}

function table(map, total, limit = 100) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, n]) => `  ${String(n).padStart(6)}  ${total ? `${((n / total) * 100).toFixed(1).padStart(5)}%  ` : ""}${k}`)
    .join("\n");
}

function report(c) {
  const L = [];
  L.push(`\n${"=".repeat(78)}\n${c.label}\n${"=".repeat(78)}`);
  L.push(`files: ${c.files}  (parse failures: ${c.parseFailures})   specifications: ${c.specs}`);
  L.push(
    `fully representable by RuleDraft today: ${c.fullyRepresentable} / ${c.specs} ` +
      `(${((c.fullyRepresentable / (c.specs || 1)) * 100).toFixed(1)}%)`
  );
  L.push(`files containing >=1 unrepresentable spec: ${c.filesWithAnyBlocker.size} / ${c.files}`);
  const sections = [
    ["applicability facets (per occurrence)", c.applicabilityFacets, c.specs],
    ["requirement facets (per occurrence)", c.requirementFacets, null],
    ["value forms", c.valueForms, null],
    ["xs: restriction facets", c.xsFacets, null],
    ["xs:restriction base types", c.restrictionBases, null],
    ["property dataType", c.propertyDataTypes, null],
    ["cardinality", c.cardinalities, null],
    ["entity name form", c.entityNameForms, null],
    ["predefinedType", c.predefinedTypeUse, null],
    ["partOf relation", c.partOfRelations, null],
    ["ifcVersion", c.ifcVersions, null],
    ["<specification> attributes", c.specAttrs, c.specs],
    ["<info> fields", c.infoFields, c.files],
    ["top attribute names required", c.attributeNames, null],
  ];
  for (const [title, map, tot] of sections) {
    if (map.size === 0) continue;
    L.push(`\n-- ${title} --\n${table(map, tot, title.startsWith("top") ? 15 : 40)}`);
  }
  L.push(`\n-- DISTINCT specs unblocked by each candidate change --\n${table(c.groups, c.specs, 20)}`);
  L.push(`\n-- direction of meaning-drift if imported lossily (spec count; a spec can hit several) --\n${table(c.severities, c.specs, 10)}`);
  L.push(`\n-- why specifications are not representable (spec count per reason) --\n${table(c.blockers, c.specs, 40)}`);
  return L.join("\n");
}

// ---- corpora --------------------------------------------------------------
const ROOT = "/tmp/ids-corpus";
const corpora = [
  ["A. buildingSMART official test cases (synthetic — spec coverage, not practice)", [`${ROOT}/IDS-development/Documentation/ImplementersDocumentation/TestCases`]],
  ["B. buildingSMART published examples (hand-authored, realistic)", [`${ROOT}/IDS-development/Documentation/Examples`]],
  ["C. bSI Japan / MLIT BIM-CIM cost estimation, FY2025 edition (real, government-issued)", [`${ROOT}/bSJ_IDS-main/bimcim-cost-estimation/令和7年度用（202510_01）`]],
  ["D. third-party + national (Molio DK, BimBem BR, OpenAEC, ifc-audit)", [`${ROOT}/Community-Sample-Test-Files-main`, `${ROOT}/IDS_BimBem-main`, `${ROOT}/OpenAEC-BIM-validator-master`, `${ROOT}/ifc-audit-master`]],
];

const out = [];
for (const [label, dirs] of corpora) {
  const c = new Corpus(label);
  const files = [];
  for (const d of dirs) {
    try {
      files.push(...walkFiles(d));
    } catch {
      /* missing dir */
    }
  }
  for (const f of files) analyseFile(c, f);
  out.push(report(c));
}
console.log(out.join("\n"));
