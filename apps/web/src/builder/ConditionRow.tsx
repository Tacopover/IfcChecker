import { useMemo } from "react";
import type {
  ConditionDraft,
  ConditionOperator,
  ConditionalCardinality,
  ValueDraft,
} from "@ifc-qa/ids-validator";
import {
  friendlyReadingOf,
  plainName,
  plainNameOf,
  valueDraftForOperator,
} from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { ValuePicker, type ObservedValue } from "./ValuePicker.js";
import { conditionProblem, OPERATORS_NEEDING_TEXT } from "./completeness.js";
import { nextDraftId } from "./draftIds.js";

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
 * The three cardinalities `ids.xsd` gives an attribute or a property, worded so the row still reads
 * as a sentence: "Pset_WallCommon · FireRating **must** be one of 60, 90".
 *
 * A separate control from the operator, because IDS treats them as orthogonal. Folding them into
 * one list is what used to make three combinations unreachable — an optional facet, a prohibited
 * value ("must not be Steel") and prohibited with no value all shared one `notExists` entry or none
 * at all, and the row showed the first two read-only.
 */
export const CARDINALITIES: Array<{ id: ConditionalCardinality; label: string }> = [
  { id: "required", label: "must" },
  { id: "optional", label: "if present, must" },
  { id: "prohibited", label: "must NOT" },
];

const MAX_SUGGESTIONS = 40;

/** The value a `dataType` select carries when the facet should declare none. */
export const NO_DATA_TYPE = "";

function propertyFieldIn(source: FieldsForResult, propertySet: string | null, name: string | null) {
  if (name === null) return undefined;
  return source.propertySets.find((set) => set.name === propertySet)?.fields.find((field) => field.name === name);
}

/**
 * The plain names a condition points at, or `null` where it names a restriction instead.
 *
 * Everything the row looks up in the model — the field list, the observed values, the stored type —
 * needs one name to look up. A pattern names a set of them, so each of those has to say "not this
 * time" rather than search for a name nobody wrote.
 */
function plainNamesOf(condition: ConditionDraft): { propertySet: string | null; name: string | null } {
  return {
    propertySet: condition.kind === "property" ? plainNameOf(condition.propertySet) : null,
    name: plainNameOf(condition.name),
  };
}

/** How a name the row cannot edit reads as a phrase, mirroring the operator labels above. */
export function nameSummary(value: ValueDraft): string {
  switch (value.kind) {
    case "simple":
      return value.value;
    case "enum":
      return `one of ${value.values.join(", ")}`;
    case "pattern":
      return `matching ${value.source}`;
    case "affix": {
      const label = OPERATORS.find((operator) => operator.id === value.operator)?.label ?? "";
      return `${label.replace(/^must /, "")} ${value.literal}`;
    }
    case "bounds":
      return "in a numeric range";
    case "length":
      return "of a given length";
  }
}

/**
 * The types offered for a property, commonest in the model first.
 *
 * Everything offered comes from the user's own file, which is the whole point of the rail — and
 * here it is also the only honest source: a declared type the model does not hold fails every
 * element. A type an imported rule already states is kept selectable even when this model has
 * nothing stored that way, so opening a file never silently rewrites it.
 */
export function dataTypeOptionsFor(
  source: FieldsForResult,
  condition: ConditionDraft
): Array<{ value: string; label: string }> {
  if (condition.kind !== "property") return [];
  const { propertySet, name } = plainNamesOf(condition);
  const observed = propertyFieldIn(source, propertySet, name)?.dataTypes ?? [];
  const options = observed.map((entry) => ({
    value: entry.value,
    label: `${entry.value} (${entry.count})`,
  }));
  const current = condition.dataType;
  if (current && !observed.some((entry) => entry.value === current)) {
    options.push({ value: current, label: `${current} (not in file)` });
  }
  return options;
}

/**
 * The type to declare for a property the user just pointed at: the one the model stores it as,
 * or none where the model is silent or disagrees with itself. A field stored as two types cannot
 * be checked against either without failing the other, so it declares nothing.
 */
export function dataTypeFromModel(
  source: FieldsForResult,
  propertySet: string | null,
  name: string | null
): string | null {
  const observed = propertyFieldIn(source, propertySet, name)?.dataTypes ?? [];
  return observed.length === 1 ? observed[0].value : null;
}

export function observedValuesFor(source: FieldsForResult, condition: ConditionDraft): ObservedValue[] {
  const { propertySet, name } = plainNamesOf(condition);
  if (name === null) return [];
  const field =
    condition.kind === "attribute"
      ? source.attributes.find((entry) => entry.name === name)
      : source.propertySets
          .find((set) => set.name === propertySet)
          ?.fields.find((entry) => entry.name === name);
  return field?.values ?? [];
}

/** A fresh condition points at whatever the current selection actually carries, so it is never empty. */
export function defaultConditionFor(source: FieldsForResult): ConditionDraft {
  const set = source.propertySets[0];
  if (set) {
    const name = set.fields[0]?.name ?? "";
    return {
      id: nextDraftId("c"),
      kind: "property",
      propertySet: plainName(set.name),
      name: plainName(name),
      value: null,
      cardinality: "required",
      dataType: dataTypeFromModel(source, set.name, name),
    };
  }
  return {
    id: nextDraftId("c"),
    kind: "attribute",
    propertySet: null,
    name: plainName(source.attributes[0]?.name ?? "Name"),
    value: null,
    cardinality: "required",
  };
}

/**
 * Why a condition has no operator row, for the ones the eight operators cannot state.
 *
 * Unreachable from the builder's own controls today — the importer refuses all three — but the
 * draft model can hold them, and a row that silently dropped its value would be worse than one
 * that says what it is holding.
 */
function unshownValue(condition: ConditionDraft): string {
  if (condition.value?.kind === "length") {
    return "A limit on how many characters the value holds. Not editable here yet.";
  }
  return "A numeric range. Not editable here yet.";
}

function optionsWith(list: string[], current: string | null) {
  const options = list.map((value) => ({ value, label: value }));
  if (current && !list.includes(current)) {
    options.push({ value: current, label: `${current} (not in file)` });
  }
  return options;
}

export interface ConditionRowProps {
  condition: ConditionDraft;
  source: FieldsForResult;
  hits: number;
  matched: number;
  onChange: (next: ConditionDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ConditionRow({
  condition,
  source,
  hits,
  matched,
  onChange,
  onDuplicate,
  onDelete,
}: ConditionRowProps) {
  const observed = useMemo(() => observedValuesFor(source, condition), [source, condition]);
  const dataTypeOptions = useMemo(() => dataTypeOptionsFor(source, condition), [source, condition]);
  const error = conditionProblem(condition);
  // The operator is a reading of the stored value, never the storage. `null` is the honest answer
  // for a value none of the eight operators states.
  const reading = friendlyReadingOf(condition);
  // ids.xsd gives uri to the property and not to the attribute, so the row asks before showing it.
  const uri = condition.kind === "property" ? condition.uri : null;
  // A restriction-valued name shows as a phrase instead of a select: it names a set of fields, and
  // a select over the model's field list cannot state one. The rest of the row still works.
  const { propertySet: plainSet, name: plainField } = plainNamesOf(condition);

  const nameOptions =
    condition.kind === "attribute"
      ? source.attributes.map((field) => field.name)
      : (source.propertySets.find((set) => set.name === plainSet)?.fields ?? []).map(
          (field) => field.name
        );

  const scoreClass = matched === 0 ? "empty" : hits === matched ? "all-pass" : "has-fail";
  const errorId = `cond-error-${condition.id}`;

  /** The same operator and text, with the ticked values dropped — a new field has its own. */
  function retargetedValue() {
    return reading ? valueDraftForOperator(reading.operator, reading.text, []) : condition.value;
  }

  /** The fields both kinds share, so switching between them carries the rest of the row across. */
  function shared() {
    const { id, cardinality, instructions, explicitCardinality } = condition;
    return { id, cardinality, instructions, explicitCardinality };
  }

  function changeKind(kind: ConditionDraft["kind"]) {
    if (kind === "property") {
      const set = source.propertySets[0];
      const name = set?.fields[0]?.name ?? "";
      onChange({
        ...shared(),
        kind,
        propertySet: set ? plainName(set.name) : null,
        name: plainName(name),
        value: retargetedValue(),
        dataType: dataTypeFromModel(source, set?.name ?? null, name),
      });
      return;
    }
    // IDS declares dataType and uri on <property> alone, so neither crosses to an attribute.
    onChange({
      ...shared(),
      kind,
      propertySet: null,
      name: plainName(source.attributes[0]?.name ?? "Name"),
      value: retargetedValue(),
    });
  }

  function changePropertySet(propertySet: string) {
    if (condition.kind !== "property") return;
    const set = source.propertySets.find((entry) => entry.name === propertySet);
    const name = set?.fields[0]?.name ?? plainField ?? "";
    onChange({
      ...condition,
      propertySet: plainName(propertySet),
      name: plainName(name),
      value: retargetedValue(),
      dataType: dataTypeFromModel(source, propertySet, name),
    });
  }

  function changeFieldName(name: string) {
    if (condition.kind === "attribute") {
      onChange({ ...condition, name: plainName(name), value: retargetedValue() });
      return;
    }
    onChange({
      ...condition,
      name: plainName(name),
      value: retargetedValue(),
      dataType: dataTypeFromModel(source, plainSet, name),
    });
  }

  // The cardinality is left alone: "must not be Steel" is one control changing, not two.
  function changeOperator(operator: ConditionOperator) {
    onChange({
      ...condition,
      value: valueDraftForOperator(operator, reading?.text ?? "", reading?.values ?? []),
    });
  }

  function changeText(text: string) {
    if (!reading) return;
    onChange({ ...condition, value: valueDraftForOperator(reading.operator, text, reading.values) });
  }

  function changeValues(values: string[]) {
    if (!reading) return;
    onChange({ ...condition, value: valueDraftForOperator(reading.operator, reading.text, values) });
  }

  return (
    <div className={condition.cardinality === "prohibited" ? "cond prohibited" : "cond"}>
      <select
        aria-label="Condition kind"
        value={condition.kind}
        onChange={(event) => changeKind(event.target.value as ConditionDraft["kind"])}
      >
        <option value="property">Property</option>
        <option value="attribute">Attribute</option>
      </select>

      {condition.kind === "property" && (
        <>
          {condition.propertySet !== null && plainSet === null ? (
            <span className="tok cond-unshown" aria-label="Property set">
              property sets {nameSummary(condition.propertySet)}
            </span>
          ) : (
            <select
              className="tok"
              aria-label="Property set"
              value={plainSet ?? ""}
              onChange={(event) => changePropertySet(event.target.value)}
            >
              {optionsWith(
                source.propertySets.map((set) => set.name),
                plainSet
              ).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          <span className="glue">·</span>
        </>
      )}

      {plainField === null ? (
        <span className="tok cond-unshown" aria-label="Field name">
          fields {nameSummary(condition.name)}
        </span>
      ) : (
        <select
          className="tok"
          aria-label="Field name"
          value={plainField}
          onChange={(event) => changeFieldName(event.target.value)}
        >
          {optionsWith(nameOptions, plainField).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {condition.kind === "property" && (
        <select
          className="tok subtle"
          aria-label="Stored as"
          title="The IFC data type the property must be stored as"
          value={condition.dataType ?? NO_DATA_TYPE}
          onChange={(event) =>
            onChange({
              ...condition,
              dataType: event.target.value === NO_DATA_TYPE ? null : event.target.value,
            })
          }
        >
          <option value={NO_DATA_TYPE}>any type</option>
          {dataTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Cardinality"
        title="Whether the field has to be there at all"
        value={condition.cardinality}
        onChange={(event) =>
          onChange({ ...condition, cardinality: event.target.value as ConditionalCardinality })
        }
      >
        {CARDINALITIES.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>

      {reading === null ? (
        <span className="cond-unshown">{unshownValue(condition)}</span>
      ) : (
        <>
          <select
            aria-label="Operator"
            value={reading.operator}
            onChange={(event) => changeOperator(event.target.value as ConditionOperator)}
          >
            {OPERATORS.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.label}
              </option>
            ))}
          </select>

          {OPERATORS_NEEDING_TEXT.has(reading.operator) && (
            <>
              <input
                className="tok"
                type="text"
                aria-label="Value"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                list={`values-${condition.id}`}
                placeholder={reading.operator === "matches" ? "regex, e.g. [A-Z]{2}-\\d{4}" : "value"}
                value={reading.text}
                onChange={(event) => changeText(event.target.value)}
              />
              <datalist id={`values-${condition.id}`}>
                {observed.slice(0, MAX_SUGGESTIONS).map((entry) => (
                  <option key={entry.value} value={entry.value} />
                ))}
              </datalist>
            </>
          )}

          {reading.operator === "oneOf" && (
            <ValuePicker observed={observed} selected={reading.values} onChange={changeValues} />
          )}
        </>
      )}

      <span className={`cond-score score ${scoreClass}`}>
        <span className="score-text num">
          {hits}/{matched}
        </span>
        <button
          type="button"
          className="iconbtn"
          title="Duplicate condition"
          aria-label="Duplicate condition"
          onClick={onDuplicate}
        >
          ⧉
        </button>
        <button
          type="button"
          className="iconbtn danger"
          title="Remove condition"
          aria-label="Remove condition"
          onClick={onDelete}
        >
          ✕
        </button>
      </span>

      {(condition.instructions || uri) && (
        <span className="cond-note">
          {condition.instructions}
          {/* Shown as text, never as a link: the address comes from a file someone else wrote. */}
          {uri && <span className="cond-uri">{uri}</span>}
        </span>
      )}

      {error && (
        <span className="cond-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
