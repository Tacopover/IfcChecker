import type { ReactNode } from "react";

/**
 * Which half of the specification a row stands in.
 *
 * The same distinction `facetXml` and `readFacetShell` take, and for the same reason: `ids.xsd`
 * gives an applicability facet no `cardinality`, no `instructions` and no `uri`, because
 * `applicabilityType` references the base facet types while `requirementsType` is what extends each
 * of them with those attributes.
 */
export type FacetSide = "requirements" | "applicability";

export interface FacetRowFrameProps {
  /** The facet's id, so the error message has one the value controls can point at. */
  id: string;
  side?: FacetSide;
  /** Drawn differently, because a prohibited row states the opposite of the ones around it. */
  prohibited: boolean;
  /**
   * How many of the elements the rule applies to satisfy this facet.
   *
   * Absent on the applicability side, where a facet has no score of its own: it narrows the count
   * beside the rule rather than being passed or failed by the elements it selects.
   */
  hits?: number;
  matched?: number;
  /** The author's prose, and where the requirement is defined outside the file. */
  instructions?: string | null;
  uri?: string | null;
  /** Why the facet cannot be exported, or `null` when it can. */
  error: string | null;
  /**
   * What the duplicate and delete affordances call this row. Several rows sit in one rule, so the
   * noun is what tells them apart to anyone reading the labels rather than the sentence.
   */
  what?: string;
  onDuplicate: () => void;
  onDelete: () => void;
  /**
   * Called when focus leaves the row. `error` already reflects whichever gate the caller applies
   * (see `RuleCard`'s `touchedFacetIds`) — this is only how the row tells the caller "the user has
   * now interacted with this one," so a freshly-added facet's error stays hidden until they do.
   */
  onTouch: () => void;
  /** The sentence itself — the kind, the cardinality and the value editors. */
  children: ReactNode;
}

/**
 * The head and tail every facet row shares, whichever of the six kinds it shows.
 *
 * Only the middle differs between them: a classification names a system and a code, a material one
 * name, a partOf a class and a relation. The score, the duplicate and delete affordances, the
 * author's `instructions` and `uri`, and the completeness error are the same everywhere, and the
 * error's id has to reach the value controls through `aria-describedby` — which is the part a
 * per-kind copy gets wrong first.
 *
 * The kind label sits in `children` rather than here, because `ConditionRow` states it with a
 * select and the others with a token.
 */
export function FacetRowFrame({
  id,
  side = "requirements",
  prohibited,
  hits,
  matched,
  instructions,
  uri,
  error,
  what = "condition",
  onDuplicate,
  onDelete,
  onTouch,
  children,
}: FacetRowFrameProps) {
  const selects = side === "applicability";
  const scoreClass = matched === 0 ? "empty" : hits === matched ? "all-pass" : "has-fail";

  return (
    <div
      className={`cond${prohibited ? " prohibited" : ""}${selects ? " applicability-facet" : ""}`}
      onBlur={onTouch}
    >
      {children}

      <span className={selects ? "cond-score" : `cond-score score ${scoreClass}`}>
        {/* No score on the applicability side: the facet narrows the count beside the rule rather
            than being passed or failed, so a fraction here would be a claim about the wrong thing. */}
        {!selects && (
          <span className="score-text num">
            {hits}/{matched}
          </span>
        )}
        <button
          type="button"
          className="iconbtn"
          title={`Duplicate ${what}`}
          aria-label={`Duplicate ${what}`}
          onClick={onDuplicate}
        >
          ⧉
        </button>
        <button
          type="button"
          className="iconbtn danger"
          title={`Remove ${what}`}
          aria-label={`Remove ${what}`}
          onClick={onDelete}
        >
          ✕
        </button>
      </span>

      {/* An applicability facet may carry neither, so there is never a note to show on that side. */}
      {!selects && (instructions || uri) && (
        <span className="cond-note">
          {instructions}
          {/* Shown as text, never as a link: the address comes from a file someone else wrote. */}
          {uri && <span className="cond-uri">{uri}</span>}
        </span>
      )}

      {error && (
        <span className="cond-error" id={errorIdOf(id)}>
          {error}
        </span>
      )}
    </div>
  );
}

/** Where a row's error message lives, so its value controls can point at the same id. */
export function errorIdOf(id: string): string {
  return `cond-error-${id}`;
}

/**
 * What the duplicate and delete affordances call this row.
 *
 * On the applicability side the kind is the only thing telling two rows apart, and "remove
 * condition" would be wrong twice over — the facet is not a condition, and removing it changes
 * which elements the rule reaches rather than what they must satisfy.
 */
export function rowNoun(side: FacetSide, kind: string): string {
  return side === "applicability" ? `the ${kind} this rule selects by` : "condition";
}
