import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { ConditionDraft } from "@ifc-qa/ids-validator";
import { plainName } from "@ifc-qa/ids-validator";
import { FailingElementsTable, readConditionValue } from "./FailingElementsTable";
import { stating } from "../test/conditions";

function element(overrides: Partial<NormalizedElement> = {}): NormalizedElement {
  return {
    globalId: "g1",
    ifcType: "IFCWALL",
    predefinedType: null,
    name: "Basic Wall",
    attributes: { Tag: { value: "W-1" } },
    propertySets: { Pset_WallCommon: { FireRating: { value: "60" } } },
    ...overrides,
  };
}

const CONDITIONS: ConditionDraft[] = [
  {
    id: "c1",
    kind: "property",
    propertySet: plainName("Pset_WallCommon"),
    name: plainName("FireRating"),
    ...stating("exists"),
  },
];

describe("FailingElementsTable", () => {
  it("names the element, the field that was checked and the value it actually had", () => {
    render(
      <FailingElementsTable
        failures={[{ element: element(), conditionIndex: 0 }]}
        conditions={CONDITIONS}
      />
    );

    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(within(row).getByText("g1")).toBeInTheDocument();
    expect(within(row).getByText("IFCWALL")).toBeInTheDocument();
    expect(within(row).getByText("Pset_WallCommon.FireRating")).toBeInTheDocument();
    expect(within(row).getByText("60")).toBeInTheDocument();
  });

  it("says so when the value is simply not there", () => {
    render(
      <FailingElementsTable
        failures={[{ element: element({ propertySets: {} }), conditionIndex: 0 }]}
        conditions={CONDITIONS}
      />
    );

    expect(screen.getByText("not set")).toBeInTheDocument();
  });

  it("says why a value that looks plausible was rejected", () => {
    render(
      <FailingElementsTable
        failures={[
          {
            element: element(),
            conditionIndex: 0,
            message: 'Property "FireRating" value "60" is not one of: 90, 120',
          },
        ]}
        conditions={CONDITIONS}
      />
    );

    // Without this the cell reads "60" and looks like a pass.
    expect(screen.getByText(/is not one of: 90, 120/)).toBeInTheDocument();
  });

  it("does not repeat the reason when the value is simply absent", () => {
    render(
      <FailingElementsTable
        failures={[
          {
            element: element({ propertySets: {} }),
            conditionIndex: 0,
            message: 'Property "FireRating" is missing in property set "Pset_WallCommon"',
          },
        ]}
        conditions={CONDITIONS}
      />
    );

    expect(screen.getByText("not set")).toBeInTheDocument();
    expect(screen.queryByText(/is missing in property set/)).not.toBeInTheDocument();
  });

  it("caps the rows it draws and says how many more there are", () => {
    const failures = Array.from({ length: 30 }, (_, index) => ({
      element: element({ globalId: `g${index}` }),
      conditionIndex: 0,
    }));

    render(<FailingElementsTable failures={failures} conditions={CONDITIONS} limit={12} />);

    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(13);
    expect(screen.getByText("+18 more")).toBeInTheDocument();
  });
});

describe("readConditionValue", () => {
  it("reads top-level attributes the same way facet evaluation does", () => {
    const attribute: ConditionDraft = { ...CONDITIONS[0], kind: "attribute", propertySet: null };

    const read = (name: string) =>
      readConditionValue(element(), { ...attribute, name: plainName(name) });

    expect(read("Name")).toEqual({ kind: "value", value: "Basic Wall" });
    expect(read("GlobalId")).toEqual({ kind: "value", value: "g1" });
    expect(read("tag")).toEqual({ kind: "value", value: "W-1" });
    expect(read("Missing")).toEqual({ kind: "value", value: null });
  });

  // A pattern names a set of fields, and the column shows one. Its own case, not `null`, which the
  // column already spells "not set" — the opposite claim about the element.
  it("reads no single slot for a name given as a pattern", () => {
    const attribute: ConditionDraft = { ...CONDITIONS[0], kind: "attribute", propertySet: null };

    expect(
      readConditionValue(element(), { ...attribute, name: { kind: "pattern", sources: [".*Name.*"] } })
    ).toEqual({ kind: "notOneSlot" });
  });
});
