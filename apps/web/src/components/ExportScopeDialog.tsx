import { useEffect, useRef } from "react";

export interface ExportScopeDialogProps {
  open: boolean;
  filteredCount: number;
  totalCount: number;
  onChoose: (scope: "filtered" | "all") => void;
  onCancel: () => void;
}

/**
 * Asks which set to export when the results table has an active filter — a reviewer who
 * narrowed the table down almost never means to still export every row underneath it, but
 * silently exporting only the filtered rows would just as often be the wrong guess.
 */
export function ExportScopeDialog({
  open,
  filteredCount,
  totalCount,
  onChoose,
  onCancel,
}: ExportScopeDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="export-scope-dialog"
      aria-labelledby="export-scope-title"
      onCancel={onCancel}
      onClick={(event) => {
        // A click that lands on the <dialog> element itself, rather than anything inside it,
        // is a click on the backdrop area — the usual way to dismiss a modal.
        if (event.target === ref.current) onCancel();
      }}
    >
      <h3 id="export-scope-title">Export filtered or all results?</h3>
      <p>
        The results table has an active filter. Export the {filteredCount}{" "}
        {filteredCount === 1 ? "issue" : "issues"} it currently shows, or all {totalCount}{" "}
        {totalCount === 1 ? "issue" : "issues"}.
      </p>
      <div className="dialog-actions">
        <button type="button" onClick={() => onChoose("filtered")}>
          Export filtered ({filteredCount})
        </button>
        <button type="button" className="secondary" onClick={() => onChoose("all")}>
          Export all ({totalCount})
        </button>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
