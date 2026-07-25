import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseIdsXml, type RuleDraft } from "@ifc-qa/ids-validator";
import { IdsXmlPreview } from "./IdsXmlPreview";

const RULES: RuleDraft[] = [
  {
    id: "r1",
    name: "Walls declare a fire rating",
    entityTypes: ["IfcWall"],
    conditions: [
      {
        id: "c1",
        kind: "property",
        propertySet: "Pset_WallCommon",
        name: "FireRating",
        operator: "oneOf",
        values: ["60", "90"],
        text: "",
      },
    ],
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
    expect(specification.applicabilityEntityNames).toEqual(["IFCWALL"]);
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
});
