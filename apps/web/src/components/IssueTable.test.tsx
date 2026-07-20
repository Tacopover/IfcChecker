import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueTable } from "./IssueTable";
import { runResultsFixture } from "../test/mocks/fixtures";

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
});
