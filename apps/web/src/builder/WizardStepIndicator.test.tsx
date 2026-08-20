import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { WizardStepIndicator } from "./WizardStepIndicator";

const STEPS = [
  { id: "applies", label: "Applies to" },
  { id: "narrow", label: "Narrow it down" },
  { id: "requirements", label: "Requirements" },
  { id: "review", label: "Review" },
];

describe("WizardStepIndicator", () => {
  it("marks steps before the current index done, the current one active, the rest upcoming", () => {
    const { container } = render(<WizardStepIndicator steps={STEPS} currentIndex={2} />);

    const stepEls = container.querySelectorAll(".step");
    expect(stepEls[0]).toHaveClass("done");
    expect(stepEls[1]).toHaveClass("done");
    expect(stepEls[2]).toHaveClass("active");
    expect(stepEls[3]).not.toHaveClass("done");
    expect(stepEls[3]).not.toHaveClass("active");

    // A done step shows a check instead of its number.
    expect(stepEls[0].querySelector(".dot")).toHaveTextContent("✓");
    expect(stepEls[2].querySelector(".dot")).toHaveTextContent("3");
    expect(stepEls[3].querySelector(".dot")).toHaveTextContent("4");
  });

  it("draws one line fewer than there are steps, done up to the current step", () => {
    const { container } = render(<WizardStepIndicator steps={STEPS} currentIndex={1} />);

    const links = container.querySelectorAll(".steplink");
    expect(links).toHaveLength(STEPS.length - 1);
    expect(links[0]).toHaveClass("done");
    expect(links[1]).not.toHaveClass("done");
    expect(links[2]).not.toHaveClass("done");
  });

  it("marks nothing done on the first step", () => {
    const { container } = render(<WizardStepIndicator steps={STEPS} currentIndex={0} />);

    expect(container.querySelectorAll(".step.done")).toHaveLength(0);
    expect(container.querySelector(".step.active .dot")).toHaveTextContent("1");
  });
});
