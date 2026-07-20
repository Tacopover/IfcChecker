import { http, HttpResponse } from "msw";
import { completedStatusResponse, ruleSetFixtures, runListFixture, runResultsFixture } from "./fixtures";

export const handlers = [
  http.get("/rule-sets", () => HttpResponse.json(ruleSetFixtures)),
  http.post("/rule-sets", async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get("name");
    return HttpResponse.json({
      id: "rs-new",
      name: typeof name === "string" ? name : "Untitled",
      uploadedAt: new Date().toISOString(),
    });
  }),
  http.post("/runs", () => HttpResponse.json({ runId: "run-1", fileJobIds: ["f1", "f2"] })),
  http.get("/runs", () => HttpResponse.json(runListFixture)),
  http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)),
  http.get("/runs/:runId/results", () => HttpResponse.json(runResultsFixture)),
];
