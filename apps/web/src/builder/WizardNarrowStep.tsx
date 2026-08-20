import { useMemo, useState } from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ApplicabilityFacetDraft, RuleDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { evaluateRuleDraft } from "./evaluateDraft.js";
import { APPLICABILITY_KINDS, defaultApplicabilityFacetFor } from "./defaultFacets.js";
import { ApplicabilityRow } from "./FacetRow.js";
import { predefinedTypeOptions } from "./EntityRow.js";
import { nextDraftId } from "./draftIds.js";

/** What the "narrow by" select carries for the entity's predefined type — mirrors `RuleCard.tsx`. */
const PREDEFINED_TYPE_OPTION = "entityPredefinedType";

export interface WizardNarrowStepProps {
  draft: RuleDraft;
  source: FieldsForResult;
  elements: NormalizedElement[];
  onChange: (next: RuleDraft) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 2 — "Narrow it down (optional)". Reuses the same applicability-facet mechanism
 * `RuleCard.tsx` already renders (`ApplicabilityRow`, `defaultApplicabilityFacetFor`,
 * `APPLICABILITY_KINDS`, the `entityPredefinedType` sentinel), just under wizard chrome. Skipping
 * is a first-class action — an empty `applicabilityFacets` is already the common, valid state.
 */
export function WizardNarrowStep({ draft, source, elements, onChange, onNext, onBack }: WizardNarrowStepProps) {
  const [touchedFacetIds, setTouchedFacetIds] = useState<ReadonlySet<string>>(new Set());
  function touch(id: string) {
    setTouchedFacetIds((previous) => new Set(previous).add(id));
  }

  const facets = draft.applicabilityFacets ?? [];
  const predefinedType = draft.entityPredefinedType ?? null;
  const predefinedTypes = useMemo(() => predefinedTypeOptions(source, null), [source]);
  const matched = useMemo(() => evaluateRuleDraft(draft, elements).matched, [draft, elements]);
  const ratio = source.total ? matched / source.total : 0;

  function replaceFacet(id: string, next: ApplicabilityFacetDraft) {
    onChange({
      ...draft,
      applicabilityFacets: facets.map((entry) => (entry.id === id ? next : entry)),
    });
  }

  function duplicateFacet(index: number, facet: ApplicabilityFacetDraft) {
    onChange({
      ...draft,
      applicabilityFacets: [
        ...facets.slice(0, index + 1),
        { ...facet, id: nextDraftId("a") },
        ...facets.slice(index + 1),
      ],
    });
  }

  function deleteFacet(id: string) {
    onChange({ ...draft, applicabilityFacets: facets.filter((entry) => entry.id !== id) });
  }

  return (
    <div className="wizcard">
      <h1>
        Narrow it down <span style={{ color: "var(--faint)", fontWeight: 400, fontSize: ".75em" }}>(optional)</span>
      </h1>
      <p className="sub">
        Right now this rule checks all {source.total} element{source.total === 1 ? "" : "s"}. You
        can narrow that to a smaller set — for example only fire-rated walls, or only one
        classification.
      </p>

      <div className="explain">
        <b>Predefined type</b> narrows by an element's own IFC sub-type — the row IFC gives every
        element directly. Classification, if this file uses one, is often a more useful filter for
        elements this file already sorts a different way.
      </div>

      {facets.map((facet, index) => (
        <ApplicabilityRow
          key={facet.id}
          facet={facet}
          source={source}
          touched={touchedFacetIds.has(facet.id)}
          onTouch={() => touch(facet.id)}
          onChange={(next) => replaceFacet(facet.id, next)}
          onDuplicate={() => duplicateFacet(index, facet)}
          onDelete={() => deleteFacet(facet.id)}
        />
      ))}

      {predefinedType !== null && (
        <div className="cond applicability-facet">
          <span className="tok">Predefined type</span>
          <span className="glue">selects only those whose predefined type must be exactly</span>
          <span className="tok">{predefinedType.kind === "simple" ? predefinedType.value : ""}</span>
          <button
            type="button"
            className="iconbtn danger"
            title="Remove the predefined type this rule selects by"
            aria-label="Remove the predefined type this rule selects by"
            onClick={() => onChange({ ...draft, entityPredefinedType: null })}
          >
            ✕
          </button>
        </div>
      )}

      <select
        className="addfilterbtn"
        aria-label="Add another filter"
        value=""
        onChange={(event) => {
          const picked = event.target.value;
          if (!picked) return;
          if (picked === PREDEFINED_TYPE_OPTION) {
            onChange({ ...draft, entityPredefinedType: plainName(predefinedTypes[0]?.value ?? "") });
            return;
          }
          onChange({
            ...draft,
            applicabilityFacets: [
              ...facets,
              defaultApplicabilityFacetFor(picked as ApplicabilityFacetDraft["kind"], source),
            ],
          });
        }}
      >
        <option value="">+ Add another filter</option>
        {APPLICABILITY_KINDS.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.label}
          </option>
        ))}
        {predefinedType === null && <option value={PREDEFINED_TYPE_OPTION}>Predefined type</option>}
      </select>

      <div className="matchline">
        <span className="matchbar">
          <i style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        <span>
          <b>{matched}</b> of {source.total} element{source.total === 1 ? "" : "s"} will be checked
          by this rule
        </span>
      </div>

      <div className="wizfoot">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <span className="spacer" />
        {facets.length === 0 && predefinedType === null && (
          <button type="button" className="btn ghost" onClick={onNext}>
            Skip — check all {source.total}
          </button>
        )}
        <button type="button" className="btn" onClick={onNext}>
          Next: Requirements →
        </button>
      </div>
    </div>
  );
}
