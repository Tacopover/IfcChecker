import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApplicabilityFacetDraft, FacetDraft } from "@ifc-qa/ids-validator";
import { ApplicabilityRow, RequirementRow } from "./FacetRow";
import type { FieldsForResult } from "./introspect";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [{ name: "Name", propertySet: null, hits: 10, coverage: 1, values: [], dataTypes: [] }],
  propertySets: [],
  classifications: [{ system: "Uniformat", hits: 4, values: [] }],
  materials: [{ value: "Concrete", count: 4 }],
  wholes: [
    {
      relation: "IFCRELCONTAINEDINSPATIALSTRUCTURE",
      ifcType: "IFCBUILDINGSTOREY",
      hits: 4,
      predefinedTypes: [],
    },
  ],
  ifcTypes: [{ ifcType: "IFCWALL", hits: 10, predefinedTypes: [] }],
};

const ATTRIBUTE: ApplicabilityFacetDraft = {
  id: "a1",
  kind: "attribute",
  propertySet: null,
  name: { kind: "simple", value: "Name" },
  value: { kind: "simple", value: "W-01" },
  cardinality: "required",
};

const CLASSIFICATION: ApplicabilityFacetDraft = {
  id: "a2",
  kind: "classification",
  system: { kind: "simple", value: "Uniformat" },
  value: null,
  cardinality: "required",
};

const MATERIAL: ApplicabilityFacetDraft = {
  id: "a3",
  kind: "material",
  value: { kind: "simple", value: "Concrete" },
  cardinality: "required",
};

const PART_OF: ApplicabilityFacetDraft = {
  id: "a4",
  kind: "partOf",
  relation: null,
  entityName: { kind: "simple", value: "IFCBUILDINGSTOREY" },
  predefinedType: null,
  cardinality: "required",
};

function renderApplicability(facet: ApplicabilityFacetDraft) {
  return render(
    <ApplicabilityRow
      facet={facet}
      source={SOURCE}
      touched
      onTouch={() => {}}
      onChange={() => {}}
      onDuplicate={() => {}}
      onDelete={() => {}}
    />
  );
}

function renderRequirement(facet: FacetDraft) {
  return render(
    <RequirementRow
      facet={facet}
      source={SOURCE}
      hits={4}
      matched={10}
      touched
      onTouch={() => {}}
      onChange={() => {}}
      onDuplicate={() => {}}
      onDelete={() => {}}
    />
  );
}

describe("ApplicabilityRow", () => {
  // `applicabilityType` references the base facet types; `requirementsType` is what extends each of
  // them with cardinality. A select on this side would write a document the schema does not
  // describe — and the importer refuses exactly that document on the way back in.
  it.each([
    ["attribute", ATTRIBUTE],
    ["classification", CLASSIFICATION],
    ["material", MATERIAL],
    ["partOf", PART_OF],
  ])("states no cardinality on a %s, because the schema gives it none", (_kind, facet) => {
    renderApplicability(facet as ApplicabilityFacetDraft);

    expect(screen.queryByLabelText("Cardinality")).toBeNull();
  });

  // The facet narrows the count beside the rule rather than being passed or failed by the elements
  // it selects, so a fraction here would be a claim about the wrong thing.
  it("shows no score of its own, and still offers duplicate and delete", () => {
    const { container } = renderApplicability(MATERIAL);

    expect(container.querySelector(".score-text")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove the material this rule selects by" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Duplicate the material this rule selects by" })
    ).toBeInTheDocument();
  });

  // Same value editor, same model-fed suggestions: the two sides differ in what they may state
  // about the facet, never in how its value is written.
  it("edits the value with the same control the requirement side uses", () => {
    renderApplicability(MATERIAL);

    expect(screen.getByLabelText("Material")).toHaveValue("Concrete");
    expect(screen.getByLabelText("Material operator")).toHaveValue("equals");
  });

  it("reads as a selector rather than a requirement", () => {
    renderApplicability(CLASSIFICATION);

    expect(screen.getByText(/selects only those classified in a system that must/)).toBeInTheDocument();
  });
});

describe("RequirementRow", () => {
  it("states the cardinality the same facet withholds on the applicability side", () => {
    renderRequirement(MATERIAL as FacetDraft);

    expect(screen.getByLabelText("Cardinality")).toHaveValue("required");
  });

  it("shows the score, which is what a requirement has and a selector does not", () => {
    const { container } = renderRequirement(MATERIAL as FacetDraft);

    expect(container.querySelector(".score-text")).toHaveTextContent("4/10");
  });

  // The one kind that stands on the requirements side alone: an applicability entity is the rule's
  // own type chips, the only facet whose selection can be listed rather than tested.
  it("renders the entity kind, which the applicability side never holds", () => {
    renderRequirement({
      id: "e1",
      kind: "entity",
      name: { kind: "simple", value: "IFCWALL" },
      predefinedType: null,
    });

    expect(screen.getByLabelText("Class")).toHaveValue("IFCWALL");
  });
});
