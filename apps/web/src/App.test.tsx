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

  it("labels every tab for the browser smoke check", () => {
    render(<App />);

    for (const [label, route] of [
      ["Validate", "validate"],
      ["Build rules", "builder"],
      ["3D view", "viewer"],
    ]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("data-smoke-route", route);
    }
  });

  // The other two pages stay mounted so switching tabs never discards work.
  // The viewer cannot: it holds mesh buffers and a live WebGL context, and
  // several federated 1.6 GB models will not fit alongside each other.
  it("mounts the viewer only while its tab is open, and unmounts it on leaving", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("heading", { name: "Models" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3D view" }));
    expect(screen.getByRole("heading", { name: "Models" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.queryByRole("heading", { name: "Models" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ifc Checker" })).toBeInTheDocument();
  });

  it("tells a viewer user with no parsed files where to get them", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "3D view" }));
    expect(screen.getByText(/parse a file on the Validate page first/i)).toBeInTheDocument();
  });
});
