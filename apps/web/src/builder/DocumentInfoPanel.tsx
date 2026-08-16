import type { IdsDocumentInfo } from "@ifc-qa/ids-validator";
import { infoProblems } from "@ifc-qa/ids-validator";
import { MetadataPanel, type MetadataField } from "./MetadataPanel.js";

type InfoField = "title" | "copyright" | "version" | "description" | "author" | "date" | "purpose" | "milestone";

/**
 * The eight children of `<info>`, in the order `ids.xsd` fixes them.
 *
 * `hint` is on the three the schema constrains beyond `xs:string` — telling the user afterwards
 * that their address was rejected is worse than saying up front what shape it has to be.
 */
const FIELDS: ReadonlyArray<MetadataField<InfoField>> = [
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
 * It carried through a round trip before this and could not be edited: a document authored here
 * stated a title and nothing else, and one imported could not have its author corrected.
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
  return (
    <MetadataPanel
      label="About this document"
      fields={FIELDS}
      values={info}
      placeholders={{ title: titlePlaceholder }}
      problems={infoProblems({ ...info, title: info.title ?? titlePlaceholder })}
      open={open}
      onToggle={onToggle}
      onChange={(id, value) => onChange({ ...info, [id]: value })}
    />
  );
}
