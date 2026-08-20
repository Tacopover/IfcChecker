import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import { RuleWizard } from "./RuleWizard";
import { introspectModel } from "./introspect";

function wall(index: number, fireRating: string | null): NormalizedElement {
  return {
    globalId: `w${index}`,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${index}`,
    attributes: {},
    propertySets: {
      Pset_WallCommon: fireRating === null ? {} : { FireRating: { value: fireRating } },
    },
  };
}

const ELEMENTS = [wall(1, "60"), wall(2, "90"), wall(3, null)];
const INTROSPECTION = introspectModel(ELEMENTS);

describe("RuleWizard", () => {
  it("walks all four steps end to end and finishes with a real RuleDraft", async () => {
    const user = userEvent.setup();
    let finished: RuleDraft | null = null;
    render(
      <RuleWizard
        introspection={INTROSPECTION}
        elements={ELEMENTS}
        fileName="tower.ifc"
        onFinish={(rule) => (finished = rule)}
        onCancel={() => {}}
      />
    );

    // Step 1 — Applies to.
    expect(screen.getByRole("heading", { name: "What does this rule apply to?" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /IfcWall/ }));
    await user.click(screen.getByRole("button", { name: /Next: Narrow it down/ }));

    // Step 2 — Narrow it down, skipped.
    expect(screen.getByRole("heading", { name: /Narrow it down/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Skip — check all 3/ }));

    // Step 3 — Requirements: add a property check.
    expect(screen.getByRole("heading", { name: "What must be true?" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Add another check"), "property");
    expect(document.querySelector(".score-text")).toHaveTextContent("2/3");
    await user.click(screen.getByRole("button", { name: "Next: Review →" }));

    // Step 4 — Review: rename and save.
    expect(screen.getByRole("heading", { name: "Review your rule" })).toBeInTheDocument();
    const nameInput = screen.getByLabelText("Rule name");
    await user.clear(nameInput);
    await user.type(nameInput, "Walls have a fire rating");
    await user.click(screen.getByRole("button", { name: "Save rule ✓" }));

    expect(finished).not.toBeNull();
    expect(finished!.name).toBe("Walls have a fire rating");
    expect(finished!.entityTypes).toEqual(["IfcWall"]);
    expect(finished!.conditions).toHaveLength(1);
  });

  it("shows done/active steps correctly as it advances", async () => {
    const user = userEvent.setup();
    render(
      <RuleWizard
        introspection={INTROSPECTION}
        elements={ELEMENTS}
        fileName="tower.ifc"
        onFinish={() => {}}
        onCancel={() => {}}
      />
    );

    expect(document.querySelectorAll(".step.done")).toHaveLength(0);

    await user.click(screen.getByRole("checkbox", { name: /IfcWall/ }));
    await user.click(screen.getByRole("button", { name: /Next: Narrow it down/ }));

    expect(document.querySelectorAll(".step.done")).toHaveLength(1);
    expect(document.querySelector(".step.active .label")).toHaveTextContent("Narrow it down");
  });

  it("back navigation returns to the previous step without losing what was entered", async () => {
    const user = userEvent.setup();
    render(
      <RuleWizard
        introspection={INTROSPECTION}
        elements={ELEMENTS}
        fileName="tower.ifc"
        onFinish={() => {}}
        onCancel={() => {}}
      />
    );

    await user.click(screen.getByRole("checkbox", { name: /IfcWall/ }));
    await user.click(screen.getByRole("button", { name: /Next: Narrow it down/ }));
    await user.click(screen.getByRole("button", { name: "← Back" }));

    expect(screen.getByRole("heading", { name: "What does this rule apply to?" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /IfcWall/ })).toBeChecked();
  });

  it("calls onCancel from the first step without ever calling onFinish", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onFinish = vi.fn();
    render(
      <RuleWizard
        introspection={INTROSPECTION}
        elements={ELEMENTS}
        fileName="tower.ifc"
        onFinish={onFinish}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
