import type { NormalizedElement, PropertyValue } from "@ifc-qa/shared-types";

function formatValue(value: PropertyValue): { text: string; missing: boolean } {
  if (value === null || value === "") return { text: "not set", missing: true };
  if (typeof value === "boolean") return { text: value ? "true" : "false", missing: false };
  return { text: String(value), missing: false };
}

function ValueRows({ values }: { values: Record<string, PropertyValue> }) {
  const names = Object.keys(values).sort((a, b) => a.localeCompare(b));
  return (
    <>
      {names.map((name) => {
        const { text, missing } = formatValue(values[name]);
        return (
          <tr key={name}>
            <th scope="row">{name}</th>
            <td className={missing ? "miss" : undefined}>{text}</td>
          </tr>
        );
      })}
    </>
  );
}

export interface ElementDetailsProps {
  element: NormalizedElement | null;
  fileName: string;
  onClose: () => void;
}

export function ElementDetails({ element, fileName, onClose }: ElementDetailsProps) {
  if (element === null) {
    return (
      <aside className="element-details" aria-label="Element details">
        <div className="element-details-head">
          <h3>Element</h3>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {/* Reachable whenever a file is removed while its results are still on screen. */}
        <p role="alert">
          This element is no longer loaded. Its file may have been removed since the check ran.
        </p>
      </aside>
    );
  }

  const propertySetNames = Object.keys(element.propertySets).sort((a, b) => a.localeCompare(b));
  const hasAttributes = Object.keys(element.attributes).length > 0;

  return (
    <aside className="element-details" aria-label="Element details">
      <div className="element-details-head">
        <h3>{element.name ?? "(unnamed)"}</h3>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <table>
        <caption>Identity</caption>
        <tbody>
          <tr>
            <th scope="row">GlobalId</th>
            <td>{element.globalId}</td>
          </tr>
          <tr>
            <th scope="row">IfcType</th>
            <td>{element.ifcType}</td>
          </tr>
          <tr>
            <th scope="row">PredefinedType</th>
            <td className={element.predefinedType === null ? "miss" : undefined}>
              {element.predefinedType ?? "not set"}
            </td>
          </tr>
          <tr>
            <th scope="row">File</th>
            <td>{fileName}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <caption>Attributes</caption>
        <tbody>
          {hasAttributes ? (
            <ValueRows values={element.attributes} />
          ) : (
            <tr>
              <td colSpan={2}>No attributes were read for this element.</td>
            </tr>
          )}
        </tbody>
      </table>

      {propertySetNames.length === 0 ? (
        <p>This element carries no property sets.</p>
      ) : (
        propertySetNames.map((setName) => (
          <table key={setName}>
            <caption>{setName}</caption>
            <tbody>
              <ValueRows values={element.propertySets[setName]} />
            </tbody>
          </table>
        ))
      )}
    </aside>
  );
}
