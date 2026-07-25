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
    return {
      id: nextDraftId("c"),
      kind: "property",
      propertySet: set.name,
      name: set.fields[0]?.name ?? "",
      operator: "exists",
      values: [],
      text: "",
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
      onChange({
        ...condition,
        kind,
        propertySet: set?.name ?? null,
        name: set?.fields[0]?.name ?? "",
        values: [],
      });
      return;
    }
    onChange({
      ...condition,
      kind,
      propertySet: null,
      name: source.attributes[0]?.name ?? "Name",
      values: [],
    });
  }

  function changePropertySet(propertySet: string) {
    const set = source.propertySets.find((entry) => entry.name === propertySet);
    onChange({ ...condition, propertySet, name: set?.fields[0]?.name ?? condition.name, values: [] });
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
        onChange={(event) => onChange({ ...condition, name: event.target.value, values: [] })}
      >
        {optionsWith(nameOptions, condition.name).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
