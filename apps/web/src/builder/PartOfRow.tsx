import { useMemo } from "react";
import type { PartOfFacetDraft, SimpleCardinality } from "@ifc-qa/ids-validator";
import { PART_OF_RELATIONS, plainNameOf } from "@ifc-qa/ids-validator";
import type { FieldsForResult, PartOfSummary } from "./introspect.js";
import type { ObservedValue } from "./ValuePicker.js";
import { FacetValueEditor } from "./FacetValueEditor.js";
import { FacetRowFrame, errorIdOf, rowNoun, type FacetSide } from "./FacetRowFrame.js";
import { conditionProblem } from "./completeness.js";

/**
 * What `ids.xsd` gives `partOf` — `simpleCardinality`, which has no `optional`.
 *
 * Not a shortened copy of `CARDINALITIES`: a `partOf cardinality="optional"` is a document the
 * schema does not describe, and the importer already refuses one, so offering it here would let the
 * builder write what its own reader would then reject.
 */
export const SIMPLE_CARDINALITIES: Array<{ id: SimpleCardinality; label: string }> = [
  { id: "required", label: "must" },
  { id: "prohibited", label: "must NOT" },
];

/**
 * How the sentence names each relationship, with `""` for the facet stating none.
 *
 * The value is the schema's own enumeration member — including the one that names two IFC
 * relationships in a single string — so what the select writes is what `ids.xsd` allows.
 */
const RELATION_LABELS: Record<string, string> = {
  IFCRELAGGREGATES: "aggregated into",
  IFCRELASSIGNSTOGROUP: "assigned to",
  IFCRELCONTAINEDINSPATIALSTRUCTURE: "contained in",
  IFCRELNESTS: "nested in",
  "IFCRELVOIDSELEMENT IFCRELFILLSELEMENT": "filling a void in",
};

/** The value the select carries when the facet accepts any relationship. */
const ANY_RELATION = "";

/**
 * Whether a whole the model holds is reached by the relationship this facet names.
 *
 * The draft stores the author's attribute verbatim and one member of the enumeration is two names,
 * so membership is decided on the split — the same reading `compileFacet` gives it. An element's
 * own `relation` is always a single name.
 */
function reachedBy(whole: PartOfSummary, relation: string | null): boolean {
  if (relation === null) return true;
  return relation.trim().split(/\s+/).includes(whole.relation);
}

/** The classes the selection is part of, under the relationship this facet names. */
function classOptions(source: FieldsForResult, relation: string | null): ObservedValue[] {
  const merged = new Map<string, number>();
  for (const whole of source.wholes) {
    if (!reachedBy(whole, relation)) continue;
    merged.set(whole.ifcType, (merged.get(whole.ifcType) ?? 0) + whole.hits);
  }
  return rank(merged);
}

/**
 * The predefined types seen on those wholes, narrowed to the class the facet names.
 *
 * A pattern-valued class reaches a set of classes, so no single list is the right one and every
 * predefined type under the relationship is offered — the same answer a pattern-valued
 * classification system gets.
 */
function predefinedTypeOptions(
  source: FieldsForResult,
  relation: string | null,
  ifcType: string | null
): ObservedValue[] {
  const merged = new Map<string, number>();
  for (const whole of source.wholes) {
    if (!reachedBy(whole, relation)) continue;
    if (ifcType !== null && whole.ifcType !== ifcType) continue;
    for (const entry of whole.predefinedTypes) {
      merged.set(entry.value, (merged.get(entry.value) ?? 0) + entry.count);
    }
  }
  return rank(merged);
}

function rank(merged: Map<string, number>): ObservedValue[] {
  return [...merged.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export interface PartOfRowProps {
  facet: PartOfFacetDraft;
  source: FieldsForResult;
  side?: FacetSide;
  hits?: number;
  matched?: number;
  onChange: (next: PartOfFacetDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * "Must be contained in a whole whose class must be exactly IFCBUILDINGSTOREY."
 *
 * The third requirement kind to get controls, and the one whose cardinality alphabet is short: two
 * values rather than three. Two `idsValue` parameters, and they are not symmetric — `ids.xsd` makes
 * the nested `<entity><name>` mandatory, so its editor never offers the absent reading, while
 * `<predefinedType>` is optional and a facet stating none asks nothing about it.
 *
 * The relationship is a select over the schema's own enumeration rather than a value editor: it is
 * an XML attribute with five legal spellings, not an `idsValue`, so no restriction can stand there.
 */
export function PartOfRow({
  facet,
  source,
  side = "requirements",
  hits,
  matched,
  onChange,
  onDuplicate,
  onDelete,
}: PartOfRowProps) {
  const selects = side === "applicability";
  const ifcType = plainNameOf(facet.entityName);
  const classes = useMemo(() => classOptions(source, facet.relation), [source, facet.relation]);
  const predefinedTypes = useMemo(
    () => predefinedTypeOptions(source, facet.relation, ifcType),
    [source, facet.relation, ifcType]
  );

  const error = conditionProblem(facet);
  const errorId = errorIdOf(facet.id);

  return (
    <FacetRowFrame
      id={facet.id}
      side={side}
      prohibited={facet.cardinality === "prohibited"}
      hits={hits}
      matched={matched}
      instructions={facet.instructions}
      error={error}
      what={rowNoun(side, "partOf")}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    >
      <span className="tok">Part of</span>

      {selects ? (
        <span className="glue">selects only those</span>
      ) : (
        <>
          <select
            aria-label="Cardinality"
            title="Whether the element has to be part of a whole at all"
            value={facet.cardinality}
            onChange={(event) =>
              onChange({ ...facet, cardinality: event.target.value as SimpleCardinality })
            }
          >
            {SIMPLE_CARDINALITIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>

          <span className="glue">be</span>
        </>
      )}
      <select
        aria-label="Relationship"
        title="Which IFC relationship makes the element a part of the whole"
        value={facet.relation ?? ANY_RELATION}
        onChange={(event) =>
          onChange({
            ...facet,
            relation: event.target.value === ANY_RELATION ? null : event.target.value,
          })
        }
      >
        <option value={ANY_RELATION}>part of</option>
        {PART_OF_RELATIONS.map((relation) => (
          <option key={relation} value={relation}>
            {RELATION_LABELS[relation] ?? relation}
          </option>
        ))}
      </select>

      <span className="glue">a whole whose class must</span>
      <FacetValueEditor
        id={facet.id}
        label="Class"
        operatorLabel="Class operator"
        value={facet.entityName}
        // `<entity><name>` is mandatory, so `null` never reaches the draft and the editor never
        // offers it — the same asymmetry a classification's `<system>` has.
        onChange={(value) => onChange({ ...facet, entityName: value ?? facet.entityName })}
        observed={classes}
        absentLabel={null}
        errorId={errorId}
        invalid={error !== null}
      />

      <span className="glue">· with a predefined type that must</span>
      <FacetValueEditor
        id={facet.id}
        label="Predefined type"
        operatorLabel="Predefined type operator"
        value={facet.predefinedType}
        onChange={(value) => onChange({ ...facet, predefinedType: value })}
        observed={predefinedTypes}
        absentLabel="be anything"
        errorId={errorId}
        invalid={error !== null}
      />
    </FacetRowFrame>
  );
}
