import { Fragment } from "react";

export interface WizardStepDescriptor {
  id: string;
  label: string;
}

export interface WizardStepIndicatorProps {
  steps: readonly WizardStepDescriptor[];
  currentIndex: number;
}

/**
 * The done/active/upcoming dot-and-line row atop every wizard step. Purely presentational — the
 * wizard container is what decides `currentIndex`, this only draws it.
 */
export function WizardStepIndicator({ steps, currentIndex }: WizardStepIndicatorProps) {
  return (
    <div className="steps">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <Fragment key={step.id}>
            <div className={`step${done ? " done" : active ? " active" : ""}`}>
              <span className="dot">{done ? "✓" : index + 1}</span>
              <span className="label">{step.label}</span>
            </div>
            {index < steps.length - 1 && <span className={`steplink${done ? " done" : ""}`} />}
          </Fragment>
        );
      })}
    </div>
  );
}
