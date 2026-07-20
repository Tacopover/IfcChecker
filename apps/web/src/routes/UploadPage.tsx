import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { EngineId } from "@ifc-qa/shared-types";
import { createRun, fetchRuleSets } from "../api/client";

const MAX_FILES = 20;

export function UploadPage() {
  const navigate = useNavigate();
  const [ruleSetId, setRuleSetId] = useState("");
  const [engine, setEngine] = useState<EngineId | "">("");
  const [files, setFiles] = useState<File[]>([]);

  const ruleSetsQuery = useQuery({
    queryKey: ["rule-sets"],
    queryFn: fetchRuleSets,
  });

  const createRunMutation = useMutation({
    mutationFn: createRun,
    onSuccess: (data) => {
      navigate(`/runs/${data.runId}`);
    },
  });

  const tooManyFiles = files.length > MAX_FILES;
  const canSubmit =
    ruleSetId !== "" && engine !== "" && files.length > 0 && !tooManyFiles && !createRunMutation.isPending;

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    createRunMutation.mutate({ files, ruleSetId, engine });
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Start a new QA run">
      <h1>Upload IFC Files</h1>

      <label htmlFor="rule-set-select">Rule set</label>
      <select id="rule-set-select" value={ruleSetId} onChange={(e) => setRuleSetId(e.target.value)}>
        <option value="">Select a rule set</option>
        {ruleSetsQuery.data?.map((ruleSet) => (
          <option key={ruleSet.id} value={ruleSet.id}>
            {ruleSet.name}
          </option>
        ))}
      </select>

      <fieldset>
        <legend>Engine</legend>
        <label>
          <input
            type="radio"
            name="engine"
            value="web-ifc"
            checked={engine === "web-ifc"}
            onChange={() => setEngine("web-ifc")}
          />
          web-ifc
        </label>
        <label>
          <input
            type="radio"
            name="engine"
            value="ifc-lite"
            checked={engine === "ifc-lite"}
            onChange={() => setEngine("ifc-lite")}
          />
          ifc-lite
        </label>
      </fieldset>

      <label htmlFor="ifc-files-input">IFC files (up to {MAX_FILES})</label>
      <input id="ifc-files-input" type="file" multiple accept=".ifc" onChange={handleFilesChange} />
      {tooManyFiles && (
        <p role="alert">
          Select up to {MAX_FILES} files ({files.length} selected).
        </p>
      )}

      {createRunMutation.isError && <p role="alert">{(createRunMutation.error as Error).message}</p>}

      <button type="submit" disabled={!canSubmit}>
        {createRunMutation.isPending ? "Creating run..." : "Start run"}
      </button>
    </form>
  );
}
