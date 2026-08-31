import type { NormalizedElement, Severity, UnitScales } from "@ifc-qa/shared-types";
import type { ParsedSpecification, UnsupportedConstruct } from "./parse-ids.js";
import { isEvaluable, orGroupIdOf, parseIdsXml } from "./parse-ids.js";
import { matchesApplicability, evaluateRequirement } from "./facet-evaluation.js";

export interface IdsViolation {
  elementGlobalId: string;
  elementType: string;
  elementName: string | null;
  /** The element's Tag attribute (IfcIdentifier) — not every element carries one. */
  elementTag: string | null;
  ruleId: string;
  severity: Severity;
  message: string;
}

function elementTag(element: NormalizedElement): string | null {
  const tag = element.attributes.Tag?.value;
  return tag == null ? null : String(tag);
}

// What one specification did to the model. Violations alone cannot answer the
// question a reviewer actually asks first — "did this rule check anything?" — and
// an empty list reads as a clean model whether the rule passed everything or
// matched nothing at all. applicableCount separates those two.
export interface SpecificationOutcome {
  name: string;
  /**
   * False when the specification was never run, because its applicability could not be fully
   * represented. Its zero counts then mean "unknown", not "clean" — see `isEvaluable`.
   */
  checked: boolean;
  /** What the source asked for and this parser could not represent. */
  unsupported: UnsupportedConstruct[];
  applicableCount: number;
  passedCount: number;
  failedCount: number;
  violations: IdsViolation[];
  /**
   * Why the specification failed as a whole, independent of any element — or
   * `null` when it did not.
   *
   * IDS gives the applicability a cardinality, and the default is *required*:
   * at least one element must match. A model where nothing matches fails the
   * rule, and that is not visible in any of the counts above — zero applicable,
   * zero failed and an empty violation list is exactly what a clean model looks
   * like. Kept separate from `failedCount` so `passed + failed` stays the
   * number of elements the rule applied to.
   */
  cardinalityFailure: string | null;
}

/** `evaluateSpecification`'s result, before any OR-group merging happens. */
interface SpecificationEvaluation {
  outcome: SpecificationOutcome;
  /** Every element the specification actually judged, pass or fail. Empty when `!checked`. */
  applicableIds: Set<string>;
  /** The subset of `applicableIds` that passed. A prohibited specification's matches are never in here. */
  passedIds: Set<string>;
}

/**
 * Counts are per element, not per violation: one wall missing two required properties is one
 * failing wall, so passed + failed always equals the number of elements the rule applied to.
 */
function evaluateSpecification(
  specification: ParsedSpecification,
  elements: NormalizedElement[],
  unitScales: UnitScales
): SpecificationEvaluation {
  // Refused rather than run: evaluating a half-understood applicability silently checks the
  // wrong set of elements, and reports the model clean when the rule never applied at all.
  if (!isEvaluable(specification)) {
    return {
      outcome: {
        name: specification.name,
        checked: false,
        unsupported: specification.unsupported,
        applicableCount: 0,
        passedCount: 0,
        failedCount: 0,
        violations: [],
        cardinalityFailure: null,
      },
      applicableIds: new Set(),
      passedIds: new Set(),
    };
  }

  const violations: IdsViolation[] = [];
  const applicableIds = new Set<string>();
  const passedIds = new Set<string>();
  let failedCount = 0;

  for (const element of elements) {
    if (!matchesApplicability(element, specification.applicability, unitScales)) {
      continue;
    }
    applicableIds.add(element.globalId);

    // A prohibited specification is a statement that nothing should match, so the elements
    // it selects are themselves the failure — each one is reported as a violation rather than
    // checked against requirements (a document pairing "prohibited" with requirements is
    // invalid, and cardinalityFailure below says so).
    if (specification.cardinality === "prohibited") {
      violations.push({
        elementGlobalId: element.globalId,
        elementType: element.ifcType,
        elementName: element.name,
        elementTag: elementTag(element),
        ruleId: specification.name,
        severity: "error",
        message: "This element matches a specification whose applicability is prohibited.",
      });
      failedCount += 1;
      continue;
    }

    const before = violations.length;
    for (const facet of specification.requirements) {
      const result = evaluateRequirement(element, facet, unitScales);
      if (result.passed) continue;
      violations.push({
        elementGlobalId: element.globalId,
        elementType: element.ifcType,
        elementName: element.name,
        elementTag: elementTag(element),
        ruleId: specification.name,
        severity: "error",
        message: result.message,
      });
    }
    if (violations.length > before) {
      failedCount += 1;
    } else {
      passedIds.add(element.globalId);
    }
  }

  const applicableCount = applicableIds.size;
  return {
    outcome: {
      name: specification.name,
      checked: true,
      unsupported: specification.unsupported,
      applicableCount,
      passedCount: applicableCount - failedCount,
      failedCount,
      violations,
      cardinalityFailure: cardinalityFailure(specification, applicableCount),
    },
    applicableIds,
    passedIds,
  };
}

export function validateBySpecification(
  elements: NormalizedElement[],
  idsXml: string,
  /**
   * What the model's measures must be multiplied by to reach the SI units IDS compares in.
   * Empty means "already SI", which is both the correct reading of a file that declares no unit
   * and the honest answer from a caller that has no unit information.
   */
  unitScales: UnitScales = {}
): SpecificationOutcome[] {
  return parseIdsXml(idsXml).map(
    (specification) => evaluateSpecification(specification, elements, unitScales).outcome
  );
}

/**
 * Combines an OR group's members into the one outcome the group reports as.
 *
 * An element counts as applicable to the group if any member selected it, and as passed if it
 * passed any member that selected it — so an element only one branch's applicability reaches is
 * judged on that branch alone, exactly as if the other branches were never asked about it.
 */
function mergeGroupOutcome(members: ParsedSpecification[], evaluations: SpecificationEvaluation[]): SpecificationOutcome {
  const applicableIds = new Set<string>();
  const passedIds = new Set<string>();
  for (const evaluation of evaluations) {
    for (const id of evaluation.applicableIds) applicableIds.add(id);
    for (const id of evaluation.passedIds) passedIds.add(id);
  }
  const failedIds = new Set([...applicableIds].filter((id) => !passedIds.has(id)));

  // Kept under the branch's own name rather than rewritten to the group's — a reviewer reading
  // "DistributionFlowElement..." needs to know which requirement the message came from, not just
  // that the merged row failed. An element failing every branch would otherwise appear once per
  // branch here — the group only has one row for it, so only its first branch's message is kept.
  const seenFailedIds = new Set<string>();
  const violations = evaluations
    .flatMap((evaluation) =>
      evaluation.outcome.violations.filter((violation) => failedIds.has(violation.elementGlobalId))
    )
    .filter((violation) => {
      if (seenFailedIds.has(violation.elementGlobalId)) return false;
      seenFailedIds.add(violation.elementGlobalId);
      return true;
    });

  const checked = evaluations.some((evaluation) => evaluation.outcome.checked);
  const unsupported = evaluations.flatMap((evaluation) => evaluation.outcome.unsupported);

  // A group needs at least one match somewhere unless every checked member opted out of that
  // (`optional`). Pairing a `prohibited` branch with an OR partner is not a shape the builder can
  // produce, so it is not specially read here beyond not counting as "required".
  const anyRequired = evaluations.some(
    (evaluation, index) => evaluation.outcome.checked && members[index].cardinality === "required"
  );

  return {
    name: members.map((member) => member.name).join(" OR "),
    checked,
    unsupported,
    applicableCount: applicableIds.size,
    passedCount: passedIds.size,
    failedCount: failedIds.size,
    violations,
    cardinalityFailure: applicableIds.size === 0 && anyRequired ? REQUIRED_CARDINALITY_EMPTY_MESSAGE : null,
  };
}

/**
 * Same as `validateBySpecification`, except specifications sharing an OR-group `identifier` —
 * see `orGroupIdOf` — collapse into one outcome, per `mergeGroupOutcome`. A group of one member
 * (every other branch was deleted) reports exactly as an ungrouped specification would.
 *
 * The returned array can be shorter than `parseIdsXml(idsXml)` — one entry per OR group instead
 * of one per member — but stays in the document's first-appearance order.
 */
export function validateBySpecificationGrouped(
  elements: NormalizedElement[],
  idsXml: string,
  unitScales: UnitScales = {}
): SpecificationOutcome[] {
  const specifications = parseIdsXml(idsXml);
  const evaluations = specifications.map((specification) => evaluateSpecification(specification, elements, unitScales));

  const merged: SpecificationOutcome[] = [];
  const seenGroups = new Set<string>();

  specifications.forEach((specification, index) => {
    const groupId = orGroupIdOf(specification.identifier);
    if (groupId === null) {
      merged.push(evaluations[index].outcome);
      return;
    }
    if (seenGroups.has(groupId)) return; // this group's outcome was already pushed at its first member
    seenGroups.add(groupId);

    const memberIndices = specifications
      .map((_entry, entryIndex) => entryIndex)
      .filter((entryIndex) => orGroupIdOf(specifications[entryIndex].identifier) === groupId);

    if (memberIndices.length === 1) {
      merged.push(evaluations[index].outcome);
      return;
    }

    merged.push(
      mergeGroupOutcome(
        memberIndices.map((entryIndex) => specifications[entryIndex]),
        memberIndices.map((entryIndex) => evaluations[entryIndex])
      )
    );
  });

  return merged;
}

/**
 * Distinct from the other cardinalityFailure messages: those mean the document is invalid or an
 * element matched that shouldn't have. This one just means the model has nothing this
 * specification applies to — callers may choose to present it as a plain "no match" rather than
 * a failure.
 */
export const REQUIRED_CARDINALITY_EMPTY_MESSAGE =
  "This specification requires at least one matching element, and the model has none. It was not checked because there was nothing to check.";

function cardinalityFailure(
  specification: { cardinality: string; requirements: unknown[] },
  applicableCount: number
): string | null {
  if (specification.cardinality === "prohibited") {
    if (specification.requirements.length > 0) {
      return "This specification is prohibited — nothing may match it — so it cannot also state requirements. The document is invalid.";
    }
    return applicableCount > 0
      ? `Nothing may match this specification, but ${applicableCount} element${applicableCount === 1 ? "" : "s"} did.`
      : null;
  }

  if (specification.cardinality === "required" && applicableCount === 0) {
    return REQUIRED_CARDINALITY_EMPTY_MESSAGE;
  }

  return null;
}

export function validateElements(
  elements: NormalizedElement[],
  idsXml: string,
  unitScales: UnitScales = {}
): IdsViolation[] {
  return validateBySpecification(elements, idsXml, unitScales).flatMap((outcome) => outcome.violations);
}
