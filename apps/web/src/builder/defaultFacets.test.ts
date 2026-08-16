import { describe, expect, it } from "vitest";
import { plainName } from "@ifc-qa/ids-validator";
import { defaultConditionFor, defaultFacetFor } from "./defaultFacets";
import type { FieldsForResult } from "./introspect";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [
    { name: "Tag", propertySet: null, hits: 9, coverage: 0.9, values: [], dataTypes: [] },
    { name: "Name", propertySet: null, hits: 10, coverage: 1, values: [], dataTypes: [] },
  ],
  propertySets: [
    {
      name: "Pset_WallCommon",
      fields: [
        {
          name: "FireRating",
          propertySet: "Pset_WallCommon",
          hits: 8,
          coverage: 0.8,
          values: [],
          dataTypes: [{ value: "IFCLABEL", count: 8 }],
        },
      ],
    },
  ],
  classifications: [
    // A reference the file leaves unnamed comes first on hits and still cannot be stated.
    { system: null, hits: 9, values: [] },
    { system: "Uniformat", hits: 6, values: [] },
  ],
  materials: [{ value: "Concrete", count: 4 }],
  wholes: [
    {
      relation: "IFCRELCONTAINEDINSPATIALSTRUCTURE",
      ifcType: "IFCBUILDINGSTOREY",
      hits: 7,
      predefinedTypes: [],
    },
  ],
  ifcTypes: [{ ifcType: "IFCWALL", hits: 10, predefinedTypes: [] }],
};

const EMPTY: FieldsForResult = {
  total: 0,
  attributes: [],
  propertySets: [],
  classifications: [],
  materials: [],
  wholes: [],
  ifcTypes: [],
};

describe("defaultFacetFor", () => {
  it("fills each mandatory parameter from the selection, not from a constant", () => {
    expect(defaultFacetFor("classification", SOURCE)).toMatchObject({
      kind: "classification",
      system: plainName("Uniformat"),
      value: null,
      cardinality: "required",
    });
    expect(defaultFacetFor("partOf", SOURCE)).toMatchObject({
      kind: "partOf",
      relation: null,
      entityName: plainName("IFCBUILDINGSTOREY"),
      cardinality: "required",
    });
    expect(defaultFacetFor("entity", SOURCE)).toMatchObject({
      kind: "entity",
      name: plainName("IFCWALL"),
      predefinedType: null,
    });
  });

  // A material stating no value asks whether the element is made of anything at all, which is the
  // weakest true question of that kind — a guess at which material was meant would be a rule the
  // user did not write.
  it("starts every optional parameter absent", () => {
    expect(defaultFacetFor("material", SOURCE)).toMatchObject({
      kind: "material",
      value: null,
      cardinality: "required",
    });
    expect(defaultFacetFor("property", SOURCE)).toMatchObject({ value: null });
  });

  // `<system>` is an idsValue, which cannot state "no name", so the system select drops an unnamed
  // reference and the default has to drop it too — even though it is the commonest one here.
  it("skips a classification system the file leaves unnamed", () => {
    expect(defaultFacetFor("classification", SOURCE)).toMatchObject({
      system: plainName("Uniformat"),
    });
  });

  // Left empty rather than invented: `conditionProblem` then says "Enter a value" beside the row
  // and `exportBlockers` refuses the download, which is a visible unfinished rule.
  it("leaves a mandatory parameter the model cannot fill empty", () => {
    expect(defaultFacetFor("classification", EMPTY)).toMatchObject({ system: plainName("") });
    expect(defaultFacetFor("partOf", EMPTY)).toMatchObject({ entityName: plainName("") });
    expect(defaultFacetFor("entity", EMPTY)).toMatchObject({ name: plainName("") });
  });

  it("mints ids under the prefix the side asks for", () => {
    expect(defaultFacetFor("material", SOURCE, "a").id).toMatch(/^a\d+$/);
    expect(defaultFacetFor("material", SOURCE).id).toMatch(/^c\d+$/);
  });
});

describe("defaultConditionFor", () => {
  it("points at the first property set of the selection", () => {
    expect(defaultConditionFor(SOURCE)).toMatchObject({
      kind: "property",
      propertySet: plainName("Pset_WallCommon"),
      name: plainName("FireRating"),
      value: null,
      cardinality: "required",
      dataType: "IFCLABEL",
    });
  });

  it("falls back to an attribute when the selection has no property sets", () => {
    expect(defaultConditionFor({ ...SOURCE, propertySets: [] })).toMatchObject({
      kind: "attribute",
      propertySet: null,
      name: plainName("Tag"),
    });
  });
});
