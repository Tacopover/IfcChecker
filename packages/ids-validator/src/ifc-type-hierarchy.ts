import { IFC_ABSTRACT_ENTITY_NAMES, IFC_ENTITY_PARENTS, IFC_LEGACY_TYPE_NAMES } from "@ifc-qa/shared-types";

export const IFC_SCHEMA = "IFC4" as const;

// The explorer rail asks for a type's ancestors once per type in the model, and
// the builder expands a pick into its descendants on every keystroke, so every
// lookup here has to be a synchronous map hit. The chains are therefore
// flattened once at module load from the generated parent map rather than
// walked on demand — and the table has to be a committed artifact, since
// @ifc-lite/data only exposes the schema asynchronously.
//
// The map covers the whole schema, not just the product subtree: an
// applicability naming IfcWallType or IfcTypeObject has to resolve, and while
// the table stopped at IfcProduct it could not, so those rules matched nothing
// and reported the model clean.
const CANONICAL_BY_UPPER = new Map<string, string>();
const ANCESTORS = new Map<string, string[]>();
const DESCENDANTS = new Map<string, string[]>();
const LEGACY = new Set<string>(IFC_LEGACY_TYPE_NAMES);
const ABSTRACT = new Set<string>(IFC_ABSTRACT_ENTITY_NAMES);

for (const name of Object.keys(IFC_ENTITY_PARENTS)) {
  CANONICAL_BY_UPPER.set(name.toUpperCase(), name);
  const parent = IFC_ENTITY_PARENTS[name];
  // The generated map is depth-first, so a parent's chain is always already
  // resolved by the time its children are read.
  const chain = parent === null ? [] : [parent, ...(ANCESTORS.get(parent) ?? [])];
  ANCESTORS.set(name, chain);
  DESCENDANTS.set(name, []);
  for (const ancestor of chain) DESCENDANTS.get(ancestor)!.push(name);
}

export function canonicalIfcType(t: string): string | null {
  return CANONICAL_BY_UPPER.get(t.trim().toUpperCase()) ?? null;
}

export function isKnownIfcType(t: string): boolean {
  return canonicalIfcType(t) !== null;
}

/** True for names IFC2X3 declared and IFC4 dropped, e.g. IfcElectricalElement. */
export function isLegacyIfcType(t: string): boolean {
  const canonical = canonicalIfcType(t);
  return canonical !== null && LEGACY.has(canonical);
}

export function ancestorsOf(t: string): string[] {
  const canonical = canonicalIfcType(t);
  return canonical ? [...(ANCESTORS.get(canonical) ?? [])] : [];
}

export function descendantsOf(t: string): string[] {
  const canonical = canonicalIfcType(t);
  return canonical ? [...(DESCENDANTS.get(canonical) ?? [])] : [];
}

/** True for entities EXPRESS declares ABSTRACT, which no instance can carry. */
export function isAbstractIfcType(t: string): boolean {
  const canonical = canonicalIfcType(t);
  return canonical !== null && ABSTRACT.has(canonical);
}

/**
 * The names an IDS entity facet has to list to select everything `t` covers, given that IDS
 * matches a name exactly and inherits nothing (`Documentation/UserManual/entity-facet.md`).
 *
 * That is `t` itself plus every concrete entity below it, with the abstract ones dropped — an
 * abstract name in a facet selects nothing, so emitting it would only make the file longer. A
 * name outside the schema table is returned unchanged: it may be a class from a schema version
 * this build does not carry, and rewriting it to nothing would silently gut the rule.
 */
export function concreteTypeNamesFor(t: string): string[] {
  const canonical = canonicalIfcType(t);
  if (!canonical) return [t.trim().toUpperCase()];
  const names = [canonical, ...(DESCENDANTS.get(canonical) ?? [])].filter((name) => !ABSTRACT.has(name));
  return names.map((name) => name.toUpperCase());
}

/**
 * The chip list a one-click "expand" replaces `t` with — `t` itself when something can carry it
 * directly, plus every concrete entity below it. The same set `concreteTypeNamesFor` compiles a
 * rule down to, kept in the tree's own mixed-case spelling rather than forced upper-case, because
 * this feeds an editable chip list a user reads, not the exported document.
 */
export function expandedTypeNamesFor(t: string): string[] {
  const canonical = canonicalIfcType(t);
  if (!canonical) return [t];
  const descendants = (DESCENDANTS.get(canonical) ?? []).filter((name) => !ABSTRACT.has(name));
  return ABSTRACT.has(canonical) ? descendants : [canonical, ...descendants];
}

export function isSubtypeOf(t: string, candidate: string): boolean {
  const type = canonicalIfcType(t);
  const target = canonicalIfcType(candidate);
  // Unknown types still compare by name, so a rule against a type outside the
  // table keeps matching the elements that literally carry it.
  if (!type || !target) return t.trim().toUpperCase() === candidate.trim().toUpperCase();
  return type === target || (ANCESTORS.get(type) ?? []).includes(target);
}
