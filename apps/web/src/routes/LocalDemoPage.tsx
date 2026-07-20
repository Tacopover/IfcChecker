import { useState, type ChangeEvent } from "react";
import type { EngineId } from "@ifc-qa/shared-types";
import { parseAndValidateFiles, type LocalFileOutcome } from "../local/parseAndValidate.js";
import { IssueTable } from "../components/IssueTable";

const MAX_FILES = 20;

export function LocalDemoPage() {
  const [engine, setEngine] = useState<EngineId | "">("");
  const [idsFile, setIdsFile] = useState<File | null>(null);
  const [ifcFiles, setIfcFiles] = useState<File[]>([]);
  const [outcomes, setOutcomes] = useState<LocalFileOutcome[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  // Bumped on Reset to remount the two file inputs — clearing their React
  // state doesn't clear what the native <input type="file"> visually shows,
  // since its displayed filename isn't controlled by React.
  const [resetKey, setResetKey] = useState(0);

  const tooManyFiles = ifcFiles.length > MAX_FILES;
  const canRun = engine !== "" && idsFile !== null && ifcFiles.length > 0 && !tooManyFiles && !isRunning;

  const missingRequirements: string[] = [];
  if (engine === "") missingRequirements.push("select an engine");
  if (idsFile === null) missingRequirements.push("choose an IDS rule set file");
  if (ifcFiles.length === 0) missingRequirements.push("choose at least one IFC file");

  function handleIfcFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setIfcFiles(Array.from(event.target.files ?? []));
  }

  async function handleRun() {
    if (!canRun) return;
    setIsRunning(true);
    setRunError(null);
    try {
      const idsXml = await idsFile.text();
      const results = await parseAndValidateFiles(ifcFiles, idsXml, engine);
      setOutcomes(results);
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
    setResetKey((key) => key + 1);
  }

  const allResults = outcomes?.flatMap((outcome) => outcome.results) ?? [];

  return (
    <section>
      <h1>Local Demo</h1>
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
      <input
        key={`ifc-${resetKey}`}
        id="local-ifc-files"
        type="file"
        multiple
        accept=".ifc"
        onChange={handleIfcFilesChange}
      />
      {tooManyFiles && (
        <p role="alert">
          Select up to {MAX_FILES} files ({ifcFiles.length} selected).
        </p>
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
              </tr>
            </thead>
            <tbody>
              {outcomes.map((outcome) => (
                <tr key={outcome.fileName}>
                  <td>{outcome.fileName}</td>
                  <td>{outcome.status}</td>
                  <td>{outcome.parseMs !== null ? Math.round(outcome.parseMs) : "—"}</td>
                  <td>{outcome.elementCount}</td>
                  <td>{outcome.errorMessage ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Issues</h2>
          <IssueTable results={allResults} />
        </>
      )}
    </section>
  );
}
