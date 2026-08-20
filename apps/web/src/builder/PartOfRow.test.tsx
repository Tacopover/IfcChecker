import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PartOfFacetDraft } from "@ifc-qa/ids-validator";
import { PartOfRow } from "./PartOfRow";
import type { FieldsForResult } from "./introspect";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [],
  propertySets: [],
  classifications: [],
  materials: [],
  ifcTypes: [],
  wholes: [
    {
      relation: "IFCRELCONTAINEDINSPATIALSTRUCTURE",
      ifcType: "IFCBUILDINGSTOREY",
      hits: 8,
      predefinedTypes: [{ value: "ELEMENT", count: 8 }],
    },
    {
      relation: "IFCRELAGGREGATES",
      ifcType: "IFCBUILDING",
      hits: 5,
      predefinedTypes: [],
    },
    // The same class reached two ways: one entry per relation, because a facet states both.
    {
      relation: "IFCRELNESTS",
      ifcType: "IFCBUILDINGSTOREY",
      hits: 2,
      predefinedTypes: [{ value: "COMPLEX", count: 2 }],
    },
  ],
};

const FACET: PartOfFacetDraft = {
  id: "p1",
  kind: "partOf",
  relation: null,
  entityName: { kind: "simple", value: "IFCBUILDINGSTOREY" },
  predefinedType: null,
  cardinality: "required",
};

function Harness({
  initial = FACET,
  touched = true,
}: {
  initial?: PartOfFacetDraft;
  touched?: boolean;
}) {
  const [facet, setFacet] = useState(initial);
  const [isTouched, setIsTouched] = useState(touched);
  return (
    <PartOfRow
      facet={facet}
      source={SOURCE}
      hits={4}
      matched={10}
      touched={isTouched}
      onTouch={() => setIsTouched(true)}
      onChange={setFacet}
      onDuplicate={() => {}}
      onDelete={() => {}}
    />
  );
}

function suggestionsFor(label: string): string[] {
  const box = screen.getByLabelText(label);
  const listId = box.getAttribute("list") ?? "";
  return Array.from(document.getElementById(listId)?.querySelectorAll("option") ?? []).map(
    (option) => option.getAttribute("value") ?? ""
  );
}

describe("PartOfRow", () => {
  it("shows the class and the predefined type as two independent values", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Class")).toHaveValue("IFCBUILDINGSTOREY");
    // No <predefinedType> at all: the facet asks nothing about it.
    expect(screen.getByLabelText("Predefined type operator")).toHaveValue("exists");
    expect(screen.queryByLabelText("Predefined type")).toBeNull();
  });

  // `ids.xsd` makes the nested <entity><name> mandatory, so the editor must not offer the reading
  // that would write none — the same asymmetry a classification's <system> has.
  it("withholds the absent reading from the class, which the schema makes mandatory", () => {
    render(<Harness />);

    const operators = Array.from(
      screen.getByLabelText("Class operator").querySelectorAll("option")
    ).map((option) => option.getAttribute("value"));

    expect(operators).not.toContain("exists");
    expect(operators).toContain("equals");
  });

  // Two values, not three. A `partOf cardinality="optional"` is a document the schema does not
  // describe, and the importer already refuses one — so the builder must not be able to write it.
  it("offers only the two cardinalities the schema gives partOf", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const cardinality = screen.getByLabelText("Cardinality");
    const values = Array.from(cardinality.querySelectorAll("option")).map((option) =>
      option.getAttribute("value")
    );
    expect(values).toEqual(["required", "prohibited"]);

    await user.selectOptions(cardinality, "prohibited");
    expect(container.querySelector(".cond")).toHaveClass("prohibited");
    // A prohibited partOf that still names a class — "must not be part of a storey".
    expect(screen.getByLabelText("Class")).toHaveValue("IFCBUILDINGSTOREY");
  });

  // The relationship is an XML attribute with five legal spellings, not an `idsValue`. The select
  // writes the schema's own enumeration members, including the one naming two IFC relationships.
  it("offers every relation the schema lists, and 'any' as the absent one", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const relationship = screen.getByLabelText("Relationship");
    expect(relationship).toHaveValue("");

    const values = Array.from(relationship.querySelectorAll("option")).map((option) =>
      option.getAttribute("value")
    );
    expect(values).toEqual([
      "",
      "IFCRELAGGREGATES",
      "IFCRELASSIGNSTOGROUP",
      "IFCRELCONTAINEDINSPATIALSTRUCTURE",
      "IFCRELNESTS",
      "IFCRELVOIDSELEMENT IFCRELFILLSELEMENT",
    ]);

    await user.selectOptions(relationship, "IFCRELAGGREGATES");
    expect(relationship).toHaveValue("IFCRELAGGREGATES");
  });

  it("offers the classes the file holds, narrowed to the relation the facet names", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Any relation: every whole in the file, commonest first.
    expect(suggestionsFor("Class")).toEqual(["IFCBUILDINGSTOREY", "IFCBUILDING"]);

    await user.selectOptions(screen.getByLabelText("Relationship"), "IFCRELAGGREGATES");
    expect(suggestionsFor("Class")).toEqual(["IFCBUILDING"]);
  });

  // The predefined types offered are the ones seen on wholes of the class the facet names, so a
  // row narrowed to a storey never offers a building's.
  it("offers the predefined types seen under the class and relation named", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Predefined type operator"), "equals");
    // IFCBUILDINGSTOREY is reached two ways here, so both its predefined types are offered.
    expect(suggestionsFor("Predefined type")).toEqual(["ELEMENT", "COMPLEX"]);

    await user.selectOptions(screen.getByLabelText("Relationship"), "IFCRELNESTS");
    expect(suggestionsFor("Predefined type")).toEqual(["COMPLEX"]);
  });

  it("reports an empty enumeration, which XSD would read as accepting anything", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Class operator"), "oneOf");

    expect(screen.getByText(/Tick at least one value/)).toBeInTheDocument();
  });

  it("shows the author's instructions", () => {
    render(<Harness initial={{ ...FACET, instructions: "Every duct sits on a storey." }} />);

    expect(screen.getByText("Every duct sits on a storey.")).toBeInTheDocument();
  });
});

describe("PartOfRow — touched gating", () => {
  it("shows no error for an empty enumeration until the row is touched", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ ...FACET, entityName: { kind: "enum", values: [] } }}
        touched={false}
      />
    );

    expect(screen.queryByText(/Tick at least one value/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Relationship"));
    await user.tab();

    expect(screen.getByText(/Tick at least one value/)).toBeInTheDocument();
  });
});
