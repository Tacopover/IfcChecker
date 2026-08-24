import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IfcCheckerPage } from "./IfcCheckerPage";
import { LoadedModelsProvider } from "../state/loadedModels";

const { parse, cancel } = vi.hoisted(() => ({ parse: vi.fn(), cancel: vi.fn() }));
const { validateBySpecification, parseIdsXml, isEvaluable } = vi.hoisted(() => ({
  validateBySpecification: vi.fn(),
  parseIdsXml: vi.fn(),
  isEvaluable: vi.fn(),
}));
const { exportResultsAsExcel } = vi.hoisted(() => ({ exportResultsAsExcel: vi.fn() }));

vi.mock("../local/parseWorkerClient.js", () => ({ parseWorkerClient: { parse, cancel } }));
vi.mock("@ifc-qa/ids-validator", () => ({
  validateBySpecification,
  parseIdsXml,
  isEvaluable,
  REQUIRED_CARDINALITY_EMPTY_MESSAGE:
    "This specification requires at least one matching element, and the model has none. It was not checked because there was nothing to check.",
}));
// The real exportResultsAsCsv needs no library and is exercised for real below; only the
// Excel path is mocked here, since it dynamically imports exceljs — a large bundled library
// whose own tests already cover it in @ifc-qa/report-generator, and which is unreliable to
// load through vite-node's module transform when many unrelated test files run alongside it.
vi.mock("../local/exportResults.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../local/exportResults.js")>();
  return { ...actual, exportResultsAsExcel };
});

/** One specification's outcome, as the validator hands it to the page. */
function outcome(violations: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) {
  return {
    name: "fake-spec",
    checked: true,
    unsupported: [],
    applicableCount: violations.length,
    passedCount: 0,
    failedCount: violations.length,
    violations,
    cardinalityFailure: null,
    ...overrides,
  };
}

function violation(overrides: Record<string, unknown> = {}) {
  return {
    elementGlobalId: "g1",
    elementType: "IFCWALL",
    elementName: "Wall-1",
    ruleId: "naming-prefix",
    severity: "error",
    message: "Name must start with 'W-'",
    ...overrides,
  };
}

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

/** Step 1 of the page: pick files, parse them (ifc-lite is the only engine offered). */
async function parseFiles(user: ReturnType<typeof userEvent.setup>, ...files: File[]) {
  await user.upload(screen.getByLabelText(/IFC files/), files);
  await user.click(screen.getByRole("button", { name: "Parse files" }));
  return screen.findByRole("table", { name: "IFC files" });
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): a test whose IDS file has no
  // specifications throws before validateBySpecification is ever called (see
  // "no specifications" test below), leaving its queued
  // mockReturnValueOnce unconsumed — clearAllMocks only resets call
  // history, not that queue, so the leftover value would otherwise leak
  // into whichever test runs next and desync its call-by-call mock
  // sequencing.
  vi.resetAllMocks();
  parseIdsXml.mockReturnValue([
    { name: "fake-spec", applicability: { entityNames: ["IFCWALL"], facets: [] }, requirements: [], unsupported: [], applicabilityComplete: true },
  ]);
  isEvaluable.mockReturnValue(true);
});

describe("IfcCheckerPage", () => {
  it("disables the parse button until at least one IFC file is chosen", async () => {
    const user = userEvent.setup();
    renderPage();

    const parse = screen.getByRole("button", { name: "Parse files" });
    expect(parse).toBeDisabled();

    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    expect(parse).toBeEnabled();
  });

  it("disables the check button until files are parsed and an IDS file is chosen", async () => {
    parse.mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    renderPage();

    const check = screen.getByRole("button", { name: "Check files" });
    expect(check).toBeDisabled();

    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    expect(check).toBeDisabled();

    await parseFiles(user, makeFile("model-a.ifc"));
    expect(check).toBeEnabled();
  });

  it("tells the user what's still needed for each step, updating as fields are filled", async () => {
    parse.mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/To parse: choose at least one IFC file/i)).toBeInTheDocument();
    expect(screen.getByText(/To check: parse at least one IFC file, choose an IDS rule set file/i)).toBeInTheDocument();

    await parseFiles(user, makeFile("model-a.ifc"));

    expect(screen.queryByText(/To parse:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/To check: choose an IDS rule set file/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
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

  it("resets the files and results back to the empty state", async () => {
    parse.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateBySpecification.mockReturnValueOnce([outcome([], { applicableCount: 0, failedCount: 0 })]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    await screen.findByRole("heading", { name: "Results" });

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByRole("table", { name: "IFC files" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Results" })).not.toBeInTheDocument();
    expect((screen.getByLabelText("IDS rule set (.ids or .xml)") as HTMLInputElement).files).toHaveLength(0);
    expect((screen.getByLabelText(/IFC files/) as HTMLInputElement).files).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Parse files" })).toBeDisabled();
  });

  it("parses uploaded files entirely client-side, then reports violations when a rule set is checked", async () => {
    parse.mockResolvedValueOnce({
      elements: [{ globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} }],
      parseMs: 12,
    });
    validateBySpecification.mockReturnValueOnce([outcome([violation()])]);

    const user = userEvent.setup();
    renderPage();

    const table = await parseFiles(user, makeFile("model-a.ifc"));
    expect(within(table).getByText("model-a.ifc")).toBeInTheDocument();
    expect(within(table).getByText("succeeded")).toBeInTheDocument();
    expect(within(table).getByText("1")).toBeInTheDocument();
    // Nothing has been checked yet, so nothing may be claimed about compliance.
    expect(screen.queryByRole("heading", { name: "Results" })).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));

    expect(await screen.findByText("Name must start with 'W-'")).toBeInTheDocument();
    expect(screen.getByText("Wall-1")).toBeInTheDocument();
  });

  it("checks a second rule set against the files already in memory, without parsing them again", async () => {
    parse.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateBySpecification
      .mockReturnValueOnce([outcome([], { applicableCount: 0, failedCount: 0 })])
      .mockReturnValueOnce([
        outcome([violation({ ruleId: "second-set", message: "Fails the newer rules" })], { name: "second-set" }),
      ]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    await screen.findByRole("heading", { name: "Results" });

    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("stricter.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));

    expect(await screen.findByText("Fails the newer rules")).toBeInTheDocument();
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("drops results that no longer describe the current file set", async () => {
    parse.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateBySpecification.mockReturnValueOnce([outcome([violation()])]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    expect(await screen.findByText("Name must start with 'W-'")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove model-a.ifc" }));

    expect(screen.queryByRole("heading", { name: "Results" })).not.toBeInTheDocument();
  });

  it("opens the full attributes and property sets of a failing element when it is picked", async () => {
    parse.mockResolvedValueOnce({
      elements: [
        {
          globalId: "g1",
          ifcType: "IFCWALL",
          predefinedType: "STANDARD",
          name: "Wall-1",
          attributes: { Tag: { value: "W-001" } },
          propertySets: {
            Pset_WallCommon: { FireRating: { value: null }, IsExternal: { value: true } },
          },
        },
      ],
      parseMs: 12,
    });
    validateBySpecification.mockReturnValueOnce([outcome([violation()])]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    await screen.findByRole("heading", { name: "Results" });

    await user.click(screen.getByRole("button", { name: /Wall-1/ }));

    const details = screen.getByRole("complementary", { name: "Element details" });
    expect(within(details).getByText("g1")).toBeInTheDocument();
    expect(within(details).getByText("Tag")).toBeInTheDocument();
    expect(within(details).getByText("W-001")).toBeInTheDocument();
    expect(within(details).getByText("IsExternal")).toBeInTheDocument();
    expect(within(details).getByText("FireRating").closest("tr")).toHaveTextContent("not set");
    expect(within(details).getByText("model-a.ifc")).toBeInTheDocument();

    await user.click(within(details).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Element details" })).not.toBeInTheDocument();
  });

  // The store keys models by name+size+lastModified precisely because names collide, so the
  // details panel has to resolve the element through that key rather than the file name.
  it("shows the element from the file the issue came from when two files share a name", async () => {
    const wallIn = (name: string) => ({
      globalId: "g1",
      ifcType: "IFCWALL",
      predefinedType: null,
      name,
      attributes: {},
      propertySets: {},
    });
    parse
      .mockResolvedValueOnce({ elements: [wallIn("Wall in the first file")], parseMs: 5 })
      .mockResolvedValueOnce({ elements: [wallIn("Wall in the second file")], parseMs: 5 });
    validateBySpecification
      .mockReturnValueOnce([outcome([], { applicableCount: 1, passedCount: 1, failedCount: 0 })])
      .mockReturnValueOnce([outcome([violation({ elementName: "Wall in the second file" })])]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(
      user,
      new File(["ISO-10303-21;"], "model.ifc"),
      new File(["ISO-10303-21; longer, so the size differs"], "model.ifc")
    );
    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));
    await screen.findByRole("heading", { name: "Results" });

    await user.click(screen.getByRole("button", { name: /Wall in the second file/ }));

    const details = screen.getByRole("complementary", { name: "Element details" });
    expect(within(details).getByRole("heading", { name: "Wall in the second file" })).toBeInTheDocument();
  });

  it("reports a specification that matched no elements rather than showing a clean result", async () => {
    parse.mockResolvedValueOnce({ elements: [], parseMs: 5 });
    validateBySpecification.mockReturnValueOnce([
      outcome([], { name: "Walls are fire rated", applicableCount: 0, passedCount: 0, failedCount: 0 }),
    ]);

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.xml", "<ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("nothing was checked");
    expect(screen.getByText("no matching elements found")).toBeInTheDocument();
  });

  it("lets the user expand a parsed file's row to see its project/site/building/storey structure", async () => {
    parse.mockResolvedValueOnce({
      elements: [],
      parseMs: 5,
      modelStructure: {
        expressId: 1,
        ifcType: "IFCPROJECT",
        name: "Fixture Project",
        elementCounts: {},
        children: [
          {
            expressId: 14,
            ifcType: "IFCBUILDINGSTOREY",
            name: "Level 1",
            elementCounts: { IFCWALL: 1 },
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
    parse.mockRejectedValueOnce(new Error("unexpected EOF"));

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("corrupt.ifc"));

    expect(await screen.findByText("failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show structure/ })).not.toBeInTheDocument();
  });

  it("shows a failed status and error message for a file that fails to parse, without blocking other files", async () => {
    parse
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
    parse.mockResolvedValueOnce({ elements: [], parseMs: 5 });

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("not-really-ids.xml", "<not-ids/>"));
    await user.click(screen.getByRole("button", { name: "Check files" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("doesn't look like a valid IDS rule set");
    expect(screen.queryByRole("heading", { name: "Results" })).not.toBeInTheDocument();
  });

  it("shows live progress naming the current file and its position in the batch while parsing, then clears it", async () => {
    const first = deferred<{ elements: unknown[]; parseMs: number }>();
    const second = deferred<{ elements: unknown[]; parseMs: number }>();
    parse.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const user = userEvent.setup();
    renderPage();

    await user.upload(screen.getByLabelText(/IFC files/), [makeFile("model-a.ifc"), makeFile("model-b.ifc")]);
    await user.click(screen.getByRole("button", { name: "Parse files" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Parsing 1 of 2: model-a\.ifc/);
    expect(screen.getByRole("status")).toHaveTextContent(/\d+s elapsed/);

    first.resolve({ elements: [], parseMs: 5 });
    await screen.findByText(/Parsing 2 of 2: model-b\.ifc/);

    second.resolve({ elements: [], parseMs: 5 });
    await screen.findByText(/All 2 files are parsed with ifc-lite/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("only re-parses the files that need it when more are added to an already-parsed set", async () => {
    parse
      .mockResolvedValueOnce({ elements: [], parseMs: 5 })
      .mockResolvedValueOnce({ elements: [], parseMs: 6 });

    const user = userEvent.setup();
    renderPage();

    await parseFiles(user, makeFile("model-a.ifc"));
    expect(parse).toHaveBeenCalledTimes(1);

    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-b.ifc"));
    await user.click(screen.getByRole("button", { name: "Parse files" }));
    await screen.findByText(/All 2 files are parsed with ifc-lite/);

    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("puts no cap on how many IFC files may be loaded at once", async () => {
    parse.mockResolvedValue({ elements: [], parseMs: 1 });

    const user = userEvent.setup();
    renderPage();

    await user.upload(
      screen.getByLabelText(/IFC files/),
      Array.from({ length: 25 }, (_, i) => makeFile(`model-${i}.ifc`))
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parse files" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Parse files" }));

    await screen.findByText(/All 25 files are parsed with ifc-lite/);
    expect(parse).toHaveBeenCalledTimes(25);
  });

  it("shows parse percent once the engine reports progress, and offers Cancel while parsing", async () => {
    const first = deferred<unknown>();
    let onProgress!: (phase: string, percent: number) => void;
    parse.mockImplementationOnce((_file, _engine, progress) => {
      onProgress = progress;
      return first.promise;
    });

    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByLabelText(/IFC files/), makeFile("model-a.ifc"));
    await user.click(screen.getByRole("button", { name: "Parse files" }));

    onProgress("scan", 37);
    expect(await screen.findByRole("status")).toHaveTextContent(/37%/);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    first.resolve({ elements: [], idsScope: [], unitScales: {}, parseMs: 5, modelStructure: null });
    await screen.findByText(/All 1 file is parsed with ifc-lite/);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("Cancel stops the current file and does not start the next one in the batch", async () => {
    const first = deferred<unknown>();
    parse.mockReturnValueOnce(first.promise);

    const user = userEvent.setup();
    renderPage();
    await user.upload(screen.getByLabelText(/IFC files/), [makeFile("model-a.ifc"), makeFile("model-b.ifc")]);
    await user.click(screen.getByRole("button", { name: "Parse files" }));
    await screen.findByRole("button", { name: "Cancel" });

    // Cancel first, then reject: matches production causality (clicking Cancel triggers
    // parseWorkerClient.cancel(), which is what causes the pending parse() to reject) and
    // avoids a race where the mocked rejection's microtasks start model-b before the click
    // (a real DOM event dispatch, with its own microtask hops) sets cancelledRef.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    first.reject(new Error("Parsing failed: Cancelled"));

    const table = await screen.findByRole("table", { name: "IFC files" });
    expect(within(table).getByText("model-a.ifc").closest("tr")).toHaveTextContent("failed");
    expect(parse).toHaveBeenCalledTimes(1); // model-b.ifc was never started
  });

  describe("export", () => {
    async function checkOneFailure(user: ReturnType<typeof userEvent.setup>) {
      parse.mockResolvedValueOnce({
        elements: [{ globalId: "g1", ifcType: "IFCWALL", predefinedType: null, name: "Wall-1", attributes: {}, propertySets: {} }],
        parseMs: 12,
      });
      validateBySpecification.mockReturnValueOnce([outcome([violation()])]);

      await parseFiles(user, makeFile("model-a.ifc"));
      await user.upload(screen.getByLabelText("IDS rule set (.ids or .xml)"), makeFile("rules.ids", "<ids/>"));
      await user.click(screen.getByRole("button", { name: "Check files" }));
      await screen.findByRole("heading", { name: "Results" });
    }

    it("downloads a CSV named after the rule set once results exist", async () => {
      const user = userEvent.setup();
      const createObjectURL = vi.fn((_blob: Blob) => "blob:csv");
      const revokeObjectURL = vi.fn();
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
      let downloadName: string | null = null;
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        downloadName = this.download;
      });

      renderPage();
      await checkOneFailure(user);

      await user.click(screen.getByRole("button", { name: "Export CSV" }));

      expect(createObjectURL).toHaveBeenCalledOnce();
      const [blob] = createObjectURL.mock.calls[0];
      expect(blob.type).toBe("text/csv;charset=utf-8");
      expect(downloadName).toBe("rules-report.csv");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
      expect(await blob.text()).toContain("Name must start with 'W-'");
    });

    it("hands the checked results and rule set name to the Excel exporter, disabling the button while it runs", async () => {
      const user = userEvent.setup();
      const pending = deferred<void>();
      exportResultsAsExcel.mockReturnValueOnce(pending.promise);

      renderPage();
      await checkOneFailure(user);

      await user.click(screen.getByRole("button", { name: "Export Excel" }));

      expect(exportResultsAsExcel).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: "fake-spec" })]),
        "rules.ids",
        "ifc-lite"
      );
      expect(screen.getByRole("button", { name: "Exporting..." })).toBeDisabled();

      pending.resolve();
      expect(await screen.findByRole("button", { name: "Export Excel" })).toBeEnabled();
    });

    it("shows an error and re-enables the button when the Excel export fails", async () => {
      const user = userEvent.setup();
      exportResultsAsExcel.mockRejectedValueOnce(new Error("workbook generation failed"));

      renderPage();
      await checkOneFailure(user);

      await user.click(screen.getByRole("button", { name: "Export Excel" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("workbook generation failed");
      expect(screen.getByRole("button", { name: "Export Excel" })).toBeEnabled();
    });
  });
});
