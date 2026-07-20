import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import { runListFixture } from "../test/mocks/fixtures";
import { RunHistoryPage } from "./RunHistoryPage";

describe("RunHistoryPage", () => {
  it("renders past runs fetched from GET /runs with links to their detail pages", async () => {
    renderWithProviders(<RunHistoryPage />);

    const firstRunLink = await screen.findByRole("link", { name: runListFixture.runs[0].id });
    expect(firstRunLink).toHaveAttribute("href", `/runs/${runListFixture.runs[0].id}`);
    expect(screen.getByText(runListFixture.runs[0].status)).toBeInTheDocument();
    expect(screen.getByText(runListFixture.runs[1].engine)).toBeInTheDocument();
  });

  it("shows an empty state when there are no runs yet", async () => {
    server.use(http.get("/runs", () => HttpResponse.json({ runs: [] })));
    renderWithProviders(<RunHistoryPage />);
    expect(await screen.findByText("No runs yet.")).toBeInTheDocument();
  });

  it("shows an error message when the run list request fails", async () => {
    server.use(http.get("/runs", () => new HttpResponse(null, { status: 500 })));
    renderWithProviders(<RunHistoryPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("500");
  });
});
