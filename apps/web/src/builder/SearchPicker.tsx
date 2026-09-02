import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

/**
 * How many rows the list draws before it asks the user to narrow instead. The IFC schema alone
 * offers ~900 names, and a panel that long is scrolled past rather than read — the same cap
 * `WizardAppliesToStep` puts on its own schema search. A caller whose whole list is small enough to
 * read raises it, so a stated value is always among the rows rather than beyond the cut.
 */
const DEFAULT_MAX_ROWS = 60;

export interface SearchPickerOption {
  /** What picking this row states — the name written into the draft. */
  value: string;
  /** How the row reads. Never carries a count; that is what `note` is for. */
  label: string;
  /** A dimmer second column: what this file holds under the name, where it holds anything. */
  note?: string;
}

export interface SearchPickerGroup {
  /** The heading above these rows. Empty draws none, for a list with only one section. */
  label: string;
  options: SearchPickerOption[];
}

export interface SearchPickerProps {
  /** The control's own accessible name — also what its suggestion list is called. */
  label: string;
  /** Hover text, for a control whose name alone doesn't say what it states. */
  title?: string;
  /**
   * The value this control currently states, if it holds one at all.
   *
   * Given, the box reads that value's label whenever it is not being searched, and a search that
   * comes to nothing falls back to it. Omitted, the control states nothing of its own and only
   * ever adds — the box sits empty and returns to empty after each pick.
   */
  value?: string;
  placeholder?: string;
  /** The offered rows, in the order they should be offered. Empty groups are not drawn. */
  groups: SearchPickerGroup[];
  /** Overrides how many rows the list draws before asking the user to narrow. */
  maxRows?: number;
  /** What the box is styled as, where it has to match the row it sits in. */
  inputClassName?: string;
  onPick: (value: string) => void;
}

/** A group heading, or one option and its place in the keyboard order. */
type Row =
  | { kind: "heading"; label: string }
  | { kind: "option"; option: SearchPickerOption; index: number };

/**
 * A closed list too long to scroll: the box filters it, and only a row in it can be picked.
 *
 * The other half of the pair with `SuggestCombobox`, and the difference is what the typed text
 * *is*. There it is the value, so typing closes the list rather than filtering it away. Here it is
 * only ever a query — the value has to be one of the offered names, so a search that matches
 * nothing states nothing, and leaving the box discards what was typed rather than keeping it.
 */
export function SearchPicker({
  label,
  title,
  value,
  placeholder,
  groups,
  maxRows = DEFAULT_MAX_ROWS,
  inputClassName = "linkbtn",
  onPick,
}: SearchPickerProps) {
  // `null` is "not searching", which is not the same as searching for nothing: it is what the box
  // falls back to, and for a control holding a value that means showing the value rather than an
  // empty box the user would read as having cleared it.
  const [search, setSearch] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Its own label where the list has one for it, so the box reads the way the row it came from
  // did — an imported value no list offers still shows, as itself.
  const stated = useMemo(() => {
    if (value === undefined) return "";
    for (const group of groups) {
      const option = group.options.find((entry) => entry.value === value);
      if (option) return option.label;
    }
    return value;
  }, [groups, value]);

  const query = (search ?? "").trim().toLowerCase();
  // Matched on both columns the row shows a name in, but never on `note` — that carries a count,
  // and a user typing "2" means a name with a 2 in it, not every type the file holds two of.
  const { rows, shown, hidden } = useMemo(() => {
    const rows: Row[] = [];
    let shown = 0;
    let matched = 0;
    for (const group of groups) {
      const options =
        query === ""
          ? group.options
          : group.options.filter(
              (option) =>
                option.value.toLowerCase().includes(query) ||
                option.label.toLowerCase().includes(query)
            );
      matched += options.length;
      if (options.length === 0 || shown >= maxRows) continue;
      if (group.label !== "") rows.push({ kind: "heading", label: group.label });
      for (const option of options.slice(0, maxRows - shown)) {
        rows.push({ kind: "option", option, index: shown });
        shown += 1;
      }
    }
    return { rows, shown, hidden: matched - shown };
  }, [groups, query, maxRows]);

  const options = rows.filter((row): row is Extract<Row, { kind: "option" }> => row.kind === "option");
  const optionId = (index: number) => `${listId}-option-${index}`;

  // A list opened on a value 80 rows down would otherwise show its top, and arrowing past the
  // eighth row would walk the highlight out of sight.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function openList() {
    setOpen(true);
    // Opens on what the control already states, so the row standing for it is the one the first
    // arrow key moves off — not the top of a list it may be nowhere near.
    setActive(options.find((row) => row.option.value === value)?.index ?? -1);
  }

  /** Leaves the control the way it was found: a query that named nothing names nothing after. */
  function abandon() {
    setSearch(null);
    close();
  }

  function pick(picked: string) {
    onPick(picked);
    // Back to the box's resting state, which for a control that holds a value is that value, and
    // for one that only adds is empty — the row it just used is gone from the list either way.
    setSearch(null);
    close();
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      abandon();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (shown === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = active + step;
      setActive(next < 0 ? shown - 1 : next >= shown ? 0 : next);
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      // Nothing highlighted states nothing — the typed text is not one of the names on offer, and
      // this list is the only place a value may come from.
      const picked = options.find((row) => row.index === active);
      if (picked) pick(picked.option.value);
    }
  }

  return (
    <span
      className="combo searchpick"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) abandon();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        className={inputClassName}
        aria-label={label}
        title={title}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        placeholder={placeholder}
        value={search ?? stated}
        // Selected on arrival, so the first keystroke searches rather than appending a query onto
        // the value the box is showing.
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          setSearch(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="combo-toggle"
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
          onMouseDown={(event) => event.preventDefault()}
        >
          {rows.map((row) =>
            row.kind === "heading" ? (
              <li key={`heading:${row.label}`} role="presentation" className="combo-group">
                {row.label}
              </li>
            ) : (
              <li
                key={row.option.value}
                id={optionId(row.index)}
                role="option"
                aria-selected={value === undefined ? row.index === active : row.option.value === value}
                className={row.index === active ? "combo-option active" : "combo-option"}
                onClick={() => pick(row.option.value)}
              >
                <span className="combo-name">{row.option.label}</span>
                {row.option.note !== undefined && (
                  <span className="combo-count num">{row.option.note}</span>
                )}
              </li>
            )
          )}
          {shown === 0 && (
            <li role="presentation" className="combo-empty">
              {query === ""
                ? "Nothing left to choose from."
                : `Nothing matches “${(search ?? "").trim()}”.`}
            </li>
          )}
          {hidden > 0 && (
            <li role="presentation" className="combo-empty">
              {hidden} more — keep typing to narrow.
            </li>
          )}
        </ul>
      )}
    </span>
  );
}
