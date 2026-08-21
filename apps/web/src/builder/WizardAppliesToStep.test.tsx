import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { WizardAppliesToStep } from "./WizardAppliesToStep";
import { introspectModel } from "./introspect";

function wall(index: number): NormalizedElement {
  return {
    globalId: `w${index}`,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${index}`,
    attributes: {},
    propertySets: {},
  };
}

function door(index: number): NormalizedElement {
  return {
    globalId: `d${index}`,
    ifcType: "IFCDOOR",
    predefinedType: null,
    name: `Door ${index}`,
    attributes: {},
    propertySets: {},
  };
}

// IfcWall and IfcDoor share the real schema ancestor IfcBuildingElement, so introspection groups
// them the same way `RuleBuilderPage.test.tsx` relies on: "IfcBuildingElement · 2 types · 5".
const ELEMENTS = [wall(1), wall(2), wall(3), door(1), door(2)];
const INTROSPECTION = introspectModel(ELEMENTS);

function Harness({
  entityTypes = [] as string[],
  showAllTypes = false,
  onNext = () => {},
  onCancel = () => {},
}: {
  entityTypes?: string[];
  showAllTypes?: boolean;
  onNext?: () => void;
  onCancel?: () => void;
}) {
  const [types, setTypes] = useState(entityTypes);
  const [all, setAll] = useState(showAllTypes);
  return (
    <WizardAppliesToStep
      introspection={INTROSPECTION}
      fileName="tower.ifc"
      entityTypes={types}
      showAllTypes={all}
      onChange={(next, nextAll) => {
        setTypes(next);
        setAll(nextAll);
      }}
      onNext={onNext}
      onCancel={onCancel}
    />
  );
}

function picklist() {
  return document.querySelector(".picklist") as HTMLElement;
}

describe("WizardAppliesToStep", () => {
  it("lists a group and its nested types, off by default", () => {
    render(<Harness />);

    const list = within(picklist());
    // Anchored to the row's own name cell: the ancestor breadcrumb above the root row also
    // renders "IfcBuildingElement" as its non-interactive current-node label.
    expect(list.getByText("IfcBuildingElement", { selector: ".name" })).toBeInTheDocument();
    // Wall and Door are individually listed as nested rows, not hidden behind the group — a file
    // where every present type shares one broad root group would otherwise leave no way to pick
    // a narrower type at all.
    expect(list.getByText("IfcWall")).toBeInTheDocument();
    expect(list.getByText("IfcDoor")).toBeInTheDocument();
    expect(list.getByText("5 elements")).toBeInTheDocument();
  });

  it("shows the schema ancestor chain above the root node, ending in the node itself", () => {
    render(<Harness />);

    const breadcrumb = document.querySelector(".ancestorpath") as HTMLElement;
    expect(breadcrumb).toBeInTheDocument();
    // Real IFC4 chain above IfcBuildingElement: IfcElement, IfcProduct, IfcObject,
    // IfcObjectDefinition, IfcRoot — none of which qualify as a file group (either they cover the
    // same types as IfcBuildingElement and lose the deepest-wins tie-break, or the introspection
    // model excludes them as too abstract to discriminate anything), so this is the only place a
    // user can find or pick them.
    expect(within(breadcrumb).getByRole("button", { name: "IfcElement" })).toBeInTheDocument();
    expect(within(breadcrumb).getByRole("button", { name: "IfcRoot" })).toBeInTheDocument();
    expect(within(breadcrumb).getByText("IfcBuildingElement")).toHaveClass("cur");
  });

  it("picking an ancestor from the breadcrumb resolves to the real present types under it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const breadcrumb = document.querySelector(".ancestorpath") as HTMLElement;
    await user.click(within(breadcrumb).getByRole("button", { name: "IfcElement" }));

    // IfcElement isn't itself a tracked group (IfcBuildingElement already covers the identical
    // Wall+Door set and wins the tie-break), so this proves the fallback resolution in
    // introspect.ts's resolveOne — not just that the click was recorded.
    expect(screen.getByText("5 elements selected")).toBeInTheDocument();
    expect(within(breadcrumb).getByRole("button", { name: "IfcElement" })).toHaveClass("checked");
  });

  it("picking a nested type individually selects only that type, not its whole group", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Anchored: the group row's own accessible name also contains "IfcWall" (its "covers
    // IfcWall, IfcDoor" description), so an unanchored match would hit both rows.
    await user.click(screen.getByRole("checkbox", { name: /^IfcWall/ }));

    expect(screen.getByRole("checkbox", { name: /^IfcWall/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /IfcBuildingElement/ })).not.toBeChecked();
    expect(screen.getByText("3 elements selected")).toBeInTheDocument();
  });

  it("checking the group adds every concrete type under it, not a schema-wide expansion", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: /IfcBuildingElement/ }));

    expect(screen.getByRole("checkbox", { name: /IfcBuildingElement/ })).toBeChecked();
    expect(screen.getByText("5 elements selected")).toBeInTheDocument();
  });

  it("disables Next until at least one type is picked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("button", { name: /Next: Narrow it down/ })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /IfcBuildingElement/ }));
    expect(screen.getByRole("button", { name: /Next: Narrow it down/ })).toBeEnabled();
  });

  it("calls onNext and onCancel", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onCancel = vi.fn();
    render(<Harness entityTypes={["IfcWall", "IfcDoor"]} onNext={onNext} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /Next: Narrow it down/ }));
    expect(onNext).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  describe("show all IFC types", () => {
    it("hides the schema-only section until the user searches", async () => {
      const user = userEvent.setup();
      render(<Harness showAllTypes />);

      expect(screen.queryByText("also in the IFC schema")).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Search IFC types"), "curtainwall");
      expect(screen.getByText("also in the IFC schema")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "IfcCurtainWall not in this file" })).toBeInTheDocument();
    });

    it("never re-lists a type the file already offers under 'also in the IFC schema'", async () => {
      const user = userEvent.setup();
      render(<Harness showAllTypes />);

      await user.type(screen.getByLabelText("Search IFC types"), "wall");

      // IfcWall is covered by the file's own IfcBuildingElement group above; the schema-only
      // section (everything below the divider) must not offer it a second time.
      const divider = screen.getByText("also in the IFC schema");
      const schemaList = divider.nextElementSibling as HTMLElement;
      expect(within(schemaList).queryByText("IfcWall")).toBeNull();
      expect(
        within(schemaList).getByRole("checkbox", { name: "IfcCurtainWall not in this file" })
      ).toBeInTheDocument();
    });

    it("picking a schema-only type adds it as a zero-count, tagged selection", async () => {
      const user = userEvent.setup();
      render(<Harness showAllTypes />);

      await user.type(screen.getByLabelText("Search IFC types"), "curtainwall");
      await user.click(screen.getByRole("checkbox", { name: "IfcCurtainWall not in this file" }));

      expect(screen.getByText("0 elements selected")).toBeInTheDocument();
      const chips = document.querySelectorAll(".selchip.unmatched");
      expect(chips).toHaveLength(1);
      expect(chips[0]).toHaveTextContent("IfcCurtainWall");
    });
  });
});
