import type { NormalizedElement, PropertyValue } from "@ifc-qa/shared-types";
import type { ConditionDraft, FacetDraft } from "@ifc-qa/ids-validator";
import { isConditionFacet, plainNameOf } from "@ifc-qa/ids-validator";
import { nameSummary } from "./ConditionRow.js";

const TOP_LEVEL_READERS: Record<string, (element: NormalizedElement) => PropertyValue | null> = {
  GLOBALID: (element) => element.globalId,
  NAME: (element) => element.name,
  PREDEFINEDTYPE: (element) => element.predefinedType,
};

/**
 * What the "actual" column can show.
 *
 * `notOneSlot` is a condition whose name is a pattern or a list: it is about a *set* of fields, and
 * the column shows one. Stated as its own case rather than read as `null`, which the column already
 * spells "not set" — the two are opposite claims about the element.
 */
export type ConditionValue =
  | { kind: "value"; value: PropertyValue | null }
  | { kind: "notOneSlot" };

/** Mirrors what facet evaluation reads, so the "actual" column shows the value that was judged. */
export function readConditionValue(
  element: NormalizedElement,
  condition: ConditionDraft
): ConditionValue {
  const name = plainNameOf(condition.name);
  if (name === null) return { kind: "notOneSlot" };

  if (condition.kind === "property") {
    const propertySet = plainNameOf(condition.propertySet);
    if (propertySet === null && condition.propertySet !== null) return { kind: "notOneSlot" };
    const set = element.propertySets[propertySet ?? ""];
    return { kind: "value", value: set?.[name]?.value ?? null };
  }

  const topLevel = TOP_LEVEL_READERS[name.toUpperCase()];
  if (topLevel) return { kind: "value", value: topLevel(element) };
  const key = Object.keys(element.attributes).find(
    (candidate) => candidate.toUpperCase() === name.toUpperCase()
  );
  return { kind: "value", value: key === undefined ? null : element.attributes[key].value };
}

/** The "checked" column: the field a row names, or the phrase a restriction-valued name reads as. */
function checkedLabel(condition: ConditionDraft): string {
  const name = plainNameOf(condition.name) ?? nameSummary(condition.name);
  if (condition.kind !== "property" || condition.propertySet === null) return name;
  const set = plainNameOf(condition.propertySet) ?? nameSummary(condition.propertySet);
  return `${set}.${name}`;
}

export interface FailingElementsTableProps {
  failures: Array<{ element: NormalizedElement; conditionIndex: number; message?: string }>;
  conditions: FacetDraft[];
  limit?: number;
}

export function FailingElementsTable({ failures, conditions, limit = 12 }: FailingElementsTableProps) {
  const shown = failures.slice(0, limit);

  return (
    <div className="failing scroller">
      <table>
        <caption>Failing elements</caption>
        <thead>
          <tr>
            <th>GlobalId</th>
            <th>Type</th>
            <th>Name</th>
            <th>Checked</th>
            <th>Actual</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((failure, index) => {
            const facet = conditions[failure.conditionIndex];
            // The "actual" column reads one field off the element, which only the two facets a
            // row can show name. The other four are reported by the validator's own message.
            const condition = facet && isConditionFacet(facet) ? facet : null;
            const read = condition ? readConditionValue(failure.element, condition) : null;
            const value = read?.kind === "value" ? read.value : null;
            return (
              <tr key={`${failure.element.globalId}:${failure.conditionIndex}:${index}`}>
                <td>{failure.element.globalId}</td>
                <td>{failure.element.ifcType}</td>
                <td>{(failure.element.name ?? "").slice(0, 30)}</td>
                <td>{condition ? checkedLabel(condition) : (facet?.kind ?? "")}</td>
                <td>
                  {read?.kind === "notOneSlot" ? (
                    // The condition is about a set of fields, so there is no one value to show.
                    // The validator's own message names the field that failed.
                    <>
                      <span className="miss">not shown for a name given as a pattern</span>
                      {failure.message && <span className="why">{failure.message}</span>}
                    </>
                  ) : value === null || value === undefined || String(value) === "" ? (
                    // "not set" already is the reason; repeating the validator's wording here
                    // would say the same thing twice.
                    <span className="miss">not set</span>
                  ) : (
                    <>
                      {String(value)}
                      {failure.message && <span className="why">{failure.message}</span>}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {failures.length > shown.length && (
        <p className="failing-more">+{failures.length - shown.length} more</p>
      )}
    </div>
  );
}
