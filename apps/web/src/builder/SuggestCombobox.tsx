import { useId, useRef, useState, type KeyboardEvent } from "react";

export interface SuggestComboboxProps {
  /** The field's own accessible name — "Property set", "Field name", "Value". */
  label: string;
  value: string;
  /** What the loaded file holds for this field, in the order it should be offered. */
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  /** The id of the row's error message, so the box can point at it. */
  errorId?: string;
  invalid?: boolean;
}

/**
 * Anything the file suggests and the user may overrule: the model's own list on the dropdown,
 * free text in the box. Every field in the builder that reads the loaded IFC uses this one —
 * the two property names, and every `idsValue` behind `FacetValueEditor`.
 *
 * Not a `<datalist>`, which the browser owns and filters down to what has been typed — so an
 * entry the file has nothing under empties the very list it was meant to be picked from, and an
 * empty box drops the list beside the field rather than under it. The same list, owned here
 * instead: typing closes it rather than narrowing it, reopening shows it whole, and a typed entry
 * leads it, so whatever is in the box is always something the list can put back.
 */
export function SuggestCombobox({
  label,
  value,
  options,
  placeholder,
  onChange,
  errorId,
  invalid,
}: SuggestComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // An entry the file has nothing under is the one the model cannot offer, and the one the user
  // is most likely to want back after looking through the rest — so it goes first.
  const typed = value !== "" && !options.includes(value);
  const entries = typed ? [value, ...options] : options;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function openList() {
    setOpen(true);
    setActive(entries.indexOf(value));
  }

  function commit(next: string) {
    onChange(next);
    close();
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = active + step;
      setActive(next < 0 ? entries.length - 1 : next >= entries.length ? 0 : next);
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (active >= 0) commit(entries[active]);
      else close();
    }
  }

  return (
    <span
      className="combo"
      // Closes on the way out of the whole control, so moving between the box and its toggle
      // doesn't shut the list the user just asked for.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        className={typed ? "tok typed" : "tok"}
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? errorId : undefined}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="none"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          // Typing closes it: the list is the file's, and it has nothing to say about an entry
          // half-written. It comes back whole the moment the user asks for it again.
          close();
          onChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="combo-toggle"
        // Not a tab stop: the box beside it already reaches this list with ArrowDown, and a
        // second stop per field would double the tabbing it takes to cross a row.
        tabIndex={-1}
        aria-label={`Show ${label} suggestions`}
        onClick={() => (open ? close() : openList())}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="combo-list"
          // Keeps focus in the box, so picking an entry doesn't blur the control into closing
          // the list before the click lands on it.
          onMouseDown={(event) => event.preventDefault()}
        >
          {entries.map((entry, index) => (
            <li
              key={entry}
              id={optionId(index)}
              role="option"
              aria-selected={entry === value}
              className={index === active ? "combo-option active" : "combo-option"}
              onClick={() => commit(entry)}
            >
              <span className="combo-name">{entry}</span>
              {typed && index === 0 && <span className="combo-note">typed</span>}
            </li>
          ))}
          {entries.length === 0 && (
            <li role="presentation" className="combo-empty">
              Nothing for this field in the file.
            </li>
          )}
        </ul>
      )}
    </span>
  );
}
