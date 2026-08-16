import type { FacetDraft } from "@ifc-qa/ids-validator";

/** A facet the draft model holds but no row can edit yet. */
export type UnshownFacet = Exclude<
  FacetDraft,
  { kind: "attribute" | "property" | "classification" | "material" | "partOf" }
>;

function summaryOf(facet: UnshownFacet): string {
  switch (facet.kind) {
    case "entity":
      return "Must be one of these IFC classes";
  }
}

export interface UnshownFacetRowProps {
  facet: UnshownFacet;
  hits: number;
  matched: number;
  onDelete: () => void;
}

/**
 * A requirement the rule really does check, shown read-only because the builder has no controls for
 * it yet.
 *
 * The importer reads all six kinds, so these do reach a rule. The row is what keeps one visible in
 * the rule it belongs to rather than silently thinning the list — the same reason a range already
 * has a row. One kind is left: `classification`, `material` and `partOf` have controls now, and the
 * requirement-side `entity` gets them in turn.
 *
 * No cardinality is stated, because the kind left cannot say one — `ids.xsd` gives the
 * requirements-side `<entity>` none at all.
 */
export function UnshownFacetRow({ facet, hits, matched, onDelete }: UnshownFacetRowProps) {
  const scoreClass = matched === 0 ? "empty" : hits === matched ? "all-pass" : "has-fail";

  return (
    <div className="cond">
      <span className="tok">{facet.kind}</span>
      <span className="cond-unshown">
        {summaryOf(facet)}. Checked, but not editable here yet.
      </span>

      <span className={`cond-score score ${scoreClass}`}>
        <span className="score-text num">
          {hits}/{matched}
        </span>
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

      {facet.instructions && <span className="cond-note">{facet.instructions}</span>}
    </div>
  );
}
