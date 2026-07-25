# IDS Rule Builder — v1 Scope Sketch

> Status: **scope sketch, not an implementation plan.** Written to seed a fresh planning session — expect this to be re-scoped/broken into tasks before anyone starts coding. Not to be executed task-by-task as-is.

## Problem

Research into the IDS ecosystem (see `Decisions-Log.md`, research done 2026-07-24) found no tool that lets a non-technical user build an IDS file by pointing at a *real* IFC model and picking from what's actually in it. Existing tools (Solibri IDS Editor, BIMcollab, Excel→IDS converters) all require the author to already know Pset/property names from memory or a spreadsheet — that's the main authoring friction in IDS today.

This app already parses IFC files client-side into `NormalizedElement[]` (ifcType, attributes, propertySets) — see `apps/web/src/local/parseAndValidate.ts` and `@ifc-qa/parser-adapters`'s `./browser` export. That means "introspect this file and let me pick from what's really there" is nearly free to add: the hard part (parsing real files into structured data) is already solved. The new work is mostly the reverse direction — user-picked constraints → valid IDS XML — plus a UI for picking them.

## Core value prop for v1: derive rules from an example file, with live preview

1. User uploads one IFC file as a **worked example** (reuses the existing engine choice + parser adapters — no new parsing code needed, just a raw "parse without validating" entry point, since today `parseAndValidateFiles` requires an IDS file up front).
2. App shows the IFC entity types actually present in that file (from `NormalizedElement.ifcType`), not a static dropdown of every IFC class that exists.
3. User picks an entity type → app shows the attributes and property-set/property names **actually observed** on elements of that type in the uploaded file, with a few sample values per property (not just names) so the user can see what "typical" looks like before writing a rule.
4. User builds one or more conditions against those real names/values (see Facet & Restriction scope below).
5. **Live preview**: as soon as a rule has an applicability + at least one requirement, re-run it against the already-in-memory elements from the uploaded file and show pass/fail counts immediately — before export. This turns authoring into "define rule, see result now" instead of "define rule blind, export, validate separately elsewhere." This is the single biggest UX differentiator over existing tools and costs little extra, since the validation engine (`@ifc-qa/ids-validator`) already exists.
6. Export: serialize the built rules to spec-conformant IDS XML (new `buildIdsXml`, the reverse of the existing `parseIdsXml`) so the output is portable — usable in Solibri, BIMcollab, or any other IDS-consuming tool, not just this app.

## Facet & restriction scope for v1 (the "common 80%")

| Area | In scope for v1 | Out of scope for v1 |
|---|---|---|
| Applicability | `Entity` facet only (IFC type, picked from types observed in the uploaded file) | Classification/Material/PartOf-based applicability, PredefinedType filtering |
| Requirements | `Attribute` facet, `Property` facet (both already parsed by the existing `parse-ids.ts`) | `Classification`, `Material`, `PartOf` requirement facets |
| Value restrictions | Exact value, **enumeration** (multi-select from observed distinct values — a genuine UX win over hand-typing an enum list), **pattern** (exposed as friendly "contains / starts with / ends with / matches pattern" options that compile to regex under the hood, plus a raw-regex escape hatch) | Numeric bounds (`minInclusive`/`maxInclusive`), `length` restriction |
| Cardinality | Required (default), Prohibited (a "must NOT have / must NOT match" toggle per condition — cheap to add since it's just inverting the check) | Optional (spec allows it, but it's the least useful state and adds a third branch to every condition's UI for little payoff) |
| Combining conditions | Multiple conditions within one rule = AND (matches existing `validateElements` behavior: every requirement facet in a specification must pass). Multiple rules = OR-like, since each rule is its own `<specification>` and the existing pipeline already evaluates every specification independently against every element. | No boolean UI (nested AND/OR groups) — matches the IDS spec itself, which has no such construct either |
| IFC version targeting | Not read/written | `ifcVersion` on `<specification>` |
| Metadata | `name` per rule (maps to `<specification name="...">`, already what `ruleId` uses) | `title`/`author`/`purpose`/`milestone`/`instructions`/`identifier` file- and spec-level metadata |

This mirrors what `packages/ids-validator` already implements today (Entity applicability, Attribute + Property requirements) plus two additions that are natural extensions of existing code, not new architecture:
- **Property-level pattern/enum restrictions** — today `evaluateRequirement`'s property branch is presence-only; it needs the same restriction-checking `parseAttributeFacets` already does for attributes.
- **Prohibited cardinality** — inverts an existing pass/fail check, doesn't require new facet-parsing machinery.

## UI placement

Per established preference ([[feedback-single-page-ui]]), this should **not** become a new route/tab. It likely fits as a second mode/section on the existing single "Ifc Checker" page — e.g. a toggle or a collapsible panel: "Validate against an existing IDS" (current flow) vs. "Build a new IDS from an example file" (new flow) — rather than a separate page.

## Rough data model (for the next session to refine, not final)

```ts
interface RuleDraft {
  name: string;                 // -> <specification name>
  entityTypes: string[];        // -> one or more <entity><name> in <applicability>
  conditions: ConditionDraft[]; // -> <requirements>, ANDed
}

interface ConditionDraft {
  kind: "attribute" | "property";
  name: string;                  // attribute name, or property baseName
  propertySet?: string;          // required when kind === "property"
  cardinality: "required" | "prohibited";
  restriction?:
    | { type: "exact"; value: string }
    | { type: "enum"; values: string[] }
    | { type: "contains" | "startsWith" | "endsWith"; text: string }
    | { type: "pattern"; regex: string };
}
```

`buildIdsXml(rules: RuleDraft[]): string` would be the reverse counterpart to `parseIdsXml`, living in `packages/ids-validator` (or a new sibling package if the reverse direction feels large enough to warrant its own home — an open question for the next session).

## Open questions for the next planning session

- New package (`@ifc-qa/ids-builder`) vs. extending `@ifc-qa/ids-validator` with a `build-ids.ts` module?
- Exact UI interaction for "pick from observed property names/values" — a searchable list? Grouped by property set? How many sample values to show per property?
- Does "contains/starts with/ends with" need to visibly show the generated regex to a curious user, or stay fully hidden?
- Should the live-preview step reuse `validateElements` as-is (round-tripping the in-progress rules through actual XML generation on every keystroke) or evaluate `RuleDraft[]` directly against elements without serializing to XML first, then only serialize on export? (Round-tripping through real XML is a good acceptance test that the generator itself is correct; direct evaluation is likely cheaper/faster for a responsive live preview.)
- Editing/importing an existing hand-written IDS file into the builder (round-trip) — explicitly deferred out of v1, but worth flagging as a likely v2 ask.
- How to introspect a file for the "worked example" step without requiring an IDS file up front — `parseAndValidateFiles` currently always requires one; will need a raw parse-only entry point (the underlying `parseWebIfcBuffer`/`parseIfcLiteBuffer` functions already exist and could be called directly, bypassing `parseAndValidateFile`'s IDS-required wrapper).

## Explicit non-goals for v1

- Classification, Material, PartOf facets (both authoring and applicability)
- Optional cardinality
- Numeric bounds / length restrictions
- `ifcVersion` targeting
- File-level/spec-level metadata beyond the rule name
- Importing/editing a foreign hand-written IDS file
- Multi-file "derive rules from several example files at once" (single worked example only)
