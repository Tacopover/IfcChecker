import type { RuleDraft } from "@ifc-qa/ids-validator";
import { MetadataPanel, type MetadataField } from "./MetadataPanel.js";
import { ruleProblems } from "./completeness.js";

type SpecificationField = "identifier" | "description" | "instructions" | "requirementsDescription";

const FIELDS: ReadonlyArray<MetadataField<SpecificationField>> = [
  {
    id: "identifier",
    label: "Identifier",
    hint: "A machine-readable id. IDS does not require it to be unique.",
  },
  { id: "description", label: "Description", multiline: true },
  {
    id: "instructions",
    label: "Instructions",
    hint: "For whoever authors the IFC; a checker may show this to them.",
    multiline: true,
  },
  {
    id: "requirementsDescription",
    label: "Requirements description",
    hint: "Prose about the requirements rather than about the rule.",
    multiline: true,
  },
];

export interface SpecificationInfoPanelProps {
  rule: RuleDraft;
  open: boolean;
  onToggle: () => void;
  onChange: (next: RuleDraft) => void;
}

/**
 * What this one specification says about itself, beside the rule it states.
 *
 * The same panel as the document's, over the four attributes `ids.xsd` puts on a `<specification>`
 * and its `<requirements>`. All four survived a round trip before this and none could be edited.
 * The schema versions and the Prohibited toggle live on the rule card's always-visible header
 * instead, since both are decisions worth seeing without opening this panel.
 */
export function SpecificationInfoPanel({
  rule,
  open,
  onToggle,
  onChange,
}: SpecificationInfoPanelProps) {
  return (
    <MetadataPanel
      label="About this specification"
      fields={FIELDS}
      values={rule}
      // `ids.xsd` makes ifcVersion required, so naming none is a document it does not describe.
      // Read from `ruleProblems` so the panel and the export blocker say the same thing.
      problems={[ruleProblems(rule).metadata].filter((problem) => problem !== null)}
      open={open}
      onToggle={onToggle}
      onChange={(id, value) => onChange({ ...rule, [id]: value })}
    />
  );
}
