import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ElementResult } from "@ifc-qa/shared-types";
import { IssueTable } from "./IssueTable";
import { runResultsFixture } from "../test/mocks/fixtures";

function makeManyResults(count: number): Array<ElementResult & { fileName: string }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    fileJobId: "fj1",
    elementGlobalId: `g${i}`,
    elementType: "IFCWALL",
    ruleId: "naming-prefix",
    severity: "error" as const,
    message: `Issue number ${i}`,
    fileName: "model.ifc",
  }));
}

describe("IssueTable", () => {
  it("renders every result row with its file, element type, rule, severity, and message", () => {
    render(<IssueTable results={runResultsFixture.results} />);

    expect(screen.getByText("IFCWALL")).toBeInTheDocument();
    expect(screen.getByText("naming-prefix")).toBeInTheDocument();
    expect(screen.getByText("Name must start with 'W-'")).toBeInTheDocument();
    expect(screen.getByText("IFCDOOR")).toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("filters rows by element type", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={runResultsFixture.results} />);

    await user.type(screen.getByLabelText("Filter by element type"), "IFCDOOR");

    expect(screen.queryByText("naming-prefix")).not.toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("filters rows by severity", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={runResultsFixture.results} />);

    await user.selectOptions(screen.getByLabelText("Filter by severity"), "warning");

    expect(screen.queryByText("naming-prefix")).not.toBeInTheDocument();
    expect(screen.getByText("fire-rating-required")).toBeInTheDocument();
  });

  it("shows an empty state when no rows match the current filters", async () => {
    const user = userEvent.setup();
    render(<IssueTable results={runResultsFixture.results} />);

    await user.type(screen.getByLabelText("Filter by rule id"), "no-such-rule");

    expect(screen.getByText("No issues match the current filters.")).toBeInTheDocument();
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
