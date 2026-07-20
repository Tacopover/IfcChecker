import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { ruleSetFixtures } from "./test/mocks/fixtures";

describe("App", () => {
  it("starts on the upload page and navigates via the nav links", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Upload IFC Files" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Rule Sets" }));
    expect(await screen.findByRole("heading", { name: "Rule Sets" })).toBeInTheDocument();
    expect(await screen.findByText(ruleSetFixtures[0].name)).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Run History" }));
    expect(await screen.findByRole("heading", { name: "Run History" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Upload" }));
    expect(await screen.findByRole("heading", { name: "Upload IFC Files" })).toBeInTheDocument();
  });
});
