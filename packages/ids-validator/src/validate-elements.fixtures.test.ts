import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NormalizedElementSchema } from "@ifc-qa/shared-types";
import { validateElements } from "./validate-elements.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "ids");

function loadElements(fileName: string) {
  const raw = readFileSync(join(FIXTURES_DIR, fileName), "utf-8");
  return NormalizedElementSchema.array().parse(JSON.parse(raw));
}

describe("validateElements against the naming-and-fire-rating fixture", () => {
  const idsXml = readFileSync(join(FIXTURES_DIR, "naming-and-fire-rating.ids"), "utf-8");

  it("produces no violations for the known-good elements", () => {
    const elements = loadElements("naming-and-fire-rating.pass.json");
    expect(validateElements(elements, idsXml)).toEqual([]);
  });

  it("produces the expected violations for the known-bad elements", () => {
    const elements = loadElements("naming-and-fire-rating.fail.json");
    const violations = validateElements(elements, idsXml);

    expect(violations).toHaveLength(2);
    expect(violations.every((v) => v.ruleId === "Wall naming and fire rating")).toBe(true);
    expect(violations.every((v) => v.severity === "error")).toBe(true);
    expect(
      violations.find((v) => v.elementGlobalId === "2b3C4d5E6f7G8h9I0jKlmn")?.message
    ).toContain("Name");
    expect(
      violations.find((v) => v.elementGlobalId === "3c4D5e6F7g8H9i0J1kLmno")?.message
    ).toContain("FireRating");
  });
});
