import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MaterialFacetDraft } from "@ifc-qa/ids-validator";
import { MaterialRow } from "./MaterialRow";
import type { FieldsForResult } from "./introspect";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [],
  propertySets: [],
  classifications: [],
  materials: [
    { value: "Concrete", count: 6 },
    { value: "Cast in situ", count: 2 },
  ],
  wholes: [],
  ifcTypes: [],
};

const FACET: MaterialFacetDraft = {
  id: "m1",
  kind: "material",
  value: { kind: "simple", value: "Concrete" },
  cardinality: "required",
};

function Harness({ initial = FACET }: { initial?: MaterialFacetDraft }) {
  const [facet, setFacet] = useState(initial);
  return (
    <MaterialRow
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

describe("MaterialRow", () => {
  it("edits the material name, offering the ones the file holds", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const box = screen.getByLabelText("Material");
    expect(box).toHaveValue("Concrete");

    await user.clear(box);
    await user.type(box, "Steel");
    expect(box).toHaveValue("Steel");

    const listId = box.getAttribute("list") ?? "";
    const suggestions = Array.from(
      document.getElementById(listId)?.querySelectorAll("option") ?? []
    ).map((option) => option.getAttribute("value"));
    expect(suggestions).toEqual(["Concrete", "Cast in situ"]);
  });

  // The asymmetry with a classification's system, which `ids.xsd` makes mandatory. A material
  // stating no value is a real check — "is this made of anything at all" — so the reading is offered.
  it("offers the absent reading, because a material with no value is a real check", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const operator = screen.getByLabelText("Material operator");
    const labels = Array.from(operator.querySelectorAll("option")).map(
      (option) => option.textContent
    );
    expect(labels).toContain("be anything");

    await user.selectOptions(operator, "exists");
    expect(screen.queryByLabelText("Material")).toBeNull();
  });

  it("states cardinality, so an optional or prohibited material is reachable", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Cardinality"), "prohibited");

    // "must not be made of Concrete" — a prohibited facet that still names a value, which the
    // old operator list could not state at all.
    expect(container.querySelector(".cond")).toHaveClass("prohibited");
    expect(screen.getByLabelText("Material")).toHaveValue("Concrete");
  });

  it("reports an empty enumeration, which XSD would read as accepting anything", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Material operator"), "oneOf");

    expect(screen.getByText(/Tick at least one value/)).toBeInTheDocument();
  });

  it("shows the author's instructions and the uri the requirement is defined at", () => {
    render(
      <Harness
        initial={{ ...FACET, instructions: "Ask the architect.", uri: "https://example.test/m" }}
      />
    );

    expect(screen.getByText("Ask the architect.")).toBeInTheDocument();
    expect(screen.getByText("https://example.test/m")).toBeInTheDocument();
  });
});
