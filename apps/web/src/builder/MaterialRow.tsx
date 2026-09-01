import type { ConditionalCardinality, MaterialFacetDraft } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { FacetValueEditor } from "./FacetValueEditor.js";
import { FacetRowFrame, errorIdOf, rowNoun, type FacetSide } from "./FacetRowFrame.js";
import { CARDINALITIES } from "./ConditionRow.js";
import { conditionProblem } from "./completeness.js";

export interface MaterialRowProps {
  facet: MaterialFacetDraft;
  source: FieldsForResult;
  side?: FacetSide;
  hits?: number;
  matched?: number;
  touched: boolean;
  onTouch: () => void;
  onChange: (next: MaterialFacetDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * "Must be made of a material that must be exactly Concrete."
 *
 * One `idsValue`, and it is optional — a facet stating none asks only whether the element is made
 * of anything at all, which is a real check rather than an empty one. That is why the editor offers
 * the absent reading here and withholds it on a classification's system.
 *
 * The names offered are every string a material facet can match: the materials themselves, the
 * layer, profile and constituent sets holding them, and each member within those sets. IDS gives
 * the facet one parameter, so which of them a match came from never matters.
 */
export function MaterialRow({
  facet,
  source,
  side = "requirements",
  hits,
  matched,
  touched,
  onTouch,
  onChange,
  onDuplicate,
  onDelete,
}: MaterialRowProps) {
  const error = touched ? conditionProblem(facet) : null;
  const selects = side === "applicability";

  return (
    <FacetRowFrame
      id={facet.id}
      side={side}
      prohibited={facet.cardinality === "prohibited"}
      hits={hits}
      matched={matched}
      instructions={facet.instructions}
      uri={facet.uri}
      error={error}
      what={rowNoun(side, "material")}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onTouch={onTouch}
    >
      <span className="tok">Material</span>

      {selects ? (
        <span className="glue">selects only those made of a material that must</span>
      ) : (
        <>
          <select
            aria-label="Cardinality"
            title="Whether the element has to be made of anything at all"
            value={facet.cardinality}
            onChange={(event) =>
              onChange({ ...facet, cardinality: event.target.value as ConditionalCardinality })
            }
          >
            {CARDINALITIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>

          <span className="glue">be made of a material that must</span>
        </>
      )}
      <FacetValueEditor
        label="Material"
        operatorLabel="Material operator"
        value={facet.value}
        onChange={(value) => onChange({ ...facet, value })}
        observed={source.materials}
        absentLabel="be anything"
        errorId={errorIdOf(facet.id)}
        invalid={error !== null}
      />
    </FacetRowFrame>
  );
}
