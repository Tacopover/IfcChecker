import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLoadedModels } from "../state/loadedModels";
import { emptyBounds, isEmptyBounds, unionBounds, type Bounds } from "./bounds.js";
import { frameBounds, initialCamera, type OrbitCamera } from "./camera.js";
import { resolveFocusElements, type ViewerFocusRequest } from "./focusRequest.js";
import {
  createGeometryProcessor,
  GeometryLoadAbortedError,
  streamModelGeometry,
} from "./geometryLoader.js";
import {
  boundsOfElements,
  mapMeshesToElements,
  type MeshMapping,
  type ViewerMesh,
} from "./meshMapping.js";
import {
  moveSectionFace,
  SECTION_AXES,
  sectionBoxFromBounds,
  type SectionAxis,
  type SectionBox,
} from "./sectionBox.js";
import { ViewerCanvas, type ViewerCanvasHandle } from "./ViewerCanvas";
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

interface LoadedGeometry {
  mapping: MeshMapping;
  bounds: Bounds;
  meshCount: number;
  skippedExpressIds: number[];
}

type FocusMode = "isolate" | "highlight";

export interface ViewerPageProps {
  /** Set once by the Validate page's "View in 3D" affordance, consumed here and then cleared. */
  pendingFocus: ViewerFocusRequest | null;
  onConsumeFocus: () => void;
}

export function ViewerPage({ pendingFocus, onConsumeFocus }: ViewerPageProps) {
  const { models } = useLoadedModels();
  const canvasRef = useRef<ViewerCanvasHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Which activeFocus instance the isolate/highlight action below has already
  // been applied for — the effect that applies it must run once per focus,
  // not every time `geometry` changes for an unrelated reason.
  const appliedFocusRef = useRef<ViewerFocusRequest | null>(null);

  const [camera, setCamera] = useState<OrbitCamera>(initialCamera);
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

          const mapping = mapMeshesToElements(collected, model.elements);
          const bounds = boundsOfElements(mapping, mapping.meshesByExpressId.keys());

          setGeometry((previous) => ({
            ...previous,
            [modelKey]: {
              mapping,
              bounds,
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
          setCamera((current) => frameBounds(current, bounds, 16 / 9));
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
    setVisibility((current) => isolateElements(clearHighlight(current), refs));
    setFocusMode("isolate");
    setActiveFocusExpressIds(withGeometry);

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
  }, [activeFocus, geometry, parsedModels, busyModelKey, loadModel]);

  const applyFocusMode = useCallback(
    (mode: FocusMode) => {
      if (!activeFocus) return;
      const refs = activeFocusExpressIds.map((expressId) => ({ modelKey: activeFocus.modelKey, expressId }));
      setVisibility((current) =>
        mode === "isolate"
          ? isolateElements(clearHighlight(current), refs)
          : highlightElements(clearIsolation(current), refs)
      );
      setFocusMode(mode);
    },
    [activeFocus, activeFocusExpressIds]
  );

  const clearFocus = useCallback(() => {
    setActiveFocus(null);
    setActiveFocusExpressIds([]);
    setFocusAlert(null);
    appliedFocusRef.current = null;
    setVisibility((current) => clearHighlight(clearIsolation(current)));
  }, []);

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

  // "Zoom to fit" is explicit and manual (see visibility.ts's comment on
  // isolation/highlight) — it frames whatever is currently isolated or
  // highlighted, across every loaded model that contributes to it, falling
  // back to everything loaded when nothing is isolated or the target set
  // turned out to have no geometry at all.
  const zoomToFitTarget = useCallback((): Bounds => {
    const targetRefs = visibility.isolated ?? visibility.highlighted;
    if (!targetRefs) return allBounds;
    let bounds = emptyBounds();
    for (const [modelKey, loaded] of Object.entries(geometry)) {
      const ids = [...loaded.mapping.meshesByExpressId.keys()].filter((expressId) =>
        targetRefs.has(refKey({ modelKey, expressId }))
      );
      bounds = unionBounds(bounds, boundsOfElements(loaded.mapping, ids));
    }
    return isEmptyBounds(bounds) ? allBounds : bounds;
  }, [visibility, geometry, allBounds]);

  const loadedModelKeys = useMemo(() => new Set(Object.keys(geometry)), [geometry]);
  const totalSkipped = Object.values(geometry).reduce(
    (total, loaded) => total + loaded.skippedExpressIds.length,
    0
  );

  const showFocusPanel = activeFocus !== null && activeModel !== null && activeFocus.modelKey === activeModel.key;

  return (
    <div className="viewer-page">
      <aside className="viewer-rail">
        <header className="viewer-rail-header">
          <h2>Models</h2>
          {busyModelKey && <span className="viewer-progress">{progress} meshes…</span>}
        </header>

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
      </aside>

      <section className="viewer-stage">
        <div className="viewer-toolbar">
          <button
            type="button"
            onClick={() => {
              setVisibility(initialVisibility());
              setSelection(null);
              setCamera((current) => frameBounds(current, allBounds, 16 / 9));
            }}
          >
            Reset view
          </button>
          <button type="button" onClick={() => setVisibility(clearIsolation)}>
            Un-isolate
          </button>
          <button type="button" onClick={() => setVisibility(clearHighlight)}>
            Clear highlight
          </button>
          <button type="button" onClick={() => setVisibility(showEverything())}>
            Show everything
          </button>
          <button type="button" onClick={() => setCamera((current) => frameBounds(current, zoomToFitTarget(), 16 / 9))}>
            Zoom to fit
          </button>
          <label className="viewer-toggle">
            <input
              type="checkbox"
              checked={section?.enabled ?? false}
              disabled={!section}
              onChange={(event) =>
                setSection((current) => (current ? { ...current, enabled: event.target.checked } : current))
              }
            />
            Section box
          </label>
        </div>

        {showFocusPanel && activeFocus && (
          <div className="viewer-focus-panel">
            <div className="viewer-focus-head">
              <h3>{activeFocus.label}</h3>
              <div className="viewer-focus-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  aria-pressed={focusMode === "isolate"}
                  onClick={() => applyFocusMode("isolate")}
                >
                  Isolate
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  aria-pressed={focusMode === "highlight"}
                  onClick={() => applyFocusMode("highlight")}
                >
                  Highlight
                </button>
                <button type="button" className="ghost-btn" onClick={clearFocus}>
                  Clear
                </button>
              </div>
            </div>

            {focusAlert && (
              <p role="alert" className="viewer-focus-alert">
                {focusAlert}
              </p>
            )}

            <ul className="viewer-focus-rows">
              {activeFocus.rows.map((row) => (
                <li key={row.id}>
                  <span className="element-name">{row.elementName ?? "(unnamed)"}</span>{" "}
                  <span className="element-gid">{row.elementGlobalId}</span>
                  <span className="viewer-focus-message">{row.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="viewer-error">{error}</p>}
        {note && <p className="viewer-note">{note}</p>}
        {totalSkipped > 0 && (
          <p className="viewer-note">
            {totalSkipped} meshes belong to openings or type geometry and are not drawn.
          </p>
        )}

        <ViewerCanvas
          handleRef={canvasRef}
          camera={camera}
          onCameraChange={setCamera}
          section={section}
          selection={selection}
          isVisible={isVisible}
          onPick={setSelection}
          onError={setError}
        />

        {section?.enabled && (
          <div className="viewer-section-controls">
            {SECTION_AXES.flatMap((axis: SectionAxis) =>
              (["min", "max"] as const).map((side) => (
                <label key={`${axis}-${side}`}>
                  {axis.toUpperCase()} {side}
                  <input
                    type="range"
                    min={allBounds.min[axis]}
                    max={allBounds.max[axis]}
                    step={(allBounds.max[axis] - allBounds.min[axis]) / 200 || 0.01}
                    value={section.bounds[side][axis]}
                    onChange={(event) =>
                      setSection((current) =>
                        current ? moveSectionFace(current, axis, side, Number(event.target.value)) : current
                      )
                    }
                  />
                </label>
              ))
            )}
          </div>
        )}
      </section>

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
                  {Object.entries(properties).map(([name, value]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{value === null ? "—" : String(value)}</dd>
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
