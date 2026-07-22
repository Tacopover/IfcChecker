# IFC QA Tool — 01: Parser Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `WebIfcAdapter` and `IfcLiteAdapter` — two concrete classes against the `IfcParserAdapter` interface already scaffolded in `packages/parser-adapters/src/types.ts` by sub-plan 00 — plus the hand-authored IFC fixture files both adapters (and later sub-plans) parse against.

**Architecture:** Both adapters read a STEP (SPF) file from disk, hand it to their respective engine (`web-ifc`'s `IfcAPI`, `@ifc-lite/parser`'s `IfcParser`), enumerate entities from a shared, fixed allowlist of physical building-element type names (`ELEMENT_TYPE_NAMES`), and normalize each into the exact `NormalizedElement` shape from `@ifc-qa/shared-types`. Iterating the *same* fixed type-name list in both adapters (rather than relying on each engine's own inheritance/subtype expansion, which could legitimately disagree at the margins) is what makes the design spec's engine-comparison goal — "compares parse speed only, not parse speed tangled with different rule logic" — actually hold: both adapters produce the same element set from the same file, so only timing and per-property extraction differ. Three small pure-function utilities (`normalizePropertyValue`, `assertWellFormedStepFile`, `ELEMENT_TYPE_NAMES`) are shared by both adapters and built first.

**Tech Stack:** `web-ifc@^0.0.77` (That Open Company's WASM IFC engine, Node build), `@ifc-lite/parser@^3.10.1` (pure-TS columnar STEP parser, no native/WASM dependency for this parse path), `@ifc-qa/shared-types` (Zod schemas/types from sub-plan 00), Vitest, Node.js `fs/promises`.

## Global Constraints

- Package under implementation: `@ifc-qa/parser-adapters`. Its `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/types.ts` (the `IfcParserAdapter`/`IfcParseResult` interfaces), and `src/index.ts` already exist from sub-plan 00's Task 5 — **do not recreate them.** Task 1 below only adds two dependency entries to the existing `package.json`; every other task only adds new `src/*.ts` files and appends to the existing `src/index.ts`.
- Import `NormalizedElement` only from `@ifc-qa/shared-types` and `IfcParseResult`/`IfcParserAdapter` only from the local `./types` — never redeclare these shapes.
- Exact dependency versions: `web-ifc: ^0.0.77`, `@ifc-lite/parser: ^3.10.1` (both confirmed to exist on the npm registry during planning).
- Node.js >= 20, pnpm >= 9 (already pinned by the root `package.json` from sub-plan 00).
- No auth — every service assumes a trusted internal network (per spec); not directly relevant to this package but stated for consistency with every other sub-plan.
- Relative imports inside `packages/parser-adapters/src` omit the `.js` extension (e.g. `from "./types.js"`, not `from "./types.js.js"`), matching the convention already established by every package sub-plan 00 created (`packages/shared-types`, `packages/storage`).
- Both adapters must export a zero-argument-constructible class (`new WebIfcAdapter()`, `new IfcLiteAdapter()`) — sub-plan 05 (worker-service) already committed to exactly this contract in its `createParserAdapter(engine): IfcParserAdapter` factory (`apps/worker/src/adapter-factory.ts`), written against `import { WebIfcAdapter, IfcLiteAdapter } from "@ifc-qa/parser-adapters"`.
- IFC fixture files live at repo root under `fixtures/ifc/`, not inside the package — both this plan's tests and later integration tests (sub-plan 07) read them from that shared location.
- A corrupt/unparseable file must cause `adapter.parse()` to reject (throw/return a rejected Promise) rather than resolve with garbage data — callers (sub-plan 05) rely on catching this to fail only that one FileJob (spec, "Error Handling").

## Dependency Notes for Orchestration

This plan depends only on sub-plan 00 (foundation) being complete — it needs the `IfcParserAdapter`/`IfcParseResult` interface scaffold in `packages/parser-adapters/src/types.ts` and `NormalizedElement` from `@ifc-qa/shared-types`, nothing else. It can run **fully in parallel** with sub-plans 02 (ids-validator), 03 (report-generator), 04 (api-service), and 06 (frontend). Sub-plan 05 (worker-service) depends on this plan's concrete `WebIfcAdapter`/`IfcLiteAdapter` classes existing before its final integration task (which overlaps with sub-plan 07), but sub-plan 05's core `processParseJob` logic is built and unit-tested against a fake adapter in the meantime and does not block on this plan starting or finishing.

---

## API grounding (read before implementing)

This section records what was confirmed, and how, before any adapter code was written — both engines' real npm packages were inspected directly (context7 for `web-ifc`, and raw GitHub source for `@ifc-lite/parser`, since it is not yet indexed in context7).

### `web-ifc` (`^0.0.77`)

- The published npm package's `package.json` (fetched directly from the npm registry) declares `"main": "./web-ifc-api-node.js"` and an `exports` map whose `"."` entry lists conditions in the order `{"require": "./web-ifc-api-node.js", "node": "./web-ifc-api-node.js", "import": "./web-ifc-api.js"}`. Because the `"node"` condition is listed (and thus matched) before `"import"`, a plain `import * as WebIFC from "web-ifc"` resolves to the **Node build** (`web-ifc-api-node.js`) even from ESM code — no subpath needed.
- The Node build is compiled with `esbuild --define:__WASM_PATH__="./web-ifc-node"` (confirmed from the package's own `build-web-ifc-api-node` script), i.e. its WASM path is baked in at build time relative to its own installed location. `ifcApi.Init()` alone should locate `web-ifc-node.wasm` without an explicit `SetWasmPath()` call.
- Lifecycle, confirmed via context7 and the repo's own `examples/usage/src/utils.ts`: `new WebIFC.IfcAPI()` → `await ifcApi.Init()` → `ifcApi.OpenModel(new Uint8Array(fileBytes))` → ... → `ifcApi.CloseModel(modelID)`.
- `GetLineIDsWithType(modelID, typeCode, includeInherited = false)` returns an Emscripten `Vector<number>` (`.size()` / `.get(i)`, confirmed from `src/ts/web-ifc-api.ts`).
- `GetLine(modelID, expressID, flatten = false)` returns a JS object whose "defined type" attributes (`GlobalId: IfcGloballyUniqueId`, `Name: IfcLabel`, etc.) are wrapped as `{ value: ... }` and must be unwrapped via `.value` — confirmed directly from the repo's own `examples/usage/src/properties.ts`, which asserts `propertySetFlattened.GlobalId!.value === "0uNK5AgoP1Vw6UlaHiS$iF"` and `props[0].NominalValue!.value === "300x300"`.
- Property-set extraction pattern, confirmed from the same file: there is no direct "get property sets for element" call. Instead, enumerate every `IFCRELDEFINESBYPROPERTIES` line (`GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES)`), check each relationship's `RelatedObjects` (array of `{ value: expressID }` handles) for the target element's express ID, then `GetLine(modelID, rel.RelatingPropertyDefinition.value, true)` (flattened) to get the property set's `.HasProperties` array of `IfcPropertySingleValue` objects.
- `GetNameFromTypeCode(type: number): string` / `GetTypeCodeFromName(typeName: string): number` (confirmed in `src/ts/web-ifc-api.ts`) convert between numeric type codes and name strings — not used directly by this plan since both adapters iterate a fixed name allowlist instead (see Architecture above), but documented here since it is the mechanism `WebIFC.IFCWALL`-style constants rely on.
- All type-code constants referenced by this plan's `ELEMENT_TYPE_NAMES` allowlist (`IFCWALL`, `IFCWALLSTANDARDCASE`, `IFCSLAB`, `IFCBEAM`, `IFCCOLUMN`, `IFCDOOR`, `IFCWINDOW`, `IFCROOF`, `IFCSTAIR`, `IFCRAILING`, `IFCSPACE`, `IFCCOVERING`, `IFCFURNISHINGELEMENT`, `IFCPIPESEGMENT`, `IFCDUCTSEGMENT`, `IFCFLOWTERMINAL`, `IFCFLOWFITTING`, plus `IFCPROPERTYSET`/`IFCPROPERTYSINGLEVALUE`/`IFCRELDEFINESBYPROPERTIES`) were individually confirmed to exist as `export const NAME = <number>;` in the package's `src/ts/ifc-schema.ts`.

### `@ifc-lite/parser` (`^3.10.1`)

Not indexed in context7 (`resolve-library-id` returned no match for "ifc-lite" or "@ifc-lite/parser"); grounded instead by reading the published package's actual source on GitHub (`LTplus-AG/ifc-lite`, main branch, package `packages/parser`) and cross-checking against the npm registry's published `package.json` for `3.10.1`.

- The package is pure ESM, pure TypeScript (`"type": "module"`, `main: "./dist/index.js"`), with only `jszip` as a runtime dependency — no native/WASM binary is required for the STEP-parsing path this plan uses (geometry/WASM lives in the separate `@ifc-lite/geometry` package, not needed here).
- `class IfcParser { async parseColumnar(buffer: ArrayBuffer | SharedArrayBuffer, options?): Promise<IfcDataStore> }` (confirmed from `packages/parser/src/index.ts`). It takes an `ArrayBuffer`, not a Node `Buffer`/`Uint8Array` — a `Buffer` from `fs.readFile` must be converted via `buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)`.
- `IfcDataStore.entityIndex: { byId: Map<number, EntityRef>; byType: Map<string, number[]> }` (confirmed from `packages/parser/src/columnar-parser.ts`'s `IfcDataStore` interface). `byType` is keyed by **UPPERCASE** STEP type names (e.g. `"IFCWALL"`) — confirmed both by the main README's quickstart (`store.entityIndex.byType.get('IFCWALL')`) and by `BufferEntitySource.getEntitiesByType`, which does `.get(typeName.toUpperCase())`.
- `store.entities` is a columnar `EntityTable` (from `@ifc-lite/data`) with **always-populated** accessor methods `getGlobalId(expressId): string`, `getName(expressId): string`, `getTypeName(expressId): string` (returns PascalCase, e.g. `"IfcWall"`, per `IfcTypeEnumToString`'s `TYPE_ENUM_TO_STRING` map in `packages/data/src/types.ts`) — confirmed from `packages/data/src/entity-table.ts`'s `EntityTableBuilder.add()`, which always writes `globalId`/`name` columns during parsing.
- `store.entities.getPredefinedType?(expressId): string` and `getTag?(expressId): string` are explicitly **optional** methods, documented in `packages/data/src/entity-table.ts` as "populated by server-parsed stores... the WASM path resolves Tag on demand from source instead" — i.e. not guaranteed present on the in-process `parseColumnar()` path this plan uses. This plan therefore uses the always-available on-demand extractor instead (next bullet), not this optional accessor.
- `extractAllEntityAttributes(store, entityId): Array<{ name: string; value: string | number | boolean }>` and `extractPropertiesOnDemand(store, entityId): Array<{ name: string; properties: Array<{ name: string; type: number; value: PropertyValue }> }>` (both confirmed from `packages/parser/src/columnar-parser.ts` and exercised directly in `packages/parser/test/on-demand-properties-regression.test.ts`, which asserts e.g. `psets[0].properties.map(p => p.name)` equals `['FireRating', 'IsExternal']` and that STEP `.T.`/`.F.`/`.U.` boolean/logical tokens are normalized to real `true`/`false`/`null` — both exported from the package's `src/index.ts` and thus from the public `@ifc-lite/parser` entry point.
- `PropertyValue = string | number | boolean | null | PropertyValue[]` (from `packages/data/src/property-table.ts`) — the array case does not fit `NormalizedElement`'s `PropertyValue` union, so this plan's shared `normalizePropertyValue` helper JSON-stringifies arrays.

---

### Task 1: Shared adapter utilities

**Files:**
- Modify: `packages/parser-adapters/package.json`
- Create: `packages/parser-adapters/src/element-types.ts`
- Create: `packages/parser-adapters/src/normalize-property-value.ts`
- Create: `packages/parser-adapters/src/step-well-formed.ts`
- Test: `packages/parser-adapters/src/element-types.test.ts`
- Test: `packages/parser-adapters/src/normalize-property-value.test.ts`
- Test: `packages/parser-adapters/src/step-well-formed.test.ts`

**Interfaces:**
- Consumes: nothing (pure, dependency-free utilities).
- Produces: `ELEMENT_TYPE_NAMES: readonly string[]`, `normalizePropertyValue(value: unknown): string | number | boolean | null`, `assertWellFormedStepFile(rawText: string): void` — Tasks 3, 4, and 5 (below) import all three; no other sub-plan depends on them directly.

- [ ] **Step 1: Add engine dependencies to `packages/parser-adapters/package.json`**

Replace the file's `dependencies` block (created by sub-plan 00's Task 5) so the full file reads:

```json
{
  "name": "@ifc-qa/parser-adapters",
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
    "web-ifc": "^0.0.77",
    "@ifc-lite/parser": "^3.10.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Install the new dependencies**

Run: `pnpm install`
Expected: exits 0; `node_modules/.pnpm` now includes `web-ifc@0.0.77` and `@ifc-lite/parser@3.10.1`.

- [ ] **Step 3: Write the failing test for `ELEMENT_TYPE_NAMES`**

```typescript
// packages/parser-adapters/src/element-types.test.ts
import { describe, expect, it } from "vitest";
import { ELEMENT_TYPE_NAMES } from "./element-types.js";

describe("ELEMENT_TYPE_NAMES", () => {
  it("includes the core physical building element types the fixtures exercise", () => {
    expect(ELEMENT_TYPE_NAMES).toContain("IFCWALL");
    expect(ELEMENT_TYPE_NAMES).toContain("IFCDOOR");
    expect(ELEMENT_TYPE_NAMES).toContain("IFCSLAB");
  });

  it("contains only uppercase STEP-style type names", () => {
    for (const name of ELEMENT_TYPE_NAMES) {
      expect(name).toBe(name.toUpperCase());
    }
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: FAIL — `Cannot find module './element-types'`

- [ ] **Step 5: Write `packages/parser-adapters/src/element-types.ts`**

```typescript
/**
 * Fixed allowlist of physical building-element IFC type names, iterated
 * identically by WebIfcAdapter and IfcLiteAdapter so a Run's engine
 * comparison measures parse speed only, never a difference in which
 * elements each engine happened to enumerate.
 */
export const ELEMENT_TYPE_NAMES = [
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCSLAB",
  "IFCBEAM",
  "IFCCOLUMN",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCROOF",
  "IFCSTAIR",
  "IFCRAILING",
  "IFCSPACE",
  "IFCCOVERING",
  "IFCFURNISHINGELEMENT",
  "IFCPIPESEGMENT",
  "IFCDUCTSEGMENT",
  "IFCFLOWTERMINAL",
  "IFCFLOWFITTING",
] as const;

export type ElementTypeName = (typeof ELEMENT_TYPE_NAMES)[number];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (2 tests) — `element-types.test.ts` only; other test files from this task don't exist yet.

- [ ] **Step 7: Write the failing test for `normalizePropertyValue`**

```typescript
// packages/parser-adapters/src/normalize-property-value.test.ts
import { describe, expect, it } from "vitest";
import { normalizePropertyValue } from "./normalize-property-value.js";

describe("normalizePropertyValue", () => {
  it("passes primitives through unchanged", () => {
    expect(normalizePropertyValue("REI60")).toBe("REI60");
    expect(normalizePropertyValue(3000)).toBe(3000);
    expect(normalizePropertyValue(true)).toBe(true);
  });

  it("maps null and undefined to null", () => {
    expect(normalizePropertyValue(null)).toBeNull();
    expect(normalizePropertyValue(undefined)).toBeNull();
  });

  it("unwraps an engine-typed {value} object", () => {
    expect(normalizePropertyValue({ value: "REI60" })).toBe("REI60");
    expect(normalizePropertyValue({ value: true })).toBe(true);
  });

  it("stringifies arrays", () => {
    expect(normalizePropertyValue(["a", "b"])).toBe(JSON.stringify(["a", "b"]));
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: FAIL — `Cannot find module './normalize-property-value'`

- [ ] **Step 9: Write `packages/parser-adapters/src/normalize-property-value.ts`**

```typescript
/**
 * Coerces a raw value read from either engine into NormalizedElement's
 * PropertyValue union (string | number | boolean | null). web-ifc wraps
 * "defined type" attributes (IfcLabel, IfcGloballyUniqueId, ...) as
 * { value: ... }; this unwraps that shape too so callers can pass either
 * engine's raw output through the same function. Arrays (ifc-lite's
 * multi-valued PropertyValue) are JSON-stringified since NormalizedElement
 * has no array member.
 */
export function normalizePropertyValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return normalizePropertyValue((value as { value: unknown }).value);
  }
  return String(value);
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (6 tests total)

- [ ] **Step 11: Write the failing test for `assertWellFormedStepFile`**

```typescript
// packages/parser-adapters/src/step-well-formed.test.ts
import { describe, expect, it } from "vitest";
import { assertWellFormedStepFile } from "./step-well-formed.js";

describe("assertWellFormedStepFile", () => {
  it("accepts a file ending with the ISO-10303-21 terminator", () => {
    expect(() =>
      assertWellFormedStepFile("ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n")
    ).not.toThrow();
  });

  it("rejects a file missing the terminator", () => {
    expect(() => assertWellFormedStepFile("ISO-10303-21;\nDATA;\n#1=IFCWALL();")).toThrow(
      /malformed IFC STEP file/
    );
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: FAIL — `Cannot find module './step-well-formed'`

- [ ] **Step 13: Write `packages/parser-adapters/src/step-well-formed.ts`**

```typescript
/**
 * Every conformant ISO-10303-21 (STEP) file ends with this exact token.
 * Checking for it directly is simpler and more robust than counting
 * ENDSEC occurrences (a file can legitimately contain multiple ENDSECs —
 * one per HEADER/DATA section — so presence alone doesn't imply
 * completeness). Both adapters call this before invoking their engine so
 * a truncated file fails identically and deterministically regardless of
 * how leniently either underlying engine would otherwise have parsed it.
 */
export function assertWellFormedStepFile(rawText: string): void {
  if (!rawText.trimEnd().endsWith("END-ISO-10303-21;")) {
    throw new Error("malformed IFC STEP file: missing END-ISO-10303-21 terminator");
  }
}
```

- [ ] **Step 14: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (8 tests total)

- [ ] **Step 15: Commit**

```bash
git add packages/parser-adapters/package.json packages/parser-adapters/src/element-types.ts packages/parser-adapters/src/element-types.test.ts packages/parser-adapters/src/normalize-property-value.ts packages/parser-adapters/src/normalize-property-value.test.ts packages/parser-adapters/src/step-well-formed.ts packages/parser-adapters/src/step-well-formed.test.ts
git commit -m "feat(parser-adapters): add engine deps and shared normalization utilities"
```

---

### Task 2: IFC fixture files

**Files:**
- Create: `fixtures/ifc/minimal-wall.ifc`
- Create: `fixtures/ifc/corrupt-truncated.ifc`
- Create: `packages/parser-adapters/src/fixture-path.ts`
- Test: `packages/parser-adapters/src/fixtures.test.ts`

**Interfaces:**
- Consumes: `assertWellFormedStepFile` (Task 1).
- Produces: `fixturePath(fileName: string): string` — Tasks 3, 4, and 5 (below), and later sub-plan 07's integration tests, all resolve fixture files through this function instead of hand-rolling relative paths.

- [ ] **Step 1: Write `fixtures/ifc/minimal-wall.ifc`**

```
ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('fixture-wall.ifc','2026-07-17T00:00:00',(''),(''),'IFC QA Tool fixture','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0FMxV72Kn2gQBLPeGefPXc',$,'Fixture Project',$,$,$,$,(#8),#5);
#5=IFCUNITASSIGNMENT((#6,#7));
#6=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#7=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
#8=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#9,$);
#9=IFCAXIS2PLACEMENT3D(#10,$,$);
#10=IFCCARTESIANPOINT((0.0,0.0,0.0));
#11=IFCSITE('1PPvKvz85AqQI7$4o09XlU',$,'Fixture Site',$,$,#12,$,$,.ELEMENT.,$,$,$,$,$);
#12=IFCLOCALPLACEMENT($,#9);
#13=IFCBUILDING('2Rf9ce5uz1qOB7WEOWMYye',$,'Fixture Building',$,$,#12,$,$,.ELEMENT.,$,$,$);
#14=IFCBUILDINGSTOREY('3Kf5r2t7D6UwlEDlNjJKq1',$,'Level 1',$,$,#12,$,$,.ELEMENT.,0.0);
#15=IFCWALL('1abc2defGHI3jkl4mno5pq',$,'W-001','Fixture wall for QA tool tests',$,#12,$,'TAG-001',.STANDARD.);
#16=IFCPROPERTYSINGLEVALUE('IsExternal',$,IFCBOOLEAN(.T.),$);
#17=IFCPROPERTYSINGLEVALUE('FireRating',$,IFCLABEL('REI60'),$);
#18=IFCPROPERTYSET('0zP1M8vE59Jw4qLKrVeSTu',$,'Pset_WallCommon',$,(#16,#17));
#19=IFCRELDEFINESBYPROPERTIES('2yQ7N9wF60Kx5rMLsWfTUv',$,$,$,(#15),#18);
#20=IFCRELAGGREGATES('3zR8O0xG71Ly6sNMtXgUVw',$,$,$,#1,(#11));
#21=IFCRELAGGREGATES('4aS9P1yH82Mz7tONuYhVWx',$,$,$,#11,(#13));
#22=IFCRELAGGREGATES('5bT0Q2zI93Na8uPOvZiWXy',$,$,$,#13,(#14));
#23=IFCRELCONTAINEDINSPATIALSTRUCTURE('6cU1R3AJ04Ob9vQPwAjXYz',$,$,$,(#15),#14);
ENDSEC;
END-ISO-10303-21;
```

- [ ] **Step 2: Write `fixtures/ifc/corrupt-truncated.ifc`**

Same file, cut off partway through the DATA section — no `ENDSEC;`/`END-ISO-10303-21;` for DATA, exercising the error path:

```
ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('fixture-wall.ifc','2026-07-17T00:00:00',(''),(''),'IFC QA Tool fixture','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0FMxV72Kn2gQBLPeGefPXc',$,'Fixture Project',$,$,$,$,(#8),#5);
#5=IFCUNITASSIGNMENT((#6,#7));
#6=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#7=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
#8=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#9,$);
#9=IFCAXIS2PLACEMENT3D(#10,$,$);
#10=IFCCARTESIANPOINT((0.0,0.0,0.0));
```

- [ ] **Step 3: Write the failing test**

```typescript
// packages/parser-adapters/src/fixtures.test.ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixturePath } from "./fixture-path.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";

describe("IFC fixtures", () => {
  it("minimal-wall.ifc is a well-formed STEP file", async () => {
    const text = await readFile(fixturePath("minimal-wall.ifc"), "utf-8");
    expect(() => assertWellFormedStepFile(text)).not.toThrow();
    expect(text).toContain("IFCWALL");
  });

  it("corrupt-truncated.ifc is not well-formed", async () => {
    const text = await readFile(fixturePath("corrupt-truncated.ifc"), "utf-8");
    expect(() => assertWellFormedStepFile(text)).toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: FAIL — `Cannot find module './fixture-path'`

- [ ] **Step 5: Write `packages/parser-adapters/src/fixture-path.ts`**

```typescript
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Resolves a file name under the repo-root fixtures/ifc/ directory.
 * packages/parser-adapters/src/ is three levels below repo root.
 */
export function fixturePath(fileName: string): string {
  const fixturesDir = fileURLToPath(new URL("../../../fixtures/ifc/", import.meta.url));
  return join(fixturesDir, fileName);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (10 tests total)

- [ ] **Step 7: Commit**

```bash
git add fixtures/ifc/minimal-wall.ifc fixtures/ifc/corrupt-truncated.ifc packages/parser-adapters/src/fixture-path.ts packages/parser-adapters/src/fixtures.test.ts
git commit -m "test(fixtures): add minimal-wall and corrupt-truncated IFC fixtures"
```

> **Note for the implementer:** if either engine (Task 3 or Task 4) rejects `minimal-wall.ifc` when actually run against it, adjust its content minimally so both engines accept it, and note the change in that task's commit message — do not fork into two different fixture files. `corrupt-truncated.ifc` is expected to be rejected by `assertWellFormedStepFile` before either engine ever sees it (see Task 1, Step 13), so no engine-specific adjustment should be needed there.

---

### Task 3: `WebIfcAdapter`

**Files:**
- Create: `packages/parser-adapters/src/web-ifc-adapter.ts`
- Test: `packages/parser-adapters/src/web-ifc-adapter.test.ts`

**Interfaces:**
- Consumes: `IfcParseResult`, `IfcParserAdapter` (`./types`, sub-plan 00); `NormalizedElement` (`@ifc-qa/shared-types`); `ELEMENT_TYPE_NAMES` (Task 1); `normalizePropertyValue` (Task 1); `assertWellFormedStepFile` (Task 1); `fixturePath` (Task 2).
- Produces: `class WebIfcAdapter implements IfcParserAdapter` — sub-plan 05's `createParserAdapter` factory constructs this directly (`new WebIfcAdapter()`).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/parser-adapters/src/web-ifc-adapter.test.ts
import { describe, expect, it } from "vitest";
import { WebIfcAdapter } from "./web-ifc-adapter.js";
import { fixturePath } from "./fixture-path.js";

describe("WebIfcAdapter", () => {
  it("parses the minimal wall fixture into one normalized IFCWALL element", async () => {
    const adapter = new WebIfcAdapter();
    const result = await adapter.parse(fixturePath("minimal-wall.ifc"));

    expect(result.parseMs).toBeGreaterThanOrEqual(0);
    expect(result.elements).toHaveLength(1);

    const [wall] = result.elements;
    expect(wall.globalId).toBe("1abc2defGHI3jkl4mno5pq");
    expect(wall.ifcType).toBe("IFCWALL");
    expect(wall.predefinedType).toBe("STANDARD");
    expect(wall.name).toBe("W-001");
    expect(wall.attributes.tag).toBe("TAG-001");
    expect(wall.attributes.description).toBe("Fixture wall for QA tool tests");
    expect(wall.propertySets.Pset_WallCommon).toEqual({
      IsExternal: true,
      FireRating: "REI60",
    });
  });

  it("rejects the truncated fixture", async () => {
    const adapter = new WebIfcAdapter();
    await expect(adapter.parse(fixturePath("corrupt-truncated.ifc"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: FAIL — `Cannot find module './web-ifc-adapter'`

- [ ] **Step 3: Write `packages/parser-adapters/src/web-ifc-adapter.ts`**

```typescript
import { readFile } from "node:fs/promises";
import * as WebIFC from "web-ifc";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult, IfcParserAdapter } from "./types.js";
import { ELEMENT_TYPE_NAMES } from "./element-types.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue } from "./normalize-property-value.js";

type WebIfcLine = Record<string, any>;

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" ? normalized.replace(/^\.|\.$/g, "") : null;
}

export class WebIfcAdapter implements IfcParserAdapter {
  async parse(filePath: string): Promise<IfcParseResult> {
    const start = performance.now();
    const raw = await readFile(filePath);
    assertWellFormedStepFile(raw.toString("utf-8"));

    const ifcApi = new WebIFC.IfcAPI();
    await ifcApi.Init();
    const modelID = ifcApi.OpenModel(new Uint8Array(raw));

    try {
      const elements: NormalizedElement[] = [];

      // Collect every IFCRELDEFINESBYPROPERTIES relationship once so each
      // element doesn't re-scan the whole model for its property sets.
      const relLineIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
      const rels: WebIfcLine[] = [];
      for (let i = 0; i < relLineIds.size(); i++) {
        rels.push(ifcApi.GetLine(modelID, relLineIds.get(i)) as WebIfcLine);
      }

      for (const typeName of ELEMENT_TYPE_NAMES) {
        const typeCode = (WebIFC as unknown as Record<string, number>)[typeName];
        if (typeCode === undefined) continue;

        const lineIds = ifcApi.GetLineIDsWithType(modelID, typeCode);
        for (let i = 0; i < lineIds.size(); i++) {
          const expressID = lineIds.get(i);
          const line = ifcApi.GetLine(modelID, expressID) as WebIfcLine;

          const propertySets: Record<string, Record<string, string | number | boolean | null>> = {};
          for (const rel of rels) {
            const related: WebIfcLine[] = rel.RelatedObjects ?? [];
            const isForThisElement = related.some((ref) => ref?.value === expressID);
            if (!isForThisElement) continue;

            const defId = rel.RelatingPropertyDefinition?.value;
            if (defId === undefined) continue;

            const propSet = ifcApi.GetLine(modelID, defId, true) as WebIfcLine;
            const psetName = normalizePropertyValue(propSet.Name);
            if (typeof psetName !== "string") continue;

            const props: Record<string, string | number | boolean | null> = {};
            for (const prop of propSet.HasProperties ?? []) {
              const propName = normalizePropertyValue(prop.Name);
              if (typeof propName !== "string") continue;
              props[propName] = normalizePropertyValue(prop.NominalValue);
            }
            propertySets[psetName] = props;
          }

          const globalId = normalizePropertyValue(line.GlobalId);
          const name = normalizePropertyValue(line.Name);

          elements.push({
            globalId: typeof globalId === "string" ? globalId : String(globalId ?? ""),
            ifcType: typeName,
            predefinedType: stripEnumDots(line.PredefinedType),
            name: typeof name === "string" ? name : null,
            attributes: {
              tag: normalizePropertyValue(line.Tag),
              description: normalizePropertyValue(line.Description),
              objectType: normalizePropertyValue(line.ObjectType),
            },
            propertySets,
          });
        }
      }

      return { elements, parseMs: performance.now() - start };
    } finally {
      ifcApi.CloseModel(modelID);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (12 tests total). If `line.PredefinedType` turns out to arrive pre-stripped (no dots) or still dotted, `stripEnumDots` handles both — no adjustment needed either way. If any other assertion fails because the engine's real runtime shape differs from what was confirmed above (see "API grounding"), add a temporary `console.log(JSON.stringify(line))` / `console.log(JSON.stringify(propSet))` in this file, re-run just this test file (`pnpm --filter @ifc-qa/parser-adapters exec vitest run src/web-ifc-adapter.test.ts`), inspect the actual shape, adjust the extraction code above accordingly, then remove the temporary logging.

- [ ] **Step 5: Commit**

```bash
git add packages/parser-adapters/src/web-ifc-adapter.ts packages/parser-adapters/src/web-ifc-adapter.test.ts
git commit -m "feat(parser-adapters): implement WebIfcAdapter"
```

---

### Task 4: `IfcLiteAdapter`

**Files:**
- Create: `packages/parser-adapters/src/ifc-lite-adapter.ts`
- Test: `packages/parser-adapters/src/ifc-lite-adapter.test.ts`

**Interfaces:**
- Consumes: `IfcParseResult`, `IfcParserAdapter` (`./types`, sub-plan 00); `NormalizedElement` (`@ifc-qa/shared-types`); `ELEMENT_TYPE_NAMES` (Task 1); `normalizePropertyValue` (Task 1); `assertWellFormedStepFile` (Task 1); `fixturePath` (Task 2).
- Produces: `class IfcLiteAdapter implements IfcParserAdapter` — sub-plan 05's `createParserAdapter` factory constructs this directly (`new IfcLiteAdapter()`).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/parser-adapters/src/ifc-lite-adapter.test.ts
import { describe, expect, it } from "vitest";
import { IfcLiteAdapter } from "./ifc-lite-adapter.js";
import { fixturePath } from "./fixture-path.js";

describe("IfcLiteAdapter", () => {
  it("parses the minimal wall fixture into one normalized IFCWALL element", async () => {
    const adapter = new IfcLiteAdapter();
    const result = await adapter.parse(fixturePath("minimal-wall.ifc"));

    expect(result.parseMs).toBeGreaterThanOrEqual(0);
    expect(result.elements).toHaveLength(1);

    const [wall] = result.elements;
    expect(wall.globalId).toBe("1abc2defGHI3jkl4mno5pq");
    expect(wall.ifcType).toBe("IFCWALL");
    expect(wall.predefinedType).toBe("STANDARD");
    expect(wall.name).toBe("W-001");
    expect(wall.attributes.tag).toBe("TAG-001");
    expect(wall.attributes.description).toBe("Fixture wall for QA tool tests");
    expect(wall.propertySets.Pset_WallCommon).toEqual({
      IsExternal: true,
      FireRating: "REI60",
    });
  });

  it("rejects the truncated fixture", async () => {
    const adapter = new IfcLiteAdapter();
    await expect(adapter.parse(fixturePath("corrupt-truncated.ifc"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: FAIL — `Cannot find module './ifc-lite-adapter'`

- [ ] **Step 3: Write `packages/parser-adapters/src/ifc-lite-adapter.ts`**

```typescript
import { readFile } from "node:fs/promises";
import { IfcParser, extractPropertiesOnDemand, extractAllEntityAttributes } from "@ifc-lite/parser";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult, IfcParserAdapter } from "./types.js";
import { ELEMENT_TYPE_NAMES } from "./element-types.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue } from "./normalize-property-value.js";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" && normalized !== "" ? normalized.replace(/^\.|\.$/g, "") : null;
}

export class IfcLiteAdapter implements IfcParserAdapter {
  async parse(filePath: string): Promise<IfcParseResult> {
    const start = performance.now();
    const raw = await readFile(filePath);
    assertWellFormedStepFile(raw.toString("utf-8"));

    const parser = new IfcParser();
    const store = await parser.parseColumnar(toArrayBuffer(raw));

    const elements: NormalizedElement[] = [];

    for (const typeName of ELEMENT_TYPE_NAMES) {
      const expressIds = store.entityIndex.byType.get(typeName) ?? [];

      for (const expressId of expressIds) {
        const psets = extractPropertiesOnDemand(store, expressId);
        const propertySets: Record<string, Record<string, string | number | boolean | null>> = {};
        for (const pset of psets) {
          const props: Record<string, string | number | boolean | null> = {};
          for (const prop of pset.properties) {
            props[prop.name] = normalizePropertyValue(prop.value);
          }
          propertySets[pset.name] = props;
        }

        // store.entities.getPredefinedType/getTag are optional and not
        // populated on this in-process parseColumnar() path (see "API
        // grounding" above) — extractAllEntityAttributes always works
        // because it re-derives named attributes from the source buffer.
        const attrs = extractAllEntityAttributes(store, expressId);
        const findAttr = (name: string) => attrs.find((a) => a.name === name)?.value ?? null;

        const name = store.entities.getName(expressId);

        elements.push({
          globalId: store.entities.getGlobalId(expressId),
          ifcType: typeName,
          predefinedType: stripEnumDots(findAttr("PredefinedType")),
          name: name === "" ? null : name,
          attributes: {
            tag: normalizePropertyValue(findAttr("Tag")),
            description: normalizePropertyValue(findAttr("Description")),
            objectType: normalizePropertyValue(findAttr("ObjectType")),
          },
          propertySets,
        });
      }
    }

    return { elements, parseMs: performance.now() - start };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (14 tests total). If `extractAllEntityAttributes` does not return a `"PredefinedType"` entry for `IFCWALL` (e.g. if the generated attribute-name table differs from what was inferred from the schema field ordering), fall back to `(store.entities.getPredefinedType as ((id: number) => string) | undefined)?.(expressId)` guarded with `typeof ... === "function"` — this optional accessor is documented (see "API grounding") as the alternate, server-path source for the same field. As with Task 3, add temporary `console.log(JSON.stringify(attrs))` to inspect the actual shape if any assertion fails, then remove it once fixed.

- [ ] **Step 5: Commit**

```bash
git add packages/parser-adapters/src/ifc-lite-adapter.ts packages/parser-adapters/src/ifc-lite-adapter.test.ts
git commit -m "feat(parser-adapters): implement IfcLiteAdapter"
```

---

### Task 5: Cross-adapter parity test and package exports

**Files:**
- Create: `packages/parser-adapters/src/adapter-parity.test.ts`
- Modify: `packages/parser-adapters/src/index.ts`

**Interfaces:**
- Consumes: `WebIfcAdapter` (Task 3), `IfcLiteAdapter` (Task 4), `fixturePath` (Task 2).
- Produces: the full `@ifc-qa/parser-adapters` public surface (`IfcParserAdapter`, `IfcParseResult`, `WebIfcAdapter`, `IfcLiteAdapter`, `ELEMENT_TYPE_NAMES`, `normalizePropertyValue`, `assertWellFormedStepFile`) — this is what sub-plan 05's `import { WebIfcAdapter, IfcLiteAdapter } from "@ifc-qa/parser-adapters"` resolves against.

- [ ] **Step 1: Write the parity test**

Both adapters are already implemented (Tasks 3-4); this test is a characterization/integration check, not a red-green unit cycle — it is expected to pass immediately once written.

```typescript
// packages/parser-adapters/src/adapter-parity.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (15 tests total)

- [ ] **Step 3: Update `packages/parser-adapters/src/index.ts` to export everything this package produces**

```typescript
export * from "./types.js";
export * from "./element-types.js";
export * from "./normalize-property-value.js";
export * from "./step-well-formed.js";
export * from "./fixture-path.js";
export * from "./web-ifc-adapter.js";
export * from "./ifc-lite-adapter.js";
```

- [ ] **Step 4: Run the full package test suite once more**

Run: `pnpm --filter @ifc-qa/parser-adapters test`
Expected: PASS (15 tests total) — confirms the `index.ts` changes didn't break anything.

- [ ] **Step 5: Commit**

```bash
git add packages/parser-adapters/src/adapter-parity.test.ts packages/parser-adapters/src/index.ts
git commit -m "test(parser-adapters): add cross-adapter parity check and finalize package exports"
```

---

## Self-Review Notes

- **Spec coverage:** The design spec's parser-adapter requirements are: implement `IfcParserAdapter` for both engines (Tasks 3-4), normalize to `NormalizedElement` (all tasks — verified by both adapter tests and the Task 5 parity test), use fixture files under `fixtures/ifc` (Task 2), and ensure a corrupt file fails cleanly (Task 1's `assertWellFormedStepFile` plus the "rejects the truncated fixture" test in both Task 3 and Task 4). The spec's "one integration test per adapter running a real fixture file end-to-end" is satisfied by Task 3/4's first test each; Task 5 adds the cross-engine comparison the spec's whole engine-picker feature depends on.
- **Placeholder scan:** No `TBD`/`TODO`/"add error handling" placeholders. The two spots that acknowledge residual uncertainty (Task 3 Step 4, Task 4 Step 4) are not placeholders — they give a concrete, already-coded fallback (`stripEnumDots` handling both dotted/undotted forms; the documented optional `getPredefinedType` accessor as a named fallback) rather than deferring the decision.
- **Type consistency:** `IfcParseResult`/`IfcParserAdapter` are imported from `./types` (never redeclared) in both adapters, matching sub-plan 00's Task 5 scaffold exactly (`parse(filePath: string): Promise<{ elements: NormalizedElement[]; parseMs: number }>`). `WebIfcAdapter`/`IfcLiteAdapter` class names and their zero-arg constructors match what sub-plan 05's `apps/worker/src/adapter-factory.ts` already imports (`import { WebIfcAdapter, IfcLiteAdapter } from "@ifc-qa/parser-adapters"`, `new WebIfcAdapter()` / `new IfcLiteAdapter()`) — confirmed by reading that plan's file directly, not assumed. `normalizePropertyValue`'s return type (`string | number | boolean | null`) matches `NormalizedElement`'s `PropertyValue` union exactly (`packages/shared-types/src/domain.ts`, sub-plan 00 Task 2).
- **Fixture symmetry:** Both adapter test files assert identical expected values against the same fixture file, and Task 5 adds a direct parity check — this was a deliberate design choice (shared `ELEMENT_TYPE_NAMES` allowlist, shared `assertWellFormedStepFile` pre-check) specifically to satisfy the design spec's requirement that engine choice affects only parse speed, not which elements/results a run produces.
