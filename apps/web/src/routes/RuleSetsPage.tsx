import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRuleSet, fetchRuleSets } from "../api/client";

export function RuleSetsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const ruleSetsQuery = useQuery({
    queryKey: ["rule-sets"],
    queryFn: fetchRuleSets,
  });

  const uploadMutation = useMutation({
    mutationFn: () => createRuleSet(file as File, name),
    onSuccess: () => {
      setName("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["rule-sets"] });
    },
  });

  const canSubmit = name.trim() !== "" && file !== null && !uploadMutation.isPending;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    uploadMutation.mutate();
  }

  return (
    <section>
      <h1>Rule Sets</h1>

      <ul aria-label="Existing rule sets">
        {ruleSetsQuery.data?.map((ruleSet) => (
          <li key={ruleSet.id}>
            <span>{ruleSet.name}</span> — uploaded {new Date(ruleSet.uploadedAt).toLocaleDateString()}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} aria-label="Upload rule set">
        <label htmlFor="rule-set-name">Name</label>
        <input id="rule-set-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="rule-set-file">IDS XML file</label>
        <input
          id="rule-set-file"
          type="file"
          accept=".xml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {uploadMutation.isError && <p role="alert">{(uploadMutation.error as Error).message}</p>}

        <button type="submit" disabled={!canSubmit}>
          {uploadMutation.isPending ? "Uploading..." : "Upload rule set"}
        </button>
      </form>
    </section>
  );
}
