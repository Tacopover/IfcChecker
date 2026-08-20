import { useMemo, useState } from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { buildIdsXml, type RuleDraft } from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { evaluateRuleDraft } from "./evaluateDraft.js";
import { ruleRecap } from "./ruleRecap.js";
import { highlight } from "./IdsXmlPreview.js";

export interface WizardReviewStepProps {
  draft: RuleDraft;
  source: FieldsForResult;
  elements: NormalizedElement[];
  fileName: string;
  onChange: (next: RuleDraft) => void;
  onFinish: (rule: RuleDraft) => void;
  onBack: () => void;
}

/**
 * Step 4 — "Review your rule". The plain-English recap and the live pass/fail numbers both come
 * from the same functions the rest of the app already trusts (`ruleRecap`, `evaluateRuleDraft`),
 * so nothing here can drift from what the dense card or the export preview would show for the same
 * draft. The XML link renders `buildIdsXml`/`highlight` directly rather than embedding the full
 * `IdsXmlPreview` — that component's Download button and blocker list are export-page concerns;
 * "Save rule" here just appends the draft to `rules[]`, complete or not, same as the dense card
 * already allows an incomplete rule to exist and only blocks its *export*.
 */
export function WizardReviewStep({
  draft,
  source,
  elements,
  fileName,
  onChange,
  onFinish,
  onBack,
}: WizardReviewStepProps) {
  const [xmlOpen, setXmlOpen] = useState(false);
  const recap = useMemo(() => ruleRecap(draft, source, elements), [draft, source, elements]);
  const evaluation = useMemo(() => evaluateRuleDraft(draft, elements), [draft, elements]);
  const { matched, passed } = evaluation;
  const failing = matched - passed;
  const passPercent = matched ? (passed / matched) * 100 : 0;
  const failPercent = matched ? (failing / matched) * 100 : 0;
  const xml = useMemo(
    () => (xmlOpen ? buildIdsXml([draft], { title: draft.name || fileName }) : ""),
    [xmlOpen, draft, fileName]
  );

  return (
    <div className="wizcard">
      <h1>Review your rule</h1>

      <div className="recap">
        Every <b>{recap.typeLabel}</b> ({recap.typeCount} in {fileName})
        {recap.narrowing && <>, {recap.narrowing}</>}
        {recap.extraNarrowing > 0 && (
          <> and {recap.extraNarrowing} more filter{recap.extraNarrowing === 1 ? "" : "s"}</>
        )}
        {recap.requirement ? <> {recap.requirement}</> : <> has no requirements yet</>}
        {recap.extraRequirements > 0 && (
          <>
            {" "}
            and {recap.extraRequirements} more requirement{recap.extraRequirements === 1 ? "" : "s"}
          </>
        )}
        .
      </div>

      <label className="namefield" htmlFor="wizard-rule-name">
        Name this rule
      </label>
      <input
        id="wizard-rule-name"
        className="rulename"
        type="text"
        aria-label="Rule name"
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
      />

      <div className="checknow">
        <div className="cn1">Checked against {fileName} just now</div>
        <div className="resultbar">
          <span className="p" style={{ width: `${passPercent}%` }} />
          <span className="f" style={{ width: `${failPercent}%` }} />
        </div>
        <div className="resultnums">
          <span className="pass">{passed} pass</span>
          <span className="fail">{failing} fail</span>
          <span style={{ color: "var(--faint)" }}>{matched} checked</span>
        </div>
      </div>

      <button
        type="button"
        className="xmltoggle"
        aria-expanded={xmlOpen}
        onClick={() => setXmlOpen((wasOpen) => !wasOpen)}
      >
        {xmlOpen ? "▾" : "▸"} View as IDS XML
      </button>
      {xmlOpen && (
        <pre className="xml" aria-label="IDS XML preview">
          {highlight(xml)}
        </pre>
      )}

      <div className="wizfoot">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <span className="spacer" />
        <button type="button" className="btn" onClick={() => onFinish(draft)}>
          Save rule ✓
        </button>
      </div>
    </div>
  );
}
