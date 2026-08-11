import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseIdsXml, type PropertyFacetDraft, type RuleDraft } from "@ifc-qa/ids-validator";
import { IdsXmlPreview } from "./IdsXmlPreview";
import { stating } from "../test/conditions";

const FIRE_RATING: PropertyFacetDraft = {
  id: "c1",
  kind: "property",
  propertySet: "Pset_WallCommon",
  name: "FireRating",
  ...stating("oneOf", "", ["60", "90"]),
};

const RULES: RuleDraft[] = [
  {
    id: "r1",
    name: "Walls declare a fire rating",
    entityTypes: ["IfcWall"],
    conditions: [FIRE_RATING],
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IdsXmlPreview", () => {
  it("previews XML that parses back into the rule the user built", () => {
    render(<IdsXmlPreview rules={RULES} title="Tower-A.ifc" />);

    const xml = screen.getByLabelText("IDS XML preview").textContent ?? "";
    const [specification] = parseIdsXml(xml);

    expect(specification.name).toBe("Walls declare a fire rating");
    // The builder writes the concrete classes the pick stands for: IDS inherits nothing.
    expect(specification.applicabilityEntityNames).toEqual([
      "IFCWALL",
      "IFCWALLELEMENTEDCASE",
      "IFCWALLSTANDARDCASE",
    ]);
    expect(specification.requirements[0]).toMatchObject({
      kind: "property",
      propertySet: "Pset_WallCommon",
      baseName: "FireRating",
      restriction: { kind: "enum", values: ["60", "90"] },
    });
  });

  it("hides and shows the preview", async () => {
    const user = userEvent.setup();
    render(<IdsXmlPreview rules={RULES} title="Tower-A.ifc" />);

    await user.click(screen.getByRole("button", { name: "Hide IDS XML" }));
    expect(screen.queryByLabelText("IDS XML preview")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show IDS XML" }));
    expect(screen.getByLabelText("IDS XML preview")).toBeInTheDocument();
  });

  it("downloads the same XML as a .ids file named after the model", async () => {
    const user = userEvent.setup();
    // jsdom has no object-URL support at all, so these are installed rather than spied on.
    const createObjectURL = vi.fn(() => "blob:ids");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    let downloadName: string | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadName = this.download;
    });

    render(<IdsXmlPreview rules={RULES} title="Tower-A.ifc" />);
    await user.click(screen.getByRole("button", { name: "Download .ids" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloadName).toBe("Tower-A.ids");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ids");
  });

  it("refuses to download a rule whose XML would not mean what the page shows", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:ids");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();

    // oneOf with nothing ticked: an empty xs:restriction is an unrestricted string in XSD.
    const incomplete: RuleDraft[] = [
      { ...RULES[0], conditions: [{ ...FIRE_RATING, ...stating("oneOf") }] },
    ];
    render(<IdsXmlPreview rules={incomplete} title="Tower-A.ifc" />);

    const download = screen.getByRole("button", { name: "Download .ids" });
    expect(download).toBeDisabled();
    await user.click(download);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("still previews the XML, under a warning that names what is wrong", () => {
    const incomplete: RuleDraft[] = [{ ...RULES[0], entityTypes: [] }];
    render(<IdsXmlPreview rules={incomplete} title="Tower-A.ifc" />);

    expect(screen.getByLabelText("IDS XML preview")).toBeInTheDocument();
    const warning = screen.getByRole("status");
    expect(warning).toHaveTextContent("Not exportable yet");
    expect(warning).toHaveTextContent(/No element types/);
    expect(warning).toHaveTextContent("Walls declare a fire rating");
  });

  it("has nothing to export when there are no rules at all", () => {
    render(<IdsXmlPreview rules={[]} title="Tower-A.ifc" />);

    expect(screen.getByRole("button", { name: "Download .ids" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/No rules yet/);
  });
});
