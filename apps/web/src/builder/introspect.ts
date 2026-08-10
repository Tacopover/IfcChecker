import type { NormalizedElement, PropertyValue } from "@ifc-qa/shared-types";
import { ancestorsOf, canonicalIfcType } from "@ifc-qa/ids-validator";

export interface FieldSummary {
  name: string;
  propertySet: string | null;
  hits: number;
  coverage: number;
  values: Array<{ value: string; count: number }>;
}

export interface GroupSummary {
  name: string;
  types: string[];
  count: number;
}

export interface TreeNode {
  name: string;
  kind: "group" | "type";
  count: number;
  typeCount: number;
  children: TreeNode[];
}

export interface FieldsForResult {
  total: number;
  attributes: FieldSummary[];
  propertySets: Array<{ name: string; fields: FieldSummary[] }>;
}

export interface ModelIntrospection {
  entityTypes: Array<{ name: string; count: number }>;
  groups: GroupSummary[];
  tree: TreeNode[];
  resolveTypes(names: string[]): string[];
  fieldsFor(names: string[]): FieldsForResult;
}

// Every product shares these, so they can never discriminate between the
// things in a file — offering them as a group is noise.
const TOO_ABSTRACT = new Set(["IfcProduct", "IfcObject", "IfcObjectDefinition", "IfcRoot"]);

// NormalizedElement keeps these off the `attributes` bag, but IDS addresses
// them as ordinary attribute facets — surface them so a rule can be built on
// the names facet evaluation actually reads.
const TOP_LEVEL_ATTRIBUTES: Array<[string, (element: NormalizedElement) => PropertyValue | null]> = [
  ["Name", (element) => element.name],
  ["GlobalId", (element) => element.globalId],
  ["PredefinedType", (element) => element.predefinedType],
];

function isFilled(value: PropertyValue | undefined): value is Exclude<PropertyValue, null> {
  return value !== null && value !== undefined && String(value) !== "";
}

function* attributeEntries(element: NormalizedElement): Generator<[string, PropertyValue]> {
  for (const [name, read] of TOP_LEVEL_ATTRIBUTES) {
    const value = read(element);
    if (isFilled(value)) yield [name, value];
  }
  for (const [name, slot] of Object.entries(element.attributes)) {
    if (isFilled(slot.value)) yield [name, slot.value];
  }
}

interface FieldAccumulator {
  name: string;
  propertySet: string | null;
  hits: number;
  values: Map<string, number>;
}

function accumulate(bag: Map<string, FieldAccumulator>, name: string, propertySet: string | null, value: PropertyValue) {
  let record = bag.get(name);
  if (!record) {
    record = { name, propertySet, hits: 0, values: new Map() };
    bag.set(name, record);
  }
  record.hits++;
  const key = String(value);
  record.values.set(key, (record.values.get(key) ?? 0) + 1);
}

function byCountThenName(a: { count: number; name: string }, b: { count: number; name: string }) {
  return b.count - a.count || a.name.localeCompare(b.name);
}

export function introspectModel(elements: NormalizedElement[]): ModelIntrospection {
  const byType = new Map<string, NormalizedElement[]>();
  for (const element of elements) {
    // Files yield IFCWALL; the hierarchy table and the UI both speak IfcWall.
    // A type outside the table keeps its literal name so it stays selectable.
    const name = canonicalIfcType(element.ifcType) ?? element.ifcType;
    const bucket = byType.get(name);
    if (bucket) bucket.push(element);
    else byType.set(name, [element]);
  }

  const entityTypes = [...byType.entries()]
    .map(([name, list]) => ({ name, count: list.length }))
    .sort(byCountThenName);
  const presentTypes = entityTypes.map((t) => t.name);
  const countOf = (types: string[]) => types.reduce((n, t) => n + (byType.get(t)?.length ?? 0), 0);

  const cover = new Map<string, string[]>();
  for (const type of presentTypes) {
    for (const ancestor of ancestorsOf(type)) {
      if (TOO_ABSTRACT.has(ancestor)) continue;
      const covered = cover.get(ancestor);
      if (covered) covered.push(type);
      else cover.set(ancestor, [type]);
    }
  }

  // Two supertypes covering the identical set of present types say the same
  // thing; the broader one adds nothing, so only the deepest survives.
  const bestForCoverage = new Map<string, { name: string; types: string[] }>();
  for (const [name, types] of cover) {
    if (types.length < 2) continue;
    const key = [...types].sort().join("|");
    const previous = bestForCoverage.get(key);
    if (!previous || ancestorsOf(name).length > ancestorsOf(previous.name).length) {
      bestForCoverage.set(key, { name, types });
    }
  }

  const groups: GroupSummary[] = [...bestForCoverage.values()]
    .map((group) => ({ ...group, count: countOf(group.types) }))
    .sort(byCountThenName);
  const groupByName = new Map(groups.map((g) => [g.name, g]));

  const groupChain = (type: string) =>
    ancestorsOf(type)
      .filter((ancestor) => groupByName.has(ancestor))
      .reverse();

  interface RawNode {
    name: string;
    kind: "group" | "type";
    count: number;
    children: Map<string, RawNode>;
  }
  const root = new Map<string, RawNode>();
  const descend = (type: string) => {
    let level = root;
    for (const group of groupChain(type)) {
      let node = level.get(group);
      if (!node) {
        node = { name: group, kind: "group", count: 0, children: new Map() };
        level.set(group, node);
      }
      level = node.children;
    }
    return level;
  };
  // Branches first: a present type can share its name with a qualifying group
  // at the same level, and the leaf must not clobber that group's children.
  for (const type of presentTypes) descend(type);
  for (const type of presentTypes) {
    const level = descend(type);
    const collision = level.get(type);
    const target = collision?.kind === "group" ? collision.children : level;
    target.set(type, { name: type, kind: "type", count: byType.get(type)!.length, children: new Map() });
  }

  const finish = (node: RawNode): TreeNode => {
    if (node.kind === "type") return { name: node.name, kind: "type", count: node.count, typeCount: 1, children: [] };
    const children = [...node.children.values()].map(finish).sort(byCountThenName);
    return {
      name: node.name,
      kind: "group",
      children,
      count: children.reduce((n, child) => n + child.count, 0),
      typeCount: children.reduce((n, child) => n + child.typeCount, 0),
    };
  };
  const tree = [...root.values()].map(finish).sort(byCountThenName);

  const canonicalSelectable = new Map<string, string>();
  for (const name of [...presentTypes, ...groupByName.keys()]) {
    canonicalSelectable.set(name.toUpperCase(), name);
  }
  const resolveOne = (name: string): string[] => {
    const selectable = canonicalSelectable.get(name.trim().toUpperCase());
    if (!selectable) return [];
    return groupByName.get(selectable)?.types ?? [selectable];
  };
  const resolveTypes = (names: string[]) => [...new Set(names.flatMap(resolveOne))];

  const fieldsFor = (names: string[]): FieldsForResult => {
    const pool = resolveTypes(names).flatMap((type) => byType.get(type) ?? []);
    const attributes = new Map<string, FieldAccumulator>();
    const propertySets = new Map<string, Map<string, FieldAccumulator>>();

    for (const element of pool) {
      for (const [name, value] of attributeEntries(element)) {
        accumulate(attributes, name, null, value);
      }
      for (const [setName, fields] of Object.entries(element.propertySets)) {
        let bag = propertySets.get(setName);
        if (!bag) {
          bag = new Map();
          propertySets.set(setName, bag);
        }
        for (const [name, slot] of Object.entries(fields)) {
          if (isFilled(slot.value)) accumulate(bag, name, setName, slot.value);
        }
      }
    }

    const total = pool.length || 1;
    const summarise = (record: FieldAccumulator): FieldSummary => ({
      name: record.name,
      propertySet: record.propertySet,
      hits: record.hits,
      coverage: record.hits / total,
      values: [...record.values.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    });
    const rank = (a: FieldSummary, b: FieldSummary) => b.hits - a.hits || a.name.localeCompare(b.name);

    return {
      total: pool.length,
      attributes: [...attributes.values()].map(summarise).sort(rank),
      propertySets: [...propertySets.entries()]
        .map(([name, bag]) => ({ name, fields: [...bag.values()].map(summarise).sort(rank) }))
        .filter((set) => set.fields.length > 0)
        .sort((a, b) => b.fields[0].hits - a.fields[0].hits || a.name.localeCompare(b.name)),
    };
  };

  return { entityTypes, groups, tree, resolveTypes, fieldsFor };
}
