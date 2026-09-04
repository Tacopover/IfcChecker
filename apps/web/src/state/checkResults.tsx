import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SpecificationSummary } from "../local/parseAndValidate.js";

// What the last check produced, lifted out of the Validate page because the
// viewer needs the same list: a result is a set of GlobalIds, and the whole
// point of the 3D page is to show where they are. Kept separate from
// LoadedModelsProvider — that owns the files, this owns what was asked of them,
// and a new rule set replaces one without touching the other.

interface CheckResultsValue {
  /** Null before any check has been run, which is not the same as a check that found nothing. */
  results: SpecificationSummary[] | null;
  setResults: (results: SpecificationSummary[] | null) => void;
}

const CheckResultsContext = createContext<CheckResultsValue | null>(null);

export function CheckResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<SpecificationSummary[] | null>(null);
  const value = useMemo(() => ({ results, setResults }), [results]);
  return <CheckResultsContext.Provider value={value}>{children}</CheckResultsContext.Provider>;
}

export function useCheckResults(): CheckResultsValue {
  const value = useContext(CheckResultsContext);
  if (!value) throw new Error("useCheckResults must be used inside a CheckResultsProvider");
  return value;
}
