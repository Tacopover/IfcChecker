import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import { WizardReviewStep } from "./WizardReviewStep";
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
const SOURCE = INTROSPECTION.fieldsFor(["IfcWall"]);

const DRAFT: RuleDraft = {
  id: "r1",
  name: "Walls have a fire rating",
  entityTypes: ["IfcWall"],
  conditions: [
    {
      id: "c1",
      kind: "property",
      propertySet: plainName("Pset_WallCommon"),
      name: plainName("FireRating"),
      value: null,
      cardinality: "required",
    },
  ],
};

function Harness({
  initial = DRAFT,
  onFinish = () => {},
  onBack = () => {},
}: {
  initial?: RuleDraft;
  onFinish?: (rule: RuleDraft) => void;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <WizardReviewStep
      draft={draft}
      source={SOURCE}
      elements={ELEMENTS}
      fileName="tower.ifc"
      onChange={setDraft}
      onFinish={onFinish}
      onBack={onBack}
    />
  );
}

describe("WizardReviewStep", () => {
  it("shows the recap sentence and live pass/fail numbers", () => {
    render(<Harness />);

    const recap = document.querySelector(".recap");
    expect(recap).toHaveTextContent("Every IfcWall (3 in tower.ifc)");
    expect(recap).toHaveTextContent("must state a FireRating in Pset_WallCommon");
    // 2 of 3 walls carry a fire rating.
    expect(screen.getByText("2 pass")).toBeInTheDocument();
    expect(screen.getByText("1 fail")).toBeInTheDocument();
  });

  it("edits the rule name", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText("Rule name");
    await user.clear(input);
    await user.type(input, "Renamed rule");

    expect(input).toHaveValue("Renamed rule");
  });

  it("keeps the IDS XML collapsed until the link is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByLabelText("IDS XML preview")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /View as IDS XML/ }));
    const preview = screen.getByLabelText("IDS XML preview");
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toContain("IFCWALL");
    expect(preview.textContent).toContain("FireRating");
  });

  it("saves the draft as-is, even if incomplete", async () => {
    const user = userEvent.setup();
    const incomplete: RuleDraft = { ...DRAFT, entityTypes: [] };
    const onFinish = vi.fn();
    render(<Harness initial={incomplete} onFinish={onFinish} />);

    await user.click(screen.getByRole("button", { name: "Save rule ✓" }));
    expect(onFinish).toHaveBeenCalledWith(incomplete);
  });

  it("calls onBack", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Harness onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
