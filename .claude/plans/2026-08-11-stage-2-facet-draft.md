# Stage 2 — `ConditionDraft` becomes `FacetDraft`

Plan written 2026-08-11 against the code as it stands on `master` at `ef10cfb`, the vendored
`ids.xsd` 1.0.0, and the 7,784-file corpus at `/tmp/ids-corpus`. Continues
`.claude/plans/2026-08-07-full-ids-scope.md`, whose stage 2 section states the target shape.

Everything numbered below is measured today, not estimated. Where a number is a prediction it says
so and says what biases it.

---

## Start state, measured today

| gate | command | reading |
| --- | --- | --- |
| conformance | `corepack pnpm --filter @ifc-qa/ids-validator test:conformance` | **302 agreed / 18 wrong / 14 refused / 0 errored** of 334 |
| corpus round-trip | `npx tsx .claude/plans/corpus-roundtrip.mjs /tmp/ids-corpus` | **7,784 / 7,784 reproduced**, 0 drifted, **279 facets passed through** |
| unit tests | `corepack pnpm --filter @ifc-qa/ids-validator test` | 382 passed, 11 files |

Working tree clean. `master` already carries the merge of `feat/full-spec-authoring-ui` (`ef10cfb`,
local only — `origin/master` is still at `e2fc39f`).

---

## What stage 2 can actually claim

The 279 passed-through facets, broken down by the reason `readFacet` gave. This is the first time
the reasons have been counted; it is what the per-facet reason strings from the last session bought.

| reason `readFacet` gave | facets | claimed by |
| --- | --- | --- |
| `<classification>` is neither an attribute nor a property | 47 | stage 4 |
| property carries `instructions` | 41 | **stage 2** |
| `<partOf>` is neither | 39 | stage 4 |
| `<material>` is neither | 34 | stage 4 |
| attribute carries `instructions` | 26 | **stage 2** |
| `<entity>` is neither | 25 | stage 4 |
| value is "a range or a length" — **bounds** | 18 | **stage 2** |
| value is "a range or a length" — **length** | 6 | stage 3 |
| value is "a range or a length" — **neither** | 8 | see below |
| property set or property name is a pattern | 8 | pattern-valued names |
| property carries `<name>` | 7 | never — not in `ids.xsd` |
| property carries `uri` | 5 | **stage 2** |
| property carries `measure` | 5 | never — not in `ids.xsd` |
| attribute `cardinality="optional"` | 4 | **stage 2** |
| attribute name is a pattern | 4 | pattern-valued names |
| property `cardinality="optional"` | 2 | **stage 2** |

**Stage 2's claim is 96 facets: 279 → 183.** Instructions 67, bounds 18, `uri` 5, optional
cardinality 6.

Two entries in that table are permanent. `<name>` on a property and `measure` on a property are not
in `ids.xsd` at all — those 12 facets are IDS 0.9-era files, and passing them through verbatim is
the correct and final answer for them. They should be re-labelled during this work so the reason
says so, rather than implying a capability that is coming.

### The 8 "neither" facets are three distinct things, and the message hid all of them

`readRestriction` refuses everything it cannot read with one sentence — "such as a range or a
length". Reading the XML of the facets it refused shows that sentence is wrong about 8 of them:

- **`xs:annotation` inside `<xs:restriction>` (2).** The author's own documentation of the rule.
  This is the direct evidence for correction 1 below.
- **A non-string base (1).** `<xs:restriction base="xs:double">` carrying two `xs:enumeration`
  children. `readRestriction` refuses any base but `xs:string`.
- **Two `xs:pattern` children (3+).** A regex OR — the same mechanism as the 1 remaining
  `restriction` conformance case.

Splitting that one message into three is cheap and belongs in C1, because the refactor rewrites the
function anyway.

---

## Three corrections to the target shape

The stage 2 section of the scope plan sketches `FacetDraft`, `ValueDraft` and a flat `FacetCommon`.
Checked against `ids.xsd`, the sketch is wrong in three places. All three matter, because a draft
model *wider* than the schema emits invalid XML, exactly as a model narrower than the file drops
data silently — the two failure modes this codebase is organised against.

**1. `annotation` belongs on `ValueDraft`, not on `FacetCommon`.** No facet in `ids.xsd` carries an
annotation attribute or child. `xs:annotation` appears inside `xs:restriction`, from the imported
`XMLSchema.xsd`, which is exactly where the two refused corpus facets carry it. It is a property of
the value restriction, so it travels with the value.

**2. `uri` is not on every facet.** `ids.xsd` puts `uri` on `classification`, `property` and
`material` only. `attribute`, `partOf` and `entity` have none. A flat `FacetCommon.uri` would let
the model state a `uri` on an attribute, and `build-ids` would then either emit it (a document no
conforming checker accepts) or drop it (silent loss).

**3. `cardinality` is not on every facet, and there are two alphabets.**

| facet | `cardinality` | alphabet |
| --- | --- | --- |
| entity | **none** | — always required; the XSD comments say so outright |
| partOf | yes | `simpleCardinality` — `required` \| `prohibited` |
| classification, attribute, property, material | yes | `conditionalCardinality` — `required` \| `optional` \| `prohibited` |

`instructions` is the only member of the sketched `FacetCommon` that really is on all six.

---

## The shapes

```ts
/** On every facet. The only field `ids.xsd` gives all six. */
interface FacetDraftCommon {
  id: string;
  instructions: string | null;
  /** Whether the source wrote `cardinality` out. IDS defaults it to `required`, so this changes
   *  no meaning — but a file the user only opened must come back out as it went in. */
  explicitCardinality?: boolean;
}

type ConditionalCardinality = "required" | "optional" | "prohibited";
type SimpleCardinality = "required" | "prohibited";

type FacetDraft =
  | ({ kind: "entity";  name: ValueDraft; predefinedType: ValueDraft | null } & FacetDraftCommon)
  | ({ kind: "attribute"; name: ValueDraft; value: ValueDraft | null;
       cardinality: ConditionalCardinality } & FacetDraftCommon)
  | ({ kind: "property"; propertySet: ValueDraft; baseName: ValueDraft; value: ValueDraft | null;
       dataType: string | null; uri: string | null;
       cardinality: ConditionalCardinality } & FacetDraftCommon)
  | ({ kind: "classification"; system: ValueDraft | null; value: ValueDraft | null;
       uri: string | null; cardinality: ConditionalCardinality } & FacetDraftCommon)
  | ({ kind: "material"; value: ValueDraft | null; uri: string | null;
       cardinality: ConditionalCardinality } & FacetDraftCommon)
  | ({ kind: "partOf"; entityName: ValueDraft; predefinedType: ValueDraft | null;
       relations: string[]; cardinality: SimpleCardinality } & FacetDraftCommon);

type ValueDraft =
  | { kind: "simple";  value: string;   annotation?: string | null }
  | { kind: "enum";    values: string[]; base?: string | null; annotation?: string | null }
  | { kind: "pattern"; source: string;  annotation?: string | null }
  | { kind: "bounds";  min: BoundDraft | null; max: BoundDraft | null; annotation?: string | null };

interface BoundDraft { value: string; inclusive: boolean }
```

Notes on the departures from `ParsedRequirementFacet`, each with its reason:

- **`partOf` is flattened, not nested.** The sketch says `{ entity: EntityDraft; relation }`. The
  parsed form is already `{ relations, entityName, predefinedType }`, and `relations` is a list
  because `ids.xsd` gives the enumeration a member that is itself two names separated by a space.
  Matching the parsed form keeps `compileFacet` a field copy.
- **`BoundDraft.value` is a string, not a number.** The draft stores what the author wrote.
  `"1.50"` must re-export as `"1.50"`, and `parseIdsXml` was already changed once
  (`parseTagValue: false`) for exactly this reason. `compileValue` casts to `ParsedBound.value`.
- **`enum` carries an optional `base`.** One corpus facet is an `xs:double` enumeration. Without
  the base the exporter would retype it to `xs:string`.
- **No `length` variant yet.** See D4 below.

### The one-way compile

```ts
compileValue(value: ValueDraft | null): ParsedRestriction | null   // total, no throw
compileFacet(facet: FacetDraft): ParsedRequirementFacet            // total over all six
```

`FacetDraft` stays a separate type from `ParsedRequirementFacet` rather than replacing it. The draft
carries source fidelity — `explicitCardinality`, the author's literal `"1.50"`, whether a single
value was written as a one-member enumeration; the parsed form carries a compiled `RegExp` and
nothing about how the file was written. Merging them would push fidelity flags into the validator or
drop them from the importer.

### The friendly operators become derived, never stored

```ts
operatorOf(facet: FacetDraft): ConditionOperator | null   // null when no friendly reading fits
valueDraftForOperator(operator: ConditionOperator, text: string, values: string[]): ValueDraft | null
```

`readAffixPattern` moves out of `import-ids.ts` into this layer, so the importer and the UI derive
the same reading from the same function. This is what makes the switch safe: a pattern is stored as
`{ kind: "pattern", source }` and re-exports character for character no matter how it is displayed,
so presentation stops touching storage.

`notExists` leaves storage entirely — it was cardinality wearing an operator's clothes. The UI keeps
showing it, derived from `cardinality === "prohibited"` with no value.

---

## Commit sequence

One mechanism per commit. Every commit runs all three gates and reports the direction, not the
total. `node scripts/verify.mjs --visual` is the gate for the UI commits.

| | commit | conformance | round-trip | pass-through |
| --- | --- | --- | --- | --- |
| **C1** | `ValueDraft` replaces the `operator`/`values`/`text` triple | 302, unmoved | 7,784 | **279, unmoved** |
| **C2** | cardinality becomes orthogonal to value | 302, unmoved | 7,784 | 279 → **273** |
| **C3** | the importer reads bounds | 302, unmoved | 7,784 | 273 → **255** |
| **C4** | `instructions`, and `uri` where the schema allows it | 302, unmoved | 7,784 | 255 → **183** |
| **C5** | the union widens to all six facet kinds | 302, unmoved | 7,784 | 183, unmoved |

**C1 is the risky one and carries nothing else.** It is a pure reshape: no new capability, no
refusal removed, both numbers byte-identical. If C1 moves a conformance number, something leaked
from the draft model into the validator, and that is the whole reason it lands alone.

**C2.** `readOperator`'s two refusals go away. Note what the corpus says: it holds **6** optional
facets and **0** prohibited-with-a-value ones. The orthogonality argument is about capability, not
about corpus count, and the measured win here is 6. Stated rather than hidden.

**C3.** `build-ids` already emits bounds (base `xs:double`); only the reader is missing. `import-ids`
refuses a non-string base before bounds reach it, so that check has to learn the difference between
"a base I cannot reproduce" and "the base bounds are written with".

**C4.** The largest single win on the board, and the cheapest — two attributes carried through a
model that already has somewhere to put them.

**C5.** Defines the four new variants and makes `build-ids` and `compileDraft` total over them,
tested by constructing drafts directly. The importer still refuses those four kinds, so no number
moves. This is what makes stage 4 purely additive.

### The predictions are first-reason-wins, and that biases them

`readFacet` returns the first reason that fires and stops. A facet carrying both `instructions` and
a bounds value is counted once, under `instructions`, because the unknown-attribute check runs
first. So removing one reason can expose another underneath it, and the per-commit deltas above are
estimates. **The only invariant that must hold at every commit is that the total never rises.** If a
commit claims fewer than predicted, the facets that did not move should be re-read before the next
one — the exposed reason is information, not noise.

---

## Blast radius

**No change at all**: `parse-ids.ts`, `validate-elements.ts`, `facet-evaluation.ts`. None of them
imports the draft model; the dependency runs one way, from `rule-draft.ts` into `parse-ids.ts`. The
brief's "bring `parse-ids` onto the new shape" does not apply — `parse-ids` produces the target of
the compile, not a consumer of the draft. The only `parse-ids` change stage 2 needs is none;
`ParsedRestriction` gains its `length` variant in stage 3.

**Rewritten**: `rule-draft.ts` (the model, `compileFacet`, `compileValue`, the operator layer),
`import-ids.ts` (`readFacet`, `readOperator`, `readRestriction`), `build-ids.ts` (`facetXml`,
`restrictionXml`).

**Follows the model**: `apps/web/src/builder/` — `ConditionRow.tsx`, `RuleCard.tsx`,
`RuleBuilderPage.tsx`, `completeness.ts`, `evaluateDraft.ts`, `FailingElementsTable.tsx`,
`IdsXmlPreview.tsx`, `importIds.ts`. Nine test files beside them.

`FailingElementsTable.readConditionValue` is the one UI site that reads a condition's *shape* rather
than displaying it — it switches on `kind` to find the stored value. It needs a case per facet kind
in C5, or an explicit "not shown for this facet kind" for the four that land in stage 4.

---

## Decisions taken, with reasons

- **D1. Two types, one direction.** `FacetDraft` mirrors `ParsedRequirementFacet` and compiles into
  it. Neither replaces the other.
- **D2. `annotation` on `ValueDraft`.** Measured: that is where the corpus puts it and where
  `XMLSchema.xsd` allows it.
- **D3. `uri` and `cardinality` per variant.** `ids.xsd` does not give them to every facet, and a
  flat common shape would let the model state what the schema forbids.
- **D4. `length` waits for stage 3.** `ValueDraft` gains the four kinds `ParsedRestriction` already
  compiles. Adding `length` before the validator can check it makes `compileValue` partial and lets
  a draft hold a requirement `isEvaluable` cannot see — the widening the guard rail forbids. Cost of
  waiting, measured: 6 corpus facets.
- **D5. The four new variants are defined in C5 but produced only in stage 4.** Reading an imported
  classification into a `FacetDraft` the UI cannot draw would make it vanish from the rule card —
  a silent loss strictly worse than the pass-through it replaced. Each of the four lands in stage 4
  together with the row that shows it.
- **D6. Friendly operators derived, never stored.**

### `isEvaluable` narrows, never widens

`compileDraft` builds `unsupported` from `passThrough`, and `isEvaluable` refuses a specification
whose every requirement was dropped. As facets become representable, `passThrough` shrinks and some
specifications become evaluable that were not. That is not the widening the guard rail forbids: a
facet moves out of `passThrough` and into `facets` in the same commit, so nothing becomes evaluable
while a requirement it states is still unrepresented.

Pin it with a test rather than an argument: **for every imported rule,
`facets.length + passThrough.length` equals the facet count of its source `<requirements>`.** That
assertion fails loudly if a facet is ever read into the model and then not compiled, which is the
one way this refactor could produce a false pass.

---

## Open, and worth deciding before C4

1. **Does `instructions` get a control, or only a display, in stage 2?** Carrying it through the
   model is what claims the 67 facets. Editing it is stage 5 (metadata). A read-only line on the
   facet row is enough for stage 2 and keeps the row from growing a text box per facet.
2. **The 12 permanent pass-throughs** (`<name>` 7, `measure` 5) should get a reason that says "not
   in IDS 1.0, kept verbatim on purpose" rather than one implying a capability is coming. Cheap,
   and it belongs in C1 with the other message splits.
