import type { RuleDraft } from "@ifc-qa/ids-validator";
import { DEFAULT_IFC_VERSION } from "@ifc-qa/ids-validator";
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
    hint: "For whoever authors the IFC — a checker may show this to them.",
    multiline: true,
  },
  {
    id: "requirementsDescription",
    label: "Requirements description",
    hint: "Prose about the requirements rather than about the rule.",
    multiline: true,
  },
];

/**
 * The three schema versions `ids.xsd` lists, and the only three a document may name.
 *
 * A checkbox each rather than a text box: `ifcVersion` is a space-separated list drawn from a
 * closed enumeration, so a box would let a user write a value that makes the document invalid.
 * 344 of the 464 hand-authored corpus specifications say `"IFC2X3 IFC4"`.
 */
const IFC_VERSIONS = ["IFC2X3", "IFC4", "IFC4X3_ADD2"];

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
 * and its `<requirements>`, plus the schema versions. All five survived a round trip before this
 * and none could be edited.
 */
export function SpecificationInfoPanel({
  rule,
  open,
  onToggle,
  onChange,
}: SpecificationInfoPanelProps) {
  // `??`, not `||`: a rule that has never stated one gets the exporter's default, and one the user
  // cleared states none — which `ruleProblems` reports rather than the panel silently re-checking.
  const stated = (rule.ifcVersion ?? DEFAULT_IFC_VERSION).split(/\s+/).filter(Boolean);

  function toggleVersion(version: string) {
    const next = stated.includes(version)
      ? stated.filter((entry) => entry !== version)
      : [...IFC_VERSIONS.filter((entry) => stated.includes(entry) || entry === version)];
    onChange({ ...rule, ifcVersion: next.join(" ") });
  }

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
    >
      <fieldset className="docinfo-field versions">
        <legend className="micro">Schema versions</legend>
        {IFC_VERSIONS.map((version) => (
          <label key={version}>
            <input
              type="checkbox"
              checked={stated.includes(version)}
              onChange={() => toggleVersion(version)}
            />
            {version}
          </label>
        ))}
      </fieldset>
    </MetadataPanel>
  );
}
