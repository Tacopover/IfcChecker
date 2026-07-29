import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

describe("App", () => {
  it("starts on the Ifc Checker page", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Ifc Checker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Build rules" })).not.toHaveAttribute("aria-current");
  });

  it("switches to the rule builder and back without losing the other page", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Build rules" }));
    expect(screen.getByRole("heading", { name: "Build rules from a real file" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ifc Checker" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByRole("heading", { name: "Ifc Checker" })).toBeInTheDocument();
  });

  it("sends a builder user with no parsed files back to the page that loads them", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Build rules" }));
    await user.click(screen.getByRole("button", { name: "Load IFC files" }));

    expect(screen.getByRole("heading", { name: "Ifc Checker" })).toBeInTheDocument();
    expect(screen.getByLabelText(/IFC files/)).toBeInTheDocument();
  });

  it("labels both tabs for the browser smoke check", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Validate" })).toHaveAttribute(
      "data-smoke-route",
      "validate"
    );
    expect(screen.getByRole("button", { name: "Build rules" })).toHaveAttribute(
      "data-smoke-route",
      "builder"
    );
  });
});
