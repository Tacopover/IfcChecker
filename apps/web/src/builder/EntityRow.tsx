import { useMemo } from "react";
import type { EntityFacetDraft } from "@ifc-qa/ids-validator";
import { plainNameOf } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import type { ObservedValue } from "./ValuePicker.js";
import { FacetValueEditor } from "./FacetValueEditor.js";
import { FacetRowFrame, errorIdOf } from "./FacetRowFrame.js";
import { conditionProblem } from "./completeness.js";

/** The classes the selection holds, spelled as the file spells them. */
function classOptions(source: FieldsForResult): ObservedValue[] {
  return source.ifcTypes.map((entry) => ({ value: entry.ifcType, count: entry.hits }));
}

/**
 * The predefined types seen on the class this facet names, or on every class in the selection when
 * it names none plainly.
 *
 * A pattern-valued class reaches a set of classes, so no single list is the right one — the same
 * answer a pattern-valued classification system and a pattern-valued partOf class both get.
 */
export function predefinedTypeOptions(
  source: FieldsForResult,
  ifcType: string | null
): ObservedValue[] {
  const merged = new Map<string, number>();
  for (const entry of source.ifcTypes) {
    if (ifcType !== null && entry.ifcType !== ifcType) continue;
    for (const type of entry.predefinedTypes) {
      merged.set(type.value, (merged.get(type.value) ?? 0) + type.count);
    }
  }
  return [...merged.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export interface EntityRowProps {
  facet: EntityFacetDraft;
  source: FieldsForResult;
  hits: number;
  matched: number;
  touched: boolean;
  onTouch: () => void;
  onChange: (next: EntityFacetDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * "Must be an IFCWALL whose predefined type must be exactly PARTITIONING."
 *
 * The last of the four requirement kinds, and the only one that states **no cardinality at all**.
 * `ids.xsd` gives the requirements-side `<entity>` none and says why: the list of classes is finite
 * and mandated by IFC, so a prohibited form would be superfluous. The row therefore has no
 * cardinality select and is never drawn prohibited.
 *
 * The class is matched exactly and case-sensitively, so the names offered are the file's own
 * spelling — `IFCWALL`, not the `IfcWall` the applicability chips use. `<name>` is mandatory and
 * `<predefinedType>` optional, the same asymmetry the classification and partOf rows carry.
 */
export function EntityRow({
  facet,
  source,
  hits,
  matched,
  touched,
  onTouch,
  onChange,
  onDuplicate,
  onDelete,
}: EntityRowProps) {
  const ifcType = plainNameOf(facet.name);
  const classes = useMemo(() => classOptions(source), [source]);
  const predefinedTypes = useMemo(
    () => predefinedTypeOptions(source, ifcType),
    [source, ifcType]
  );

  const error = touched ? conditionProblem(facet) : null;
  const errorId = errorIdOf(facet.id);

  return (
    <FacetRowFrame
      id={facet.id}
      prohibited={false}
      hits={hits}
      matched={matched}
      instructions={facet.instructions}
      error={error}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onTouch={onTouch}
    >
      <span className="tok">Entity</span>

      <span className="glue">must be of a class that must</span>
      <FacetValueEditor
        id={facet.id}
        label="Class"
        operatorLabel="Class operator"
        value={facet.name}
        // `<name>` is mandatory, so `null` never reaches the draft and the editor never offers it.
        onChange={(value) => onChange({ ...facet, name: value ?? facet.name })}
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
