import { isIntegerAttribute } from "@ifc-qa/shared-types";
import type {
  NormalizedElement,
  NormalizedValue,
  PropertyValue,
  UnitScales,
} from "@ifc-qa/shared-types";
import type { ParsedBound, ParsedRequirementFacet, ParsedRestriction } from "./parse-ids.js";
import { isSubtypeOf } from "./ifc-type-hierarchy.js";

export interface FacetCheckResult {
  passed: boolean;
  message: string;
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

export function matchesApplicability(element: NormalizedElement, entityNames: string[]): boolean {
  return entityNames.some((entityName) => isSubtypeOf(element.ifcType, entityName));
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

function readFacetValue(
  element: NormalizedElement,
  facet: ParsedRequirementFacet
): NormalizedValue | null {
  if (facet.kind === "attribute") {
    return readAttributeValue(element, facet.name);
  }
  const propertySet = element.propertySets[facet.propertySet];
  const value = propertySet ? propertySet[facet.baseName] : undefined;
  return value === undefined ? null : value;
}

/** An empty string counts as unfilled — that is what a modeller means by "not filled in". */
function isFilledIn(slot: NormalizedValue | null): boolean {
  return slot !== null && slot !== undefined && slot.value !== null && String(slot.value) !== "";
}

function facetLabel(facet: ParsedRequirementFacet): string {
  return facet.kind === "attribute"
    ? `Attribute "${facet.name}"`
    : `Property "${facet.baseName}" in property set "${facet.propertySet}"`;
}

function missingMessage(facet: ParsedRequirementFacet): string {
  return facet.kind === "attribute"
    ? `Attribute "${facet.name}" is missing`
    : `Property "${facet.baseName}" is missing in property set "${facet.propertySet}"`;
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
  facet: ParsedRequirementFacet,
  slot: NormalizedValue
): boolean {
  return facet.kind === "property"
    ? slot.dataType?.toUpperCase() === "IFCINTEGER"
    : isIntegerAttribute(element.ifcType, facet.name);
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

function restrictionFailure(
  facet: ParsedRequirementFacet,
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
        : `${facetLabel(facet)} value "${value}" must be "${restriction.value}"`;
    case "enum":
      return candidates.some((held) =>
        restriction.values.some((allowed) => matchesLiteral(held, allowed, wholeNumber))
      )
        ? null
        : `${facetLabel(facet)} value "${value}" is not one of: ${restriction.values.join(", ")}`;
    case "pattern":
      // IDS: a pattern applies to strings and nothing else. Stringifying first
      // made `.*` match a number, which is the specification's own example of
      // what must fail.
      if (typeof raw !== "string") {
        return `${facetLabel(facet)} holds ${typeof raw === "number" ? "a number" : "a boolean"} (${value}), and a pattern can only be matched against a string`;
      }
      return restriction.regex.test(value)
        ? null
        : `${facetLabel(facet)} value "${value}" does not match required pattern "${restriction.source}"`;
    case "bounds":
      return candidates.some((held) => withinBounds(held, restriction.min, restriction.max))
        ? null
        : `${facetLabel(facet)} value "${value}" is not ${boundsLabel(restriction.min, restriction.max)}`;
  }
}

export function evaluateRequirement(
  element: NormalizedElement,
  facet: ParsedRequirementFacet,
  /** Empty for a model already in SI, and for a caller that has no unit information at all. */
  unitScales: UnitScales = {}
): FacetCheckResult {
  const slot = readFacetValue(element, facet);
  const filledIn = isFilledIn(slot);

  if (facet.cardinality === "prohibited") {
    return filledIn
      ? {
          passed: false,
          message: `${facetLabel(facet)} must not be filled in, but has value "${String(slot?.value)}"`,
        }
      : { passed: true, message: "" };
  }

  // An optional requirement is checked only where the model states the value at all. The line is
  // between absent and empty, not between absent and satisfactory: the suite pairs a wall whose
  // Name is `$` (passes) with one whose Name is `''` (fails) against the same optional facet. An
  // empty string is a value the author wrote, so it is judged.
  if (facet.cardinality === "optional" && (slot === null || slot.value === null)) {
    return { passed: true, message: "" };
  }

  if (!filledIn) {
    return { passed: false, message: missingMessage(facet) };
  }

  // `dataType` was carried through import and export and then ignored, so a specification asking
  // for an IFCTIMEMEASURE was satisfied by a stored IFCMASSMEASURE of the same number.
  //
  // Only enforced where the parser reports the stored type. A multi-valued property carries its
  // candidates instead of a measure type, and a value with no measure semantics carries none
  // either — failing on "we do not know" would reject the list and enumerated properties the suite
  // requires to pass, which trades one wrong answer for several.
  if (facet.kind === "property" && facet.dataType !== null && slot?.dataType !== undefined) {
    if (slot.dataType.toUpperCase() !== facet.dataType.toUpperCase()) {
      return {
        passed: false,
        message: `${facetLabel(facet)} is stored as ${slot.dataType}, but the specification requires ${facet.dataType}`,
      };
    }
  }

  if (facet.restriction) {
    const value = slot as NormalizedValue;
    const failure = restrictionFailure(
      facet,
      facet.restriction,
      value,
      holdsWholeNumber(element, facet, value),
      unitScales
    );
    if (failure) return { passed: false, message: failure };
  }

  return { passed: true, message: "" };
}
