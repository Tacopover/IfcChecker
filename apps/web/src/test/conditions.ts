import {
  cardinalityForOperator,
  valueDraftForOperator,
  type ConditionDraft,
  type ConditionOperator,
} from "@ifc-qa/ids-validator";

/**
 * The two fields one of the builder's friendly operators sets on a condition.
 *
 * The operator is a reading of the stored value rather than a field, so a test that wants "contains
 * REI" has to state the value that reads that way. Deriving it here with the same functions the row
 * uses keeps these cases about what the page does, not about how the draft happens to be shaped.
 */
export function stating(
  operator: ConditionOperator,
  text = "",
  values: string[] = []
): Pick<ConditionDraft, "value" | "cardinality"> {
  return {
    value: valueDraftForOperator(operator, text, values),
    cardinality: cardinalityForOperator(operator),
  };
}
