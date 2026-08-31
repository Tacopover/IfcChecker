import type { ModelStructureNode, NormalizedElement } from "@ifc-qa/shared-types";
import { indexElements } from "./meshMapping.js";

// One tree over every loaded file. The tree is built from the parsed spatial
// structure, which is already resident and cheap, so a user can browse the
// whole federation while only one or two models hold mesh buffers.

export type ViewerTreeKind = "model" | "spatial" | "type-group" | "element";

export interface ViewerTreeNode {
  /** Unique across all models — express ids repeat between files. */
  key: string;
  kind: ViewerTreeKind;
  label: string;
  modelKey: string;
  /** The element or spatial node this stands for; null for model and type-group rows. */
  expressId: number | null;
  /** Upper-case IFC type, for element and type-group rows. */
  ifcType: string | null;
  children: ViewerTreeNode[];
}

export interface TreeModelInput {
  key: string;
  fileName: string;
  modelStructure: ModelStructureNode | null;
  elements: readonly NormalizedElement[];
}

const SPATIAL_LABELS: Record<string, string> = {
  IFCPROJECT: "Project",
  IFCSITE: "Site",
  IFCBUILDING: "Building",
  IFCBUILDINGSTOREY: "Storey",
  IFCSPACE: "Space",
};

function spatialLabel(node: ModelStructureNode): string {
  const kind = SPATIAL_LABELS[node.ifcType] ?? node.ifcType;
  return node.name ? `${kind} — ${node.name}` : `${kind} (unnamed)`;
}

function elementLabel(expressId: number, element: NormalizedElement | undefined): string {
  if (!element) return `#${expressId}`;
  return element.name ?? `${element.ifcType} #${expressId}`;
}

function buildSpatialNode(
  node: ModelStructureNode,
  modelKey: string,
  elementByExpressId: Map<number, NormalizedElement>
): ViewerTreeNode {
  // Types sorted so the tree reads the same across engines and across runs;
  // ids inside a group are already sorted by the adapters.
  const typeGroups = Object.entries(node.elementIdsByType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map<ViewerTreeNode>(([ifcType, expressIds]) => ({
      key: `${modelKey}#${node.expressId}/${ifcType}`,
      kind: "type-group",
      label: `${ifcType} (${expressIds.length})`,
      modelKey,
      expressId: null,
      ifcType,
      children: expressIds.map<ViewerTreeNode>((expressId) => ({
        key: `${modelKey}#${expressId}`,
        kind: "element",
        label: elementLabel(expressId, elementByExpressId.get(expressId)),
        modelKey,
        expressId,
        ifcType,
        children: [],
      })),
    }));

  return {
    key: `${modelKey}#${node.expressId}`,
    kind: "spatial",
    label: spatialLabel(node),
    modelKey,
    expressId: node.expressId,
    ifcType: node.ifcType,
    // Nested storeys and spaces before the loose elements, so the structural
    // spine of the model stays readable above a long list of walls.
    children: [
      ...node.children.map((child) => buildSpatialNode(child, modelKey, elementByExpressId)),
      ...typeGroups,
    ],
  };
}

/**
 * A model with no spatial structure still gets a row — a file that parsed but
 * declares no IfcProject is worth seeing in the tree rather than silently
 * missing from it. Its elements hang off the model row, grouped by type.
 */
function buildFlatTypeGroups(
  modelKey: string,
  elements: readonly NormalizedElement[]
): ViewerTreeNode[] {
  const idsByType = new Map<string, number[]>();
  for (const element of elements) {
    const bucket = idsByType.get(element.ifcType);
    if (bucket) bucket.push(element.expressId);
    else idsByType.set(element.ifcType, [element.expressId]);
  }

  return [...idsByType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ifcType, expressIds]) => ({
      key: `${modelKey}/${ifcType}`,
      kind: "type-group" as const,
      label: `${ifcType} (${expressIds.length})`,
      modelKey,
      expressId: null,
      ifcType,
      children: expressIds.map((expressId) => ({
        key: `${modelKey}#${expressId}`,
        kind: "element" as const,
        label: `${ifcType} #${expressId}`,
        modelKey,
        expressId,
        ifcType,
        children: [],
      })),
    }));
}

export function buildViewerTree(models: readonly TreeModelInput[]): ViewerTreeNode[] {
  return models.map((model) => {
    const elementByExpressId = indexElements(model.elements);
    return {
      key: model.key,
      kind: "model" as const,
      label: model.fileName,
      modelKey: model.key,
      expressId: null,
      ifcType: null,
      children: model.modelStructure
        ? [buildSpatialNode(model.modelStructure, model.key, elementByExpressId)]
        : buildFlatTypeGroups(model.key, model.elements),
    };
  });
}

/**
 * Every element under a node — what "isolate this storey" or "hide this file"
 * operates on. Spatial rows are not themselves elements, so they contribute
 * only their descendants.
 */
export function collectElementIds(node: ViewerTreeNode): number[] {
  if (node.kind === "element" && node.expressId !== null) return [node.expressId];
  return node.children.flatMap(collectElementIds);
}

export function findTreeNode(nodes: readonly ViewerTreeNode[], key: string): ViewerTreeNode | null {
  for (const node of nodes) {
    if (node.key === key) return node;
    const found = findTreeNode(node.children, key);
    if (found) return found;
  }
  return null;
}
