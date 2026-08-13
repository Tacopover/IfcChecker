import type { ReactNode } from "react";

export interface FacetRowFrameProps {
  /** The facet's id, so the error message has one the value controls can point at. */
  id: string;
  /** Drawn differently, because a prohibited row states the opposite of the ones around it. */
  prohibited: boolean;
  /** How many of the elements the rule applies to satisfy this facet. */
  hits: number;
  matched: number;
  /** The author's prose, and where the requirement is defined outside the file. */
  instructions?: string | null;
  uri?: string | null;
  /** Why the facet cannot be exported, or `null` when it can. */
  error: string | null;
  onDuplicate: () => void;
  onDelete: () => void;
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
  prohibited,
  hits,
  matched,
  instructions,
  uri,
  error,
  onDuplicate,
  onDelete,
  children,
}: FacetRowFrameProps) {
  const scoreClass = matched === 0 ? "empty" : hits === matched ? "all-pass" : "has-fail";

  return (
    <div className={prohibited ? "cond prohibited" : "cond"}>
      {children}

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

      {(instructions || uri) && (
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
