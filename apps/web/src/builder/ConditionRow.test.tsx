import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConditionDraft, PropertyFacetDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import { ConditionRow, defaultConditionFor } from "./ConditionRow";
import type { FieldsForResult } from "./introspect";
import { stating } from "../test/conditions";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [
    { name: "Tag", propertySet: null, hits: 9, coverage: 0.9, values: [{ value: "W-1", count: 1 }], dataTypes: [] },
    { name: "Name", propertySet: null, hits: 10, coverage: 1, values: [{ value: "Wall", count: 10 }], dataTypes: [] },
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
          values: [
            { value: "60", count: 5 },
            { value: "90", count: 3 },
          ],
          dataTypes: [{ value: "IFCLABEL", count: 8 }],
        },
        // Stored two ways, so nothing can be declared without failing the other half.
        {
          name: "Status",
          propertySet: "Pset_WallCommon",
          hits: 10,
          coverage: 1,
          values: [],
          dataTypes: [
            { value: "IFCTEXT", count: 7 },
            { value: "IFCLABEL", count: 3 },
          ],
        },
      ],
    },
    {
      name: "MEP_Data",
      fields: [
        {
          name: "SystemAbbreviation",
          propertySet: "MEP_Data",
          hits: 4,
          coverage: 0.4,
          values: [],
          dataTypes: [{ value: "IFCIDENTIFIER", count: 4 }],
        },
      ],
    },
  ],
};

const CONDITION: PropertyFacetDraft = {
  id: "c1",
  kind: "property",
  propertySet: plainName("Pset_WallCommon"),
  name: plainName("FireRating"),
  ...stating("exists"),
  // What the builder now writes when the field is picked: the type the model reports.
  dataType: "IFCLABEL",
};

function Harness({
  initial = CONDITION,
  onDuplicate = () => {},
  onDelete = () => {},
}: {
  initial?: ConditionDraft;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [condition, setCondition] = useState(initial);
  return (
    <ConditionRow
      condition={condition}
      source={SOURCE}
      hits={7}
      matched={10}
      onChange={setCondition}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />
  );
}

describe("ConditionRow", () => {
  it("reads as a sentence and shows its own hit count", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Condition kind")).toHaveValue("property");
    expect(screen.getByLabelText("Property set")).toHaveValue("Pset_WallCommon");
    expect(screen.getByLabelText("Field name")).toHaveValue("FireRating");
    expect(screen.getByLabelText("Operator")).toHaveValue("exists");
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });

  it("keeps every dropdown operable — each one changes the condition it shows", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Property set"), "MEP_Data");
    expect(screen.getByLabelText("Property set")).toHaveValue("MEP_Data");
    // Switching set must retarget the field too — FireRating does not live in MEP_Data.
    expect(screen.getByLabelText("Field name")).toHaveValue("SystemAbbreviation");

    await user.selectOptions(screen.getByLabelText("Operator"), "startsWith");
    expect(screen.getByLabelText("Operator")).toHaveValue("startsWith");

    await user.selectOptions(screen.getByLabelText("Condition kind"), "attribute");
    expect(screen.queryByLabelText("Property set")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Field name")).toHaveValue("Tag");

    await user.selectOptions(screen.getByLabelText("Field name"), "Name");
    expect(screen.getByLabelText("Field name")).toHaveValue("Name");
  });

  it("offers all eight operators in one list, restrictions and cardinality together", () => {
    render(<Harness />);

    const labels = Array.from(screen.getByLabelText("Operator").querySelectorAll("option")).map(
      (option) => option.textContent
    );
    expect(labels).toEqual([
      "be filled in",
      "be exactly",
      "be one of",
      "contain",
      "start with",
      "end with",
      "match pattern",
    ]);
  });

  // The row reads as one sentence across two controls, and the second is what makes an optional
  // facet and a prohibited value reachable at all — both used to render read-only.
  it("states cardinality beside the operator rather than inside it", () => {
    render(<Harness />);

    const labels = Array.from(
      screen.getByLabelText("Cardinality").querySelectorAll("option")
    ).map((option) => option.textContent);

    expect(labels).toEqual(["must", "if present, must", "must NOT"]);
  });

  it("marks a prohibited row so it does not read like the others", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Cardinality"), "prohibited");

    expect(container.querySelector(".cond")).toHaveClass("prohibited");
  });

  it("edits free text without losing focus between keystrokes", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...CONDITION, ...stating("contains") }} />);

    const input = screen.getByLabelText("Value");
    await user.type(input, "REI");

    expect(input).toHaveValue("REI");
    expect(input).toHaveFocus();
  });

  it("switches to a checkbox list of observed values for oneOf", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Operator"), "oneOf");

    await user.click(screen.getByRole("checkbox", { name: /60\s*5/ }));
    expect(screen.getByRole("checkbox", { name: /60\s*5/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /90\s*3/ })).not.toBeChecked();
  });

  it("explains an invalid pattern instead of silently failing every element", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...CONDITION, ...stating("matches") }} />);

    const input = screen.getByLabelText("Value");
    // paste, not type: user-event reads {} and [] in typed text as key descriptors.
    await user.click(input);
    await user.paste("[A-Z");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Invalid pattern/)).toBeInTheDocument();

    await user.clear(input);
    await user.paste("[A-Z]{2}");
    expect(screen.queryByText(/Invalid pattern/)).not.toBeInTheDocument();
  });

  it("says so when oneOf has nothing ticked, and stops once one is", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Operator"), "oneOf");
    expect(screen.getByText(/Tick at least one value/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /60\s*5/ }));
    expect(screen.queryByText(/Tick at least one value/)).not.toBeInTheDocument();
  });

  it("says so when an operator that needs text has an empty box", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...CONDITION, ...stating("contains") }} />);

    const input = screen.getByLabelText("Value");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a value/)).toBeInTheDocument();

    await user.type(input, "REI");
    expect(screen.queryByText(/Enter a value/)).not.toBeInTheDocument();
  });

  it("leaves an operator that needs no value unmarked", () => {
    render(<Harness initial={{ ...CONDITION, ...stating("exists", "", [], "prohibited") }} />);

    expect(screen.queryByText(/Enter a value/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tick at least one value/)).not.toBeInTheDocument();
  });

  // The draft model can hold two value shapes no operator states. Neither is reachable from these
  // controls, but a row that quietly showed one as "must be filled in" would be editing it.
  it.each([
    [
      "a numeric range",
      { value: { kind: "bounds", base: "xs:double", min: { value: "10", inclusive: true }, max: null } },
      /numeric range/,
    ],
    [
      "a character count",
      { value: { kind: "length", exact: null, min: "3", max: null } },
      /how many characters/,
    ],
  ] as const)("says what it is holding rather than mislabelling %s", (_label, overrides, expected) => {
    render(<Harness initial={{ ...CONDITION, ...overrides }} />);

    expect(screen.queryByLabelText("Operator")).toBeNull();
    expect(screen.queryByLabelText("Value")).toBeNull();
    expect(screen.getByText(expected)).toBeInTheDocument();
    // The field it is about is still readable and still retargetable, and so is its cardinality.
    expect(screen.getByLabelText("Field name")).toHaveValue("FireRating");
    expect(screen.getByLabelText("Cardinality")).toBeInTheDocument();
  });

  // The two the row used to show read-only. Both are ordinary IDS and both are now editable: an
  // optional facet is checked only where the value is present, and a prohibited value says "must
  // not be Steel" rather than "must not be present at all".
  it.each([
    ["a prohibited value", { cardinality: "prohibited", value: { kind: "simple", value: "Steel" } }, "prohibited", "equals"],
    ["an optional facet", { cardinality: "optional", value: { kind: "simple", value: "REI60" } }, "optional", "equals"],
  ] as const)("edits %s through the two controls", (_label, overrides, cardinality, operator) => {
    render(<Harness initial={{ ...CONDITION, ...overrides }} />);

    expect(screen.getByLabelText("Cardinality")).toHaveValue(cardinality);
    expect(screen.getByLabelText("Operator")).toHaveValue(operator);
    expect(screen.getByLabelText("Value")).toHaveValue(
      overrides.value.kind === "simple" ? overrides.value.value : ""
    );
  });

  // Changing one control must not silently change the other: picking a value for a prohibited facet
  // is how "must not be Steel" is written, and resetting it to required would invert the rule.
  it("keeps the cardinality when the operator changes", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...CONDITION, ...stating("exists", "", [], "prohibited") }} />);

    await user.selectOptions(screen.getByLabelText("Operator"), "equals");

    expect(screen.getByLabelText("Cardinality")).toHaveValue("prohibited");
  });

  // Before the importer read these, a facet carrying them stayed in the kept-but-not-shown list,
  // where the user could at least see something was there. Importing it must not make it invisible.
  it("shows the author's instructions and the uri the requirement is defined at", () => {
    render(
      <Harness
        initial={{
          ...CONDITION,
          instructions: "Ask the architect.",
          uri: "https://example.org/rule",
        }}
      />
    );

    expect(screen.getByText("Ask the architect.")).toBeInTheDocument();
    expect(screen.getByText("https://example.org/rule")).toBeInTheDocument();
    // Text, not a link: the address comes from a file someone else wrote.
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows no note for a condition carrying neither", () => {
    const { container } = render(<Harness />);

    expect(container.querySelector(".cond-note")).toBeNull();
  });

  it("duplicates and deletes itself", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    render(<Harness onDuplicate={onDuplicate} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Duplicate condition" }));
    await user.click(screen.getByRole("button", { name: "Remove condition" }));

    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

// `ids.xsd` types the names as `idsValue`, so an imported facet may name a set of fields. The row
// keeps its operator and its value box; only the two selects have nothing to select.
describe("a name given as a restriction", () => {
  it("shows the property set and the field as phrases instead of selects", () => {
    render(
      <Harness
        initial={{
          ...CONDITION,
          propertySet: { kind: "pattern", source: "Foo_.*" },
          name: { kind: "enum", values: ["A", "B"] },
        }}
      />
    );

    expect(screen.getByLabelText("Property set").tagName).toBe("SPAN");
    expect(screen.getByLabelText("Property set")).toHaveTextContent("matching Foo_.*");
    expect(screen.getByLabelText("Field name").tagName).toBe("SPAN");
    expect(screen.getByLabelText("Field name")).toHaveTextContent("one of A, B");
  });

  it("still shows the operator and lets the value be edited", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ ...CONDITION, name: { kind: "pattern", source: "Fire.*" }, ...stating("equals", "60") }}
      />
    );

    expect(screen.getByLabelText("Operator")).toHaveValue("equals");
    await user.type(screen.getByLabelText("Value"), "0");
    expect(screen.getByLabelText("Value")).toHaveValue("600");
  });

  // The rail's suggestions come from one field, and there is no one field here. An empty list
  // beats offering the values of whichever field the pattern happened to be typed near.
  it("declares no stored type and offers no observed values", () => {
    render(<Harness initial={{ ...CONDITION, name: { kind: "pattern", source: "Fire.*" } }} />);

    const picker = screen.getByLabelText("Stored as");
    expect([...picker.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
      "any type",
      "IFCLABEL (not in file)",
    ]);
  });
});

describe("the stored-as picker", () => {
  // A declared type the model does not hold fails every element, silently. Declaring IFCLABEL on
  // everything cost 668 passing elements on the reference model, so the type has to come from the
  // file and the user has to be able to see and change it.
  it("offers the types the model stores the property as, with counts", () => {
    render(<Harness />);

    const picker = screen.getByLabelText("Stored as");
    expect(picker).toHaveValue("IFCLABEL");
    expect([...picker.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
      "any type",
      "IFCLABEL (8)",
    ]);
  });

  it("lets the user declare no type at all", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Stored as"), "");
    expect(screen.getByLabelText("Stored as")).toHaveValue("");
  });

  it("declares nothing for a property the model stores two ways", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Field name"), "Status");
    const picker = screen.getByLabelText("Stored as");
    expect(picker).toHaveValue("");
    expect([...picker.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
      "any type",
      "IFCTEXT (7)",
      "IFCLABEL (3)",
    ]);
  });

  it("follows the property set to the type the new field is stored as", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Property set"), "MEP_Data");
    expect(screen.getByLabelText("Stored as")).toHaveValue("IFCIDENTIFIER");
  });

  // IDS declares dataType on <property> alone.
  it("is absent for an attribute", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Condition kind"), "attribute");
    expect(screen.queryByLabelText("Stored as")).toBeNull();
  });

  it("keeps an imported type selectable when this model holds nothing stored that way", () => {
    render(<Harness initial={{ ...CONDITION, dataType: "IFCBOOLEAN" }} />);

    const picker = screen.getByLabelText("Stored as");
    expect(picker).toHaveValue("IFCBOOLEAN");
    expect([...picker.querySelectorAll("option")].map((option) => option.textContent)).toContain(
      "IFCBOOLEAN (not in file)"
    );
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
