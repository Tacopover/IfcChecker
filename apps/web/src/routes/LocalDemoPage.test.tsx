import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalDemoPage } from "./LocalDemoPage";

const { parseWebIfcBuffer, parseIfcLiteBuffer } = vi.hoisted(() => ({
  parseWebIfcBuffer: vi.fn(),
  parseIfcLiteBuffer: vi.fn(),
}));
const { validateElements } = vi.hoisted(() => ({ validateElements: vi.fn() }));

vi.mock("@ifc-qa/parser-adapters", () => ({ parseWebIfcBuffer, parseIfcLiteBuffer }));
vi.mock("@ifc-qa/ids-validator", () => ({ validateElements }));

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

describe("LocalDemoPage", () => {
  it("disables the run button until an engine, an IDS file, and at least one IFC file are chosen", async () => {
    const user = userEvent.setup();
    render(<LocalDemoPage />);

    const submit = screen.getByRole("button", { name: "Parse & validate" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    expect(submit).toBeDisabled();

    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    expect(submit).toBeDisabled();

    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    expect(submit).toBeEnabled();
  });

  it("parses uploaded files entirely client-side and renders per-file status plus violations", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({
      elements: [{ globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} }],
      parseMs: 12,
    });
    validateElements.mockReturnValueOnce([
      { elementGlobalId: "g1", elementType: "IFCWALL", ruleId: "naming-prefix", severity: "error", message: "Name must start with 'W-'" },
    ]);

    const user = userEvent.setup();
    render(<LocalDemoPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    await user.click(screen.getByRole("button", { name: "Parse & validate" }));

    const fileResultsTable = await screen.findByRole("table", { name: "File results" });
    expect(within(fileResultsTable).getByText("model-a.ifc")).toBeInTheDocument();
    expect(within(fileResultsTable).getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("naming-prefix")).toBeInTheDocument();
    expect(screen.getByText("Name must start with 'W-'")).toBeInTheDocument();
  });

  it("shows a failed status and error message for a file that fails to parse, without blocking other files", async () => {
    parseWebIfcBuffer
      .mockRejectedValueOnce(new Error("unexpected EOF"))
      .mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateElements.mockReturnValue([]);

    const user = userEvent.setup();
    render(<LocalDemoPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.upload(screen.getByLabelText(/IFC files/), [makeFile("corrupt.ifc"), makeFile("model-b.ifc")]);
    await user.click(screen.getByRole("button", { name: "Parse & validate" }));

    expect(await screen.findByText("failed")).toBeInTheDocument();
    expect(screen.getByText("unexpected EOF")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
  });

  it("shows an error and disables the button when more than 20 IFC files are selected", async () => {
    const user = userEvent.setup();
    render(<LocalDemoPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));

    const tooManyFiles = Array.from({ length: 21 }, (_, i) => makeFile(`model-${i}.ifc`));
    await user.upload(screen.getByLabelText(/IFC files/), tooManyFiles);

    expect(screen.getByRole("alert")).toHaveTextContent("Select up to 20 files (21 selected).");
    expect(screen.getByRole("button", { name: "Parse & validate" })).toBeDisabled();
  });
});
