import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { EngineId } from "@ifc-qa/shared-types";
import {
  parseFile,
  validateParsedModels,
  type ParseProgress,
  type SpecificationSummary,
} from "../local/parseAndValidate.js";
import { useLoadedModels } from "../state/loadedModels.js";
import { CheckSummary } from "../components/CheckSummary";
import { ElementDetails } from "../components/ElementDetails";
import type { IssueRow } from "../components/IssueTable";
import { ModelStructureTree } from "../components/ModelStructureTree";

export function IfcCheckerPage() {
  const { models, addFiles, applyParseOutcome, removeModel, clearModels } = useLoadedModels();

  const [engine, setEngine] = useState<EngineId | "">("");
  const [idsFile, setIdsFile] = useState<File | null>(null);
  const [results, setResults] = useState<SpecificationSummary[] | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueRow | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Bumped on Reset to remount the IDS file input — clearing its React state
  // doesn't clear what the native <input type="file"> visually shows, since
  // its displayed filename isn't controlled by React. The IFC input is
  // cleared after every change instead (see handleIfcFilesChange), so it
  // doesn't need remounting.
  const [resetKey, setResetKey] = useState(0);

  // A model already parsed by a different engine counts as unparsed: switching
  // engine has to mean something, and the table must never claim results the
  // selected engine didn't produce.
  const unparsed = engine === "" ? [] : models.filter((model) => model.status !== "succeeded" || model.engine !== engine);
  const parsed = models.filter((model) => model.status === "succeeded");

  const canParse = engine !== "" && unparsed.length > 0 && !isParsing;
  const canCheck = idsFile !== null && parsed.length > 0 && !isParsing && !isChecking;

  const parseRequirements: string[] = [];
  if (engine === "") parseRequirements.push("select an engine");
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
    // canParse carries the engine !== "" check, which narrows it for parseFile below.
    if (!canParse) return;
    setIsParsing(true);
    dropStaleResults();
    setExpandedFiles(new Set());
    const targets = unparsed;
    try {
      // Sequential, not Promise.all: each file spins up its own WASM engine
      // instance (see parseWebIfcBuffer/parseIfcLiteBuffer); running many of
      // those concurrently in one tab risks memory pressure on a large batch
      // (files run to 2GB, and the batch size is the user's to choose).
      for (const [index, model] of targets.entries()) {
        clearInterval(tickIntervalRef.current);
        setProgress({ fileName: model.fileName, index: index + 1, total: targets.length });
        setElapsedSeconds(0);
        tickIntervalRef.current = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
        applyParseOutcome(model.key, await parseFile(model.file, engine));
      }
    } finally {
      clearInterval(tickIntervalRef.current);
      setIsParsing(false);
      setProgress(null);
      setElapsedSeconds(0);
    }
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

  function handleReset() {
    setEngine("");
    setIdsFile(null);
    clearModels();
    dropStaleResults();
    setExpandedFiles(new Set());
    setResetKey((key) => key + 1);
  }

  return (
    <section>
      <h1>Ifc Checker</h1>
      <p>Parse and validate IFC files entirely in your browser — no server, no upload.</p>

      <h2>1. Load your IFC files</h2>
      <p>
        Parse them once here. Checking them against a rule set, or building one in the rule builder,
        then works from what is already in memory.
      </p>

      <fieldset>
        <legend>Engine</legend>
        <label>
          <input
            type="radio"
            name="local-engine"
            value="web-ifc"
            checked={engine === "web-ifc"}
            onChange={() => setEngine("web-ifc")}
          />
          web-ifc
        </label>
        <label>
          <input
            type="radio"
            name="local-engine"
            value="ifc-lite"
            checked={engine === "ifc-lite"}
            onChange={() => setEngine("ifc-lite")}
          />
          ifc-lite
        </label>
      </fieldset>

      <label htmlFor="local-ifc-files">IFC files</label>
      <input id="local-ifc-files" type="file" multiple accept=".ifc" onChange={handleIfcFilesChange} />

      {models.length > 0 && (
        <table>
          <caption>IFC files</caption>
          <thead>
            <tr>
              <th>File</th>
              <th>Status</th>
              <th>Parse time (ms)</th>
              <th>Elements</th>
              <th>Error</th>
              <th>Structure</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => {
              const isExpanded = expandedFiles.has(model.key);
              return (
                <Fragment key={model.key}>
                  <tr>
                    <td>{model.fileName}</td>
                    <td>{model.status}</td>
                    <td>{model.parseMs !== null ? Math.round(model.parseMs) : "—"}</td>
                    <td>{model.status === "succeeded" ? model.elements.length : "—"}</td>
                    <td>{model.errorMessage ?? ""}</td>
                    <td>
                      {model.modelStructure && (
                        <button
                          type="button"
                          className="secondary"
                          aria-expanded={isExpanded}
                          onClick={() => toggleStructureExpanded(model.key)}
                        >
                          {isExpanded
                            ? `Hide structure for ${model.fileName}`
                            : `Show structure for ${model.fileName}`}
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="remove-file"
                        aria-label={`Remove ${model.fileName}`}
                        disabled={isParsing}
                        onClick={() => handleRemoveIfcFile(model.key)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                  {isExpanded && model.modelStructure && (
                    <tr>
                      <td colSpan={7}>
                        <ModelStructureTree node={model.modelStructure} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      <button type="button" disabled={!canParse} onClick={handleParse}>
        {isParsing ? "Parsing..." : "Parse files"}
      </button>{" "}
      <button type="button" className="secondary" disabled={isParsing} onClick={handleReset}>
        Reset
      </button>

      {!isParsing && parseRequirements.length > 0 && <p>To parse: {parseRequirements.join(", ")}.</p>}
      {!isParsing && parseRequirements.length === 0 && unparsed.length === 0 && (
        <p>
          All {parsed.length} {parsed.length === 1 ? "file is" : "files are"} parsed with {engine}.
        </p>
      )}

      {isParsing && progress && (
        <p role="status">
          Parsing {progress.index} of {progress.total}: {progress.fileName}… ({elapsedSeconds}s elapsed)
        </p>
      )}

      <h2>2. Check them against a rule set</h2>

      <label htmlFor="local-ids-file">IDS rule set (XML)</label>
      <input
        key={`ids-${resetKey}`}
        id="local-ids-file"
        type="file"
        accept=".xml"
        onChange={(e) => {
          setIdsFile(e.target.files?.[0] ?? null);
          dropStaleResults();
        }}
      />

      <button type="button" disabled={!canCheck} onClick={handleCheck}>
        {isChecking ? "Checking..." : "Check files"}
      </button>

      {!canCheck && !isChecking && checkRequirements.length > 0 && (
        <p>To check: {checkRequirements.join(", ")}.</p>
      )}

      {checkError && <p role="alert">{checkError}</p>}

      {results && (
        <>
          <h2>Results</h2>
          <CheckSummary
            summaries={results}
            onSelectElement={setSelectedIssue}
            selectedElementId={selectedIssue?.id ?? null}
          />

          {selectedIssue && (
            <div ref={detailsRef}>
              <ElementDetails
                element={selectedElement}
                fileName={selectedIssue.fileName}
                onClose={() => setSelectedIssue(null)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
