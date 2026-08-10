import type { NormalizedElement, PropertyValue } from "@ifc-qa/shared-types";
import type { ConditionDraft } from "@ifc-qa/ids-validator";

const TOP_LEVEL_READERS: Record<string, (element: NormalizedElement) => PropertyValue | null> = {
  GLOBALID: (element) => element.globalId,
  NAME: (element) => element.name,
  PREDEFINEDTYPE: (element) => element.predefinedType,
};

/** Mirrors what facet evaluation reads, so the "actual" column shows the value that was judged. */
export function readConditionValue(
  element: NormalizedElement,
  condition: ConditionDraft
): PropertyValue | null {
  if (condition.kind === "property") {
    const set = element.propertySets[condition.propertySet ?? ""];
    return set?.[condition.name]?.value ?? null;
  }
  const topLevel = TOP_LEVEL_READERS[condition.name.toUpperCase()];
  if (topLevel) return topLevel(element);
  const key = Object.keys(element.attributes).find(
    (candidate) => candidate.toUpperCase() === condition.name.toUpperCase()
  );
  return key === undefined ? null : element.attributes[key].value;
}

export interface FailingElementsTableProps {
  failures: Array<{ element: NormalizedElement; conditionIndex: number; message?: string }>;
  conditions: ConditionDraft[];
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
            const condition = conditions[failure.conditionIndex];
            const value = condition ? readConditionValue(failure.element, condition) : null;
            return (
              <tr key={`${failure.element.globalId}:${failure.conditionIndex}:${index}`}>
                <td>{failure.element.globalId}</td>
                <td>{failure.element.ifcType}</td>
                <td>{(failure.element.name ?? "").slice(0, 30)}</td>
                <td>
                  {condition
                    ? `${condition.kind === "property" ? `${condition.propertySet}.` : ""}${condition.name}`
                    : ""}
                </td>
                <td>
                  {value === null || value === undefined || String(value) === "" ? (
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
