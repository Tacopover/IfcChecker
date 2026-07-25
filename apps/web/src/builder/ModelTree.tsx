import type { TreeNode } from "./introspect.js";

export interface ModelTreeProps {
  nodes: TreeNode[];
  selectedName: string | null;
  expanded: ReadonlySet<string>;
  onSelect: (node: TreeNode) => void;
  onToggle: (name: string) => void;
}

interface TreeItemProps extends Omit<ModelTreeProps, "nodes"> {
  node: TreeNode;
  depth: number;
}

function TreeItem({ node, depth, selectedName, expanded, onSelect, onToggle }: TreeItemProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.name);
  const isSelected = node.name === selectedName;
  const isGroup = node.kind === "group";

  return (
    <li
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isOpen : undefined}
    >
      <div className="rowline" style={{ paddingLeft: `${depth * 0.62}rem` }}>
        {hasChildren ? (
          <button
            type="button"
            className="twist"
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
            aria-expanded={isOpen}
            onClick={() => onToggle(node.name)}
          >
            {isOpen ? "▼" : "▶"}
          </button>
        ) : (
          <span className="twist" aria-hidden="true" />
        )}
        <button
          type="button"
          className={isGroup ? "row grp" : "row"}
          data-selected={isSelected}
          title={
            isGroup
              ? `${node.name} — covers ${node.typeCount} types, ${node.count} elements`
              : `${node.name} — ${node.count} elements`
          }
          onClick={() => onSelect(node)}
        >
          <span className="row-name">{node.name}</span>
          <span className="row-meta num">
            {isGroup ? `${node.typeCount}× ${node.count}` : node.count}
          </span>
        </button>
      </div>
      {hasChildren && isOpen && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeItem
              key={child.name}
              node={child}
              depth={depth + 1}
              selectedName={selectedName}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * One tree: qualifying inherited groups are branches, entity types found in the file are leaves.
 * The caret expands, the label selects — they are separate controls so neither steals the other's
 * click.
 */
export function ModelTree({ nodes, selectedName, expanded, onSelect, onToggle }: ModelTreeProps) {
  return (
    <ul className="tree" role="tree" aria-label="Entity types and inherited groups">
      {nodes.map((node) => (
        <TreeItem
          key={node.name}
          node={node}
          depth={0}
          selectedName={selectedName}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}
