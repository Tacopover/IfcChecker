import type { IdsDocumentInfo } from "@ifc-qa/ids-validator";
import { infoProblems } from "@ifc-qa/ids-validator";

/**
 * The eight children of `<info>`, in the order `ids.xsd` fixes them.
 *
 * `multiline` marks the two that hold prose rather than a name. `hint` is shown under the box for
 * the two the schema constrains beyond `xs:string` — telling the user afterwards that their address
 * was rejected is worse than saying up front what shape it has to be.
 */
const FIELDS: Array<{
  id: keyof IdsDocumentInfo;
  label: string;
  hint?: string;
  multiline?: boolean;
}> = [
  { id: "title", label: "Title", hint: "Required on every IDS document." },
  { id: "copyright", label: "Copyright" },
  { id: "version", label: "Version" },
  { id: "description", label: "Description", multiline: true },
  { id: "author", label: "Author", hint: "An email address, e.g. you@example.com." },
  { id: "date", label: "Date", hint: "YYYY-MM-DD." },
  { id: "purpose", label: "Purpose", multiline: true },
  { id: "milestone", label: "Milestone" },
];

export interface DocumentInfoPanelProps {
  info: IdsDocumentInfo;
  /** What the title falls back to while the document states none — the model's own file name. */
  titlePlaceholder: string;
  open: boolean;
  onToggle: () => void;
  onChange: (next: IdsDocumentInfo) => void;
}

/**
 * Who wrote this document and what it is for — the one part of an IDS file that is not a rule.
 *
 * A collapsible panel rather than a route, and collapsed by default: you fill it in once, at the
 * start or the end, and interleaving twelve fields with rule editing would clutter the thing the
 * page exists to keep clean. It carried through a round trip before this and could not be edited;
 * a document authored here stated a title and nothing else.
 *
 * An empty box writes no element, which is what `minOccurs="0"` means — except on the title, which
 * the schema requires. `infoProblems` is what stops a half-typed address or a European-order date
 * from becoming a document no conforming checker reads.
 */
export function DocumentInfoPanel({
  info,
  titlePlaceholder,
  open,
  onToggle,
  onChange,
}: DocumentInfoPanelProps) {
  const problems = infoProblems({ ...info, title: info.title ?? titlePlaceholder });
  const stated = FIELDS.filter((field) => (info[field.id] ?? "") !== "").length;

  return (
    <section className={open ? "docinfo open" : "docinfo"}>
      <button
        type="button"
        className="disclose-row"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="disclose">▶</span>
        <span className="micro">About this document</span>
        <span className="badge">{stated} of 8 stated</span>
        {problems.length > 0 && <span className="badge kept">{problems.length} to fix</span>}
      </button>

      {open && (
        <div className="docinfo-body">
          {FIELDS.map((field) => (
            <label key={field.id} className="docinfo-field">
              <span className="micro">{field.label}</span>
              {field.multiline ? (
                <textarea
                  aria-label={field.label}
                  rows={3}
                  value={(info[field.id] as string | null) ?? ""}
                  onChange={(event) => onChange({ ...info, [field.id]: event.target.value })}
                />
              ) : (
                <input
                  type="text"
                  aria-label={field.label}
                  placeholder={field.id === "title" ? titlePlaceholder : ""}
                  value={(info[field.id] as string | null) ?? ""}
                  onChange={(event) => onChange({ ...info, [field.id]: event.target.value })}
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
