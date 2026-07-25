import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelTree } from "./ModelTree";
import type { TreeNode } from "./introspect";

const TREE: TreeNode[] = [
  {
    name: "IfcElement",
    kind: "group",
    count: 60,
    typeCount: 2,
    children: [
      { name: "IfcWall", kind: "type", count: 40, typeCount: 1, children: [] },
      { name: "IfcDoor", kind: "type", count: 20, typeCount: 1, children: [] },
    ],
  },
  { name: "IfcSpace", kind: "type", count: 3, typeCount: 1, children: [] },
];

function Harness({ initiallyExpanded = [] as string[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(initiallyExpanded));
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ModelTree
      nodes={TREE}
      selectedName={selected}
      expanded={expanded}
      onSelect={(node) => setSelected(node.name)}
      onToggle={(name) =>
        setExpanded((previous) => {
          const next = new Set(previous);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return next;
        })
      }
    />
  );
}

describe("ModelTree", () => {
  it("shows a count on every row — types plain, groups as types × elements", () => {
    render(<Harness initiallyExpanded={["IfcElement"]} />);

    expect(screen.getByRole("button", { name: /IfcElement\s*2× 60/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /IfcWall\s*40/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /IfcSpace\s*3/ })).toBeInTheDocument();
  });

  it("hides a group's members until its caret is used, and shows them again after", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole("button", { name: /IfcWall/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand IfcElement" }));
    expect(screen.getByRole("button", { name: /IfcWall\s*40/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse IfcElement" }));
    expect(screen.queryByRole("button", { name: /IfcWall/ })).not.toBeInTheDocument();
  });

  it("selects on the label, not on the caret", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ModelTree
        nodes={TREE}
        selectedName="IfcSpace"
        expanded={new Set(["IfcElement"])}
        onSelect={onSelect}
        onToggle={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "Collapse IfcElement" }));
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /IfcWall\s*40/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "IfcWall", kind: "type" }));

    expect(screen.getByRole("button", { name: /IfcSpace\s*3/ })).toHaveAttribute(
      "data-selected",
      "true"
    );
  });
});
