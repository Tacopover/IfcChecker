import type { RuleDraft } from "./rule-draft.js";

/**
 * One rule stating every facet `ids.xsd` allows in `<requirements>`, in the schema's own order.
 *
 * Shared by the exporter tests and the XSD conformance tests, because it has to be checked two
 * ways: that `parseIdsXml` reads it back into what `compileDraft` produced, and that the real
 * `ids.xsd` accepts the document. Nothing here is reachable from a file yet — the importer reads
 * two of the six kinds and keeps the other four verbatim — so this fixture is the only thing
 * holding those four exporter branches honest until it does.
 */
export const EVERY_FACET: RuleDraft[] = [
  {
    id: "r1",
    name: "All six",
    entityTypes: ["IfcWall"],
    conditions: [
      {
        id: "f1",
        kind: "attribute",
        propertySet: null,
        name: { kind: "simple", value: "Name" },
        value: { kind: "simple", value: "W-1" },
        cardinality: "required",
      },
      {
        id: "f2",
        kind: "property",
        propertySet: { kind: "simple", value: "Pset_WallCommon" },
        // A pattern-valued name, which `ids.xsd` allows here exactly as it allows one on a value.
        name: { kind: "pattern", source: "Fire.*" },
        value: { kind: "enum", values: ["60", "90"] },
        cardinality: "required",
      },
      {
        id: "f3",
        kind: "entity",
        name: { kind: "enum", values: ["IFCWALL", "IFCWALLSTANDARDCASE"] },
        predefinedType: null,
      },
      {
        id: "f4",
        kind: "classification",
        system: { kind: "simple", value: "NL/SfB" },
        value: { kind: "pattern", source: "21\\..*" },
        uri: "https://example.org/nlsfb",
        cardinality: "required",
      },
      {
        id: "f5",
        kind: "material",
        value: { kind: "simple", value: "Concrete" },
        cardinality: "optional",
        instructions: "Structural concrete only.",
      },
      {
        id: "f6",
        kind: "partOf",
        // One member of the schema's relations enumeration is two names in a single value.
        relation: "IFCRELVOIDSELEMENT IFCRELFILLSELEMENT",
        entityName: { kind: "simple", value: "IFCBUILDINGSTOREY" },
        predefinedType: null,
        cardinality: "prohibited",
      },
    ],
  },
];
