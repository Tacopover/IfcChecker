import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import { RuleCard } from "./RuleCard";
import { introspectModel } from "./introspect";
import { stating } from "../test/conditions";

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
      propertySet: plainName("Pset_WallCommon"),
      name: plainName("FireRating"),
      ...stating("exists"),
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

  // `entityTypes` is the literal, final list from the moment a person adds a type — picking a
  // group from the dropdown writes its full concrete expansion into the rule immediately. The
  // chip row then folds that exact set back into one summary chip for display, which happens to
  // carry the same name and count the old literal-group chip did — but it is a live, schema-scoped
  // read of what `entityTypes` already holds, not a name preserved unexpanded.
  it("expands a group picked from the dropdown, and the chip row re-collapses it into one summary", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(
      screen.getByLabelText("Add entity type or group"),
      "IfcBuildingElement"
    );

    const chip = screen.getByText("IfcBuildingElement").closest(".chip");
    expect(chip).toHaveClass("group");
    expect(chip?.getAttribute("title")).toContain("IfcDoor");
    expect(within(chip as HTMLElement).getByText("31 types · 5")).toBeInTheDocument();
    expect(screen.queryByText("IfcWall")).not.toBeInTheDocument();
    expect(screen.queryByText("IfcDoor")).not.toBeInTheDocument();
  });

  // The file-scoped `group` styling has one live path left: an imported rule whose author wrote a
  // supertype name literally. The importer never rewrites it, so the chip can still show what that
  // literal name covers in the currently loaded file.
  it("still styles a group chip for a literal supertype name in an untouched rule", () => {
    render(<Harness initial={{ ...RULE, entityTypes: ["IfcWall", "IfcBuildingElement"] }} />);

    const group = screen.getByTitle(/covers IfcWall, IfcDoor/);
    expect(group).toHaveClass("group");
    expect(within(group).getByText("2 types · 5")).toBeInTheDocument();
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

    await user.selectOptions(screen.getByLabelText("Add a requirement"), "property");
    expect(screen.getAllByLabelText("Operator")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Duplicate condition" })[0]);
    expect(screen.getAllByLabelText("Operator")).toHaveLength(3);

    await user.click(screen.getAllByRole("button", { name: "Remove condition" })[0]);
    expect(screen.getAllByLabelText("Operator")).toHaveLength(2);
  });

  // Editing an imported facet is half of writing one. Until this control existed, a classification,
  // material, partOf or entity requirement could only be reached by importing a file that had one.
  it("adds a requirement of any of the six kinds, filled from the model", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...RULE, conditions: [] }} />);

    await user.selectOptions(screen.getByLabelText("Add a requirement"), "material");
    expect(screen.getByLabelText("Material operator")).toHaveValue("exists");

    await user.selectOptions(screen.getByLabelText("Add a requirement"), "entity");
    expect(screen.getByLabelText("Class")).toHaveValue("IFCWALL");
  });

  it("narrows what the rule selects, with the new facet stating no cardinality", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Narrow what this rule selects"), "material");

    const row = within(container.querySelector<HTMLElement>(".applicability-facet")!);
    expect(row.getByLabelText("Material operator")).toBeInTheDocument();
    expect(row.queryByLabelText("Cardinality")).toBeNull();
  });

  // A field on the `<entity>` rather than a facet, so it narrows the chips above it and has no
  // cardinality, no score and nothing to duplicate. Offered in the same select for the same reason
  // a user reaches for it: it is how you narrow the selection.
  it("narrows the type chips by a predefined type, and removes it again", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    expect(screen.queryByLabelText("Predefined type")).toBeNull();

    await user.selectOptions(
      screen.getByLabelText("Narrow what this rule selects"),
      "entityPredefinedType"
    );

    const row = within(container.querySelector<HTMLElement>(".applicability-facet")!);
    expect(row.getByLabelText("Predefined type")).toBeInTheDocument();
    // The row's presence is the statement, so there is no "be anything" reading to fall back to.
    const operators = Array.from(
      row.getByLabelText("Predefined type operator").querySelectorAll("option")
    ).map((option) => option.getAttribute("value"));
    expect(operators).not.toContain("exists");

    await user.click(
      screen.getByRole("button", { name: "Remove the predefined type this rule selects by" })
    );
    expect(screen.queryByLabelText("Predefined type")).toBeNull();
  });

  // Four attributes and the schema versions, all of which survived a round trip before this and
  // none of which could be edited.
  it("edits what the specification says about itself", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /About this specification/ }));
    await user.type(screen.getByLabelText("Identifier"), "S1");
    await user.type(screen.getByLabelText("Instructions"), "Ask the architect.");

    expect(screen.getByLabelText("Identifier")).toHaveValue("S1");
    expect(screen.getByLabelText("Instructions")).toHaveValue("Ask the architect.");
  });

  // `ifcVersion` is a space-separated list drawn from a closed enumeration, so a text box would let
  // a user write a value that makes the document invalid.
  it("picks schema versions from the three the schema lists, and refuses none", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /About this specification/ }));

    const ifc4 = screen.getByRole("checkbox", { name: "IFC4" });
    expect(ifc4).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "IFC2X3" })).not.toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "IFC2X3" }));
    expect(screen.getByRole("checkbox", { name: "IFC2X3" })).toBeChecked();

    await user.click(ifc4);
    await user.click(screen.getByRole("checkbox", { name: "IFC2X3" }));
    expect(screen.getByText(/Schema version — IDS requires at least one/)).toBeInTheDocument();
  });

  it("toggling Prohibited on flips the score reading and shows the badge, without touching conditions", async () => {
    const user = userEvent.setup();
    // Zero conditions, since a prohibited rule can't state any — the applicability alone is the
    // check. Targets IfcWall, which ELEMENTS has 3 of, so the toggle has something to find.
    const noConditions: RuleDraft = { ...RULE, conditions: [] };
    render(<Harness initial={noConditions} />);

    await user.click(screen.getByRole("button", { name: /About this specification/ }));
    await user.click(
      screen.getByRole("checkbox", { name: /Prohibited — no element may match/ })
    );

    expect(screen.getByText("Prohibited")).toHaveClass("badge", "prohibited");
    expect(screen.getByText("3 elements found, and none may match this rule")).toBeInTheDocument();
    expect(document.querySelector(".rule-foot .score")).toHaveClass("has-fail");
    // The violation is the match itself, not a per-condition failure — there is nothing for the
    // failing-elements table to show, so the button that opens it stays hidden.
    expect(screen.queryByRole("button", { name: /Show failing elements/ })).toBeNull();
  });

  it("reads a prohibited rule with nothing matched as compliant", async () => {
    const user = userEvent.setup();
    const targetsNothing: RuleDraft = {
      ...RULE,
      entityTypes: ["IfcBuildingElementProxy"],
      conditions: [],
    };
    render(<Harness initial={targetsNothing} />);

    await user.click(screen.getByRole("button", { name: /About this specification/ }));
    await user.click(
      screen.getByRole("checkbox", { name: /Prohibited — no element may match/ })
    );

    expect(screen.getByText("None found — this rule is satisfied")).toBeInTheDocument();
    expect(document.querySelector(".rule-foot .score")).toHaveClass("all-pass");
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

  // IDS matches an entity name exactly and inherits nothing, so a concrete pick with subtypes
  // still selects only itself until expanded — the chip offers the expansion rather than hiding it.
  // The expanded set exactly matches IfcWall's full schema expansion, so the row folds it right
  // back into one summary chip rather than three loose ones.
  it("offers to expand a concrete entity type that has subtypes, keeping the type itself", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("IfcWall").closest(".chip")).not.toHaveClass("abstract");
    await user.click(screen.getByRole("button", { name: "Expand IfcWall to its subtypes" }));

    const chip = screen.getByText("IfcWall").closest(".chip");
    expect(chip).toHaveClass("group");
    expect(chip?.getAttribute("title")).toContain("IfcWallStandardCase");
    expect(chip?.getAttribute("title")).toContain("IfcWallElementedCase");
    expect(within(chip as HTMLElement).getByText("3 types · 3")).toBeInTheDocument();
  });

  it("marks an abstract entity type in italics, and expands it by dropping itself", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...RULE, entityTypes: ["IfcElement"] }} />);

    expect(screen.getByText("IfcElement").closest(".chip")).toHaveClass("abstract");

    await user.click(screen.getByRole("button", { name: "Expand IfcElement to its subtypes" }));

    // The abstract name is gone as an unexpanded literal chip. Its full concrete expansion
    // collapses right back into a chip with the same name — an honest summary of what the rule
    // now actually checks, not the abstract name left as-is.
    const chip = screen.getByText("IfcElement").closest(".chip");
    expect(chip).toHaveClass("group");
    expect(chip).not.toHaveClass("abstract");
    expect(chip?.getAttribute("title")).toContain("IfcWall");
  });

  it("offers no expansion for an entity type the schema gives no subtypes", () => {
    render(<Harness initial={{ ...RULE, entityTypes: ["IfcSensor"] }} />);

    expect(screen.queryByRole("button", { name: /Expand IfcSensor/ })).not.toBeInTheDocument();
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

  // The last of the six kinds to get controls, so there is no read-only requirement row left at
  // all. `ids.xsd` gives this one no cardinality, which is what the missing select states.
  it("edits an entity requirement in place, with no cardinality to state", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          ...RULE,
          conditions: [
            {
              id: "e1",
              kind: "entity",
              name: { kind: "simple", value: "IFCWALL" },
              predefinedType: null,
            },
          ],
        }}
      />
    );

    const box = screen.getByLabelText("Class");
    expect(box).toHaveValue("IFCWALL");
    expect(screen.queryByLabelText("Cardinality")).toBeNull();

    await user.clear(box);
    await user.type(box, "IFCDOOR");
    expect(screen.getByLabelText("Class")).toHaveValue("IFCDOOR");
  });

  // partOf was that example until it got controls, and material before it. The row is the
  // difference between a rule the user can read and one they can change.
  it("edits a partOf requirement in place", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          ...RULE,
          conditions: [
            {
              id: "p1",
              kind: "partOf",
              relation: null,
              entityName: { kind: "simple", value: "IFCBUILDINGSTOREY" },
              predefinedType: null,
              cardinality: "required",
            },
          ],
        }}
      />
    );

    expect(screen.getByLabelText("Class")).toHaveValue("IFCBUILDINGSTOREY");

    await user.selectOptions(screen.getByLabelText("Relationship"), "IFCRELAGGREGATES");
    expect(screen.getByLabelText("Relationship")).toHaveValue("IFCRELAGGREGATES");
  });

  // Material was that example until it got controls. The row is the difference between a rule the
  // user can read and one they can change.
  it("edits a material requirement in place", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          ...RULE,
          conditions: [
            {
              id: "m1",
              kind: "material",
              value: { kind: "simple", value: "Concrete" },
              cardinality: "required",
            },
          ],
        }}
      />
    );

    expect(screen.getByLabelText("Material")).toHaveValue("Concrete");

    await user.selectOptions(screen.getByLabelText("Cardinality"), "prohibited");
    expect(screen.getByLabelText("Cardinality")).toHaveValue("prohibited");
  });

  // "classification" alone says a facet was kept. It does not say the rule in front of the user
  // checks less than the score above it suggests, which is the thing worth knowing.
  it("says why each kept requirement could not be shown, not only which one", () => {
    const { container } = render(
      <Harness
        initial={{
          ...RULE,
          imported: {
            attributes: {},
            entityNamesAsEnumeration: false,
            applicabilityAttributes: {},
            requirementsAttributes: {},
            passThrough: [
              {
                afterIndex: 1,
                construct: "classification",
                reason: "The builder can show an attribute or a property; <classification> is neither.",
                xml: "<classification />",
              },
            ],
          },
        }}
      />
    );

    const kept = container.querySelector(".rule-preserved");
    expect(kept).toHaveTextContent("classification");
    expect(kept).toHaveTextContent("<classification> is neither");
  });
});
