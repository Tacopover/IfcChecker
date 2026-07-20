import type { ElementResult, Severity } from "@ifc-qa/shared-types";

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
};

export function sortResults<T extends ElementResult & { fileName: string }>(
  results: T[]
): T[] {
  return [...results].sort((a, b) => {
    if (a.fileName !== b.fileName) {
      return a.fileName.localeCompare(b.fileName);
    }
    if (a.severity !== b.severity) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    return a.elementType.localeCompare(b.elementType);
  });
}
