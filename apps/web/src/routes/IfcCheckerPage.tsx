import { Fragment, useState, type ChangeEvent } from "react";
import type { EngineId } from "@ifc-qa/shared-types";
import { parseAndValidateFiles, type LocalFileOutcome } from "../local/parseAndValidate.js";
import { IssueTable } from "../components/IssueTable";
import { ModelStructureTree } from "../components/ModelStructureTree";

const MAX_FILES = 20;

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function IfcCheckerPage() {
  const [engine, setEngine] = useState<EngineId | "">("");
  const [idsFile, setIdsFile] = useState<File | null>(null);
  const [ifcFiles, setIfcFiles] = useState<File[]>([]);
  const [outcomes, setOutcomes] = useState<LocalFileOutcome[] | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  // Bumped on Reset to remount the IDS file input — clearing its React state
  // doesn't clear what the native <input type="file"> visually shows, since
  // its displayed filename isn't controlled by React. The IFC input is
  // cleared after every change instead (see handleIfcFilesChange), so it
  // doesn't need remounting.
  const [resetKey, setResetKey] = useState(0);

  const tooManyFiles = ifcFiles.length > MAX_FILES;
  const canRun = engine !== "" && idsFile !== null && ifcFiles.length > 0 && !tooManyFiles && !isRunning;

  const missingRequirements: string[] = [];
  if (engine === "") missingRequirements.push("select an engine");
  if (idsFile === null) missingRequirements.push("choose an IDS rule set file");
  if (ifcFiles.length === 0) missingRequirements.push("choose at least one IFC file");

  function handleIfcFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(event.target.files ?? []);
    setIfcFiles((prev) => {
      const existingKeys = new Set(prev.map(fileKey));
      return [...prev, ...newFiles.filter((file) => !existingKeys.has(fileKey(file)))];
    });
    // Clear the input so picking files again adds to the list instead of
    // being a no-op (the browser won't fire onChange for a repeat selection).
    event.target.value = "";
  }

  function handleRemoveIfcFile(key: string) {
    setIfcFiles((prev) => prev.filter((file) => fileKey(file) !== key));
  }

  function toggleStructureExpanded(fileName: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  }

  async function handleRun() {
    if (!canRun) return;
    setIsRunning(true);
    setRunError(null);
    try {
      const idsXml = await idsFile.text();
      const results = await parseAndValidateFiles(ifcFiles, idsXml, engine);
      setOutcomes(results);
      setExpandedFiles(new Set());
    } catch (error) {
      setOutcomes(null);
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunning(false);
    }
  }

  function handleReset() {
    setEngine("");
    setIdsFile(null);
    setIfcFiles([]);
    setOutcomes(null);
    setRunError(null);
    setExpandedFiles(new Set());
    setResetKey((key) => key + 1);
  }

  const allResults = outcomes?.flatMap((outcome) => outcome.results) ?? [];

  return (
    <section>
      <h1>Ifc Checker</h1>
      <p>Parse and validate IFC files entirely in your browser — no server, no upload.</p>

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

      <label htmlFor="local-ids-file">IDS rule set (XML)</label>
      <input
        key={`ids-${resetKey}`}
        id="local-ids-file"
        type="file"
        accept=".xml"
        onChange={(e) => setIdsFile(e.target.files?.[0] ?? null)}
      />

      <label htmlFor="local-ifc-files">IFC files (up to {MAX_FILES})</label>
      <input id="local-ifc-files" type="file" multiple accept=".ifc" onChange={handleIfcFilesChange} />
      {tooManyFiles && (
        <p role="alert">
          Select up to {MAX_FILES} files ({ifcFiles.length} selected).
        </p>
      )}

      {ifcFiles.length > 0 && (
        <ul aria-label="Selected IFC files">
          {ifcFiles.map((file) => {
            const key = fileKey(file);
            return (
              <li key={key}>
                <span>{file.name}</span>
                <button
                  type="button"
                  className="remove-file"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => handleRemoveIfcFile(key)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" disabled={!canRun} onClick={handleRun}>
        {isRunning ? "Parsing..." : "Parse & validate"}
      </button>{" "}
      <button type="button" className="secondary" disabled={isRunning} onClick={handleReset}>
        Reset
      </button>

      {!canRun && !isRunning && !tooManyFiles && missingRequirements.length > 0 && (
        <p>To run: {missingRequirements.join(", ")}.</p>
      )}

      {runError && <p role="alert">{runError}</p>}

      {outcomes && (
        <>
          <h2>File results</h2>
          <table>
            <caption>File results</caption>
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Parse time (ms)</th>
                <th>Elements</th>
                <th>Error</th>
                <th>Structure</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((outcome) => {
                const isExpanded = expandedFiles.has(outcome.fileName);
                return (
                  <Fragment key={outcome.fileName}>
                    <tr>
                      <td>{outcome.fileName}</td>
                      <td>{outcome.status}</td>
                      <td>{outcome.parseMs !== null ? Math.round(outcome.parseMs) : "—"}</td>
                      <td>{outcome.elementCount}</td>
                      <td>{outcome.errorMessage ?? ""}</td>
                      <td>
                        {outcome.modelStructure && (
                          <button
                            type="button"
                            className="secondary"
                            aria-expanded={isExpanded}
                            onClick={() => toggleStructureExpanded(outcome.fileName)}
                          >
                            {isExpanded
                              ? `Hide structure for ${outcome.fileName}`
                              : `Show structure for ${outcome.fileName}`}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && outcome.modelStructure && (
                      <tr>
                        <td colSpan={6}>
                          <ModelStructureTree node={outcome.modelStructure} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <h2>Issues</h2>
          <IssueTable results={allResults} />
        </>
      )}
    </section>
  );
}
