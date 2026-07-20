import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { ruleSetFixtures } from "../test/mocks/fixtures";
import { renderWithProviders } from "../test/renderWithProviders";
import { UploadPage } from "./UploadPage";

function makeIfcFile(name: string) {
  return new File(["ISO-10303-21;"], name, { type: "application/octet-stream" });
}

describe("UploadPage", () => {
  it("renders rule sets fetched from GET /rule-sets in the select", async () => {
    renderWithProviders(<UploadPage />);
    expect(await screen.findByRole("option", { name: ruleSetFixtures[0].name })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: ruleSetFixtures[1].name })).toBeInTheDocument();
  });

  it("disables submit until a rule set, an engine, and at least one file are chosen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />);
    await screen.findByRole("option", { name: ruleSetFixtures[0].name });

    const submit = screen.getByRole("button", { name: "Start run" });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Rule set"), ruleSetFixtures[0].id);
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    expect(submit).toBeDisabled();

    await user.upload(screen.getByLabelText(/IFC files/), makeIfcFile("model-a.ifc"));
    expect(submit).toBeEnabled();
  });

  it("shows an error and disables submit when more than 20 files are selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UploadPage />);
    await screen.findByRole("option", { name: ruleSetFixtures[0].name });

    await user.selectOptions(screen.getByLabelText("Rule set"), ruleSetFixtures[0].id);
    await user.click(screen.getByRole("radio", { name: "web-ifc" }));

    const tooManyFiles = Array.from({ length: 21 }, (_, i) => makeIfcFile(`model-${i}.ifc`));
    await user.upload(screen.getByLabelText(/IFC files/), tooManyFiles);

    expect(screen.getByRole("alert")).toHaveTextContent("Select up to 20 files (21 selected).");
    expect(screen.getByRole("button", { name: "Start run" })).toBeDisabled();
  });

  it("submits the form and navigates to the run detail page on success", async () => {
    server.use(http.post("/runs", () => HttpResponse.json({ runId: "run-42", fileJobIds: ["f1"] })));

    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/runs/:runId" element={<div>Run detail for run-42</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByRole("option", { name: ruleSetFixtures[0].name });
    await user.selectOptions(screen.getByLabelText("Rule set"), ruleSetFixtures[0].id);
    await user.click(screen.getByRole("radio", { name: "web-ifc" }));
    await user.upload(screen.getByLabelText(/IFC files/), makeIfcFile("model-a.ifc"));
    await user.click(screen.getByRole("button", { name: "Start run" }));

    expect(await screen.findByText("Run detail for run-42")).toBeInTheDocument();
  });
});
