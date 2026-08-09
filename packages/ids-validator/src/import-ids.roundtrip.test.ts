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
      "Classified elements are named",
      "Some storey must exist",
    ]);
  });

  it("still exports a rule the builder authored from scratch as plain IFC4", () => {
    const xml = buildIdsXml([
      { id: "r1", name: "Authored", entityTypes: ["IfcWall"], conditions: [] },
    ]);

    expect(xml).toContain(`<specification name="Authored" ifcVersion="IFC4">`);
    expect(xml).toContain(`<applicability minOccurs="1" maxOccurs="unbounded">`);
  });
});
