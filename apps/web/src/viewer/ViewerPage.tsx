import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLoadedModels } from "../state/loadedModels";
import { emptyBounds, unionBounds, type Bounds } from "./bounds.js";
import { frameBounds, initialCamera, type OrbitCamera } from "./camera.js";
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
  clearIsolation,
  hideElements,
  initialVisibility,
  isolateElements,
  isVisible as isElementVisible,
  showEverything,
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

export function ViewerPage() {
  const { models } = useLoadedModels();
  const canvasRef = useRef<ViewerCanvasHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [camera, setCamera] = useState<OrbitCamera>(initialCamera);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [section, setSection] = useState<SectionBox | null>(null);
  const [selection, setSelection] = useState<ElementRef | null>(null);
  const [geometry, setGeometry] = useState<Record<string, LoadedGeometry>>({});
  const [busyModelKey, setBusyModelKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const parsedModels = useMemo(
    () => models.filter((model) => model.status === "succeeded"),
    [models]
  );

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
      return isElementVisible(visibility, { modelKey, expressId }, ifcType);
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

  const refsFor = useCallback(
    (node: ViewerTreeNode): ElementRef[] =>
      collectElementIds(node).map((expressId) => ({ modelKey: node.modelKey, expressId })),
    []
  );

  const onIsolate = useCallback(
    (node: ViewerTreeNode) => {
      const refs = refsFor(node);
      setVisibility((current) => isolateElements(current, refs));

      const mapping = geometry[node.modelKey]?.mapping;
      if (!mapping) return;
      const bounds = boundsOfElements(mapping, refs.map((ref) => ref.expressId));
      setCamera((current) => frameBounds(current, bounds, 16 / 9));
    },
    [geometry, refsFor]
  );

  const onHide = useCallback(
    (node: ViewerTreeNode) => setVisibility((current) => hideElements(current, refsFor(node))),
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

  const loadedModelKeys = useMemo(() => new Set(Object.keys(geometry)), [geometry]);
  const totalSkipped = Object.values(geometry).reduce(
    (total, loaded) => total + loaded.skippedExpressIds.length,
    0
  );

  return (
    <div className="viewer-page">
      <aside className="viewer-rail">
        <header className="viewer-rail-header">
          <h2>Models</h2>
          {busyModelKey && <span className="viewer-progress">{progress} meshes…</span>}
        </header>

        <ViewerTreeRail
          nodes={tree}
          selectedKey={selection ? `${selection.modelKey}#${selection.expressId}` : null}
          loadedModelKeys={loadedModelKeys}
          busyModelKey={busyModelKey}
          onSelect={onSelectNode}
          onIsolate={onIsolate}
          onHide={onHide}
          onLoadModel={loadModel}
          onUnloadModel={unloadModel}
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
          <button type="button" onClick={() => setVisibility(showEverything())}>
            Show everything
          </button>
          <button
            type="button"
            onClick={() => setCamera((current) => frameBounds(current, allBounds, 16 / 9))}
          >
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
            {SECTION_AXES.map((axis: SectionAxis) => (
              <label key={axis}>
                {axis.toUpperCase()} max
                <input
                  type="range"
                  min={allBounds.min[axis]}
                  max={allBounds.max[axis]}
                  step={(allBounds.max[axis] - allBounds.min[axis]) / 200 || 0.01}
                  value={section.bounds.max[axis]}
                  onChange={(event) =>
                    setSection((current) =>
                      current ? moveSectionFace(current, axis, "max", Number(event.target.value)) : current
                    )
                  }
                />
              </label>
            ))}
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
