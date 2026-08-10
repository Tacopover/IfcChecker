import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { RuleBuilderPage, pathToNode } from "./RuleBuilderPage";
import {
  LoadedModelsProvider,
  modelKey,
  useLoadedModels,
  type ParseOutcome,
} from "../state/loadedModels";
import type { TreeNode } from "./introspect";

function wall(index: number, fireRating: string | null): NormalizedElement {
  return {
    globalId: `w${index}`,
    ifcType: "IFCWALL",
    predefinedType: null,
    name: `Wall ${index}`,
    attributes: { Tag: { value: `W-${index}` } },
    propertySets: {
      Pset_WallCommon:
        fireRating === null
          ? { Status: { value: "New" } }
          : { Status: { value: "New" }, FireRating: { value: fireRating } },
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
    propertySets: { Pset_DoorCommon: { FireRating: { value: "30" } } },
  };
}

function slab(index: number): NormalizedElement {
  return {
    globalId: `s${index}`,
    ifcType: "IFCSLAB",
    predefinedType: null,
    name: `Slab ${index}`,
    attributes: {},
    propertySets: { Pset_SlabCommon: { IsExternal: { value: "true" } } },
  };
}

const ELEMENTS = [wall(1, "60"), wall(2, "90"), wall(3, null), door(1), door(2)];

interface SeedModel {
  fileName: string;
  elements?: NormalizedElement[];
  status?: ParseOutcome["status"];
}

/** Fills the shared store the way the validate page would, so the builder has files to pick from. */
function Seed({ models, files }: { models: SeedModel[]; files: File[] }) {
  const { addFiles, applyParseOutcome } = useLoadedModels();
  useEffect(() => {
    addFiles(files);
    for (const [index, model] of models.entries()) {
      const failed = model.status === "failed";
      applyParseOutcome(modelKey(files[index]), {
        status: failed ? "failed" : "succeeded",
        engine: "ifc-lite",
        parseMs: failed ? null : 12,
        errorMessage: failed ? "unexpected end of file" : null,
        elements: failed ? [] : (model.elements ?? ELEMENTS),
        idsScope: failed ? [] : (model.elements ?? ELEMENTS),
        modelStructure: null,
        unitScales: {},
      });
    }
    // Seeding once, on mount: re-running would re-add files the test then works against.
  }, []);
  return null;
}

/** Returns the store keys by file name — the <option> values the picker is driven by. */
function renderBuilder(models: SeedModel[] = [], onGoToFiles?: () => void) {
  const files = models.map((model) => new File(["ISO-10303-21;"], model.fileName));
  const result = render(
    <LoadedModelsProvider>
      <Seed models={models} files={files} />
      <RuleBuilderPage onGoToFiles={onGoToFiles} />
    </LoadedModelsProvider>
  );
  return {
    ...result,
    keys: Object.fromEntries(files.map((file) => [file.name, modelKey(file)])) as Record<string, string>,
  };
}

describe("RuleBuilderPage", () => {
  it("sends the user to the validate page when nothing has been parsed yet", async () => {
    const onGoToFiles = vi.fn();
    const user = userEvent.setup();
    renderBuilder([], onGoToFiles);

    expect(screen.getByRole("heading", { name: "Build rules from a real file" })).toBeInTheDocument();
    expect(screen.getByLabelText("IFC file (one worked example)")).toBeDisabled();
    expect(screen.getByRole("option", { name: "No parsed files yet" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load IFC files" }));
    expect(onGoToFiles).toHaveBeenCalled();
  });

  it("offers the files already parsed on the validate page, and works from the first one", async () => {
    const { keys, container } = renderBuilder([
      { fileName: "tower.ifc" },
      { fileName: "annex.ifc", elements: [slab(1)] },
    ]);

    const picker = await screen.findByLabelText("IFC file (one worked example)");
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "tower.ifc",
      "annex.ifc",
    ]);
    expect(picker).toHaveValue(keys["tower.ifc"]);
    expect(container.querySelector(".srcfile")).toHaveTextContent("tower.ifc· 5 elements · 12 ms · ifc-lite");
    expect(await screen.findByRole("tree")).toBeInTheDocument();
  });

  it("leaves out files that failed to parse — there is nothing to build rules from", async () => {
    renderBuilder([{ fileName: "corrupt.ifc", status: "failed" }, { fileName: "tower.ifc" }]);

    const picker = await screen.findByLabelText("IFC file (one worked example)");
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "tower.ifc",
    ]);
  });

  it("re-aims the explorer at the file the user switches to", async () => {
    const user = userEvent.setup();
    const { keys } = renderBuilder([
      { fileName: "tower.ifc" },
      { fileName: "annex.ifc", elements: [slab(1), slab(2)] },
    ]);

    const tree = await screen.findByRole("tree");
    expect(within(tree).getByRole("button", { name: /IfcWall\s*3/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("IFC file (one worked example)"), keys["annex.ifc"]);

    expect(within(screen.getByRole("tree")).getByRole("button", { name: /IfcSlab\s*2/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /IfcWall\s*3/ })).not.toBeInTheDocument();
    expect(screen.getByText("Pset_SlabCommon")).toBeInTheDocument();
  });

  it("shows the file's entity types and inherited groups, with counts", async () => {
    renderBuilder([{ fileName: "tower.ifc" }]);

    const tree = await screen.findByRole("tree");
    expect(within(tree).getByRole("button", { name: /IfcBuildingElement\s*2× 5/ })).toBeInTheDocument();
    expect(within(tree).getByRole("button", { name: /IfcWall\s*3/ })).toBeInTheDocument();
    expect(screen.getByText("2 types · 1 groups")).toBeInTheDocument();
  });

  it("shows coverage and sample values for the selection, amber under 90%", async () => {
    const { container } = renderBuilder([{ fileName: "tower.ifc" }]);

    await screen.findByRole("tree");
    const fireRating = screen.getByRole("button", { name: /FireRating/ });
    expect(fireRating).toHaveTextContent("67%");
    expect(within(fireRating).getByText("67%")).toHaveAttribute("data-low", "1");
    expect(container.querySelector(".card.pset .psname")).toHaveTextContent("Pset_WallCommon");
    expect(screen.getByText("Wall 1")).toBeInTheDocument();
  });

  it("adds a condition — and the selected type — to the active rule when a field is clicked", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
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
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /IfcBuildingElement\s*2× 5/ }));

    expect(screen.getByRole("button", { name: /IfcDoor\s*2/ })).toBeInTheDocument();
    expect(screen.getByText("IfcBuildingElement · 5 across 2 types")).toBeInTheDocument();
    expect(document.querySelectorAll(".card.pset .psname")).toHaveLength(2);
  });

  it("starts a rule from the New rule button and exports it as IDS XML", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
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
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await user.click(screen.getByRole("button", { name: "+ New rule" }));

    await user.click(screen.getByRole("button", { name: "Duplicate rule New rule" }));

    expect(screen.getAllByLabelText("Rule name").map((input) => (input as HTMLInputElement).value))
      .toEqual(["New rule", "New rule (copy)"]);
  });
});

const IMPORTED_IDS = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <info><title>Client standard</title><author>bim@client.example</author></info>
  <specifications>
    <specification name="Walls are named" ifcVersion="IFC2X3 IFC4">
      <applicability><entity><name><simpleValue>IFCWALL</simpleValue></name></entity></applicability>
      <requirements>
        <attribute><name><simpleValue>Name</simpleValue></name></attribute>
        <classification><value><simpleValue>21.22</simpleValue></value></classification>
      </requirements>
    </specification>
    <specification name="Classified elements are named" ifcVersion="IFC4">
      <applicability><classification><system><simpleValue>NL/SfB</simpleValue></system></classification></applicability>
      <requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>
    </specification>
    <specification name="Doors are named" ifcVersion="IFC4">
      <applicability><entity><name><simpleValue>IFCDOOR</simpleValue></name></entity></applicability>
      <requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>
    </specification>
  </specifications>
</ids>`;

function idsFile(name = "client.ids", body = IMPORTED_IDS): File {
  return new File([body], name, { type: "application/xml" });
}

/** Every specification card in document order, whether it is editable or held read-only. */
function cardTitles(container: HTMLElement): string[] {
  return [...container.querySelectorAll("article.rule")].map((card) => {
    const editable = card.querySelector<HTMLInputElement>(".rule-title");
    return editable ? editable.value : (card.querySelector(".rule-title-static")?.textContent ?? "");
  });
}

describe("RuleBuilderPage importing an IDS file", () => {
  it("loads every specification, holding the ones it cannot edit in their original place", async () => {
    const user = userEvent.setup();
    const { container } = renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile());

    expect(cardTitles(container)).toEqual([
      "Walls are named",
      "Classified elements are named",
      "Doors are named",
    ]);
    expect(screen.getByText("Kept, not editable")).toBeInTheDocument();
    expect(
      screen.getByText(/Selects elements by <classification>, which the builder cannot show\./)
    ).toBeInTheDocument();
  });

  it("says permanently, on the rule itself, what it kept but cannot show", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile());

    // Visible while collapsed, so it survives until the moment the user exports.
    expect(screen.getByText("1 kept")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand Walls are named" }));
    expect(screen.getByText(/1 more requirement kept from the imported file\./)).toBeInTheDocument();
    // The count above the note must not read as a verdict on requirements it never checked.
    expect(screen.getByText("All 3 pass on the conditions shown")).toBeInTheDocument();
  });

  it("writes the whole document back out, including the parts it could not read", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile());
    const xml = screen.getByLabelText("IDS XML preview").textContent ?? "";

    expect(xml).toContain("<title>Client standard</title>");
    expect(xml).toContain("<author>bim@client.example</author>");
    expect(xml).toContain(`ifcVersion="IFC2X3 IFC4"`);
    expect(xml).toContain(`<specification name="Classified elements are named"`);
    expect(xml).toContain("<classification>");
  });

  it("confirms before replacing work already on the page, and stops if the user declines", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.click(await screen.findByRole("button", { name: "+ New rule" }));
    await user.upload(screen.getByLabelText("Import an IDS file"), idsFile());

    expect(confirm).toHaveBeenCalledWith(
      "Importing client.ids replaces the 1 specification already here. Continue?"
    );
    expect(screen.getAllByLabelText("Rule name").map((input) => (input as HTMLInputElement).value))
      .toEqual(["New rule"]);
    confirm.mockRestore();
  });

  it("reports a file it cannot read and leaves the rules alone", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(
      await screen.findByLabelText("Import an IDS file"),
      idsFile("schedule.xml", `<?xml version="1.0"?><project><wall /></project>`)
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "schedule.xml contains no IDS specifications."
    );
    expect(screen.queryAllByLabelText("Rule name")).toHaveLength(0);
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
