import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { REQUIRED_CARDINALITY_EMPTY_MESSAGE } from "@ifc-qa/ids-validator";
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
    elementTag: null,
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
    cardinalityFailure: null,
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

    expect(screen.getByText("no matching elements found")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("nothing was checked");
  });

  // IDS defaults an applicability to required, and the validator flags that as a cardinality
  // failure — but a model that simply doesn't have that kind of element isn't a failing model,
  // just one with nothing to check. This reads the same as an optional specification matching
  // nothing: a plain notice next to the rule, no failing block.
  it("treats a required specification that matched nothing as unmet, not failing", () => {
    render(
      <CheckSummary
        summaries={[
          summary({
            applicableCount: 0,
            passedCount: 0,
            failedCount: 0,
            violations: [],
            cardinalityFailure: REQUIRED_CARDINALITY_EMPTY_MESSAGE,
          }),
        ]}
      />
    );

    expect(screen.getByText("no matching elements found")).toBeInTheDocument();
    expect(screen.queryByText("failing")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("none failing");
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
    expect(row).toHaveTextContent("-");
    expect(row).not.toHaveTextContent("0");
  });

  // The other way a specification can be refused: its elements are selectable, but every single
  // requirement was dropped, so it would have run and found nothing wrong with any of them.
  it("says so when a specification is unchecked because all of its requirements were dropped", () => {
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
                section: "requirements",
                construct: "classification",
                description: "Requires <classification>, which cannot be represented.",
              },
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("not checked")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "every requirement it states is one this checker cannot represent"
    );
    // The reason has to survive: filtering the list to applicability losses left this blank.
    expect(screen.getByText("classification")).toBeInTheDocument();
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
    expect(line).toHaveTextContent("2 specifications: none failing, 1 not checked");
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
      "3 specifications: 1 failing, 1 matched no elements"
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

  it("reports the full summaries up front, before any filter is applied", () => {
    const onFilteredSummariesChange = vi.fn();
    const summaries = [summary()];
    render(<CheckSummary summaries={summaries} onFilteredSummariesChange={onFilteredSummariesChange} />);

    expect(onFilteredSummariesChange).toHaveBeenCalledWith(summaries);
  });

  it("narrows only the specification whose issue table was filtered, leaving the others as-is", async () => {
    const user = userEvent.setup();
    const onFilteredSummariesChange = vi.fn();
    const first = summary({ name: "First", violations: [violation({ id: "v1", elementGlobalId: "g1" })] });
    const second = summary({
      name: "Second",
      applicableCount: 1,
      passedCount: 0,
      failedCount: 1,
      violations: [violation({ id: "v2", elementGlobalId: "g2" })],
    });
    render(
      <CheckSummary summaries={[first, second]} onFilteredSummariesChange={onFilteredSummariesChange} />
    );

    // Only the first failing specification opens by default.
    await user.click(screen.getByRole("button", { name: /Show 1 issue for Second/ }));

    const filterInputs = screen.getAllByLabelText("Filter by element name or GlobalId");
    await user.type(filterInputs[0], "no-such-element");

    const lastCall = onFilteredSummariesChange.mock.calls.at(-1)?.[0] as SpecificationSummary[];
    expect(lastCall[0].violations).toEqual([]);
    expect(lastCall[1].violations).toEqual(second.violations);
  });

  it("keeps a specification's filter after its issue table is collapsed, and flags the row", async () => {
    const user = userEvent.setup();
    const onFilteredSummariesChange = vi.fn();
    render(<CheckSummary summaries={[summary()]} onFilteredSummariesChange={onFilteredSummariesChange} />);

    await user.type(screen.getByLabelText("Filter by element name or GlobalId"), "no-such-element");
    await user.click(screen.getByRole("button", { name: /Hide 0 of 1 issue/ }));

    // Still narrowing what an export would take, from a row with no filter bar left on it —
    // so the row, and the line above the table, both have to say so.
    const lastCall = onFilteredSummariesChange.mock.calls.at(-1)?.[0] as SpecificationSummary[];
    expect(lastCall[0].violations).toEqual([]);
    expect(screen.getByText("filtered")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show 0 of 1 issue for/ })).toBeInTheDocument();
    expect(screen.getByText(/1 specification also has its own filter active/)).toBeInTheDocument();
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
  it("narrows every specification at once from the filters above them", async () => {
    const user = userEvent.setup();
    const onFilteredSummariesChange = vi.fn();
    const first = summary({ name: "First", violations: [violation({ id: "v1" })] });
    const second = summary({
      name: "Second",
      violations: [
        violation({ id: "v2", elementGlobalId: "g2", elementName: "Main Duct", elementType: "IFCDUCTSEGMENT" }),
      ],
    });
    render(
      <CheckSummary summaries={[first, second]} onFilteredSummariesChange={onFilteredSummariesChange} />
    );

    await user.type(screen.getByLabelText("Filter all results by element type"), "IFCDUCT");

    // A specification with nothing left to show is out of the way entirely — the point of
    // filtering everything at once is not having to open each rule to find out it has no match.
    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();

    const lastCall = onFilteredSummariesChange.mock.calls.at(-1)?.[0] as SpecificationSummary[];
    expect(lastCall[0].violations).toEqual([]);
    expect(lastCall[1].violations).toEqual(second.violations);
  });

  it("lets a specification's own filter narrow further inside what the global one matched", async () => {
    const user = userEvent.setup();
    const onFilteredSummariesChange = vi.fn();
    const only = summary({
      name: "Walls are fire rated",
      violations: [
        violation({ id: "v1", elementGlobalId: "g1", elementName: "West Wall" }),
        violation({ id: "v2", elementGlobalId: "g2", elementName: "East Wall" }),
      ],
    });
    render(<CheckSummary summaries={[only]} onFilteredSummariesChange={onFilteredSummariesChange} />);

    await user.type(screen.getByLabelText("Filter all results by element type"), "IFCWALL");
    expect(
      (onFilteredSummariesChange.mock.calls.at(-1)?.[0] as SpecificationSummary[])[0].violations
    ).toHaveLength(2);

    await user.type(screen.getByLabelText("Filter by element name or GlobalId"), "West");

    const lastCall = onFilteredSummariesChange.mock.calls.at(-1)?.[0] as SpecificationSummary[];
    expect(lastCall[0].violations.map((row) => row.elementName)).toEqual(["West Wall"]);
  });

  it("says how much the global filter is hiding, and clears it on request", async () => {
    const user = userEvent.setup();
    render(
      <CheckSummary
        summaries={[
          summary({ name: "First", violations: [violation({ id: "v1" })] }),
          summary({
            name: "Second",
            violations: [violation({ id: "v2", elementGlobalId: "g2", elementName: "East Wall" })],
          }),
        ]}
      />
    );

    await user.type(screen.getByLabelText("Filter all results by element name or GlobalId"), "East");
    expect(screen.getByText("Showing 1 of 2 issues in 1 of 2 specifications.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.queryByText(/Showing 1 of 2 issues/)).not.toBeInTheDocument();
  });

  it("clears the per-specification filters as well, wherever they were typed", async () => {
    const user = userEvent.setup();
    render(<CheckSummary summaries={[summary()]} />);

    const specFilter = screen.getByLabelText("Filter by element name or GlobalId");
    await user.type(specFilter, "no-such-element");
    expect(screen.getByText("filtered")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(screen.queryByText("filtered")).not.toBeInTheDocument();
    expect(screen.getByText("West Wall")).toBeInTheDocument();
    expect(specFilter).toHaveValue("");
  });

  it("reports no match rather than an empty specification table when nothing survives the filter", async () => {
    const user = userEvent.setup();
    render(<CheckSummary summaries={[summary()]} />);

    await user.type(screen.getByLabelText("Filter all results by element name or GlobalId"), "g-nope");

    expect(screen.getByText("No issues match the current filters.")).toBeInTheDocument();
    expect(screen.queryByText("Walls are fire rated")).not.toBeInTheDocument();
  });
});
