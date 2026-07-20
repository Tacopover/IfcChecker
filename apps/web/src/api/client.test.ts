import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import {
  createRuleSet,
  createRun,
  fetchRuleSets,
  fetchRunList,
  fetchRunResults,
  fetchRunStatus,
  reportDownloadUrl,
} from "./client";
import { completedStatusResponse, ruleSetFixtures, runListFixture, runResultsFixture } from "../test/mocks/fixtures";

describe("fetchRuleSets", () => {
  it("returns the rule sets from GET /rule-sets", async () => {
    const result = await fetchRuleSets();
    expect(result).toEqual(ruleSetFixtures);
  });

  it("throws with the response status when the request fails", async () => {
    server.use(http.get("/rule-sets", () => new HttpResponse(null, { status: 500 })));
    await expect(fetchRuleSets()).rejects.toThrow("500");
  });
});

describe("createRuleSet", () => {
  it("posts the file and name as multipart form data", async () => {
    let received: FormData | undefined;
    server.use(
      http.post("/rule-sets", async ({ request }) => {
        received = await request.formData();
        return HttpResponse.json({ id: "rs-new", name: "New Rules", uploadedAt: "2026-07-17T00:00:00.000Z" });
      })
    );

    const file = new File(["<ids/>"], "rules.xml", { type: "application/xml" });
    const result = await createRuleSet(file, "New Rules");

    expect(received?.get("name")).toBe("New Rules");
    expect((received?.get("file") as File).name).toBe("rules.xml");
    expect(result.id).toBe("rs-new");
  });
});

describe("createRun", () => {
  it("posts files, ruleSetId, and engine as multipart form data", async () => {
    let received: FormData | undefined;
    server.use(
      http.post("/runs", async ({ request }) => {
        received = await request.formData();
        return HttpResponse.json({ runId: "run-1", fileJobIds: ["f1", "f2"] });
      })
    );

    const files = [new File(["a"], "model-a.ifc"), new File(["b"], "model-b.ifc")];
    const result = await createRun({ files, ruleSetId: "rs-1", engine: "web-ifc" });

    expect(received?.getAll("files")).toHaveLength(2);
    expect(received?.get("ruleSetId")).toBe("rs-1");
    expect(received?.get("engine")).toBe("web-ifc");
    expect(result.runId).toBe("run-1");
  });
});

describe("fetchRunStatus", () => {
  it("returns the run status from GET /runs/:runId/status", async () => {
    server.use(http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)));
    const result = await fetchRunStatus("run-1");
    expect(result).toEqual(completedStatusResponse);
  });
});

describe("fetchRunResults", () => {
  it("returns the results from GET /runs/:runId/results", async () => {
    server.use(http.get("/runs/:runId/results", () => HttpResponse.json(runResultsFixture)));
    const result = await fetchRunResults("run-1");
    expect(result).toEqual(runResultsFixture);
  });
});

describe("fetchRunList", () => {
  it("returns the run list from GET /runs", async () => {
    server.use(http.get("/runs", () => HttpResponse.json(runListFixture)));
    const result = await fetchRunList();
    expect(result).toEqual(runListFixture);
  });
});

describe("reportDownloadUrl", () => {
  it("builds the pdf and xlsx report URLs for a run", () => {
    expect(reportDownloadUrl("run-1", "pdf")).toBe("/runs/run-1/report.pdf");
    expect(reportDownloadUrl("run-1", "xlsx")).toBe("/runs/run-1/report.xlsx");
  });
});
