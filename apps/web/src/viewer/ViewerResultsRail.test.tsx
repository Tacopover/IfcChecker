import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SpecificationSummary } from "../local/parseAndValidate";
import type { IssueRow } from "../components/IssueTable";
import { ViewerResultsRail, type ViewerResultsRailProps } from "./ViewerResultsRail";

function row(overrides: Partial<IssueRow> = {}): IssueRow {
  return {
    id: "row-1",
    fileJobId: "job-1",
    elementGlobalId: "1a2b3c4d5e6f7g8h9i0jkl",
    elementType: "IFCDUCTSEGMENT",
    ruleId: "insulation",
    severity: "error",
    message: "InsulationThickness is missing",
    fileName: "vent.ifc",
    modelKey: "vent.ifc:1:2",
    elementName: "Supply duct 630x400",
    elementTag: null,
    ...overrides,
  };
}

function summary(overrides: Partial<SpecificationSummary> = {}): SpecificationSummary {
  return {
    name: "Ducts declare an insulation thickness",
    checked: true,
    unsupported: [],
    applicableCount: 9,
    passedCount: 5,
    failedCount: 4,
    violations: [row()],
    cardinalityFailure: null,
    ...overrides,
  };
}

function renderRail(overrides: Partial<ViewerResultsRailProps> = {}) {
  const props: ViewerResultsRailProps = {
    results: [summary()],
    openIndex: null,
    onToggleSpec: vi.fn(),
    activeIndex: null,
    focusMode: "highlight",
    onApplyMode: vi.fn(),
    selectedRowId: null,
    onSelectRow: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ViewerResultsRail {...props} />) };
}

describe("ViewerResultsRail", () => {
  it("says a check has to be run before it can show anything", () => {
    renderRail({ results: null });
    expect(screen.getByText(/no check has been run yet/i)).toBeInTheDocument();
  });

  it("reports how many elements of a specification failed", () => {
    renderRail({ results: [summary({ violations: [row(), row({ id: "row-2" })] })] });
    expect(screen.getByText("2 failing")).toBeInTheDocument();
    expect(screen.getByText("9 applicable elements")).toBeInTheDocument();
  });

  it("hands a click on a failing specification straight to the caller", async () => {
    const user = userEvent.setup();
    const { props } = renderRail();
    await user.click(screen.getByRole("button", { name: /insulation thickness/i }));
    expect(props.onToggleSpec).toHaveBeenCalledWith(0);
  });

  // Nothing to put on screen means nothing to click: a passing specification is
  // a result, but not one the 3D view can take anyone to.
  it("refuses to open a specification with no failing elements", () => {
    renderRail({
      results: [summary({ violations: [], failedCount: 0, passedCount: 9 })],
    });
    expect(screen.getByRole("button", { name: /insulation thickness/i })).toBeDisabled();
    expect(screen.getByText("9 passed")).toBeInTheDocument();
  });

  it("lists the failing elements of the open specification", () => {
    renderRail({ openIndex: 0 });
    expect(screen.getByText("Supply duct 630x400")).toBeInTheDocument();
    expect(screen.getByText("InsulationThickness is missing")).toBeInTheDocument();
  });

  it("selects the element behind a row", async () => {
    const user = userEvent.setup();
    const { props } = renderRail({ openIndex: 0 });
    await user.click(screen.getByRole("button", { name: /Supply duct 630x400/ }));
    expect(props.onSelectRow).toHaveBeenCalledWith(expect.objectContaining({ id: "row-1" }));
  });

  it("marks the mode the open specification is currently shown in", () => {
    renderRail({ openIndex: 0, activeIndex: 0, focusMode: "highlight" });
    expect(screen.getByRole("button", { name: "Highlight" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Isolate" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches an open specification between isolating and highlighting", async () => {
    const user = userEvent.setup();
    const { props } = renderRail({ openIndex: 0, activeIndex: 0 });
    await user.click(screen.getByRole("button", { name: "Isolate" }));
    expect(props.onApplyMode).toHaveBeenCalledWith(0, "isolate");
  });
});
