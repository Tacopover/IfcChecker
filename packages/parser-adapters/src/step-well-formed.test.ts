import { describe, expect, it } from "vitest";
import { assertWellFormedStepFile } from "./step-well-formed.js";

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe("assertWellFormedStepFile", () => {
  it("accepts a file ending with the ISO-10303-21 terminator", () => {
    expect(() =>
      assertWellFormedStepFile(encode("ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"))
    ).not.toThrow();
  });

  it("rejects a file missing the terminator", () => {
    expect(() => assertWellFormedStepFile(encode("ISO-10303-21;\nDATA;\n#1=IFCWALL();"))).toThrow(
      /malformed IFC STEP file/
    );
  });

  it("accepts a well-formed file padded with trailing NUL bytes from a chunked writer", () => {
    const padded = new Uint8Array([
      ...encode("ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"),
      0,
      0,
      0,
      0,
    ]);
    expect(() => assertWellFormedStepFile(padded)).not.toThrow();
  });

  it("still rejects a truncated file that happens to be padded with NUL bytes", () => {
    const paddedButTruncated = new Uint8Array([...encode("ISO-10303-21;\nDATA;\n#1=IFCWALL();"), 0, 0, 0]);
    expect(() => assertWellFormedStepFile(paddedButTruncated)).toThrow(/malformed IFC STEP file/);
  });

  it("only decodes the tail of a large buffer, not the whole file", () => {
    const huge = new Uint8Array(2_000_000).fill(0x41); // 'A' repeated, no valid header at all
    const withTerminator = new Uint8Array([...huge, ...encode("\nEND-ISO-10303-21;\n\0\0\0")]);
    expect(() => assertWellFormedStepFile(withTerminator)).not.toThrow();
  });
});
