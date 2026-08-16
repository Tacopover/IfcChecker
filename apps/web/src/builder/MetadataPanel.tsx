import type { ReactNode } from "react";

export interface MetadataField<K extends string> {
  id: K;
  label: string;
  /** Shown under the box, for a field the schema constrains beyond `xs:string`. */
  hint?: string;
  /** Prose rather than a name, so a textarea rather than an input. */
  multiline?: boolean;
}

export interface MetadataPanelProps<K extends string> {
  /** What the disclosure calls this block — "About this document", "About this specification". */
  label: string;
  fields: ReadonlyArray<MetadataField<K>>;
  values: Partial<Record<K, string | null>>;
  /** Shown in the box while the field is empty, for the one field something else stands in for. */
  placeholders?: Partial<Record<K, string>>;
  /** Why the block would not export, one line each. Empty when it would. */
  problems?: string[];
  open: boolean;
  onToggle: () => void;
  onChange: (id: K, value: string) => void;
  /** Anything that is not a text box — the schema-version picker, for one. */
  children?: ReactNode;
}

/**
 * A collapsible block of the metadata that surrounds the rules.
 *
 * Collapsed by default and one component for both blocks, because they are the same control over
 * different field sets: you fill either in once, at the start or the end, and interleaving them
 * with rule editing would clutter the thing the page exists to keep clean.
 *
 * An empty box writes no attribute or element, which is what `minOccurs="0"` and `use="optional"`
 * mean. The two exceptions the schema makes — a `<title>` and an `ifcVersion` — are stated by their
 * own callers rather than by a flag here.
 */
export function MetadataPanel<K extends string>({
  label,
  fields,
  values,
  placeholders,
  problems = [],
  open,
  onToggle,
  onChange,
  children,
}: MetadataPanelProps<K>) {
  const stated = fields.filter((field) => (values[field.id] ?? "") !== "").length;

  return (
    <section className={open ? "docinfo open" : "docinfo"}>
      <button type="button" className="disclose-row" aria-expanded={open} onClick={onToggle}>
        <span className="disclose">▶</span>
        <span className="micro">{label}</span>
        <span className="badge">
          {stated} of {fields.length} stated
        </span>
        {problems.length > 0 && <span className="badge kept">{problems.length} to fix</span>}
      </button>

      {open && (
        <div className="docinfo-body">
          {children}

          {fields.map((field) => (
            <label key={field.id} className="docinfo-field">
              <span className="micro">{field.label}</span>
              {field.multiline ? (
                <textarea
                  aria-label={field.label}
                  rows={3}
                  value={values[field.id] ?? ""}
                  onChange={(event) => onChange(field.id, event.target.value)}
                />
              ) : (
                <input
                  type="text"
                  aria-label={field.label}
                  placeholder={placeholders?.[field.id] ?? ""}
                  value={values[field.id] ?? ""}
                  onChange={(event) => onChange(field.id, event.target.value)}
                />
              )}
              {field.hint && <span className="docinfo-hint">{field.hint}</span>}
            </label>
          ))}

          {problems.length > 0 && (
            <ul className="rule-error">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
