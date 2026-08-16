import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { buildIdsXml } from "./build-ids.js";
import { idsSchemaViolations } from "./ids-schema-shape.js";
import { idsXmlToDrafts } from "./import-ids.js";
import { parseIdsXml } from "./parse-ids.js";
import type { ParsedSpecification } from "./parse-ids.js";

const FIXTURES = ["mixed-fidelity.ids", "naming-and-fire-rating.ids", "partly-understood.ids"];

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/ids/${name}`, import.meta.url), "utf8");
}

/** Import, export, and hand back the XML a user who only opened the file would get. */
function reexport(idsXml: string): string {
  const { rules, refused, title, extraInfo } = idsXmlToDrafts(idsXml);
  return buildIdsXml(rules, {
    title: title ?? undefined,
    date: "2026-08-06",
    extraInfo,
    untouched: refused.map((entry) => entry.passThrough),
  });
}

/** RegExp instances never compare equal, so compare their sources instead. */
function comparable(specifications: ParsedSpecification[]): unknown {
  return JSON.parse(
    JSON.stringify(specifications, (_key, value) =>
      value instanceof RegExp ? { __regexSource: value.source } : value
    )
  );
}

const structureParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  preserveOrder: true,
  trimValues: true,
});

type Node = Record<string, unknown>;

/** Whitespace-only text dropped and attribute order normalised, so only real differences survive. */
function normalize(nodes: Node[]): unknown[] {
  const out: unknown[] = [];
  for (const node of nodes) {
    const tag = Object.keys(node).find((key) => key !== ":@");
    if (tag === undefined) continue;
    if (tag === "#text") {
      const text = String(node[tag]).trim();
      if (text !== "") out.push({ text });
      continue;
    }
    const attributes = (node[":@"] ?? {}) as Record<string, string>;
    const sorted: Record<string, string> = {};
    for (const key of Object.keys(attributes).sort()) sorted[key] = String(attributes[key]);
    out.push({ tag, attributes: sorted, children: normalize((node[tag] ?? []) as Node[]) });
  }
  return out;
}

interface Normalized {
  tag: string;
  attributes: Record<string, string>;
  children: Normalized[];
}

/** How many facet elements each specification's `<requirements>` holds, counted from the source. */
function sourceFacetCounts(idsXml: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const specification of structure(idsXml) as Normalized[]) {
    if (specification.tag !== "specification") continue;
    const requirements = specification.children.find((child) => child.tag === "requirements");
    counts.set(specification.attributes["@_name"] ?? "", requirements?.children.length ?? 0);
  }
  return counts;
}

/** The `<specifications>` subtree, which is everything a re-export has to reproduce exactly. */
function structure(idsXml: string): unknown[] {
  const root = structureParser.parse(idsXml) as Node[];
  const ids = (root.find((node) => "ids" in node)?.ids ?? []) as Node[];
  return normalize((ids.find((node) => "specifications" in node)?.specifications ?? []) as Node[]);
}

describe("import / export round-trip", () => {
  it.each(FIXTURES)("means the same thing after re-exporting %s", (name) => {
    const original = fixture(name);

    expect(comparable(parseIdsXml(reexport(original)))).toEqual(comparable(parseIdsXml(original)));
  });

  // Reproducing the input and being valid are different claims, and only the first was tested
  // until an applicability carrying two <entity> elements shipped.
  it.each(FIXTURES)("re-exports %s as a document that still matches the schema", (name) => {
    expect(idsSchemaViolations(reexport(fixture(name)))).toEqual([]);
  });

  it.each(FIXTURES)("reproduces the specifications of %s element for element", (name) => {
    const original = fixture(name);

    expect(structure(reexport(original))).toEqual(structure(original));
  });

  it("survives a second trip, so re-importing an export is stable", () => {
    const once = reexport(fixture("mixed-fidelity.ids"));

    expect(structure(reexport(once))).toEqual(structure(once));
  });

  it("keeps a refused specification in its original position among the rules", () => {
    // The refused specification is third of four in the fixture, and must not drift to the end.
    const names = structure(reexport(fixture("mixed-fidelity.ids"))).map(
      (node) => (node as { attributes: Record<string, string> }).attributes["@_name"]
    );

    expect(names).toEqual([
      "Walls carry a name and a type code",
      "Doors are documented",
      "Everything with a wall-ish class is named",
      "Some storey must exist",
    ]);
  });

  // The one way this import could produce a false pass: a facet read into the model and then not
  // compiled would leave `passThrough` without joining the rule's conditions, and `isEvaluable`
  // would call a specification checked when part of it is not. Counted against the source itself,
  // because both readers refuse things and neither is the authority on how many facets there were.
  it.each(FIXTURES)("reads or keeps every requirement facet in %s, and loses none", (name) => {
    const source = fixture(name);
    const { rules } = idsXmlToDrafts(source);
    const counts = sourceFacetCounts(source);

    for (const rule of rules) {
      expect(
        rule.conditions.length + (rule.imported?.passThrough.length ?? 0),
        `facet count for ${rule.name}`
      ).toBe(counts.get(rule.name));
    }
  });

  // An applicability facet is written from the draft rather than kept verbatim, so the exporter has
  // to put it back in the schema's order, at the schema's indentation, and without the cardinality,
  // instructions and uri that `requirementsType` adds and `applicabilityType` does not.
  it("reproduces an applicability property element for element, and stays valid", () => {
    const source = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
      `  <info><title>T</title></info>`,
      `  <specifications>`,
      `    <specification name="Load-bearing walls" ifcVersion="IFC4">`,
      `      <applicability minOccurs="1" maxOccurs="unbounded">`,
      `        <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>`,
      `        <property dataType="IFCBOOLEAN">`,
      `          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>`,
      `          <baseName><simpleValue>LoadBearing</simpleValue></baseName>`,
      `          <value><simpleValue>TRUE</simpleValue></value>`,
      `        </property>`,
      `      </applicability>`,
      `      <requirements>`,
      `        <attribute><name><simpleValue>Name</simpleValue></name></attribute>`,
      `      </requirements>`,
      `    </specification>`,
      `  </specifications>`,
      `</ids>`,
    ].join("\n");

    expect(structure(reexport(source))).toEqual(structure(source));
    expect(idsSchemaViolations(reexport(source))).toEqual([]);
    expect(comparable(parseIdsXml(reexport(source)))).toEqual(comparable(parseIdsXml(source)));
  });

  // XSD reads several <xs:pattern> as a disjunction, and the draft holds the list so the exporter
  // can write one element per source. Joining them would hand the author back a regex they did not
  // write — which is the whole reason the draft does not store the compiled form.
  it("reproduces two patterns on one value as two elements, in the order they were written", () => {
    const source = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">`,
      `  <info><title>T</title></info>`,
      `  <specifications>`,
      `    <specification name="Regex patterns work in OR" ifcVersion="IFC4">`,
      `      <applicability minOccurs="1" maxOccurs="unbounded">`,
      `        <entity><name><simpleValue>IFCWALL</simpleValue></name></entity>`,
      `      </applicability>`,
      `      <requirements>`,
      `        <attribute>`,
      `          <name><simpleValue>Name</simpleValue></name>`,
      `          <value>`,
      `            <xs:restriction base="xs:string">`,
      `              <xs:pattern value="[a-z]{2}[0-9]{2}" />`,
      `              <xs:pattern value="[A-Z]{2}[0-9]{2}" />`,
      `            </xs:restriction>`,
      `          </value>`,
      `        </attribute>`,
      `      </requirements>`,
      `    </specification>`,
      `  </specifications>`,
      `</ids>`,
    ].join("\n");

    // Read as a rule now rather than kept verbatim, which is what makes the reproduction a claim
    // about the exporter rather than about the pass-through machinery.
    const { rules } = idsXmlToDrafts(source);
    expect(rules[0].imported?.passThrough).toEqual([]);

    expect(structure(reexport(source))).toEqual(structure(source));
    expect(idsSchemaViolations(reexport(source))).toEqual([]);
    expect(comparable(parseIdsXml(reexport(source)))).toEqual(comparable(parseIdsXml(source)));
  });

  it("still exports a rule the builder authored from scratch as plain IFC4", () => {
    const xml = buildIdsXml([
      { id: "r1", name: "Authored", entityTypes: ["IfcWall"], conditions: [] },
    ]);

    expect(xml).toContain(`<specification name="Authored" ifcVersion="IFC4">`);
    expect(xml).toContain(`<applicability minOccurs="1" maxOccurs="unbounded">`);
  });
});
