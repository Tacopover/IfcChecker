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

  it("refuses the specification it cannot judge, and runs the ones it can", () => {
    const outcomes = validateBySpecification(elements, idsXml);

    expect(outcomes.map((outcome) => [outcome.name, outcome.checked])).toEqual([
      ["lokale positie", false],
      ["Bouwlaagindeling en -naamgeving", true],
      ["Classificatiesystematiek", true],
      ["Brandwerendheid", true],
    ]);
  });

  it("names the construct behind the refusal", () => {
    const [byApplicability] = validateBySpecification(elements, idsXml);

    expect(byApplicability.unsupported).toContainEqual(
      expect.objectContaining({ section: "applicability", construct: "attribute" })
    );
  });

  // "Brandwerendheid" names its property `Fire.*` rather than `FireRating`, and was refused on the
  // requirements side until that was readable. It is judged on its merits now: the one wall the
  // fixture holds carries no property set at all, so it fails. The refusal invariant this used to
  // stand for is pinned in `parse-ids.test.ts`, against an entity naming no readable class.
  it("checks a property named by pattern, now that it can read one", () => {
    const [, , , byPattern] = validateBySpecification(elements, idsXml);

    expect(byPattern.unsupported).toEqual([]);
    expect(byPattern.applicableCount).toBe(1);
    expect(byPattern.failedCount).toBe(1);
  });

  // The regression this fixture exists for. Every specification here used to parse, match nothing
  // and report zero violations — a storey with no name, checked against a national standard,
  // came back clean.
  it("still finds the violation in the specification it could run", () => {
    const violations = validateElements(elements, idsXml);

    expect(violations).toContainEqual(
      expect.objectContaining({
        elementGlobalId: "2b3C4d5E6f7G8h9I0jKlmn",
        ruleId: "Bouwlaagindeling en -naamgeving",
      })
    );
  });

  // The classification specification was refused until the facet landed, and these fixture
  // elements carry no classification at all — so it is now judged on its merits and fails both
  // the elements it selects. A refusal turning into a real verdict is the point of the facet
  // work, not a regression.
  it("fails the elements the classification specification selects, now that it can run it", () => {
    const violations = validateElements(elements, idsXml).filter(
      (violation) => violation.ruleId === "Classificatiesystematiek"
    );

    expect(violations.map((violation) => violation.elementGlobalId).sort()).toEqual([
      "1a2B3c4D5e6F7g8H9i0Jkl",
      "3c4D5e6F7g8H9i0J1kLmno",
    ]);
  });
});
