import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { ElementDetails } from "./ElementDetails";

function makeElement(overrides: Partial<NormalizedElement> = {}): NormalizedElement {
  return {
    globalId: "1Aa2Bb3Cc4Dd5Ee6Ff7G01",
    ifcType: "IFCWALL",
    predefinedType: "STANDARD",
    name: "West Wall",
    attributes: { Tag: "W-001", Description: "External wall north" },
    propertySets: {
      Pset_WallCommon: { FireRating: null, IsExternal: true, LoadBearing: false },
      MEP_Data: { SystemAbbreviation: "SA" },
    },
    ...overrides,
  };
}

function table(caption: string): HTMLElement {
  const found = screen.getByText(caption).closest("table");
  if (found === null) throw new Error(`no table captioned ${caption}`);
  return found;
}

describe("ElementDetails", () => {
  it("shows the element's identity", () => {
    render(<ElementDetails element={makeElement()} fileName="model-a.ifc" onClose={vi.fn()} />);

    const identity = table("Identity");
    expect(within(identity).getByText("1Aa2Bb3Cc4Dd5Ee6Ff7G01")).toBeInTheDocument();
    expect(within(identity).getByText("IFCWALL")).toBeInTheDocument();
    expect(within(identity).getByText("STANDARD")).toBeInTheDocument();
    expect(within(identity).getByText("model-a.ifc")).toBeInTheDocument();
  });

  it("shows every attribute the element carries", () => {
    render(<ElementDetails element={makeElement()} fileName="model-a.ifc" onClose={vi.fn()} />);

    const attributes = table("Attributes");
    expect(within(attributes).getByText("Tag")).toBeInTheDocument();
    expect(within(attributes).getByText("W-001")).toBeInTheDocument();
    expect(within(attributes).getByText("Description")).toBeInTheDocument();
    expect(within(attributes).getByText("External wall north")).toBeInTheDocument();
  });

  it("shows every property set, one table each", () => {
    render(<ElementDetails element={makeElement()} fileName="model-a.ifc" onClose={vi.fn()} />);

    expect(within(table("Pset_WallCommon")).getByText("IsExternal")).toBeInTheDocument();
    expect(within(table("MEP_Data")).getByText("SystemAbbreviation")).toBeInTheDocument();
    expect(within(table("MEP_Data")).getByText("SA")).toBeInTheDocument();
  });

  // A missing FireRating is usually the whole reason the element is on screen, so an absent
  // property has to be visible rather than an empty cell.
  it("says a property is not set rather than rendering an empty cell", () => {
    render(<ElementDetails element={makeElement()} fileName="model-a.ifc" onClose={vi.fn()} />);

    const wallCommon = table("Pset_WallCommon");
    const row = within(wallCommon).getByText("FireRating").closest("tr");
    expect(row).toHaveTextContent("not set");
  });

  it("renders booleans instead of dropping false", () => {
    render(<ElementDetails element={makeElement()} fileName="model-a.ifc" onClose={vi.fn()} />);

    const wallCommon = table("Pset_WallCommon");
    expect(within(wallCommon).getByText("LoadBearing").closest("tr")).toHaveTextContent("false");
    expect(within(wallCommon).getByText("IsExternal").closest("tr")).toHaveTextContent("true");
  });

  it("handles an element with nothing on it", () => {
    render(
      <ElementDetails
        element={makeElement({ name: null, predefinedType: null, attributes: {}, propertySets: {} })}
        fileName="model-a.ifc"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("(unnamed)")).toBeInTheDocument();
    expect(screen.getByText("No attributes were read for this element.")).toBeInTheDocument();
    expect(screen.getByText("This element carries no property sets.")).toBeInTheDocument();
  });

  it("says so when the element is no longer loaded", () => {
    render(<ElementDetails element={null} fileName="model-a.ifc" onClose={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("no longer loaded");
  });

  it("closes on request", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ElementDetails element={makeElement()} fileName="model-a.ifc" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});
