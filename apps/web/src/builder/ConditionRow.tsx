import { useMemo } from "react";
import type { ConditionDraft, ConditionOperator } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { ValuePicker, type ObservedValue } from "./ValuePicker.js";
import { conditionProblem, OPERATORS_NEEDING_TEXT } from "./completeness.js";
import { nextDraftId } from "./draftIds.js";

export const OPERATORS: Array<{ id: ConditionOperator; label: string }> = [
  { id: "exists", label: "must be filled in" },
  { id: "equals", label: "must be exactly" },
  { id: "oneOf", label: "must be one of" },
  { id: "contains", label: "must contain" },
  { id: "startsWith", label: "must start with" },
  { id: "endsWith", label: "must end with" },
  { id: "matches", label: "must match pattern" },
  { id: "notExists", label: "must NOT be filled in" },
];

const MAX_SUGGESTIONS = 40;

/** The value a `dataType` select carries when the facet should declare none. */
export const NO_DATA_TYPE = "";

function propertyFieldIn(source: FieldsForResult, propertySet: string | null, name: string) {
  return source.propertySets.find((set) => set.name === propertySet)?.fields.find((field) => field.name === name);
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
  const observed = propertyFieldIn(source, condition.propertySet, condition.name)?.dataTypes ?? [];
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
  name: string
): string | null {
  const observed = propertyFieldIn(source, propertySet, name)?.dataTypes ?? [];
  return observed.length === 1 ? observed[0].value : null;
}

export function observedValuesFor(source: FieldsForResult, condition: ConditionDraft): ObservedValue[] {
  const field =
    condition.kind === "attribute"
      ? source.attributes.find((entry) => entry.name === condition.name)
      : source.propertySets
          .find((set) => set.name === condition.propertySet)
          ?.fields.find((entry) => entry.name === condition.name);
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
      propertySet: set.name,
      name,
      operator: "exists",
      values: [],
      text: "",
      dataType: dataTypeFromModel(source, set.name, name),
    };
  }
  return {
    id: nextDraftId("c"),
    kind: "attribute",
    propertySet: null,
    name: source.attributes[0]?.name ?? "Name",
    operator: "exists",
    values: [],
    text: "",
  };
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

  const nameOptions =
    condition.kind === "attribute"
      ? source.attributes.map((field) => field.name)
      : (source.propertySets.find((set) => set.name === condition.propertySet)?.fields ?? []).map(
          (field) => field.name
        );

  const scoreClass = matched === 0 ? "empty" : hits === matched ? "all-pass" : "has-fail";
  const errorId = `cond-error-${condition.id}`;

  function changeKind(kind: ConditionDraft["kind"]) {
    if (kind === "property") {
      const set = source.propertySets[0];
      const name = set?.fields[0]?.name ?? "";
      onChange({
        ...condition,
        kind,
        propertySet: set?.name ?? null,
        name,
        values: [],
        dataType: dataTypeFromModel(source, set?.name ?? null, name),
      });
      return;
    }
    onChange({
      ...condition,
      kind,
      propertySet: null,
      name: source.attributes[0]?.name ?? "Name",
      values: [],
      // IDS declares dataType on <property> alone, so an attribute states none.
      dataType: null,
    });
  }

  function changePropertySet(propertySet: string) {
    const set = source.propertySets.find((entry) => entry.name === propertySet);
    const name = set?.fields[0]?.name ?? condition.name;
    onChange({
      ...condition,
      propertySet,
      name,
      values: [],
      dataType: dataTypeFromModel(source, propertySet, name),
    });
  }

  function changeFieldName(name: string) {
    onChange({
      ...condition,
      name,
      values: [],
      dataType: condition.kind === "property" ? dataTypeFromModel(source, condition.propertySet, name) : null,
    });
  }

  return (
    <div className={condition.operator === "notExists" ? "cond prohibited" : "cond"}>
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
          <select
            className="tok"
            aria-label="Property set"
            value={condition.propertySet ?? ""}
            onChange={(event) => changePropertySet(event.target.value)}
          >
            {optionsWith(
              source.propertySets.map((set) => set.name),
              condition.propertySet
            ).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="glue">·</span>
        </>
      )}

      <select
        className="tok"
        aria-label="Field name"
        value={condition.name}
        onChange={(event) => changeFieldName(event.target.value)}
      >
        {optionsWith(nameOptions, condition.name).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
        aria-label="Operator"
        value={condition.operator}
        onChange={(event) =>
          onChange({ ...condition, operator: event.target.value as ConditionOperator })
        }
      >
        {OPERATORS.map((operator) => (
          <option key={operator.id} value={operator.id}>
            {operator.label}
          </option>
        ))}
      </select>

      {OPERATORS_NEEDING_TEXT.has(condition.operator) && (
        <>
          <input
            className="tok"
            type="text"
            aria-label="Value"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            list={`values-${condition.id}`}
            placeholder={condition.operator === "matches" ? "regex, e.g. [A-Z]{2}-\\d{4}" : "value"}
            value={condition.text}
            onChange={(event) => onChange({ ...condition, text: event.target.value })}
          />
          <datalist id={`values-${condition.id}`}>
            {observed.slice(0, MAX_SUGGESTIONS).map((entry) => (
              <option key={entry.value} value={entry.value} />
            ))}
          </datalist>
        </>
      )}

      {condition.operator === "oneOf" && (
        <ValuePicker
          observed={observed}
          selected={condition.values}
          onChange={(values) => onChange({ ...condition, values })}
        />
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

      {error && (
        <span className="cond-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
