import type {
  ConditionDraft,
  ConditionOperator,
  FacetDraft,
  RuleDraft,
  ValueDraft,
} from "@ifc-qa/ids-validator";

/** Operators whose meaning lives entirely in the text box beside them. */
export const OPERATORS_NEEDING_TEXT: ReadonlySet<ConditionOperator> = new Set<ConditionOperator>([
  "equals",
  "contains",
  "startsWith",
  "endsWith",
  "matches",
]);

/**
 * The validator compiles a pattern it cannot parse into one that never matches, so an invalid regex
 * would silently fail every element with nothing on screen to explain it.
 *
 * Only a pattern the user wrote themselves can be invalid: an affix operator escapes its literal,
 * so `.*(dev.*` is unreachable from "must start with".
 */
export function patternError(condition: ConditionDraft): string | null {
  return patternErrorIn(condition.value);
}

function patternErrorIn(value: ValueDraft | null): string | null {
  if (value?.kind !== "pattern" || value.source === "") return null;
  try {
    new RegExp(`^(?:${value.source})$`);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Whether the box the user types into is still empty. */
function statesNoText(value: ValueDraft): boolean {
  if (value.kind === "simple") return value.value === "";
  if (value.kind === "affix") return value.literal === "";
  if (value.kind === "pattern") return value.source === "";
  return false;
}

/**
 * Every `idsValue` slot a facet states.
 *
 * A facet is not always one value: a classification constrains its system and its value
 * independently, and a partOf constrains the whole's class and predefined type. Checking only a
 * field called `value` would let an empty enumeration through on four of the six kinds.
 */
function valuesOf(facet: FacetDraft): Array<ValueDraft | null> {
  switch (facet.kind) {
    case "attribute":
    case "property":
    case "material":
      return [facet.value];
    case "entity":
      return [facet.name, facet.predefinedType];
    case "classification":
      return [facet.system, facet.value];
    case "partOf":
      return [facet.entityName, facet.predefinedType];
  }
}

/**
 * Why this facet cannot be exported, or null when it is complete. Every case is one where the XML
 * would say something other than what the page shows: an empty `oneOf` serialises to an empty
 * `xs:restriction`, which XSD reads as *any* string, so an external checker would pass every element
 * the UI counts as failing. An empty text box is the mirror image — a rule nothing can satisfy.
 */
export function conditionProblem(facet: FacetDraft): string | null {
  for (const value of valuesOf(facet)) {
    if (value === null) continue;
    if (value.kind === "enum" && value.values.length === 0) {
      return "Tick at least one value — with none, the exported rule accepts anything.";
    }
    if (statesNoText(value)) {
      return "Enter a value — this condition can never pass while it is empty.";
    }
    const pattern = patternErrorIn(value);
    if (pattern !== null) return `Invalid pattern — it can never match: ${pattern}`;
  }
  return null;
}

/** What to call this facet in a message about it. */
function labelOf(facet: FacetDraft): string {
  return facet.kind === "attribute" || facet.kind === "property" ? facet.name : facet.kind;
}

/**
 * Problems with the rule itself, ignoring its conditions. Keyed by the clause they belong to so the
 * card can put each message beside the control that fixes it.
 */
export interface RuleProblems {
  applicability: string | null;
  conditions: string | null;
}

export function ruleProblems(rule: RuleDraft): RuleProblems {
  // An imported rule can carry requirements the builder keeps but cannot show, and a source with
  // no <requirements> at all is a valid existence check — neither is a rule that checks nothing.
  const checksNothing =
    rule.conditions.length === 0 && (rule.imported?.passThrough.length ?? 0) === 0;
  const applicabilityOnly = rule.imported?.requirementsAttributes === null;

  return {
    applicability:
      rule.entityTypes.length === 0
        ? "No element types — IDS needs at least one, and this rule would apply to nothing."
        : null,
    conditions:
      checksNothing && !applicabilityOnly
        ? "No conditions — there is nothing for this rule to check."
        : null,
  };
}

function ruleProblemList(rule: RuleDraft): string[] {
  const { applicability, conditions } = ruleProblems(rule);
  return [applicability, conditions].filter((problem): problem is string => problem !== null);
}

export function isRuleComplete(rule: RuleDraft): boolean {
  return (
    ruleProblemList(rule).length === 0 &&
    rule.conditions.every((condition) => conditionProblem(condition) === null)
  );
}

/**
 * One line per reason the rule set must not be downloaded. Empty means the document the preview
 * shows is the document an external checker would read.
 */
export function exportBlockers(rules: RuleDraft[], preservedCount = 0): string[] {
  if (rules.length === 0 && preservedCount === 0) {
    return ["No rules yet — there is nothing to export."];
  }

  const blockers: string[] = [];
  for (const rule of rules) {
    const reasons = ruleProblemList(rule);
    for (const condition of rule.conditions) {
      const problem = conditionProblem(condition);
      if (problem !== null) reasons.push(`${labelOf(condition)} — ${problem}`);
    }
    if (reasons.length) blockers.push(`"${rule.name || "Untitled rule"}": ${reasons.join(" ")}`);
  }
  return blockers;
}
