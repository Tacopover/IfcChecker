import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { RuleBuilderPage, pathToNode } from "./RuleBuilderPage";
import type { TreeNode } from "./introspect";

const { parseIfcFileOnly } = vi.hoisted(() => ({ parseIfcFileOnly: vi.fn() }));
vi.mock("../local/parseAndValidate.js", () => ({ parseIfcFileOnly }));

function wall(index: number, fireRating: string | null): NormalizedElement {
  return {
    globalId: `w${index}`,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${index}`,
    attributes: { Tag: `W-${index}` },
    propertySets: {
      Pset_WallCommon: fireRating === null ? { Status: "New" } : { Status: "New", FireRating: fireRating },
    },
  };
}

function door(index: number): NormalizedElement {
  return {
    globalId: `d${index}`,
    ifcType: "IFCDOOR",
    predefinedType: null,
    name: `Door ${index}`,
    attributes: {},
    propertySets: { Pset_DoorCommon: { FireRating: "30" } },
  };
}

const ELEMENTS = [wall(1, "60"), wall(2, "90"), wall(3, null), door(1), door(2)];

beforeEach(() => {
  vi.resetAllMocks();
  parseIfcFileOnly.mockResolvedValue({ elements: ELEMENTS, parseMs: 12, modelStructure: null });
});

async function loadModel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "ifc-lite" }));
  await user.upload(
    screen.getByLabelText("IFC file (one worked example)"),
    new File(["ISO-10303-21;"], "tower.ifc")
  );
  await user.click(screen.getByRole("button", { name: "Load model" }));
}

describe("RuleBuilderPage", () => {
  it("cannot load until an engine and a file are chosen", async () => {
    const user = userEvent.setup();
    render(<RuleBuilderPage />);

    expect(screen.getByRole("button", { name: "Load model" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Build rules from a real file" })).toBeInTheDocument();

    await loadModel(user);

    expect(await screen.findByRole("tree")).toBeInTheDocument();
    expect(parseIfcFileOnly).toHaveBeenCalledWith(expect.any(File), "ifc-lite");
  });

  it("shows the file's entity types and inherited groups, with counts", async () => {
    const user = userEvent.setup();
    render(<RuleBuilderPage />);
    await loadModel(user);

    const tree = await screen.findByRole("tree");
    expect(within(tree).getByRole("button", { name: /IfcBuildingElement\s*2× 5/ })).toBeInTheDocument();
    expect(within(tree).getByRole("button", { name: /IfcWall\s*3/ })).toBeInTheDocument();
    expect(screen.getByText("2 types · 1 groups")).toBeInTheDocument();
  });

  it("shows coverage and sample values for the selection, amber under 90%", async () => {
    const user = userEvent.setup();
    const { container } = render(<RuleBuilderPage />);
    await loadModel(user);

    await screen.findByRole("tree");
    const fireRating = screen.getByRole("button", { name: /FireRating/ });
    expect(fireRating).toHaveTextContent("67%");
    expect(within(fireRating).getByText("67%")).toHaveAttribute("data-low", "1");
    expect(container.querySelector(".card.pset .psname")).toHaveTextContent("Pset_WallCommon");
    expect(screen.getByText("Wall 1")).toBeInTheDocument();
  });

  it("adds a condition — and the selected type — to the active rule when a field is clicked", async () => {
    const user = userEvent.setup();
    render(<RuleBuilderPage />);
    await loadModel(user);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /FireRating/ }));

    expect(screen.getByLabelText("Field name")).toHaveValue("FireRating");
    expect(screen.getByLabelText("Property set")).toHaveValue("Pset_WallCommon");
    expect(screen.getByTitle("IfcWall")).toBeInTheDocument();
    // 3 walls match, 2 of them carry a fire rating.
    expect(document.querySelector(".rule-head .score-text")).toHaveTextContent("2/3");
  });

  it("selecting a group expands it and re-aims the schema cards at all its types", async () => {
    const user = userEvent.setup();
    render(<RuleBuilderPage />);
    await loadModel(user);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /IfcBuildingElement\s*2× 5/ }));

    expect(screen.getByRole("button", { name: /IfcDoor\s*2/ })).toBeInTheDocument();
    expect(screen.getByText("IfcBuildingElement · 5 across 2 types")).toBeInTheDocument();
    expect(document.querySelectorAll(".card.pset .psname")).toHaveLength(2);
  });

  it("starts a rule from the New rule button and exports it as IDS XML", async () => {
    const user = userEvent.setup();
    render(<RuleBuilderPage />);
    await loadModel(user);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: "+ New rule" }));

    expect(screen.getByLabelText("Rule name")).toHaveValue("New rule");
    expect(screen.getByLabelText("IDS XML preview")).toHaveTextContent(
      /<specification name="New rule"/
    );
    expect(screen.getByLabelText("IDS XML preview")).toHaveTextContent(/IFCWALL/);
  });

  it("duplicates a whole rule", async () => {
    const user = userEvent.setup();
    render(<RuleBuilderPage />);
    await loadModel(user);
    await screen.findByRole("tree");
    await user.click(screen.getByRole("button", { name: "+ New rule" }));

    await user.click(screen.getByRole("button", { name: "Duplicate rule New rule" }));

    expect(screen.getAllByLabelText("Rule name").map((input) => (input as HTMLInputElement).value))
      .toEqual(["New rule", "New rule (copy)"]);
  });

  it("reports a failed parse without breaking the page", async () => {
    const user = userEvent.setup();
    parseIfcFileOnly.mockRejectedValueOnce(new Error("unexpected end of file"));
    render(<RuleBuilderPage />);

    await loadModel(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("unexpected end of file");
    expect(screen.getByRole("heading", { name: "Build rules from a real file" })).toBeInTheDocument();

    parseIfcFileOnly.mockResolvedValue({ elements: ELEMENTS, parseMs: 9, modelStructure: null });
    await user.click(screen.getByRole("button", { name: "Load model" }));

    expect(await screen.findByRole("tree")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("pathToNode", () => {
  const tree: TreeNode[] = [
    {
      name: "IfcElement",
      kind: "group",
      count: 5,
      typeCount: 2,
      children: [
        {
          name: "IfcBuildingElement",
          kind: "group",
          count: 5,
          typeCount: 2,
          children: [{ name: "IfcWall", kind: "type", count: 3, typeCount: 1, children: [] }],
        },
      ],
    },
  ];

  it("returns the ancestors that have to be open for a node to be visible", () => {
    expect(pathToNode(tree, "IfcWall")).toEqual(["IfcElement", "IfcBuildingElement"]);
    expect(pathToNode(tree, "IfcElement")).toEqual([]);
    expect(pathToNode(tree, "IfcDoor")).toBeNull();
  });
});
