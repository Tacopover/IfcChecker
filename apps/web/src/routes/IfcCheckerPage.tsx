import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import type { EngineId } from "@ifc-qa/shared-types";
import {
  parseFile,
  validateParsedModelsWithProgress,
  type CheckProgress,
  type ParseProgress,
  type SpecificationSummary,
} from "../local/parseAndValidate.js";
import { useCheckResults } from "../state/checkResults.js";
import { useLoadedModels } from "../state/loadedModels.js";
import { parseWorkerClient } from "../local/parseWorkerClient.js";
import { exportResultsAsBcf, exportResultsAsCsv, exportResultsAsExcel } from "../local/exportResults.js";
import { CheckSummary } from "../components/CheckSummary";
import { ElementDetails } from "../components/ElementDetails";
import { ExportScopeDialog } from "../components/ExportScopeDialog";
import type { IssueRow } from "../components/IssueTable";
import { ModelStructureTree } from "../components/ModelStructureTree";
import { buildElementFocusRequest, buildSpecificationFocusRequest, type ViewerFocusRequest } from "../viewer/focusRequest.js";

type ExportKind = "csv" | "excel" | "bcf";

interface ExampleIds {
  fileName: string;
  label: string;
  description: string;
}

// Bundled by scripts/copy-example-ids.mjs from fixtures/ids/ at the repo root into
// public/examples/ids/, so a user can try the app without sourcing their own IDS file first.
const EXAMPLE_IDS_FILES: ExampleIds[] = [
  {
    fileName: "Example-IDS.ids",
    label: "Example IDS",
    description:
      "Starter checks: storey naming, site name, material presence, NL-SfB classification codes, required properties, and system membership.",
  },
  {
    fileName: "Load_bearing-IDS.ids",
    label: "Load-bearing IDS",
    description:
      "The example checks above, plus load-bearing property checks for walls, slabs, and beams.",
  },
];

function countViolations(summaries: SpecificationSummary[] | null): number {
  return summaries?.reduce((total, summary) => total + summary.violations.length, 0) ?? 0;
}

function hasExtension(file: File, extensions: string[]): boolean {
  const name = file.name.toLowerCase();
  return extensions.some((extension) => name.endsWith(extension));
}

interface FileDropzoneProps {
  extensions: string[];
  onFiles: (files: File[]) => void;
  children: ReactNode;
}

/**
 * Wraps a `.file-field` so the same drop target both opens the OS file picker (via the `<input>`
 * inside it, unchanged) and accepts a drag-and-drop. Filters dropped files by extension itself —
 * unlike a picker, a drop is not narrowed by the input's own `accept`.
 */
function FileDropzone({ extensions, onFiles, children }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Only once the pointer actually leaves the zone, not when it crosses into a child element.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = Array.from(event.dataTransfer.files).filter((file) => hasExtension(file, extensions));
    if (dropped.length > 0) onFiles(dropped);
  }

  return (
    <div
      className="dropzone"
      data-dragging={dragging}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}

export interface IfcCheckerPageProps {
  /** Navigates to the viewer, isolated on the given element(s). Absent in tests that don't need it. */
  onFocusInViewer?: (request: ViewerFocusRequest) => void;
}

export function IfcCheckerPage({ onFocusInViewer }: IfcCheckerPageProps = {}) {
  const { models, addFiles, applyParseOutcome, removeModel, clearModels, idsFile, setIdsFile } =
    useLoadedModels();

  // ifc-lite is faster and more robust than web-ifc, so it's the only engine offered.
  const engine: EngineId = "ifc-lite";
  // Shared with the 3D page rather than owned here: the viewer's Results rail
  // shows the same specifications and puts their failing elements on screen.
  const { results, setResults } = useCheckResults();
  // Mirrors `results` with each specification's violations narrowed to whatever its issue
  // table's own filters currently admit — see CheckSummary's onFilteredSummariesChange.
  const [filteredResults, setFilteredResults] = useState<SpecificationSummary[] | null>(null);
  const [pendingExport, setPendingExport] = useState<ExportKind | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueRow | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingBcf, setIsExportingBcf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exampleError, setExampleError] = useState<string | null>(null);
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [checkProgress, setCheckProgress] = useState<CheckProgress | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cancelledRef = useRef(false);
  // Bumped on Reset to remount the IDS file input — clearing its React state
  // doesn't clear what the native <input type="file"> visually shows, since
  // its displayed filename isn't controlled by React. The IFC input is
  // cleared after every change instead (see handleIfcFilesChange), so it
  // doesn't need remounting.
  const [resetKey, setResetKey] = useState(0);

  const unparsed = models.filter((model) => model.status !== "succeeded" || model.engine !== engine);
  const parsed = models.filter((model) => model.status === "succeeded");

  const canParse = unparsed.length > 0 && !isParsing;
  const canCheck = idsFile !== null && parsed.length > 0 && !isParsing && !isChecking;

  const parseRequirements: string[] = [];
  if (models.length === 0) parseRequirements.push("choose at least one IFC file");

  const checkRequirements: string[] = [];
  if (parsed.length === 0) checkRequirements.push("parse at least one IFC file");
  if (idsFile === null) checkRequirements.push("choose an IDS rule set file");

  // Scanned on demand rather than indexed up front: a click can afford one pass over a model's
  // elements, whereas a GlobalId index for every loaded file is memory held permanently for a
  // lookup that may never happen. The model key is what joins here — file names collide.
  const selectedElement = useMemo(() => {
    if (selectedIssue === null) return null;
    const model = models.find((entry) => entry.key === selectedIssue.modelKey);
    return model?.elements.find((element) => element.globalId === selectedIssue.elementGlobalId) ?? null;
  }, [selectedIssue, models]);

  const detailsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (selectedIssue === null) return;
    // block: "nearest" so picking a second element while the panel is already on screen
    // doesn't yank the page around.
    detailsRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIssue]);

  // Results describe the file set as it was when Check ran; any change to that
  // set makes them a claim about something the user is no longer looking at.
  function dropStaleResults() {
    setResults(null);
    setFilteredResults(null);
    setPendingExport(null);
    setSelectedIssue(null);
    setCheckError(null);
    setExportError(null);
  }

  function handleIfcFiles(files: File[]) {
    addFiles(files);
    dropStaleResults();
  }

  function handleIfcFilesChange(event: ChangeEvent<HTMLInputElement>) {
    handleIfcFiles(Array.from(event.target.files ?? []));
    // Clear the input so picking files again adds to the list instead of
    // being a no-op (the browser won't fire onChange for a repeat selection).
    event.target.value = "";
  }

  function handleIdsFile(file: File | null) {
    setIdsFile(file);
    dropStaleResults();
  }

  async function handleLoadExample(example: ExampleIds) {
    setExampleError(null);
    setLoadingExample(example.fileName);
    try {
      const response = await fetch(`/examples/ids/${example.fileName}`);
      if (!response.ok) throw new Error(`Could not load ${example.label} (${response.status}).`);
      const blob = await response.blob();
      handleIdsFile(new File([blob], example.fileName, { type: "application/xml" }));
    } catch (error) {
      setExampleError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingExample(null);
    }
  }

  function handleRemoveIfcFile(key: string) {
    removeModel(key);
    dropStaleResults();
  }

  function toggleStructureExpanded(key: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleParse() {
    if (!canParse) return;
    setIsParsing(true);
    cancelledRef.current = false;
    dropStaleResults();
    setExpandedFiles(new Set());
    const targets = unparsed;
    try {
      // Sequential, not Promise.all: each file spins up its own WASM engine
      // instance (see parseWebIfcBuffer/parseIfcLiteBuffer); running many of
      // those concurrently in one tab risks memory pressure on a large batch
      // (files run to 2GB, and the batch size is the user's to choose).
      for (const [index, model] of targets.entries()) {
        if (cancelledRef.current) break;
        clearInterval(tickIntervalRef.current);
        setProgress({ fileName: model.fileName, index: index + 1, total: targets.length, percent: null });
        setElapsedSeconds(0);
        tickIntervalRef.current = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
        const outcome = await parseFile(model.file, engine, (_phase, percent) => {
          setProgress((current) => (current ? { ...current, percent } : current));
        });
        applyParseOutcome(model.key, outcome);
      }
    } finally {
      clearInterval(tickIntervalRef.current);
      setIsParsing(false);
      setProgress(null);
      setElapsedSeconds(0);
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    parseWorkerClient.cancel();
  }

  async function handleCheck() {
    if (!canCheck) return;
    setIsChecking(true);
    setCheckError(null);
    setCheckProgress(null);
    setElapsedSeconds(0);
    clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    try {
      const idsXml = await idsFile.text();
      setResults(await validateParsedModelsWithProgress(parsed, idsXml, setCheckProgress));
    } catch (error) {
      setResults(null);
      setCheckError(error instanceof Error ? error.message : String(error));
    } finally {
      clearInterval(tickIntervalRef.current);
      setIsChecking(false);
      setCheckProgress(null);
      setElapsedSeconds(0);
    }
  }

  async function runExport(kind: ExportKind, target: SpecificationSummary[]) {
    if (!idsFile) return;
    setExportError(null);
    if (kind === "excel") setIsExportingExcel(true);
    if (kind === "bcf") setIsExportingBcf(true);
    try {
      if (kind === "csv") exportResultsAsCsv(target, idsFile.name, engine);
      else if (kind === "excel") await exportResultsAsExcel(target, idsFile.name, engine);
      else await exportResultsAsBcf(target, idsFile.name, engine);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExportingExcel(false);
      setIsExportingBcf(false);
    }
  }

  // A filter narrows the issue tables underneath results, not `results` itself — exporting
  // has to ask which one was meant rather than silently picking either.
  function requestExport(kind: ExportKind) {
    if (!results || !idsFile) return;
    if (filteredResults && countViolations(filteredResults) < countViolations(results)) {
      setPendingExport(kind);
      return;
    }
    void runExport(kind, results);
  }

  function handleChooseExportScope(scope: "filtered" | "all") {
    const kind = pendingExport;
    setPendingExport(null);
    const target = scope === "filtered" ? filteredResults : results;
    if (!kind || !target) return;
    void runExport(kind, target);
  }

  function handleReset() {
    setIdsFile(null);
    clearModels();
    dropStaleResults();
    setExpandedFiles(new Set());
    setResetKey((key) => key + 1);
  }

  // Each step header carries its own state, so the page can be read top to bottom
  // without opening anything: where the files stand, which rule set is loaded.
  function loadState(): { text: string; tone: "idle" | "pending" | "ready" } {
    if (models.length === 0) return { text: "No files chosen", tone: "idle" };
    const files = `${models.length} ${models.length === 1 ? "file" : "files"}`;
    if (unparsed.length > 0) return { text: `${files} · ${unparsed.length} to parse`, tone: "pending" };
    return { text: `${files} · ${engine}`, tone: "ready" };
  }

  const load = loadState();

  return (
    <section className="checker">
      <header className="checker-head">
        <h1>IFC IDS Validator</h1>
        <p className="lede">
          Check IFC building models against buildingSMART IDS (Information Delivery
          Specification) rule sets: entirely in your browser, with no server and no upload.
        </p>
        <details className="about-ids">
          <summary>What is IDS?</summary>
          <p>
            IDS (Information Delivery Specification) is a buildingSMART standard for writing
            machine-readable requirements against IFC models, for example, that every door has
            a fire rating, or every space carries a classification code. This tool loads an IDS
            file and reports, element by element, which parts of a model satisfy it and which
            don&apos;t.
          </p>
        </details>
      </header>

      <section className="step">
        <header className="step-head">
          <span className="step-no" aria-hidden="true">
            1
          </span>
          <div className="step-title">
            <h2>Load your IFC files</h2>
            <p>
              Parse them once here. Checking them against a rule set, or building one in the rule
              builder, then works from what is already in memory.
            </p>
          </div>
          <span className="step-state" data-tone={load.tone}>
            {load.text}
          </span>
        </header>

        <div className="step-body">
          <div className="control-row">
            <FileDropzone extensions={[".ifc"]} onFiles={handleIfcFiles}>
              <div className="file-field">
                <label htmlFor="local-ifc-files">IFC files</label>
                <input
                  id="local-ifc-files"
                  type="file"
                  multiple
                  accept=".ifc"
                  onChange={handleIfcFilesChange}
                />
                <p className="drop-hint">or drop .ifc files here</p>
              </div>
            </FileDropzone>
          </div>

          {models.length > 0 && (
            <div className="table-frame">
              <table className="files-table">
                <caption>IFC files</caption>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th className="num">Parse time</th>
                    <th className="num">Elements</th>
                    <th className="col-actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => {
                    const isExpanded = expandedFiles.has(model.key);
                    return (
                      <Fragment key={model.key}>
                        <tr>
                          <td>
                            <span className="file-name">{model.fileName}</span>
                            {model.errorMessage && (
                              <span className="file-error">{model.errorMessage}</span>
                            )}
                          </td>
                          <td>
                            <span className="pill" data-status={model.status}>
                              {model.status}
                            </span>
                          </td>
                          <td className="num">
                            {model.parseMs !== null ? `${Math.round(model.parseMs)} ms` : "-"}
                          </td>
                          <td className="num">
                            {model.status === "succeeded"
                              ? model.elements.length.toLocaleString()
                              : "-"}
                          </td>
                          <td className="col-actions">
                            <div className="row-actions">
                              {model.modelStructure && (
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  aria-expanded={isExpanded}
                                  aria-label={
                                    isExpanded
                                      ? `Hide structure for ${model.fileName}`
                                      : `Show structure for ${model.fileName}`
                                  }
                                  onClick={() => toggleStructureExpanded(model.key)}
                                >
                                  <span className="caret" data-open={isExpanded} aria-hidden="true">
                                    ▸
                                  </span>
                                  Structure
                                </button>
                              )}
                              <button
                                type="button"
                                className="remove-file"
                                aria-label={`Remove ${model.fileName}`}
                                disabled={isParsing}
                                onClick={() => handleRemoveIfcFile(model.key)}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && model.modelStructure && (
                          <tr className="drawer-row">
                            <td colSpan={5}>
                              <ModelStructureTree node={model.modelStructure} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="step-actions">
            <button type="button" disabled={!canParse} onClick={handleParse}>
              {isParsing ? "Parsing..." : "Parse files"}
            </button>
            <button type="button" className="secondary" disabled={isParsing} onClick={handleReset}>
              Reset
            </button>

            {!isParsing && parseRequirements.length > 0 && (
              <p className="requirement">To parse: {parseRequirements.join(", ")}.</p>
            )}
            {!isParsing && parseRequirements.length === 0 && unparsed.length === 0 && (
              <p className="requirement done">
                All {parsed.length} {parsed.length === 1 ? "file is" : "files are"} parsed with{" "}
                {engine}.
              </p>
            )}
          </div>

          {isParsing && progress && (
            <p role="status" className="progress">
              <span className="spinner" aria-hidden="true" />
              Parsing {progress.index} of {progress.total}: {progress.fileName}
              {progress.percent !== null ? ` (${Math.round(progress.percent)}%)` : ""}… ({elapsedSeconds}s
              elapsed)
            </p>
          )}
          {isParsing && (
            <button type="button" className="secondary" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="step">
        <header className="step-head">
          <span className="step-no" aria-hidden="true">
            2
          </span>
          <div className="step-title">
            <h2>Check them against a rule set</h2>
            <p>An IDS file describes what the model has to contain. Every check runs locally.</p>
          </div>
          <span className="step-state" data-tone={idsFile ? "ready" : "idle"}>
            {idsFile ? idsFile.name : "No rule set chosen"}
          </span>
        </header>

        <div className="step-body">
          <FileDropzone extensions={[".ids", ".xml"]} onFiles={(files) => handleIdsFile(files[0] ?? null)}>
            <div className="file-field">
              <label htmlFor="local-ids-file">IDS rule set (.ids or .xml)</label>
              <input
                key={`ids-${resetKey}`}
                id="local-ids-file"
                type="file"
                // An IDS document is XML, but it is normally saved as .ids — a picker
                // filtered to .xml alone hides the very files it is asking for.
                accept=".ids,.xml,application/xml,text/xml"
                onChange={(e) => handleIdsFile(e.target.files?.[0] ?? null)}
              />
              <p className="drop-hint">or drop a .ids file here</p>
            </div>
          </FileDropzone>

          <div className="example-ids">
            <p className="example-ids-label">Try an example</p>
            <div className="example-ids-row">
              {EXAMPLE_IDS_FILES.map((example) => (
                <button
                  key={example.fileName}
                  type="button"
                  className="btn ghost"
                  title={example.description}
                  disabled={loadingExample !== null}
                  onClick={() => void handleLoadExample(example)}
                >
                  {loadingExample === example.fileName ? "Loading..." : example.label}
                </button>
              ))}
            </div>
            {exampleError && <p role="alert">{exampleError}</p>}
          </div>

          <div className="step-actions">
            <button type="button" disabled={!canCheck} onClick={handleCheck}>
              {isChecking ? "Checking..." : "Check files"}
            </button>

            {!canCheck && !isChecking && checkRequirements.length > 0 && (
              <p className="requirement">To check: {checkRequirements.join(", ")}.</p>
            )}
          </div>

          {isChecking && (
            <p role="status" className="progress">
              <span className="spinner" aria-hidden="true" />
              {checkProgress
                ? `Checking ${checkProgress.index} of ${checkProgress.total}: ${checkProgress.fileName}`
                : "Reading the rule set"}
              … ({elapsedSeconds}s elapsed)
            </p>
          )}

          {checkError && <p role="alert">{checkError}</p>}
        </div>
      </section>

      {results && (
        <section className="step step-results">
          <header className="step-head">
            <span className="step-no" aria-hidden="true">
              3
            </span>
            <div className="step-title">
              <h2>Results</h2>
              <p>One row per specification. Open a specification to see the elements it failed.</p>
            </div>
          </header>

          <div className="step-body">
            <div className="step-actions">
              <button type="button" className="secondary" onClick={() => requestExport("csv")}>
                Export CSV
              </button>
              <button
                type="button"
                className="secondary"
                disabled={isExportingExcel}
                onClick={() => requestExport("excel")}
              >
                {isExportingExcel ? "Exporting..." : "Export Excel"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={isExportingBcf}
                onClick={() => requestExport("bcf")}
              >
                {isExportingBcf ? "Exporting..." : "Export BCF"}
              </button>
            </div>
            {exportError && <p role="alert">{exportError}</p>}

            <ExportScopeDialog
              open={pendingExport !== null}
              filteredCount={countViolations(filteredResults)}
              totalCount={countViolations(results)}
              onChoose={handleChooseExportScope}
              onCancel={() => setPendingExport(null)}
            />

            {/* The panel opens inside the table, under the row that was clicked, so
                reading an element never costs a trip to the bottom of the page and back. */}
            <CheckSummary
              summaries={results}
              onSelectElement={setSelectedIssue}
              selectedElementId={selectedIssue?.id ?? null}
              onViewElementIn3D={
                onFocusInViewer && ((row) => onFocusInViewer(buildElementFocusRequest(row)))
              }
              onViewSpecificationIn3D={
                onFocusInViewer &&
                ((summary) => {
                  const request = buildSpecificationFocusRequest(summary);
                  if (request) onFocusInViewer(request);
                })
              }
              onFilteredSummariesChange={setFilteredResults}
              renderDetails={(row) => (
                <div ref={detailsRef}>
                  <ElementDetails
                    element={selectedElement}
                    fileName={row.fileName}
                    onClose={() => setSelectedIssue(null)}
                  />
                </div>
              )}
            />
          </div>
        </section>
      )}
    </section>
  );
}
