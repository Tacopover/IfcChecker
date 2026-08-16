import type { ApplicabilityFacetDraft, FacetDraft } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { ConditionRow } from "./ConditionRow.js";
import { ClassificationRow } from "./ClassificationRow.js";
import { MaterialRow } from "./MaterialRow.js";
import { PartOfRow } from "./PartOfRow.js";
import { EntityRow } from "./EntityRow.js";

interface RowProps<T> {
  facet: T;
  source: FieldsForResult;
  onChange: (next: T) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * The row for one facet in `<requirements>`, whichever of the six kinds it is.
 *
 * A dispatch rather than a component that switches internally: each kind's rules are its own —
 * classification names a system and a code, partOf a relation and a class, entity states no
 * cardinality at all — and they share the frame and the value editor rather than a body.
 *
 * `onChange` takes the whole union, which is what lets each arm hand it a narrower callback without
 * a cast: a function accepting any facet is accepted where one accepting a classification is asked
 * for.
 */
export function RequirementRow({
  facet,
  source,
  hits,
  matched,
  onChange,
  onDuplicate,
  onDelete,
}: RowProps<FacetDraft> & { hits: number; matched: number }) {
  const shared = { source, hits, matched, onChange, onDuplicate, onDelete };

  switch (facet.kind) {
    case "attribute":
    case "property":
      return <ConditionRow condition={facet} {...shared} />;
    case "classification":
      return <ClassificationRow facet={facet} {...shared} />;
    case "material":
      return <MaterialRow facet={facet} {...shared} />;
    case "partOf":
      return <PartOfRow facet={facet} {...shared} />;
    case "entity":
      return <EntityRow facet={facet} {...shared} />;
  }
}

/**
 * The row for one facet in an `<applicability>`, narrowing which elements the rule is about.
 *
 * The same five rows, with `side` withholding the cardinality select, the author's note and the
 * score — `ids.xsd` gives an applicability facet none of the three. `entity` is absent because that
 * one is the rule's type chips, the only facet whose selection can be listed rather than tested.
 */
export function ApplicabilityRow({
  facet,
  source,
  onChange,
  onDuplicate,
  onDelete,
}: RowProps<ApplicabilityFacetDraft>) {
  const shared = { source, side: "applicability" as const, onChange, onDuplicate, onDelete };

  switch (facet.kind) {
    case "attribute":
    case "property":
      return <ConditionRow condition={facet} {...shared} />;
    case "classification":
      return <ClassificationRow facet={facet} {...shared} />;
    case "material":
      return <MaterialRow facet={facet} {...shared} />;
    case "partOf":
      return <PartOfRow facet={facet} {...shared} />;
  }
}
