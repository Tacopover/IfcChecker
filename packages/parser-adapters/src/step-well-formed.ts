/**
 * Every conformant ISO-10303-21 (STEP) file ends with this exact token.
 * Checking for it directly is simpler and more robust than counting
 * ENDSEC occurrences (a file can legitimately contain multiple ENDSECs —
 * one per HEADER/DATA section — so presence alone doesn't imply
 * completeness). Both adapters call this before invoking their engine so
 * a truncated file fails identically and deterministically regardless of
 * how leniently either underlying engine would otherwise have parsed it.
 */
export function assertWellFormedStepFile(rawText: string): void {
  if (!rawText.trimEnd().endsWith("END-ISO-10303-21;")) {
    throw new Error("malformed IFC STEP file: missing END-ISO-10303-21 terminator");
  }
}
