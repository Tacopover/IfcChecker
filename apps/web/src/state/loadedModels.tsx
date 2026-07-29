import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { EngineId, ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";

// The one place a chosen IFC file lives. Both pages read from here: the
// validate page parses files into it and checks them against a rule set, the
// rule builder picks one of the already-parsed models as its worked example.
// Parsing is the expensive step, so a file is parsed once and its elements are
// kept — checking against a second rule set, or switching to the builder,
// costs nothing.
export interface LoadedModel {
  key: string;
  file: File;
  fileName: string;
  status: "pending" | "succeeded" | "failed";
  /** The engine the elements below came out of — null while still pending. */
  engine: EngineId | null;
  parseMs: number | null;
  errorMessage: string | null;
  elements: NormalizedElement[];
  modelStructure: ModelStructureNode | null;
}

/** Name alone isn't identity: two files can share it, and the same file re-picked must not duplicate. */
export function modelKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export type ParseOutcome = Pick<
  LoadedModel,
  "status" | "engine" | "parseMs" | "errorMessage" | "elements" | "modelStructure"
>;

interface LoadedModelsValue {
  models: LoadedModel[];
  /** Appends files that aren't already in the list, as pending. */
  addFiles: (files: File[]) => void;
  applyParseOutcome: (key: string, outcome: ParseOutcome) => void;
  removeModel: (key: string) => void;
  clearModels: () => void;
}

const LoadedModelsContext = createContext<LoadedModelsValue | null>(null);

export function LoadedModelsProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<LoadedModel[]>([]);

  const addFiles = useCallback((files: File[]) => {
    setModels((previous) => {
      const known = new Set(previous.map((model) => model.key));
      const added = files
        .filter((file) => !known.has(modelKey(file)))
        .map<LoadedModel>((file) => ({
          key: modelKey(file),
          file,
          fileName: file.name,
          status: "pending",
          engine: null,
          parseMs: null,
          errorMessage: null,
          elements: [],
          modelStructure: null,
        }));
      return added.length === 0 ? previous : [...previous, ...added];
    });
  }, []);

  const applyParseOutcome = useCallback((key: string, outcome: ParseOutcome) => {
    setModels((previous) =>
      previous.map((model) => (model.key === key ? { ...model, ...outcome } : model))
    );
  }, []);

  const removeModel = useCallback((key: string) => {
    setModels((previous) => previous.filter((model) => model.key !== key));
  }, []);

  const clearModels = useCallback(() => setModels([]), []);

  const value = useMemo(
    () => ({ models, addFiles, applyParseOutcome, removeModel, clearModels }),
    [models, addFiles, applyParseOutcome, removeModel, clearModels]
  );

  return <LoadedModelsContext.Provider value={value}>{children}</LoadedModelsContext.Provider>;
}

export function useLoadedModels(): LoadedModelsValue {
  const value = useContext(LoadedModelsContext);
  if (!value) throw new Error("useLoadedModels must be used inside a LoadedModelsProvider");
  return value;
}
