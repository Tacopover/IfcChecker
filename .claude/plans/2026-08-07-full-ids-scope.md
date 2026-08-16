# Next version — full IDS 1.0 support

Scope for authoring, importing and editing every construct in IDS 1.0. Written 2026-08-07 against
the authoritative schema (`buildingSMART/IDS@development`, `Schema/ids.xsd` version 1.0.0) and the
User Manual beside it, with usage frequencies measured over the **464 hand-authored specifications**
in the goal 3a corpus (the whole corpus minus bSI Japan, which is machine-generated and swamps any
total it is in).

Read `goals.md` §3 and `.claude/plans/2026-07-25-ids-import-scope.md` first — this continues them.

---

## Headline: one bug, and one cost that is not where it looks

**1. We export schema-invalid IDS today.** `applicabilityType` allows **one** `<entity>` element:

```xml
<xs:element name="entity" type="ids:entityType" minOccurs="0"/>   <!-- maxOccurs defaults to 1 -->
```

`buildIdsXml` emits one `<entity>` per entity type, so any rule with two or more types produces a
document no conforming checker will accept:

```xml
<applicability minOccurs="1" maxOccurs="unbounded">
  <entity><name><simpleValue>IFCDUCTSEGMENT</simpleValue></name></entity>
  <entity><name><simpleValue>IFCDUCTFITTING</simpleValue></name></entity>
</applicability>
```

Multiple types must be a single `<entity>` whose `<name>` is an `xs:enumeration`. **0 of 464
hand-authored specifications** emit two `<entity>` elements — the corpus round-trip never caught
this because no real file does it, and our own importer reads it back happily. Multi-type rules are
a headline builder feature (the inherited-type group chips), so this is likely affecting real
exports now. Small fix, should not wait for the rest of this work.

**2. The expensive part is the parser, not the UI.** `NormalizedElement` is:

```ts
{ globalId, ifcType, predefinedType, name, attributes, propertySets }
```

There is no material, no classification, and no relationship data. **Three of the six facets have
nothing in the model to check against** — classification, material and partOf are parser and
adapter work across both engines, before a single control is drawn. Anyone estimating this from the
UI side will be badly wrong.

The good news: `predefinedType` is already on the element and already readable by
`facet-evaluation.ts`, so the entity facet's second parameter is nearly free.

---

## Where we are against the schema

Six facets, each usable in **applicability** (which elements the rule is about) and **requirements**
(what they must satisfy). Counts are facet occurrences across the 464 hand-authored specifications.

| Facet | Parameters | In applicability | In requirements | We support |
| --- | --- | --- | --- | --- |
| **entity** | name, predefinedType | 452 | 26 | name only, applicability only |
| **property** | propertySet, baseName, value, `dataType` | 13 | 310 | ✅ requirements; ❌ applicability |
| **attribute** | name, value | 7 | 175 | ✅ requirements; ❌ applicability |
| **classification** | system (required), value, `uri` | 3 | 51 | ❌ |
| **material** | value, `uri` | 3 | 41 | ❌ |
| **partOf** | entity (nested), `relation` | 0 | 40 | ❌ |

**The single most useful finding for prioritising: applicability is nearly always just an entity.**
452 of 464 specifications select by entity alone; only 12 use anything else, and only 26 non-entity
applicability facets exist in the whole hand-authored corpus. Requirements are where the richness
is — 158 facet occurrences we cannot represent, against 26 on the applicability side.

So **requirement facets first, applicability facets last.** That inverts the order the schema
presents them in, and it is the opposite of what "full support" instinctively suggests.

### Restrictions

`idsValue` is either a `<simpleValue>` or an `<xs:restriction>`. Four restriction kinds exist:

| Kind | XSD facets | Uses | We support |
| --- | --- | --- | --- |
| **Enumeration** | `xs:enumeration` | 1095 | ✅ |
| **Pattern** | `xs:pattern` | 90 | ✅ |
| **Bounds** | `minInclusive` 19, `minExclusive` 47, `maxInclusive` 19, `maxExclusive` 7 | 92 | ❌ |
| **Length** | `length` 2, `minLength` 4, `maxLength` 4 | 10 | ❌ |

Plus `xs:annotation`/`xs:documentation` inside a restriction (16 uses) — the author's own
explanation of the rule, which we currently force to pass-through.

**Bounds are worth nine times what length is.** Both are cheap once there is a restriction editor,
but bounds carry a real dependency: numeric comparison needs the IFC value converted to the SI unit
IDS assumes (`Documentation/UserManual/units.md`). A `>= 10` on `NetFloorArea` compared against a
model authored in mm² is silently wrong — and wrong in the approving direction if the raw number
happens to be larger.

### Cardinality

| Where | Allowed | We support |
| --- | --- | --- |
| entity (requirements) | none — always required | n/a |
| partOf | `required`, `prohibited` | ❌ |
| classification, attribute, property, material | `required`, `prohibited`, `optional` | required + prohibited |
| applicability (`minOccurs`) | 0 = subset optional, 1 = at least one must exist | ✅ read and enforced (2026-08-09) |

`optional` means "if present it must comply, but it may be absent" — a genuinely different check we
currently pass through rather than run. Hand-authored applicability: 64 say `minOccurs="0"`, 47 say
`"1"`, 353 omit it (the XSD default is 1, so our output matches the default — this is a missing
capability, not a bug).

### Metadata we currently carry but cannot edit

Since the import work, all of this survives a round trip untouched — but only if the user does not
touch the rule. None of it is editable, and none of it can be authored from scratch:

- `<info>`: title, copyright, version, description, author (email-shaped), date, purpose, milestone
- `<specification>`: identifier, description, instructions, ifcVersion (`IFC2X3` / `IFC4` /
  `IFC4X3_ADD2`, a space-separated list — 344 of 464 say `"IFC2X3 IFC4"`)
- `<requirements description>`, and per-facet `instructions` and `uri`

---

## The central refactor: `ConditionDraft` becomes a facet

This is the piece everything else waits on, and it is a breaking change through import, export,
evaluation and UI.

Today's model conflates two independent things into one `operator` field:

```ts
operator: "exists" | "equals" | "oneOf" | "contains" | "startsWith" | "endsWith" | "matches" | "notExists"
```

`exists`/`notExists` are **cardinality**; the other six are **restrictions**. IDS treats them as
orthogonal — you can have `prohibited` *with* a value ("must not be Steel"), which our model cannot
say at all, and which is why the importer passes those facets through today.

The replacement is a discriminated union mirroring the schema, with cardinality and restriction as
separate fields:

```ts
type FacetDraft =
  | { kind: "entity";         name: ValueDraft; predefinedType: ValueDraft | null }
  | { kind: "attribute";      name: ValueDraft; value: ValueDraft | null }
  | { kind: "property";       propertySet: ValueDraft; baseName: ValueDraft;
                              value: ValueDraft | null; dataType: string | null }
  | { kind: "classification"; system: ValueDraft; value: ValueDraft | null }
  | { kind: "material";       value: ValueDraft | null }
  | { kind: "partOf";         entity: EntityDraft; relation: Relation | null };

type ValueDraft =
  | { kind: "simple";  value: string }
  | { kind: "enum";    values: string[] }
  | { kind: "pattern"; source: string }
  | { kind: "bounds";  min: Bound | null; max: Bound | null }   // Bound = { value, inclusive }
  | { kind: "length";  exact: number | null; min: number | null; max: number | null };

interface FacetCommon { id: string; cardinality: "required" | "optional" | "prohibited";
                        instructions: string | null; uri: string | null; annotation: string | null }
```

**Keep the friendly operators as a shortcut layer over this, not as the storage.** "contains X" stays
the fastest way to express `.*X.*` and should remain the default presentation — but derived from a
pattern `ValueDraft`, the way the importer already derives it. The lesson from the import work
applies unchanged: the moment the data model is narrower than the file, something gets silently
dropped.

Once `ValueDraft` covers all four restriction kinds and `FacetDraft` all six facets, **the XSD has
no construct left over** — nothing needs pass-through except prose we choose not to surface. The
pass-through machinery should stay regardless, as the safety net for IDS 1.1.

---

## UI: keeping it accessible

The concern is real. A rule today shows entity chips and a flat condition list. Full IDS means six
facet types on both sides of the rule, each with up to four parameters, each parameter with five
possible value shapes, plus cardinality, instructions and a URI. Rendered naively that is a form
with ~20 controls per facet and it will be unusable.

Three things make it tractable, and they matter more than which page anything sits on.

### 1. One collapsed line per facet

The unit of the UI is a **facet row** that reads as a sentence when collapsed and becomes a form
when opened. Everything else follows from this — it is what keeps a 12-facet specification
scannable.

```
▸ Property   Pset_WallCommon · FireRating   is one of 60, 90              required   ⧉ 🗑
▸ Material   is Concrete                                                  prohibited ⧉ 🗑
▸ Part of    an IfcSpace, contained in spatial structure                  required   ⧉ 🗑
▸ Class.     Uniclass 2015 · starts with EF_25_10                         optional   ⧉ 🗑
```

The existing `ConditionRow` is already close to this. The work is generalising it to six kinds and
making the collapsed state a readable sentence rather than a row of inputs.

### 2. One restriction editor, everywhere

A single control behind every value parameter, with the shape picked by a small selector: *is* /
*is one of* / *matches* / *between* / *length*. Same control for an entity name, a property value, a
classification code, a material. Learn it once. This is also what makes the "friendly operator"
shortcut layer possible — `contains` is a preset of the pattern shape.

Bounds get numeric inputs with inclusive/exclusive toggles and, critically, **a unit label derived
from `dataType`** so the user can see they are typing SI.

### 3. The explorer rail must cover the new facets

The builder's whole promise is *everything offered comes from your own file*. Adding classification,
material and partOf facets without extending the rail breaks that promise exactly where users are
least confident — nobody remembers their classification system's spelling.

So the rail gains sections fed by the same parser work the validator needs:

```
In your model
  Types            IfcWall (34), IfcDoor (12) …
  Property sets    Pset_WallCommon, MEP_Data …
  Classifications  NL/SfB · 21.22 (18), 22.11 (7) …      ← new
  Materials        Concrete (54), Steel (12) …           ← new
  Systems & spaces IfcSpace (8), IfcDistributionSystem   ← new, feeds partOf
```

This is the argument for doing the parser work first: it is not just validation plumbing, it is what
keeps the UI friendly.

### Should the page split?

**Recommendation: not yet, and probably not the way it first appears.** Standing preference is one
consolidated page, with a route earned only by a genuinely heavy workflow. With collapsed facet rows
a full specification is roughly the height of today's expanded rule card, so the page holds.

What does deserve its own surface is **document-level metadata** — title, author, version, purpose,
ifcVersion targeting, and the per-specification identifier/description/instructions. That is a
different task from writing rules (you do it once, at the start or the end), it is ~12 fields, and
interleaving it with rule editing would clutter the thing we are trying to keep clean. A collapsible
panel at the top of the page is probably enough; a small modal is the fallback.

The honest trigger for splitting is measurable, so it should be measured rather than guessed: if a
typical imported national standard (NL BIM Basis ILS, RVB BIM Norm — both already in the corpus)
cannot be scanned without the rule list scrolling past two screens, revisit. Suggest re-deciding
after stage 4 below, with a real file on screen.

One genuine split to consider separately: **applicability and requirements as two columns** inside
an open rule, rather than stacked. They are symmetric in the schema and the two-column form makes
"which elements / what they must satisfy" legible at a glance. Cheap to try, easy to revert.

---

## Suggested staging

Ordered so each stage is independently shippable and testable, and so the riskiest unknown (parser
data) is faced first rather than last.

**Stage 0 — fix the multi-entity export — DONE 2026-08-07.** Emitted as one `<entity>` with an
`xs:enumeration`, which forced both readers to learn to read one, which turned up two more things
the schema check then found. Written up below; the corpus still round-trips 7,784/7,784.

**Stage 1 — model data for the missing facets.** Extend `NormalizedElement` with materials,
classifications and the five partOf relationships; implement in both the ifc-lite and web-ifc
adapters; extend the fixtures. No UI. Watch the scale constraint — these are new traversals over
models up to 1.6 GB, and the adapter-parity tests will need new cases. Biggest and least certain
stage; worth a spike before committing to an estimate.

**Stage 2 — the `FacetDraft` refactor.** Reshape the draft model, then bring `parse-ids`,
`build-ids`, `import-ids` and `validate-elements` onto it. Cardinality and restriction become
orthogonal. The existing corpus round-trip is the safety net — it must stay at 7,784/7,784
throughout, and the number of specifications needing pass-through should fall as facets land.

**Stage 3 — restrictions: bounds and length.** Plus the unit conversion bounds depend on, and the
`dataType` picker that makes it meaningful. Bounds before length (92 uses against 10).

**Stage 4 — requirement facets in the builder.** classification, material, partOf, entity, in that
order of corpus frequency (51 / 41 / 40 / 26), with the collapsed facet row and the shared
restriction editor. Explorer rail sections land alongside the facets they feed.

**Stage 5 — applicability facets, cardinality and metadata.** The long tail: non-entity
applicability (26 occurrences total), `optional` cardinality, `minOccurs="0"`, per-facet
instructions and uri, and the document metadata panel.

**Throughout:** every stage that touches representability should reduce, never increase, what the
importer passes through — and the "refuse rather than half-understand" rule from §3e holds for all
six facets. A partly-understood classification applicability must refuse exactly as a partly
understood entity one does today.

---

## What stage 0 turned up

Fixing the export meant `parse-ids` and `import-ids` had to read an entity-name enumeration, since
otherwise our own output would be a document we could not read back. That pulled two further
problems into the light, both worse than the bug being fixed.

**156 of 464 hand-authored specifications were reporting green having checked nothing.** Once an
enumeration applicability is readable, a specification whose *every* requirement we had to drop
still selects its elements, finds nothing wrong with any of them, and passes. That is §3e's
false-pass exactly, sitting on the requirements side where nobody had looked. `isEvaluable` now
refuses a specification with no checkable requirement left, and the count of runnable hand-authored
specifications drops from 426 to 270. The 156 break down as classification 44, partOf 35, material
32, entity 25, and 20 whose property or attribute *name* is a pattern rather than a plain name —
which sums exactly to the facet frequencies above, so the measurement is sound.

This is the strongest argument yet for the stage ordering: every one of those 156 becomes a real
check as its facet lands, and until then it is honestly reported as unchecked.

**Two smaller ones, both found by the new schema check rather than by review:**

- `<info>` children have a schema-fixed order, and `buildIdsXml` appended carried-through ones
  after `<date>`. Any imported file with an `<author>` or `<version>` came back out invalid. The
  `mixed-fidelity.ids` fixture had the same fault, written by the same wrong assumption.
- A single-member `xs:enumeration` of entity names was being rewritten as a `<simpleValue>`. Same
  meaning, but a diff on the author's file — `ImportedRuleSource.entityNamesAsEnumeration` now
  carries the form.

`idsSchemaViolations()` encodes the structural rules of `ids.xsd` — element order and cardinality,
required elements and attributes, enumerated attribute values, and the `idsValue` choice. It is not
a full XSD validation and does not pretend to be. Three corpus files are schema-invalid on the way
*in* (two have `<n>` where `<name>` belongs, from markdown mangling); we reproduce them faithfully
rather than silently correcting someone else's document, and the count out equals the count in.

---

## Open questions for the user

1. **Two columns or stacked** for applicability vs requirements inside an open rule.
2. **Is `partOf` worth stage-4 placement** for MEP work specifically? It is 40 occurrences in the
   corpus, but "is this duct assigned to a distribution system" is the kind of check that is hard to
   do any other way, and may be worth more here than the corpus average suggests.
3. **How far to go on units.** Full SI conversion for every measure type is a large table; the
   alternative is supporting bounds only for unitless types at first and refusing the rest loudly.
4. **Whether `optional` cardinality should be evaluated or kept refused.** It is the one cardinality
   whose meaning ("if present, comply") differs from what we do today, and getting it wrong fails in
   the approving direction.

---

## Conformance baseline — measured 2026-08-09

The independent check now exists, in two tiers. Everything below is measured, not estimated.

### Tier A — schema conformance, in the gate

Every document we emit is validated against the real `ids.xsd` (vendored at
`packages/ids-validator/schema/`) by libxml2 compiled to WebAssembly (`xmllint-wasm`, a
devDependency). No Python, no native build, no network, so there is no path on which the check
skips itself and reads green. It runs inside the existing test stage of `scripts/verify.mjs`.

Coverage: the three IDS fixtures as they stand, their re-exports, and 24 generated documents
spanning all 8 condition operators × attribute/property × 7 hostile strings × 3 entity-count
shapes, plus 12 negative controls that must be rejected.

**It found one thing on the first run.** `mixed-fidelity.ids` carried `minOccurs="1"` on
`<specification>`, which `specificationType` does not allow — and **0 of the 7,784 corpus files do
it either**, so the comment in `rule-draft.ts` claiming real files put `minOccurs` there was simply
wrong. `idsSchemaViolations` never checked specification attributes beyond `name` and `ifcVersion`,
so it could not see it. The fixture is fixed; the exporter needed no change, because carrying an
attribute verbatim is the intended behaviour even when the source was invalid.

**Decision on `idsSchemaViolations`:** kept, as the fast in-process check the browser can run per
keystroke — the wasm validator is a 4 MB module and async, which the live preview cannot afford. It
is demoted to a convenience: `ids.xsd` is the authority. A test asserts the two reach the same
verdict on the whole fixture + authored + negative-control corpus, so a future divergence fails
loudly rather than quietly.

### Tier B — verdict conformance, a scoreboard with a ratchet

buildingSMART's official suite, fetched by `scripts/fetch-conformance-cases.mjs` (sparse clone,
~3 MB) rather than vendored, and run by `pnpm --filter @ifc-qa/ids-validator test:conformance`.
Deliberately **not** in the gate: the suite is not in the repo, and a gate stage that skips when it
is absent is worse than no stage. The recorded baseline is `conformance-baseline.json`; the only
assertion is that no case we get right today starts failing.

The suite has grown since scoping: **326 cases** at `buildingSMART/IDS@d4341b74`, not 318, and a
third filename prefix — `invalid-` (27 cases), a specification that asks something nonsensical and
must therefore fail. `pass-` 183, `fail-` 116.

| group | cases | agreed | wrong | refused |
| --- | --- | --- | --- | --- |
| attribute | 56 | 34 | 18 | 4 |
| classification | 27 | 0 | 0 | 27 |
| entity | 25 | 0 | 0 | 25 |
| ids | 12 | 8 | 4 | 0 |
| material | 29 | 0 | 0 | 29 |
| partof | 34 | 0 | 0 | 34 |
| property | 82 | 51 | 23 | 8 |
| restriction | 25 | 16 | 9 | 0 |
| tolerance | 36 | 18 | 18 | 0 |
| **total** | **326** | **127** | **72** | **127** |

**127 agreed, 72 wrong, 127 refused, 0 errored.** No case crashed the parser or the validator,
which is the one pleasant surprise.

The 127 refusals are honest: `classification`, `material`, `partOf` and requirement-side `entity`
are whole facets we do not implement, and 12 more are a property or attribute *name* given as a
pattern. They map exactly onto the facet table above. **Refusal is counted separately from a wrong
answer on purpose** — "we do not know" and "we got it wrong" are different failures, and folding
them together would hide both.

### The 72 wrong answers, split by direction

**34 false passes** (we approve what must fail — the dangerous direction): attribute 16,
property 10, restriction 5, ids 3.
**38 false fails** (we reject what must pass): tolerance 18, property 13, restriction 4,
attribute 2, ids 1.

**The single biggest finding: 28 of the 34 false passes report `0 applicable, 0 passed, 0 failed`.**
This is the same false-pass shape stage 0 fixed on the requirements side, now visible on the
applicability side — a specification that matches no element at all reports the model clean.

Reading the applicability of each of those 28 splits them almost entirely one way:

- **27 target an entity type `element-filter.ts` drops.** It keeps `IfcElement`, `IfcSpace` and
  `IfcSpatialZone`; IDS targets *any* IFC entity, and the suite does — `IfcSurfaceStyleRefraction`
  (8), `IfcTask` (3), `IfcPresentationLayerWithStyle`, `IfcPerson`, `IfcCartesianPoint`,
  `IfcMaterial`, `IfcProject`, **`IfcWallType`** (2 each), `IfcRelConnectsPathElements`,
  `IfcClassification`, `IfcTaskTime`, `IfcSurfaceStyleRendering` (1 each). Those elements never
  reach the validator, so the rule matches nothing and reports clean.
- **1 is applicability cardinality**, and only one:
  `ids/fail-required_specifications_need_at_least_one_applicable_entity_2_2`, which targets
  `IfcWall` — in scope, simply absent from the model. IDS defaults a specification's applicability
  to *required*, so zero matches is itself a failure; we treat it as nothing to check.

`IfcWallType` is worth pausing on: type objects are not exotic, and two property cases turn on them.

So these are two independent fixes with very different weights, and the order matters. **Element
scope is worth 27 cases; cardinality is worth 1 on its own** — but cardinality is what stops a
zero-match rule reading green in general, so both are needed. Do element scope first and re-measure
before touching cardinality: done together, the scoreboard cannot tell you which one worked.
Neither is on the staged plan above. Element scope is parser work of a different kind from stage
1's materials and classifications, and much cheaper.

The rest of the wrong answers group cleanly onto stages already planned:

- **tolerance, 18/18 of the wrong answers, all false fails.** Floating-point comparison needs the
  tolerance rule from the implementers' document; we compare exactly. Nothing else in the group is
  wrong, so this is one mechanism, not eighteen problems.
- **restriction, 9.** Numeric bounds ignored → 3 false passes; `length`/`minLength`/`maxLength` and
  a regex OR → 4 false fails; patterns applied to numbers rather than refused → 2. Stage 3.
- **attribute, 18 (16 false passes).** Type-aware comparison: booleans must be lowercase strings,
  a logical `UNKNOWN` always fails, empty lists and sets always fail, derived and inverse attributes
  cannot be checked and must fail, numbers are compared by type casting. We compare everything as
  strings and approve.
- **property, 23.** Measures and `dataType`, unit conversion to IDS standard units, occurrence
  override, and bounded values. Stage 3's unit dependency, confirmed by measurement.
- **ids, 4.** Specification-level cardinality — a `prohibited` specification must fail when its
  applicability matches, a `required` one must fail when nothing matches.

### What this changes about "full IDS support"

Three things the staged plan did not account for:

1. **Element scope, not just element data.** Stage 1 was written as "add materials, classifications
   and relationships to `NormalizedElement`". It also needs "stop dropping every entity that is not
   a physical element", which is a separate and smaller change to `element-filter.ts` — and it is
   worth doing first, because 27 conformance cases turn on it — including two on `IfcWallType`,
   so this is not only about exotic entities.
2. **Value typing is a stage of its own.** Sixteen attribute false passes and much of property come
   from comparing IFC values as strings. That is not the `FacetDraft` refactor (stage 2) and not
   restrictions (stage 3); it is a third axis, and it is the one that produces false *approvals*.
3. **`tolerance` is one mechanism worth 36 cases** — the cheapest single win on the board once
   numeric comparison exists at all, and it should ride along with stage 3 rather than wait.

Suggested order by cost against false passes removed: element scope + applicability cardinality
first (28 cases, 27 of them element scope alone, no new data model), then value typing (~26), then
bounds/tolerance/units (~30).

## Element scope and cardinality — landed and measured 2026-08-09

Both shipped, separately, so the scoreboard could attribute the movement.

| | agreed | false passes | of those, `0 applicable` | refused |
| --- | --- | --- | --- | --- |
| before | 127 | 34 | 28 | 127 |
| after element scope | 128 | 7 | 1 | 129 |
| after cardinality | **131** | **4** | **0** | 129 |

**Element scope.** Parses everything except the `IfcRepresentationItem` subtree. Geometry was
measured on the real 37 MB model and is the only subtree whose cost is not worth paying: 662,632 of
691,277 instances, and normalizing it takes the parse from 1.6 s to 20.5 s. Everything else is
~28k instances and ~1 s. Real end-to-end parse went **1,576 ms → 2,566 ms (+63%)**, elements
unchanged at 757, `idsScope` 28,645.

Two lists, not one wider list: `elements` still drives the Validate page and the explorer rail,
`idsScope` is the superset validation runs against. A rule that names geometry is refused, not
evaluated — the two `IfcCartesianPoint` cases moved from false pass to honest refusal, which is why
`refused` went up by 2.

`IFC_PRODUCT_PARENTS` became `IFC_ENTITY_PARENTS`, all 1,051 entities in both schemas. Ancestor
chains now run to `IfcRoot`, so `isSubtypeOf` answers for `IfcWallType`. The generated file grew
32 KB → 74 KB of source.

**24 cases moved from agreeing to failing**, and the baseline was refreshed. Not a regression: each
targets an entity that was never normalized, so the rule matched nothing, reported pass, and
happened to agree with a `pass-` case. They now match and are judged on merits — and we fail them.
This is the single most useful thing the change surfaced: **`NormalizedElement.attributes` carries
three named fields** (`Tag`, `Description`, `ObjectType`) plus `GlobalId`/`Name`/`PredefinedType`,
and the suite checks arbitrary attributes — `IsCritical` on an `IfcTaskTime`, for one. That belongs
with value typing and makes it bigger than "~26".

**Cardinality.** `ids.xsd` inherits XML Schema's `occurs` group, where `minOccurs` defaults to 1, so
the plain `<applicability maxOccurs="unbounded">` nearly every real rule carries is *required*.
Required / optional / prohibited are all read, and a prohibited specification that also states
requirements is invalid. Carried on a new `cardinalityFailure` rather than folded into
`failedCount`, so `passed + failed` stays the number of elements the rule applied to. `ids` group
went 8/12 → 11/12.

**Not done, and deliberately:** the 12th `ids` case is facet-level `cardinality="optional"` on a
requirement — requirement-side, a different mechanism from applicability cardinality, still checked
as required. The 4 remaining false passes are all property measures, units and integer formatting.

## Attribute coverage — landed and measured 2026-08-09

`NormalizedElement.attributes` was three hand-picked names. Now it is every attribute the schema
says holds a comparable value, chosen from `getAttributes()` rather than from the value's shape —
both parsers return a reference as a bare number, so filtering on the value would let a rule compare
against an express id.

| | agreed | false passes | false fails |
| --- | --- | --- | --- |
| after cardinality | 131 | 4 | 62 |
| after attribute coverage | **140** | **2** | 55 |

Two fixes it forced, because on its own it added three false passes:

- A pattern restriction against a number now fails rather than matching its text. IDS says patterns
  apply to strings and nothing else; `.*` against a stored 42 is the spec's own example.
- `parse-ids.ts` was the only one of the three XML parsers still using `parseTagValue: true`, so
  `<simpleValue>42.0</simpleValue>` arrived as the number 42 and the author's literal was gone
  before anything compared it.

Three cases moved from agreeing to failing, all false fails from the value-typing gap. Net trade:
three false passes out, three false fails in.

**Costs nothing, and the memory worry was inverted.** Parse on the 37 MB model went 2,566 ms →
2,619 ms, and the attribute bag got *smaller*: 34,332 slots against 85,935, because the old code
stored three nulls on every entity including the relationships and property sets that declare none.
`ifc-entity-table.generated.ts` grew 74 KB → 140 KB of source; the web bundle is 5.9 MB, so the
tables are noise in it.

**Unverified:** the 1.6 GB federated case. +63% of normalization on a ~120 s parse scales naively to
~+75 s, probably pessimistic because the extra work tracks non-geometry entity count rather than
file size — but it has not been measured, and the standing note says to ask rather than extrapolate.

## Value typing — landed and measured 2026-08-10

Five changes, landed and measured separately so the scoreboard could attribute each one.

**The suite grew to 334 cases** at `buildingSMART/IDS@dba4549e`, not 326 — 8 new `entity` cases,
of which 2 we agree with and 2 we get wrong. Every number below is against 334.

| | agreed | false passes | false fails | refused |
| --- | --- | --- | --- | --- |
| before | 142 | 2 | 57 | 133 |
| carrier | 142 | 2 | 57 | 133 |
| + dataType | 143 | **1** | 57 | 133 |
| + numeric casting | 150 | 1 | 50 | 133 |
| + multi-value candidates | 155 | 1 | 45 | 133 |
| + optional cardinality | **158** | **1** | 42 | 133 |

**Nothing was lost at any step**, and no step added a false pass that survived it. `ids` is now
12/12; `attribute` 46/56; `property` 63/82.

### The data model

`PropertyValue` stays the scalar union. Each attribute and property slot is now a
`NormalizedValue`: `value` as before, plus `values` (the candidates behind a multi-valued
property), `dataType` and `unit`. Chosen over a parallel side channel because both false passes
turn on the `dataType` of an *ordinary single value* — there was no "only exotic values get boxed"
escape. ~15 call sites, and no serialization boundary: nothing postMessages or persists a
`NormalizedElement`.

**ifc-lite was never lossy — we were.** Its `Property` already carried `values`, `dataType` and
`unit`; `ifc-lite-buffer.ts` took `prop.value` and dropped the rest, which is why a bounded
property reached the validator as the string `"3000 [1000 – 5000]"`.

**The carrier moved 0 cases**, which is what proves it decides nothing on its own.

### Costs and engine parity

Parse on the 37 MB model: **2,619 ms → 2,540 ms** (noise; nothing added). 17,237 of 17,797
property slots carry a `dataType`, 560 carry `values`.

`dataType` **disagrees on 0 of 17,797 slots** between the engines, because web-ifc's `{name, value}`
wrapper carries the same measure type ifc-lite reports. Deliberately *not* carried on attributes:
IDS declares `dataType` on `<property>` only, and reading web-ifc's wrapper name there diverged from
ifc-lite on every attribute in the model to say something nothing consults.

Two real divergences the parity test now pins, on a new `multi-valued-properties.ifc` fixture:

- **web-ifc fills no `values`.** It reads only `IfcPropertySingleValue`, so the other four subtypes
  arrive absent. Stated as a test rather than left to be rediscovered when the port lands.
- **An empty `Name` was folded into `null` by ifc-lite and kept by web-ifc.** Found by the optional
  cardinality work, which needs the difference. The real model has 3 such entities.

### What each behaviour change cost

- **`dataType` enforcement (+1, and the false pass it removes).** Enforced only where the parser
  reports the stored type — failing on "we do not know" would reject the list and enumerated
  properties the suite requires to pass.
- **Numeric casting (+7).** Cast against XML Schema's lexical space, not `parseFloat`, which reads
  `"42,3"` as 42 — the suite states that document as one that must fail. **On its own it added 3
  false passes**: `"42.0"` is not an integer. `dataType` answers that for a property, but
  `NumberOfRisers` and `RefractionIndex` are both the JS number 42, so
  `generate-ifc-entity-table.mjs` now emits the attributes typed exactly `xs:integer` (88 entities)
  from the `xsdTypesByEntity` it already fetched.
- **Multi-value candidates (+5).** The parser's rendering of the set stays in `value` and is
  deliberately *not* matchable. Bounded and `table 2_3` state metres against a millimetre model, so
  they wait on units.
- **Optional cardinality (+3, not the 1 predicted).** The same mechanism covers an optional
  attribute, an optional property and the combined `ids` case.

### What is left, and what it is worth

42 false fails and 1 false pass. **Bounds is now the single biggest mechanism at 23** — 18
`tolerance`, 4 `restriction`, 1 `attribute` — ahead of anything else on the board. Then:

- **units, 5** — the last false pass, `unit_conversions…2_2`, the 3 bounded and `table 2_3`. Needs
  the project's `IfcUnitAssignment`; the fixtures declare millimetres and IDS nominates metres.
- **`length`/`minLength`/`maxLength`, 3** — still compile to an empty enum that fails loudly.
- **a regex OR, 1**; **`entity` IFC2X3 type mapping, 2**; **quantities, material and predefined
  property sets, 4** — `IfcElementQuantity` is read by neither engine.
- **attribute references and selects, 3** — a name-only check on a reference-valued attribute must
  *pass*, while a value check against one must *fail*. Needs a slot that means "present, not
  comparable", which is the next thing `NormalizedValue` would grow.

## Bounds and tolerance — landed and measured 2026-08-10

Two landings, separately measured. **158 → 167 → 181 agreed of 334.** All 23 cases moved
false fail → agreed; **the false pass stayed at 1 throughout**, and no case was lost at either step.
`tolerance` is now 36/36, `restriction` 21/25, `attribute` 47/56.

| | agreed | false passes | false fails | refused |
| --- | --- | --- | --- | --- |
| before | 158 | 1 | 42 | 133 |
| + bounds | 167 | 1 | 33 | 133 |
| + tolerance | **181** | **1** | 19 | 133 |

Neither needed anything new from the parser: `NormalizedValue` already carried the values both
mechanisms compare. **No adapter change, and no `adapter-parity` change** — the divergence pins from
the value-typing stage stand untouched.

### They are two rules, and the second does not apply to the first

The single most important thing this stage turned up, and it is stated outright in
`Documentation/ImplementersDocumentation/tolerance.md`: **tolerance does not apply to ranges.**
Equality gets a tolerance; `minInclusive` and friends are compared exactly.

That is not an oversight in the specification — it is what lets an author write `v <= x <= v` to
mean "exactly v, no tolerance at all", or a range of ±1e-10 to state a tolerance of their own. The
suite pins it from the other side: a `minInclusive` of 0 against a stored -1e-7 must **fail**, and
any tolerance on the bound would approve it. Conflating the two would have bought a false pass in
exchange for the false fails being fixed.

### The formula has to be transcribed carefully

    x == v  ⇒  (v - abs(v) × ε - ε) < x < (v + abs(v) × ε + ε),   ε = 1e-6

Written verbatim in doubles, this gets **12 of the 28 equality cases wrong**, because the suite
places its passing values exactly *on* the boundary and the expression does not round to them:
`v + abs(v) * ε + ε` is 1.0000019999999998 for v = 1, just under the 1.000002 that must pass.

Two departures, both forced by measurement rather than chosen:

- **Combine the epsilon terms into one multiplication** — `(abs(v) + 1) * ε`. Mathematically
  identical, and it lands on the double the literal parses to.
- **Compare inclusively.** The document writes `<`, but its own table presents those values as the
  tolerance edge and the suite expects them to pass.

With both, all 28 equality cases agree. Four variants were measured before settling: the verbatim
form (12 wrong), the delta form `abs(x-v) <= abs(v)*ε + ε` (8 wrong), the same strict (10 wrong),
and Python's `math.isclose` max-form (12 wrong). The test pins the boundary pairs from the
document's own table, in both directions, so a future refactor cannot quietly re-round it.

**Integers are excluded.** IDS grants the tolerance to floating-point numbers, and on a large
integer a relative tolerance spans the whole numbers either side — 1e-6 of 100,000,000 is 100.
`holdsWholeNumber` already answered this question for the lexical space, so it answers it here too.

### Bounds

`ParsedRestriction` gains `{ kind: "bounds"; min; max }`, each edge carrying `inclusive`. A bound
whose value is not a number leaves the edge unset rather than becoming `NaN`, which would answer
`false` to every comparison and reject silently. A non-numeric *value* is outside every range rather
than being stringified into one.

`import-ids` is unchanged and still passes bounds through verbatim: no `ConditionDraft` operator
states a range, and its own reader refuses a non-string `base` before bounds reach it. `build-ids`
learned to emit them (base `xs:double`) so the union stays total.

**Not swept in, deliberately:** the 3 `length`/`minLength`/`maxLength` cases and the 1 regex-OR case
sit in the same `restriction` group and are separate mechanisms. They still compile to the empty
enumeration that fails loudly.

### What is left, and what it is worth

19 false fails and 1 false pass, against 133 refusals.

- **units, 6** — including **the last false pass** (`unit_conversions…1_2`). Needs the project's
  `IfcUnitAssignment`; the fixtures declare millimetres and IDS nominates metres. `NormalizedValue`
  carries a `unit` field that nothing reads yet. This is the next thing by the false-passes-first
  rule, and the first of the remaining items that needs **new data out of the parser** — so both
  adapters and `adapter-parity` are in scope for it, unlike this stage.
- **`length`/`minLength`/`maxLength`, 3**; **a regex OR, 1**.
- **`entity` IFC2X3 type mapping, 2**; **quantities, material and predefined property sets, 4** —
  `IfcElementQuantity` is read by neither engine.
- **attribute references and selects, 3** — a name-only check on a reference-valued attribute must
  *pass*, a value check against one must *fail*.

## Units — landed and measured 2026-08-10

**181 → 186 agreed of 334, and false passes 1 → 0.** The board no longer has a single case where
we approve what must fail. 15 false fails and 133 refusals remain.

| | agreed | false passes | false fails |
| --- | --- | --- | --- |
| before | 181 | 1 | 19 |
| + unit conversion | 183 | **0** | 18 |
| + numeric candidates | **186** | 0 | 15 |

### The real prize is not the 5 cases

The 37 MB model is authored in millimetres, and resolves `IFCLENGTHMEASURE` and
`IFCPOSITIVELENGTHMEASURE` at 1e-3. **Every length property check ever run against it was compared
1000× wrong** — and wrong in the approving direction whenever the raw figure happened to match the
literal. The conformance suite scores this as 5 cases; on a real Dutch model it is most numeric
property checks there are.

### Model-level, not per-value

A file declares its units once, so `UnitScales` is a `Record<measureType, factor>` on the parse
result rather than a field on all 17,797 property slots. `validateBySpecification` takes it as a
third argument, defaulting to `{}`.

Only measures that actually rescale are listed, so **absent means "already SI"** — which is also
what IFC means by an unstated unit, and what an engine with no unit information honestly reports.
One rule, one read site.

`NormalizedValue.unit` was **never populated** — the plan's note that it "carries a `unit` field
nothing reads yet" was half right. `ifc-lite-buffer.ts` passes `prop.unit`, but
`extractPropertiesOnDemand` returns no such field, so it was always `undefined`. Left alone rather
than removed; it is the right place for a per-property `Unit` override if one is ever needed.

### Both engines, because the engine picker must not decide the verdict

- **ifc-lite** already resolves the whole `IfcUnitAssignment` — SI prefixes, `IfcDerivedUnit`,
  `IfcConversionBasedUnit`, `IfcMonetaryUnit` — pinned against parity vectors shared with its Rust
  core. `extractProjectUnits` is read rather than re-derived.
- **web-ifc** has no equivalent, so `web-ifc-buffer.ts` reads `IfcSIUnit` (prefix × name, squared
  for an area and cubed for a volume, with `GRAM` carrying the 1e-3 that makes SI's base the
  kilogram) and `IfcConversionBasedUnit` (a factor and the unit that factor is in) itself.
  `IfcDerivedUnit` is not resolved and leaves the measure unscaled.
- Both share `measureUnit` for measure → unit type, so the ~90-row IFC measure table is stated in
  neither. `UnitScaleCollector` builds the map from the `dataType`s the adapter actually sees.

`adapter-parity.test.ts` now asserts the two agree on every fixture's scales. This was not optional:
both engines are user-selectable on the Validate page, so leaving web-ifc out would have made the
engine picker decide whether a millimetre model passes — a false pass reachable from the UI.

### Numeric candidates

The three bounded-property cases did not move on unit conversion alone. ifc-lite hands back the
candidates as the literals the file wrote — `["1000", "5000", "3000"]` — so a bounded length was a
*string*, and nothing scaled it. Read back as numbers wherever the slot states a measure type,
which also brings bounded values under the same lexical casting and tolerance as a single value.
+3, no false pass added.

### Costs

Parse on the 37 MB model: **2,540 ms → 2,391–2,658 ms across three runs.** Noise; nothing added.
The unit graph is a handful of entities and the collector memoizes per measure type.

### What is left

- **the table case, 1.** `IfcPropertyTableValue` arrives with **no `dataType`**, so there is
  nothing to key a conversion on. Converting on the strength of what the *rule* asked for rather
  than what the model stored is exactly the guess this codebase refuses elsewhere, so it stays an
  honest false fail. Blocked on ifc-lite reporting a measure type for table properties.
- **`length`/`minLength`/`maxLength`, 3**; **a regex OR, 1**; **`entity` IFC2X3 type mapping, 2**;
  **quantities, material and predefined property sets, 4**; **attribute references and selects, 3**.
- **90 of the 133 refusals** are the missing facets — classification, material, partOf,
  requirement-side entity. Still the largest number on the board, and now the only item that needs
  new data out of the parser.

## The missing facets — landed and measured 2026-08-10

Three facets and one general rule, landed separately so the scoreboard could attribute each.
**186 → 212 → 241 → 272 → 275 agreed of 334**, nothing lost at any step, and **false passes stayed
at 0 throughout**. Refusals 133 → 43.

| | agreed | wrong | refused | false passes |
| --- | --- | --- | --- | --- |
| before | 186 | 15 | 133 | 0 |
| + classification | 212 | 16 | 106 | 0 |
| + material | 241 | 16 | 77 | 0 |
| + partOf | 272 | 19 | 43 | 0 |
| + USERDEFINED | **275** | **16** | **43** | **0** |

`classification` 26/27, `material` 29/29, `partof` 34/34.

### ifc-lite was ahead on two of the three, and behind on the one that mattered most

The standing note says to assume ifc-lite is ahead, verify, then design. It held for classification
and material, and **failed for partOf** — in the direction that produces a false pass.

- **Classification.** `extractClassificationsOnDemand` already walks `ReferencedSource` to the root
  `IfcClassification` and hands back `system` plus a `path` of ancestor identifications. The leaf
  concatenated with its path is exactly what "a full classification matches its subreferences"
  needs. Type-level associations are already merged in.
- **Material.** `MaterialInfo` already carries names *and* categories at every level — set, layer,
  profile, constituent, list member — and its own doc comments cite IDS as the reason. Occurrence
  overrides type already. The adapter only flattens it.
- **partOf.** `REL_TYPE_MAP` maps **`IFCRELNESTS` onto the same `Aggregates` edge** as
  `IFCRELAGGREGATES`, with a comment saying this lets partOf checks "traverse the same graph".
  Right for a viewer, wrong for IDS, which asks about one or the other — a nested element would
  have satisfied an aggregate rule. The edge carries the relationship entity's express id, so the
  real type is recoverable without patching the library. **This is the counter-example to the
  ifc-lite-is-ahead rule: the library is ahead on data and can still be lossy on a distinction only
  this consumer cares about.**

### Two semantics that measurement decided, not reading

- **`optional` classification waives only on total absence.** Scoping the waiver to "classified in
  the system asked about" is the natural reading and it buys a false pass: the suite pairs an
  optional facet with a wall associated to an `IfcClassification` whose name is empty, which
  matches no `\w+` system, and requires it to **fail**. Caught by measurement before it landed —
  the only false pass introduced at any point in this stage.
- **A partOf chain may not change relation halfway.** A beam contained in a space that is
  aggregated into a building is not part of that building by aggregation. Ancestors are followed
  only through chains of a single relation.

Also: a partOf entity name is matched **exactly**, not by subtype — the opposite of an
applicability entity name, and what the suite means by "must match exactly".

### `null` vs `[]` on materials is load-bearing

An element with no material association fails an empty `<material>` facet; one whose association
names nothing passes it, while failing any value check. Both had to be representable, so
`materials` is `string[] | null` rather than a plain list.

A suspicion recorded as wrong: ifc-lite looked like it was substituting `"Unnamed"` for a missing
material name. It is not — that is literally what those conformance files write.

### USERDEFINED, landed on its own

A whole whose `PredefinedType` is `USERDEFINED` carries its real name in `ObjectType` (or
`ElementType` on a type object). Worth exactly the 3 partOf cases predicted when partOf landed, and
nothing else moved — which is the point of landing it separately, since it also changes what an
attribute check on `PredefinedType` sees.

### Both engines, and what parity caught

web-ifc has no classification resolver, no material resolver and no relationship graph, so all
three were written by hand there. `adapter-parity` gained three fixtures and caught **a real
divergence**: the engines listed an opening's wholes in different orders, ifc-lite walking one CSR
edge list and web-ifc the six relationship types in turn. The order carries no meaning, so
`resolvePartOf` sorts. The walking rule itself lives in one shared module for both engines.

### Costs on the 37 MB model

Parse **2,391–2,658 ms → 2,703–2,788 ms**, about +5%, all of it partOf's transitive walk over
28,645 scoped entities. Classification and material cost nothing measurable.

What the real model actually contains is the more useful number: **756 of 757 reviewer elements are
classified** (859 references), 953 scoped entities carry a material, and 1,917 have a partOf whole
(2,488 entries, at most 3 deep). Classification in particular is not a corpus curiosity here — the
model is NL/SfB-classified throughout, which is what the untracked `3.6_contain_NlSfb.ids` checks.

**Unverified:** the 1.6 GB federated case. The partOf walk tracks non-geometry entity count rather
than file size, but it has not been measured there.

### What is left

**43 refusals, 16 wrong, 0 errored, 0 false passes.**

- **requirement-side `entity`, 29 refusals** — the fourth of the four missing facets and now much
  the largest item on the board. `predefinedType` is already on the element and now resolves
  USERDEFINED, so the data it needs exists; this is validator work only.
- **a property or attribute *name* given as a pattern, 14 refusals** — pure validator work, no new
  parser data.
- **classification, 1 wrong** — an `IfcMaterial` classified through `IfcExternalReferenceRelationship`,
  an edge neither engine reads. An honest false fail.
- **the cheap comparison leftovers, 15** — unchanged: `length`/`minLength`/`maxLength` 3, regex OR 1,
  `entity` IFC2X3 type mapping 2, quantities/material/predefined property sets 4, attribute
  references and selects 3, the `IfcPropertyTableValue` case 1.

Applicability-side facets remain deliberately unimplemented (stage 5): a `<classification>`,
`<material>` or `<partOf>` in an applicability is still refused, which keeps `isEvaluable` honest.

**The authoring UI has not been touched**, per the Decisions-Log entry of 2026-08-10 — engine
first, interface after. These three facets are the ones that will not fit the current condition
row, so the three-level design is now the blocking question for stage 4.

## Requirement-side `entity` — landed and measured 2026-08-11

The fourth of the four missing facets, and the last block of refusals worth 29 cases.
**275 → 299 → 300 → 301 → 302 agreed of 334**, refusals 43 → 14, nothing lost at any step, and
**false passes stayed at 0 throughout**. `entity` went 2/33 → 29/33.

| | agreed | wrong | refused | false passes |
| --- | --- | --- | --- | --- |
| before | 275 | 16 | 43 | 0 |
| + the entity facet | 299 | 21 | 14 | 0 |
| + `ProcessType` | 300 | 20 | 14 | 0 |
| + the stored enumeration | 301 | 19 | 14 | 0 |
| + type-object inheritance | **302** | **18** | **14** | **0** |

### The note that sent this stage here was wrong, and it was worth checking

The Decisions-Log said requirement-side `entity` "needs no new parser data at all". Three of the
four landings are parser work, and the first landing surfaced them by turning refusals into wrong
answers that named their own cause. That is the argument for landing the validator half first even
knowing more was coming: 24 cases moved to agreed and the remaining 5 each stated a distinct
mechanism, which no amount of reading would have enumerated as reliably.

- **`ProcessType`.** IFC declares "the real name is elsewhere" afresh on each branch: `ObjectType`
  on an occurrence, `ElementType` on an element type, `ProcessType` on a type process. Two of the
  three were read, so an `IfcTaskType` saying `USERDEFINED` reported the literal.
- **Two strings, not one.** An element storing `.USERDEFINED.` with an `ElementType` of `WALDO`
  satisfies a requirement asking `WALDO` *and* one asking `USERDEFINED`. `entity-facet.md`'s table
  of examples marks both, and the suite states each as a document that must pass, so the resolved
  name alone cannot answer the first. `NormalizedElement.storedPredefinedType` keeps the
  enumeration literal, populated only where it differs — `null` on every element that never said
  `USERDEFINED`, which on the real model is all 28,645 of them.
- **The type object is consulted first.** `entity-facet.md` gives the order outright, and both
  adapters read only the occurrence. The one departure from the document as written is
  `NOTDEFINED`, which it files under "a value other than USERDEFINED" and which would therefore let
  a type overwrite what its occurrence states — the suite states the opposite as a document that
  must pass, so `NOTDEFINED` on a type defines nothing. There is no such fall-through on the
  occurrence, the last place to look, so it is kept there.

`extractTypePropertiesOnDemand` was the obvious way in and is the wrong one: it knows the type's
express id but returns `null` when the type carries no property sets, and the suite's inheriting
fixture has exactly that shape. `RelationshipType.DefinesByType` is followed directly instead, and
maps 1:1 onto `IFCRELDEFINESBYTYPE` with none of the conflation `REL_TYPE_MAP` applies to
`IFCRELNESTS`.

### Exact, not by subtype — and the applicability side may be wrong

A requirement's entity name matches **exactly and case-sensitively**. `entity-facet.md` says it
twice: "The IFC Class must match exactly", and "**there is no automatic inheritance in IDS entity
facet interpretation** … all the entities need to be listed explicitly". The suite pins both halves
— an `IfcWallStandardCase` must fail a requirement naming `IFCWALL`, and `IfcWall` names no class
at all.

**That section is about the entity facet as such, not about requirements.** `matchesApplicability`
uses `isSubtypeOf`, so our applicability is subtype-matching, which the specification appears to
forbid. This was measured rather than argued: switching it to exact matching **moves 0 of the 334
conformance cases**. Every applicability name in the suite is present literally in its own model,
so the suite cannot discriminate — which is why the divergence has survived this long.

It is not academic. The untracked real IDS at `fixtures/ifc/3.6_contain_NlSfb.ids` names
**`IFCELEMENT`** in its applicability. Today it selects **757 elements** of the 37 MB model and
checks them. Under exact matching it would select **0** — the model contains no literal
`IfcElement`, because the class is abstract — and the specification would fail on applicability
cardinality instead. `entity-facet.md` calls that authoring mistake out by name ("the IfcElement
should not be listed, as it is an abstract entity") and supplies copy-paste lists of every subtype
precisely because there is no inheritance.

So the two readings disagree about a real file the user checks real models with, and the direction
of harm runs both ways: subtype matching selects more elements than the author named, which can let
a required specification pass on a subtype when nothing it actually named exists (a false pass);
exact matching would report a widely-used authoring shorthand as checking nothing. **Left unchanged
and raised as a decision** — it is a behaviour change on real models with no conformance evidence
either way, and it belongs with the authoring UI, which would have to expand a supertype into its
subtypes at authoring time for exact matching to be usable.

### Costs

Nothing measurable. Parse on the 37 MB model: **2,553–2,698 ms before against 2,593–2,788 ms
after**, the same band as the previous stage, and a digest of every scoped entity's predefined type
is **byte-identical** either way. That model states 323 predefined types across 28,645 scoped
entities and no `USERDEFINED` at all, so nothing in it inherits and nothing in it carries a second
matchable string. Both lookups memoize per type object, so the cost tracks type-object count rather
than occurrence count.

`adapter-parity` gained three assertions on a new `predefined-types.ifc` fixture and caught no
divergence this time — the first stage where it has not. Every entity line in the fixture is copied
from an entity conformance case rather than counted by hand.

### What is left

**14 refusals, 18 wrong, 0 errored, 0 false passes.**

- **a property or attribute *name* given as a pattern, 14 refusals** — now the only refusals on the
  board, and pure validator work with no new parser data.
- **the `entity` IFC2X3 occurrence/type mapping table, 4** — not 2. Two more surfaced once the
  requirement facet started judging them. All four are applicability-side: an `IfcFlowTerminal`
  typed by an `IfcAirTerminalType` must answer to `IFCAIRTERMINAL`, and all four report
  `0 applicable`. A separate mechanism from anything in this stage.
- **the cheap comparison leftovers, 14** — `length`/`minLength`/`maxLength` 3, regex OR 1,
  quantities/material/predefined property sets 4, attribute references and selects 3, the
  `IfcPropertyTableValue` case 1, the `IfcMaterial` classified through
  `IfcExternalReferenceRelationship` 1, and `properties_can_be_inherited_from_the_type_2_2` 1.

Applicability-side classification, material and partOf remain deliberately unimplemented (stage 5),
and `storedPredefinedType` was deliberately **not** extended to a partOf whole: `partof` is 34/34 on
the resolved name alone, and carrying the pair there would be a guess at a case the suite does not
state.

## Applicability entity matching, and the first of the authoring UI — landed and measured 2026-08-11

Five commits on `feat/full-spec-authoring-ui`, off `master` at `e2fc39f`. **Conformance stayed at
302 agreed of 334 throughout — 18 wrong, 14 refused, 0 errored, 0 false passes — and the corpus
round-trip stayed at 7,784/7,784.** Neither number was expected to move; both were checked at
every step, because a UI change that moves a conformance number means something leaked out of the
draft model.

### The applicability decision: exact matching, expansion first

The open decision of 2026-08-11 is settled. **The specification wins, and IfcOpenShell settles it.**

`ifctester`'s `Entity` class serves both sides. `Entity.filter`, which is the applicability path,
selects with `ifc_file.by_type(self.name, include_subtypes=False)` — the flag written out rather
than defaulted — and `Specification.validate` then skips the entity facet in its per-element loop
because the filter already decided. The requirement path is `inst.is_a().upper() == self.name`.
One class, exact on both sides. That is the reference implementation, and it removes the reading
under which `entity-facet.md`'s two statements might have been about requirements only.

**The suite still cannot decide it, verified rather than inherited.** Patching `matchesApplicability`
to exact and refreshing the baseline produced a byte-identical file: 302/18/14/0, `lost: []`,
`gained: []`, group counts equal. Every applicability name in the suite is present literally in its
own model.

**What decides it in practice** is that a user who checks a model here and then with any other
conforming checker must get the same applicable count.

### Expansion is what makes the switch a no-op

The builder writes the concrete classes a pick stands for. `IFC_ABSTRACT_ENTITY_NAMES` (134
entities) came from `@ifc-lite/data`, which reported the flag already and nothing read it;
`concreteTypeNamesFor` is the name plus every concrete entity below it, abstract names dropped.

Measured on the real 37 MB model, against `idsScope`:

| picked | names written | subtype (before) | exact as written | exact expanded |
| --- | --- | --- | --- | --- |
| `IfcElement` | 135 | 757 | **0** | **757** |
| `IfcFlowSegment` | 5 | 280 | 280 | 280 |
| `IfcDistributionElementType` | 69 | 195 | **3** | **195** |
| `IfcSanitaryTerminal` | 1 | 0 | 0 | 0 |

Expansion reproduces subtype matching exactly, on every case tried. `IfcDistributionElementType` is
the one worth keeping: exact-without-expansion would have lost 192 entities silently.

**Expansion is for authored rules only.** An imported rule keeps the author's own list. Rewriting
someone else's document is what the import work exists not to do, and a file naming an abstract
class is now honestly reported as selecting nothing — the user's own `3.6_contain_NlSfb.ids` goes
`applicable 757` → `applicable 0` with the applicability cardinality naming the cause, which is a
loud result rather than a quiet one.

**How exposed real files are, measured over the 464 hand-authored corpus specifications:** only
**2** applicability entity names are abstract (`IFCBUILDINGELEMENT`, twice). 339 name a concrete
class that also has concrete subtypes, but 236 of those are `IFCWALL`, whose only concrete
subtypes are the deprecated `IfcWallStandardCase` and `IfcWallElementedCase`. 227 name a concrete
leaf, where the two readings agree. The real 37 MB model contains no `*StandardCase` at all, and
only 3 of its 73 classes have a descendant also present — none of them a reviewer element type.

`isSubtypeOf` now has no production caller. Left exported: the builder hint that a model also holds
subtypes the rule does not select will want it.

### The builder was failing every element of the user's own model

Found while measuring the applicability change end to end, and it is the strongest argument the
authoring UI has. `BUILDER_PROPERTY_DATA_TYPE` was `"IFCLABEL"`, declared on every property facet
the builder wrote. The checker enforces the declared type. Holding the applicability constant on
the real model and varying only the declared type:

| the rule as written | applicable | passed | failed |
| --- | --- | --- | --- |
| `dataType="IFCLABEL"` — what the builder wrote | 757 | **0** | **757** |
| `dataType="IFCTEXT"` — what the model stores | 757 | **668** | 89 |
| no `dataType` at all | 757 | 668 | 89 |

**668 correctly classified elements were reported as failures.** The model stores
`ASML · 3.6 NL-SfB code` as `IFCTEXT` on 756 of 757 elements.

Two commits, landed separately so the fix and the feature are attributable:

- **The default becomes `null`**, so nothing is declared until something is chosen. An honest
  silence beats a guess that fails everything. An imported condition still states what its source
  stated, including an explicit omission — so the corpus round-trip does not move.
- **A stored-as picker**, offering the types the model reports with counts. `FieldSummary` gains
  `dataTypes`. Three rules, each the honest reading: picking a property set or field declares the
  type the model reports; a field stored two ways declares **nothing**, because declaring either
  fails the other half; an attribute has no picker at all, since IDS declares `dataType` on
  `<property>` alone. A type an imported rule states stays selectable, labelled "(not in file)".

### `UnsupportedConstruct` was already on screen — in two of the three places

The brief's note that these reasons "never reach the screen" is out of date. `CheckSummary` prints
`construct — description` for every not-checked specification, and `RefusedSpecificationCard` does
the same for a whole specification kept verbatim. The gap was the third place: an editable rule's
kept facets were listed by tag name alone.

`readFacet` returned a bare `null` from nine places; it now returns the one thing that stopped it,
and `PassThrough.reason` carries it to the card. Two facets with the same tag are kept for
entirely different reasons, and the tag alone never said which.

### The measurement harness the refactor needs

`.claude/plans/corpus-roundtrip.mjs` — import every corpus file, export it again, compare what a
conforming reader sees. Baseline, so a direction can be read rather than a total:

```
files 7784 · reproduced 7784 · drifted 0 · import threw 0
specifications 41751 · refused whole 41325 · facets passed through 279
schema-invalid in / out 3 / 3

why refused:  applicability/property 41300 · applicability/attribute 41294
              applicability/entity/name 12 · entity/predefinedType 6
              applicability/classification 3 · applicability/material 3
passed through: property 82 · attribute 52 · classification 47 · partOf 39
              material 34 · entity 25
```

The refusals are dominated by bSI Japan's applicability-side property and attribute facets, which
are stage 5 and deliberately unimplemented. **Both totals must fall, never rise, as facets become
representable.**

### What is left of stage 2, and what it now knows

The `ConditionDraft` → `FacetDraft` refactor is untouched and is still the real work. Two things
this stage settled that it should carry:

- `dataType` is no longer a constant the refactor has to unpick — it is already a per-condition
  field fed by the model, and `FacetDraft`'s property variant can take it as it stands.
- The pass-through reason machinery now exists per facet, so `isEvaluable` narrowing during the
  refactor has somewhere to say why.

## Stages 3 and 4 — landed and measured 2026-08-11/12

Seven commits on `feat/ids-length-and-facet-import`, off `master` at `0d1d2f2`. **Pass-through
191 → 41**, a fall of 150 against 151 predicted. **Conformance 302 → 305 agreed of 334**, and it
moved exactly once, in the one commit that changes the validator. The corpus round-trip stayed at
7,784 / 7,784 reproduced, 0 drifted, 3 schema-invalid in and out, and **0 files losing a
requirement facet** at every commit — that last line is the check that a facet read into the model
but never compiled cannot produce a false pass.

| | commit | conformance | pass-through | predicted |
| --- | --- | --- | --- | --- |
| **S3a** | the validator checks a length | **302 → 305** | 191, unmoved | — |
| **S3b** | the importer reads a length | 305 | 191 → **185** | 185 ✓ |
| **S4a** | the importer reads classification | 305 | 185 → **139** | 138 ✗ |
| **S4b** | the importer reads partOf | 305 | 139 → **100** | 100 ✓ |
| **S4c** | the importer reads material | 305 | 100 → **66** | 66 ✓ |
| **S4d** | the importer reads a requirement entity | 305 | 66 → **41** | 41 ✓ |
| **S4e** | the 13 permanent pass-throughs say so | 305 | 41, unmoved | — |

False passes stayed at **0** throughout. The gate went 720 → **750 tests in 48 files**.

### The only conformance movement, and why it is legitimate

`ParsedRestriction` gains a `length` variant, and `parseRestriction` reads `xs:length`,
`xs:minLength` and `xs:maxLength`. **The three `pass-` length cases move from failing to
agreeing.** Nothing was lost.

The three `fail-` cases already agreed, and it is worth saying how: an unread restriction compiled
to an empty enumeration that failed every element, which happens to be the answer a `fail-` case
wants. They now agree on merits. A mechanism that only ever moves `pass-` cases is the shape to
expect when a refusal that failed loudly becomes a real check.

**All three edges are kept, not folded into one.** XSD lets an author write `xs:length` beside the
two bounds, and collapsing them would stop enforcing part of what the file states.

**The count is taken on the candidates as the file wrote them**, not on the unit-converted ones. A
scale of 1000 rewrites 2 as 2000, which is four characters rather than one, so running length
through `comparableCandidates` would make a character count depend on the model's unit assignment.

### First-reason-wins missed once, and by one

S4a predicted 138 and landed 139. One classification carries an `xs:annotation` underneath the
reason `readFacet` reported first. Every other prediction was exact, which is the opposite of stage
2's experience — there, C4 removed 72 reasons and exposed 8. The difference is that stage 4 removed
whole-facet refusals raised at `readFacet`'s first line, before any other check could have fired,
so there was nothing underneath them except what the facet's own parameters said.

### What each facet needed beyond the dispatch

The draft shapes, `compileFacet` and `build-ids`'s `facetXml` all landed in stage 2, so no
downstream change was needed for any of the four. What each reader had to decide:

- **`readFacet` is a switch over the tag**, with `readFacetShell` shared: the attribute allowlist,
  the child allowlist, `instructions`, and the **raw** `cardinality` attribute. Raw rather than
  checked, because the two alphabets differ per facet and each reader checks it against its own.
- **`readValueDraft` takes the parameter name.** A classification constrains its `<system>` and its
  `<value>` independently, and each is an `idsValue` in its own right.
- **A classification stating no `<system>` is still kept verbatim.** `ids.xsd` makes the element
  mandatory, so such a file is one the schema does not describe; the draft cannot state none, and
  inventing one would author the rule. No corpus facet does it, so this costs nothing.
- **`partOf` stores `relation` as the author's attribute**, not a split list — one member of the
  schema's enumeration is two names in a single value. `compileFacet` splits.
- **`partOf` takes `simpleCardinality`, which has no `optional`.** One saying `optional` is kept
  verbatim rather than read as one of the other two.
- **`readNestedEntity` is shared between `partOf` and the requirement-side `entity`**, which hold
  the same mandatory `<name>` and optional `<predefinedType>`. The entity facet is then the
  dispatch case and its allowlist.
- **The requirement-side entity has no cardinality at all**, so one is refused through the same
  unknown-attribute check that catches a `uri` on an attribute.
- **A material with no `<value>`** asks whether the element is made of anything at all, which is a
  real check rather than an empty one, so it imports as `value: null`.

### The importer is stricter than the validator about a length, on purpose

`readLengthDraft` refuses a count it cannot read, where `readBoundsDraft` stores one verbatim. A
length stating no readable edge compiles to a restriction that **admits everything**, so importing
a malformed one would turn it into a rule that passes every element.

That divergence exists for bounds already and is latent: a restriction whose only bound is
unreadable compiles to `{min: null, max: null}`, which `withinBounds` answers true to for any
number, while `parseIdsXml` reads the same file as an empty enumeration that fails everything. **No
corpus file writes one**, which is why the round-trip has never caught it. Recorded rather than
fixed — it is a separate mechanism from anything in these stages.

### `mixed-fidelity.ids` had to change what it keeps

The fixture kept a classification, a material and a bound to test that pass-through survives in
document order. All three are read now, and a fixture whose kept facet has quietly become
representable stops testing the invariant it was written for. It now keeps a property whose
`baseName` is a pattern — 15 corpus facets, deliberately out of scope, and so unrepresentable for
as long as that stays true.

### What is left of the 41

| reason | facets | claimed by |
| --- | --- | --- |
| property set or property name is a pattern | 15 | pattern-valued names |
| attribute name is a pattern | 4 | pattern-valued names |
| property carries `<name>` | 8 | **never — not in IDS 1.0** |
| property carries `measure` | 5 | **never — not in IDS 1.0** |
| `xs:annotation` inside a restriction (property 4, classification 1) | 5 | an annotation-carrying `ValueDraft` |
| two restriction families on one value | 3 | a regex OR, or an intersected model |
| a non-string base on an enumeration | 1 | — |

**19 of the 41 are pattern-valued names**, and they are also all 14 remaining conformance refusals.
That is now the largest single mechanism on the board and the obvious next stage.

The 13 permanent ones are re-labelled. `<name>` and `measure` are the 0.9-era spellings of
`<baseName>` and `dataType`, all in one corpus file; their reason now says IDS 1.0 does not have
them and that they are kept exactly as written on purpose, rather than implying a control is coming.

### Still deliberately not done

- **Applicability-side classification, material and partOf** (stage 5). A `<classification>` in an
  applicability still refuses the whole specification, which is what keeps `isEvaluable` honest.
  The 41,325 whole-specification refusals are unmoved, and are dominated by bSI Japan's
  applicability-side property and attribute facets.
- **A control for any of the four new kinds.** They render read-only through `UnshownFacetRow`,
  which stage 2 landed for exactly this moment: the facet appears in the rule it belongs to rather
  than thinning the list silently. Editing them is the next UI stage.

## Pattern-valued names — landed and measured 2026-08-12

Three commits on `feat/ids-pattern-valued-names`, off `master` at `980f8fb`. The largest single
mechanism left, and it moved both numbers at once: **conformance 305 → 317 agreed of 334** and
**pass-through 41 → 22**. False passes stayed at **0**, nothing was lost, and the corpus round-trip
stayed at 7,784 / 7,784 reproduced, 0 drifted, 3 schema-invalid in and out, and **0 files losing a
requirement facet** at every commit.

| | commit | conformance | pass-through | predicted |
| --- | --- | --- | --- | --- |
| **A** | the validator reads a pattern-valued name | **305 → 317** | 41, unmoved | — |
| **B** | the importer reads a pattern-valued name | 317 | 41 → **22** | 22 ✓ |
| **C** | the importer refuses a bound it cannot read | 317, unmoved | 22, unmoved | unmoved ✓ |

The gate went 750 → **767 tests in 48 files**.

### It is 12 conformance cases, not 14

The brief said all 14 remaining refusals were pattern-valued names. Twelve were. The other two —
`attribute/invalid-derived_attributes_cannot_be_checked_and_always_fail` and
`attribute/invalid-value_checks_always_fail_for_lists` — refuse because their *applicability* names
`IFCCARTESIANPOINT`, geometry this build does not normalize. Their detail column says `entity/name`
rather than `attribute/name`, which is how the two are told apart. They are the last two refusals on
the board and belong to the element-scope decision, not to this stage.

### The semantics the suite decides, and IfcOpenShell confirms

`Documentation/UserManual/attribute-facet.md` and `property-facet.md` say only that restrictions are
allowed on these names; neither says what a facet naming several slots then means. `ifctester`'s
`Attribute.__call__` and `Property.__call__` do, and the suite's own case titles state the answers:

- **Every matched slot must satisfy the value.** `ifctester` loops the matches and breaks on the
  first failure. Three suite documents place their only failing property second in the set.
- **Each matching property set is asked separately.** A wall whose `Foo_Bar` holds `Foo` and whose
  `Foo_Baz` holds nothing of the sort must **fail** a facet naming `Foo_.*` and `Foo`. One flat list
  of matches would find `Foo` in the first set and approve it — a false pass, and it is a `fail-`
  case, so the suite catches it.
- **An empty slot is dropped before the value is judged, not failed.** `ifctester` filters
  `None`/`""`/`()` out and keeps going if anything remains. The suite pairs a wall stating `Name`
  with one stating `Description` against a facet naming both, and requires each to pass.
- **At least one filled slot must survive**, which keeps "the element has none of these" a failure.

An exact name still reads its one slot by direct lookup, keeping the case-insensitive fallback, so
none of this is on the path a builder-written file takes.

### The three identity fields had to be offered to a restriction separately

Neither adapter puts `GlobalId`, `Name` or `PredefinedType` in `NormalizedElement.attributes` —
they are fields on the element. A pattern matched against the bag alone would miss all three, and
the suite's `pass-name_restrictions_will_match_any_result_2_3` is exactly that document: an
`IfcWall` whose `Name` is set and whose `Description` is not, against a facet naming both. The
candidate set is the three names plus the bag's keys, each read back through `readAttributeValue`
so the top-level readers stay the single source of the value.

### The per-set rule bites on the user's own model

Measured on the 37 MB reference model, holding the applicability at `IFCFLOWFITTING` (286 elements):

| the rule as written | applicable | passed | failed |
| --- | --- | --- | --- |
| `ASML` · `3.6 NL-SfB code` | 286 | 286 | 0 |
| `ASML.*` · `3\.6.*` | 286 | **0** | **286** |

`ASML.*` matches two sets, `ASML` and `ASML sparingen`, and the second holds no `3.6` property at
all. Every element fails, correctly. The conformance suite scores that rule as one `fail-` case;
on this model it is the difference between a rule that checks what its author meant and one that
fails 286 elements for a reason the message has to name — which it does, by the set.

`.*Name.*` on the same 286 elements passes all of them, reaching `Name` through the top-level
reader.

### Costs

Nothing measurable. Parse **2,930 ms on this branch against 2,988 ms on `master`**, both measured
today and both a little above the 2,593–2,788 ms band recorded earlier, which is the machine rather
than the change. Checking 286 elements against one facet takes 5–17 ms either way, and the exact-name
verdicts are byte-identical: same counts, same digest of every violation message.

### What the UI had to answer

A pattern names no single slot, and three places in `ConditionRow` and one in
`FailingElementsTable` were reading one.

- The property-set and field **selects become phrases** when the name is a restriction. The row
  keeps its operator, its value box and its stored-as picker — the precedent is `unshownValue`,
  which already withholds one parameter while leaving the rest of the row working.
- `dataTypeFromModel` and `observedValuesFor` return nothing rather than looking up the empty
  string, which would have reported the model as holding no such field.
- `readConditionValue` gained a `notOneSlot` case. Reading it as `null` would have printed
  "not set", which is the opposite claim about the element. The column says the value is not shown
  and leaves the validator's own message to name the field that failed.

`conditionProblem` was deliberately **not** extended to the names, though `ids.xsd` types them as
`idsValue` too: the builder only ever writes a plain one, and `readValueDraft` refuses an empty
restriction at import, so neither shape it guards against can reach a name.

### First-reason-wins exposed nothing, exactly as predicted

Commit B predicted 22 and landed 22. The sharpened rule from 2026-08-12 said a refusal removed
*after* the value has been read can expose nothing, and this is the case that tested it.

### `mixed-fidelity.ids` had to change what it keeps, again

It kept a property whose `baseName` is a pattern — the facet this stage makes representable. It now
keeps a value stating two restriction families at once, a range beside an enumeration: 3 corpus
facets, XSD intersects them, and one `ValueDraft` states one of the two. Third time the fixture has
been re-pointed for this reason, and the reason is the same each time.

### The bounds false pass is fixed

`readBoundsDraft` refuses an edge whose value is not a number and names it, the rule
`readLengthDraft` already applied. Nothing moved — no corpus file and no conformance case writes
one, which is why 7,784 round trips never surfaced it, and checking that nothing moved is the whole
point of landing it on its own.

### What is left

**2 refusals, 15 wrong, 0 errored, 0 false passes**, and 22 pass-throughs of which **13 are
permanent**.

| pass-through reason | facets | claimed by |
| --- | --- | --- |
| property carries `<name>` | 8 | **never — not in IDS 1.0** |
| property carries `measure` | 5 | **never — not in IDS 1.0** |
| `xs:annotation` inside a restriction (property 4, classification 1) | 5 | an annotation-carrying `ValueDraft` |
| two restriction families on one value | 3 | a regex OR, or an intersected model |
| a non-string base on an enumeration | 1 | — |

Nine addressable facets remain, against nineteen that just went. The conformance board is now
**15 wrong answers and 2 honest refusals**, and the wrong answers are the cheap comparison
leftovers plus the four `entity` IFC2X3 occurrence/type mapping cases — no whole mechanism left
that is worth more than four.

Applicability-side classification, material and partOf are still deliberately unimplemented
(stage 5), and there is still no control for the four read-only facet kinds.

## Stage 5 — the applicability side: the decision, written before the code

Six facets may stand in an `<applicability>`. We read one: `<entity>`, by name. Every other one
refuses the whole specification, which is what keeps `isEvaluable` honest. That is **41,325
whole-specification refusals**, unmoved through every stage so far.

### What the two measurements can and cannot say about this stage

Taken before writing anything, and the second one changes how the stage must be judged.

- **The corpus.** 82,600 applicability facets other than `<entity>`, over 41,309 specifications:
  property 41,300, attribute 41,294, classification 3, material 3, **partOf 0**. 41,287
  specifications carry an attribute *and* a property, 10 a property alone, 7 an attribute alone.
- **The conformance suite: 0 of its 334 cases writes a non-entity applicability.** Measured, not
  assumed. So **the scoreboard cannot move this stage in either direction**, and its only role here
  is the guard rail: 317 agreed, 15 wrong, 2 refused, 0 false passes must all stay exactly where
  they are. Every claim about whether an applicability facet is evaluated *correctly* has to come
  from hand-written tests and from the real 37 MB model, because neither the suite nor the
  round-trip can speak for it.

The corpus is unusually clean about what those facets carry, which decides most of the reader:

- **No applicability facet in 7,784 files carries a `cardinality`** — nor an `instructions`, nor a
  `uri`. `ids.xsd` gives them none: `applicabilityType` references `attributeType`, `propertyType`,
  `classificationType`, `materialType` and `partOfType` directly, and it is `requirementsType` that
  extends each with `cardinality`, `instructions` and (on three of them) `uri`. The only attribute
  present is `dataType` on a property, 41,288 times, which the base type does allow.
- The value shapes are nearly all `<simpleValue>`. Three restrictions exist in the whole corpus, and
  two of them carry an `xs:annotation`, which the importer already refuses everywhere.

### The decision: a predicate over `idsScope`, with the name list kept inside it

`ParsedSpecification.applicabilityEntityNames: string[]` becomes:

```ts
export interface ParsedApplicability {
  /** The classes <entity> lists, or null when the applicability states no <entity> at all. */
  entityNames: string[] | null;
  /** Every other facet. All of them must hold, and each narrows the selection further. */
  facets: ParsedApplicabilityFacet[];
}
```

and `matchesApplicability(element, applicability, unitScales)` answers the whole question.

**Why not a name list with the other facets applied as a second pass.** Because `<entity>` is
`minOccurs="0"`. An applicability may hold nothing but a `<property>`, and then there is no name
list to filter first — the rule selects across every entity in `idsScope` that carries the property.
A second pass makes the name list the gate, and `isEvaluable` refuses an empty one today, so the
second-pass model would refuse exactly the shape this stage exists to read. The distinction between
"there is no `<entity>`" and "the `<entity>` lists nothing" is what `null` versus `[]` carries, and
it is load-bearing rather than tidy.

**Why the name list stays a field rather than being derived.** It is the only facet whose selection
can be *enumerated* rather than tested, and enumeration is what the builder's type chips, the
explorer rail and `applicabilityEntityNamesOf`'s supertype expansion all read. Deriving it back out
of a predicate would work for the exact and enumerated shapes and for nothing else. So the name list
is a named field of the predicate, not a view computed from it.

**An applicability facet is a requirement facet with the cardinality question already answered.**
`ParsedApplicabilityFacet` reuses the requirement shapes and `evaluateRequirement` judges them, with
`cardinality: "required"` — which is not a default we chose but the only value the schema permits
there. A `cardinality` attribute inside an applicability is a document `ids.xsd` does not describe,
and both readers refuse it. That is why this stage is cheap: the evaluation it needs already exists
and has been measured against 334 conformance cases on the requirements side.

**What `isEvaluable` may and may not do.** It still refuses an applicability that is not fully
represented, and it still refuses one that states nothing at all — no `<entity>` and no facet, which
`ids.xsd` allows and which selects the entire model. What changes is that an applicability with no
`<entity>` but with facets is now evaluable, because it is now fully understood. A facet that is
evaluated must be evaluated correctly; one that is not must still refuse the whole specification.

### The staging, and what each commit is predicted to move

Conformance cannot move, so the prediction is against the corpus round-trip's refusal count.

| | commit | predicted refusals | why |
| --- | --- | --- | --- |
| **A** | the applicability becomes a predicate | 41,325, unmoved | carries nothing new; proves the shape decides nothing |
| **B** | the validator evaluates an applicability property and attribute | 41,325, unmoved | the importer is untouched |
| **C** | the importer reads an applicability property | 41,325 → **41,315** | the 10 specifications carrying a property alone |
| **D** | the importer reads an applicability attribute | 41,315 → **23** | 41,287 carrying both, plus 7 carrying an attribute alone, less the 2 whose attribute is spelled `<n>` |
| **E** | classification, both readers | 23 → **21** | 3 specifications, one of which states no `<system>` and carries an `xs:annotation` |
| **F** | material, both readers | 21 → **20** | 3 facets over 2 specifications, one carrying an `xs:annotation` |

The 20 predicted survivors are 16 specifications refused for an entity reason (12 name-as-pattern,
6 predefinedType), the 2 `<n>` ones, and the 2 annotation-carrying facets above.

**partOf: built, and the reasoning is the opposite of the usual one.** It has 0 uses in the 464
hand-authored specifications and **0 in all 7,784 corpus files** — so no measurement in this
repository can show it working or show it broken. It is built anyway, because the applicability
reader is a switch over the same six tags the requirement reader already dispatches, and leaving one
arm out costs an extra deliberate-exclusion branch and an extra refusal message rather than saving
any. The honest qualification is stated rather than buried: **its only evidence is hand-written
tests and the real 37 MB model**, where 1,917 entities carry a partOf whole, and neither the corpus
round-trip nor the conformance suite will ever confirm or contradict it.

## Stage 5, the applicability side — landed and measured 2026-08-12

Eight commits on `feat/ids-applicability-facets`, off `master` at `eaa690c`. **Whole-specification
refusals 41,325 → 23**, and every guard rail held: conformance stayed at **317 agreed / 15 wrong /
2 refused / 0 errored of 334 with 0 false passes**, the corpus reproduced **7,784 / 7,784** with 0
drifted and 3 schema-invalid in and out, and **0 files lost a requirement facet** at any commit.

| | commit | refusals | predicted | pass-through |
| --- | --- | --- | --- | --- |
| **A** | the applicability becomes a predicate | 41,325, unmoved | unmoved ✓ | 22 |
| **B** | the validator selects on a property and an attribute | 41,325, unmoved | unmoved ✓ | 22 |
| **C** | the importer reads an applicability property | 41,325 → **41,317** | 41,315 ✗ | 22 |
| **D** | the importer reads an applicability attribute | 41,317 → **25** | 23 ✗ | 22 |
| **E** | both readers, classification | 25 → **24** | 21 ✗ | 22 → **23** |
| **F** | both readers, material | 24 → **23** | 23 ✓ | 23 |
| **G** | both readers, partOf | 23, unmoved | unmoved ✓ | 23 |

The gate went **767 → 787 tests in 48 files**, and `node scripts/verify.mjs --visual` passes.

### The scoreboard could not speak for this stage, and that was measured first

**0 of the 334 conformance cases writes a non-entity applicability.** Checked before any code was
written, because every earlier stage was justified by a number on that board and this one could not
be. Its whole role here was the ratchet — and it did not move by a single case at any of the eight
commits, which is the evidence that a predicate over `idsScope` decides the same thing the name list
did wherever the file states only an entity.

So the evidence for correctness is the corpus round-trip (41,292 specifications that now import as
rules and re-export to a document a reader agrees with), hand-written tests, and the real model.

### What the model change bought, on the user's own file

Measured against the 37 MB reference model's 28,645 scoped entities, holding the requirement
constant. Every one of these was a refused specification before this stage.

| the applicability as written | applicable |
| --- | --- |
| `IFCFLOWFITTING` | 286 |
| + `ASML` · `3.6 NL-SfB code` is present | 286 |
| + `ASML` · `3.6 NL-SfB code` = `53.10` | **100** |
| + `Name` matching `NLRS_.*` | **138** |
| + classified in `Uniformat` | 286 |
| + made of `(53.1) water, drinkwater` | **4** |
| + part of an `IfcBuildingStorey` | 286 |
| `ASML` · `3.6 NL-SfB code` alone, **no `<entity>` at all** | **756** |
| part of an `IfcBuildingStorey` alone, no `<entity>` at all | **757** |

The last two are the shape a name list cannot express, and they are the reason the decision went the
way it did. Checking one specification costs **8–27 ms** over 28,645 entities, and parse is
unchanged at **2,900–2,935 ms**, inside the 2,593–2,988 ms band already recorded.

### Three predictions missed, each for a different reason

Worth separating, because only one of them is the familiar first-reason-wins bias.

- **C, out by 2.** `readApplicability` collects *every* reason its facets raise, where `readFacet`
  returns the first and stops. So a specification moves only when all of its reasons go, and a
  prediction taken from facet counts overcounts by however many specifications are refused on the
  entity side as well. Two of the ten property-only specifications also name their entity by
  pattern. **This is the opposite bias to first-reason-wins**: there, removing one reason exposes
  the next and the prediction is a lower bound; here, every reason is already visible and the
  prediction is an upper bound.
- **D, out by 2 — the same two, carried.** The step itself moved 41,292, exactly as predicted.
- **E, out by 1.** The corpus's 3 applicability classifications fail in *two* ways, not one: one
  states no `<system>`, which `ids.xsd` makes mandatory; another carries an `xs:annotation`. Reading
  the shape table, both faults looked like the same facet. Counting distinct facets is not the same
  as counting distinct reasons.

### Pass-through rose, and the guard rail has to be read as a pair

Commit E took pass-through from 22 to 23, which the standing rule says must never happen. It is not
a regression, and the mechanism is worth writing down because it will recur.

A specification refused *whole* hides its kept requirement facets inside one verbatim block, where
they are counted once as a refusal. When its applicability becomes readable the specification
imports as a rule, and those facets are counted one by one. `IDS_SimpleBIM_examples.ids` /
"Room requirement 1" carries a requirement `<property>` with an `xs:annotation`; that is the whole
of the rise.

**Refused-whole plus pass-through is conserved across the change** — 47 before commit E and 47
after — and the invariant that actually guards against loss, `files losing a requirement facet`, is
0 throughout. From here the rail is: *the pair may fall, and neither may rise on its own without the
other falling by at least as much.*

### partOf was built with no evidence, deliberately

0 uses in the 464 hand-authored specifications, **0 in all 7,784 corpus files**, and no conformance
case. Nothing in this repository can confirm it or contradict it, and the corpus number did not move
when it landed — which is what commit G's measurement is for.

It is built because the applicability reader is a switch over the same six tags the requirement
reader dispatches: leaving one arm out costs an extra deliberate-exclusion branch and an extra
refusal message rather than saving any, and `evaluatePartOf` and `readPartOfFacet` are reused
unchanged. Its only evidence is two hand-written tests and the real model above, and both the tests
and this note say so rather than leaving it implicit.

### What is left refused, and why each one is honest

23 specifications, all of them for a reason on the entity side or in a value:

| reason | specifications | claimed by |
| --- | --- | --- |
| `applicability/entity/name` — the classes are given as a pattern | 12 | a builder that can show a pattern instead of chips |
| `applicability/entity/predefinedType` | 6 | the entity facet's second parameter, applicability side |
| `applicability/classification` | 2 | one states no `<system>`; one carries an `xs:annotation` |
| `applicability/attribute` | 2 | the two markdown-mangled files that spell `<name>` as `<n>` |
| `applicability/material` | 1 | an `xs:annotation` on the value |

`applicability/property` is gone entirely. The two entity reasons are 18 of the 23 and are the
obvious next piece: `predefinedType` is nearly free, since `evaluateEntity` already reads it and the
draft would need one more field; a pattern-valued entity name is the harder one, because the
builder's applicability is a *list of type chips* and a pattern names an open-ended set of classes.
That is also why `mixed-fidelity.ids` was re-pointed to it — for the fourth time, and the reason is
the same every time: a fixture whose kept construct has quietly become representable stops testing
the invariant it was written for.

### Still not done

- **A control for the five applicability facet kinds and the four read-only requirement kinds.**
  Both render read-only — `ApplicabilityFacetRow` is the applicability-side counterpart of
  `UnshownFacetRow`, and neither can be edited. This is now the largest gap between what the tool
  reads and what it lets you write, and it grew rather than shrank this stage.
- **`optional` cardinality in the builder.** The *validator* has evaluated it since the value-typing
  stage — `evaluateSlotFacet`, `evaluateClassification` and `evaluateMaterial` all read it and the
  `ids` group is 12/12. What is missing is the control: `friendlyReadingOf` returns `null` for an
  optional facet and `ConditionRow` shows it through `unshownValue`. It belongs with the item above,
  not on its own.
- **The document metadata panel** — `<info>`, per-specification identifier/description/instructions,
  `ifcVersion`. Untouched.

## Stage 5, the authoring UI — landed and measured 2026-08-16

Nine commits on `feat/ids-facet-controls`, off `master` at `9da2437`, plus three more for the
applicability entity's predefined type. **Every facet kind `ids.xsd` allows, on both sides, now has
controls** — the nine read-only kinds are gone, and so are the two components that showed them.

| | commit | conformance | refused whole | pass-through | gate |
| --- | --- | --- | --- | --- | --- |
| **1** | one value editor behind every `idsValue` | 317 | 23 | 23 | 787 → 800 |
| **2** | the rail knows what the selection is classified in | 317 | 23 | 23 | 800 |
| **3** | a classification requirement is editable | 317 | 23 | 23 | 800 |
| **4** | a material requirement is editable, rows share a frame | 317 | 23 | 23 | 800 |
| **5** | a partOf requirement is editable | 317 | 23 | 23 | 810 |
| **6** | a requirement entity is editable | 317 | 23 | 23 | 820 |
| **7** | the condition row shares the frame | 317 | 23 | 23 | 820 |
| **8** | the applicability side is editable | 317 | 23 | 23 | 830 |
| **9** | every facet kind can be added | 317 | 23 | 23 | 839 |
| **A** | the validator narrows by an entity predefinedType | 317 | 23 | 23 | 843 |
| **B** | the draft carries it | 317 | **23 → 17** | 23 → 24 | 846 |
| **C** | the builder states it | 317 | 17 | 24 | **849** |

**Conformance never moved**: 317 agreed / 15 wrong / 2 refused / 0 errored of 334, 0 false passes,
at all twelve commits. That is the point of checking it here — this is authoring-side work, and a
conformance number moving would mean something had leaked out of the draft model into the engine.
The corpus reproduced **7,784 / 7,784** with 0 drifted, 3 schema-invalid in and out, and **0 files
losing a requirement facet**, throughout.

### The two decisions, both written before the code

**The shared piece is a value editor *and* a row frame, not one row switching on kind.**
`FacetValueEditor` is one `idsValue` wherever `ids.xsd` puts one — nine parameters over six kinds,
four of which carry two — and `FacetRowFrame` is the head and tail all five rows repeat. One prop
decides more than it looks like: whether the parameter may be absent. A classification's `<system>`
and a partOf's `<entity><name>` are mandatory and the editor withholds the absent reading there; a
`<value>` on a material is optional and `null` means "any". Backwards, that exports a document no
conforming checker reads.

**One row per kind taking a `side`, not two sets of components.** The two sides differ in exactly
four things — cardinality, the author's note, the score, and the sentence's lead — and share every
control. `ConditionRow` is 400 lines and serves the two most frequent applicability facets in the
corpus (property 41,300, attribute 41,294); a second copy is a second place for the
pattern-valued-name phrases, the retargeting rules and the stored-as picker to diverge. The cost
paid instead is that `hits` and `matched` become optional on the frame, once.

### Each kind's cardinality alphabet differs, and that is the thing to get right

| kind | cardinality |
| --- | --- |
| attribute, property, classification, material (requirements) | required / optional / prohibited |
| partOf (requirements) | required / prohibited — **no optional** |
| entity (requirements) | **none at all** |
| every facet in an applicability | **none at all** |

A `partOf cardinality="optional"` is a document the importer already refuses, so a builder that
could write one would write what its own reader rejects.

### Editing an imported facet is half of writing one

The rows landed first and could only edit a facet that came in from a file: `+ condition` minted a
property or an attribute, and the applicability side had no add control at all. `defaultFacetFor`
fills every mandatory parameter **from the selection** — the first system the elements are
classified in, the first class they are part of, the first class they are — and leaves one the model
cannot fill *empty*, so the row says "Enter a value" rather than the builder inventing a rule.

`exportBlockers` and `isRuleComplete` had to grow to both sides with it. They read only
`rule.conditions` before, which was safe while an applicability facet could only arrive from a file
the importer had already validated.

### The rail grew a fourth section, and its spelling is load-bearing

`FieldsForResult` carries classifications, materials, wholes and now `ifcTypes`. The last holds the
class **as the file spells it** — `IFCWALL`, not the `IfcWall` the applicability chips carry —
because `evaluateEntity` matches a requirement entity name exactly and case-sensitively. Offering
the canonical name would author a requirement no element satisfies. Both predefined-type literals
are offered for the same reason `evaluateEntity` accepts both.

### The applicability entity's predefined type

**0 of the 334 conformance cases writes one**, measured before any code, so the scoreboard could
only ratchet. The evidence is the corpus — **6 specifications, refused whole 23 → 17, exactly as
predicted** — plus hand-written tests and the real model.

Pass-through rose 23 → 24 at the same commit. That is the mechanism commit E recorded last session,
not a regression: a specification refused whole hides its kept requirement facets in one verbatim
block counted once, and once it imports as a rule they are counted one by one. The riser is a
classification carrying an `xs:annotation`. **Refused-whole plus pass-through fell 46 → 41**, which
is the pair the rail is read on.

Three things it decided:

- **A field beside `entityTypes`, not a facet.** It narrows the one facet the builder enumerates
  rather than standing beside it, and `ids.xsd` makes `<name>` mandatory inside an `<entity>` — so a
  rule naming no type has nowhere to put it. `compileDraft` drops it in step with the exporter and
  `ruleProblems` says so, rather than the page showing a narrowing the file does not carry.
- **The reading mirrors `evaluateEntity`**: the resolved name or the stored `USERDEFINED` literal.
- **An element stating no predefined type is not selected.** Selecting it would report it under a
  rule whose author scoped it away, which on this side is a rule matching more than it says.

### Measured on the real 37 MB model, which is the only evidence for most of this

Parse **2,752 ms**, inside the 2,593–2,988 ms band already recorded. Checking one specification over
28,645 scoped entities takes **9–37 ms**. Applicability held at `IFCFLOWFITTING` (286 elements),
every row against a value the model has and one it does not:

| the rule as written | applicable | passed | failed |
| --- | --- | --- | --- |
| material = `AIPS-copper` | 286 | **94** | 192 |
| material = `Titanium` | 286 | **0** | 286 |
| material **prohibited** = `AIPS-copper` | 286 | **192** | 94 |
| classified in `Default Classification` | 286 | **103** | 183 |
| classified in `Uniformat`, code starting `D20` | 286 | **0** | 286 |
| partOf: assigned to an `IFCSYSTEM` | 286 | **244** | 42 |
| partOf **prohibited**: assigned to an `IFCSYSTEM` | 286 | **42** | 244 |
| partOf: aggregated into an `IFCBUILDINGSTOREY` | 286 | **0** | 286 |
| entity: must be an `IFCFLOWSEGMENT` | 286 | **0** | 286 |

And the same rows on the applicability side, narrowing rather than judging: `+ made of AIPS-copper`
**94**, `+ classified in Default Classification` **103**, `+ assigned to an IFCSYSTEM` **244**.

The predefined-type narrowing needed a class that states one, because `IFCFLOWFITTING` states none:
`IFCCOVERING` is **128 → 128** narrowed to `NOTDEFINED` and **128 → 0** narrowed to `CEILING`;
`IFCPIPEFITTINGTYPE` is **164** narrowed to `NOTDEFINED`. The whole model states 323 predefined
types across 28,645 scoped entities and every one of them is `NOTDEFINED`.

### Two components deleted rather than emptied

`UnshownFacetRow` and `ApplicabilityFacetRow` both matched nothing once the last kind got controls.
Their `Exclude` had no name left to state, and a component matching no facet is dead code.
`RuleCard`'s five-arm ternary chain became `RequirementRow` and `ApplicabilityRow`, two dispatchers
that take `onChange` over the whole union — which is what lets each arm hand a narrower row its
callback without a cast.

### What is left

- **A pattern-valued applicability entity name, 12 of the 17 remaining refusals.** The hard one, and
  untouched: the builder's applicability is a list of type chips and a pattern names an open-ended
  set of classes. Still open whether it is worth a control at all or stays an honest refusal.
- **The document metadata panel** — `<info>`, per-specification identifier/description/instructions,
  `ifcVersion`. Roughly 12 fields, untouched.
- The other 5 refusals: 2 `applicability/classification` (one states no `<system>`, one carries an
  `xs:annotation`), 2 `applicability/attribute` (the markdown-mangled `<n>` files), 1
  `applicability/material` (an `xs:annotation`).

## The metadata panel — landed and measured 2026-08-16

Three commits. `<info>` and the `<specification>` attributes are the last untouched part of the
document, and they had the same shape of problem as the facets did: carried faithfully through a
round trip, and impossible to edit. A document authored here stated a title and nothing else.

| | commit | conformance | refused whole | pass-through | gate |
| --- | --- | --- | --- | --- | --- |
| **M1** | the document's own metadata is editable | 317 | 17 | 24 | 849 → 858 |
| **M2** | a specification's own metadata is editable | 317 | 17 | 24 | 858 → 863 |
| **M3** | an `<entity>` with no `<name>` says so | 317 | 17 | 24 | **864** |

### Neither existing harness could speak for it, and that had to be built first

The corpus round-trip compares **what `parseIdsXml` sees**, and `parseIdsXml` reads no `<info>` at
all and none of the `<specification>` attributes beyond `name` and `ifcVersion`. It also pins the
date so its output is stable. So a change to how the metadata is carried can pass 7,784 / 7,784 and
still lose the author's name.

`.claude/plans/corpus-info-fidelity.mjs` is the check that closes it: import, export, compare the
eight `<info>` children and the five `<specification>` attributes, text for text.
**7,784 / 7,784 `<info>` blocks and 41,751 / 41,751 attribute sets reproduced.**

Three things it had to be taught, each a difference no reader can see:

- **XML 1.0 §2.11 requires CRLF to be folded to LF** before the application sees it. That is the
  only difference in 7,445 Japanese descriptions.
- `escapeXml` writes `&apos;` inside a double-quoted attribute where the source wrote a bare `'`.
  Legal, unnecessary, and the only difference in one Dutch description.
- One file writes `<ids:title />`, which is the same empty string as `<title></title>`.

### Empty means absent, except where the schema says otherwise

Measured before choosing the rule: 7,784 corpus files have an `<info>`, 7,452 state all eight
children, and **the only empty element in any of them is one `<title>`**. So a cleared box writing
no element costs nothing and stops a `<copyright></copyright>` nobody typed.

`<title>` is the exception, and dropping it exported the one document this change made
schema-invalid. **The round-trip's `schema-invalid out` caught it, 3 → 4** — the only guard rail
that could have, and the reason it is counted separately from `drifted`.

### Two constraints the exporter cannot fix up for the author

`ids.xsd` narrows two of the eight beyond `xs:string`: `<author>` carries
`[^@]+@[^\.]+\..+` and `<date>` is an `xs:date`. `infoProblems` transcribes both, as loosely as the
schema writes them — tightening the address pattern would reject a document IDS accepts.

`ifcVersion` is the third, and it is a closed enumeration of three, so the panel offers a checkbox
each rather than a box. **`undefined` and `""` had to be different**: a rule that never stated one
takes the exporter's default, one whose boxes the user cleared states none, and `ruleProblems` gains
a `metadata` key so the panel and `exportBlockers` say the same thing. The exporter still writes the
default either way, so a downloaded file is never invalid.

### A pattern-valued applicability entity name: not worth a control, and the count was wrong

The remaining item on the list, and reading the 12 refusals settles it against building anything.

**They are not 12 patterns.** Eight are `NL_BIM_Basis_ILS.ids` specifications whose `<entity>` has
no `<name>` at all — they spell it `<n>`, the same markdown mangling two applicability *attributes*
already carry. Nothing about them is a pattern and no control can represent them; the file is
broken, and reproducing it faithfully is the whole point.

Of the four that do give a restriction:

| file | what it writes |
| --- | --- |
| `IDS_SimpleBIM_examples.ids` | an `xs:annotation` inside the restriction |
| `IDS_ucms_prefab_pipes_IFC2x3.ids` | an `xs:annotation` inside the restriction |
| `IDS_ucms_prefab_pipes_IFC4.3.ids` | an `xs:annotation` inside the restriction |
| `IDS_random_example.ids` | `<xs:pattern value="IFCCOVERING"/>` — one literal class |

Three are refused for the annotation regardless of the pattern, and the fourth is a pattern in form
only. **The corpus contains no open-ended entity pattern at all.** So the honest refusal stays, and
the message now says which of the two faults a file has.

### What is left

- **The four remaining `entity/name` refusals**, claimed by an annotation-carrying `ValueDraft`
  rather than by anything about patterns.
- 2 `applicability/classification` (one states no `<system>`, one an `xs:annotation`), 2
  `applicability/attribute` (the `<n>` files), 1 `applicability/material` (an `xs:annotation`).
- **An annotation-carrying `ValueDraft` is now the single largest remaining mechanism**: 5 of the 24
  pass-throughs and 4 of the 17 refusals turn on it, which is more than anything else left.

## Stage 6 — an annotation-carrying `ValueDraft`: the decision, written before the code

An author may write prose inside an `<xs:restriction>`, and `ids.xsd` fixes it as the **first** child:

```xml
<value>
  <xs:restriction base="xs:string">
    <xs:annotation><xs:documentation>Why this rule exists</xs:documentation></xs:annotation>
    <xs:pattern value="[0-9]\.[0-9]" />
  </xs:restriction>
</value>
```

### Three measurements taken first, and two of them changed the stage

**The validator already reads through an annotation.** The session prompt said both readers refuse
one. `parse-ids.ts` has carried `annotation` in `RESTRICTION_FACETS_READ` since `55f6871`, and a
probe over the three places a restriction can stand confirms it: `unsupported` is empty and the
facet compiles. So there is no validator behaviour to change, and the validator commit is a test
that pins the tolerance rather than a change that creates it. **Nothing on any guard rail can move
for it.**

**0 of the 334 conformance cases writes an `xs:annotation`** — `grep -rl annotation` over
`.conformance/TestCases` finds none. Measured before any code, the way the last two stages did. So
**the scoreboard cannot move this stage in either direction**, and its only role is the ratchet: 317
agreed / 15 wrong / 2 refused / 0 errored, 0 false passes, must all stay where they are.

**The corpus holds annotations at two levels, and only one of them is this stage.** Six files carry
one, 15 distinct fragments in all:

| where it stands | count | what it costs today |
| --- | --- | --- |
| first child of an `<xs:restriction>` | 12 | 7 pass-throughs, 2 whole-specification refusals |
| child of an `<xs:enumeration>`, one per member | 3 | **nothing yet — silently dropped** |

The second level is the one worth writing down. `readValueDraft` reads an `<xs:enumeration>`'s
`value` attribute and never looks at its children, so a per-member annotation is read past and lost.
All three sit in `IDS_random_example.ids`'s `ramen`, which is refused whole today and therefore kept
verbatim — so the loss is latent, not live. **This stage is what would make it live**, because
reading the annotation on `ramen`'s applicability classification is exactly what turns that
specification into a rule. Neither the round-trip nor the info-fidelity harness could see it:
`parseIdsXml` ignores an enumeration's children too, so both sides of the comparison would agree
about a document that had lost the author's prose.

### The decision: an `annotation` field on the five restriction-bearing `ValueDraft` variants

```ts
export type ValueDraft = { kind: "simple"; value: string } | RestrictionValueDraft;

export type RestrictionValueDraft = (
  | { kind: "enum"; values: string[] }
  | { kind: "pattern"; source: string }
  | { kind: "affix"; operator: AffixOperator; literal: string }
  | { kind: "bounds"; base: string; min: BoundDraft | null; max: BoundDraft | null }
  | ({ kind: "length" } & LengthDraft)
) & { annotation?: string };
```

**Not on `simple`, and that asymmetry is the schema's.** The annotation lives inside the
`<xs:restriction>`, and a `<simpleValue>` has no restriction to put one in. A field on all six
variants would let the builder hold prose the exporter has nowhere to write.

**Why on the value rather than beside it.** `ids.xsd` types **nine** parameters across the six facet
kinds as an `idsValue`, four of the kinds carrying two of them, plus the rule's own
`entityPredefinedType`. Storing the annotation beside the value the way `explicitCardinality` is
stored beside the cardinality means ten new fields — `nameAnnotation`, `valueAnnotation`,
`systemAnnotation`, `propertySetAnnotation`, `baseNameAnnotation` and a `predefinedTypeAnnotation`
in each of the three places one nests. One field on the value instead reaches all ten through the
three functions that already serve every parameter: `idsValueXml` writes them all, `readValueDraft`
reads them all, `FacetValueEditor` edits them all. The analogy to `explicitCardinality` argues the
other way once it is stated plainly: a cardinality is a bare string with no room for a flag, and a
`ValueDraft` is an object with room.

**What it costs the other way.** Two things, both real:

- **A change of operator drops it.** `valueDraftForOperator` builds a fresh value from an operator
  and a literal, so switching a row from `matches` to `be exactly` produces a `simple` value that
  cannot carry an annotation — the author's prose is destroyed by an edit that is not about it.
  Stored beside the value, it would survive. This is paid rather than avoided: the editor carries
  the annotation across every operator that can hold one, and the one that cannot is the one whose
  file has no restriction left to put it in.
- **The applicability `<entity><name>` still cannot hold one.** That name is `entityTypes: string[]`
  on the rule, not a `ValueDraft`, so there is no value for the field to sit on. It keeps refusing,
  and the corpus says that costs nothing: all three annotated entity names are
  `<xs:pattern value="IFCFLOWFITTING|IFCFLOWSEGMENT"/>` and its like, refused for the pattern
  whatever happens to the annotation. **None of the 12 `entity/name` refusals is claimed by this
  stage** — the note at the end of the metadata section said four of the refusals turn on an
  annotation, and the true number is two.

### Read only what the exporter reproduces exactly

The same discipline `affixReadingOf` and the non-string base check already apply. `<xs:annotation>`
has a content model of its own — `(appinfo | documentation)*`, an `id`, and `source` and `xml:lang`
on each `<xs:documentation>`, whose content is mixed and may hold markup. The draft carries a plain
string, so a string is claimed only where writing it back reproduces the source:

- exactly one `<xs:documentation>` child, holding text and no elements;
- no attributes on either element;
- standing as the restriction's first element child, which is where XSD puts it.

Anything else keeps the facet verbatim, with a reason naming what stopped it. `""` and absent stay
different, the way `undefined` and `""` had to differ on `ifcVersion`: a document stating an empty
`<xs:documentation>` gets one back.

**An annotation inside a restriction facet refuses.** A `ValueDraft`'s `enum` is a list of strings
and has nowhere to hold prose per member. Refusing keeps the whole facet verbatim, which is what
already happens to `ramen` today — the difference is that it will now be refused for the reason it
has, rather than passed through for a different one and then read past.

### The staging, and what each commit is predicted to move

| | commit | predicted refusals | predicted pass-through | why |
| --- | --- | --- | --- | --- |
| **1** | the validator's tolerance is pinned | 17, unmoved | 24, unmoved | it already reads through one; the test only records it |
| **2** | the draft carries it, both ways | 17 → **15** | 24 → **18** | 7 annotated facets read, less the one `ramen` enum-annotation now refused for its own reason |
| **3** | the row shows it, and an edit keeps it | 15 | 18 | authoring-side; a number moving here means the draft model leaked into the engine |

Refused-whole and pass-through are read as a pair, so the number to watch is **41 → 33**.

## Stage 6, the annotation — landed and measured 2026-08-16

Three commits on `feat/ids-annotation`, off `master` at `cb90673`.

| | commit | conformance | refused whole | pass-through | gate |
| --- | --- | --- | --- | --- | --- |
| **1** | the validator's tolerance is pinned | 317 | 17 | 24 | 864 → 867 |
| **2** | the draft carries it, both ways | 317 | **17 → 15** | **24 → 18** | 867 → 873 |
| **3** | the row shows it, and an edit keeps it | 317 | 15 | 18 | **880** |

**Refused-whole plus pass-through fell 41 → 33**, which is the pair the rail is read on, and every
prediction in the section above held to the number. Conformance never moved: 317 agreed / 15 wrong /
2 refused / 0 errored, **0 cases gained and 0 lost** against a refreshed baseline, 0 false passes.
The corpus reproduced 7,784 / 7,784 with 0 drifted, 3 schema-invalid in and out and 0 files losing a
requirement facet; metadata held at 7,784 / 7,784 `<info>` blocks and 41,751 / 41,751 attribute sets.

### The premise the stage was planned on was wrong, and checking it first was the whole saving

The validator was said to refuse an annotation. It has read past one since `55f6871`. So commit 1 is
a test rather than a change, and the "land each reader as its own commit" staging still holds —
there is simply nothing for the first reader to do. Had it been assumed rather than probed, the
first commit would have been a rewrite of a function that was already correct.

### The second level of annotation, which no harness could have caught

XSD lets **every** restriction facet carry an `<xs:annotation>`, not only the restriction itself, and
`IDS_random_example.ids` writes one inside each of three `<xs:enumeration>` elements. `readValueDraft`
took each enumeration's `value` attribute and never looked at its children, so that prose was read
past and dropped — and `parseIdsXml` ignores it too, so **both sides of the round-trip comparison
agreed about a document that had lost it**. The info-fidelity harness looks at `<info>` and the
`<specification>` attributes, so it could not see it either.

It cost nothing only because the one specification holding it was refused whole and kept verbatim.
Reading the annotation on that same specification's applicability classification is exactly what
turns it into a rule — so this stage is what would have made a latent loss live. It refuses instead,
and that refusal is the single riser in the pass-through count: 7 annotated facets read, 1 new
refusal, 24 → 18.

### What the field costs, paid rather than avoided

`carryAnnotation` moves the prose onto whatever restriction replaces the one it documented, because
`valueDraftForOperator` and the row's retargeting both build a **fresh** value. Without it, changing
the operator, the field or the property set would destroy a sentence the edit was not about. It
stops at `simple`, and it has to: a `<simpleValue>` has no `<xs:restriction>` to hold an annotation.
The note vanishing beside the control is what tells the author that.

### Measured on the real 37 MB model

The user's own `3.6_contain_NlSfb.ids` carries no annotation, so one was added to its `<xs:pattern>`
and the same rule run both ways. Parse **2,784 ms**, inside the 2,593–2,988 ms band; 28,645 scoped
entities; checking the one specification takes **10–15 ms**.

| the file | applicable | passed | failed | re-export carries it |
| --- | --- | --- | --- | --- |
| as written | 286 | 198 | 88 | — |
| with an `<xs:annotation>` | 286 | 198 | 88 | yes |

Identical, which is the claim: prose constrains nothing, and `compileValue` drops it with everything
else that records how the file was written. Two details the run had to correct for, both already
known: `IFCELEMENT` is abstract and an imported rule keeps the author's list unexpanded, so it
selects 0 of 28,645 — the measurement uses `IFCFLOWFITTING` (286); and the file declares
`dataType="IFCLABEL"` where the model stores its NL/SfB codes as `IFCTEXT`, which fails all 286 on
the stored type alone and leaves one number repeated instead of a split to be identical about.

### What is left

- **Two `<xs:pattern>` children on one value — 3 pass-throughs, and it is not what the note said.**
  All three are `restriction/*regex_patterns_work_in_OR*` conformance files writing two patterns in
  one `<xs:restriction>`, which XSD **ORs**. Not a range intersected with an enumeration — the
  corpus writes no such thing. Both readers take the *first* pattern and drop the second:
  `parseRestriction` by `nodesNamed(...)[0]`, the importer by refusing `patterns.length > 1`. **This
  one can move the scoreboard**, and it is the only remaining mechanism that can:
  `restriction/pass-regex_patterns_work_in_OR_2_3` is one of the 15 wrong answers, and we agree with
  the other two by luck rather than by reading them.
- A non-string base on an enumeration — 1 pass-through, the same shape as the base a `bounds` draft
  already carries.
- 8 `property` pre-1.0 `<name>` and 5 `measure`, which are permanent.
- The 15 refusals: 12 `applicability/entity/name` (8 of them the `<n>` files, 4 genuine patterns), 2
  `applicability/attribute` (the `<n>` files), 1 `applicability/classification` stating no
  `<system>`. **No annotation is left on either list.**

## Stage 7 — several `<xs:pattern>` on one value: the decision, written before the code

The note calling this "two restriction families on one value" and "a range intersected with an
enumeration" described something the corpus does not contain. Reading the three facets settles what
it is: **two `<xs:pattern>` children inside one `<xs:restriction>`**, which XSD 1.0 §4.3.4 reads as
a **disjunction** — a value is valid if it matches any one of them. All three are conformance files,
and their own names say so: `restriction/*-regex_patterns_work_in_OR_*`.

### This is a wrong answer, not only a fidelity gap

Both readers take the first pattern and drop the rest — `parseRestriction` by
`nodesNamed(restrictionChildren, "pattern")[0]`, the importer by refusing `patterns.length > 1`. On
the validator side that is a rule that under-matches and reports a clean verdict, which is the
direction a check must never be wrong in.

The suite says exactly how much: the value in all three models is `XY99`.

| case | patterns, in order | first matches | our answer | expected |
| --- | --- | --- | --- | --- |
| `pass-…_1_3` | `[A-Z]{2}[0-9]{2}`, `[a-z]{2}[0-9]{2}` | yes | pass | pass — **agree by luck** |
| `pass-…_2_3` | `[a-z]{2}[0-9]{2}`, `[A-Z]{2}[0-9]{2}` | no | fail | pass — **wrong** |
| `fail-…_3_3` | `[a-z]{3}[0-9]{2}`, `[A-Z]{3}[0-9]{2}` | no | fail | fail — agree |

So **the scoreboard can move here, and this is the only remaining mechanism that can**: 317 → 318,
with the two lucky agreements becoming read ones.

### The decision: the draft holds the list, the compiled restriction holds the disjunction

`ParsedRestriction` does not change at all. A disjunction of anchored patterns is one anchored
pattern — `^(?:A)$ or ^(?:B)$` is exactly `^(?:A|B)$`, because `|` binds loosest inside the group —
so `parseRestriction` joins the sources and `compilePattern` compiles one regex. `facet-evaluation`
is untouched, and its message names the disjunction the author wrote.

The **draft** is where the two must stay apart, because it is what the exporter writes from:

```ts
| { kind: "pattern"; sources: string[] }   // was: source: string
```

**Why not join them in the draft too.** `"[a-z]{2}[0-9]{2}|[A-Z]{2}[0-9]{2}"` is a regex the author
did not write. Handing that back is the thing the import work exists not to do, and it is the same
rule that keeps `entityNamesAsEnumeration`, a bound's literal `"1.50"` and a range's capitalised
`xs:Decimal` base.

**Why a list on the existing variant rather than a second kind.** `bounds` holds two edges in one
variant and `length` holds three; a `patterns` kind beside `pattern` would be the same concept under
two names, and every switch would carry both arms anyway. The cost is a rename across roughly thirty
sites, nearly all of them tests.

**What the row shows.** `friendlyReadingOf` answers `matches` for one source and **`null` for
several**, the honest answer it already gives a range and a length: no operator states "matches any
of these". The row says what it holds rather than mislabelling it, and the value is kept.

### The staging, and what each commit is predicted to move

| | commit | predicted conformance | predicted pass-through |
| --- | --- | --- | --- |
| **1** | the validator ORs them | **317 → 318** | 18, unmoved — the importer is untouched |
| **2** | the draft carries them, both ways | 318 | **18 → 15** |
| **3** | the row states what it holds | 318 | 15 |

Refusals stay at 15: no applicability facet in the corpus writes two patterns.
