import { describe, expect, it } from "vitest";
import { importIdsText } from "./importIds";

const VALID = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <info><title>Client rules</title></info>
  <specifications>
    <specification name="Walls are named" ifcVersion="IFC4">
      <applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
      <requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>
    </specification>
  </specifications>
</ids>`;

describe("importIdsText", () => {
  it("reads a document into rules and keeps its title", () => {
    const outcome = importIdsText("client.ids", VALID);

    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.result.title).toBe("Client rules");
    expect(outcome.result.rules.map((rule) => rule.name)).toEqual(["Walls are named"]);
  });

  it("re-keys ids so an import cannot collide with rules already on the page", () => {
    const first = importIdsText("a.ids", VALID);
    const second = importIdsText("b.ids", VALID);

    if (!first.ok || !second.ok) throw new Error("expected both imports to succeed");
    expect(first.result.rules[0].id).not.toBe(second.result.rules[0].id);
    expect(first.result.rules[0].conditions[0].id).not.toBe(
      second.result.rules[0].conditions[0].id
    );
  });

  it("names the file when it is not XML at all", () => {
    const outcome = importIdsText("notes.txt", "just some text <<<");

    expect(outcome).toMatchObject({ ok: false });
    if (outcome.ok) return;
    expect(outcome.message).toContain("notes.txt");
  });

  it("refuses a document with no specifications rather than silently emptying the builder", () => {
    const outcome = importIdsText("other.xml", `<?xml version="1.0"?><project><wall /></project>`);

    expect(outcome).toMatchObject({
      ok: false,
      message: "other.xml contains no IDS specifications.",
    });
  });
});
