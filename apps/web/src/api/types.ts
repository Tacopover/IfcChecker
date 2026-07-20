import type { EngineId, RunStatus } from "@ifc-qa/shared-types";

// ASSUMED types for the ASSUMED GET /runs endpoint — see the gap flagged in
// this plan's "Dependency Notes for Orchestration" section. Shape follows
// the existing summary DTO pattern (RuleSetSummary/FileJobSummary) already
// defined in @ifc-qa/shared-types.
export interface RunSummary {
  id: string;
  status: RunStatus;
  engine: EngineId;
  ruleSetId: string;
  createdAt: string;
  fileCount: number;
}

export interface RunListResponse {
  runs: RunSummary[];
}
