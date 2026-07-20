import type {
  CreateRunResponse,
  EngineId,
  RuleSetSummary,
  RunResultsResponse,
  RunStatusResponse,
} from "@ifc-qa/shared-types";
import type { RunListResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchRuleSets(): Promise<RuleSetSummary[]> {
  const res = await fetch(`${API_BASE}/rule-sets`);
  return parseJsonOrThrow<RuleSetSummary[]>(res);
}

export async function createRuleSet(file: File, name: string): Promise<RuleSetSummary> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  const res = await fetch(`${API_BASE}/rule-sets`, { method: "POST", body: form });
  return parseJsonOrThrow<RuleSetSummary>(res);
}

export interface CreateRunParams {
  files: File[];
  ruleSetId: string;
  engine: EngineId;
}

export async function createRun(params: CreateRunParams): Promise<CreateRunResponse> {
  const form = new FormData();
  // ruleSetId/engine MUST be appended before the file parts — the sub-plan 04
  // POST /runs handler reads multipart parts as a stream and 400s if either
  // field arrives after the first file part.
  form.append("ruleSetId", params.ruleSetId);
  form.append("engine", params.engine);
  for (const file of params.files) {
    form.append("files", file);
  }
  const res = await fetch(`${API_BASE}/runs`, { method: "POST", body: form });
  return parseJsonOrThrow<CreateRunResponse>(res);
}

export async function fetchRunStatus(runId: string): Promise<RunStatusResponse> {
  const res = await fetch(`${API_BASE}/runs/${runId}/status`);
  return parseJsonOrThrow<RunStatusResponse>(res);
}

export async function fetchRunResults(runId: string): Promise<RunResultsResponse> {
  const res = await fetch(`${API_BASE}/runs/${runId}/results`);
  return parseJsonOrThrow<RunResultsResponse>(res);
}

export function reportDownloadUrl(runId: string, format: "pdf" | "xlsx"): string {
  return `${API_BASE}/runs/${runId}/report.${format}`;
}

// ASSUMED endpoint. See "Dependency Notes for Orchestration" / gap flag at
// the top of this plan: GET /runs is not part of the confirmed sub-plan 04
// API contract. Sub-plan 07 must add it server-side (or this function and
// RunHistoryPage must be redesigned) once sub-plan 04's owner weighs in.
export async function fetchRunList(): Promise<RunListResponse> {
  const res = await fetch(`${API_BASE}/runs`);
  return parseJsonOrThrow<RunListResponse>(res);
}
