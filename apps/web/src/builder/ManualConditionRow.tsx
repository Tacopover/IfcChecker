import type { ConditionDraft, ConditionalCardinality } from "@ifc-qa/ids-validator";
import { plainName, plainNameOf } from "@ifc-qa/ids-validator";
import { CARDINALITIES, DATA_TYPE_ROWS, NO_DATA_TYPE, dataTypeGroupsFor } from "./ConditionRow.js";
import { allIfcDataTypeNames } from "./allIfcDataTypes.js";
import { FacetValueEditor } from "./FacetValueEditor.js";
import { FacetRowFrame, errorIdOf, rowNoun, type FacetSide } from "./FacetRowFrame.js";
import { SearchPicker } from "./SearchPicker.js";
import { conditionProblem } from "./completeness.js";

/** The schema's whole list, which no file narrows here — built once rather than per row. */
const SCHEMA_DATA_TYPE_GROUPS = dataTypeGroupsFor(
  allIfcDataTypeNames().map((value) => ({ value, label: value }))
);

export interface ManualConditionRowProps {
  condition: ConditionDraft;
  side?: FacetSide;
  touched: boolean;
  onTouch: () => void;
  onChange: (next: ConditionDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * The property/attribute sentence row for a rule whose whole applies-to selection has zero
 * elements in the loaded file — `WizardRequirementsStep` picks this over `RequirementRow` in the
 * wizard, and `RequirementRow`/`ApplicabilityRow` (see FacetRow.tsx) pick it the same way for a
 * rule already on the page, including one with no file loaded at all. Mirrors `ConditionRow`'s
 * shape but swaps its two `<select>`s — built from file-derived lists, which render zero
 * `<option>`s with nothing to observe — for free-typed text. The value editor itself is
 * unchanged: `FacetValueEditor` already renders a free-text input regardless of whether
 * `observed` holds anything, so it needs no manual variant of its own.
 *
 * Its "Stored as" picker offers the schema's own closed list rather than a file's observed types:
 * with nothing to derive from, the alternative is a hand-authored rule that cannot state a type at
 * all. `ConditionRow` falls back to the same list for a name its file says nothing about.
 */
export function ManualConditionRow({
  condition,
  side = "requirements",
  touched,
  onTouch,
  onChange,
  onDuplicate,
  onDelete,
}: ManualConditionRowProps) {
  const selects = side === "applicability";
  const error = touched ? conditionProblem(condition) : null;
  const errorId = errorIdOf(condition.id);

  function changeKind(kind: ConditionDraft["kind"]) {
    if (kind === "property") {
      onChange({ ...condition, kind, propertySet: plainName("") });
      return;
    }
    onChange({ ...condition, kind, propertySet: null });
  }

  return (
    <FacetRowFrame
      id={condition.id}
      side={side}
      prohibited={condition.cardinality === "prohibited"}
      // Always 0 of 0: this row only ever appears when the rule's whole applies-to selection has
      // no elements in the loaded file (see `WizardRequirementsStep`), so there is nothing to
      // score yet — "0/0" is the honest, empty-state reading `FacetRowFrame` already gives that.
      hits={0}
      matched={0}
      instructions={condition.instructions}
      error={error}
      what={rowNoun(side, condition.kind)}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onTouch={onTouch}
    >
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
          <span className="glue">in</span>
          <input
            className="tok typed"
            aria-label="Property set"
            placeholder="property set name"
            value={plainNameOf(condition.propertySet) ?? ""}
            onChange={(event) => onChange({ ...condition, propertySet: plainName(event.target.value) })}
          />
        </>
      )}

      <span className="glue">called</span>
      <input
        className="tok typed"
        aria-label="Field name"
        placeholder="field name"
        value={plainNameOf(condition.name) ?? ""}
        onChange={(event) => onChange({ ...condition, name: plainName(event.target.value) })}
      />

      {condition.kind === "property" && (
        <SearchPicker
          label="Stored as"
          title="The IFC data type the property must be stored as"
          inputClassName="tok subtle"
          value={condition.dataType ?? NO_DATA_TYPE}
          groups={SCHEMA_DATA_TYPE_GROUPS}
          maxRows={DATA_TYPE_ROWS}
          onPick={(picked) =>
            onChange({ ...condition, dataType: picked === NO_DATA_TYPE ? null : picked })
          }
        />
      )}

      {selects ? (
        <span className="glue">selects only those where it must</span>
      ) : (
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
      )}

      <FacetValueEditor
        label="Value"
        operatorLabel="Operator"
        value={condition.value}
        onChange={(value) => onChange({ ...condition, value })}
        observed={[]}
        absentLabel="be filled in"
        errorId={errorId}
        invalid={error !== null}
      />

      <span className="hint typedhint">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        No file to check spelling or offer real values against; typed manually.
      </span>
    </FacetRowFrame>
  );
}
