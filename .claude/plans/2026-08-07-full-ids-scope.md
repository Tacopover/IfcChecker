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
