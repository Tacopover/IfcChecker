# Session: the total picture of IDS 1.0

**Goal:** one document that says what an IDS implementation must do, what we currently do, and what
the builder can realistically offer a user — complete enough that no more surprises arrive one at a
time.

**Start from `2026-08-07-full-ids-scope.md`**, which already covers the schema shape, facet and
restriction frequencies, cardinality, and a staged plan. This session is the layer under it: the
*behavioural* rules, which the XSD does not express and which is where every bug so far has lived.

Related: `2026-08-07-conformance-testing.md` (do that one first if you can — it converts most of
the questions below from reading into measurement).

---

## Why the XSD is not enough

Everything found on 2026-08-06/07 was schema-legal and semantically wrong:

- a specification whose every requirement was dropped reported a clean pass (156 of 464 corpus
  specifications)
- a `matches` pattern using `^`/`$` exports as valid XSD that means something different
- `<info>` children in the wrong order — legal-looking, invalid, invisible to a round-trip test

The XSD tells you what may appear. It does not tell you what a checker must *conclude*. That lives
in the User Manual prose and, definitively, in the conformance suite.

## The sources, in order of authority

1. **The conformance suite** —
   `/tmp/ids-corpus/IDS-development/Documentation/ImplementersDocumentation/TestCases/`,
   **318 paired `.ids` + `.ifc` cases** named `pass-…`/`fail-…`. This is the specification as
   executable behaviour. Per facet: attribute 56, classification 27, entity 25, material 29,
   partof 34, property 74, restriction 25, tolerance 36, ids 12.
2. **The User Manual** — `IDS-development/Documentation/UserManual/*.md`. Each facet page has an
   *interpretation* table for applicability and for requirements, including which cardinality
   combinations are **not allowed** and why. `entity-facet.md` is 627 lines; `units.md` is the
   conversion table; `restrictions.md` covers the four restriction kinds.
3. **`ids.xsd` 1.0.0** — `IDS-development/Schema/ids.xsd`. Structure only.
4. **`ifctester`** — `/tmp/ids-corpus/IfcOpenShell-0.8.0/src/ifctester/facet.py` is a second
   implementation's reading of the same prose. Useful for tie-breaking, not authoritative.

## Questions the document has to answer

Grouped by where they bite. Each should end with a decision, not a summary.

**Semantics we have never implemented**

- **`tolerance`** — 36 conformance cases, and the topic has its own doc
  (`ImplementersDocumentation/tolerance.md`). How are numeric comparisons meant to tolerate
  floating-point error? We currently compare strings. This is a whole area that has not been on
  any list.
- **Units.** `units.md` says numeric values in IDS are SI and the model's values must be converted
  before comparison. We do no conversion at all. Which measures matter in practice, and what is
  the smallest honest subset?
- **`minOccurs="0"` vs `"1"` on applicability** — "this subset is optional" vs "at least one must
  exist in the model". The second is a model-level assertion we have no concept of; every check we
  do is per element.
- **Cardinality `optional`** — "if present, comply". Different from anything we evaluate.
- **`prohibited` with a value** — "must not be *this* value", as opposed to must not exist. Our
  evaluator ignores the restriction when cardinality is prohibited (`facet-evaluation.ts`), which
  is wrong, and the importer passes those facets through to avoid the issue.

**Facet behaviour we would have to get right to support them**

- **partOf** traverses five relationship types **recursively**, and when `relation` is omitted,
  *all* of them. What does "recursively" bound out at on a 1.6 GB federated model?
- **material** matches a name *or* a category, and matches through layers, profiles and
  constituents. The manual's own example table is the test: IDS `Steel` matches a material named
  `S275` whose category is `Steel`.
- **classification** — system is required, value optional, and the manual distinguishes "the
  system is populated" from "the system has this value".
- **property** — IDS covers single, bounded, list, table and enumerated property values, and the
  interpretation differs per kind (a single IDS value needs one IFC value to match; a bounds
  restriction needs *all* of them to fall inside). See `2026-08-07-web-ifc-property-subtypes.md`
  — we read only the single-value kind on one engine.

**What the builder can honestly offer**

The scope note proposes the UI shape (collapsed facet rows, one restriction editor, an extended
model-explorer rail). This session should pressure-test that against the full behaviour list and
say plainly which constructs are:

- worth a first-class control,
- worth carrying but not editing (the pass-through mechanism already exists), or
- worth refusing loudly, because a control would imply a guarantee we cannot keep.

The refusal category is a legitimate answer and should not be empty. `tolerance` and full unit
conversion are the obvious candidates.

## Done when

- One document lists every behavioural rule with a source citation, our current status, and a
  decision.
- The staging in `2026-08-07-full-ids-scope.md` is revised against it — expect it to change; the
  scope note was written from the schema and has no `tolerance` or units stage.
- Every open question in the scope note is either answered or explicitly deferred with a reason.

## Gotchas

- Measure the **hand-authored** corpus subset separately. The bSI Japan set is machine-generated,
  100% unrepresentable, and swamps any total it appears in. Two numbers in an earlier version of
  the scope note were wrong for exactly this reason.
- `/tmp/ids-corpus` may not survive a sandbox reset; `2026-07-25-ids-import-scope.md` lists the
  repos to re-download.
- Resist writing a summary of the spec. The value is in the decisions, and a restatement of
  `ids.xsd` already exists in the scope note.
