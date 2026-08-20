import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConditionDraft, PropertyFacetDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import { ManualConditionRow } from "./ManualConditionRow";

const CONDITION: PropertyFacetDraft = {
  id: "c1",
  kind: "property",
  propertySet: plainName(""),
  name: plainName(""),
  value: null,
  cardinality: "required",
};

function Harness({
  initial = CONDITION,
  touched = true,
  onDuplicate = () => {},
  onDelete = () => {},
}: {
  initial?: ConditionDraft;
  touched?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [condition, setCondition] = useState(initial);
  const [isTouched, setIsTouched] = useState(touched);
  return (
    <ManualConditionRow
      condition={condition}
      touched={isTouched}
      onTouch={() => setIsTouched(true)}
      onChange={setCondition}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />
  );
}

describe("ManualConditionRow", () => {
  it("offers free-text inputs for the property set and field name instead of selects", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Property set").tagName).toBe("INPUT");
    expect(screen.getByLabelText("Field name").tagName).toBe("INPUT");
  });

  it("types into both fields and carries the value through onChange", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Property set"), "Pset_CurtainWallCommon");
    await user.type(screen.getByLabelText("Field name"), "FireRating");

    expect(screen.getByLabelText("Property set")).toHaveValue("Pset_CurtainWallCommon");
    expect(screen.getByLabelText("Field name")).toHaveValue("FireRating");
  });

  it("hides the property set input for an attribute", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Condition kind"), "attribute");
    expect(screen.queryByLabelText("Property set")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Field name")).toBeInTheDocument();
  });

  it("shows the manual-entry note", () => {
    render(<Harness />);

    expect(screen.getByText(/No file to check spelling or offer real values against/)).toBeInTheDocument();
  });

  it("shows 0/0 rather than an undefined score", () => {
    const { container } = render(<Harness />);

    expect(container.querySelector(".score-text")).toHaveTextContent("0/0");
  });

  it("gates its completeness error the same way ConditionRow does", async () => {
    const user = userEvent.setup();
    const incomplete: PropertyFacetDraft = {
      ...CONDITION,
      value: { kind: "affix", operator: "contains", literal: "" },
    };
    render(<Harness initial={incomplete} touched={false} />);

    expect(screen.queryByText(/Enter a value/)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Field name"));
    await user.tab();

    expect(screen.getByText(/Enter a value/)).toBeInTheDocument();
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
