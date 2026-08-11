import type { PartOfRelation } from "@ifc-qa/shared-types";

/** The six IFC relationships an IDS `partOf` facet can name. */
export const PART_OF_RELATION_NAMES = new Set([
  "IFCRELAGGREGATES",
  "IFCRELASSIGNSTOGROUP",
  "IFCRELCONTAINEDINSPATIALSTRUCTURE",
  "IFCRELNESTS",
  "IFCRELVOIDSELEMENT",
  "IFCRELFILLSELEMENT",
]);

/** What a whole has to offer a `partOf` facet: its type, and the predefined type it may be asked for. */
export interface WholeIdentity {
  ifcType: string;
  predefinedType: string | null;
}

/** One step up from a part to a whole, tagged with the relationship that connects them. */
export interface PartOfEdge {
  relation: string;
  wholeId: number;
}

/**
 * Builds the resolver that turns "which wholes does this entity belong to" into the list a
 * `partOf` facet is checked against, ancestors included.
 *
 * Shared by both adapters on purpose. The two engines find the edges very differently — ifc-lite
 * has a relationship graph, web-ifc has raw lines — but the rule for *walking* them is IDS
 * semantics, not engine detail, and stating it twice is how the two would drift apart.
 *
 * **Ancestors are followed only through the same relation.** A beam contained in a space that is
 * aggregated into a building is not part of that building by aggregation, and the conformance
 * suite states exactly that document as one that must fail. Chaining across relations would turn
 * it into a pass.
 *
 * `visiting` guards against a cycle in a malformed file, which makes the answer truncated rather
 * than the parse non-terminating.
 */
export function resolvePartOf(
  edgesOf: (expressId: number) => PartOfEdge[],
  identify: (expressId: number) => WholeIdentity | null
): (expressId: number) => PartOfRelation[] {
  const cache = new Map<number, PartOfRelation[]>();
  const visiting = new Set<number>();

  return function wholesOf(expressId: number): PartOfRelation[] {
    const cached = cache.get(expressId);
    if (cached) return cached;
    if (visiting.has(expressId)) return [];
    visiting.add(expressId);

    const seen = new Set<string>();
    const wholes: PartOfRelation[] = [];
    const add = (whole: PartOfRelation) => {
      // A diamond in the decomposition tree reaches the same whole twice; the facet only ever
      // asks whether one matches, so a duplicate is noise in every message that prints it.
      const key = `${whole.relation}|${whole.ifcType}|${whole.predefinedType ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      wholes.push(whole);
    };

    for (const edge of edgesOf(expressId)) {
      if (!PART_OF_RELATION_NAMES.has(edge.relation)) continue;

      const whole = identify(edge.wholeId);
      if (whole === null) continue;
      add({ relation: edge.relation, ifcType: whole.ifcType, predefinedType: whole.predefinedType });

      for (const ancestor of wholesOf(edge.wholeId)) {
        if (ancestor.relation === edge.relation) add(ancestor);
      }
    }

    visiting.delete(expressId);
    // Sorted because the order is an artifact of how each engine happens to enumerate
    // relationships — ifc-lite walks one CSR edge list, web-ifc walks the six relationship types
    // in turn — and a facet only ever asks whether *some* whole matches. Leaving it unsorted made
    // the two engines disagree on an opening that is both voided by a wall and contained in a
    // storey, which is a difference with no meaning behind it.
    wholes.sort(
      (a, b) =>
        a.relation.localeCompare(b.relation) ||
        a.ifcType.localeCompare(b.ifcType) ||
        (a.predefinedType ?? "").localeCompare(b.predefinedType ?? "")
    );
    cache.set(expressId, wholes);
    return wholes;
  };
}
