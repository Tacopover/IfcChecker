import type { ConditionOperator, ValueDraft } from "@ifc-qa/ids-validator";
import { carryAnnotation, friendlyReadingOf, valueDraftForOperator } from "@ifc-qa/ids-validator";
import { ValuePicker, type ObservedValue } from "./ValuePicker.js";
import { OPERATORS_NEEDING_TEXT } from "./completeness.js";

/** How many of the model's own values the text box offers before the list stops being a help. */
const MAX_SUGGESTIONS = 40;

export const OPERATORS: Array<{ id: ConditionOperator; label: string }> = [
  { id: "exists", label: "be filled in" },
  { id: "equals", label: "be exactly" },
  { id: "oneOf", label: "be one of" },
  { id: "contains", label: "contain" },
  { id: "startsWith", label: "start with" },
  { id: "endsWith", label: "end with" },
  { id: "matches", label: "match pattern" },
];

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
  /** The facet's id, so two rows showing the same parameter do not share one suggestion list. */
  id: string;
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
  id,
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
        <span className="cond-unshown">
          {value?.kind === "length"
            ? "A limit on how many characters the value holds. Not editable here yet."
            : "A numeric range. Not editable here yet."}
        </span>
        {annotation}
      </>
    );
  }

  const operators = absentLabel === null ? OPERATORS.filter((entry) => entry.id !== "exists") : OPERATORS;
  const listId = `values-${id}-${label}`;

  function change(operator: ConditionOperator, text: string, values: string[]) {
    // The prose follows the value it documents. Choosing "be exactly" is the one edit that drops
    // it, because a <simpleValue> has no restriction to hold one, and the note going with it is
    // what tells the author that.
    onChange(carryAnnotation(value, valueDraftForOperator(operator, text, values)));
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
        <>
          <input
            className="tok"
            type="text"
            aria-label={label}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? errorId : undefined}
            list={listId}
            placeholder={reading.operator === "matches" ? "regex, e.g. [A-Z]{2}-\\d{4}" : "value"}
            value={reading.text}
            onChange={(event) => change(reading.operator, event.target.value, reading.values)}
          />
          <datalist id={listId}>
            {observed.slice(0, MAX_SUGGESTIONS).map((entry) => (
              <option key={entry.value} value={entry.value} />
            ))}
          </datalist>
        </>
      )}

      {reading.operator === "oneOf" && (
        <ValuePicker
          observed={observed}
          selected={reading.values}
          onChange={(values) => change("oneOf", reading.text, values)}
        />
      )}

      {annotation}
    </>
  );
}
