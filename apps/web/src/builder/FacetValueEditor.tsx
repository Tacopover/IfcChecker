import type { ConditionOperator, ValueDraft } from "@ifc-qa/ids-validator";
import {
  carryAnnotation,
  carryCaseInsensitive,
  friendlyReadingOf,
  valueDraftForOperator,
} from "@ifc-qa/ids-validator";
import { SuggestCombobox } from "./SuggestCombobox.js";
import { ValuePicker, type ObservedValue } from "./ValuePicker.js";
import { OPERATORS_NEEDING_TEXT } from "./completeness.js";

/** How many of the model's own values the text box offers before the list stops being a help. */
const MAX_SUGGESTIONS = 40;

/**
 * Operators the "ignore case" toggle applies to. Not `matches` — that box already holds the
 * author's own regex, and a checkbox second-guessing it would be a second, conflicting way to say
 * the same thing. Not `exists` — there is no text to fold.
 */
const CASE_INSENSITIVE_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
  "equals",
  "oneOf",
  "contains",
  "startsWith",
  "endsWith",
]);

export const OPERATORS: Array<{ id: ConditionOperator; label: string }> = [
  { id: "exists", label: "be filled in" },
  { id: "equals", label: "be exactly" },
  { id: "oneOf", label: "be one of" },
  { id: "contains", label: "contain" },
  { id: "startsWith", label: "start with" },
  { id: "endsWith", label: "end with" },
  { id: "matches", label: "match pattern" },
];

/**
 * What a value none of the operators states holds, said plainly rather than mislabelled.
 *
 * Three shapes reach here. Two are pending controls; the third is not — XSD reads several
 * `<xs:pattern>` as a disjunction, and one "match pattern" box cannot state it without joining
 * them into a regex the author never wrote.
 */
function unshownPhrase(value: ValueDraft | null): string {
  if (value?.kind === "length") {
    return "A limit on how many characters the value holds. Not editable here yet.";
  }
  if (value?.kind === "pattern") {
    return `Any of ${value.sources.length} patterns: ${value.sources.join(" or ")}`;
  }
  return "A numeric range. Not editable here yet.";
}

export interface FacetValueEditorProps {
  /** The parameter as the draft holds it. `null` is "the facet states none". */
  value: ValueDraft | null;
  onChange: (next: ValueDraft | null) => void;
  /** The values the model holds for whatever this parameter is about, commonest first. */
  observed: ObservedValue[];
  /**
   * What `null` means here, as a phrase for the operator list — "be filled in" for a facet whose
   * value is optional, and absent entirely for one `ids.xsd` makes mandatory.
   *
   * `null` disallowed is not a nicety: a classification's `<system>` and a partOf's
   * `<entity><name>` are mandatory elements, and a draft that could state none would export a
   * document no conforming checker reads.
   */
  absentLabel: string | null;
  /** What the value control is called — "Value", "System", "Class". */
  label: string;
  /** What the operator select is called, which a row with two editors has to keep distinct. */
  operatorLabel: string;
  /** The id of the row's error message, so the text box can point at it. */
  errorId?: string;
  invalid?: boolean;
}

/**
 * One `idsValue`, wherever `ids.xsd` puts one.
 *
 * The same control behind a property's value, a classification's system, a material's name and a
 * partOf's entity — nine parameters over the six facet kinds, four of which carry two. Learning it
 * once is the point; so is the fact that the model's own values sit behind every one of them.
 *
 * The operator is a **reading of the stored value**, never the storage, and it says nothing about
 * whether the facet is required — that is the row's own cardinality control. `null` from
 * `friendlyReadingOf` is the honest answer for a numeric range or a character count, which no
 * operator states; the row shows those rather than mislabelling them.
 */
export function FacetValueEditor({
  value,
  onChange,
  observed,
  absentLabel,
  label,
  operatorLabel,
  errorId,
  invalid,
}: FacetValueEditorProps) {
  const reading = friendlyReadingOf(value);
  // The author's own prose about this parameter, from inside its <xs:restriction>. Shown rather
  // than edited, the way a facet's `instructions` is — it constrains nothing, and it is the one
  // sentence saying why the restriction beside it is written the way it is.
  const annotation =
    value !== null && value.kind !== "simple" && value.annotation !== undefined ? (
      <span className="cond-annotation">{value.annotation}</span>
    ) : null;

  if (reading === null) {
    return (
      <>
        <span className="cond-unshown">{unshownPhrase(value)}</span>
        {annotation}
      </>
    );
  }

  const operators = absentLabel === null ? OPERATORS.filter((entry) => entry.id !== "exists") : OPERATORS;
  const suggestions = observed.slice(0, MAX_SUGGESTIONS).map((entry) => entry.value);

  function change(operator: ConditionOperator, text: string, values: string[]) {
    // The prose follows the value it documents. Choosing "be exactly" is the one edit that drops
    // it, because a <simpleValue> has no restriction to hold one, and the note going with it is
    // what tells the author that.
    const next = carryAnnotation(value, valueDraftForOperator(operator, text, values));
    onChange(carryCaseInsensitive(value, next));
  }

  function toggleCaseInsensitive(checked: boolean) {
    if (value === null) return;
    onChange({ ...value, caseInsensitive: checked });
  }

  return (
    <>
      <select
        aria-label={operatorLabel}
        value={reading.operator}
        onChange={(event) => change(event.target.value as ConditionOperator, reading.text, reading.values)}
      >
        {operators.map((operator) => (
          <option key={operator.id} value={operator.id}>
            {operator.id === "exists" && absentLabel !== null ? absentLabel : operator.label}
          </option>
        ))}
      </select>

      {OPERATORS_NEEDING_TEXT.has(reading.operator) && (
        <SuggestCombobox
          label={label}
          value={reading.text}
          // A regex is written, not picked: offering the model's own values under a box that
          // holds a pattern would suggest they belong in it.
          options={reading.operator === "matches" ? [] : suggestions}
          placeholder={reading.operator === "matches" ? "regex, e.g. [A-Z]{2}-\\d{4}" : "value"}
          onChange={(text) => change(reading.operator, text, reading.values)}
          errorId={errorId}
          invalid={invalid}
        />
      )}

      {reading.operator === "oneOf" && (
        <ValuePicker
          observed={observed}
          selected={reading.values}
          onChange={(values) => change("oneOf", reading.text, values)}
        />
      )}

      {CASE_INSENSITIVE_OPERATORS.has(reading.operator) && (
        <label className="cond-ci">
          <input
            type="checkbox"
            checked={value?.caseInsensitive ?? false}
            onChange={(event) => toggleCaseInsensitive(event.target.checked)}
          />
          ignore case
        </label>
      )}

      {annotation}
    </>
  );
}
