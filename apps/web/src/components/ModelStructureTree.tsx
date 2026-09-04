import { elementCountsOf, type ModelStructureNode } from "@ifc-qa/shared-types";

const SPATIAL_TYPE_LABELS: Record<string, string> = {
  IFCPROJECT: "Project",
  IFCSITE: "Site",
  IFCBUILDING: "Building",
  IFCBUILDINGSTOREY: "Storey",
};

function spatialLabel(ifcType: string): string {
  return SPATIAL_TYPE_LABELS[ifcType] ?? ifcType;
}

function TreeNode({ node }: { node: ModelStructureNode }) {
  const elementCounts = Object.entries(elementCountsOf(node));

  return (
    <li>
      <span className="node-type">{spatialLabel(node.ifcType)}</span>{" "}
      <span className="node-name">{node.name ?? "(unnamed)"}</span>
      {elementCounts.length > 0 && (
        <ul className="element-counts">
          {elementCounts.map(([ifcType, count]) => (
            <li key={ifcType}>
              {ifcType}: {count}
            </li>
          ))}
        </ul>
      )}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.expressId} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ModelStructureTree({ node }: { node: ModelStructureNode }) {
  return (
    <ul aria-label="Model structure" className="model-structure-tree">
      <TreeNode node={node} />
    </ul>
  );
}
