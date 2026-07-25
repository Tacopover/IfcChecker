import type { ConditionDraft, ConditionOperator, RuleDraft } from "@ifc-qa/ids-validator";

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
 */
export function patternError(condition: ConditionDraft): string | null {
  if (condition.operator !== "matches" || condition.text === "") return null;
  try {
    new RegExp(`^(?:${condition.text})$`);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Why this condition cannot be exported, or null when it is complete. Every case is one where the
 * XML would say something other than what the page shows: an empty `oneOf` serialises to an empty
 * `xs:restriction`, which XSD reads as *any* string, so an external checker would pass every element
 * the UI counts as failing. An empty text box is the mirror image — a rule nothing can satisfy.
 */
export function conditionProblem(condition: ConditionDraft): string | null {
  if (condition.operator === "oneOf" && condition.values.length === 0) {
    return "Tick at least one value — with none, the exported rule accepts anything.";
  }
  if (OPERATORS_NEEDING_TEXT.has(condition.operator) && condition.text === "") {
    return "Enter a value — this condition can never pass while it is empty.";
  }
  const pattern = patternError(condition);
  return pattern === null ? null : `Invalid pattern — it can never match: ${pattern}`;
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
  return {
    applicability:
      rule.entityTypes.length === 0
        ? "No element types — IDS needs at least one, and this rule would apply to nothing."
        : null,
    conditions:
      rule.conditions.length === 0
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
export function exportBlockers(rules: RuleDraft[]): string[] {
  if (rules.length === 0) return ["No rules yet — there is nothing to export."];

  const blockers: string[] = [];
  for (const rule of rules) {
    const reasons = ruleProblemList(rule);
    for (const condition of rule.conditions) {
      const problem = conditionProblem(condition);
      if (problem !== null) reasons.push(`${condition.name} — ${problem}`);
    }
    if (reasons.length) blockers.push(`"${rule.name || "Untitled rule"}": ${reasons.join(" ")}`);
  }
  return blockers;
}
