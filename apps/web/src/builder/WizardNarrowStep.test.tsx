import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import { WizardNarrowStep } from "./WizardNarrowStep";
import { introspectModel } from "./introspect";

function wall(index: number, classified: boolean): NormalizedElement {
  return {
    globalId: `w${index}`,
    expressId: index,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${index}`,
    attributes: {},
    propertySets: {},
    classifications: classified
      ? [{ system: "Uniformat", identifications: ["B2010"] }]
      : [],
  };
}

// Two of three walls are classified in Uniformat as B2010, one is not.
const ELEMENTS = [wall(1, true), wall(2, true), wall(3, false)];
const INTROSPECTION = introspectModel(ELEMENTS);
const SOURCE = INTROSPECTION.fieldsFor(["IfcWall"]);

const DRAFT: RuleDraft = {
  id: "r1",
  name: "New rule",
  entityTypes: ["IfcWall"],
  conditions: [],
};

function matchlineText(): string {
  return document.querySelector(".matchline")?.textContent ?? "";
}

function Harness({
  initial = DRAFT,
  onNext = () => {},
  onBack = () => {},
}: {
  initial?: RuleDraft;
  onNext?: () => void;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <WizardNarrowStep
      draft={draft}
      source={SOURCE}
      elements={ELEMENTS}
      onChange={setDraft}
      onNext={onNext}
      onBack={onBack}
    />
  );
}

describe("WizardNarrowStep", () => {
  it("starts unnarrowed — every element of the applies-to selection will be checked", () => {
    render(<Harness />);

    expect(matchlineText()).toMatch(/3 of 3 elements will be checked/);
  });

  it("offers Skip only while nothing narrows the selection, and it advances without adding a facet", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness onNext={onNext} />);

    const skip = screen.getByRole("button", { name: /Skip — check all 3/ });
    await user.click(skip);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("adding a classification filter narrows the live match count", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Add another filter"), "classification");

    expect(matchlineText()).toMatch(/2 of 3 elements will be checked/);
    // Once a facet is added, Skip is no longer the honest label for "advance as-is".
    expect(screen.queryByRole("button", { name: /Skip/ })).not.toBeInTheDocument();
  });

  it("removing the only filter goes back to checking everything", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Add another filter"), "classification");
    await user.click(screen.getByRole("button", { name: /Remove the classification this rule selects by/ }));

    expect(matchlineText()).toMatch(/3 of 3 elements will be checked/);
    expect(screen.getByRole("button", { name: /Skip — check all 3/ })).toBeInTheDocument();
  });

  it("calls onBack and always offers Next regardless of Skip", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNext = vi.fn();
    render(<Harness onBack={onBack} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(onBack).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Next: Requirements →" }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
