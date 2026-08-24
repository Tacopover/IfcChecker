import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueTable, type IssueRow } from "./IssueTable";
import { elementResultsFixture } from "../test/mocks/fixtures";

const fixtureRows: IssueRow[] = elementResultsFixture.map((result) => ({
  ...result,
  modelKey: "model-a.ifc:1:1",
  elementName: null,
}));

function makeManyResults(count: number): IssueRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    fileJobId: "fj1",
    modelKey: "model.ifc:1:1",
    elementGlobalId: `g${i}`,
    elementName: `Wall ${i}`,
    elementType: "IFCWALL",
    ruleId: "naming-prefix",
    severity: "error" as const,
    message: `Issue number ${i}`,
    fileName: "model.ifc",
  }));
}

describe("IssueTable", () => {
  it("renders every result row with its file, element type, rule, severity, and message", () => {
    render(<IssueTable results={fixtureRows} />);

    expect(screen.getByText("IFCWALL")).toBeInTheDocument();
    expect(screen.getByText("naming-prefix")).toBeInTheDocument();
    expect(screen.getByText("Name must start with 'W-'")).toBeInTheDocument();
    expect(screen.getByText("IFCDOOR")).toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  // Without this the rows for two failing walls are identical text, and the table
  // says a wall is wrong without saying which one.
  it("identifies which element each row is about", () => {
    render(<IssueTable results={makeManyResults(2)} />);

    expect(screen.getByText("Wall 0")).toBeInTheDocument();
    expect(screen.getByText("g0")).toBeInTheDocument();
    expect(screen.getByText("Wall 1")).toBeInTheDocument();
    expect(screen.getByText("g1")).toBeInTheDocument();
  });

  it("falls back to the GlobalId when the element has no name", () => {
    render(<IssueTable results={fixtureRows} />);

    expect(screen.getAllByText("(unnamed)")).toHaveLength(2);
    expect(screen.getByText("g1")).toBeInTheDocument();
  });

  it("hands the whole row back when an element is picked", async () => {
    const user = userEvent.setup();
    const onSelectElement = vi.fn();
    render(<IssueTable results={makeManyResults(1)} onSelectElement={onSelectElement} />);

    await user.click(screen.getByRole("button", { name: /Wall 0/ }));

    expect(onSelectElement).toHaveBeenCalledWith(
      expect.objectContaining({ elementGlobalId: "g0", modelKey: "model.ifc:1:1" })
    );
  });

  it("does not offer elements as buttons when nothing can be done with the selection", () => {
    render(<IssueTable results={makeManyResults(1)} />);

    expect(screen.queryByRole("button", { name: /Wall 0/ })).not.toBeInTheDocument();
    expect(screen.getByText("Wall 0")).toBeInTheDocument();
  });

  it("marks the selected element", () => {
    render(
      <IssueTable results={makeManyResults(2)} onSelectElement={vi.fn()} selectedElementId="r1" />
    );

    expect(screen.getByRole("button", { name: /Wall 1/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Wall 0/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("filters rows by element name or GlobalId", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={makeManyResults(3)} />);

    await user.type(screen.getByLabelText("Filter by element name or GlobalId"), "g2");

    expect(screen.queryByText("Wall 0")).not.toBeInTheDocument();
    expect(screen.getByText("Wall 2")).toBeInTheDocument();
  });

  it("filters rows by element type", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={fixtureRows} />);

    await user.type(screen.getByLabelText("Filter by element type"), "IFCDOOR");

    expect(screen.queryByText("naming-prefix")).not.toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("filters rows by severity", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={fixtureRows} />);

    await user.selectOptions(screen.getByLabelText("Filter by severity"), "warning");

    expect(screen.queryByText("naming-prefix")).not.toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("drops the rule column and its filter when every row shares one rule", () => {
    render(<IssueTable results={makeManyResults(1)} hideRuleColumn />);

    expect(screen.queryByLabelText("Filter by rule id")).not.toBeInTheDocument();
    expect(screen.queryByText("naming-prefix")).not.toBeInTheDocument();
  });

  it("shows an empty state when no rows match the current filters", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={fixtureRows} />);

    await user.type(screen.getByLabelText("Filter by rule id"), "no-such-rule");

    expect(screen.getByText("No issues match the current filters.")).toBeInTheDocument();
  });

  // "No issues match the current filters" blamed filters the user never set, for the one
  // case that deserves a plain answer.
  it("says the elements passed when there were no issues to begin with", () => {
    render(<IssueTable results={[]} />);

    expect(screen.getByText("Every element this rule applied to passed.")).toBeInTheDocument();
  });

  it("paginates instead of rendering every row when there are more issues than fit on one page", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={makeManyResults(30)} />);

    expect(screen.getByText("Issue number 0")).toBeInTheDocument();
    expect(screen.queryByText("Issue number 25")).not.toBeInTheDocument();
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.queryByText("Issue number 0")).not.toBeInTheDocument();
    expect(screen.getByText("Issue number 25")).toBeInTheDocument();
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Issue number 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });
});
