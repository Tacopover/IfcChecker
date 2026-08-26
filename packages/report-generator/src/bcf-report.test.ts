import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { generateBcfReport } from "./bcf-report.js";
import { bcfXsdViolations } from "./bcf-xsd-conformance.js";
import type { RunReportData } from "./types.js";

// 22-char compressed IFC GUIDs (base64-alphabet), as real parsers emit — unlike the "g1"/"g2"
// placeholders used elsewhere in this package's fixtures, these must pass the IfcGuid schema
// restriction (xs:length 22, charset [0-9A-Za-z_$]) for the XSD validation below to mean anything.
const WALL_1 = "1xS3BCk291UvhgP2a6eflA";
const WALL_2 = "1xS3BCk291UvhgP2a6eflB";
const DOOR_1 = "1xS3BCk291UvhgP2a6eflC";

const fixture: RunReportData = {
  runId: "11111111-1111-1111-1111-111111111111",
  ruleSetName: "Company Naming Standard v3",
  engine: "web-ifc",
  generatedAt: "2026-07-17T00:00:00.000Z",
  results: [
    {
      id: "r1",
      fileJobId: "fj1",
      elementGlobalId: WALL_1,
      elementType: "IFCWALL",
      elementName: "Wall-1",
      elementTag: "W-001",
      ruleId: "naming-prefix",
      severity: "error",
      message: "Name must start with 'W-'",
      fileName: "model-b.ifc",
    },
    {
      id: "r2",
      fileJobId: "fj1",
      elementGlobalId: DOOR_1,
      elementType: "IFCDOOR",
      elementName: "Door-1",
      elementTag: null,
      ruleId: "naming-prefix",
      severity: "warning",
      message: "Door name missing suffix",
      fileName: "model-a.ifc",
    },
    {
      id: "r3",
      fileJobId: "fj2",
      elementGlobalId: WALL_2,
      elementType: "IFCWALL",
      elementName: "Wall-2",
      elementTag: "W-002",
      ruleId: "fire-rating-required",
      severity: "error",
      message: "Missing FireRating property",
      fileName: "model-a.ifc",
    },
  ],
};

function decode(zip: ReturnType<typeof unzipSync>, path: string): string {
  const bytes = zip[path];
  if (!bytes) throw new Error(`${path} missing from archive`);
  return strFromU8(bytes);
}

describe("generateBcfReport", () => {
  it("writes bcf.version and one topic folder per (rule, severity)", () => {
    const zip = unzipSync(generateBcfReport(fixture));
    const paths = Object.keys(zip).sort();

    // naming-prefix/error, naming-prefix/warning, fire-rating-required/error: 3 topics, 2 files each.
    expect(paths.filter((path) => path.endsWith("markup.bcf"))).toHaveLength(3);
    expect(paths.filter((path) => path.endsWith("viewpoint.bcfv"))).toHaveLength(3);
    expect(paths).toContain("bcf.version");
  });

  it("groups violations by rule and severity, listing every failing element in the viewpoint", () => {
    const zip = unzipSync(generateBcfReport(fixture));
    const namingErrorFolder = Object.keys(zip).find(
      (path) => path.endsWith("markup.bcf") && decode(zip, path).includes("naming-prefix") && decode(zip, path).includes("TopicType=\"Error\"")
    );
    if (!namingErrorFolder) throw new Error("no markup.bcf for naming-prefix/error");
    const folder = namingErrorFolder.split("/")[0];

    const markup = decode(zip, `${folder}/markup.bcf`);
    expect(markup).toContain("<Title>naming-prefix</Title>");
    expect(markup).toContain('TopicStatus="Open"');
    expect(markup).toContain("model-b.ifc");
    expect(markup).toContain(WALL_1); // the one comment for this topic names its element

    const viewpoint = decode(zip, `${folder}/viewpoint.bcfv`);
    expect(viewpoint).toContain(`IfcGuid="${WALL_1}"`);
    expect(viewpoint).not.toContain("Camera"); // no geometry data exists to place one
  });

  it("satisfies the real BCF-XML 2.1 schemas for every emitted file", async () => {
    const zip = unzipSync(generateBcfReport(fixture));

    const versionViolations = await bcfXsdViolations(decode(zip, "bcf.version"), "version.xsd");
    expect(versionViolations).toEqual([]);

    for (const path of Object.keys(zip)) {
      if (path.endsWith("markup.bcf")) {
        const violations = await bcfXsdViolations(decode(zip, path), "markup.xsd");
        expect(violations).toEqual([]);
      }
      if (path.endsWith("viewpoint.bcfv")) {
        const violations = await bcfXsdViolations(decode(zip, path), "visinfo.xsd");
        expect(violations).toEqual([]);
      }
    }
  });
});
