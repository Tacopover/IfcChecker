import { describe, expect, it } from "vitest";
import { WebIfcAdapter } from "./web-ifc-adapter.js";
import { IfcLiteAdapter } from "./ifc-lite-adapter.js";
import { fixturePath } from "./fixture-path.js";

describe("adapter parity", () => {
  it("both engines normalize the fixture wall identically (parse timing aside)", async () => {
    const path = fixturePath("minimal-wall.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    expect(webIfcResult.elements).toHaveLength(1);
    expect(ifcLiteResult.elements).toHaveLength(1);

    const [a] = webIfcResult.elements;
    const [b] = ifcLiteResult.elements;

    expect(b.globalId).toBe(a.globalId);
    expect(b.ifcType).toBe(a.ifcType);
    expect(b.predefinedType).toBe(a.predefinedType);
    expect(b.name).toBe(a.name);
    expect(b.propertySets).toEqual(a.propertySets);
  });

  it("both engines build the same shape of project/site/building/storey tree", async () => {
    const path = fixturePath("minimal-wall.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    function shape(node: typeof webIfcResult.modelStructure): unknown {
      if (!node) return null;
      return { ifcType: node.ifcType, name: node.name, elementCounts: node.elementCounts, children: node.children.map(shape) };
    }

    expect(shape(ifcLiteResult.modelStructure)).toEqual(shape(webIfcResult.modelStructure));
  });

  it("both engines aggregate multiple storeys and multiple element types identically", async () => {
    const path = fixturePath("multi-storey.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    function shape(node: typeof webIfcResult.modelStructure): unknown {
      if (!node) return null;
      return { ifcType: node.ifcType, name: node.name, elementCounts: node.elementCounts, children: node.children.map(shape) };
    }

    const webIfcShape = shape(webIfcResult.modelStructure);
    expect(shape(ifcLiteResult.modelStructure)).toEqual(webIfcShape);

    const building = (webIfcResult.modelStructure?.children[0]?.children[0]) ?? null;
    expect(building?.children.map((storey) => storey.name)).toEqual(["Level 1", "Level 2"]);
    expect(building?.children[0].elementCounts).toEqual({ IFCWALL: 2, IFCDOOR: 1 });
    expect(building?.children[1].elementCounts).toEqual({ IFCWALL: 1 });
  });

  // Both engines now enumerate the model instead of iterating one shared list
  // of type names, so "they agree" is no longer true by construction — it has
  // to be asserted on a file with many concrete types in it.
  it("both engines produce the same elements, in the same order, for a full MEP model", async () => {
    const path = fixturePath("mep-systems.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    expect(ifcLiteResult.elements).toEqual(webIfcResult.elements);
    expect(ifcLiteResult.unrecognizedTypes).toEqual(webIfcResult.unrecognizedTypes);
    expect(webIfcResult.unrecognizedTypes).toEqual([]);
  });

  // The wider scope has to agree engine-for-engine too, or an IDS check would
  // give different answers depending on which parser the user picked — and the
  // conformance suite only ever exercises one of them.
  it("both engines produce the same IDS scope, in the same order", async () => {
    const path = fixturePath("mep-systems.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    expect(ifcLiteResult.idsScope).toEqual(webIfcResult.idsScope);
  });

  it("the IDS scope is a superset of the elements, and carries what a reviewer never sees", async () => {
    const path = fixturePath("mep-systems.ifc");

    for (const result of [
      await new WebIfcAdapter().parse(path),
      await new IfcLiteAdapter().parse(path),
    ]) {
      expect(result.idsScope.length).toBeGreaterThan(result.elements.length);
      // Identity, not deep equality: the element list is filtered out of the
      // scope, so the two must be the same objects in the same order.
      expect(result.idsScope.filter((entity) => result.elements.includes(entity))).toEqual(
        result.elements
      );

      const scopeTypes = new Set(result.idsScope.map((entity) => entity.ifcType));
      const elementTypes = new Set(result.elements.map((entity) => entity.ifcType));
      // The spatial backbone, the openings and the port: parsed for IDS,
      // deliberately absent from what the Validate page lists.
      for (const type of ["IFCPROJECT", "IFCBUILDINGSTOREY", "IFCOPENINGELEMENT", "IFCDISTRIBUTIONPORT"]) {
        expect(scopeTypes.has(type)).toBe(true);
        expect(elementTypes.has(type)).toBe(false);
      }
      // ...and geometry is in neither, which is what keeps the cost payable.
      expect(scopeTypes.has("IFCCARTESIANPOINT")).toBe(false);
    }
  });

  // The bag used to be three hand-picked names, so a rule against any other
  // attribute read as one the model was missing. Both engines have to carry the
  // same set, or the same rule set answers differently per engine.
  it("both engines carry every attribute the schema says holds a value", async () => {
    const path = fixturePath("mep-systems.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const storeyOf = (result: typeof webIfcResult) =>
      result.idsScope.find((entity) => entity.ifcType === "IFCBUILDINGSTOREY")?.attributes;

    // Elevation is a number and CompositionType an enum; neither survived the
    // old Tag/Description/ObjectType bag.
    expect(ifcLiteResult.idsScope.length).toBeGreaterThan(0);
    expect(storeyOf(ifcLiteResult)).toMatchObject({
      Elevation: { value: 0 },
      CompositionType: { value: "ELEMENT" },
    });
    expect(storeyOf(ifcLiteResult)).toEqual(storeyOf(webIfcResult));
  });

  // Both engines report the measure type the file stored, so `dataType` — the only thing that can
  // say whether a value is the type a specification asked for — is engine-independent.
  it("both engines report the same stored measure type for a single value", async () => {
    const path = fixturePath("multi-valued-properties.ifc");
    const wallOf = (result: { idsScope: Array<{ ifcType: string; propertySets: Record<string, Record<string, unknown>> }> }) =>
      result.idsScope.find((entity) => entity.ifcType === "IFCWALL")!.propertySets.Pset_Mixed;

    const fromWebIfc = wallOf(await new WebIfcAdapter().parse(path));
    const fromIfcLite = wallOf(await new IfcLiteAdapter().parse(path));

    expect(fromIfcLite.Thickness).toEqual({ value: 200, dataType: "IFCLENGTHMEASURE" });
    expect(fromWebIfc.Thickness).toEqual(fromIfcLite.Thickness);
  });

  // The known, deliberate gap (see bug-web-ifc-property-subtypes): web-ifc reads only
  // IfcPropertySingleValue, so the other four subtypes arrive absent on that engine while ifc-lite
  // carries the candidates behind them. Stated here so it fails loudly when the port lands, rather
  // than being rediscovered from a conformance score that moves on one engine only.
  it("only ifc-lite carries the candidates of a multi-valued property", async () => {
    const path = fixturePath("multi-valued-properties.ifc");
    const wallOf = (result: { idsScope: Array<{ ifcType: string; propertySets: Record<string, Record<string, { value: unknown; values?: unknown[] }>> }> }) =>
      result.idsScope.find((entity) => entity.ifcType === "IFCWALL")!.propertySets.Pset_Mixed;

    const fromWebIfc = wallOf(await new WebIfcAdapter().parse(path));
    const fromIfcLite = wallOf(await new IfcLiteAdapter().parse(path));

    // Candidates arrive as the literals the file wrote, not as parsed numbers — ifc-lite types
    // them `string[]`. Carried through verbatim: the value a specification states is a literal
    // too, so casting is the comparison's job and doing it here would guess at a type twice.
    expect(fromIfcLite.DesignHeight.values).toEqual(["1000", "5000", "3000"]);
    expect(fromIfcLite.Finishes.values).toEqual(["Painted", "Plastered"]);
    expect(fromIfcLite.Status.values).toEqual(["EXISTING", "DEMOLISH"]);
    expect(fromIfcLite.LoadCurve.values).toEqual(["Span", "1000"]);

    for (const name of ["DesignHeight", "Finishes", "Status", "LoadCurve"]) {
      expect(fromWebIfc[name]).toEqual({ value: null });
    }
  });

  // IDS separates a Name the model does not state from one it states as empty: the first
  // satisfies an optional requirement and the second fails it. ifc-lite folded both into null
  // while web-ifc kept them apart, and no fixture had an empty name to catch it.
  it("both engines keep an empty name distinct from an absent one", async () => {
    const path = fixturePath("multi-valued-properties.ifc");
    const namesOf = (result: { idsScope: Array<{ globalId: string; name: string | null }> }) =>
      Object.fromEntries(result.idsScope.map((entity) => [entity.globalId, entity.name]));

    const fromWebIfc = namesOf(await new WebIfcAdapter().parse(path));
    const fromIfcLite = namesOf(await new IfcLiteAdapter().parse(path));

    expect(fromIfcLite["7dV2S4BK15Pc0wRQxBkYZ0"]).toBe("W-MV");
    expect(fromIfcLite["8eW3T5CL26Qd1xSRyClZa1"]).toBe("");
    expect(fromIfcLite["9fX4U6DM37Re2ySSzDma22"]).toBeNull();
    for (const globalId of [
      "7dV2S4BK15Pc0wRQxBkYZ0",
      "8eW3T5CL26Qd1xSRyClZa1",
      "9fX4U6DM37Re2ySSzDma22",
    ]) {
      expect(fromWebIfc[globalId]).toBe(fromIfcLite[globalId]);
    }
  });

  // Both parsers hand a reference back as a bare number, so carrying one would
  // let a rule compare against an express id and quietly pass.
  it("neither engine carries a reference-valued attribute", async () => {
    const path = fixturePath("mep-systems.ifc");

    for (const result of [
      await new WebIfcAdapter().parse(path),
      await new IfcLiteAdapter().parse(path),
    ]) {
      const relationship = result.idsScope.find((entity) => entity.ifcType === "IFCRELAGGREGATES");
      expect(relationship).toBeDefined();
      expect(relationship!.attributes).not.toHaveProperty("RelatingObject");
      expect(relationship!.attributes).not.toHaveProperty("RelatedObjects");

      const propertySet = result.idsScope.find((entity) => entity.ifcType === "IFCPROPERTYSET");
      expect(propertySet!.attributes).not.toHaveProperty("HasProperties");
    }
  });

  // The wider bag must not disturb what a reviewer sees: IfcWall declares no
  // simple attribute beyond the three, so its elements are byte-identical.
  it("leaves a wall's attributes exactly as they were", async () => {
    const { elements } = await new IfcLiteAdapter().parse(fixturePath("mep-systems.ifc"));
    const wall = elements.find((element) => element.ifcType === "IFCWALL");

    expect(Object.keys(wall!.attributes).sort()).toEqual(["Description", "ObjectType", "Tag"]);
  });

  it("both engines give a non-rooted entity the same synthetic identity", async () => {
    const path = fixturePath("mep-systems.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const synthetic = (result: typeof webIfcResult) =>
      result.idsScope.filter((entity) => entity.globalId.startsWith("#"));

    // IfcMaterial, IfcPerson and the presentation resources have no GlobalId
    // attribute at all; the STEP line number stands in, and both engines read
    // it from the same file.
    expect(synthetic(ifcLiteResult).length).toBeGreaterThan(0);
    expect(synthetic(ifcLiteResult)).toEqual(synthetic(webIfcResult));
  });

  it("both engines agree on the per-storey counts of a full MEP model", async () => {
    const path = fixturePath("mep-systems.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    // IFCSPACE aside, which the two engines place differently for reasons that
    // predate this filter — see the next test.
    const countsByStorey = (result: typeof webIfcResult) =>
      (result.modelStructure?.children[0]?.children[0]?.children ?? []).map((storey) => [
        storey.name,
        Object.fromEntries(Object.entries(storey.elementCounts).filter(([type]) => type !== "IFCSPACE")),
      ]);

    expect(countsByStorey(ifcLiteResult)).toEqual(countsByStorey(webIfcResult));
    expect(countsByStorey(webIfcResult)).toEqual([
      // The two openings and the port contained in Level 1 are not elements, so
      // they never reach a count.
      [
        "Level 1",
        {
          IFCACTUATOR: 1,
          IFCAIRTERMINAL: 2,
          IFCDAMPER: 1,
          IFCDOOR: 1,
          IFCDUCTFITTING: 2,
          IFCDUCTSEGMENT: 2,
          IFCSANITARYTERMINAL: 1,
          IFCSENSOR: 1,
        },
      ],
      ["Plant Level", { IFCPIPEFITTING: 1, IFCPIPESEGMENT: 2, IFCPUMP: 1, IFCVALVE: 2, IFCWALL: 2 }],
    ]);
  });

  // Pre-existing engine divergence, unrelated to which elements are collected:
  // @ifc-lite/parser's spatialHierarchy promotes an IfcSpace to a node of the
  // tree, while web-ifc-buffer walks only Project/Site/Building/Storey and so
  // leaves the space in its storey's counts. Pinned rather than hidden — the
  // element lists themselves agree exactly (asserted above).
  it("differs only in where an IfcSpace lands in the model structure", async () => {
    const path = fixturePath("mep-systems.ifc");
    const plantLevel = (result: { modelStructure: unknown }) =>
      (result.modelStructure as { children: any[] }).children[0].children[0].children[1];

    const fromWebIfc = plantLevel(await new WebIfcAdapter().parse(path));
    const fromIfcLite = plantLevel(await new IfcLiteAdapter().parse(path));

    expect(fromWebIfc.children).toEqual([]);
    expect(fromWebIfc.elementCounts.IFCSPACE).toBe(1);

    expect(fromIfcLite.children.map((child: { ifcType: string }) => child.ifcType)).toEqual(["IFCSPACE"]);
    expect(fromIfcLite.elementCounts.IFCSPACE).toBeUndefined();
  });

  it("both engines walk the same partOf chains, and keep nesting distinct from aggregation", async () => {
    const path = fixturePath("part-of-relations.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const wholesOf = (result: typeof webIfcResult, name: string) =>
      (result.idsScope.find((entity) => entity.name === name)?.partOf ?? [])
        .map((whole) => `${whole.relation}:${whole.ifcType}:${whole.predefinedType ?? "-"}`)
        .sort();

    // Two levels of aggregation: the ancestral whole counts as well as the direct one.
    expect(wholesOf(ifcLiteResult, "PL-001")).toEqual([
      "IFCRELAGGREGATES:IFCELEMENTASSEMBLY:ACCESSORY_ASSEMBLY",
      "IFCRELAGGREGATES:IFCELEMENTASSEMBLY:NOTDEFINED",
    ]);

    // Nesting must never surface as aggregation — ifc-lite's graph files both under one edge
    // type, so reading the edge instead of the relationship entity would report AGGREGATES here.
    expect(wholesOf(ifcLiteResult, "Bolt")).toEqual([
      "IFCRELNESTS:IFCDISCRETEACCESSORY:NOTDEFINED",
      "IFCRELNESTS:IFCFURNITURE:NOTDEFINED",
    ]);

    // The beam is contained in a space that is aggregated into the storey. The chain may not
    // change relation halfway, so the storey is not among its wholes.
    expect(wholesOf(ifcLiteResult, "B-001")).toEqual([
      "IFCRELASSIGNSTOGROUP:IFCGROUP:-",
      "IFCRELCONTAINEDINSPATIALSTRUCTURE:IFCSPACE:INTERNAL",
    ]);

    expect(wholesOf(ifcLiteResult, "OP-001")).toEqual(["IFCRELVOIDSELEMENT:IFCWALL:STANDARD"]);
    expect(wholesOf(ifcLiteResult, "D-001")).toEqual([
      "IFCRELFILLSELEMENT:IFCOPENINGELEMENT:OPENING",
    ]);

    for (const name of ["PL-001", "Bolt", "B-001", "OP-001", "D-001", "Outer assembly"]) {
      expect([name, wholesOf(webIfcResult, name)]).toEqual([name, wholesOf(ifcLiteResult, name)]);
    }
  });

  // IFC states a user-defined predefined type under three different attribute names, one per
  // branch of the hierarchy: ObjectType on an occurrence, ElementType on an element type,
  // ProcessType on a type process. Missing one reads as the literal "USERDEFINED", which is not
  // what any rule compares against.
  it("both engines resolve a user-defined predefined type from all three fields", async () => {
    const path = fixturePath("predefined-types.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const byName = (result: typeof webIfcResult) =>
      Object.fromEntries(
        result.idsScope
          .filter((entity) => entity.name !== null)
          .map((entity) => [entity.name, entity.predefinedType])
      );

    const fromIfcLite = byName(ifcLiteResult);
    expect(fromIfcLite["W-PLAIN"]).toBe("SOLIDWALL");
    expect(fromIfcLite["W-OBJECTTYPE"]).toBe("WALDO");
    expect(fromIfcLite["Standalone Wall Type"]).toBe("WALDO");
    expect(fromIfcLite["Task Type"]).toBe("TASKY");

    expect(byName(webIfcResult)).toEqual(fromIfcLite);
  });

  // A rule may name either string, so both engines have to keep both. Carrying the literal on an
  // element that never said USERDEFINED would be a second value nothing can match.
  it("both engines keep the stored enumeration only where it differs from the resolved name", async () => {
    const path = fixturePath("predefined-types.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const byName = (result: typeof webIfcResult) =>
      Object.fromEntries(
        result.idsScope
          .filter((entity) => entity.name !== null)
          .map((entity) => [entity.name, entity.storedPredefinedType ?? null])
      );

    const fromIfcLite = byName(ifcLiteResult);
    expect(fromIfcLite["W-OBJECTTYPE"]).toBe("USERDEFINED");
    expect(fromIfcLite["Task Type"]).toBe("USERDEFINED");
    expect(fromIfcLite["W-PLAIN"]).toBeNull();

    expect(byName(webIfcResult)).toEqual(fromIfcLite);
  });

  // The type object is consulted first and the occurrence only where the type defines nothing.
  // NOTDEFINED on a type defines nothing, so it must not overwrite what the occurrence states.
  it("both engines inherit a predefined type from the type object, and let NOTDEFINED fall through", async () => {
    const path = fixturePath("predefined-types.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const byName = (result: typeof webIfcResult) =>
      Object.fromEntries(
        result.idsScope
          .filter((entity) => entity.name !== null)
          .map((entity) => [
            entity.name,
            `${entity.predefinedType}/${entity.storedPredefinedType ?? "-"}`,
          ])
      );

    const fromIfcLite = byName(ifcLiteResult);
    // W-INHERITED states none of its own; the type says USERDEFINED with an ElementType of X.
    expect(fromIfcLite["W-INHERITED"]).toBe("X/USERDEFINED");
    // W-OVERRIDDEN states USERDEFINED with an ObjectType of Y; the type says NOTDEFINED.
    expect(fromIfcLite["W-OVERRIDDEN"]).toBe("Y/USERDEFINED");

    expect(byName(webIfcResult)).toEqual(fromIfcLite);
  });

  it("both engines flatten every material shape to the same matchable strings", async () => {
    const path = fixturePath("material-shapes.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const byType = (result: typeof webIfcResult) =>
      Object.fromEntries(
        result.idsScope.map((entity) => [
          entity.ifcType,
          entity.materials ? [...entity.materials].sort() : entity.materials,
        ])
      );

    const fromWebIfc = byType(webIfcResult);
    const fromIfcLite = byType(ifcLiteResult);

    // A layer set contributes its own LayerSetName, each layer's name and category, and the
    // name and category of the IfcMaterial behind each layer. IDS matches any of them.
    expect(fromIfcLite.IFCWALL).toEqual(
      ["CavityWall", "CoreLayer", "LoadBearing", "Concrete", "Structural", "InsulationLayer", "Thermal", "Insulation"].sort()
    );
    expect(fromIfcLite.IFCBEAM).toEqual(["BeamProfiles", "IPE300Profile", "Rolled", "Steel", "Structural"].sort());
    expect(fromIfcLite.IFCSLAB).toEqual(["SlabMix", "Reinforcement", "Rebar", "Steel", "Structural"].sort());
    expect(fromIfcLite.IFCCOLUMN).toEqual(["Concrete", "Structural", "Steel"].sort());
    // Inherited from its IfcMemberType, which holds the only association.
    expect(fromIfcLite.IFCMEMBER).toEqual(["Steel", "Structural"].sort());
    // No association at all — distinct from one that names nothing, and the difference decides
    // whether an empty material facet passes.
    expect(fromIfcLite.IFCPLATE).toBeNull();

    for (const ifcType of ["IFCWALL", "IFCBEAM", "IFCSLAB", "IFCCOLUMN", "IFCMEMBER", "IFCPLATE"]) {
      expect([ifcType, fromWebIfc[ifcType]]).toEqual([ifcType, fromIfcLite[ifcType]]);
    }
  });

  it("both engines resolve the same classification references, chain and all", async () => {
    const path = fixturePath("classified-elements.ifc");
    const webIfcResult = await new WebIfcAdapter().parse(path);
    const ifcLiteResult = await new IfcLiteAdapter().parse(path);

    const byType = (result: typeof webIfcResult) =>
      Object.fromEntries(
        result.idsScope
          .filter((entity) => ["IFCWALL", "IFCSLAB", "IFCBEAM"].includes(entity.ifcType))
          .map((entity) => [entity.ifcType, entity.classifications ?? []])
      );
    const bySystem = (references: { system: string | null }[]) =>
      [...references].sort((a, b) => (a.system ?? "").localeCompare(b.system ?? ""));

    const fromWebIfc = byType(webIfcResult);
    const fromIfcLite = byType(ifcLiteResult);

    // The wall's reference is nested one deep, so its system is only reachable by walking
    // ReferencedSource — and the parent code has to survive alongside the leaf, which is what
    // lets a rule naming EF_25 match an element classified EF_25_10.
    expect(fromIfcLite.IFCWALL).toEqual([
      { system: "Uniclass 2015", identifications: ["EF_25_10", "EF_25"] },
    ]);
    expect(fromWebIfc.IFCWALL).toEqual(fromIfcLite.IFCWALL);

    // Classified through its IfcSlabType, plus a second system of its own: an adapter reading
    // occurrence associations alone would report only one of the two.
    expect(bySystem(fromIfcLite.IFCSLAB).map((reference) => reference.system)).toEqual([
      "NL/SfB",
      "Uniclass 2015",
    ]);
    expect(bySystem(fromWebIfc.IFCSLAB)).toEqual(bySystem(fromIfcLite.IFCSLAB));

    expect(fromIfcLite.IFCBEAM).toEqual([]);
    expect(fromWebIfc.IFCBEAM).toEqual([]);
  });
});

// Unit conversion is the one place a parser disagreement becomes a *false pass*: IDS states a
// length in metres, so a millimetre model that reports no scaling has every numeric property check
// compared 1000x wrong and in the approving direction. Both engines must agree, and both fixtures
// below declare .MILLI. .METRE. like every real Dutch model does.
describe("adapter parity — unit scales", () => {

  it("both engines resolve the same SI scale for a millimetre model", async () => {
    for (const fixture of ["minimal-wall.ifc", "multi-valued-properties.ifc"]) {
      const path = fixturePath(fixture);
      const fromWebIfc = (await new WebIfcAdapter().parse(path)).unitScales;
      const fromIfcLite = (await new IfcLiteAdapter().parse(path)).unitScales;

      expect(fromIfcLite).toEqual(fromWebIfc);
    }
  });

  it("a length measure in a millimetre model scales by 1e-3", async () => {
    const path = fixturePath("multi-valued-properties.ifc");
    const fromIfcLite = (await new IfcLiteAdapter().parse(path)).unitScales;
    const fromWebIfc = (await new WebIfcAdapter().parse(path)).unitScales;

    expect(fromIfcLite.IFCLENGTHMEASURE).toBeCloseTo(1e-3, 12);
    expect(fromWebIfc.IFCLENGTHMEASURE).toBeCloseTo(1e-3, 12);
  });

  // Only measures that actually rescale are listed, so a map with no entry for a measure means
  // "already SI" rather than "not looked at" — the two must not be confused at the read site.
  it("records nothing for a measure the file states in SI", async () => {
    const path = fixturePath("multi-valued-properties.ifc");
    const { unitScales } = await new IfcLiteAdapter().parse(path);

    expect(Object.values(unitScales).every((scale) => scale !== 1)).toBe(true);
  });
});
