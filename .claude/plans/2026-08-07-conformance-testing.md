# Session: validate our IDS output with an independent checker

**Goal:** stop grading our own homework. Every IDS bug found on 2026-08-06/07 lived in the gap
between "we reproduce the input" and "an independent implementation agrees with us". Close it.

**Do this session first.** It turns the other sessions from opinion into measurement — the regex
work in particular cannot be settled without it.

Related: `2026-08-07-full-ids-scope.md` (the schema/facet picture), `2026-08-07-regex-dialect.md`.

---

## Why our current checks cannot catch this class of bug

Three tiers of claim, and we only test the first two:

| Claim | How we test it | Status |
| --- | --- | --- |
| We reproduce a file we imported | corpus round-trip, 7,784 files | ✅ for `<specifications>` |
| Our output has the right shape | `idsSchemaViolations()` | ✅ structural only |
| An independent checker agrees with our verdict | nothing | ❌ |

`idsSchemaViolations` is hand-written from `ids.xsd` by the same person who wrote the exporter, so
it inherits the same misreadings. It caught the `<info>` ordering bug only because that rule was
copied from the schema rather than remembered. It will not catch a wrong *interpretation*.

## The two assets that make this cheap

**1. `ifctester` is vendored in the corpus** at
`/tmp/ids-corpus/IfcOpenShell-0.8.0/src/ifctester/`. Note its dependency split, which matters:

- `ifctester/ids.xsd` — the real schema, shipped in the package
- `xmlschema` — **pure Python**, no native build. Enough to validate an IDS document properly.
- `ifcopenshell` — native, heavy. Only needed to *run* an IDS against an IFC.

**2. The official conformance suite** at
`/tmp/ids-corpus/IDS-development/Documentation/ImplementersDocumentation/TestCases/` —
**318 paired `.ids` + `.ifc` cases**, each named `pass-…` or `fail-…`, so the expected verdict is
in the filename. No checker needed to know the right answer.

| attribute | classification | entity | material | partof | property | restriction | tolerance | ids |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 56 | 27 | 25 | 29 | 34 | 74 | 25 | 36 | 12 |

This is the definitive enumeration of what an IDS implementation must do, and it is sitting on disk.

## Suggested shape: two tiers, ship tier A first

**Tier A — schema conformance (cheap, deterministic, belongs in the gate).**
Validate every document we emit against the real `ids.xsd` using `xmlschema`. Pure Python, fast,
no IFC involved. Feed it: every fixture, every corpus round-trip output, and the ~1,152
combinatorial authored exports (the generator for those is in this session's history — operators ×
facet kinds × hostile text × entity counts; rewrite it as a permanent test).

This subsumes `idsSchemaViolations`. Decide whether to keep that function as a fast in-process
check for the browser and demote it to a convenience, or delete it once tier A covers the gate.

**Tier B — verdict conformance (the real prize, heavier).**
Run the 318 conformance cases through *our* validator and compare our pass/fail against the
filename. Where we disagree, we are wrong. This is what would have caught the regex dialect issue,
the 156 silently-green specifications, and the property-subtype gap — all in one run.

Tier B needs our IFC adapters to parse the case `.ifc` files, so it exercises the whole stack, not
just `ids-validator`. Expect a lot of red on the first run; that is the point. Record the baseline
and treat it as a scoreboard rather than a gate until it is mostly green.

## Environment: this is the actual first task

**There is no `pip` in this sandbox** — `python3` exists, but `python3 -m pip` and
`python3 -m ensurepip` both fail. Node and npm have network access; the npm registry responds.

So decide and document the approach before writing tests:

- Is Python available on the user's own machine and in CI, or does this have to be Node-only?
- If Python: how is it provisioned in the sandbox, and does `scripts/verify.mjs` shell out to it?
  A gate stage that silently skips when Python is absent is worse than no stage — it reads green.
- If Node-only: is there a pure-JS XSD validator that handles `ids.xsd`? Investigated briefly and
  the candidates need native builds or a JVM. Worth a proper look before conceding.

**Ask the user before adding a runtime dependency to the gate.** A four-stage gate that suddenly
needs Python changes how everyone runs the project.

## Done when

- Every IDS document we emit is validated against the real `ids.xsd`, in the gate.
- The 318 conformance cases run against our validator, with a recorded baseline and a written
  list of which we fail and why.
- The gate fails loudly, not silently, when the checker cannot run.
- `2026-08-07-full-ids-scope.md` is updated with the conformance baseline, since it changes what
  "full IDS support" has to mean.

## Gotchas

- The corpus lives at `/tmp/ids-corpus` and **may not survive a sandbox reset**; the 3a note
  (`2026-07-25-ids-import-scope.md`) lists the source repos to re-download.
- Three corpus files are schema-invalid on the way *in* (two have `<n>` where `<name>` belongs,
  from markdown mangling). We reproduce them faithfully. Tier A must not treat those as our bug.
- Conformance cases use `base="xs:double"` restrictions, which our importer deliberately refuses
  today. A refusal is not a wrong verdict — count it separately from a wrong answer.
