import { useMemo, useState } from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ConditionDraft, FacetDraft, RuleDraft } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { evaluateRuleDraft } from "./evaluateDraft.js";
import { REQUIREMENT_KINDS, defaultFacetFor } from "./defaultFacets.js";
import { RequirementRow } from "./FacetRow.js";
import { ManualConditionRow } from "./ManualConditionRow.js";
import { nextDraftId } from "./draftIds.js";

// Only these two have a manual variant (`ManualConditionRow`) — every other kind's identifying
// field already routes through `FacetValueEditor`, which is free-text capable regardless of
// whether there is any file data to observe (see `ManualConditionRow`'s own doc comment).
const MANUAL_KINDS = REQUIREMENT_KINDS.filter((entry) => entry.id === "property" || entry.id === "attribute");

export interface WizardRequirementsStepProps {
  draft: RuleDraft;
  source: FieldsForResult;
  elements: NormalizedElement[];
  onChange: (next: RuleDraft) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 3 — "What must be true?" Reuses `RequirementRow`/`ConditionRow` exactly when the rule's
 * applies-to selection has file data (`source.total > 0`, including a rule that mixes a real type
 * with a schema-only one — that still gets ordinary dropdowns from the merged file data, the same
 * as `RuleCard` already renders it). Falls back to `ManualConditionRow` only when the *whole*
 * selection has zero elements in the loaded file — the unambiguous case (see the plan's "flatten"
 * decision: no per-type grouping, since a `FacetDraft` has no entity-type tag to scope one to).
 */
export function WizardRequirementsStep({
  draft,
  source,
  elements,
  onChange,
  onNext,
  onBack,
}: WizardRequirementsStepProps) {
  const [touchedFacetIds, setTouchedFacetIds] = useState<ReadonlySet<string>>(new Set());
  function touch(id: string) {
    setTouchedFacetIds((previous) => new Set(previous).add(id));
  }

  const manual = source.total === 0;
  const evaluation = useMemo(() => evaluateRuleDraft(draft, elements), [draft, elements]);
  const { matched, perCondition } = evaluation;

  function updateConditions(conditions: FacetDraft[]) {
    onChange({ ...draft, conditions });
  }

  function replaceCondition(id: string, next: FacetDraft) {
    updateConditions(draft.conditions.map((entry) => (entry.id === id ? next : entry)));
  }

  function duplicateCondition(index: number, condition: FacetDraft) {
    updateConditions([
      ...draft.conditions.slice(0, index + 1),
      { ...condition, id: nextDraftId("c") },
      ...draft.conditions.slice(index + 1),
    ]);
  }

  function deleteCondition(id: string) {
    updateConditions(draft.conditions.filter((entry) => entry.id !== id));
  }

  return (
    <div className="wizcard">
      <h1>What must be true?</h1>
      <p className="sub">
        Add one or more checks. Each becomes a sentence like the one below — pick a field, then say
        what it must satisfy.
      </p>

      <div className="explain">
        A <b>property</b> lives inside a property set — a named bundle, which is where most domain
        data lives. An <b>attribute</b> is one of the handful of fields IFC gives every element
        directly, like its Name. Pick whichever this file actually stores the value under; we'll
        show you which one that is
        {manual ? " when a file has one to check against" : ""}.
      </div>

      {draft.conditions.map((condition, index) =>
        manual ? (
          <ManualConditionRow
            key={condition.id}
            condition={condition as ConditionDraft}
            touched={touchedFacetIds.has(condition.id)}
            onTouch={() => touch(condition.id)}
            onChange={(next) => replaceCondition(condition.id, next)}
            onDuplicate={() => duplicateCondition(index, condition)}
            onDelete={() => deleteCondition(condition.id)}
          />
        ) : (
          <RequirementRow
            key={condition.id}
            facet={condition}
            source={source}
            hits={perCondition[index] ?? 0}
            matched={matched}
            touched={touchedFacetIds.has(condition.id)}
            onTouch={() => touch(condition.id)}
            onChange={(next) => replaceCondition(condition.id, next)}
            onDuplicate={() => duplicateCondition(index, condition)}
            onDelete={() => deleteCondition(condition.id)}
          />
        )
      )}

      <select
        className="addreqbtn"
        aria-label="Add another check"
        value=""
        onChange={(event) => {
          if (!event.target.value) return;
          updateConditions([
            ...draft.conditions,
            defaultFacetFor(event.target.value as FacetDraft["kind"], source),
          ]);
        }}
      >
        <option value="">+ Add another check</option>
        {(manual ? MANUAL_KINDS : REQUIREMENT_KINDS).map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
      </select>

      <div className="wizfoot">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <span className="spacer" />
        <button type="button" className="btn" onClick={onNext}>
          Next: Review →
        </button>
      </div>
    </div>
  );
}
