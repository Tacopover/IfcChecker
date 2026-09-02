import { useMemo, useState } from "react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { RuleDraft } from "@ifc-qa/ids-validator";
import type { ModelIntrospection } from "./introspect.js";
import { nextDraftId } from "./draftIds.js";
import { WizardStepIndicator, type WizardStepDescriptor } from "./WizardStepIndicator.js";
import { WizardAppliesToStep } from "./WizardAppliesToStep.js";
import { WizardNarrowStep } from "./WizardNarrowStep.js";
import { WizardRequirementsStep } from "./WizardRequirementsStep.js";
import { WizardReviewStep } from "./WizardReviewStep.js";

export interface RuleWizardProps {
  introspection: ModelIntrospection;
  elements: NormalizedElement[];
  fileName: string;
  onFinish: (rule: RuleDraft) => void;
  onCancel: () => void;
}

const STEPS: WizardStepDescriptor[] = [
  { id: "applies", label: "Applies to" },
  { id: "narrow", label: "Narrow it down" },
  { id: "requirements", label: "Requirements" },
  { id: "review", label: "Review" },
];

function emptyDraft(): RuleDraft {
  return {
    id: nextDraftId("r"),
    name: "New rule",
    entityTypes: [],
    conditions: [],
    ifcVersion: "IFC2X3 IFC4",
  };
}

/**
 * The 4-step creation wizard, replacing the old blank-rule "+ New rule" flow. Owns the
 * in-progress `RuleDraft` and the step index; every step calls back up with the next draft rather
 * than mutating it, the same `onChange` pattern `RuleCard` already uses. Nothing here reaches
 * `rules[]` until `onFinish` fires — Cancel at any step just unmounts this component, and the
 * in-progress draft (never added anywhere) goes with it.
 *
 * `source` — the field/value data each step reads from the loaded file — is recomputed from
 * `introspection.fieldsFor(draft.entityTypes)` on every applies-to change, exactly the way
 * `RuleCard` derives it from `rule.entityTypes`. It is what tells the Requirements step whether to
 * fall back to manual entry (`source.total === 0`).
 */
export function RuleWizard({ introspection, elements, fileName, onFinish, onCancel }: RuleWizardProps) {
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [stepIndex, setStepIndex] = useState(0);
  // With no file loaded (or none of its types making it into the tree), the file's own picklist
  // is empty anyway — start the schema search open rather than showing that instead of a hint.
  const [showAllTypes, setShowAllTypes] = useState(() => introspection.entityTypes.length === 0);

  const source = useMemo(
    () => introspection.fieldsFor(draft.entityTypes),
    [introspection, draft.entityTypes]
  );

  function goNext() {
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  const step = STEPS[stepIndex].id;

  return (
    <div className="wizard">
      <WizardStepIndicator steps={STEPS} currentIndex={stepIndex} />

      {step === "applies" && (
        <WizardAppliesToStep
          introspection={introspection}
          fileName={fileName}
          entityTypes={draft.entityTypes}
          showAllTypes={showAllTypes}
          onChange={(entityTypes, nextShowAllTypes) => {
            setDraft({ ...draft, entityTypes });
            setShowAllTypes(nextShowAllTypes);
          }}
          onNext={goNext}
          onCancel={onCancel}
        />
      )}
      {step === "narrow" && (
        <WizardNarrowStep
          draft={draft}
          source={source}
          elements={elements}
          onChange={setDraft}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === "requirements" && (
        <WizardRequirementsStep
          draft={draft}
          source={source}
          elements={elements}
          onChange={setDraft}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === "review" && (
        <WizardReviewStep
          draft={draft}
          source={source}
          elements={elements}
          fileName={fileName}
          onChange={setDraft}
          onFinish={onFinish}
          onBack={goBack}
        />
      )}
    </div>
  );
}
