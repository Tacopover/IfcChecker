import type { ElementResult } from "@ifc-qa/shared-types";

export interface RunReportData {
  runId: string;
  ruleSetName: string;
  engine: "web-ifc" | "ifc-lite";
  generatedAt: string; // ISO timestamp
  results: Array<ElementResult & { fileName: string }>;
}
