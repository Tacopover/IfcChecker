// What the viewer is currently showing. Deliberately a plain value with plain
// transitions: every hide/isolate interaction, and the results-to-viewer
// navigation, is a change to this and nothing else.

/** An element is addressed by its model and its express id — ids repeat across files. */
export interface ElementRef {
  modelKey: string;
  expressId: number;
}

export interface VisibilityState {
  /** Elements the user hid one at a time. */
  hidden: ReadonlySet<string>;
  /** Whole IFC types switched off, upper-cased. Spaces start in here. */
  hiddenTypes: ReadonlySet<string>;
  /** Whole files switched off, by `LoadedModel.key`. */
  hiddenModels: ReadonlySet<string>;
  /** When set, *only* these are shown. Null means nothing is isolated. */
  isolated: ReadonlySet<string> | null;
}

/**
 * `IfcSpace` renders as a solid block filling its room, so a model that shows
 * them by default looks like a pile of boxes with the building hidden inside.
 * `IfcOpeningElement` needs no entry: it is dropped before it ever becomes an
 * element (see `classifyEntityType`), so the loader never uploads its meshes.
 */
export const DEFAULT_HIDDEN_TYPES = ["IFCSPACE"] as const;

export function refKey(ref: ElementRef): string {
  return `${ref.modelKey}#${ref.expressId}`;
}

export function initialVisibility(): VisibilityState {
  return {
    hidden: new Set(),
    hiddenTypes: new Set(DEFAULT_HIDDEN_TYPES),
    hiddenModels: new Set(),
    isolated: null,
  };
}

/**
 * Isolation is absolute: while it is active exactly the isolated elements are
 * visible, whatever else is hidden. Anything softer breaks the case it exists
 * for — isolating the elements that failed a check must show them even when
 * they are a type the user switched off, or sit in a file they collapsed.
 */
export function isVisible(
  state: VisibilityState,
  ref: ElementRef,
  ifcType: string
): boolean {
  const key = refKey(ref);
  if (state.isolated) return state.isolated.has(key);
  if (state.hiddenModels.has(ref.modelKey)) return false;
  if (state.hiddenTypes.has(ifcType.toUpperCase())) return false;
  return !state.hidden.has(key);
}

export function hideElements(state: VisibilityState, refs: readonly ElementRef[]): VisibilityState {
  const hidden = new Set(state.hidden);
  for (const ref of refs) hidden.add(refKey(ref));
  return { ...state, hidden };
}

export function showElements(state: VisibilityState, refs: readonly ElementRef[]): VisibilityState {
  const hidden = new Set(state.hidden);
  for (const ref of refs) hidden.delete(refKey(ref));
  return { ...state, hidden };
}

export function isolateElements(state: VisibilityState, refs: readonly ElementRef[]): VisibilityState {
  return { ...state, isolated: new Set(refs.map(refKey)) };
}

export function clearIsolation(state: VisibilityState): VisibilityState {
  return { ...state, isolated: null };
}

export function toggleType(state: VisibilityState, ifcType: string): VisibilityState {
  const hiddenTypes = new Set(state.hiddenTypes);
  const upper = ifcType.toUpperCase();
  if (!hiddenTypes.delete(upper)) hiddenTypes.add(upper);
  return { ...state, hiddenTypes };
}

export function toggleModel(state: VisibilityState, modelKey: string): VisibilityState {
  const hiddenModels = new Set(state.hiddenModels);
  if (!hiddenModels.delete(modelKey)) hiddenModels.add(modelKey);
  return { ...state, hiddenModels };
}

/**
 * The one control that undoes every hide at once, including the type defaults.
 * Distinct from `initialVisibility`, which is the reset the un-isolate button
 * offers: back to a fresh view, spaces out of sight again.
 */
export function showEverything(): VisibilityState {
  return { hidden: new Set(), hiddenTypes: new Set(), hiddenModels: new Set(), isolated: null };
}
