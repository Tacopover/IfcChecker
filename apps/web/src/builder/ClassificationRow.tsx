import { useMemo } from "react";
import type { ClassificationFacetDraft, ConditionalCardinality } from "@ifc-qa/ids-validator";
import { plainNameOf } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import type { ObservedValue } from "./ValuePicker.js";
import { FacetValueEditor } from "./FacetValueEditor.js";
import { FacetRowFrame, errorIdOf, rowNoun, type FacetSide } from "./FacetRowFrame.js";
import { CARDINALITIES } from "./ConditionRow.js";
import { conditionProblem } from "./completeness.js";

/**
 * The systems the selection is classified in, as the rail saw them.
 *
 * A system the file leaves unnamed is dropped rather than offered: `ids.xsd` types `<system>` as an
 * `idsValue`, which cannot state "no name", and offering an empty option would write a facet that
 * matches nothing.
 */
function systemOptions(source: FieldsForResult): ObservedValue[] {
  return source.classifications
    .filter((entry) => entry.system !== null)
    .map((entry) => ({ value: entry.system as string, count: entry.hits }));
}

/**
 * The codes seen under the system this facet names, or under every system when it names none
 * plainly.
 *
 * A pattern-valued system reaches a set of systems, so no single list is the right one — offering
 * all of them is the honest answer, the same way a pattern-valued property name leaves the field
 * select showing a phrase instead of one field.
 */
function codeOptions(source: FieldsForResult, system: string | null): ObservedValue[] {
  const wanted = source.classifications.filter(
    (entry) => system === null || entry.system === system
  );
  const merged = new Map<string, number>();
  for (const entry of wanted) {
    for (const code of entry.values) merged.set(code.value, (merged.get(code.value) ?? 0) + code.count);
  }
  return [...merged.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export interface ClassificationRowProps {
  facet: ClassificationFacetDraft;
  source: FieldsForResult;
  side?: FacetSide;
  hits?: number;
  matched?: number;
  onChange: (next: ClassificationFacetDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * "Must be classified in Uniformat as one of B2010, B20."
 *
 * The first of the four requirement kinds to get controls. Two `idsValue` parameters, and they are
 * not symmetric: `ids.xsd` makes `<system>` mandatory, so its editor never offers the absent
 * reading, while `<value>` is optional and a facet stating none asks only that the element be
 * classified in the system at all.
 */
export function ClassificationRow({
  facet,
  source,
  side = "requirements",
  hits,
  matched,
  onChange,
  onDuplicate,
  onDelete,
}: ClassificationRowProps) {
  const selects = side === "applicability";
  const system = plainNameOf(facet.system);
  const systems = useMemo(() => systemOptions(source), [source]);
  const codes = useMemo(() => codeOptions(source, system), [source, system]);

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
      uri={facet.uri}
      error={error}
      what={rowNoun(side, "classification")}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    >
      <span className="tok">Classification</span>

      {selects ? (
        <span className="glue">selects only those classified in a system that must</span>
      ) : (
        <>
          <select
            aria-label="Cardinality"
            title="Whether the element has to be classified at all"
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

          <span className="glue">be classified in a system that must</span>
        </>
      )}
      <FacetValueEditor
        id={facet.id}
        label="System"
        operatorLabel="System operator"
        value={facet.system}
        // `<system>` is mandatory, so `null` never reaches the draft and the editor never offers it.
        // `compileValue` would turn one into an empty restriction, which XSD reads as any string.
        onChange={(value) => onChange({ ...facet, system: value ?? facet.system })}
        observed={systems}
        absentLabel={null}
        errorId={errorId}
        invalid={error !== null}
      />

      <span className="glue">· with a code that must</span>
      <FacetValueEditor
        id={facet.id}
        label="Code"
        operatorLabel="Code operator"
        value={facet.value}
        onChange={(value) => onChange({ ...facet, value })}
        observed={codes}
        absentLabel="be anything"
        errorId={errorId}
        invalid={error !== null}
      />
    </FacetRowFrame>
  );
}
