import { isIntegerAttribute } from "@ifc-qa/shared-types";
import type {
  NormalizedElement,
  NormalizedValue,
  PropertyValue,
  UnitScales,
} from "@ifc-qa/shared-types";
import type {
  ParsedApplicability,
  ParsedAttributeFacet,
  ParsedBound,
  ParsedClassificationFacet,
  ParsedEntityFacet,
  ParsedLength,
  ParsedMaterialFacet,
  ParsedPartOfFacet,
  ParsedPropertyFacet,
  ParsedRequirementFacet,
  ParsedRestriction,
} from "./parse-ids.js";

export interface FacetCheckResult {
  passed: boolean;
  message: string;
}

/**
 * The facets that read one value slot off the element.
 *
 * A classification is not one of them: it matches a *set* of references, each with two parameters
 * of its own, so the slot-reading helpers below say nothing useful about it and are typed to
 * exclude it rather than silently returning null for it.
 */
type SlotFacet = ParsedAttributeFacet | ParsedPropertyFacet;

/**
 * One value slot a facet named, carrying the name the *model* spells it with.
 *
 * A facet may name its attribute or its property with a pattern, so the name in the message has to
 * come from the element rather than from the rule — "Property matching Foo.* is wrong" says less
 * than "Property Foobaz is wrong".
 */
interface MatchedSlot {
  name: string;
  /** The set the property was found in. Absent on an attribute, which is in no set. */
  propertySet?: string;
  value: NormalizedValue;
}

/** The matched slots that share a property set, or the whole attribute match as one group. */
interface SlotGroup {
  /** How a message names the group when nothing in it states a value. */
  missing: string;
  slots: MatchedSlot[];
}

/**
 * The three identity fields live on the element rather than in its attribute bag, so they are
 * wrapped here to give every read the same shape. They carry no measure type by construction.
 */
const TOP_LEVEL_ATTRIBUTE_READERS: Record<string, (element: NormalizedElement) => PropertyValue | null> = {
  GLOBALID: (element) => element.globalId,
  NAME: (element) => element.name,
  PREDEFINEDTYPE: (element) => element.predefinedType,
};

/**
 * The same three, spelled as IFC spells them.
 *
 * A pattern-valued name is matched against the names an element actually has, and neither adapter
 * puts these three in `attributes` — they are fields on `NormalizedElement`. Without them a facet
 * naming `Name` and `Description` together would see only `Description`, and the suite states that
 * exact document as one that must pass.
 */
const TOP_LEVEL_ATTRIBUTE_NAMES = ["GlobalId", "Name", "PredefinedType"];

/**
 * Whether the element is one the specification is about.
 *
 * Every part must hold: the classes the `<entity>` lists, and every other facet standing beside it.
 * IDS states no `or` anywhere, and `ifctester` chains one filter per facet for the same reason.
 *
 * A `null` name list is an applicability with no `<entity>` at all, which `ids.xsd` allows — the
 * rule then reaches every entity in scope that its other facets admit, rather than none.
 * `isEvaluable` refuses the one shape that leaves, an applicability stating nothing whatsoever.
 */
export function matchesApplicability(
  element: NormalizedElement,
  applicability: ParsedApplicability,
  /** Empty for a model already in SI, exactly as on the requirements side. */
  unitScales: UnitScales = {}
): boolean {
  if (!matchesApplicabilityEntity(element, applicability.entityNames)) return false;
  return applicability.facets.every(
    (facet) => evaluateRequirement(element, facet, unitScales).passed
  );
}

/**
 * An applicability entity name matches exactly, the same way a requirement's does.
 *
 * `Documentation/UserManual/entity-facet.md` states it twice and scopes neither statement to
 * requirements: the class "must match exactly", and "there is no automatic inheritance in IDS
 * entity facet interpretation … all the entities need to be listed explicitly". The document then
 * supplies copy-paste lists of every IfcElement subtype per schema version, precisely because
 * there is none. IfcOpenShell's `ifctester` selects with
 * `by_type(name, include_subtypes=False)` — the flag written out rather than defaulted.
 *
 * The conformance suite cannot decide this: every applicability name in it is present literally in
 * its own model, so exact and subtype matching agree on all 334 cases. What decides it is that a
 * user who checks a model here and then with any other conforming checker must get the same
 * applicable count.
 *
 * A supertype the user picked in the builder reaches the file as the concrete classes it stands
 * for (`applicabilityEntityNamesOf`), so nothing authored here loses elements. An imported file
 * naming an abstract class now selects nothing — and fails on applicability cardinality, which is
 * a loud result rather than a quiet one.
 *
 * `null` is an applicability with no `<entity>` element, which admits every class — the facets
 * beside it are then the whole of the selection.
 */
export function matchesApplicabilityEntity(
  element: NormalizedElement,
  entityNames: string[] | null
): boolean {
  if (entityNames === null) return true;
  const ifcType = element.ifcType.trim().toUpperCase();
  return entityNames.some((entityName) => ifcType === entityName.trim().toUpperCase());
}

function readAttributeValue(element: NormalizedElement, attributeName: string): NormalizedValue | null {
  const topLevelReader = TOP_LEVEL_ATTRIBUTE_READERS[attributeName.toUpperCase()];
  if (topLevelReader) return { value: topLevelReader(element) };
  if (attributeName in element.attributes) return element.attributes[attributeName];

  // Hand-written IDS files are inconsistent about attribute casing, and a missed key would report
  // every element as missing the attribute — a far worse outcome than a lenient match.
  const wanted = attributeName.toUpperCase();
  for (const key of Object.keys(element.attributes)) {
    if (key.toUpperCase() === wanted) return element.attributes[key];
  }
  return null;
}

/**
 * Every attribute slot the facet's `<name>` reaches.
 *
 * An exact name reads the one slot it names, keeping the case-insensitive fallback above. Anything
 * else is matched against the names the element has, which is what `ifctester` does: it walks
 * `get_info()` and keeps the keys the restriction admits.
 */
function attributeSlotsOf(element: NormalizedElement, name: ParsedRestriction): MatchedSlot[] {
  if (name.kind === "exact") {
    const value = readAttributeValue(element, name.value);
    return value === null ? [] : [{ name: name.value, value }];
  }

  const slots: MatchedSlot[] = [];
  const candidates = new Set([...TOP_LEVEL_ATTRIBUTE_NAMES, ...Object.keys(element.attributes)]);
  for (const candidate of candidates) {
    if (!admitsString(name, candidate)) continue;
    const value = readAttributeValue(element, candidate);
    if (value !== null) slots.push({ name: candidate, value });
  }
  return slots;
}

/** Every property set the facet's `<propertySet>` reaches, each with the name the model gave it. */
function matchingPropertySets(
  element: NormalizedElement,
  propertySet: ParsedRestriction
): Array<[string, Record<string, NormalizedValue>]> {
  if (propertySet.kind === "exact") {
    const set = element.propertySets[propertySet.value];
    return set === undefined ? [] : [[propertySet.value, set]];
  }
  return Object.entries(element.propertySets).filter(([name]) => admitsString(propertySet, name));
}

/** Every property inside one set that the facet's `<baseName>` reaches. */
function propertySlotsIn(
  setName: string,
  set: Record<string, NormalizedValue>,
  baseName: ParsedRestriction
): MatchedSlot[] {
  if (baseName.kind === "exact") {
    const value = set[baseName.value];
    return value === undefined ? [] : [{ name: baseName.value, propertySet: setName, value }];
  }
  return Object.entries(set)
    .filter(([name]) => admitsString(baseName, name))
    .map(([name, value]) => ({ name, propertySet: setName, value }));
}

/**
 * The slots the facet is about, grouped the way IDS judges them.
 *
 * An attribute facet is one group: the suite's "name restrictions will match any result" pairs a
 * wall stating `Name` with one stating `Description` against the same two-name facet, and both
 * pass, so an empty slot beside a filled one is not a failure.
 *
 * A property facet is **one group per matching property set**, because IDS asks each of them
 * separately. The suite pins it: a wall with `Foo_Bar` holding `Foo` and `Foo_Baz` holding nothing
 * of the sort must *fail* a facet whose set is `Foo_.*` and whose property is `Foo`. Folding the
 * two sets into one group would find `Foo` somewhere and approve it.
 */
function slotGroupsOf(element: NormalizedElement, facet: SlotFacet): SlotGroup[] {
  if (facet.kind === "attribute") {
    const slots = attributeSlotsOf(element, facet.name);
    return slots.length === 0 ? [] : [{ missing: `${facetLabel(facet)} is missing`, slots }];
  }

  return matchingPropertySets(element, facet.propertySet).map(([setName, set]) => ({
    missing: `Property ${nameLabel(facet.baseName)} is missing in property set "${setName}"`,
    slots: propertySlotsIn(setName, set, facet.baseName),
  }));
}

/** An empty string counts as unfilled — that is what a modeller means by "not filled in". */
function isFilledIn(slot: NormalizedValue | null): boolean {
  return slot !== null && slot !== undefined && slot.value !== null && String(slot.value) !== "";
}

/** What the facet says it is about, as the file wrote it — a plain name, or the restriction. */
function nameLabel(restriction: ParsedRestriction): string {
  return restriction.kind === "exact" ? `"${restriction.value}"` : restrictionLabel(restriction);
}

function facetLabel(facet: SlotFacet): string {
  return facet.kind === "attribute"
    ? `Attribute ${nameLabel(facet.name)}`
    : `Property ${nameLabel(facet.baseName)} in property set ${nameLabel(facet.propertySet)}`;
}

/** The same, for one slot the element really holds, so the message names the real field. */
function slotLabel(facet: SlotFacet, slot: MatchedSlot): string {
  return facet.kind === "attribute"
    ? `Attribute "${slot.name}"`
    : `Property "${slot.name}" in property set "${slot.propertySet}"`;
}

function missingMessage(facet: SlotFacet): string {
  return facet.kind === "attribute"
    ? `${facetLabel(facet)} is missing`
    : `Property ${nameLabel(facet.baseName)} is missing in property set ${nameLabel(facet.propertySet)}`;
}

/**
 * XML Schema's lexical space for a number, which is what an IDS `<simpleValue>` is written in.
 *
 * Deliberately stricter than `parseFloat`, which reads "42,3" as 42 and would then match a stored
 * 42. The suite states that exact document as one that must fail, so the check has to reject the
 * literal outright rather than salvage a prefix of it.
 */
const XSD_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** `xs:integer`'s lexical space, which admits no point and no exponent. */
const XSD_INTEGER = /^[+-]?\d+$/;

/** The IDS equality tolerance, from `Documentation/ImplementersDocumentation/tolerance.md`. */
const TOLERANCE = 1e-6;

/**
 * Whether two floating-point numbers are equal under the tolerance IDS mandates:
 *
 *     x == v  ⇒  (v - abs(v) × ε - ε) < x < (v + abs(v) × ε + ε),  ε = 1e-6
 *
 * A relative and a fixed component together, so the rule holds for a wire area in square metres
 * and for the length of a railway alike. Without it a stored 0.999998 fails a specification asking
 * for 1.0, which is a rounding error being reported as a modelling error.
 *
 * Two departures from the formula as written, both forced by the suite, which places its passing
 * values exactly *on* the boundary:
 *
 * - The two epsilon terms are combined into one multiplication. `v + abs(v) * ε + ε` rounds to
 *   1.0000019999999998 for v = 1, just under the 1.000002 the suite requires to pass.
 * - The comparison is inclusive. The document writes `<`, but its own table presents these values
 *   as the tolerance edge and the suite expects them to pass.
 */
function equalWithinTolerance(stored: number, wanted: number): boolean {
  const epsilon = (Math.abs(wanted) + 1) * TOLERANCE;
  return wanted - epsilon <= stored && stored <= wanted + epsilon;
}

/**
 * Compares a stored value against a literal the specification wrote, as the type the model stored
 * rather than as text. A property IFC holds as the real 42 is written "42.0", "42." or "1.2345e3"
 * by different authors, and none of those is equal to "42" as a string.
 *
 * `wholeNumber` narrows the accepted lexical space: a value the schema types as an integer is not
 * matched by "42.0", even though the two are the same JS number and the same quantity. It also
 * withholds the tolerance, which IDS grants to floating-point numbers only — on a large integer a
 * relative tolerance would span whole numbers either side and approve the wrong one.
 */
function matchesLiteral(raw: PropertyValue, literal: string, wholeNumber: boolean): boolean {
  if (typeof raw === "number") {
    const trimmed = literal.trim();
    const lexical = wholeNumber ? XSD_INTEGER : XSD_NUMBER;
    if (!lexical.test(trimmed)) return false;
    const wanted = Number(trimmed);
    return wholeNumber ? wanted === raw : equalWithinTolerance(raw, wanted);
  }
  return String(raw) === literal;
}

/**
 * Whether the value behind this facet is a whole number by the schema's account rather than by
 * how it happens to have been written. `dataType` answers for a property; for an attribute only
 * the entity table can, since both an integer and a real arrive as a bare JS number.
 */
function holdsWholeNumber(
  element: NormalizedElement,
  facet: SlotFacet,
  slot: MatchedSlot
): boolean {
  return facet.kind === "property"
    ? slot.value.dataType?.toUpperCase() === "IFCINTEGER"
    : isIntegerAttribute(element.ifcType, slot.name);
}

/**
 * What the facet is allowed to match against.
 *
 * A bounded, list, table or enumerated property holds several values, and IDS passes the facet
 * when *any* of them matches. Without this the facet saw only the parser's rendering of the whole
 * set — "3000 [1000 – 5000]", "EXISTING, DEMOLISH" — which matches nothing an author would write.
 */
function candidatesOf(slot: NormalizedValue): PropertyValue[] {
  return slot.values !== undefined && slot.values.length > 0 ? slot.values : [slot.value];
}

/**
 * The candidates as IDS compares them: in SI, whatever unit the file was authored in.
 *
 * IDS states every numerical measure in its nominated standard unit, so a specification asking for
 * a length of 2 means two metres — and a millimetre model storing 2000 satisfies it while one
 * storing 2 does not. Comparing the raw numbers gets both of those exactly backwards, and the
 * suite pins the pair.
 *
 * The scale is keyed on the measure type the *model* stored, not the one the specification asked
 * for, because it is the model's number being converted. Only the number moves: `slot.value` keeps
 * the authored figure, so the element panel still shows what the file says.
 */
function comparableCandidates(slot: NormalizedValue, unitScales: UnitScales): PropertyValue[] {
  const candidates = candidatesOf(slot);
  // No stored measure type is no basis for a conversion. A table property reports none, so its
  // values stay as written rather than being rescaled on the strength of what the rule asked for.
  if (slot.dataType === undefined) return candidates;

  const scale = unitScales[slot.dataType.toUpperCase()] ?? 1;
  return candidates.map((held) => {
    const stored = storedNumber(held);
    return stored === null ? held : stored * scale;
  });
}

/**
 * A candidate as the number the file stored, or `null` when it is not one.
 *
 * The candidates behind a multi-valued property arrive as the literals the file wrote — ifc-lite
 * hands back `["1000", "5000", "3000"]` for a bounded length — so a measure's values are strings
 * even though the slot states a measure type. Reading them back as numbers is what lets the same
 * numeric comparison, tolerance and unit scaling apply to a bounded property as to a single value.
 */
function storedNumber(held: PropertyValue): number | null {
  if (typeof held === "number") return held;
  if (typeof held !== "string") return null;
  const trimmed = held.trim();
  return XSD_NUMBER.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Whether a held value sits inside the range a restriction states.
 *
 * **Comparison is exact**, and deliberately so: the tolerance rule that governs equality does not
 * apply to ranges (`Documentation/ImplementersDocumentation/tolerance.md`). That is what lets an
 * author write `v <= x <= v` to mean "exactly v, no tolerance at all", and the suite states a
 * `minInclusive` of 0 against a stored -1e-7 as a document that must fail — which any tolerance
 * here would approve.
 *
 * A range says nothing about a string or a boolean, so a non-numeric value is outside every range
 * rather than stringified into one.
 */
function withinBounds(held: PropertyValue, min: ParsedBound | null, max: ParsedBound | null): boolean {
  if (typeof held !== "number") return false;
  if (min && (min.inclusive ? held < min.value : held <= min.value)) return false;
  if (max && (max.inclusive ? held > max.value : held >= max.value)) return false;
  return true;
}

function boundsLabel(min: ParsedBound | null, max: ParsedBound | null): string {
  const parts: string[] = [];
  if (min) parts.push(`${min.inclusive ? ">=" : ">"} ${min.value}`);
  if (max) parts.push(`${max.inclusive ? "<=" : "<"} ${max.value}`);
  return parts.join(" and ");
}

/**
 * Whether a value holds the number of characters a length restriction states.
 *
 * All three edges are checked, because XSD lets an author write `xs:length` beside the two
 * bounds and keeping only one of them would stop enforcing a constraint the file states.
 */
function withinLength(text: string, length: ParsedLength): boolean {
  if (length.exact !== null && text.length !== length.exact) return false;
  if (length.min !== null && text.length < length.min) return false;
  if (length.max !== null && text.length > length.max) return false;
  return true;
}

function lengthLabel(length: ParsedLength): string {
  const parts: string[] = [];
  if (length.exact !== null) parts.push(`exactly ${length.exact}`);
  if (length.min !== null) parts.push(`at least ${length.min}`);
  if (length.max !== null) parts.push(`at most ${length.max}`);
  return `${parts.join(" and ")} characters long`;
}

function restrictionFailure(
  label: string,
  restriction: ParsedRestriction,
  slot: NormalizedValue,
  wholeNumber: boolean,
  unitScales: UnitScales
): string | null {
  const raw = slot.value;
  const value = String(raw);
  const candidates = comparableCandidates(slot, unitScales);
  switch (restriction.kind) {
    case "exact":
      return candidates.some((held) => matchesLiteral(held, restriction.value, wholeNumber))
        ? null
        : `${label} value "${value}" must be "${restriction.value}"`;
    case "enum":
      return candidates.some((held) =>
        restriction.values.some((allowed) => matchesLiteral(held, allowed, wholeNumber))
      )
        ? null
        : `${label} value "${value}" is not one of: ${restriction.values.join(", ")}`;
    case "pattern":
      // IDS: a pattern applies to strings and nothing else. Stringifying first
      // made `.*` match a number, which is the specification's own example of
      // what must fail.
      if (typeof raw !== "string") {
        return `${label} holds ${typeof raw === "number" ? "a number" : "a boolean"} (${value}), and a pattern can only be matched against a string`;
      }
      return restriction.regex.test(value)
        ? null
        : `${label} value "${value}" does not match required pattern "${restriction.source}"`;
    case "bounds":
      return candidates.some((held) => withinBounds(held, restriction.min, restriction.max))
        ? null
        : `${label} value "${value}" is not ${boundsLabel(restriction.min, restriction.max)}`;
    case "length":
      // Counted on the candidates as the file wrote them, not on `candidates`: a unit conversion
      // rewrites 2 as 2000 and would change the number of characters the author sees.
      return candidatesOf(slot).some((held) => withinLength(String(held), restriction))
        ? null
        : `${label} value "${value}" is not ${lengthLabel(restriction)}`;
  }
}

/**
 * Whether a restriction admits a string, with none of the numeric machinery above.
 *
 * A classification code, a system name and a material name are text by construction — `EF_25_10`
 * is not a number that happens to be written oddly — so there is no lexical casting, no tolerance
 * and no unit conversion here. A numeric range says nothing about such a value, so `bounds`
 * admits nothing rather than coercing the string into a comparison it was never meant for.
 */
function admitsString(restriction: ParsedRestriction, candidate: string): boolean {
  switch (restriction.kind) {
    case "exact":
      return candidate === restriction.value;
    case "enum":
      return restriction.values.includes(candidate);
    case "pattern":
      return restriction.regex.test(candidate);
    case "bounds":
      return false;
    case "length":
      return withinLength(candidate, restriction);
  }
}

/** `null` states no constraint, so it admits everything — including an element that has no value. */
function admitsAny(restriction: ParsedRestriction | null, candidates: string[]): boolean {
  if (restriction === null) return true;
  return candidates.some((candidate) => admitsString(restriction, candidate));
}

function restrictionLabel(restriction: ParsedRestriction): string {
  switch (restriction.kind) {
    case "exact":
      return `"${restriction.value}"`;
    case "enum":
      return `one of: ${restriction.values.join(", ")}`;
    case "pattern":
      return `matching "${restriction.source}"`;
    case "bounds":
      return boundsLabel(restriction.min, restriction.max);
    case "length":
      return lengthLabel(restriction);
  }
}

function classificationLabel(facet: ParsedClassificationFacet): string {
  const parts: string[] = [];
  if (facet.system) parts.push(`system ${restrictionLabel(facet.system)}`);
  if (facet.value) parts.push(`value ${restrictionLabel(facet.value)}`);
  return parts.length > 0 ? `a classification with ${parts.join(" and ")}` : "any classification";
}

/**
 * Whether the element carries a classification the facet accepts.
 *
 * Both parameters must be satisfied by **the same reference** — IDS says all stated parameters
 * must match, not any, so an element classified `Uniclass · EF_25` and separately `NLSfB · 21`
 * does not satisfy a facet asking for `Uniclass · 21`.
 *
 * `optional` turns on whether the element is classified **at all**, not on whether it is classified
 * in the system the facet names. The suite pins the difference: a wall associated with an
 * `IfcClassification` whose name is empty does not match a `\w+` system, yet an optional facet
 * against it must *fail* rather than being waived. The element carries a classification, so the
 * rule engages — scoping the waiver by system would approve exactly the case that must fail.
 */
function evaluateClassification(
  element: NormalizedElement,
  facet: ParsedClassificationFacet
): FacetCheckResult {
  const references = element.classifications ?? [];
  const matching = references.filter(
    (reference) =>
      admitsAny(facet.system, reference.system === null ? [] : [reference.system]) &&
      admitsAny(facet.value, reference.identifications)
  );

  if (facet.cardinality === "prohibited") {
    return matching.length === 0
      ? { passed: true, message: "" }
      : { passed: false, message: `Element must not have ${classificationLabel(facet)}` };
  }

  if (facet.cardinality === "optional" && references.length === 0) {
    return { passed: true, message: "" };
  }

  return matching.length > 0
    ? { passed: true, message: "" }
    : {
        passed: false,
        message:
          references.length === 0
            ? `Element has no classification, but ${classificationLabel(facet)} is required`
            : `Element has no ${classificationLabel(facet)}`,
      };
}

/**
 * Whether the element is made of a material the facet accepts.
 *
 * The distinction that carries the weight is between an element with *no* material association
 * and one whose association names nothing. A facet stating no value asks only whether a material
 * is present, so the first fails it and the second passes — and a value check fails both, because
 * there is nothing to match either way.
 *
 * `optional` waives the facet on the same footing as a classification: only when the element has
 * no material at all.
 */
function evaluateMaterial(
  element: NormalizedElement,
  facet: ParsedMaterialFacet
): FacetCheckResult {
  const materials = element.materials ?? null;
  const wanted = facet.value === null ? "a material" : `a material ${restrictionLabel(facet.value)}`;
  const matches = materials !== null && admitsAny(facet.value, materials);

  if (facet.cardinality === "prohibited") {
    return matches
      ? { passed: false, message: `Element must not have ${wanted}` }
      : { passed: true, message: "" };
  }

  if (facet.cardinality === "optional" && materials === null) {
    return { passed: true, message: "" };
  }

  if (matches) return { passed: true, message: "" };
  return {
    passed: false,
    message:
      materials === null
        ? `Element has no material, but ${wanted} is required`
        : `Element is made of ${materials.length > 0 ? materials.join(", ") : "an unnamed material"}, which is not ${wanted}`,
  };
}

function partOfLabel(facet: ParsedPartOfFacet): string {
  const entity = facet.entityName === null ? "anything" : `a ${restrictionLabel(facet.entityName)}`;
  const predefined =
    facet.predefinedType === null ? "" : ` of predefined type ${restrictionLabel(facet.predefinedType)}`;
  const via = facet.relations.length === 0 ? "" : ` by ${facet.relations.join(" or ")}`;
  return `part of ${entity}${predefined}${via}`;
}

/**
 * Whether the element is a part of a whole the facet accepts.
 *
 * The entity is matched on its type name **exactly**, not by subtype: the suite says a group's
 * entity "must match exactly", so an `IfcGroup` rule is not satisfied by an `IfcSystem`. That is
 * the opposite of how an applicability entity name works, and deliberately so.
 *
 * Chaining through ancestors is the adapter's job; by the time a facet sees `element.partOf` the
 * ancestral wholes are already listed, each tagged with the relation that reaches it.
 */
function evaluatePartOf(element: NormalizedElement, facet: ParsedPartOfFacet): FacetCheckResult {
  const matching = (element.partOf ?? []).filter((whole) => {
    if (facet.relations.length > 0 && !facet.relations.includes(whole.relation)) return false;
    if (!admitsAny(facet.entityName, [whole.ifcType])) return false;
    return admitsAny(
      facet.predefinedType,
      whole.predefinedType === null ? [] : [whole.predefinedType]
    );
  });

  if (facet.cardinality === "prohibited") {
    return matching.length === 0
      ? { passed: true, message: "" }
      : { passed: false, message: `Element must not be ${partOfLabel(facet)}` };
  }

  return matching.length > 0
    ? { passed: true, message: "" }
    : { passed: false, message: `Element is not ${partOfLabel(facet)}` };
}

/**
 * Whether the element is the class — and, where stated, carries the predefined type — the facet
 * requires.
 *
 * The class name is matched **exactly**, not by subtype. `entity-facet.md` says it outright:
 * "There is no automatic inheritance in IDS entity facet interpretation … all the entities need to
 * be listed explicitly", and the suite pins it from the failing side — an `IfcWallStandardCase`
 * does not satisfy a requirement naming `IFCWALL`. This is the same rule partOf follows.
 *
 * The comparison is also **case-sensitive**, against the uppercase name both adapters report. IDS
 * requires an entity name to be written in upper case, so `IfcWall` names no class at all and a
 * lenient match would approve a document the suite states must fail. The same holds for a
 * user-defined predefined type: `waldo` is not `WALDO`.
 *
 * A stated predefined type is never satisfied by an element that has none — "unstated" is not a
 * value that can match one.
 *
 * An element that says `USERDEFINED` and names its own type elsewhere answers to **both** strings:
 * the name it resolves to and the enumeration literal. That is stated in `entity-facet.md`'s table
 * of examples, and the suite pairs the two halves against one model.
 */
function evaluateEntity(element: NormalizedElement, facet: ParsedEntityFacet): FacetCheckResult {
  if (!admitsString(facet.name, element.ifcType)) {
    return {
      passed: false,
      message: `Element is an ${element.ifcType}, but the specification requires ${restrictionLabel(facet.name)}`,
    };
  }

  if (facet.predefinedType === null) return { passed: true, message: "" };

  const predefinedType = element.predefinedType;
  if (predefinedType === null) {
    return {
      passed: false,
      message: `Element has no predefined type, but ${restrictionLabel(facet.predefinedType)} is required`,
    };
  }

  const candidates = [predefinedType];
  if (element.storedPredefinedType) candidates.push(element.storedPredefinedType);

  return admitsAny(facet.predefinedType, candidates)
    ? { passed: true, message: "" }
    : {
        passed: false,
        message: `Element has predefined type "${predefinedType}", but the specification requires ${restrictionLabel(facet.predefinedType)}`,
      };
}

/**
 * Whether the element satisfies an attribute or property requirement.
 *
 * The facet names a *set* of slots, which is one slot in every file the builder writes and in
 * nearly every file in the wild — but a pattern-valued name reaches several, and IDS then requires
 * **every one of them** to satisfy the value. `ifctester` collects the matches and breaks out of
 * the loop on the first that fails; the suite states three documents whose only failing property is
 * the second one matched.
 *
 * Slots the model leaves empty are dropped before the value is judged, not failed: a facet naming
 * `Name` and `Description` is satisfied by an element that fills in one of them. At least one must
 * survive, which is what keeps "the element has none of these" a failure.
 */
function evaluateSlotFacet(
  element: NormalizedElement,
  facet: SlotFacet,
  unitScales: UnitScales
): FacetCheckResult {
  const groups = slotGroupsOf(element, facet);
  const filled = groups.map((group) => group.slots.filter((slot) => isFilledIn(slot.value)));

  if (facet.cardinality === "prohibited") {
    const held = filled.flat()[0];
    return held === undefined
      ? { passed: true, message: "" }
      : {
          passed: false,
          message: `${slotLabel(facet, held)} must not be filled in, but has value "${String(held.value.value)}"`,
        };
  }

  // An optional requirement is checked only where the model states the value at all. The line is
  // between absent and empty, not between absent and satisfactory: the suite pairs a wall whose
  // Name is `$` (passes) with one whose Name is `''` (fails) against the same optional facet. An
  // empty string is a value the author wrote, so it is judged.
  const statesAValue = groups.some((group) => group.slots.some((slot) => slot.value.value !== null));
  if (facet.cardinality === "optional" && !statesAValue) {
    return { passed: true, message: "" };
  }

  if (groups.length === 0) {
    return { passed: false, message: missingMessage(facet) };
  }

  for (const [index, group] of groups.entries()) {
    if (filled[index].length === 0) {
      return { passed: false, message: group.missing };
    }

    for (const slot of filled[index]) {
      // `dataType` was carried through import and export and then ignored, so a specification
      // asking for an IFCTIMEMEASURE was satisfied by a stored IFCMASSMEASURE of the same number.
      //
      // Only enforced where the parser reports the stored type. A multi-valued property carries its
      // candidates instead of a measure type, and a value with no measure semantics carries none
      // either — failing on "we do not know" would reject the list and enumerated properties the
      // suite requires to pass, which trades one wrong answer for several.
      if (facet.kind === "property" && facet.dataType !== null && slot.value.dataType !== undefined) {
        if (slot.value.dataType.toUpperCase() !== facet.dataType.toUpperCase()) {
          return {
            passed: false,
            message: `${slotLabel(facet, slot)} is stored as ${slot.value.dataType}, but the specification requires ${facet.dataType}`,
          };
        }
      }

      if (facet.restriction) {
        const failure = restrictionFailure(
          slotLabel(facet, slot),
          facet.restriction,
          slot.value,
          holdsWholeNumber(element, facet, slot),
          unitScales
        );
        if (failure) return { passed: false, message: failure };
      }
    }
  }

  return { passed: true, message: "" };
}

export function evaluateRequirement(
  element: NormalizedElement,
  facet: ParsedRequirementFacet,
  /** Empty for a model already in SI, and for a caller that has no unit information at all. */
  unitScales: UnitScales = {}
): FacetCheckResult {
  if (facet.kind === "classification") return evaluateClassification(element, facet);
  if (facet.kind === "material") return evaluateMaterial(element, facet);
  if (facet.kind === "partOf") return evaluatePartOf(element, facet);
  if (facet.kind === "entity") return evaluateEntity(element, facet);
  return evaluateSlotFacet(element, facet, unitScales);
}
