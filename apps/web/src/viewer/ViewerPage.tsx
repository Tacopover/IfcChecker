import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { NormalizedValue } from "@ifc-qa/shared-types";
import type { IssueRow } from "../components/IssueTable";
import { useCheckResults } from "../state/checkResults";
import { useLoadedModels } from "../state/loadedModels";
import { emptyBounds, isEmptyBounds, robustBounds, unionBounds, type Bounds } from "./bounds.js";
import {
  buildSpecificationFocusRequest,
  resolveFocusElements,
  type FocusMode,
  type ViewerFocusRequest,
} from "./focusRequest.js";
import {
  createGeometryProcessor,
  GeometryLoadAbortedError,
  streamModelGeometry,
} from "./geometryLoader.js";
import {
  boundsOfElements,
  elementBoundsList,
  mapMeshesToElements,
  type MeshMapping,
  type ViewerMesh,
} from "./meshMapping.js";
import {
  moveSectionFace,
  sectionBoxFromBounds,
  type SectionAxis,
  type SectionBox,
} from "./sectionBox.js";
import { ViewerCanvas, type ViewerCanvasHandle } from "./ViewerCanvas";
import { ViewerOverlay } from "./ViewerOverlay";
import { ViewerResultsRail } from "./ViewerResultsRail";
import { ViewerTreeRail } from "./ViewerTreeRail";
import { buildViewerTree, collectElementIds, type ViewerTreeNode } from "./viewerTree.js";
import {
  clearHighlight,
  clearIsolation,
  hideElements,
  highlightElements,
  initialVisibility,
  isolateElements,
  refKey,
  showElements,
  showEverything,
  toggleModel,
  visibilityCode,
  type ElementRef,
} from "./visibility.js";

// Geometry is loaded per model and can be given back: several federated 1.6 GB
// models cannot all hold mesh buffers alongside a live WebGL context, so the
// always-mounted pattern the other two pages use does not extend here.

/**
 * A property slot carries `{ value, dataType?, unit?, values? }`, not a raw
 * scalar — `.value` is already the parser's display string even for a
 * multi-valued property (see NormalizedValueSchema's own comment), so `.values`
 * needs no separate handling here.
 */
function formatPropertyValue(slot: NormalizedValue): string {
  if (slot.value === null || slot.value === "") return "—";
  if (typeof slot.value === "boolean") return slot.value ? "true" : "false";
  return slot.unit ? `${slot.value} ${slot.unit}` : String(slot.value);
}

interface LoadedGeometry {
  mapping: MeshMapping;
  /** Everything the model contains — what the section box has to be able to clip. */
  bounds: Bounds;
  /**
   * The same model with elements stranded far from the rest left out. Framing
   * uses this and the section box does not: an abandoned proxy at the project
   * origin should not decide where the camera goes, but it must still be
   * reachable by dragging a clip face out to it.
   */
  framingBounds: Bounds;
  meshCount: number;
  skippedExpressIds: number[];
}

export interface ViewerPageProps {
  /** Set once by the Validate page's "View in 3D" affordance, consumed here and then cleared. */
  pendingFocus: ViewerFocusRequest | null;
  onConsumeFocus: () => void;
}

export function ViewerPage({ pendingFocus, onConsumeFocus }: ViewerPageProps) {
  const { models } = useLoadedModels();
  const { results } = useCheckResults();
  const canvasRef = useRef<ViewerCanvasHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Which activeFocus instance the isolate/highlight action below has already
  // been applied for — the effect that applies it must run once per focus,
  // not every time `geometry` changes for an unrelated reason.
  const appliedFocusRef = useRef<ViewerFocusRequest | null>(null);

  // Rail and properties panel widths, drag-resizable at the boundary with the
  // canvas. Holds only the drag in progress — not persisted, per the ask.
  const [railWidth, setRailWidth] = useState(320);
  const [propertiesWidth, setPropertiesWidth] = useState(288);
  const columnResizeRef = useRef<{
    startX: number;
    startWidth: number;
    apply: (width: number) => void;
    sign: 1 | -1;
    min: number;
    max: number;
  } | null>(null);

  const beginColumnResize = useCallback(
    (apply: (width: number) => void, startWidth: number, sign: 1 | -1, min: number, max: number) =>
      (event: ReactPointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        columnResizeRef.current = { startX: event.clientX, startWidth, apply, sign, min, max };
        document.body.classList.add("col-resizing");
      },
    []
  );

  const onColumnResizeMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = columnResizeRef.current;
    if (!drag) return;
    const next = drag.startWidth + drag.sign * (event.clientX - drag.startX);
    drag.apply(Math.min(drag.max, Math.max(drag.min, next)));
  }, []);

  const endColumnResize = useCallback(() => {
    columnResizeRef.current = null;
    document.body.classList.remove("col-resizing");
  }, []);

  const [visibility, setVisibility] = useState(initialVisibility);
  const [section, setSection] = useState<SectionBox | null>(null);
  const [selection, setSelection] = useState<ElementRef | null>(null);
  const [geometry, setGeometry] = useState<Record<string, LoadedGeometry>>({});
  const [busyModelKey, setBusyModelKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [activeModelKey, setActiveModelKey] = useState<string | null>(null);
  const [activeFocus, setActiveFocus] = useState<ViewerFocusRequest | null>(null);
  const [activeFocusExpressIds, setActiveFocusExpressIds] = useState<number[]>([]);
  const [focusAlert, setFocusAlert] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("isolate");
  // How the *next* focus to be resolved should be shown. Arriving from the
  // Validate page isolates, because that navigation asked to be taken to those
  // elements; opening a specification in the rail highlights, because the model
  // around it is the context that makes "where is this" answerable.
  const [requestedFocusMode, setRequestedFocusMode] = useState<FocusMode>("isolate");

  const [rail, setRail] = useState<"models" | "results">("models");
  const [openSpecIndex, setOpenSpecIndex] = useState<number | null>(null);
  const [activeSpecIndex, setActiveSpecIndex] = useState<number | null>(null);

  const parsedModels = useMemo(
    () => models.filter((model) => model.status === "succeeded"),
    [models]
  );
  const activeModel = parsedModels.find((model) => model.key === activeModelKey) ?? parsedModels[0] ?? null;

  // The browser check has to drive a frame and read it back, and neither is
  // reachable from the DOM. requestAnimationFrame is starved under the
  // harness's virtual time budget — measured at three frames in two seconds —
  // so the hook is a synchronous draw rather than anything that waits.
  useEffect(() => {
    if (!Array.isArray((window as { __smokeErrors?: unknown }).__smokeErrors)) return;
    Object.assign(window, { __viewer: canvasRef });
    return () => {
      delete (window as { __viewer?: unknown }).__viewer;
    };
  }, []);

  const tree = useMemo(
    () =>
      buildViewerTree(
        parsedModels.map((model) => ({
          key: model.key,
          fileName: model.fileName,
          modelStructure: model.modelStructure,
          elements: model.elements,
        }))
      ),
    [parsedModels]
  );

  const isVisible = useCallback(
    (modelKey: string, expressId: number) => {
      const ifcType = geometry[modelKey]?.mapping.elementByExpressId.get(expressId)?.ifcType ?? "";
      return visibilityCode(visibility, { modelKey, expressId }, ifcType);
    },
    [geometry, visibility]
  );

  const selectedElement = selection
    ? geometry[selection.modelKey]?.mapping.elementByExpressId.get(selection.expressId) ?? null
    : null;

  const loadModel = useCallback(
    async (modelKey: string) => {
      const model = parsedModels.find((candidate) => candidate.key === modelKey);
      if (!model || busyModelKey) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setBusyModelKey(modelKey);
      setProgress(0);
      setError(null);
      setNote(null);

      const collected: ViewerMesh[] = [];
      try {
        const processor = await createGeometryProcessor();
        try {
          const buffer = new Uint8Array(await model.file.arrayBuffer());
          const summary = await streamModelGeometry(
            processor,
            buffer,
            {
              onMeshes: (batch) => {
                collected.push(...batch);
                canvasRef.current?.addMeshes(modelKey, batch);
              },
              onProgress: setProgress,
            },
            {
              renderableExpressIds: new Set(model.elements.map((element) => element.expressId)),
              signal: controller.signal,
            }
          );

          // Streaming is done: merge the per-batch fragments the upload path
          // created into consolidated batches before anything draws again.
          canvasRef.current?.finishLoad();

          const mapping = mapMeshesToElements(collected, model.elements);
          const bounds = boundsOfElements(mapping, mapping.meshesByExpressId.keys());
          const framingBounds = robustBounds(
            elementBoundsList(mapping, mapping.meshesByExpressId.keys())
          );

          setGeometry((previous) => ({
            ...previous,
            [modelKey]: {
              mapping,
              bounds,
              framingBounds,
              meshCount: summary.meshCount,
              skippedExpressIds: summary.skippedExpressIds,
            },
          }));

          if (summary.meshCount === 0) {
            setNote(`${model.fileName} carries no renderable geometry.`);
          } else if (mapping.geometrylessExpressIds.length > 0) {
            setNote(
              `${mapping.geometrylessExpressIds.length} of ${model.elements.length} elements in ${model.fileName} have no geometry and cannot be shown.`
            );
          }

          // Establishing shot for a file with nothing on screen yet — not a
          // selection event, so it is exempt from "camera never auto-moves".
          canvasRef.current?.frameBounds(framingBounds);
          setSection(sectionBoxFromBounds(bounds));
        } finally {
          processor.dispose();
        }
      } catch (loadError) {
        if (loadError instanceof GeometryLoadAbortedError) {
          canvasRef.current?.removeModel(modelKey);
        } else {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        abortRef.current = null;
        setBusyModelKey(null);
      }
    },
    [busyModelKey, parsedModels]
  );

  const unloadModel = useCallback((modelKey: string) => {
    abortRef.current?.abort();
    canvasRef.current?.removeModel(modelKey);
    setGeometry((previous) => {
      const next = { ...previous };
      delete next[modelKey];
      return next;
    });
    setSelection((current) => (current?.modelKey === modelKey ? null : current));
  }, []);

  // Consume a navigation request from the Validate page: switch to its file
  // and remember it as the active focus. Resolving it into an isolate/
  // highlight action happens in the effect below, once that file's geometry
  // (loaded automatically if needed) is actually resident — the same
  // "results panel stays hidden until geometry finishes loading" rule that
  // governs the switcher, just triggered by a navigation instead of a click.
  useEffect(() => {
    if (!pendingFocus) return;
    setActiveModelKey(pendingFocus.modelKey);
    setActiveFocus(pendingFocus);
    setRequestedFocusMode("isolate");
    setRail("results");
    setActiveSpecIndex(null);
    setFocusAlert(null);
    setActiveFocusExpressIds([]);
    onConsumeFocus();
  }, [pendingFocus, onConsumeFocus]);

  useEffect(() => {
    if (!activeFocus || appliedFocusRef.current === activeFocus) return;

    const modelKey = activeFocus.modelKey;
    const model = parsedModels.find((candidate) => candidate.key === modelKey);
    if (!model) {
      appliedFocusRef.current = activeFocus;
      setFocusAlert(`${activeFocus.fileName} is no longer loaded on the Validate page.`);
      return;
    }

    const loaded = geometry[modelKey];
    if (!loaded) {
      if (busyModelKey !== modelKey) void loadModel(modelKey);
      return;
    }

    const { expressIds, unmatchedRows } = resolveFocusElements(activeFocus, model.elements);
    const withGeometry = expressIds.filter((expressId) => loaded.mapping.meshesByExpressId.has(expressId));
    const missingCount = expressIds.length - withGeometry.length + unmatchedRows.length;

    const refs = withGeometry.map((expressId) => ({ modelKey, expressId }));
    setVisibility((current) =>
      requestedFocusMode === "isolate"
        ? isolateElements(clearHighlight(current), refs)
        : highlightElements(clearIsolation(current), refs)
    );
    setFocusMode(requestedFocusMode);
    setActiveFocusExpressIds(withGeometry);

    // Goal 4's "camera never auto-moves" is about selection, not about this: a
    // request to go look at some elements that leaves them off screen has not
    // taken anyone anywhere.
    if (withGeometry.length > 0) {
      const focused = boundsOfElements(loaded.mapping, withGeometry);
      canvasRef.current?.frameBounds(focused);
    }

    const parts: string[] = [];
    if (missingCount > 0) {
      parts.push(
        `${missingCount} of ${activeFocus.rows.length} element${activeFocus.rows.length === 1 ? "" : "s"} in "${activeFocus.label}" have no geometry and cannot be shown.`
      );
    }
    if (activeFocus.otherFileCount > 0) {
      parts.push(
        `${activeFocus.otherFileCount} more failing element${activeFocus.otherFileCount === 1 ? "" : "s"} are in other files — switch files to see them.`
      );
    }
    setFocusAlert(parts.length > 0 ? parts.join(" ") : null);

    appliedFocusRef.current = activeFocus;
  }, [activeFocus, geometry, parsedModels, busyModelKey, loadModel, requestedFocusMode]);

  const clearFocus = useCallback(() => {
    setActiveFocus(null);
    setActiveFocusExpressIds([]);
    setActiveSpecIndex(null);
    setFocusAlert(null);
    appliedFocusRef.current = null;
    setVisibility((current) => clearHighlight(clearIsolation(current)));
  }, []);

  /**
   * Puts one specification's failing elements on screen. A specification whose
   * failures span several files is narrowed to the first of them by
   * `buildSpecificationFocusRequest`, which counts the rest into the alert
   * rather than dropping them quietly.
   */
  const applySpecFocus = useCallback(
    (index: number, mode: FocusMode) => {
      const summary = results?.[index];
      if (!summary) return;
      const request = buildSpecificationFocusRequest(summary);
      if (!request) return;

      setActiveSpecIndex(index);
      setOpenSpecIndex(index);
      setRequestedFocusMode(mode);
      setActiveModelKey(request.modelKey);
      setActiveFocus(request);
      setFocusAlert(null);
      setActiveFocusExpressIds([]);
    },
    [results]
  );

  const toggleSpec = useCallback(
    (index: number) => {
      if (openSpecIndex === index) {
        setOpenSpecIndex(null);
        setSelection(null);
        clearFocus();
        return;
      }
      // Opening a failing specification shows it straight away — highlighted
      // rather than isolated, so the model around it stays as the context that
      // makes "where is this" answerable at all.
      setSelection(null);
      applySpecFocus(index, "highlight");
    },
    [openSpecIndex, applySpecFocus, clearFocus]
  );

  const selectRow = useCallback(
    (row: IssueRow) => {
      const model = parsedModels.find((candidate) => candidate.key === row.modelKey);
      const element = model?.elements.find((candidate) => candidate.globalId === row.elementGlobalId);
      if (!element) return;
      setSelection({ modelKey: row.modelKey, expressId: element.expressId });
    },
    [parsedModels]
  );

  const refsFor = useCallback(
    (node: ViewerTreeNode): ElementRef[] =>
      collectElementIds(node).map((expressId) => ({ modelKey: node.modelKey, expressId })),
    []
  );

  const onIsolate = useCallback(
    (node: ViewerTreeNode) => setVisibility((current) => isolateElements(current, refsFor(node))),
    [refsFor]
  );

  const onHighlight = useCallback(
    (node: ViewerTreeNode) => setVisibility((current) => highlightElements(current, refsFor(node))),
    [refsFor]
  );

  const onHide = useCallback(
    (node: ViewerTreeNode) => setVisibility((current) => hideElements(current, refsFor(node))),
    [refsFor]
  );

  const onShow = useCallback(
    (node: ViewerTreeNode) => setVisibility((current) => showElements(current, refsFor(node))),
    [refsFor]
  );

  const onSelectNode = useCallback((node: ViewerTreeNode) => {
    if (node.expressId === null || node.kind !== "element") return;
    setSelection({ modelKey: node.modelKey, expressId: node.expressId });
  }, []);

  const allBounds = useMemo(
    () => Object.values(geometry).reduce((total, loaded) => unionBounds(total, loaded.bounds), emptyBounds()),
    [geometry]
  );

  const allFramingBounds = useMemo(
    () =>
      Object.values(geometry).reduce(
        (total, loaded) => unionBounds(total, loaded.framingBounds),
        emptyBounds()
      ),
    [geometry]
  );

  // "Zoom to fit" is explicit and manual (see visibility.ts's comment on
  // isolation/highlight) — it frames whatever is currently isolated or
  // highlighted, across every loaded model that contributes to it, falling
  // back to everything loaded when nothing is isolated or the target set
  // turned out to have no geometry at all.
  const zoomToFitTarget = useCallback((): Bounds => {
    const targetRefs = visibility.isolated ?? visibility.highlighted;
    // An explicit isolate/highlight is framed exactly as asked — the user
    // picked those elements, so none of them is an outlier to be trimmed away.
    if (!targetRefs) return allFramingBounds;
    let bounds = emptyBounds();
    for (const [modelKey, loaded] of Object.entries(geometry)) {
      const ids = [...loaded.mapping.meshesByExpressId.keys()].filter((expressId) =>
        targetRefs.has(refKey({ modelKey, expressId }))
      );
      bounds = unionBounds(bounds, boundsOfElements(loaded.mapping, ids));
    }
    return isEmptyBounds(bounds) ? allFramingBounds : bounds;
  }, [visibility, geometry, allFramingBounds]);

  /**
   * What "zoom to selection" frames: the picked element, or failing that
   * whatever is currently isolated or highlighted. Empty when there is no such
   * target, which the caller treats as nothing to do rather than as "frame
   * everything" — that is the other button.
   */
  const zoomToSelectionTarget = useCallback((): Bounds => {
    if (selection) {
      const loaded = geometry[selection.modelKey];
      const picked = loaded ? boundsOfElements(loaded.mapping, [selection.expressId]) : emptyBounds();
      if (!isEmptyBounds(picked)) return picked;
    }

    const targetRefs = visibility.isolated ?? visibility.highlighted;
    if (!targetRefs) return emptyBounds();

    let bounds = emptyBounds();
    for (const [modelKey, loaded] of Object.entries(geometry)) {
      const ids = [...loaded.mapping.meshesByExpressId.keys()].filter((expressId) =>
        targetRefs.has(refKey({ modelKey, expressId }))
      );
      bounds = unionBounds(bounds, boundsOfElements(loaded.mapping, ids));
    }
    return bounds;
  }, [selection, geometry, visibility]);

  const loadedModelKeys = useMemo(() => new Set(Object.keys(geometry)), [geometry]);
  const totalSkipped = Object.values(geometry).reduce(
    (total, loaded) => total + loaded.skippedExpressIds.length,
    0
  );

  const failingCount = results?.reduce((total, summary) => total + summary.violations.length, 0) ?? 0;

  // The rail row that matches whatever is picked in the 3D view, so selecting a
  // duct in the model and reading its failure in the list are the same state.
  const selectedRowId =
    openSpecIndex === null || !selectedElement
      ? null
      : results?.[openSpecIndex]?.violations.find(
          (row) =>
            row.modelKey === selection?.modelKey && row.elementGlobalId === selectedElement.globalId
        )?.id ?? null;

  // A focus only earns a chip once it has resolved to something on screen —
  // before that there is nothing to clear.
  const focusChipLabel = activeFocus && activeFocusExpressIds.length > 0 ? activeFocus.label : null;

  const showFocusAlert = activeFocus !== null && activeModel !== null && activeFocus.modelKey === activeModel.key;

  // Everything that used to be a line of prose above the canvas, in one list
  // for the overlay to float over it.
  const messages: { kind: "error" | "note"; text: string }[] = [];
  if (error) messages.push({ kind: "error", text: error });
  if (showFocusAlert && focusAlert) messages.push({ kind: "error", text: focusAlert });
  if (note) messages.push({ kind: "note", text: note });
  if (totalSkipped > 0) {
    messages.push({
      kind: "note",
      text: `${totalSkipped} meshes belong to openings or type geometry and are not drawn.`,
    });
  }

  return (
    <div
      className="viewer-page"
      // Custom properties, not grid-template-columns directly: an inline style
      // always beats a stylesheet rule regardless of specificity, which would
      // defeat the narrow-viewport media query that collapses this grid to a
      // single column.
      style={{ "--viewer-rail-w": `${railWidth}px`, "--viewer-props-w": `${propertiesWidth}px` } as CSSProperties}
    >
      <aside className="viewer-rail">
        <header className="viewer-rail-header">
          <div className="viewer-rail-tabs" role="tablist" aria-label="Rail">
            <button
              type="button"
              role="tab"
              aria-selected={rail === "models"}
              onClick={() => setRail("models")}
            >
              Models
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rail === "results"}
              onClick={() => setRail("results")}
            >
              Results
              {failingCount > 0 && <span className="viewer-rail-pill">{failingCount}</span>}
            </button>
          </div>
          {busyModelKey && <span className="viewer-progress">{progress} meshes…</span>}
        </header>

        {rail === "models" ? (
          <>
            <div className="viewer-file-switch">
              <label htmlFor="viewer-active-model">Focus file</label>
              <select
                id="viewer-active-model"
                value={activeModel?.key ?? ""}
                disabled={parsedModels.length === 0}
                onChange={(event) => setActiveModelKey(event.target.value)}
              >
                {parsedModels.length === 0 ? (
                  <option value="">No parsed files yet</option>
                ) : (
                  parsedModels.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.fileName}
                    </option>
                  ))
                )}
              </select>
              {activeModel && !geometry[activeModel.key] && busyModelKey !== activeModel.key && (
                <button type="button" className="ghost-btn" onClick={() => loadModel(activeModel.key)}>
                  Load 3D
                </button>
              )}
            </div>

            <ViewerTreeRail
              nodes={tree}
              selectedKey={selection ? `${selection.modelKey}#${selection.expressId}` : null}
              loadedModelKeys={loadedModelKeys}
              busyModelKey={busyModelKey}
              onSelect={onSelectNode}
              onIsolate={onIsolate}
              onHighlight={onHighlight}
              onHide={onHide}
              onShow={onShow}
              onLoadModel={loadModel}
              onUnloadModel={unloadModel}
              onToggleModel={(modelKey) => setVisibility((current) => toggleModel(current, modelKey))}
              hiddenModelKeys={visibility.hiddenModels}
            />
          </>
        ) : (
          <ViewerResultsRail
            results={results}
            openIndex={openSpecIndex}
            onToggleSpec={toggleSpec}
            activeIndex={activeSpecIndex}
            focusMode={focusMode}
            onApplyMode={applySpecFocus}
            selectedRowId={selectedRowId}
            onSelectRow={selectRow}
          />
        )}
      </aside>

      <div
        className="viewer-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize models rail"
        onPointerDown={beginColumnResize(setRailWidth, railWidth, 1, 200, 480)}
        onPointerMove={onColumnResizeMove}
        onPointerUp={endColumnResize}
        onPointerCancel={endColumnResize}
      />

      {/* The canvas fills the stage and everything else floats on top of it:
          a strip of buttons above and a strip of sliders below were taking a
          fifth of the height of the one thing this page exists to show. */}
      <section className="viewer-stage">
        <ViewerCanvas
          handleRef={canvasRef}
          section={section}
          selection={selection}
          isVisible={isVisible}
          onPick={setSelection}
          onError={setError}
        />

        <ViewerOverlay
          onZoomToFit={() => canvasRef.current?.frameBounds(zoomToFitTarget())}
          onZoomToSelection={() => {
            const target = zoomToSelectionTarget();
            if (!isEmptyBounds(target)) canvasRef.current?.frameBounds(target);
          }}
          canZoomToSelection={
            selection !== null || visibility.isolated !== null || visibility.highlighted !== null
          }
          onResetView={() => {
            setVisibility(initialVisibility());
            setSelection(null);
            setOpenSpecIndex(null);
            clearFocus();
            canvasRef.current?.frameBounds(allFramingBounds);
          }}
          section={section}
          sectionBounds={allBounds}
          onToggleSection={(enabled) =>
            setSection((current) => (current ? { ...current, enabled } : current))
          }
          onMoveSectionFace={(axis: SectionAxis, side, value) =>
            setSection((current) => (current ? moveSectionFace(current, axis, side, value) : current))
          }
          onResetSection={() => setSection(sectionBoxFromBounds(allBounds, true))}
          isolatedCount={visibility.isolated ? visibility.isolated.size : null}
          highlightedCount={visibility.highlighted ? visibility.highlighted.size : null}
          hiddenCount={visibility.hidden.size + visibility.hiddenModels.size}
          focusLabel={focusChipLabel}
          focusCount={activeFocusExpressIds.length}
          onClearIsolation={() => setVisibility(clearIsolation)}
          onClearHighlight={() => setVisibility(clearHighlight)}
          onShowEverything={() => setVisibility(showEverything())}
          onClearFocus={() => {
            setOpenSpecIndex(null);
            clearFocus();
          }}
          messages={messages}
        />
      </section>

      <div
        className="viewer-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize properties panel"
        onPointerDown={beginColumnResize(setPropertiesWidth, propertiesWidth, -1, 200, 420)}
        onPointerMove={onColumnResizeMove}
        onPointerUp={endColumnResize}
        onPointerCancel={endColumnResize}
      />

      <aside className="viewer-properties">
        <h2>Properties</h2>
        {!selectedElement ? (
          <p className="viewer-empty">Select an element in the tree or the 3D view.</p>
        ) : (
          <>
            <dl className="viewer-property-list">
              <dt>Name</dt>
              <dd>{selectedElement.name ?? "(unnamed)"}</dd>
              <dt>Type</dt>
              <dd>{selectedElement.ifcType}</dd>
              <dt>GlobalId</dt>
              <dd className="viewer-mono">{selectedElement.globalId}</dd>
              <dt>Express id</dt>
              <dd className="viewer-mono">{selectedElement.expressId}</dd>
            </dl>

            {Object.entries(selectedElement.propertySets).map(([setName, properties]) => (
              <section key={setName} className="viewer-pset">
                <h3>{setName}</h3>
                <dl className="viewer-property-list">
                  {Object.entries(properties).map(([name, slot]) => (
                    <div key={name}>
                      <dt title={name}>{name}</dt>
                      <dd title={formatPropertyValue(slot)}>{formatPropertyValue(slot)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </>
        )}
      </aside>
    </div>
  );
}
