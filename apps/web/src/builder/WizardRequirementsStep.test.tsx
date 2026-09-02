import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import { WizardRequirementsStep } from "./WizardRequirementsStep";
import { introspectModel } from "./introspect";

function wall(index: number, fireRating: string | null): NormalizedElement {
  return {
    globalId: `w${index}`,
    expressId: index,
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

function Harness({
  entityTypes,
  onNext = () => {},
  onBack = () => {},
}: {
  entityTypes: string[];
  onNext?: () => void;
  onBack?: () => void;
}) {
  const source = INTROSPECTION.fieldsFor(entityTypes);
  const [draft, setDraft] = useState<RuleDraft>({
    id: "r1",
    name: "New rule",
    entityTypes,
    conditions: [],
  });
  return (
    <WizardRequirementsStep
      draft={draft}
      source={source}
      elements={ELEMENTS}
      onChange={setDraft}
      onNext={onNext}
      onBack={onBack}
    />
  );
}

describe("WizardRequirementsStep — normal (file-backed) mode", () => {
  it("offers all six kinds and renders file-backed rows", async () => {
    const user = userEvent.setup();
    render(<Harness entityTypes={["IfcWall"]} />);

    const options = Array.from(
      screen.getByLabelText("Add another check").querySelectorAll("option")
    ).map((option) => option.textContent);
    expect(options).toEqual([
      "+ Add another check",
      "Property",
      "Attribute",
      "Classification",
      "Material",
      "Part of",
      "Entity",
    ]);

    await user.selectOptions(screen.getByLabelText("Add another check"), "property");
    // Both rows type their names now, so the "Stored as" picker — which only a file can fill —
    // is what separates a file-backed row from a manual one.
    expect(screen.getByLabelText("Stored as")).toBeInTheDocument();
    expect(screen.queryByText(/typed manually/)).toBeNull();
  });

  it("scores each added condition live against the real elements", async () => {
    const user = userEvent.setup();
    render(<Harness entityTypes={["IfcWall"]} />);

    await user.selectOptions(screen.getByLabelText("Add another check"), "property");
    // Default condition: Pset_WallCommon.FireRating must be filled in — 2 of 3 walls have it.
    expect(document.querySelector(".score-text")).toHaveTextContent("2/3");
  });
});

describe("WizardRequirementsStep — manual (zero-elements) mode", () => {
  it("offers only property and attribute, and renders typed inputs", async () => {
    const user = userEvent.setup();
    // No IfcCurtainWall in the fixture — this rule's whole selection has zero elements.
    render(<Harness entityTypes={["IfcCurtainWall"]} />);

    const options = Array.from(
      screen.getByLabelText("Add another check").querySelectorAll("option")
    ).map((option) => option.textContent);
    expect(options).toEqual(["+ Add another check", "Property", "Attribute"]);

    await user.selectOptions(screen.getByLabelText("Add another check"), "property");
    expect(screen.getByLabelText("Property set").tagName).toBe("INPUT");
    expect(screen.getByText(/typed manually/)).toBeInTheDocument();
  });

  it("does not group by type — a rule mixing a real and a schema-only type stays in normal mode", async () => {
    const user = userEvent.setup();
    // Wall alone gives this rule's merged source.total > 0, so the flattened design keeps
    // ordinary dropdowns rather than splitting into per-type manual/dropdown sections.
    render(<Harness entityTypes={["IfcWall", "IfcCurtainWall"]} />);

    const options = Array.from(
      screen.getByLabelText("Add another check").querySelectorAll("option")
    ).map((option) => option.textContent);
    expect(options).toContain("Classification");

    await user.selectOptions(screen.getByLabelText("Add another check"), "property");
    expect(screen.getByLabelText("Stored as")).toBeInTheDocument();
    expect(screen.queryByText(/typed manually/)).toBeNull();
  });
});

describe("WizardRequirementsStep — navigation", () => {
  it("calls onBack and onNext", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNext = vi.fn();
    render(<Harness entityTypes={["IfcWall"]} onBack={onBack} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(onBack).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Next: Review →" }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
