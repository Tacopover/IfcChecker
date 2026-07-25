import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConditionDraft } from "@ifc-qa/ids-validator";
import { ConditionRow, defaultConditionFor } from "./ConditionRow";
import type { FieldsForResult } from "./introspect";

const SOURCE: FieldsForResult = {
  total: 10,
  attributes: [
    { name: "Tag", propertySet: null, hits: 9, coverage: 0.9, values: [{ value: "W-1", count: 1 }] },
    { name: "Name", propertySet: null, hits: 10, coverage: 1, values: [{ value: "Wall", count: 10 }] },
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
        },
        { name: "Status", propertySet: "Pset_WallCommon", hits: 10, coverage: 1, values: [] },
      ],
    },
    {
      name: "MEP_Data",
      fields: [
        { name: "SystemAbbreviation", propertySet: "MEP_Data", hits: 4, coverage: 0.4, values: [] },
      ],
    },
  ],
};

const CONDITION: ConditionDraft = {
  id: "c1",
  kind: "property",
  propertySet: "Pset_WallCommon",
  name: "FireRating",
  operator: "exists",
  values: [],
  text: "",
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
      "must be filled in",
      "must be exactly",
      "must be one of",
      "must contain",
      "must start with",
      "must end with",
      "must match pattern",
      "must NOT be filled in",
    ]);
  });

  it("marks a prohibited row so it does not read like the others", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Operator"), "notExists");

    expect(container.querySelector(".cond")).toHaveClass("prohibited");
  });

  it("edits free text without losing focus between keystrokes", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...CONDITION, operator: "contains" }} />);

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
    render(<Harness initial={{ ...CONDITION, operator: "matches" }} />);

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
    render(<Harness initial={{ ...CONDITION, operator: "contains" }} />);

    const input = screen.getByLabelText("Value");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a value/)).toBeInTheDocument();

    await user.type(input, "REI");
    expect(screen.queryByText(/Enter a value/)).not.toBeInTheDocument();
  });

  it("leaves an operator that needs no value unmarked", () => {
    render(<Harness initial={{ ...CONDITION, operator: "notExists" }} />);

    expect(screen.queryByText(/Enter a value/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tick at least one value/)).not.toBeInTheDocument();
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

describe("defaultConditionFor", () => {
  it("points at the first property set of the selection", () => {
    expect(defaultConditionFor(SOURCE)).toMatchObject({
      kind: "property",
      propertySet: "Pset_WallCommon",
      name: "FireRating",
      operator: "exists",
    });
  });

  it("falls back to an attribute when the selection has no property sets", () => {
    expect(defaultConditionFor({ ...SOURCE, propertySets: [] })).toMatchObject({
      kind: "attribute",
      propertySet: null,
      name: "Tag",
    });
  });
});
