import type { ReactNode } from "react";
import type { Bounds } from "./bounds.js";
import { SECTION_AXES, type SectionAxis, type SectionBox } from "./sectionBox.js";
import {
  CloseIcon,
  ResetViewIcon,
  SectionBoxIcon,
  ZoomToFitIcon,
  ZoomToSelectionIcon,
} from "./viewerIcons";

// Everything that used to sit in strips above and below the canvas, moved onto
// it. Purely presentational: it owns no viewer state, so what a control does
// still lives in ViewerPage next to the state it changes.
//
// The two halves are deliberately different. The left cluster is what is always
// available — framing and clipping. The right stack is what is currently *true*
// of the view, and each entry is its own undo: nothing is shown there unless
// there is something to leave.

interface ToolProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}

function Tool({ label, onClick, children, pressed, disabled }: ToolProps) {
  return (
    <button
      type="button"
      className="viewer-tool"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      data-tip={label}
    >
      {children}
    </button>
  );
}

interface ChipProps {
  kind: "focus" | "isolate" | "highlight" | "hidden";
  label: string;
  count: number;
  clearLabel: string;
  onClear: () => void;
}

function Chip({ kind, label, count, clearLabel, onClear }: ChipProps) {
  return (
    <div className="viewer-chip" data-kind={kind}>
      <b>{label}</b>
      <span className="viewer-chip-count">{count}</span>
      <button type="button" className="viewer-chip-clear" onClick={onClear} aria-label={clearLabel}>
        <CloseIcon />
      </button>
    </div>
  );
}

export interface ViewerOverlayProps {
  onZoomToFit: () => void;
  onZoomToSelection: () => void;
  /** False when nothing is picked and nothing is isolated or highlighted — there is no target. */
  canZoomToSelection: boolean;
  onResetView: () => void;

  section: SectionBox | null;
  /** Full extent of what is loaded, which is the range each clip face can travel. */
  sectionBounds: Bounds;
  onToggleSection: (enabled: boolean) => void;
  onMoveSectionFace: (axis: SectionAxis, side: "min" | "max", value: number) => void;
  onResetSection: () => void;

  /** Null when nothing is isolated / highlighted; a count when something is. */
  isolatedCount: number | null;
  highlightedCount: number | null;
  hiddenCount: number;
  /** Set when what is on screen came from a check result rather than the tree. */
  focusLabel: string | null;
  focusCount: number;

  onClearIsolation: () => void;
  onClearHighlight: () => void;
  onShowEverything: () => void;
  onClearFocus: () => void;

  messages: readonly { kind: "error" | "note"; text: string }[];
}

export function ViewerOverlay({
  onZoomToFit,
  onZoomToSelection,
  canZoomToSelection,
  onResetView,
  section,
  sectionBounds,
  onToggleSection,
  onMoveSectionFace,
  onResetSection,
  isolatedCount,
  highlightedCount,
  hiddenCount,
  focusLabel,
  focusCount,
  onClearIsolation,
  onClearHighlight,
  onShowEverything,
  onClearFocus,
  messages,
}: ViewerOverlayProps) {
  const sectionOpen = section?.enabled ?? false;

  return (
    <>
      <div className="viewer-ov viewer-ov-tl">
        <div className="viewer-glass viewer-tools">
          <Tool label="Zoom to fit" onClick={onZoomToFit}>
            <ZoomToFitIcon />
          </Tool>
          <Tool label="Zoom to selection" onClick={onZoomToSelection} disabled={!canZoomToSelection}>
            <ZoomToSelectionIcon />
          </Tool>
          <Tool label="Reset view" onClick={onResetView}>
            <ResetViewIcon />
          </Tool>
          <span className="viewer-tool-sep" />
          <Tool
            label="Section box"
            onClick={() => onToggleSection(!sectionOpen)}
            pressed={sectionOpen}
            disabled={!section}
          >
            <SectionBoxIcon />
          </Tool>
        </div>
      </div>

      {section && sectionOpen && (
        <div className="viewer-glass viewer-section-panel">
          <h3>Section box</h3>
          {SECTION_AXES.map((axis: SectionAxis) => {
            const low = sectionBounds.min[axis];
            const high = sectionBounds.max[axis];
            const step = (high - low) / 200 || 0.01;
            return (
              <div key={axis} className="viewer-section-axis">
                <span>{axis.toUpperCase()}</span>
                <div className="viewer-section-pair">
                  {(["min", "max"] as const).map((side) => (
                    <input
                      key={side}
                      type="range"
                      min={low}
                      max={high}
                      step={step}
                      value={section.bounds[side][axis]}
                      aria-label={`${axis.toUpperCase()} ${side === "min" ? "minimum" : "maximum"}`}
                      onChange={(event) => onMoveSectionFace(axis, side, Number(event.target.value))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <footer>
            <button type="button" className="viewer-linkish" onClick={onResetSection}>
              Reset to model
            </button>
            <button type="button" className="viewer-linkish" onClick={() => onToggleSection(false)}>
              Turn off
            </button>
          </footer>
        </div>
      )}

      <div className="viewer-ov viewer-ov-tr">
        {/* A focus names the rule it came from, which is more use than "isolated".
            Whether it is isolating or highlighting is already visible on screen. */}
        {focusLabel !== null ? (
          <Chip
            kind="focus"
            label={focusLabel}
            count={focusCount}
            clearLabel="Clear result focus"
            onClear={onClearFocus}
          />
        ) : (
          <>
            {isolatedCount !== null && (
              <Chip
                kind="isolate"
                label="Isolated"
                count={isolatedCount}
                clearLabel="Un-isolate"
                onClear={onClearIsolation}
              />
            )}
            {highlightedCount !== null && (
              <Chip
                kind="highlight"
                label="Highlighted"
                count={highlightedCount}
                clearLabel="Clear highlight"
                onClear={onClearHighlight}
              />
            )}
          </>
        )}
        {hiddenCount > 0 && (
          <Chip
            kind="hidden"
            label="Hidden"
            count={hiddenCount}
            clearLabel="Show everything"
            onClear={onShowEverything}
          />
        )}
      </div>

      {messages.length > 0 && (
        <div className="viewer-ov viewer-ov-bc">
          {messages.map((message) => (
            <p
              key={message.text}
              className="viewer-glass viewer-toast"
              data-kind={message.kind}
              role={message.kind === "error" ? "alert" : undefined}
            >
              {message.text}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
