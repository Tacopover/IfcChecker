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

/**
 * Walks the wizard to produce one default-named rule over the fixture's "IfcBuildingElement"
 * group (Wall + Door, 5 elements — the only top-level pick this fixture's tree offers, since both
 * types are grouped under it). Skips narrowing and adds no checks, matching what the old blank
 * "+ New rule" button used to produce, for tests that just need a rule on the page rather than
 * being about wizard behavior itself.
 */
async function createRuleViaWizard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start" }));
  await user.click(screen.getByRole("checkbox", { name: /IfcBuildingElement/ }));
  await user.click(screen.getByRole("button", { name: /Next: Narrow it down/ }));
  await user.click(screen.getByRole("button", { name: /Skip — check all 5/ }));
  await user.click(screen.getByRole("button", { name: "Next: Review →" }));
  await user.click(screen.getByRole("button", { name: "Save rule ✓" }));
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
    // IfcWall's full schema expansion collapses back into one summary chip for display.
    expect(document.querySelector(".chips .chip")).toHaveClass("group");
    expect(document.querySelector(".chips .chip")).toHaveTextContent("IfcWall");
    // 3 walls match, 2 of them carry a fire rating.
    expect(document.querySelector(".rule-head .score-text")).toHaveTextContent("2/3");
  });

  it("starts a second rule from a field click even though one already exists", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /FireRating/ }));
    expect(screen.getAllByLabelText("Rule name")).toHaveLength(1);
    expect(screen.getByLabelText("Add conditions to")).toHaveDisplayValue("IfcWall rule");

    await user.selectOptions(screen.getByLabelText("Add conditions to"), "+ Create a new rule");
    await user.click(screen.getByRole("button", { name: /Status/ }));

    expect(screen.getAllByLabelText("Rule name")).toHaveLength(2);
    expect(screen.getAllByLabelText("Field name").map((input) => (input as HTMLInputElement).value)).toEqual([
      "FireRating",
      "Status",
    ]);
  });

  it("adds to whichever rule is chosen from the target picker, not just the one last clicked", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /FireRating/ }));
    await createRuleViaWizard(user);
    // The wizard's rule becomes the target the moment it is created.
    expect(screen.getByLabelText("Add conditions to")).toHaveDisplayValue("New rule");

    await user.selectOptions(screen.getByLabelText("Add conditions to"), "IfcWall rule");
    await user.click(screen.getByRole("button", { name: /Status/ }));

    expect(screen.getAllByLabelText("Rule name")).toHaveLength(2);
    expect(screen.getAllByLabelText("Field name").map((input) => (input as HTMLInputElement).value)).toEqual([
      "FireRating",
      "Status",
    ]);
  });

  it("shows the target picker before any rule exists, offering only to create one", async () => {
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    expect(screen.getByLabelText("Add conditions to")).toHaveDisplayValue("+ Create a new rule");
  });

  it("puts the full rule name in a title attribute, for names too long to read in the narrow rail", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /FireRating/ }));

    expect(screen.getByLabelText("Add conditions to")).toHaveAttribute("title", "IfcWall rule");
  });

  it("deselects the target rule when the user clicks the space around the rule cards", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await user.click(screen.getByRole("button", { name: /FireRating/ }));
    expect(screen.getByLabelText("Add conditions to")).toHaveDisplayValue("IfcWall rule");
    expect(screen.getByText("Adding here")).toBeInTheDocument();

    await user.click(screen.getByRole("main"));

    expect(screen.getByLabelText("Add conditions to")).toHaveDisplayValue("+ Create a new rule");
    expect(screen.queryByText("Adding here")).not.toBeInTheDocument();
  });

  it("deselects the target rule when the user clicks the 'create a new rule' tile, not its Start button", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await user.click(screen.getByRole("button", { name: /FireRating/ }));
    expect(screen.getByLabelText("Add conditions to")).toHaveDisplayValue("IfcWall rule");

    await user.click(screen.getByText(/Answer a few questions about what to check/));

    expect(screen.getByLabelText("Add conditions to")).toHaveDisplayValue("+ Create a new rule");

    // Re-target the existing rule, then confirm the Start button inside the same tile still just
    // opens the wizard rather than also deselecting.
    await user.selectOptions(screen.getByLabelText("Add conditions to"), "IfcWall rule");
    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByRole("heading", { name: "What does this rule apply to?" })).toBeInTheDocument();
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

  it("starts a rule from the creation wizard and exports it as IDS XML", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await createRuleViaWizard(user);

    expect(screen.getByLabelText("Rule name")).toHaveValue("New rule");
    expect(screen.getByText("Just added")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    expect(screen.getByLabelText("IDS XML preview")).toHaveTextContent(
      /<specification name="New rule"/
    );
    expect(screen.getByLabelText("IDS XML preview")).toHaveTextContent(/IFCWALL/);
  });

  it("leaves the rule list untouched when the wizard is cancelled", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("heading", { name: "What does this rule apply to?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Rule name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("duplicates a whole rule", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await createRuleViaWizard(user);

    await user.click(screen.getByRole("button", { name: "Duplicate rule New rule" }));

    expect(screen.getAllByLabelText("Rule name").map((input) => (input as HTMLInputElement).value))
      .toEqual(["New rule", "New rule (copy)"]);
  });

  it("adds an OR-linked branch off a rule, and shows the badge on both once linked", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await createRuleViaWizard(user);

    expect(screen.queryByText("OR")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add OR condition to New rule" }));

    expect(screen.getAllByLabelText("Rule name").map((input) => (input as HTMLInputElement).value)).toEqual([
      "New rule",
      "New rule (2)",
    ]);
    expect(screen.getAllByText("OR")).toHaveLength(2);
  });

  it("writes both OR branches out with the same group identifier, and no others", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await createRuleViaWizard(user);
    await user.click(screen.getByRole("button", { name: "Add OR condition to New rule" }));

    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    const xml = screen.getByLabelText("IDS XML preview").textContent ?? "";
    const identifiers = [...xml.matchAll(/identifier="([^"]+)"/g)].map((match) => match[1]);

    expect(identifiers).toHaveLength(2);
    expect(new Set(identifiers).size).toBe(1);
    expect(identifiers[0]).toMatch(/^ifcqa:or:/);
  });

  it("does not carry the OR link onto a plain duplicate of a linked rule", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await createRuleViaWizard(user);
    await user.click(screen.getByRole("button", { name: "Add OR condition to New rule" }));

    await user.click(screen.getByRole("button", { name: "Duplicate rule New rule" }));

    // Three cards now: the two linked originals plus an independent copy.
    expect(screen.getAllByLabelText("Rule name")).toHaveLength(3);
    expect(screen.getAllByText("OR")).toHaveLength(2);
  });

  it("gives two independently created OR groups distinct identifiers", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await user.click(screen.getByRole("button", { name: /FireRating/ })); // creates "IfcWall rule"
    await createRuleViaWizard(user); // creates "New rule"

    await user.click(screen.getByRole("button", { name: "Add OR condition to IfcWall rule" }));
    await user.click(screen.getByRole("button", { name: "Add OR condition to New rule" }));

    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    const xml = screen.getByLabelText("IDS XML preview").textContent ?? "";
    const identifiers = [...xml.matchAll(/identifier="([^"]+)"/g)].map((match) => match[1]);

    // Four branches (two OR pairs), but only two distinct group ids — the two pairs must not merge.
    expect(identifiers).toHaveLength(4);
    expect(new Set(identifiers).size).toBe(2);
  });

  it("carries the Prohibited toggle through to the exported XML", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");
    await createRuleViaWizard(user);

    await user.click(screen.getByRole("checkbox", { name: "Prohibited" }));

    await user.click(screen.getByRole("button", { name: "Expand New rule" }));
    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    expect(screen.getByLabelText("IDS XML preview")).toHaveTextContent(
      /minOccurs="0"\s*maxOccurs="0"/
    );
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
    <specification name="Everything with a wall-ish class is named" ifcVersion="IFC4">
      <applicability><entity><name><xs:restriction base="xs:string"><xs:pattern value="IFCWALL.*" /></xs:restriction></name></entity></applicability>
      <requirements><attribute><name><simpleValue>Name</simpleValue></name></attribute></requirements>
    </specification>
    <specification name="Doors are named" ifcVersion="IFC4">
      <applicability>
        <entity><name><simpleValue>IFCDOOR</simpleValue></name></entity>
        <property dataType="IFCBOOLEAN">
          <propertySet><simpleValue>Pset_DoorCommon</simpleValue></propertySet>
          <baseName><simpleValue>IsExternal</simpleValue></baseName>
          <value><simpleValue>TRUE</simpleValue></value>
        </property>
      </applicability>
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
      "Everything with a wall-ish class is named",
      "Doors are named",
    ]);
    expect(screen.getByText("Kept, not editable")).toBeInTheDocument();
    expect(
      screen.getByText(/Gives its entity types as a pattern rather than plain names\./)
    ).toBeInTheDocument();
  });

  // An applicability facet decides which elements the rule reaches, so the type chips alone are
  // not the whole story — and it is now editable, with the three attributes `ids.xsd` withholds on
  // that side absent from the row rather than merely left alone.
  it("edits what else the rule selects by, beside its type chips", async () => {
    const user = userEvent.setup();
    const { container } = renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile());
    await user.click(screen.getByRole("button", { name: "Expand Doors are named" }));

    const row = within(container.querySelector<HTMLElement>(".applicability-facet")!);
    expect(row.getByLabelText("Property set")).toHaveValue("Pset_DoorCommon");
    expect(row.getByLabelText("Field name")).toHaveValue("IsExternal");
    expect(row.getByLabelText("Value")).toHaveValue("TRUE");

    // `applicabilityType` references the base facet types; it is `requirementsType` that adds
    // cardinality. A select here would let the builder write a document the schema does not describe.
    expect(row.queryByLabelText("Cardinality")).toBeNull();

    await user.clear(row.getByLabelText("Value"));
    await user.type(row.getByLabelText("Value"), "FALSE");
    expect(row.getByLabelText("Value")).toHaveValue("FALSE");
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
    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    const xml = screen.getByLabelText("IDS XML preview").textContent ?? "";

    expect(xml).toContain("<title>Client standard</title>");
    expect(xml).toContain("<author>bim@client.example</author>");
    expect(xml).toContain(`ifcVersion="IFC2X3 IFC4"`);
    expect(xml).toContain(`<specification name="Everything with a wall-ish class is named"`);
    expect(xml).toContain(`<xs:pattern value="IFCWALL.*"`);
  });

  // It survived a round trip before this and could not be touched. A document authored here stated
  // a title and nothing else, and one imported could not have its author corrected.
  it("edits the document's own metadata, and writes the edit back out", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile());
    await user.click(screen.getByRole("button", { name: /About this document/ }));

    expect(screen.getByLabelText("Author")).toHaveValue("bim@client.example");

    await user.clear(screen.getByLabelText("Author"));
    await user.type(screen.getByLabelText("Author"), "taco@mepover.com");
    await user.type(screen.getByLabelText("Milestone"), "Design");

    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    const xml = screen.getByLabelText("IDS XML preview").textContent ?? "";
    expect(xml).toContain("<author>taco@mepover.com</author>");
    expect(xml).toContain("<milestone>Design</milestone>");
  });

  // `ids.xsd` patterns <author> as an email address, so a half-typed one exports a document no
  // conforming checker reads. Saying so up front beats the file being rejected later.
  it("says which metadata fields the schema will not accept", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile());
    await user.click(screen.getByRole("button", { name: /About this document/ }));

    await user.clear(screen.getByLabelText("Author"));
    await user.type(screen.getByLabelText("Author"), "Taco");
    await user.type(screen.getByLabelText("Date"), "16-08-2026");

    expect(screen.getByText(/Author — IDS requires an email address/)).toBeInTheDocument();
    expect(screen.getByText(/Date — IDS requires YYYY-MM-DD/)).toBeInTheDocument();
  });

  // An empty box writes no element, which is what `minOccurs="0"` is for — a cleared field must not
  // leave a <copyright></copyright> nobody typed.
  it("writes no element for a field left empty", async () => {
    const user = userEvent.setup();
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile());
    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));

    expect(screen.getByLabelText("IDS XML preview").textContent).not.toContain("<milestone>");
  });

  it("confirms before replacing work already on the page, and stops if the user declines", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBuilder([{ fileName: "tower.ifc" }]);
    await screen.findByRole("tree");

    await createRuleViaWizard(user);
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

  // The importer never sets `RuleDraft.cardinality` — it is only the builder's own override — so an
  // imported prohibited specification's minOccurs="0" maxOccurs="0" has to keep reading as
  // Prohibited everywhere the card decides something from it, with nothing touched by the user yet.
  it("shows an imported prohibited specification's checkbox as checked", async () => {
    const user = userEvent.setup();
    const prohibited = `<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <info><title>Client standard</title></info>
  <specifications>
    <specification name="No proxies" ifcVersion="IFC4">
      <applicability minOccurs="0" maxOccurs="0">
        <entity><name><simpleValue>IFCBUILDINGELEMENTPROXY</simpleValue></name></entity>
      </applicability>
      <requirements></requirements>
    </specification>
  </specifications>
</ids>`;
    renderBuilder([{ fileName: "tower.ifc" }]);

    await user.upload(await screen.findByLabelText("Import an IDS file"), idsFile("client.ids", prohibited));

    expect(screen.getByRole("checkbox", { name: "Prohibited" })).toBeChecked();

    // Untouched, the rule must still export exactly what was imported — re-exporting the file the
    // user just opened must not silently flip its meaning.
    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    expect(screen.getByLabelText("IDS XML preview")).toHaveTextContent(
      /minOccurs="0"\s*maxOccurs="0"/
    );
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
