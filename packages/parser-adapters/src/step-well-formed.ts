/**
 * Every conformant ISO-10303-21 (STEP) file ends with this exact token.
 * Checking for it directly is simpler and more robust than counting
 * ENDSEC occurrences (a file can legitimately contain multiple ENDSECs —
 * one per HEADER/DATA section — so presence alone doesn't imply
 * completeness). Both adapters call this before invoking their engine so
 * a truncated file fails identically and deterministically regardless of
 * how leniently either underlying engine would otherwise have parsed it.
 */
const TERMINATOR = "END-ISO-10303-21;";

// Only the tail of the file can possibly contain the terminator. Decoding
// the whole buffer just to inspect its last ~20 bytes is wasteful for
// 500MB+ files and, at large enough sizes, risks exceeding the JS engine's
// max-string-length limit. 256 bytes comfortably covers the terminator
// plus any trailing padding/whitespace real exporters emit.
const TAIL_BYTES = 256;

export function assertWellFormedStepFile(raw: Uint8Array): void {
  const tail = raw.subarray(Math.max(0, raw.length - TAIL_BYTES));
  const tailText = new TextDecoder("utf-8").decode(tail);
  // Chunked/buffered writers on some large-file exporters pad the final
  // write block with trailing NUL (or other control) bytes after the
  // terminator. TextDecoder happily decodes those as literal characters
  // that plain trimEnd() (JS-whitespace only) won't strip, so a genuinely
  // well-formed file would otherwise fail this check.
  const trimmed = tailText.replace(/[\s\x00-\x1f]+$/, "");
  if (!trimmed.endsWith(TERMINATOR)) {
    throw new Error("malformed IFC STEP file: missing END-ISO-10303-21 terminator");
  }
}
