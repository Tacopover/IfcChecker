import type { ApplicabilityFacetDraft, ValueDraft } from "@ifc-qa/ids-validator";
import { nameSummary } from "./ConditionRow.js";

/**
 * One line of what an imported rule selects by, beyond its list of IFC classes.
 *
 * Read-only, like `UnshownFacetRow` and for the same reason: the facet really does decide which
 * elements the rule reaches, so hiding it would make the type chips look like the whole story. It
 * carries no score of its own — an applicability facet narrows the count beside the rule rather
 * than being passed or failed by the elements it selects — and no cardinality, because `ids.xsd`
 * gives an applicability facet none.
 */
export interface ApplicabilityFacetRowProps {
  facet: ApplicabilityFacetDraft;
  onDelete: () => void;
}

/** What the facet constrains its value to, or `null` when it only asks that the value be there. */
function valuePhrase(value: ValueDraft | null): string | null {
  return value === null ? null : nameSummary(value);
}

function summaryOf(facet: ApplicabilityFacetDraft): string {
  switch (facet.kind) {
    case "attribute": {
      const value = valuePhrase(facet.value);
      const name = nameSummary(facet.name);
      return value === null ? `that have ${name}` : `whose ${name} is ${value}`;
    }
    case "property": {
      const value = valuePhrase(facet.value);
      const where = facet.propertySet === null ? "" : ` in ${nameSummary(facet.propertySet)}`;
      const name = `${nameSummary(facet.name)}${where}`;
      return value === null ? `that have ${name}` : `whose ${name} is ${value}`;
    }
    case "classification": {
      const value = valuePhrase(facet.value);
      const system = nameSummary(facet.system);
      return value === null
        ? `classified in ${system}`
        : `classified in ${system} as ${value}`;
    }
    case "material": {
      const value = valuePhrase(facet.value);
      return value === null ? "made of any material" : `made of ${value}`;
    }
    case "partOf": {
      const via = facet.relation === null ? "" : ` by ${facet.relation}`;
      return `that are part of a ${nameSummary(facet.entityName)}${via}`;
    }
  }
}

export function ApplicabilityFacetRow({ facet, onDelete }: ApplicabilityFacetRowProps) {
  return (
    <div className="cond applicability-facet">
      <span className="tok">{facet.kind}</span>
      <span className="cond-unshown">
        …and only those {summaryOf(facet)}. Part of what this rule selects, not editable here yet.
      </span>
      <span className="cond-score">
        <button
          type="button"
          className="iconbtn danger"
          title="Remove this from what the rule selects"
          aria-label={`Remove the ${facet.kind} from what this rule selects`}
          onClick={onDelete}
        >
          ✕
        </button>
      </span>
    </div>
  );
}
