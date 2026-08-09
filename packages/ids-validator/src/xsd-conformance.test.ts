import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIdsXml } from "./build-ids.js";
import { idsSchemaViolations } from "./ids-schema-shape.js";
import { idsXmlToDrafts } from "./import-ids.js";
import type { ConditionDraft, ConditionOperator, RuleDraft } from "./rule-draft.js";
import { idsXsdViolations } from "./xsd-conformance.js";

/**
 * Tier A of the conformance work: every document we emit is checked against the real `ids.xsd`
 * rather than against `idsSchemaViolations`, which was written from the same reading of the schema
 * as the exporter and so cannot catch a shared misreading.
 */

const FIXTURES = ["mixed-fidelity.ids", "naming-and-fire-rating.ids", "partly-understood.ids"];

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/ids/${name}`, import.meta.url), "utf8");
}

function reexport(idsXml: string): string {
  const { rules, refused, title, extraInfo } = idsXmlToDrafts(idsXml);
  return buildIdsXml(rules, {
    title: title ?? undefined,
    date: "2026-08-06",
    extraInfo,
    untouched: refused.map((entry) => entry.passThrough),
  });
}

/** Text that has to survive XML escaping: entities, quotes, regex metacharacters, non-ASCII. */
const HOSTILE_TEXT = [
  "Plain label",
  "Fire & Smoke",
  "<not-a-tag>",
  `quote " and apostrophe '`,
  "meta . * + ? ( ) [ ] { } | ^ $ \\",
  "ümlaut — 建築 ✓",
  "",
];

/** `matches` passes the text through as an XSD pattern, so it needs patterns rather than labels. */
const PATTERNS = ["[A-Z]{2}-[0-9]+", ".*", "(a|b)+c?", "\\d{4}-\\d{2}-\\d{2}", "[^@]+@[^\\.]+\\..+"];

const OPERATORS: ConditionOperator[] = [
  "exists",
  "notExists",
  "equals",
  "oneOf",
  "contains",
  "startsWith",
  "endsWith",
  "matches",
];

const ENTITY_SETS: [string, string[]][] = [
  ["no entity types", []],
  ["one entity type", ["IfcWall"]],
  ["several entity types", ["IfcDuctSegment", "IfcDuctFitting", "IfcFlowTerminal"]],
];

/** The data types an import can carry: authored default, a deliberate omission, and a real one. */
const DATA_TYPES: (string | null | undefined)[] = [undefined, null, "IFCBOOLEAN"];

function textsFor(operator: ConditionOperator): string[] {
  return operator === "matches" ? PATTERNS : HOSTILE_TEXT;
}

function condition(
  operator: ConditionOperator,
  kind: ConditionDraft["kind"],
  text: string,
  index: number
): ConditionDraft {
  return {
    id: `c${index}`,
    kind,
    propertySet: kind === "property" ? `Pset_${text === "" ? "Empty" : "Hostile"} & Set` : null,
    name: text === "" ? "Unnamed" : `Name ${text}`,
    operator,
    values: [text, `${text} second`, "plain"],
    text,
    dataType: kind === "property" ? DATA_TYPES[index % DATA_TYPES.length] : undefined,
  };
}

/** One document per operator × entity set, holding every kind × text combination as its own rule. */
function authoredDocument(operator: ConditionOperator, entityTypes: string[]): string {
  const rules: RuleDraft[] = [];
  let index = 0;
  for (const kind of ["attribute", "property"] as const) {
    for (const text of textsFor(operator)) {
      rules.push({
        id: `r${index}`,
        name: `${operator} ${kind} ${index}`,
        entityTypes,
        conditions: [condition(operator, kind, text, index)],
      });
      index += 1;
    }
  }
  // Plus one rule carrying every condition at once, which is where facet ordering shows up.
  rules.push({
    id: "combined",
    name: `${operator} combined`,
    entityTypes,
    conditions: rules.map((rule) => rule.conditions[0]),
  });
  return buildIdsXml(rules, { title: `Authored: ${operator} & <friends>`, date: "2026-08-09" });
}

const AUTHORED: [string, string][] = OPERATORS.flatMap((operator) =>
  ENTITY_SETS.map(
    ([label, entityTypes]) =>
      [`${operator} with ${label}`, authoredDocument(operator, entityTypes)] as [string, string]
  )
);

describe("ids.xsd conformance of what we emit", () => {
  it.each(FIXTURES)("accepts the %s fixture as it stands on disk", async (name) => {
    expect(await idsXsdViolations(fixture(name))).toEqual([]);
  });

  it.each(FIXTURES)("emits a schema-valid document when re-exporting %s", async (name) => {
    expect(await idsXsdViolations(reexport(fixture(name)))).toEqual([]);
  });

  it.each(AUTHORED)("emits a schema-valid document for %s", async (_label, xml) => {
    expect(await idsXsdViolations(xml)).toEqual([]);
  });

  it("emits a schema-valid document for a rule with no conditions at all", async () => {
    const xml = buildIdsXml([{ id: "r1", name: "Bare", entityTypes: ["IfcWall"], conditions: [] }]);

    expect(await idsXsdViolations(xml)).toEqual([]);
  });
});

/**
 * Negative controls. A checker that says yes to everything is worse than no checker, and the
 * schema-compile warnings libxml2 emits are filtered out, so an unnoticed compile failure would
 * otherwise read as a clean sweep.
 */
const INVALID: [string, string][] = [
  ["a document that is not XML", "not xml <<<"],
  ["a root element that is not <ids>", `<?xml version="1.0"?><project />`],
  [
    "an <ids> in no namespace",
    `<?xml version="1.0"?><ids><info><title>T</title></info><specifications /></ids>`,
  ],
  [
    "<info> children out of the order the schema declares",
    document(`<specification name="S" ifcVersion="IFC4"><applicability /></specification>`).replace(
      `<info><title>T</title></info>`,
      `<info><description>D</description><title>T</title></info>`
    ),
  ],
  [
    "two <entity> facets in one applicability",
    document(`<specification name="S" ifcVersion="IFC4"><applicability>
       <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
       <entity><name><simpleValue>IFCSLAB</simpleValue></name></entity>
     </applicability></specification>`),
  ],
  [
    "a specification with no ifcVersion",
    document(`<specification name="S"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability></specification>`),
  ],
  [
    "an IFC version the schema does not list",
    document(`<specification name="S" ifcVersion="IFC4X1"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability></specification>`),
  ],
  [
    "facets out of the order the schema declares",
    document(`<specification name="S" ifcVersion="IFC4"><applicability>
       <property><propertySet><simpleValue>P</simpleValue></propertySet><baseName><simpleValue>B</simpleValue></baseName></property>
       <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>
     </applicability></specification>`),
  ],
  [
    "a classification requirement with no system",
    document(`<specification name="S" ifcVersion="IFC4"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
     <requirements><classification><value><simpleValue>21</simpleValue></value></classification></requirements></specification>`),
  ],
  [
    "optional cardinality on a partOf",
    document(`<specification name="S" ifcVersion="IFC4"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
     <requirements><partOf cardinality="optional"><entity><name><simpleValue>IFCSPACE</simpleValue></name></entity></partOf></requirements></specification>`),
  ],
  [
    "a relation the schema does not list",
    document(`<specification name="S" ifcVersion="IFC4"><applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
     <requirements><partOf relation="IFCRELCONNECTS"><entity><name><simpleValue>IFCSPACE</simpleValue></name></entity></partOf></requirements></specification>`),
  ],
  [
    "a parameter holding both a simple value and a restriction",
    document(`<specification name="S" ifcVersion="IFC4"><applicability><entity><name>
       <simpleValue>IFCWALL</simpleValue>
       <xs:restriction base="xs:string"><xs:enumeration value="IFCSLAB" /></xs:restriction>
     </name></entity></applicability></specification>`),
  ],
  ["<specifications> with no specification in it", document("")],
];

function document(specifications: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
    `  <info><title>T</title></info>`,
    `  <specifications>${specifications}</specifications>`,
    `</ids>`,
  ].join("\n");
}

describe("ids.xsd rejects what it should", () => {
  it.each(INVALID)("reports %s", async (_label, xml) => {
    expect(await idsXsdViolations(xml)).not.toEqual([]);
  });
});

/**
 * `idsSchemaViolations` stays in the browser as the fast in-process check, so it is worth knowing
 * where it and the real schema disagree. Agreement on the verdict is the contract; the wording of
 * the two messages is not.
 */
describe("idsSchemaViolations agrees with the real schema", () => {
  const CORPUS: [string, string][] = [
    ...FIXTURES.map((name) => [name, fixture(name)] as [string, string]),
    ...FIXTURES.map((name) => [`re-exported ${name}`, reexport(fixture(name))] as [string, string]),
    ...AUTHORED,
    ...INVALID,
  ];

  it.each(CORPUS)("reaches the same verdict on %s", async (_label, xml) => {
    const bySchema = (await idsXsdViolations(xml)).length > 0;
    const byShape = idsSchemaViolations(xml).length > 0;

    expect({ bySchema, byShape }).toEqual({ bySchema, byShape: bySchema });
  });
});
