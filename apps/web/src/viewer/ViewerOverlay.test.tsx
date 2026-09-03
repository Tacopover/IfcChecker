import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewerOverlay, type ViewerOverlayProps } from "./ViewerOverlay";
import { sectionBoxFromBounds } from "./sectionBox";

const BOUNDS = { min: { x: -5, y: 0, z: -5 }, max: { x: 5, y: 3, z: 5 } };

function renderOverlay(overrides: Partial<ViewerOverlayProps> = {}) {
  const props: ViewerOverlayProps = {
    onZoomToFit: vi.fn(),
    onZoomToSelection: vi.fn(),
    canZoomToSelection: false,
    onResetView: vi.fn(),
    section: sectionBoxFromBounds(BOUNDS),
    sectionBounds: BOUNDS,
    onToggleSection: vi.fn(),
    onMoveSectionFace: vi.fn(),
    onResetSection: vi.fn(),
    isolatedCount: null,
    highlightedCount: null,
    hiddenCount: 0,
    focusLabel: null,
    focusCount: 0,
    onClearIsolation: vi.fn(),
    onClearHighlight: vi.fn(),
    onShowEverything: vi.fn(),
    onClearFocus: vi.fn(),
    messages: [],
    ...overrides,
  };
  return { props, ...render(<ViewerOverlay {...props} />) };
}

describe("ViewerOverlay", () => {
  it("keeps the framing controls available at all times", () => {
    renderOverlay();
    expect(screen.getByRole("button", { name: "Zoom to fit" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reset view" })).toBeEnabled();
  });

  it("offers zoom to selection only when there is something to zoom to", async () => {
    const user = userEvent.setup();
    const { unmount } = renderOverlay();
    expect(screen.getByRole("button", { name: "Zoom to selection" })).toBeDisabled();
    unmount();

    const { props } = renderOverlay({ canZoomToSelection: true });
    await user.click(screen.getByRole("button", { name: "Zoom to selection" }));
    expect(props.onZoomToSelection).toHaveBeenCalled();
  });

  // The right-hand stack is what is currently true of the view: with a plain
  // view there is nothing true of it, so there is nothing to show.
  it("shows no state chips over an untouched model", () => {
    renderOverlay();
    expect(screen.queryByText("Isolated")).not.toBeInTheDocument();
    expect(screen.queryByText("Highlighted")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("counts what is isolated and undoes it from the chip", async () => {
    const user = userEvent.setup();
    const { props } = renderOverlay({ isolatedCount: 12 });
    expect(screen.getByText("Isolated")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Un-isolate" }));
    expect(props.onClearIsolation).toHaveBeenCalled();
  });

  // A focus knows which rule it came from, which is more use than "isolated".
  it("names the specification a focus came from instead of the generic chip", () => {
    renderOverlay({ focusLabel: "Ducts declare an insulation thickness", focusCount: 4, isolatedCount: 4 });
    expect(screen.getByText("Ducts declare an insulation thickness")).toBeInTheDocument();
    expect(screen.queryByText("Isolated")).not.toBeInTheDocument();
  });

  it("opens the clip sliders only while the section box is on", async () => {
    const user = userEvent.setup();
    const { props } = renderOverlay();
    expect(screen.queryByLabelText("X minimum")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Section box" }));
    expect(props.onToggleSection).toHaveBeenCalledWith(true);

    renderOverlay({ section: sectionBoxFromBounds(BOUNDS, true) });
    expect(screen.getByLabelText("X minimum")).toBeInTheDocument();
    expect(screen.getByLabelText("Z maximum")).toBeInTheDocument();
  });

  it("floats a failed load over the canvas as an alert", () => {
    renderOverlay({ messages: [{ kind: "error", text: "Geometry could not be read." }] });
    expect(screen.getByRole("alert")).toHaveTextContent("Geometry could not be read.");
  });
});
