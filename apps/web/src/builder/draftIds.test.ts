import { describe, expect, it } from "vitest";
import { nextDraftId } from "./draftIds.js";

describe("nextDraftId", () => {
  it("never repeats an id, whatever prefix it is asked for", () => {
    const ids = [nextDraftId("r"), nextDraftId("c"), nextDraftId("c"), nextDraftId("r")];

    expect(new Set(ids).size).toBe(4);
    expect(ids[0]).toMatch(/^r\d+$/);
    expect(ids[1]).toMatch(/^c\d+$/);
  });
});
