import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NormalizedElementSchema } from "@ifc-qa/shared-types";
import { validateBySpecification, validateElements } from "./validate-elements.js";

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

describe("validateBySpecification against a rule set it only partly understands", () => {
  const idsXml = readFileSync(join(FIXTURES_DIR, "partly-understood.ids"), "utf-8");
  const elements = loadElements("partly-understood.json");

  it("refuses the two specifications whose applicability it cannot read, and runs the one it can", () => {
    const outcomes = validateBySpecification(elements, idsXml);

    expect(outcomes.map((outcome) => [outcome.name, outcome.checked])).toEqual([
      ["lokale positie", false],
      ["Bouwlaagindeling en -naamgeving", true],
      ["Classificatiesystematiek", false],
    ]);
  });

  it("names the construct behind each refusal", () => {
    const [byAttributeValue, , byEntityEnumeration] = validateBySpecification(elements, idsXml);

    expect(byAttributeValue.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "attribute" })
    );
    expect(byEntityEnumeration.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "entity/name" })
    );
  });

  // The regression this fixture exists for. Every specification here used to parse, match nothing
  // and report zero violations — a storey with no name, checked against a national standard,
  // came back clean.
  it("still finds the violation in the specification it could run", () => {
    const violations = validateElements(elements, idsXml);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      elementGlobalId: "2b3C4d5E6f7G8h9I0jKlmn",
      ruleId: "Bouwlaagindeling en -naamgeving",
    });
  });
});
