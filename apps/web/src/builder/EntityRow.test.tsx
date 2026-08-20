import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EntityFacetDraft } from "@ifc-qa/ids-validator";
import { EntityRow } from "./EntityRow";
import type { FieldsForResult } from "./introspect";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [],
  propertySets: [],
  classifications: [],
  materials: [],
  wholes: [],
  ifcTypes: [
    {
      ifcType: "IFCWALL",
      hits: 7,
      predefinedTypes: [
        { value: "PARTITIONING", count: 5 },
        { value: "SOLIDWALL", count: 2 },
      ],
    },
    { ifcType: "IFCDOOR", hits: 3, predefinedTypes: [{ value: "DOOR", count: 3 }] },
  ],
};

const FACET: EntityFacetDraft = {
  id: "e1",
  kind: "entity",
  name: { kind: "simple", value: "IFCWALL" },
  predefinedType: null,
};

function Harness({
  initial = FACET,
  touched = true,
}: {
  initial?: EntityFacetDraft;
  touched?: boolean;
}) {
  const [facet, setFacet] = useState(initial);
  const [isTouched, setIsTouched] = useState(touched);
  return (
    <EntityRow
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

describe("EntityRow", () => {
  it("shows the class and the predefined type as two independent values", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Class")).toHaveValue("IFCWALL");
    // No <predefinedType> at all: the facet asks nothing about it.
    expect(screen.getByLabelText("Predefined type operator")).toHaveValue("exists");
    expect(screen.queryByLabelText("Predefined type")).toBeNull();
  });

  // `ids.xsd` gives the requirements-side <entity> no cardinality, and says why: the list of
  // classes is finite and mandated by IFC, so a prohibited form would be superfluous.
  it("states no cardinality, because the schema gives this facet none", () => {
    const { container } = render(<Harness />);

    expect(screen.queryByLabelText("Cardinality")).toBeNull();
    expect(container.querySelector(".cond")).not.toHaveClass("prohibited");
  });

  // The class is matched exactly and case-sensitively against the file's own spelling, so the row
  // must offer IFCWALL and never the IfcWall the applicability chips use.
  it("offers the classes as the file spells them, not as the type chips do", () => {
    render(<Harness />);

    expect(suggestionsFor("Class")).toEqual(["IFCWALL", "IFCDOOR"]);
  });

  it("narrows the predefined types to the class the facet names", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Predefined type operator"), "equals");
    expect(suggestionsFor("Predefined type")).toEqual(["PARTITIONING", "SOLIDWALL"]);

    const box = screen.getByLabelText("Class");
    await user.clear(box);
    await user.type(box, "IFCDOOR");
    expect(suggestionsFor("Predefined type")).toEqual(["DOOR"]);
  });

  // A pattern names a set of classes, so no single list of predefined types is the right one and
  // every one in the selection is offered — the answer the classification and partOf rows give too.
  it("offers every predefined type when the class is a pattern", async () => {
    const user = userEvent.setup();
    render(
      <Harness initial={{ ...FACET, name: { kind: "pattern", sources: ["IFC.*"] } }} />
    );

    await user.selectOptions(screen.getByLabelText("Predefined type operator"), "equals");

    // Merged across every class and ranked by count, so DOOR (3) sits above SOLIDWALL (2).
    expect(suggestionsFor("Predefined type")).toEqual(["PARTITIONING", "DOOR", "SOLIDWALL"]);
  });

  // `<name>` is mandatory, and `compileValue` would turn a stated-nothing name into an empty
  // restriction, which XSD reads as *any* string.
  it("withholds the absent reading from the class, which the schema makes mandatory", () => {
    render(<Harness />);

    const operators = Array.from(
      screen.getByLabelText("Class operator").querySelectorAll("option")
    ).map((option) => option.getAttribute("value"));

    expect(operators).not.toContain("exists");
    expect(operators).toContain("equals");
  });

  it("reports an empty enumeration, which XSD would read as accepting anything", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Class operator"), "oneOf");

    expect(screen.getByText(/Tick at least one value/)).toBeInTheDocument();
  });

  it("shows the author's instructions", () => {
    render(<Harness initial={{ ...FACET, instructions: "Only walls, not their types." }} />);

    expect(screen.getByText("Only walls, not their types.")).toBeInTheDocument();
  });
});

describe("EntityRow — touched gating", () => {
  it("shows no error for an empty enumeration until the row is touched", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...FACET, name: { kind: "enum", values: [] } }} touched={false} />);

    expect(screen.queryByText(/Tick at least one value/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Predefined type operator"));
    await user.tab();

    expect(screen.getByText(/Tick at least one value/)).toBeInTheDocument();
  });
});
