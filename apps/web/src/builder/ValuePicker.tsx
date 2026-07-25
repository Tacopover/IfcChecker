import { useState } from "react";

export interface ObservedValue {
  value: string;
  count: number;
}

export interface ValuePickerProps {
  observed: ObservedValue[];
  selected: string[];
  onChange: (values: string[]) => void;
}

/**
 * The enumeration editor for `oneOf`. Values seen in the file come with their counts; a value the
 * file does not contain is still legitimate — a rule may demand a code nobody has typed yet — so it
 * can be added by hand and is flagged as absent.
 */
export function ValuePicker({ observed, selected, onChange }: ValuePickerProps) {
  const [draft, setDraft] = useState("");

  const observedValues = new Set(observed.map((entry) => entry.value));
  const extras = selected
    .filter((value) => !observedValues.has(value))
    .map((value) => ({ value, count: 0 }));
  const options = [...observed, ...extras];

  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((entry) => entry !== value));
  }

  function addDraft() {
    const value = draft.trim();
    if (value === "" || selected.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...selected, value]);
    setDraft("");
  }

  return (
    <div className="values">
      <div className="values-head">
        <span className="micro">Values found in this file</span>
        <span className="cov num">{observed.length} distinct</span>
        <span className="spacer" />
        <input
          type="text"
          aria-label="Add a value not in this file"
          placeholder="add a value…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addDraft();
          }}
        />
        <button type="button" className="linkbtn" onClick={addDraft}>
          + add
        </button>
      </div>
      <div className="vgrid">
        {options.map((option) => (
          <label key={option.value} className={option.count === 0 ? "vopt absent" : "vopt"}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            <span>{option.value}</span>
            <span className="n num">{option.count === 0 ? "not in file" : option.count}</span>
          </label>
        ))}
        {options.length === 0 && <span className="hint">No values for this field in the file.</span>}
      </div>
    </div>
  );
}
