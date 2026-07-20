import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import { ruleSetFixtures } from "../test/mocks/fixtures";
import { RuleSetsPage } from "./RuleSetsPage";

describe("RuleSetsPage", () => {
  it("renders existing rule sets from GET /rule-sets", async () => {
    renderWithProviders(<RuleSetsPage />);

    expect(await screen.findByText(ruleSetFixtures[0].name)).toBeInTheDocument();
    expect(screen.getByText(ruleSetFixtures[1].name)).toBeInTheDocument();
  });

  it("uploads a new rule set and shows it in the list once the upload completes", async () => {
    const uploaded = [...ruleSetFixtures];
    server.use(
      http.get("/rule-sets", () => HttpResponse.json(uploaded)),
      http.post("/rule-sets", async ({ request }) => {
        const formData = await request.formData();
        const created = {
          id: "rs-new",
          name: String(formData.get("name")),
          uploadedAt: "2026-07-17T00:00:00.000Z",
        };
        uploaded.push(created);
        return HttpResponse.json(created);
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<RuleSetsPage />);
    await screen.findByText(ruleSetFixtures[0].name);

    await user.type(screen.getByLabelText("Name"), "MEP Structural Standard");
    const file = new File(["<ids/>"], "structural.xml", { type: "application/xml" });
    await user.upload(screen.getByLabelText("IDS XML file"), file);
    await user.click(screen.getByRole("button", { name: "Upload rule set" }));

    await waitFor(() => {
      expect(screen.getByText("MEP Structural Standard")).toBeInTheDocument();
    });
  });

  it("disables the upload button until both a name and a file are provided", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RuleSetsPage />);
    await screen.findByText(ruleSetFixtures[0].name);

    const submit = screen.getByRole("button", { name: "Upload rule set" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Only A Name");
    expect(submit).toBeDisabled();

    const file = new File(["<ids/>"], "rules.xml", { type: "application/xml" });
    await user.upload(screen.getByLabelText("IDS XML file"), file);
    expect(submit).toBeEnabled();
  });
});
