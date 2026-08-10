import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import { RuleCard } from "./RuleCard";
import { introspectModel } from "./introspect";

function wall(index: number, fireRating: string | null): NormalizedElement {
  return {
    globalId: `w${index}`,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${index}`,
    attributes: { Tag: { value: `W-${index}` } },
    propertySets: {
      Pset_WallCommon:
        fireRating === null
          ? { Status: { value: "New" } }
          : { Status: { value: "New" }, FireRating: { value: fireRating } },
    },
  };
}

function door(index: number): NormalizedElement {
  return {
    globalId: `d${index}`,
    ifcType: "IFCDOOR",
    predefinedType: null,
    name: `Door ${index}`,
    attributes: {},
    propertySets: { Pset_DoorCommon: { FireRating: { value: "30" } } },
  };
}

const ELEMENTS: NormalizedElement[] = [wall(1, "60"), wall(2, "90"), wall(3, null), door(1), door(2)];
const INTROSPECTION = introspectModel(ELEMENTS);

const RULE: RuleDraft = {
  id: "r1",
  name: "Walls declare a fire rating",
  entityTypes: ["IfcWall"],
  conditions: [
    {
      id: "c1",
      kind: "property",
      propertySet: "Pset_WallCommon",
      name: "FireRating",
      operator: "exists",
      values: [],
      text: "",
    },
  ],
};

function Harness({
  initial = RULE,
  isOpen = true,
  onDuplicate = () => {},
  onDelete = () => {},
}: {
  initial?: RuleDraft;
  isOpen?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [rule, setRule] = useState(initial);
  const [open, setOpen] = useState(isOpen);
  const [showFailures, setShowFailures] = useState(false);
  return (
    <RuleCard
      rule={rule}
      elements={ELEMENTS}
      introspection={INTROSPECTION}
      isActive
      isOpen={open}
      showFailures={showFailures}
      onChange={setRule}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onActivate={() => {}}
      onToggleOpen={() => setOpen((value) => !value)}
      onToggleFailures={() => setShowFailures((value) => !value)}
    />
  );
}

describe("RuleCard", () => {
  it("scores the rule against the model, at rule and at condition level", () => {
    const { container } = render(<Harness />);

    expect(container.querySelector(".rule-head .score-text")).toHaveTextContent("2/3");
    expect(container.querySelector(".cond-score .score-text")).toHaveTextContent("2/3");
    expect(container.querySelector(".rule-foot .score-text")).toHaveTextContent("1 of 3 fail");
  });

  it("distinguishes a group chip from a concrete type chip", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(
      screen.getByLabelText("Add entity type or group"),
      "IfcBuildingElement"
    );

    const group = screen.getByTitle(/covers IfcWall, IfcDoor/);
    expect(group).toHaveClass("group");
    expect(within(group).getByText("2 types · 5")).toBeInTheDocument();
    expect(screen.getByTitle("IfcWall")).not.toHaveClass("group");
  });

  it("re-scores when the applicability widens to a group's subtypes", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.selectOptions(
      screen.getByLabelText("Add entity type or group"),
      "IfcBuildingElement"
    );

    // Doors have no Pset_WallCommon at all, so they join the matched set and fail.
    expect(container.querySelector(".rule-foot .score-text")).toHaveTextContent("3 of 5 fail");
  });

  it("lists the elements that fail, on demand", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show failing elements" }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("w3")).toBeInTheDocument();
    expect(within(table).getByText("not set")).toBeInTheDocument();
  });

  it("adds, duplicates and removes conditions", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "+ condition" }));
    expect(screen.getAllByLabelText("Operator")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Duplicate condition" })[0]);
    expect(screen.getAllByLabelText("Operator")).toHaveLength(3);

    await user.click(screen.getAllByRole("button", { name: "Remove condition" })[0]);
    expect(screen.getAllByLabelText("Operator")).toHaveLength(2);
  });

  it("renames without remounting the row underneath it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const title = screen.getByLabelText("Rule name");
    await user.clear(title);
    await user.type(title, "Fire ratings");

    expect(title).toHaveValue("Fire ratings");
    expect(title).toHaveFocus();
  });

  it("collapses to its header and offers duplicate and delete throughout", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    render(<Harness onDuplicate={onDuplicate} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /^Collapse/ }));
    expect(screen.queryByLabelText("Operator")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Duplicate rule/ }));
    await user.click(screen.getByRole("button", { name: /^Delete rule/ }));
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("removes an entity type from the applicability", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Remove IfcWall" }));

    expect(container.querySelector(".rule-foot .score-text")).toHaveTextContent(
      "No matching elements in this file"
    );
  });

  it("flags a rule stripped of its last entity type — IDS has no applicability to write", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    expect(container.querySelector(".rule-error")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove IfcWall" }));

    expect(screen.getByText(/No element types/)).toHaveClass("rule-error");
  });

  it("flags a rule with nothing to check rather than passing it off as a hint", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Remove condition" }));

    expect(screen.getByText(/No conditions/)).toHaveClass("rule-error");
  });
});
