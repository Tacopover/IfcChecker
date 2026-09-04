// Federated files can share expressId numbers — each IFC file numbers its own
// entities starting near 1. The renderer's hidden/isolated/selected sets are a
// flat Set<number> with no per-id model scoping, so this module hands out a
// disjoint numeric range per model and offsets every id into it before it
// reaches the renderer, translating results back on the way out.

/**
 * Numeric ids-per-model ceiling. meshMapping.ts's pick-colour comment
 * documents 24 bits (~16.7M) as "well past the 14 M entities of the largest
 * file the pipeline documents" — this stays comfortably under that headroom
 * while leaving room for a model larger than any seen so far.
 */
const MODEL_ID_SPACE = 20_000_000;

export interface ModelRef {
  modelKey: string;
  expressId: number;
}

/**
 * One instance per `ViewerCanvas` mount, not a module singleton — a singleton
 * would leak offsets across unrelated `ViewerPage` mounts and tests.
 */
export class ModelFederation {
  private readonly offsets = new Map<string, number>();
  private nextIndex = 0;

  /** Assigns a fresh offset the first time a modelKey is seen, then returns the same one. */
  offsetFor(modelKey: string): number {
    let offset = this.offsets.get(modelKey);
    if (offset === undefined) {
      offset = this.nextIndex * MODEL_ID_SPACE;
      this.offsets.set(modelKey, offset);
      this.nextIndex += 1;
    }
    return offset;
  }

  toGlobalId(modelKey: string, expressId: number): number {
    return this.offsetFor(modelKey) + expressId;
  }

  /** Null when the global id belongs to no currently-registered model. */
  fromGlobalId(globalId: number): ModelRef | null {
    for (const [modelKey, offset] of this.offsets) {
      if (globalId >= offset && globalId < offset + MODEL_ID_SPACE) {
        return { modelKey, expressId: globalId - offset };
      }
    }
    return null;
  }

  /**
   * Forgets the model's offset. A later reload gets a NEW offset — offsets
   * are never reused — so a pick/hover result still in flight from before the
   * unload can never be misread as belonging to whatever loads next.
   */
  removeModel(modelKey: string): void {
    this.offsets.delete(modelKey);
  }
}
