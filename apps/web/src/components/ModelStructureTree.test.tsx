import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ModelStructureNode } from "@ifc-qa/shared-types";
import { ModelStructureTree } from "./ModelStructureTree";

const tree: ModelStructureNode = {
  expressId: 1,
  ifcType: "IFCPROJECT",
  name: "Fixture Project",
  elementCounts: {},
  children: [
    {
      expressId: 11,
      ifcType: "IFCSITE",
      name: "Fixture Site",
      elementCounts: {},
      children: [
        {
          expressId: 13,
          ifcType: "IFCBUILDING",
          name: "Fixture Building",
          elementCounts: {},
          children: [
            {
              expressId: 14,
              ifcType: "IFCBUILDINGSTOREY",
              name: "Level 1",
              elementCounts: { IFCWALL: 2, IFCDOOR: 1 },
              children: [],
            },
            {
              expressId: 15,
              ifcType: "IFCBUILDINGSTOREY",
              name: null,
              elementCounts: {},
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

describe("ModelStructureTree", () => {
  it("renders every spatial level with a friendly label and its name", () => {
    render(<ModelStructureTree node={tree} />);

    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Fixture Project")).toBeInTheDocument();
    expect(screen.getByText("Site")).toBeInTheDocument();
    expect(screen.getByText("Fixture Site")).toBeInTheDocument();
    expect(screen.getByText("Building")).toBeInTheDocument();
    expect(screen.getByText("Fixture Building")).toBeInTheDocument();
    expect(screen.getAllByText("Storey")).toHaveLength(2);
    expect(screen.getByText("Level 1")).toBeInTheDocument();
  });

  it("shows the element-type counts for a storey", () => {
    render(<ModelStructureTree node={tree} />);

    expect(screen.getByText("IFCWALL: 2")).toBeInTheDocument();
    expect(screen.getByText("IFCDOOR: 1")).toBeInTheDocument();
  });

  it("falls back to '(unnamed)' when a node has no name", () => {
    render(<ModelStructureTree node={tree} />);

    expect(screen.getByText("(unnamed)")).toBeInTheDocument();
  });
});
