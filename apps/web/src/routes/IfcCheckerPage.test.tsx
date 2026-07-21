import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IfcCheckerPage } from "./IfcCheckerPage";

const { parseWebIfcBuffer, parseIfcLiteBuffer } = vi.hoisted(() => ({
  parseWebIfcBuffer: vi.fn(),
  parseIfcLiteBuffer: vi.fn(),
}));
const { validateElements, parseIdsXml } = vi.hoisted(() => ({
  validateElements: vi.fn(),
  parseIdsXml: vi.fn(),
}));

vi.mock("@ifc-qa/parser-adapters/browser", () => ({ parseWebIfcBuffer, parseIfcLiteBuffer }));
vi.mock("@ifc-qa/ids-validator", () => ({ validateElements, parseIdsXml }));

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

beforeEach(() => {
  vi.clearAllMocks();
  parseIdsXml.mockReturnValue([{ name: "fake-spec", applicabilityEntityNames: [], requirements: [] }]);
});

describe("IfcCheckerPage", () => {
  it("disables the run button until an engine, an IDS file, and at least one IFC file are chosen", async () => {
    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    const submit = screen.getByRole("button", { name: "Parse & validate" });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    expect(submit).toBeDisabled();

    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    expect(submit).toBeDisabled();

    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    expect(submit).toBeEnabled();
  });

  it("tells the user what's still needed while the run button is disabled, updating as fields are filled", async () => {
    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    expect(screen.getByText(/select an engine/i)).toBeInTheDocument();
    expect(screen.getByText(/choose an IDS rule set file/i)).toBeInTheDocument();
    expect(screen.getByText(/choose at least one IFC file/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    expect(screen.queryByText(/select an engine/i)).not.toBeInTheDocument();
    expect(screen.getByText(/choose an IDS rule set file/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    expect(screen.queryByText(/choose an IDS rule set file/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/choose at least one IFC file/i)).not.toBeInTheDocument();
  });

  it("lists every selected IFC file and lets individual files be removed", async () => {
    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    await user.upload(screen.getByLabelText(/IFC files/), [makeFile("model-a.ifc"), makeFile("model-b.ifc")]);

    const fileList = screen.getByRole("list", { name: "Selected IFC files" });
    expect(within(fileList).getByText("model-a.ifc")).toBeInTheDocument();
    expect(within(fileList).getByText("model-b.ifc")).toBeInTheDocument();

    await user.click(within(fileList).getByRole("button", { name: "Remove model-a.ifc" }));

    expect(within(fileList).queryByText("model-a.ifc")).not.toBeInTheDocument();
    expect(within(fileList).getByText("model-b.ifc")).toBeInTheDocument();
  });

  it("re-disables the run button and shows the hint again once the last IFC file is removed", async () => {
    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    expect(screen.getByRole("button", { name: "Parse & validate" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Remove model-a.ifc" }));

    expect(screen.getByRole("button", { name: "Parse & validate" })).toBeDisabled();
    expect(screen.getByText(/choose at least one IFC file/i)).toBeInTheDocument();
  });

  it("adds newly chosen IFC files to the existing selection instead of replacing it", async () => {
    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    const ifcInput = screen.getByLabelText(/IFC files/);
    await user.upload(ifcInput, makeFile("model-a.ifc"));
    await user.upload(ifcInput, makeFile("model-b.ifc"));

    const fileList = screen.getByRole("list", { name: "Selected IFC files" });
    expect(within(fileList).getByText("model-a.ifc")).toBeInTheDocument();
    expect(within(fileList).getByText("model-b.ifc")).toBeInTheDocument();
  });

  it("resets the engine, files, and results back to the empty state", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateElements.mockReturnValueOnce([]);

    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    await user.click(screen.getByRole("button", { name: "Parse & validate" }));
    await screen.findByRole("table", { name: "File results" });

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByRole("table", { name: "File results" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "web-ifc" })).not.toBeChecked();
    expect((screen.getByLabelText("IDS rule set (XML)") as HTMLInputElement).files).toHaveLength(0);
    expect((screen.getByLabelText(/IFC files/) as HTMLInputElement).files).toHaveLength(0);
    expect(screen.queryByRole("list", { name: "Selected IFC files" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parse & validate" })).toBeDisabled();
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
    render(<IfcCheckerPage />);

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
    render(<IfcCheckerPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.upload(screen.getByLabelText(/IFC files/), [makeFile("corrupt.ifc"), makeFile("model-b.ifc")]);
    await user.click(screen.getByRole("button", { name: "Parse & validate" }));

    expect(await screen.findByText("failed")).toBeInTheDocument();
    expect(screen.getByText("unexpected EOF")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
  });

  it("shows an error instead of a silent 'no issues' result when the IDS file has no specifications", async () => {
    parseIdsXml.mockReturnValue([]);
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("not-really-ids.xml", "<not-ids/>"));
    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    await user.click(screen.getByRole("button", { name: "Parse & validate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("doesn't look like a valid IDS rule set");
    expect(screen.queryByRole("table", { name: "File results" })).not.toBeInTheDocument();
  });

  it("shows an error and disables the button when more than 20 IFC files are selected", async () => {
    const user = userEvent.setup();
    render(<IfcCheckerPage />);

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));

    const tooManyFiles = Array.from({ length: 21 }, (_, i) => makeFile(`model-${i}.ifc`));
    await user.upload(screen.getByLabelText(/IFC files/), tooManyFiles);

    expect(screen.getByRole("alert")).toHaveTextContent("Select up to 20 files (21 selected).");
    expect(screen.getByRole("button", { name: "Parse & validate" })).toBeDisabled();
  });
});
