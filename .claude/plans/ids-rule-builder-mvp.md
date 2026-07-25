# IDS Rule Builder MVP — implementation brief

Single source of truth for every agent on this task. Read it fully before editing.
Branch: `feat/ids-rule-builder`. Design reference: `.claude/plans/ids-rule-builder-mockup.html`
(a complete, working vanilla-JS prototype — open it and read the code; behaviour and CSS come from there).

## Non-negotiables

1. **`pnpm` is only reachable via corepack in this environment.** Use `corepack pnpm …`, never bare `pnpm`.
2. **The gate is `node scripts/verify.mjs`.** It runs build+typecheck, then every package's tests.
   Add `--visual` to also render the built app in headless Chromium and assert it mounts, logs no
   errors, clips no content and does not scroll sideways. UI work must pass `--visual`.
3. **Never report done without pasting the tail of a passing verify run.** If it fails and you cannot
   fix it, say so plainly with the output. "Should work" is not a result.
4. **Every new module gets a colocated `*.test.ts` / `*.test.tsx`** — repo convention, see any existing
   package. Tests must assert behaviour, not merely that a function is callable.
5. **Scope lock.** Touch only the files your wave owns (listed below). Note anything else you spot;
   don't fix it.
6. **Match surrounding style.** Comments only where the *why* is non-obvious; no narration of changes.

## Product shape (what we are building)

A second page in the web app where a user loads one IFC file as a worked example, browses what is
actually in it, and builds IDS rules against those real names and values — seeing pass/fail counts
update live — then exports spec-conformant IDS XML.

Deliberately out of scope: Classification/Material/PartOf facets, optional cardinality, numeric
bounds, `ifcVersion` targeting, file-level metadata beyond a title, importing a foreign IDS file.

## Architecture

### `packages/ids-validator` — new + extended modules

```ts
// src/ifc-type-hierarchy.ts   (NEW)
export const IFC_SCHEMA: "IFC4";
export function canonicalIfcType(t: string): string | null;   // "IFCWALL" -> "IfcWall", unknown -> null
export function isKnownIfcType(t: string): boolean;
export function ancestorsOf(t: string): string[];             // immediate parent first, up to IfcRoot
export function descendantsOf(t: string): string[];           // all subtypes, excluding t itself
export function isSubtypeOf(t: string, candidate: string): boolean;  // true when t === candidate too
```
All lookups case-insensitive (IFC files yield `IFCWALL`, the table is PascalCase). Cover at minimum
every type in the mockup's `IFC_TREE` constant — copy it; it is already correct for IFC4.

```ts
// src/rule-draft.ts   (NEW)
export type ConditionOperator =
  | "exists" | "equals" | "oneOf" | "contains" | "startsWith" | "endsWith" | "matches" | "notExists";
export interface ConditionDraft {
  id: string;
  kind: "attribute" | "property";
  propertySet: string | null;   // required when kind === "property"
  name: string;
  operator: ConditionOperator;
  values: string[];             // used by oneOf
  text: string;                 // used by equals/contains/startsWith/endsWith/matches
}
export interface RuleDraft { id: string; name: string; entityTypes: string[]; conditions: ConditionDraft[]; }
export function compileDraft(rules: RuleDraft[]): ParsedSpecification[];
```
`compileDraft` is the in-memory equivalent of parsing the XML we would export — live preview uses it
so no serialisation happens per keystroke.

```ts
// src/parse-ids.ts   (EXTEND — breaking changes to its exported types are expected and fine)
export type ParsedRestriction =
  | { kind: "exact"; value: string }
  | { kind: "enum"; values: string[] }
  | { kind: "pattern"; source: string; regex: RegExp };

export interface ParsedAttributeFacet {
  kind: "attribute"; name: string;
  restriction: ParsedRestriction | null;
  cardinality: "required" | "prohibited";
}
export interface ParsedPropertyFacet {
  kind: "property"; propertySet: string; baseName: string; dataType: string | null;
  restriction: ParsedRestriction | null;
  cardinality: "required" | "prohibited";
}
```
Parse `<value><simpleValue>`, `<xs:restriction><xs:enumeration value=…>`, `<xs:pattern value=…>` and
the `cardinality` attribute. The old `patternSource`/`pattern` fields on the attribute facet are
replaced by `restriction`; update existing tests accordingly.

```ts
// src/facet-evaluation.ts   (EXTEND)
```
- `matchesApplicability` must honour inheritance: an element matches when its `ifcType` equals **or is
  a subtype of** any applicability entity name. This is what makes an `IFCELEMENT` rule work.
- `evaluateRequirement` must apply `restriction` to **both** attribute and property facets (today the
  property branch is presence-only) and handle `cardinality: "prohibited"` by inverting presence.
- Failure messages stay human-readable; they surface directly in the UI.

```ts
// src/build-ids.ts   (NEW)
export function buildIdsXml(rules: RuleDraft[], info?: { title?: string; date?: string }): string;
```
Operator → XML: `exists` no restriction · `equals` `<value><simpleValue>` · `oneOf` `xs:enumeration`
list · `contains`/`startsWith`/`endsWith`/`matches` `xs:pattern` · `notExists`
`cardinality="prohibited"`. **Regex-escape user text** when composing `.*X.*`, `X.*`, `.*X` — the
mockup does not, and that is a real bug to avoid. XML-escape all values.

**Required test:** round-trip — `parseIdsXml(buildIdsXml(drafts))` must equal `compileDraft(drafts)`
(compare `regex.source`, not RegExp identity). This is what proves the generator correct.

### `apps/web` — data layer

```ts
// src/local/parseAndValidate.ts   (EXTEND)
export async function parseIfcFileOnly(file: File, engine: EngineId):
  Promise<{ elements: NormalizedElement[]; parseMs: number; modelStructure: ModelStructureNode | null }>;
```
Reuses the existing `PARSE_BY_ENGINE` map. `parseAndValidateFile` must keep working unchanged.

```ts
// src/builder/introspect.ts   (NEW)
export interface FieldSummary {
  name: string; propertySet: string | null; hits: number; coverage: number;
  values: Array<{ value: string; count: number }>;   // distinct, most common first
}
export interface GroupSummary { name: string; types: string[]; count: number }
export interface TreeNode { name: string; kind: "group" | "type"; count: number; typeCount: number; children: TreeNode[] }
export interface ModelIntrospection {
  entityTypes: Array<{ name: string; count: number }>;
  groups: GroupSummary[];
  tree: TreeNode[];
  resolveTypes(names: string[]): string[];           // group name -> its member types present in file
  fieldsFor(names: string[]): {
    total: number;
    attributes: FieldSummary[];
    propertySets: Array<{ name: string; fields: FieldSummary[] }>;
  };
}
export function introspectModel(elements: NormalizedElement[]): ModelIntrospection;
```
**Group qualification rule** (agreed with the user — implement exactly, and test it):
1. A supertype qualifies only if it covers **2 or more** entity types present in the file.
2. When two supertypes cover the **identical set** of present types, keep only the **most specific**
   (deepest) one.
3. Drop `IfcProduct` and everything above it (`IfcObject`, `IfcObjectDefinition`, `IfcRoot`) — they
   can never discriminate.

Fields sort by `hits` descending; `coverage` is hits ÷ total elements in the selection.

```ts
// src/builder/evaluateDraft.ts   (NEW)
export interface RuleEvaluation {
  matched: number; passed: number; perCondition: number[];
  failures: Array<{ element: NormalizedElement; conditionIndex: number }>;
}
export function evaluateRuleDraft(rule: RuleDraft, elements: NormalizedElement[]): RuleEvaluation;
```
Must delegate to `compileDraft` + `matchesApplicability` + `evaluateRequirement`. Do **not**
re-implement matching logic — a second copy would drift from what export produces.

### `apps/web` — UI

New page under `src/builder/`: `RuleBuilderPage.tsx`, plus `ModelTree.tsx`, `RuleCard.tsx`,
`ConditionRow.tsx`, `ValuePicker.tsx`, `IdsXmlPreview.tsx`, `FailingElementsTable.tsx`.

`App.tsx` switches between the existing `IfcCheckerPage` ("Validate") and `RuleBuilderPage`
("Build rules"). No router dependency — local state is enough. Both tab buttons must carry
`data-smoke-route="validate"` / `data-smoke-route="builder"` so the browser check can reach them.

Behaviour, all demonstrated in the mockup:
- Left rail: one tree of inherited groups (branches) and entity types (leaves), each with counts;
  caret expands, label selects. Selecting drives the schema cards below (Attributes + one card per
  property set) showing coverage % and up to 3 sample values per field.
- Clicking a field adds a condition to the active rule (and adds the selected type to its
  applicability if absent).
- Rule card: editable name, applicability chips (types *and* groups, visually distinct), condition
  rows, live `passed/matched` bar, duplicate + delete, expandable failing-elements table.
- Condition row reads as a sentence: kind · property set · name · operator · value editor. The
  operator list is the single control for both restriction and cardinality. `oneOf` renders a
  checkbox list of observed values with counts, and marks values not present in the file.
- Duplicate buttons at **both** levels: whole rule, and single condition.
- IDS XML preview updates live; download produces a `.ids` file.

**CSS:** port the mockup's tokens and classes into `apps/web/src/styles.css`. Keep the existing
page's styles working. Carry over `.explorer > * { flex-shrink: 0 }` — without it the rail's cards
collapse and clip their own content, which is exactly what the `--visual` check now fails on.

## Waves and file ownership

| Wave | Owns | Depends on |
|---|---|---|
| A foundation | `ids-validator/src/ifc-type-hierarchy.ts`, `rule-draft.ts` (types only) | — |
| B validator | `ids-validator/src/parse-ids.ts`, `facet-evaluation.ts`, `rule-draft.ts` (compileDraft), `build-ids.ts`, `index.ts` + their tests | A |
| C web data | `apps/web/src/local/parseAndValidate.ts`, `apps/web/src/builder/introspect.ts`, `evaluateDraft.ts` + tests | A (B for evaluateDraft) |
| D UI | `apps/web/src/builder/*.tsx`, `App.tsx`, `styles.css` + tests | B, C |
| E review | read-only | D |

## Acceptance checklist (wave E verifies each, in the running app)

1. Load an IFC file on the Build rules page; tree shows entity types **and** inherited groups with counts.
2. Group qualification rules 1–3 hold on a real fixture.
3. Selecting a type or group shows attributes + property sets with coverage % and sample values.
4. Clicking a field adds a condition to the active rule.
5. All four condition dropdowns change the condition (the mockup's first draft had a bug where a
   re-render destroyed open selects — verify selects actually work).
6. All 8 operators evaluate correctly, including `must NOT be filled in`.
7. `oneOf` lists observed values with counts and supports values not present in the file.
8. Live pass/fail is correct at both rule and condition level; failing-elements table lists real elements.
9. Duplicate rule **and** duplicate condition both work.
10. Applicability accepts both concrete types and groups; a group rule matches subtype elements.
11. Exported XML parses back to an equivalent rule set (round-trip test green).
12. `node scripts/verify.mjs --visual` passes.
