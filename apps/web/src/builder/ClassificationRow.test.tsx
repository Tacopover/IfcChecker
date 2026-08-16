import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ClassificationFacetDraft } from "@ifc-qa/ids-validator";
import { ClassificationRow } from "./ClassificationRow";
import type { FieldsForResult } from "./introspect";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [],
  propertySets: [],
  classifications: [
    {
      system: "Uniformat",
      hits: 8,
      values: [
        { value: "B2010", count: 6 },
        { value: "B20", count: 2 },
      ],
    },
    { system: "NL/SfB", hits: 3, values: [{ value: "21.22", count: 3 }] },
    // A reference the file leaves unnamed: its codes are real, its system cannot be picked.
    { system: null, hits: 1, values: [{ value: "99", count: 1 }] },
  ],
  materials: [],
  wholes: [],
  ifcTypes: [],
};

const FACET: ClassificationFacetDraft = {
  id: "c1",
  kind: "classification",
  system: { kind: "simple", value: "Uniformat" },
  value: null,
  cardinality: "required",
};

function Harness({ initial = FACET }: { initial?: ClassificationFacetDraft }) {
  const [facet, setFacet] = useState(initial);
  return (
    <ClassificationRow
      facet={facet}
      source={SOURCE}
      hits={4}
      matched={10}
      onChange={setFacet}
      onDuplicate={() => {}}
      onDelete={() => {}}
    />
  );
}

function options(label: string): string[] {
  return Array.from(screen.getByLabelText(label).querySelectorAll("option")).map(
    (option) => option.textContent ?? ""
  );
}

describe("ClassificationRow", () => {
  it("shows the system and the code as two independent values", () => {
    render(<Harness />);

    expect(screen.getByLabelText("System")).toHaveValue("Uniformat");
    // No <value> at all: the facet asks only that the element be classified in the system.
    expect(screen.getByLabelText("Code operator")).toHaveValue("exists");
    expect(screen.queryByLabelText("Code")).toBeNull();
  });

  // `ids.xsd` makes <system> mandatory, and `compileValue` would turn a stated-nothing system into
  // an empty restriction, which XSD reads as *any* string — a rule that selects far more than it says.
  it("never offers the absent reading for the system, which the schema makes mandatory", () => {
    render(<Harness />);

    expect(options("System operator")).not.toContain("be filled in");
    expect(options("Code operator")).toContain("be anything");
  });

  it("edits the code, and offers the codes the file holds under the chosen system", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Code operator"), "equals");
    const box = screen.getByLabelText("Code");
    await user.type(box, "B2010");

    expect(box).toHaveValue("B2010");
    const listId = box.getAttribute("list") ?? "";
    const suggestions = Array.from(
      document.getElementById(listId)?.querySelectorAll("option") ?? []
    ).map((option) => option.getAttribute("value"));
    expect(suggestions).toEqual(["B2010", "B20"]);
  });

  // The rail's promise: everything offered comes from the user's own file. A system the file does
  // not name cannot be picked, because `<system>` cannot state "no name".
  it("offers only the systems the file names", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("System operator"), "oneOf");

    const ticks = Array.from(document.querySelectorAll(".vopt span")).map((node) => node.textContent);
    expect(ticks).toContain("Uniformat");
    expect(ticks).toContain("NL/SfB");
    expect(ticks).not.toContain("");
  });

  // A pattern-valued system reaches a set of systems, so no single code list is the right one and
  // offering all of them is the honest answer.
  it("offers every code when the system is a pattern rather than one name", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...FACET, value: { kind: "simple", value: "" } }} />);

    await user.selectOptions(screen.getByLabelText("System operator"), "matches");

    const listId = screen.getByLabelText("Code").getAttribute("list") ?? "";
    const suggestions = Array.from(
      document.getElementById(listId)?.querySelectorAll("option") ?? []
    ).map((option) => option.getAttribute("value"));
    expect(suggestions).toEqual(["B2010", "21.22", "B20", "99"]);
  });

  it("states cardinality, so an optional or prohibited classification is reachable", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    expect(options("Cardinality")).toEqual(["must", "if present, must", "must NOT"]);

    await user.selectOptions(screen.getByLabelText("Cardinality"), "prohibited");
    expect(container.querySelector(".cond")).toHaveClass("prohibited");
  });

  it("reports an empty enumeration, which XSD would read as accepting anything", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Code operator"), "oneOf");

    expect(screen.getByText(/Tick at least one value/)).toBeInTheDocument();
  });
});
