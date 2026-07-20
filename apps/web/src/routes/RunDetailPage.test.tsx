import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/renderWithProviders";
import { completedStatusResponse, runningStatusResponse } from "../test/mocks/fixtures";
import { RunDetailPage } from "./RunDetailPage";

describe("RunDetailPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders per-file progress including a failed file's error message", async () => {
    server.use(http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)));

    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    expect(await screen.findByText("Status: completed")).toBeInTheDocument();
    expect(screen.getByText("model-a.ifc")).toBeInTheDocument();
    expect(screen.getByText("842")).toBeInTheDocument();
    expect(screen.getByText("model-b.ifc")).toBeInTheDocument();
    expect(screen.getByText("unexpected EOF")).toBeInTheDocument();
  });

  it("shows report download links once the run is completed", async () => {
    server.use(http.get("/runs/:runId/status", () => HttpResponse.json(completedStatusResponse)));
    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    await screen.findByText("Status: completed");
    expect(screen.getByRole("link", { name: "Download PDF report" })).toHaveAttribute(
      "href",
      "/runs/run-1/report.pdf"
    );
    expect(screen.getByRole("link", { name: "Download Excel report" })).toHaveAttribute(
      "href",
      "/runs/run-1/report.xlsx"
    );
  });

  it("polls run status every 2s while running and stops once completed", async () => {
    let callCount = 0;
    server.use(
      http.get("/runs/:runId/status", () => {
        callCount += 1;
        return HttpResponse.json(callCount === 1 ? runningStatusResponse : completedStatusResponse);
      })
    );

    vi.useFakeTimers();
    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(callCount).toBe(1);
    expect(screen.getByText("Status: running")).toBeInTheDocument();

    await act(async () => {
      // A plain advanceTimersByTimeAsync(2000) fires the interval's refetch
      // but doesn't drain the zero-delay timer TanStack Query's notifyManager
      // schedules afterward to flush the resulting state update — runAllTimersAsync
      // recursively drains both in one call.
      await vi.runAllTimersAsync();
    });
    expect(callCount).toBe(2);
    expect(screen.getByText("Status: completed")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(callCount).toBe(2);
  });

  it("shows an error message when the status request fails", async () => {
    server.use(http.get("/runs/:runId/status", () => new HttpResponse(null, { status: 500 })));
    renderWithProviders(<RunDetailPage />, { route: "/runs/run-1", path: "/runs/:runId" });
    expect(await screen.findByRole("alert")).toHaveTextContent("500");
  });
});
