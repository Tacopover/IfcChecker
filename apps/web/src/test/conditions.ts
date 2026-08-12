import {
  valueDraftForOperator,
  type ConditionDraft,
  type ConditionOperator,
  type ConditionalCardinality,
} from "@ifc-qa/ids-validator";

/**
 * The two fields the builder's row sets on a condition.
 *
 * The operator is a reading of the stored value rather than a field, so a test that wants "contains
 * REI" has to state the value that reads that way. Deriving it here with the same function the row
 * uses keeps these cases about what the page does, not about how the draft happens to be shaped.
 *
 * Cardinality is a separate argument because IDS makes it a separate question: "must not be Steel"
 * is `prohibited` with a value, and no operator states it.
 */
export function stating(
  operator: ConditionOperator,
  text = "",
  values: string[] = [],
  cardinality: ConditionalCardinality = "required"
): Pick<ConditionDraft, "value" | "cardinality"> {
  return { value: valueDraftForOperator(operator, text, values), cardinality };
}
