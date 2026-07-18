# IFC QA Tool — 02: IDS Validator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@ifc-qa/ids-validator`, a pure, engine-agnostic function that evaluates buildingSMART IDS XML rule sets against already-normalized IFC element data and returns a flat list of violations.

**Architecture:** A three-layer pipeline inside one small package: (1) `parse-ids.ts` uses `fast-xml-parser` to turn IDS XML text into a plain, typed intermediate representation (`ParsedSpecification[]`), forcing array parsing on every repeatable element so single-occurrence documents behave identically to multi-occurrence ones; (2) `facet-evaluation.ts` holds pure predicate/check functions that compare one `NormalizedElement` against one parsed applicability or requirement facet; (3) `validate-elements.ts` is the public entry point — it cross-products every element against every specification's applicability, runs the matching specifications' requirements, and collects failures into `IdsViolation[]`. No I/O happens inside the package: the caller (worker-service, sub-plan 05) is responsible for reading the IDS file and the parsed elements off disk/DB before calling in.

**Tech Stack:** TypeScript 5, Vitest, `fast-xml-parser` (`^5.10.1`), `@ifc-qa/shared-types` (workspace).

## Dependency Notes for Orchestration

This plan depends only on sub-plan 00 (foundation) — it needs `NormalizedElement` and `Severity` from `@ifc-qa/shared-types` and nothing else. It runs fully in parallel with sub-plans 01 (parser-adapters), 03, 04, and 06. Sub-plan 05 (worker-service) depends on this plan's `validateElements` function existing before final integration (sub-plan 07), but can test its own code against a fake `validateElements` in the meantime.

## Global Constraints

- Package scope: `@ifc-qa/*`. This package is `@ifc-qa/ids-validator`.
- Node.js >= 20, pnpm >= 9 (per root `package.json`'s `engines`/`packageManager`, already fixed in sub-plan 00 — do not redeclare).
- `validateElements` is a **pure function**: no file I/O, no network calls. It receives the IDS XML as a string and the elements as an already-parsed array; the worker-service sub-plan owns reading both off disk/DB.
- v1 facet scope is intentionally narrow: `<applicability>` supports only `<entity><name><simpleValue>` (matched against `NormalizedElement.ifcType`, case-insensitive). `<requirements>` supports only `<attribute>` (presence check, plus an optional `<value><xs:restriction base="xs:string"><xs:pattern value="..."/></xs:restriction></value>` for a full-string regex match) and `<property>` (`dataType`, `propertySet`, `baseName` — presence check only, no value restriction in v1). Any other facet kind (`classification`, `material`, `partOf`, or anything else) must be **skipped with a `console.warn`, never thrown**.
- Every violated requirement gets `severity: "error"` in v1 — the IDS spec's own severity/cardinality concepts beyond "required" are out of scope.
- `ruleId` on every `IdsViolation` is the specification's `name` attribute, verbatim.
- No XSD schema validation of the IDS document itself in v1 — malformed/non-conformant IDS XML is out of scope beyond "don't crash on an unrecognized facet."
- No IFC-version-based specification filtering in v1 — the `ifcVersion` attribute on `<specification>` is not read; every specification is evaluated against every element regardless of source schema version (`NormalizedElement` doesn't carry a schema-version field to filter on).
- No clash/geometry checks, no custom IDS-authoring support — naming/parameter compliance evaluation only (per the design spec's non-goals).

---

### Task 1: Package scaffold + IDS XML parsing layer

**Files:**
- Create: `packages/ids-validator/package.json`
- Create: `packages/ids-validator/tsconfig.json`
- Create: `packages/ids-validator/vitest.config.ts`
- Create: `packages/ids-validator/src/parse-ids.ts`
- Create: `packages/ids-validator/src/index.ts`
- Test: `packages/ids-validator/src/parse-ids.test.ts`

**Interfaces:**
- Consumes: nothing from other sub-plans yet — this task's only external dependency is `fast-xml-parser`.
- Produces: `parseIdsXml(idsXml: string): ParsedSpecification[]`, and the exported types `ParsedSpecification`, `ParsedRequirementFacet`, `ParsedAttributeFacet`, `ParsedPropertyFacet` — Task 2 (`facet-evaluation.ts`) and Task 3 (`validate-elements.ts`) both consume these exact shapes.

- [ ] **Step 1: Write `packages/ids-validator/package.json`**

```json
{
  "name": "@ifc-qa/ids-validator",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@ifc-qa/shared-types": "workspace:*",
    "fast-xml-parser": "^5.10.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `packages/ids-validator/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `packages/ids-validator/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `pnpm install` (from repo root)
Expected: exits 0; resolves `fast-xml-parser` and links `@ifc-qa/shared-types` as a workspace dependency into `packages/ids-validator/node_modules`.

- [ ] **Step 5: Write the failing test**

```typescript
// packages/ids-validator/src/parse-ids.test.ts
import { describe, expect, it, vi } from "vitest";
import { parseIdsXml } from "./parse-ids";

const SAMPLE_IDS = `<?xml version="1.0" encoding="utf-8"?>
<ids xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd" xmlns="http://standards.buildingsmart.org/IDS">
  <info>
    <title>Sample</title>
  </info>
  <specifications>
    <specification name="Wall naming and fire rating" ifcVersion="IFC2X3 IFC4">
      <applicability maxOccurs="unbounded">
        <entity>
          <name><simpleValue>IFCWALL</simpleValue></name>
        </entity>
      </applicability>
      <requirements>
        <attribute>
          <name><simpleValue>Name</simpleValue></name>
          <value>
            <xs:restriction base="xs:string">
              <xs:pattern value="W-\\d+" />
            </xs:restriction>
          </value>
        </attribute>
        <property dataType="IFCLABEL">
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>FireRating</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

describe("parseIdsXml", () => {
  it("extracts a specification's name, applicability, and requirement facets from a single-occurrence document", () => {
    const specifications = parseIdsXml(SAMPLE_IDS);

    expect(specifications).toHaveLength(1);
    const [spec] = specifications;
    expect(spec.name).toBe("Wall naming and fire rating");
    expect(spec.applicabilityEntityNames).toEqual(["IFCWALL"]);
    expect(spec.requirements).toEqual([
      {
        kind: "attribute",
        name: "Name",
        patternSource: "W-\\d+",
        pattern: expect.any(RegExp),
      },
      {
        kind: "property",
        propertySet: "Pset_WallCommon",
        baseName: "FireRating",
        dataType: "IFCLABEL",
      },
    ]);
  });

  it("skips an unrecognized requirement facet and logs a warning instead of throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const xmlWithClassification = SAMPLE_IDS.replace(
      "</requirements>",
      "<classification><value><simpleValue>Foo</simpleValue></value></classification></requirements>"
    );

    const specifications = parseIdsXml(xmlWithClassification);

    expect(specifications[0].requirements).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unsupported requirement facet "<classification>"')
    );
    warnSpy.mockRestore();
  });

  it("skips an unrecognized applicability facet and logs a warning instead of throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const xmlWithMaterial = SAMPLE_IDS.replace(
      "</applicability>",
      "<material><value><simpleValue>Concrete</simpleValue></value></material></applicability>"
    );

    const specifications = parseIdsXml(xmlWithMaterial);

    expect(specifications[0].applicabilityEntityNames).toEqual(["IFCWALL"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unsupported applicability facet "<material>"')
    );
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: FAIL — `Cannot find module './parse-ids'`

- [ ] **Step 7: Write `packages/ids-validator/src/parse-ids.ts`**

```typescript
import { XMLParser } from "fast-xml-parser";

export interface ParsedAttributeFacet {
  kind: "attribute";
  name: string;
  patternSource: string | null;
  pattern: RegExp | null;
}

export interface ParsedPropertyFacet {
  kind: "property";
  propertySet: string;
  baseName: string;
  dataType: string | null;
}

export type ParsedRequirementFacet = ParsedAttributeFacet | ParsedPropertyFacet;

export interface ParsedSpecification {
  name: string;
  applicabilityEntityNames: string[];
  requirements: ParsedRequirementFacet[];
}

interface RawSimpleValueContainer {
  simpleValue?: string | number | boolean;
}

interface RawEntityFacet {
  name?: RawSimpleValueContainer;
}

interface RawApplicability {
  entity?: RawEntityFacet[];
  [otherFacet: string]: unknown;
}

interface RawAttributeFacet {
  name?: RawSimpleValueContainer;
  value?: {
    restriction?: {
      pattern?: { "@_value"?: string };
    };
  };
}

interface RawPropertyFacet {
  "@_dataType"?: string;
  propertySet?: RawSimpleValueContainer;
  baseName?: RawSimpleValueContainer;
}

interface RawRequirements {
  attribute?: RawAttributeFacet[];
  property?: RawPropertyFacet[];
  [otherFacet: string]: unknown;
}

interface RawSpecification {
  "@_name": string;
  applicability?: RawApplicability;
  requirements?: RawRequirements;
}

interface RawIdsDocument {
  ids?: {
    specifications?: {
      specification?: RawSpecification[];
    };
  };
}

const FORCE_ARRAY_PATHS = new Set([
  "ids.specifications.specification",
  "ids.specifications.specification.applicability.entity",
  "ids.specifications.specification.requirements.attribute",
  "ids.specifications.specification.requirements.property",
]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: true,
  isArray: (_tagName, jPath) => FORCE_ARRAY_PATHS.has(jPath as string),
});

function readSimpleValue(node: RawSimpleValueContainer | undefined): string | null {
  if (!node || node.simpleValue === undefined || node.simpleValue === null) {
    return null;
  }
  return String(node.simpleValue);
}

export function parseIdsXml(idsXml: string): ParsedSpecification[] {
  const document = xmlParser.parse(idsXml) as RawIdsDocument;
  const rawSpecifications = document.ids?.specifications?.specification ?? [];

  return rawSpecifications.map((rawSpec) => parseSpecification(rawSpec));
}

function parseSpecification(rawSpec: RawSpecification): ParsedSpecification {
  const name = rawSpec["@_name"];
  const rawApplicability = rawSpec.applicability ?? {};
  const applicabilityEntityNames = (rawApplicability.entity ?? [])
    .map((entity) => readSimpleValue(entity.name))
    .filter((value): value is string => value !== null);

  for (const key of Object.keys(rawApplicability)) {
    if (key !== "entity" && !key.startsWith("@_")) {
      console.warn(
        `ids-validator: skipping unsupported applicability facet "<${key}>" in specification "${name}"`
      );
    }
  }

  const rawRequirements = rawSpec.requirements ?? {};
  const requirements: ParsedRequirementFacet[] = [
    ...parseAttributeFacets(rawRequirements.attribute ?? []),
    ...parsePropertyFacets(rawRequirements.property ?? []),
  ];

  for (const key of Object.keys(rawRequirements)) {
    if (key !== "attribute" && key !== "property" && !key.startsWith("@_")) {
      console.warn(
        `ids-validator: skipping unsupported requirement facet "<${key}>" in specification "${name}"`
      );
    }
  }

  return { name, applicabilityEntityNames, requirements };
}

function parseAttributeFacets(rawAttributes: RawAttributeFacet[]): ParsedAttributeFacet[] {
  const facets: ParsedAttributeFacet[] = [];
  for (const rawAttribute of rawAttributes) {
    const name = readSimpleValue(rawAttribute.name);
    if (name === null) continue;
    const patternSource = rawAttribute.value?.restriction?.pattern?.["@_value"] ?? null;
    facets.push({
      kind: "attribute",
      name,
      patternSource,
      pattern: patternSource ? new RegExp(`^(?:${patternSource})$`) : null,
    });
  }
  return facets;
}

function parsePropertyFacets(rawProperties: RawPropertyFacet[]): ParsedPropertyFacet[] {
  const facets: ParsedPropertyFacet[] = [];
  for (const rawProperty of rawProperties) {
    const propertySet = readSimpleValue(rawProperty.propertySet);
    const baseName = readSimpleValue(rawProperty.baseName);
    if (propertySet === null || baseName === null) continue;
    facets.push({
      kind: "property",
      propertySet,
      baseName,
      dataType: rawProperty["@_dataType"] ?? null,
    });
  }
  return facets;
}
```

- [ ] **Step 8: Write `packages/ids-validator/src/index.ts`**

```typescript
export * from "./parse-ids";
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: PASS (3 tests)

- [ ] **Step 10: Commit**

```bash
git add packages/ids-validator
git commit -m "feat(ids-validator): scaffold package and add IDS XML parsing layer"
```

---

### Task 2: Facet evaluation

**Files:**
- Create: `packages/ids-validator/src/facet-evaluation.ts`
- Modify: `packages/ids-validator/src/index.ts`
- Test: `packages/ids-validator/src/facet-evaluation.test.ts`

**Interfaces:**
- Consumes: `ParsedRequirementFacet`, `ParsedAttributeFacet`, `ParsedPropertyFacet` (Task 1, `./parse-ids`); `NormalizedElement`, `PropertyValue` (`@ifc-qa/shared-types`, sub-plan 00).
- Produces: `matchesApplicability(element: NormalizedElement, entityNames: string[]): boolean`, `evaluateRequirement(element: NormalizedElement, facet: ParsedRequirementFacet): FacetCheckResult`, and the `FacetCheckResult` type (`{ passed: boolean; message: string }`) — Task 3 (`validate-elements.ts`) consumes both functions verbatim.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/ids-validator/src/facet-evaluation.test.ts
import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { matchesApplicability, evaluateRequirement } from "./facet-evaluation";
import type { ParsedAttributeFacet, ParsedPropertyFacet } from "./parse-ids";

function makeElement(overrides: Partial<NormalizedElement>): NormalizedElement {
  return {
    globalId: "g1",
    ifcType: "IFCWALL",
    predefinedType: null,
    name: null,
    attributes: {},
    propertySets: {},
    ...overrides,
  };
}

describe("matchesApplicability", () => {
  it("matches case-insensitively", () => {
    expect(matchesApplicability(makeElement({ ifcType: "IfcWall" }), ["IFCWALL"])).toBe(true);
  });

  it("returns false when no entity name matches", () => {
    expect(matchesApplicability(makeElement({ ifcType: "IFCDOOR" }), ["IFCWALL"])).toBe(false);
  });
});

describe("evaluateRequirement — attribute facet", () => {
  const patternFacet: ParsedAttributeFacet = {
    kind: "attribute",
    name: "Name",
    patternSource: "W-\\d+",
    pattern: /^(?:W-\d+)$/,
  };

  it("passes when the top-level Name attribute matches the pattern", () => {
    const result = evaluateRequirement(makeElement({ name: "W-001" }), patternFacet);
    expect(result).toEqual({ passed: true, message: "" });
  });

  it("fails when the top-level Name attribute does not match the pattern", () => {
    const result = evaluateRequirement(makeElement({ name: "West Wall" }), patternFacet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Name");
  });

  it("fails when the attribute is missing entirely", () => {
    const presenceFacet: ParsedAttributeFacet = {
      kind: "attribute",
      name: "Tag",
      patternSource: null,
      pattern: null,
    };
    const result = evaluateRequirement(makeElement({ attributes: {} }), presenceFacet);
    expect(result).toEqual({ passed: false, message: 'Attribute "Tag" is missing' });
  });

  it("falls back to the attributes bag for non-top-level attribute names", () => {
    const presenceFacet: ParsedAttributeFacet = {
      kind: "attribute",
      name: "Tag",
      patternSource: null,
      pattern: null,
    };
    const result = evaluateRequirement(makeElement({ attributes: { Tag: "W-001" } }), presenceFacet);
    expect(result).toEqual({ passed: true, message: "" });
  });
});

describe("evaluateRequirement — property facet", () => {
  const propertyFacet: ParsedPropertyFacet = {
    kind: "property",
    propertySet: "Pset_WallCommon",
    baseName: "FireRating",
    dataType: "IFCLABEL",
  };

  it("passes when the property set and base name are present", () => {
    const element = makeElement({ propertySets: { Pset_WallCommon: { FireRating: "REI60" } } });
    expect(evaluateRequirement(element, propertyFacet)).toEqual({ passed: true, message: "" });
  });

  it("fails when the property set is missing entirely", () => {
    const element = makeElement({ propertySets: {} });
    const result = evaluateRequirement(element, propertyFacet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Pset_WallCommon");
  });

  it("fails when the property set exists but the base name is missing", () => {
    const element = makeElement({ propertySets: { Pset_WallCommon: {} } });
    const result = evaluateRequirement(element, propertyFacet);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("FireRating");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: FAIL — `Cannot find module './facet-evaluation'`

- [ ] **Step 3: Write `packages/ids-validator/src/facet-evaluation.ts`**

```typescript
import type { NormalizedElement, PropertyValue } from "@ifc-qa/shared-types";
import type { ParsedRequirementFacet } from "./parse-ids";

export interface FacetCheckResult {
  passed: boolean;
  message: string;
}

const TOP_LEVEL_ATTRIBUTE_READERS: Record<string, (element: NormalizedElement) => PropertyValue | null> = {
  GLOBALID: (element) => element.globalId,
  NAME: (element) => element.name,
  PREDEFINEDTYPE: (element) => element.predefinedType,
};

export function matchesApplicability(element: NormalizedElement, entityNames: string[]): boolean {
  return entityNames.some((entityName) => entityName.toUpperCase() === element.ifcType.toUpperCase());
}

function readAttributeValue(element: NormalizedElement, attributeName: string): PropertyValue | null {
  const topLevelReader = TOP_LEVEL_ATTRIBUTE_READERS[attributeName.toUpperCase()];
  if (topLevelReader) return topLevelReader(element);
  return attributeName in element.attributes ? element.attributes[attributeName] : null;
}

export function evaluateRequirement(
  element: NormalizedElement,
  facet: ParsedRequirementFacet
): FacetCheckResult {
  if (facet.kind === "attribute") {
    const value = readAttributeValue(element, facet.name);
    if (value === null) {
      return { passed: false, message: `Attribute "${facet.name}" is missing` };
    }
    if (facet.pattern && !facet.pattern.test(String(value))) {
      return {
        passed: false,
        message: `Attribute "${facet.name}" value "${String(value)}" does not match required pattern "${facet.patternSource}"`,
      };
    }
    return { passed: true, message: "" };
  }

  const propertySet = element.propertySets[facet.propertySet];
  const value = propertySet ? propertySet[facet.baseName] : undefined;
  if (value === undefined || value === null) {
    return {
      passed: false,
      message: `Property "${facet.baseName}" is missing in property set "${facet.propertySet}"`,
    };
  }
  return { passed: true, message: "" };
}
```

- [ ] **Step 4: Add the export to `packages/ids-validator/src/index.ts`**

```typescript
export * from "./parse-ids";
export * from "./facet-evaluation";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: PASS (12 tests total)

- [ ] **Step 6: Commit**

```bash
git add packages/ids-validator
git commit -m "feat(ids-validator): add applicability and requirement facet evaluation"
```

---

### Task 3: `validateElements` — the public entry point

**Files:**
- Create: `packages/ids-validator/src/validate-elements.ts`
- Modify: `packages/ids-validator/src/index.ts`
- Test: `packages/ids-validator/src/validate-elements.test.ts`

**Interfaces:**
- Consumes: `parseIdsXml` (Task 1, `./parse-ids`); `matchesApplicability`, `evaluateRequirement` (Task 2, `./facet-evaluation`); `NormalizedElement`, `Severity` (`@ifc-qa/shared-types`, sub-plan 00).
- Produces: `IdsViolation` interface (`{ elementGlobalId: string; elementType: string; ruleId: string; severity: Severity; message: string }`) and `validateElements(elements: NormalizedElement[], idsXml: string): IdsViolation[]` — this is the package's public API. Sub-plan 05 (worker-service) imports this exact function signature and maps `IdsViolation[]` into `@ifc-qa/db`'s `elementResults` rows.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/ids-validator/src/validate-elements.test.ts
import { describe, expect, it } from "vitest";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import { validateElements } from "./validate-elements";

const IDS_XML = `<?xml version="1.0" encoding="utf-8"?>
<ids xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd" xmlns="http://standards.buildingsmart.org/IDS">
  <info>
    <title>Sample</title>
  </info>
  <specifications>
    <specification name="Wall naming and fire rating" ifcVersion="IFC2X3 IFC4">
      <applicability maxOccurs="unbounded">
        <entity>
          <name><simpleValue>IFCWALL</simpleValue></name>
        </entity>
      </applicability>
      <requirements>
        <attribute>
          <name><simpleValue>Name</simpleValue></name>
          <value>
            <xs:restriction base="xs:string">
              <xs:pattern value="W-\\d+" />
            </xs:restriction>
          </value>
        </attribute>
        <property dataType="IFCLABEL">
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>FireRating</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>`;

function makeElement(overrides: Partial<NormalizedElement>): NormalizedElement {
  return {
    globalId: "g1",
    ifcType: "IFCWALL",
    predefinedType: null,
    name: null,
    attributes: {},
    propertySets: {},
    ...overrides,
  };
}

describe("validateElements", () => {
  it("returns no violations for a fully compliant element", () => {
    const element = makeElement({
      globalId: "wall-1",
      name: "W-007",
      propertySets: { Pset_WallCommon: { FireRating: "REI90" } },
    });

    expect(validateElements([element], IDS_XML)).toEqual([]);
  });

  it("reports both a pattern violation and a missing-property violation for a non-compliant element", () => {
    const element = makeElement({
      globalId: "wall-2",
      name: "West Wall",
      propertySets: { Pset_WallCommon: {} },
    });

    const violations = validateElements([element], IDS_XML);

    expect(violations).toHaveLength(2);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementGlobalId: "wall-2",
          elementType: "IFCWALL",
          ruleId: "Wall naming and fire rating",
          severity: "error",
          message: expect.stringContaining("Name"),
        }),
        expect.objectContaining({
          elementGlobalId: "wall-2",
          elementType: "IFCWALL",
          ruleId: "Wall naming and fire rating",
          severity: "error",
          message: expect.stringContaining("FireRating"),
        }),
      ])
    );
  });

  it("does not evaluate requirements for elements whose type doesn't match applicability", () => {
    const element = makeElement({
      globalId: "door-1",
      ifcType: "IFCDOOR",
      name: null,
      propertySets: {},
    });

    expect(validateElements([element], IDS_XML)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: FAIL — `Cannot find module './validate-elements'`

- [ ] **Step 3: Write `packages/ids-validator/src/validate-elements.ts`**

```typescript
import type { NormalizedElement, Severity } from "@ifc-qa/shared-types";
import { parseIdsXml } from "./parse-ids";
import { matchesApplicability, evaluateRequirement } from "./facet-evaluation";

export interface IdsViolation {
  elementGlobalId: string;
  elementType: string;
  ruleId: string;
  severity: Severity;
  message: string;
}

export function validateElements(elements: NormalizedElement[], idsXml: string): IdsViolation[] {
  const specifications = parseIdsXml(idsXml);
  const violations: IdsViolation[] = [];

  for (const element of elements) {
    for (const specification of specifications) {
      if (!matchesApplicability(element, specification.applicabilityEntityNames)) {
        continue;
      }

      for (const facet of specification.requirements) {
        const result = evaluateRequirement(element, facet);
        if (!result.passed) {
          violations.push({
            elementGlobalId: element.globalId,
            elementType: element.ifcType,
            ruleId: specification.name,
            severity: "error",
            message: result.message,
          });
        }
      }
    }
  }

  return violations;
}
```

- [ ] **Step 4: Add the export to `packages/ids-validator/src/index.ts`**

```typescript
export * from "./parse-ids";
export * from "./facet-evaluation";
export * from "./validate-elements";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: PASS (15 tests total)

- [ ] **Step 6: Commit**

```bash
git add packages/ids-validator
git commit -m "feat(ids-validator): add validateElements public entry point"
```

---

### Task 4: Fixtures — naming + fire-rating IDS rule set and known-good/known-bad elements

**Files:**
- Create: `packages/ids-validator/fixtures/ids/naming-and-fire-rating.ids`
- Create: `packages/ids-validator/fixtures/ids/naming-and-fire-rating.pass.json`
- Create: `packages/ids-validator/fixtures/ids/naming-and-fire-rating.fail.json`
- Test: `packages/ids-validator/src/validate-elements.fixtures.test.ts`

**Interfaces:**
- Consumes: `validateElements` (Task 3, `./validate-elements`); `NormalizedElementSchema` (`@ifc-qa/shared-types`, sub-plan 00) to validate the fixture JSON shape inside the test.
- Produces: the three fixture files under `fixtures/ids/` — reusable by sub-plan 05 (worker-service) and sub-plan 07 (integration) as a real rule set + real known-good/known-bad element data for end-to-end wiring tests.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/ids-validator/src/validate-elements.fixtures.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NormalizedElementSchema } from "@ifc-qa/shared-types";
import { validateElements } from "./validate-elements";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "ids");

function loadElements(fileName: string) {
  const raw = readFileSync(join(FIXTURES_DIR, fileName), "utf-8");
  return NormalizedElementSchema.array().parse(JSON.parse(raw));
}

describe("validateElements against the naming-and-fire-rating fixture", () => {
  const idsXml = readFileSync(join(FIXTURES_DIR, "naming-and-fire-rating.ids"), "utf-8");

  it("produces no violations for the known-good elements", () => {
    const elements = loadElements("naming-and-fire-rating.pass.json");
    expect(validateElements(elements, idsXml)).toEqual([]);
  });

  it("produces the expected violations for the known-bad elements", () => {
    const elements = loadElements("naming-and-fire-rating.fail.json");
    const violations = validateElements(elements, idsXml);

    expect(violations).toHaveLength(2);
    expect(violations.every((v) => v.ruleId === "Wall naming and fire rating")).toBe(true);
    expect(violations.every((v) => v.severity === "error")).toBe(true);
    expect(
      violations.find((v) => v.elementGlobalId === "2b3C4d5E6f7G8h9I0jKlmn")?.message
    ).toContain("Name");
    expect(
      violations.find((v) => v.elementGlobalId === "3c4D5e6F7g8H9i0J1kLmno")?.message
    ).toContain("FireRating");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: FAIL — `ENOENT: no such file or directory, open '.../fixtures/ids/naming-and-fire-rating.ids'`

- [ ] **Step 3: Write `packages/ids-validator/fixtures/ids/naming-and-fire-rating.ids`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<ids xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd" xmlns="http://standards.buildingsmart.org/IDS">
  <info>
    <title>Wall naming and fire rating</title>
    <description>Walls must be named W-### and carry a FireRating in Pset_WallCommon.</description>
  </info>
  <specifications>
    <specification name="Wall naming and fire rating" ifcVersion="IFC2X3 IFC4">
      <applicability maxOccurs="unbounded">
        <entity>
          <name><simpleValue>IFCWALL</simpleValue></name>
        </entity>
      </applicability>
      <requirements>
        <attribute>
          <name><simpleValue>Name</simpleValue></name>
          <value>
            <xs:restriction base="xs:string">
              <xs:pattern value="W-\d+" />
            </xs:restriction>
          </value>
        </attribute>
        <property dataType="IFCLABEL">
          <propertySet><simpleValue>Pset_WallCommon</simpleValue></propertySet>
          <baseName><simpleValue>FireRating</simpleValue></baseName>
        </property>
      </requirements>
    </specification>
  </specifications>
</ids>
```

- [ ] **Step 4: Write `packages/ids-validator/fixtures/ids/naming-and-fire-rating.pass.json`**

```json
[
  {
    "globalId": "1a2B3c4D5e6F7g8H9i0Jkl",
    "ifcType": "IFCWALL",
    "predefinedType": "STANDARD",
    "name": "W-001",
    "attributes": {},
    "propertySets": {
      "Pset_WallCommon": {
        "FireRating": "REI60",
        "IsExternal": true
      }
    }
  }
]
```

- [ ] **Step 5: Write `packages/ids-validator/fixtures/ids/naming-and-fire-rating.fail.json`**

```json
[
  {
    "globalId": "2b3C4d5E6f7G8h9I0jKlmn",
    "ifcType": "IFCWALL",
    "predefinedType": "STANDARD",
    "name": "Wall-1",
    "attributes": {},
    "propertySets": {
      "Pset_WallCommon": {
        "FireRating": "REI60"
      }
    }
  },
  {
    "globalId": "3c4D5e6F7g8H9i0J1kLmno",
    "ifcType": "IFCWALL",
    "predefinedType": "STANDARD",
    "name": "W-002",
    "attributes": {},
    "propertySets": {
      "Pset_WallCommon": {}
    }
  }
]
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/ids-validator test`
Expected: PASS (17 tests total)

- [ ] **Step 7: Full package verification**

Run: `pnpm --filter @ifc-qa/ids-validator test` then `pnpm --filter @ifc-qa/ids-validator run build`
Expected: test PASS (17 tests); build exits 0 and emits `packages/ids-validator/dist/`.

- [ ] **Step 8: Commit**

```bash
git add packages/ids-validator
git commit -m "test(ids-validator): add naming-and-fire-rating IDS fixture and known-good/known-bad elements"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's IDS validator bullet (`packages/ids-validator`: evaluates IDS XML against normalized element data, engine-agnostic) is covered by Tasks 1-3; the Testing section's requirement for "unit tests for IDS rule evaluation against fixture rule files and known-good/known-bad fixture data, isolated from parsing" is covered by Task 4. The feasibility note's instruction to build from scratch (not depend on the unpublished `bsdd-ids-validator` package) is honored — the only external dependency is `fast-xml-parser`. The verified real IDS XML shapes (default-namespace root, `xs:restriction`/`xs:pattern` value facet, property facet with `dataType`/`propertySet`/`baseName`) are used verbatim in every test fixture and the authored `.ids` fixture file. The `IdsViolation` shape matches the spec's required fields exactly, with no `id`/`fileJobId` (DB-assigned, out of scope here).
- **Placeholder scan:** every step has complete, runnable code; no `TBD`/`later`/stub bodies. Task 4 follows strict red-green ordering: the fixture-consuming test is written first (Step 1), confirmed to fail with `ENOENT` before the fixture files exist (Step 2), then the three fixture files are written (Steps 3-5) and the test is confirmed to pass (Step 6).
- **Type consistency:** `ParsedSpecification` / `ParsedRequirementFacet` / `ParsedAttributeFacet` / `ParsedPropertyFacet` (Task 1) are imported unchanged by `facet-evaluation.ts` (Task 2) and `validate-elements.ts` (Task 3). `FacetCheckResult` (Task 2) is consumed unchanged by Task 3. `IdsViolation` (Task 3) matches the field names/types given in the outer task brief (`elementGlobalId`, `elementType`, `ruleId`, `severity: Severity`, `message`) verbatim, and `validateElements(elements: NormalizedElement[], idsXml: string): IdsViolation[]` matches the required public signature exactly.
