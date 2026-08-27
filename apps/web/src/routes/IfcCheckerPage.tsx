import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { EngineId } from "@ifc-qa/shared-types";
import {
  parseFile,
  validateParsedModels,
  type ParseProgress,
  type SpecificationSummary,
} from "../local/parseAndValidate.js";
import { useLoadedModels } from "../state/loadedModels.js";
import { parseWorkerClient } from "../local/parseWorkerClient.js";
import { exportResultsAsBcf, exportResultsAsCsv, exportResultsAsExcel } from "../local/exportResults.js";
import { CheckSummary } from "../components/CheckSummary";
import { ElementDetails } from "../components/ElementDetails";
import type { IssueRow } from "../components/IssueTable";
import { ModelStructureTree } from "../components/ModelStructureTree";

export function IfcCheckerPage() {
  const { models, addFiles, applyParseOutcome, removeModel, clearModels } = useLoadedModels();

  // ifc-lite is faster and more robust than web-ifc, so it's the only engine offered.
  const engine: EngineId = "ifc-lite";
  const [idsFile, setIdsFile] = useState<File | null>(null);
  const [results, setResults] = useState<SpecificationSummary[] | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueRow | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingBcf, setIsExportingBcf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
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
    setSelectedIssue(null);
    setCheckError(null);
    setExportError(null);
  }

  function handleIfcFilesChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    dropStaleResults();
    // Clear the input so picking files again adds to the list instead of
    // being a no-op (the browser won't fire onChange for a repeat selection).
    event.target.value = "";
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
    try {
      const idsXml = await idsFile.text();
      setResults(validateParsedModels(parsed, idsXml));
    } catch (error) {
      setResults(null);
      setCheckError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsChecking(false);
    }
  }

  function handleExportCsv() {
    if (!results || !idsFile) return;
    setExportError(null);
    try {
      exportResultsAsCsv(results, idsFile.name, engine);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExportExcel() {
    if (!results || !idsFile) return;
    setExportError(null);
    setIsExportingExcel(true);
    try {
      await exportResultsAsExcel(results, idsFile.name, engine);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExportingExcel(false);
    }
  }

  async function handleExportBcf() {
    if (!results || !idsFile) return;
    setExportError(null);
    setIsExportingBcf(true);
    try {
      await exportResultsAsBcf(results, idsFile.name, engine);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExportingBcf(false);
    }
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
        <h1>IFC Checker</h1>
        <p className="lede">
          Parse and validate IFC files entirely in your browser — no server, no upload.
        </p>
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
            <div className="file-field">
              <label htmlFor="local-ifc-files">IFC files</label>
              <input
                id="local-ifc-files"
                type="file"
                multiple
                accept=".ifc"
                onChange={handleIfcFilesChange}
              />
            </div>
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
                            {model.parseMs !== null ? `${Math.round(model.parseMs)} ms` : "—"}
                          </td>
                          <td className="num">
                            {model.status === "succeeded"
                              ? model.elements.length.toLocaleString()
                              : "—"}
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
          <div className="file-field">
            <label htmlFor="local-ids-file">IDS rule set (.ids or .xml)</label>
            <input
              key={`ids-${resetKey}`}
              id="local-ids-file"
              type="file"
              // An IDS document is XML, but it is normally saved as .ids — a picker
              // filtered to .xml alone hides the very files it is asking for.
              accept=".ids,.xml,application/xml,text/xml"
              onChange={(e) => {
                setIdsFile(e.target.files?.[0] ?? null);
                dropStaleResults();
              }}
            />
          </div>

          <div className="step-actions">
            <button type="button" disabled={!canCheck} onClick={handleCheck}>
              {isChecking ? "Checking..." : "Check files"}
            </button>

            {!canCheck && !isChecking && checkRequirements.length > 0 && (
              <p className="requirement">To check: {checkRequirements.join(", ")}.</p>
            )}
          </div>

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
              <button type="button" className="secondary" onClick={handleExportCsv}>
                Export CSV
              </button>
              <button
                type="button"
                className="secondary"
                disabled={isExportingExcel}
                onClick={handleExportExcel}
              >
                {isExportingExcel ? "Exporting..." : "Export Excel"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={isExportingBcf}
                onClick={handleExportBcf}
              >
                {isExportingBcf ? "Exporting..." : "Export BCF"}
              </button>
            </div>
            {exportError && <p role="alert">{exportError}</p>}

            {/* The panel opens inside the table, under the row that was clicked, so
                reading an element never costs a trip to the bottom of the page and back. */}
            <CheckSummary
              summaries={results}
              onSelectElement={setSelectedIssue}
              selectedElementId={selectedIssue?.id ?? null}
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
