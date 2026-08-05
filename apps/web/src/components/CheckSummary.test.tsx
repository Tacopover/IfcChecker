import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckSummary } from "./CheckSummary";
import type { SpecificationSummary } from "../local/parseAndValidate.js";
import type { IssueRow } from "./IssueTable";

function violation(overrides: Partial<IssueRow> = {}): IssueRow {
  return {
    id: "v1",
    fileJobId: "model.ifc",
    fileName: "model.ifc",
    modelKey: "model.ifc:1:1",
    elementGlobalId: "g1",
    elementName: "West Wall",
    elementType: "IFCWALL",
    ruleId: "Walls are fire rated",
    severity: "error",
    message: "Property \"FireRating\" is missing",
    ...overrides,
  };
}

function summary(overrides: Partial<SpecificationSummary> = {}): SpecificationSummary {
  return {
    name: "Walls are fire rated",
    checked: true,
    unsupported: [],
    applicableCount: 3,
    passedCount: 2,
    failedCount: 1,
    violations: [violation()],
    ...overrides,
  };
}

describe("CheckSummary", () => {
  it("reports how many elements each specification applied to, passed and failed", () => {
    render(<CheckSummary summaries={[summary()]} />);

    const row = screen.getByText("Walls are fire rated").closest("tr");
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("3");
    expect(row).toHaveTextContent("2");
    expect(row).toHaveTextContent("1");
  });

  // The bug the summary exists to kill: without applicableCount this is indistinguishable
  // from a model where every wall passed.
  it("calls out a specification that matched no elements instead of showing it as clean", () => {
    render(
      <CheckSummary
        summaries={[summary({ applicableCount: 0, passedCount: 0, failedCount: 0, violations: [] })]}
      />
    );

    expect(screen.getByText("matched nothing")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("nothing was checked");
  });

  it("does not call a fully compliant specification unchecked", () => {
    render(
      <CheckSummary
        summaries={[summary({ applicableCount: 4, passedCount: 4, failedCount: 0, violations: [] })]}
      />
    );

    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // The worse sibling of "matched nothing": that rule ran and selected no elements, this one
  // was never run at all, and zero counts would be a measurement we never made.
  it("shows a specification it could not check as unchecked, with no counts and a reason", () => {
    render(
      <CheckSummary
        summaries={[
          summary({
            checked: false,
            applicableCount: 0,
            passedCount: 0,
            failedCount: 0,
            violations: [],
            unsupported: [
              {
                section: "applicability",
                construct: "property",
                description: "Selects elements by <property>, which cannot be represented.",
              },
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("not checked")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("would have been a false pass");
    expect(screen.getByText("property")).toBeInTheDocument();

    const row = screen.getByText("Walls are fire rated").closest("tr");
    expect(row).toHaveTextContent("—");
    expect(row).not.toHaveTextContent("0");
  });

  it("warns that a specification which ran was checked against fewer requirements than it states", () => {
    render(
      <CheckSummary
        summaries={[
          summary({
            applicableCount: 4,
            passedCount: 4,
            failedCount: 0,
            violations: [],
            unsupported: [
              {
                section: "requirements",
                construct: "classification",
                description: "Requires <classification>, which cannot be represented, so it is not checked.",
              },
            ],
          }),
        ]}
      />
    );

    // It did pass — but on weaker terms than its author wrote, which the badge alone cannot say.
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "fewer requirements than this specification states"
    );
    expect(screen.getByText("classification")).toBeInTheDocument();
  });

  it("counts unchecked specifications in the summary line, so a run with holes cannot read clean", () => {
    render(
      <CheckSummary
        summaries={[
          summary({ name: "A", applicableCount: 2, passedCount: 2, failedCount: 0, violations: [] }),
          summary({ name: "B", checked: false, applicableCount: 0, passedCount: 0, failedCount: 0, violations: [] }),
        ]}
      />
    );

    const line = screen.getByRole("status");
    expect(line).toHaveTextContent("2 specifications — none failing, 1 not checked");
    expect(line).toHaveAttribute("data-tone", "fail");
  });

  it("counts the failing and inert specifications in one line", () => {
    render(
      <CheckSummary
        summaries={[
          summary({ name: "A" }),
          summary({ name: "B", applicableCount: 2, passedCount: 2, failedCount: 0, violations: [] }),
          summary({ name: "C", applicableCount: 0, passedCount: 0, failedCount: 0, violations: [] }),
        ]}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "3 specifications — 1 failing, 1 matched no elements"
    );
  });

  it("opens the first failing specification so the page is never a wall of counts", () => {
    render(
      <CheckSummary
        summaries={[
          summary({ name: "Clean", applicableCount: 2, passedCount: 2, failedCount: 0, violations: [] }),
          summary({ name: "Broken" }),
        ]}
      />
    );

    expect(screen.getByText("West Wall")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide 1 issue for Broken/ })).toBeInTheDocument();
  });

  it("collapses and re-expands a specification's issues on request", async () => {
    const user = userEvent.setup();
    render(<CheckSummary summaries={[summary()]} />);

    await user.click(screen.getByRole("button", { name: /Hide 1 issue/ }));
    expect(screen.queryByText("West Wall")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show 1 issue/ }));
    expect(screen.getByText("West Wall")).toBeInTheDocument();
  });

  it("passes an element selection up from the nested table", async () => {
    const user = userEvent.setup();
    const onSelectElement = vi.fn();
    render(<CheckSummary summaries={[summary()]} onSelectElement={onSelectElement} />);

    await user.click(screen.getByRole("button", { name: /West Wall/ }));

    expect(onSelectElement).toHaveBeenCalledWith(expect.objectContaining({ elementGlobalId: "g1" }));
  });

  it("hides the rule column inside a specification, where it never varies", () => {
    render(<CheckSummary summaries={[summary()]} />);

    expect(screen.queryByLabelText("Filter by rule id")).not.toBeInTheDocument();
  });

  it("decides expansion afresh when a new rule set is checked", () => {
    const { rerender } = render(<CheckSummary summaries={[summary({ name: "First" })]} />);
    expect(screen.getByText("West Wall")).toBeInTheDocument();

    rerender(
      <CheckSummary
        summaries={[summary({ name: "Second", applicableCount: 1, passedCount: 1, failedCount: 0, violations: [] })]}
      />
    );

    expect(screen.queryByText("West Wall")).not.toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();
  });
});
