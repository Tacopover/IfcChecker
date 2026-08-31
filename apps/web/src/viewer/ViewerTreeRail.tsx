import { useState } from "react";
import type { ViewerTreeNode } from "./viewerTree.js";

// The tree spans every loaded file whether or not its geometry is resident:
// browsing the structure of a 1.6 GB federation costs nothing, while holding
// its meshes costs everything.

interface RailProps {
  nodes: readonly ViewerTreeNode[];
  selectedKey: string | null;
  loadedModelKeys: ReadonlySet<string>;
  busyModelKey: string | null;
  onSelect: (node: ViewerTreeNode) => void;
  onIsolate: (node: ViewerTreeNode) => void;
  onHighlight: (node: ViewerTreeNode) => void;
  onHide: (node: ViewerTreeNode) => void;
  onShow: (node: ViewerTreeNode) => void;
  onLoadModel: (modelKey: string) => void;
  onUnloadModel: (modelKey: string) => void;
  onToggleModel: (modelKey: string) => void;
  hiddenModelKeys: ReadonlySet<string>;
}

function TreeRow({
  node,
  depth,
  selectedKey,
  loadedModelKeys,
  busyModelKey,
  onSelect,
  onIsolate,
  onHighlight,
  onHide,
  onShow,
  onLoadModel,
  onUnloadModel,
  onToggleModel,
  hiddenModelKeys,
}: RailProps & { node: ViewerTreeNode; depth: number }) {
  // Models and the top of a spatial tree open by default; long element lists
  // stay shut, because a storey can hold thousands of rows.
  const [open, setOpen] = useState(node.kind === "model" || (node.kind === "spatial" && depth < 3));
  const hasChildren = node.children.length > 0;
  const isLoaded = loadedModelKeys.has(node.modelKey);
  const isBusy = busyModelKey === node.modelKey;

  return (
    <li>
      <div
        className="viewer-tree-row"
        data-kind={node.kind}
        data-selected={node.key === selectedKey ? "" : undefined}
        style={{ paddingLeft: `${depth * 0.85}rem` }}
      >
        <button
          type="button"
          className="viewer-tree-twisty"
          onClick={() => setOpen((was) => !was)}
          disabled={!hasChildren}
          aria-label={open ? "Collapse" : "Expand"}
          aria-expanded={hasChildren ? open : undefined}
        >
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </button>

        <button type="button" className="viewer-tree-label" onClick={() => onSelect(node)}>
          {node.label}
        </button>

        {node.kind === "model" ? (
          <>
            {/* Hiding a file is not unloading it: hiding is instant and
                reversible, unloading gives the mesh buffers back and costs
                another full geometry pass to undo. */}
            <button
              type="button"
              className="viewer-tree-action"
              disabled={!isLoaded}
              onClick={() => onToggleModel(node.modelKey)}
            >
              {hiddenModelKeys.has(node.modelKey) ? "Show" : "Hide"}
            </button>
            <button
              type="button"
              className="viewer-tree-action"
              disabled={isBusy}
              onClick={() => (isLoaded ? onUnloadModel(node.modelKey) : onLoadModel(node.modelKey))}
            >
              {isBusy ? "Loading…" : isLoaded ? "Unload" : "Load 3D"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="viewer-tree-action" onClick={() => onIsolate(node)}>
              Isolate
            </button>
            <button type="button" className="viewer-tree-action" onClick={() => onHighlight(node)}>
              Highlight
            </button>
            <button type="button" className="viewer-tree-action" onClick={() => onHide(node)}>
              Hide
            </button>
            <button type="button" className="viewer-tree-action" onClick={() => onShow(node)}>
              Show
            </button>
          </>
        )}
      </div>

      {open && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <TreeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              loadedModelKeys={loadedModelKeys}
              busyModelKey={busyModelKey}
              nodes={[]}
              onSelect={onSelect}
              onIsolate={onIsolate}
              onHighlight={onHighlight}
              onHide={onHide}
              onShow={onShow}
              onLoadModel={onLoadModel}
              onUnloadModel={onUnloadModel}
              onToggleModel={onToggleModel}
              hiddenModelKeys={hiddenModelKeys}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ViewerTreeRail(props: RailProps) {
  if (props.nodes.length === 0) {
    return <p className="viewer-empty">No models loaded yet — parse a file on the Validate page first.</p>;
  }

  return (
    <ul className="viewer-tree" aria-label="Model tree">
      {props.nodes.map((node) => (
        <TreeRow key={node.key} {...props} node={node} depth={0} />
      ))}
    </ul>
  );
}
