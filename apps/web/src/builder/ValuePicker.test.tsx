import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ValuePicker } from "./ValuePicker";

const OBSERVED = [
  { value: "SA", count: 42 },
  { value: "RA", count: 17 },
];

function Harness({ initial = [] as string[] }) {
  const [selected, setSelected] = useState(initial);
  return <ValuePicker observed={OBSERVED} selected={selected} onChange={setSelected} />;
}

describe("ValuePicker", () => {
  it("lists the values found in the file with their counts", () => {
    render(<Harness />);

    expect(screen.getByRole("checkbox", { name: /SA\s*42/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /RA\s*17/ })).toBeInTheDocument();
    expect(screen.getByText("2 distinct")).toBeInTheDocument();
  });

  it("ticks and unticks a value", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: /SA\s*42/ }));
    expect(screen.getByRole("checkbox", { name: /SA\s*42/ })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: /SA\s*42/ }));
    expect(screen.getByRole("checkbox", { name: /SA\s*42/ })).not.toBeChecked();
  });

  it("accepts a value the file does not contain and marks it as absent", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Add a value not in this file"), "EA");
    await user.click(screen.getByRole("button", { name: "+ add" }));

    const added = screen.getByRole("checkbox", { name: /EA\s*not in file/ });
    expect(added).toBeChecked();
    expect(screen.getByLabelText("Add a value not in this file")).toHaveValue("");
  });

  it("does not add the same value twice", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["EA"]} />);

    await user.type(screen.getByLabelText("Add a value not in this file"), "EA{Enter}");

    expect(screen.getAllByRole("checkbox", { name: /EA/ })).toHaveLength(1);
  });
});
