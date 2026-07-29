import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IfcCheckerPage } from "./IfcCheckerPage";
import { LoadedModelsProvider } from "../state/loadedModels";

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

function renderPage() {
  return render(
    <LoadedModelsProvider>
      <IfcCheckerPage />
    </LoadedModelsProvider>
  );
}

function makeFile(name: string, content = "ISO-10303-21;") {
  return new File([content], name);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Step 1 of the page: pick an engine, pick files, parse them. */
async function parseFiles(user: ReturnType<typeof userEvent.setup>, ...files: File[]) {
  await user.click(screen.getByRole("radio", { name: "web-ifc" }));
  await user.upload(screen.getByLabelText(/IFC files/), files);
  await user.click(screen.getByRole("button", { name: "Parse files" }));
  return screen.findByRole("table", { name: "IFC files" });
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): a test whose IDS file has no
  // specifications throws before validateElements is ever called (see
  // "no specifications" test below), leaving its queued
  // mockReturnValueOnce unconsumed — clearAllMocks only resets call
  // history, not that queue, so the leftover value would otherwise leak
  // into whichever test runs next and desync its call-by-call mock
  // sequencing.
  vi.resetAllMocks();
  parseIdsXml.mockReturnValue([{ name: "fake-spec", applicabilityEntityNames: [], requirements: [] }]);
});

describe("IfcCheckerPage", () => {
  it("disables the parse button until an engine and at least one IFC file are chosen", async () => {
    const user = userEvent.setup();
    renderPage();

    const parse = screen.getByRole("button", { name: "Parse files" });
    expect(parse).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    expect(parse).toBeDisabled();

    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    expect(parse).toBeEnabled();
  });

  it("disables the check button until files are parsed and an IDS file is chosen", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    renderPage();

    const check = screen.getByRole("button", { name: "Check files" });
    expect(check).toBeDisabled();

    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    expect(check).toBeDisabled();

    await parseFiles(user, makeFile("model-a.ifc"));
    expect(check).toBeEnabled();
  });

  it("tells the user what's still needed for each step, updating as fields are filled", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/To parse: select an engine, choose at least one IFC file/i)).toBeInTheDocument();
    expect(screen.getByText(/To check: parse at least one IFC file, choose an IDS rule set file/i)).toBeInTheDocument();

    await parseFiles(user, makeFile("model-a.ifc"));

    expect(screen.queryByText(/To parse:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/To check: choose an IDS rule set file/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    expect(screen.queryByText(/To check:/i)).not.toBeInTheDocument();
  });

  it("lists every selected IFC file as pending and lets individual files be removed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.upload(screen.getByLabelText(/IFC files/), [makeFile("model-a.ifc"), makeFile("model-b.ifc")]);

    const table = screen.getByRole("table", { name: "IFC files" });
    expect(within(table).getByText("model-a.ifc")).toBeInTheDocument();
    expect(within(table).getByText("model-b.ifc")).toBeInTheDocument();
    expect(within(table).getAllByText("pending")).toHaveLength(2);

    await user.click(within(table).getByRole("button", { name: "Remove model-a.ifc" }));

    expect(within(table).queryByText("model-a.ifc")).not.toBeInTheDocument();
    expect(within(table).getByText("model-b.ifc")).toBeInTheDocument();
  });

  it("re-disables the parse button and shows the hint again once the last IFC file is removed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    expect(screen.getByRole("button", { name: "Parse files" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Remove model-a.ifc" }));

    expect(screen.getByRole("button", { name: "Parse files" })).toBeDisabled();
    expect(screen.getByText(/choose at least one IFC file/i)).toBeInTheDocument();
  });

  it("adds newly chosen IFC files to the existing selection instead of replacing it", async () => {
    const user = userEvent.setup();
    renderPage();

    const ifcInput = screen.getByLabelText(/IFC files/);
    await user.upload(ifcInput, makeFile("model-a.ifc"));
    await user.upload(ifcInput, makeFile("model-b.ifc"));

    const table = screen.getByRole("table", { name: "IFC files" });
    expect(within(table).getByText("model-a.ifc")).toBeInTheDocument();
    expect(within(table).getByText("model-b.ifc")).toBeInTheDocument();
  });

  it("resets the engine, files, and results back to the empty state", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateElements.mockReturnValueOnce([]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    await screen.findByRole("heading", { name: "Issues" });

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByRole("table", { name: "IFC files" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Issues" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "web-ifc" })).not.toBeChecked();
    expect((screen.getByLabelText("IDS rule set (XML)") as HTMLInputElement).files).toHaveLength(0);
    expect((screen.getByLabelText(/IFC files/) as HTMLInputElement).files).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Parse files" })).toBeDisabled();
  });

  it("parses uploaded files entirely client-side, then reports violations when a rule set is checked", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({
      elements: [{ globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} }],
      parseMs: 12,
    });
    validateElements.mockReturnValueOnce([
      { elementGlobalId: "g1", elementType: "IFCWALL", ruleId: "naming-prefix", severity: "error", message: "Name must start with 'W-'" },
    ]);

    const user = userEvent.setup();
    renderPage();

    const table = await parseFiles(user, makeFile("model-a.ifc"));
    expect(within(table).getByText("model-a.ifc")).toBeInTheDocument();
    expect(within(table).getByText("succeeded")).toBeInTheDocument();
    expect(within(table).getByText("1")).toBeInTheDocument();
    // Nothing has been checked yet, so nothing may be claimed about compliance.
    expect(screen.queryByRole("heading", { name: "Issues" })).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));

    expect(await screen.findByText("naming-prefix")).toBeInTheDocument();
    expect(screen.getByText("Name must start with 'W-'")).toBeInTheDocument();
  });

  it("checks a second rule set against the files already in memory, without parsing them again", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateElements.mockReturnValueOnce([]).mockReturnValueOnce([
      { elementGlobalId: "g1", elementType: "IFCWALL", ruleId: "second-set", severity: "error", message: "Fails the newer rules" },
    ]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    await screen.findByRole("heading", { name: "Issues" });

    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("stricter.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));

    expect(await screen.findByText("second-set")).toBeInTheDocument();
    expect(parseWebIfcBuffer).toHaveBeenCalledTimes(1);
  });

  it("drops results that no longer describe the current file set", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateElements.mockReturnValueOnce([
      { elementGlobalId: "g1", elementType: "IFCWALL", ruleId: "naming-prefix", severity: "error", message: "Name must start with 'W-'" },
    ]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    expect(await screen.findByText("naming-prefix")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove model-a.ifc" }));

    expect(screen.queryByRole("heading", { name: "Issues" })).not.toBeInTheDocument();
  });

  it("lets the user expand a parsed file's row to see its project/site/building/storey structure", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({
      elements: [],
      parseMs: 5,
      modelStructure: {
        expressId: 1,
        ifcType: "IFCPROJECT",
        name: "Fixture Project",
        elementIdsByType: {},
        children: [
          {
            expressId: 14,
            ifcType: "IFCBUILDINGSTOREY",
            name: "Level 1",
            elementIdsByType: { IFCWALL: [101] },
            children: [],
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    expect(screen.queryByRole("list", { name: "Model structure" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show structure for model-a.ifc" }));
    expect(screen.getByText("Fixture Project")).toBeInTheDocument();
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("IFCWALL: 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide structure for model-a.ifc" }));
    expect(screen.queryByRole("list", { name: "Model structure" })).not.toBeInTheDocument();
  });

  it("doesn't offer to show structure for a file that failed to parse", async () => {
    parseWebIfcBuffer.mockRejectedValueOnce(new Error("unexpected EOF"));

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("corrupt.ifc"));

    expect(await screen.findByText("failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show structure/ })).not.toBeInTheDocument();
  });

  it("shows a failed status and error message for a file that fails to parse, without blocking other files", async () => {
    parseWebIfcBuffer
      .mockRejectedValueOnce(new Error("unexpected EOF"))
      .mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("corrupt.ifc"), makeFile("model-b.ifc"));

    expect(await screen.findByText("failed")).toBeInTheDocument();
    expect(screen.getByText("unexpected EOF")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
  });

  it("shows an error instead of a silent 'no issues' result when the IDS file has no specifications", async () => {
    parseIdsXml.mockReturnValue([]);
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (XML)"), makeFile("not-really-ids.xml", "<not-ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("doesn't look like a valid IDS rule set");
    expect(screen.queryByRole("heading", { name: "Issues" })).not.toBeInTheDocument();
  });

  it("shows live progress naming the current file and its position in the batch while parsing, then clears it", async () => {
    const first = deferred<{ elements: unknown[]; parseMs: number }>();
    const second = deferred<{ elements: unknown[]; parseMs: number }>();
    parseWebIfcBuffer.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText(/IFC files/), [makeFile("model-a.ifc"), makeFile("model-b.ifc")]);
    await user.click(screen.getByRole("button", { name: "Parse files" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Parsing 1 of 2: model-a\.ifc/);
    expect(screen.getByRole("status")).toHaveTextContent(/\d+s elapsed/);

    first.resolve({ elements: [], parseMs: 5 });
    await screen.findByText(/Parsing 2 of 2: model-b\.ifc/);

    second.resolve({ elements: [], parseMs: 5 });
    await screen.findByText(/All 2 files are parsed with web-ifc/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("only re-parses the files that need it when more are added to an already-parsed set", async () => {
    parseWebIfcBuffer
      .mockResolvedValueOnce({ elements: [], parseMs: 5 })
      .mockResolvedValueOnce({ elements: [], parseMs: 6 });

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    expect(parseWebIfcBuffer).toHaveBeenCalledTimes(1);

    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-b.ifc"));
    await user.click(screen.getByRole("button", { name: "Parse files" }));
    await screen.findByText(/All 2 files are parsed with web-ifc/);

    expect(parseWebIfcBuffer).toHaveBeenCalledTimes(2);
  });

  it("treats a switch of engine as work still to do, re-parsing with the newly chosen one", async () => {
    parseWebIfcBuffer.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    parseIfcLiteBuffer.mockResolvedValueOnce({ elements: [], parseMs: 3 });

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    expect(screen.getByRole("button", { name: "Parse files" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "ifc-lite" }));
    expect(screen.getByRole("button", { name: "Parse files" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Parse files" }));
    await screen.findByText(/All 1 file is parsed with ifc-lite/);
    expect(parseIfcLiteBuffer).toHaveBeenCalledTimes(1);
  });

  it("puts no cap on how many IFC files may be loaded at once", async () => {
    parseWebIfcBuffer.mockResolvedValue({ elements: [], parseMs: 1 });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(
      screen.getByLabelText(/IFC files/),
      Array.from({ length: 25 }, (_, i) => makeFile(`model-${i}.ifc`))
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parse files" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Parse files" }));

    await screen.findByText(/All 25 files are parsed with web-ifc/);
    expect(parseWebIfcBuffer).toHaveBeenCalledTimes(25);
  });
});
