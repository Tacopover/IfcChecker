# Goal 3a — IDS import: inventory of the gap

Deliverable for `goals.md` §3a. Measured 2026-07-25 against **2,815 real `.ids` files /
14,213 specifications**, not against the spec text. Feeds the 3b/3c/3d decisions, which need
the user.

Reproduce: download the repos below into one directory, then run the two scripts kept beside this
file — `2026-07-25-ids-corpus-analyse.mjs` (construct frequency, representability, drift) and
`2026-07-25-ids-corpus-inert.mjs` (the silently-inert measurement). Both take the corpus root as a
constant at the bottom; they read `.ids` files only and write nothing.

```
buildingSMART/IDS                              (branch: development — note, not master)
bSJ_IDS            buildingSMART-Japan/bSJ_IDS
Community-Sample-Test-Files  buildingsmart-community/Community-Sample-Test-Files
IDS_BimBem         labeee/IDS_BimBem
OpenAEC-BIM-validator        OpenAEC-Foundation/OpenAEC-BIM-validator
ifc-audit          CarloCogni/ifc-audit
```

These same files are what `goals.md` §3f should round-trip against.

---

## Headline: there is a live bug, and it is worse than the import risk

`parseIdsXml` drops every applicability facet that is not `<entity>` (`parse-ids.ts:145`,
`warnUnsupported` at `:169`). The specification still parses — it just comes back with
`applicabilityEntityNames: []`. And `matchesApplicability` is
`entityNames.some(...)` (`facet-evaluation.ts:17`), which on an empty array is **`false`**.

So a specification we only partly understand does not fail loudly and does not over-match. It
silently matches **nothing**, contributes **zero** violations, and the user is told their model
is clean.

This is reachable today on the Validate page, not just via the unbuilt import:

- `parseAndValidateFiles` guards with `parseIdsXml(idsXml).length === 0`
  (`apps/web/src/local/parseAndValidate.ts:116`). The specs *do* parse, so the guard passes.
- `validateElements` then skips every element for every spec (`validate-elements.ts:19`).

Verified end to end against a real government-issued file
(`共同溝・電線共同溝_共同溝_プレキャスト構築工_プレキャスト躯体工.ids`, bSI Japan / MLIT):

```
specifications parsed (so the "is this a valid rule set?" guard passes): 3
total requirement facets across those specs:                            9
elements validated:                                                    15
VIOLATIONS REPORTED:                                                    0
```

Across a 200-file sample of that standard: **1,046 of 1,046 specifications (100%) parse to an
empty applicability and match nothing.**

A user validating against the Japanese national BIM/CIM standard today gets a clean report,
every time, whatever is in their model. **This should be fixed before import is designed** —
it is the same silent-false-pass failure the MVP's export guards were built to prevent,
arriving on the validate side.

---

## Corpora

| # | Corpus | Files | Specs | Fully representable by `RuleDraft` |
|---|--------|------:|------:|-----------------------------------:|
| A | buildingSMART official test cases (synthetic — spec coverage, not practice) | 318 | 318 | **29.9%** |
| B | buildingSMART published examples (hand-authored, realistic) | 12 | 38 | **10.5%** |
| C | bSI Japan / MLIT BIM-CIM cost estimation, FY2025 (real, government-issued) | 2,476 | 13,749 | **0.0%** |
| D | Molio (DK), BimBem (BR), OpenAEC, ifc-audit | 9 | 108 | **5.6%** |
| | **total** | **2,815** | **14,213** | **105 specs — 0.7%** |

Corpus A is deliberately one-construct-per-file, so its *frequencies* mean nothing but its
*coverage* is complete. B and D are the honest signal for hand-authored practice. C is one
authority's generated output — it dominates the totals and should be read as one data point
with 13,749 specifications behind it, not as 13,749 independent observations.

---

## The gap, by construct

Marked **blocking** (import is wrong without it), **droppable** (losable with an honest
report), or **supported**.

### Applicability

| Construct | A | B | C | D | Status |
|---|---:|---:|---:|---:|---|
| `<entity>` with `simpleValue` name | 318 | 27 | 0 | 88 | **supported** |
| `<entity>` name as `xs:restriction` (pattern/enum over type names) | 0 | 11 | 0 | 8 | **blocking** |
| `<entity>/<predefinedType>` | 0 | 7 | 0 | 0 | **blocking** |
| `<property>` facet | 0 | 1 | 13,749 | 12 | **blocking** |
| `<attribute>` facet | 0 | 1 | 13,749 | 6 | **blocking** |
| `<classification>` facet | 0 | 2 | 0 | 1 | **blocking** |
| `<material>` facet | 0 | 2 | 0 | 0 | **blocking** |
| `minOccurs="0"` on `<applicability>` | 318 | 38 | 13,749 | 99 | **droppable** (default) |

Applicability is where the model is narrowest and the consequence is worst. Our builder's whole
applicability concept is "one or more IFC entity types"; IDS lets you select by property value,
attribute value, classification or material — and the MLIT standard uses *exactly that*, with no
`<entity>` facet at all, selecting by `ObjectType` value plus a quantity property.

### Requirements

| Construct | A | B | C | D | Status |
|---|---:|---:|---:|---:|---|
| `<property>` facet | 110 | 129 | 30,851 | 71 | **supported** |
| `<attribute>` facet | 94 | 33 | 0 | 48 | **supported** |
| `<classification>` facet | 27 | 3 | 0 | 21 | **blocking** |
| `<partOf>` facet | 34 | 6 | 0 | 0 | **blocking** |
| `<material>` facet | 29 | 3 | 0 | 9 | **blocking** |
| `<entity>` facet in requirements | 25 | 1 | 0 | 0 | **blocking** |
| `cardinality` absent / `required` | 301 | 129 | 30,851 | 145 | **supported** |
| `cardinality="prohibited"` | 6 | 0 | 0 | 4 | **supported** |
| `cardinality="optional"` | 12 | 46 | 0 | 0 | **blocking** |

### Values and restrictions

| Construct | A | B | C | D | Status |
|---|---:|---:|---:|---:|---|
| `<simpleValue>` (exact) | 119 | 5 | 21,291 | 4 | **supported** |
| no `<value>` (existence check) | 44 | 64 | 0 | 97 | **supported** |
| `xs:enumeration` | 10 | 32 | 9,560 | 5 | **supported** |
| `xs:pattern` | 9 | 12 | 0 | 7 | **supported** |
| `xs:minInclusive` / `maxInclusive` | 14 | 12 | 0 | 12 | **blocking** |
| `xs:minExclusive` / `maxExclusive` | 10 | 44 | 0 | 0 | **blocking** |
| `xs:length` / `minLength` / `maxLength` | 10 | 0 | 0 | 0 | **blocking** |
| `xs:annotation` inside a restriction | 0 | 7 | 0 | 0 | **droppable** |
| `propertySet` / `baseName` as `xs:restriction` | 8 | 2 | 0 | 0 | **blocking** |
| `attribute` name as `xs:restriction` | 4 | 0 | 0 | 0 | **blocking** |

Restriction bases seen: `xs:string`, `xs:double`, `xs:integer`, and — note the casing —
`xs:Decimal` / `xs:Integer` in corpus D. Any base-type handling must be case-insensitive.

### Data types

`dataType` is hardcoded to `IFCLABEL` on export (`rule-draft.ts:37`). Observed in the wild:

`IFCTEXT` (30,890), `IFCLABEL` (61), `IFCREAL` (53), `IFCLENGTHMEASURE` (38), `IFCBOOLEAN` (35),
absent (27), `IFCAREAMEASURE` (12), `IFCTIMEMEASURE` (8), `IFCCOUNTMEASURE` (8),
`IFCIDENTIFIER` (5), `IFCINTEGER` (4), `IFCPOSITIVELENGTHMEASURE` (4), `IFCDURATION` (3),
`IFCLINEARVELOCITYMEASURE` (3), `IFCTHERMALTRANSMITTANCEMEASURE` (3), `IFCDATE` (2),
`IFCDOORPANELOPERATIONENUM` (2), `IFCLOGICAL` (1), `IFCPLANEANGLEMEASURE` (1),
`IFCURIREFERENCE` (1).

**`IFCLABEL` is a minority value everywhere.** `IFCTEXT` alone outnumbers it 506:1. Round-tripping
any real file through the builder rewrites the type of every property — status: **blocking for
round-trip**, even though it does not affect our own in-app evaluation (we never read `dataType`).

### Metadata

| Construct | A | B | C | D | Status |
|---|---:|---:|---:|---:|---|
| `<specification name>` | 318 | 38 | 13,749 | 108 | **supported** |
| `<specification ifcVersion>` | 318 | 38 | 13,749 | 108 | **droppable** (we hardcode `IFC4`) |
| `<specification description>` | 0 | 20 | 0 | 89 | **droppable** |
| `<specification identifier>` | 0 | 0 | 0 | 77 | **droppable** |
| `<specification instructions>` | 0 | 2 | 0 | 77 | **droppable** |
| `<info>` title / date | all | all | all | all | **supported** |
| `<info>` description, author, copyright, version, purpose, milestone | — | 3–8 | all | 5–9 | **droppable** |

`ifcVersion` deserves attention beyond "droppable": we emit `ifcVersion="IFC4"` unconditionally.
Across the whole corpus the declared targets are IFC2X3 14,138 / IFC4 393 / IFC4X3_ADD2 27 —
dominated by corpus C. Restricted to the hand-authored files (B + D), it is **IFC2X3 51.3%,
IFC4 37.0%, IFC4X3_ADD2 11.7%**. Either way, IFC4 is not the common case: re-exporting an IFC2X3
or IFC4.3 file as IFC4 is a factual misstatement about the file's target schema, and the
IFC4X3_ADD2 share connects directly to `goals.md` §1.

---

## Which way does the meaning move?

The question 3b actually turns on. Percentages are of specifications in that corpus; one spec can
hit several rows. The two applicability rows are measured directly against our parser's rule
(`applicabilityEntityNames` is built only from `<entity>` facets whose `<name>` holds a
`<simpleValue>`); the rest come from the construct analysis.

| Drift | A | B | C | D |
|---|---:|---:|---:|---:|
| **Silently inert** — no usable entity name, matches nothing, reports zero violations | 0% | 28.9% | **100%** | 18.5% |
| **Silently looser** — a requirement is dropped or weakened; passes what the original failed | 47.5% | 55.3% | 0% | 37.0% |
| Type change — `dataType` rewritten; an external checker may match differently | 23.3% | 57.9% | 100% | 28.7% |
| Widened applicability — some facets dropped but ≥1 entity kept; checks too much, loudly | 0% | 13.2% | 0% | 2.8% |
| `cardinality="optional"` read as required — false failures, loudly | 3.8% | 28.9% | 0% | 0% |
| Metadata only — meaning unchanged | 0% | 73.7% | 0% | 82.4% |

The bottom three rows are tolerable: two produce visible false failures the user will investigate,
the third loses prose. The top two are the problem — they fail silently in the direction of
*approval*, which is the one direction a compliance tool must never fail in.

**13,780 of 14,213 specifications (97.0%) are silently inert today.** Excluding corpus C, still
31 of 464 (6.7%) — so this is not solely an artefact of the Japanese corpus. Note corpus A scores
0%: the official test cases all use a plain `<entity>` applicability, which is exactly why the
existing test suite never caught this.

---

## What this implies for 3b/3c/3d (recommendation, not a decision)

The user should decide, but the measurement points one way.

**Refuse-what-we-cannot-represent is not viable as stated.** It would reject 99.3% of the corpus
(77.4% excluding corpus C). 2,719 of the 2,815 files (96.6%) contain at least one specification
we could not represent, so refusal is per-file in practice too. As a *contract* it is right; as a
*product* it is an import button that never works.

**Pure lossy-with-a-report is also weak here**, because the losses are not evenly distributed.
Dropping an `<instructions>` string is nothing; dropping an applicability `<property>` facet turns
a rule into a no-op. A single "some things were lost" acknowledgement flattens that distinction.

**The recommendation is a split contract**, which is really a fifth option:

1. **Represent** what the model covers (entity applicability, attribute/property requirements,
   exact/enum/pattern, required/prohibited).
2. **Refuse to import a specification** whose *applicability* we cannot fully represent — because
   that is the case where a partial import is silently wrong rather than merely incomplete. Show
   it in the loss report as "not imported", and keep it out of the rule list entirely.
3. **Pass through** unrepresented *requirement* facets and all metadata as opaque XML attached to
   the rule, re-emitted verbatim. This is what covers the 37–55% of hand-authored specs that lose
   a requirement — an extra `<classification>`, a `<partOf>`, a numeric bound — and it is the only
   option that keeps those from turning into silent approvals.
4. **Report** everything in categories 2 and 3 before the user can edit.

That also gives a natural answer to **3c**: the round-trip guarantee becomes *semantic
equivalence for imported-and-untouched rules, best-effort with a diff for edited ones* — testable
as `idsXmlToDrafts(x) → buildIdsXml → parseIdsXml` equals `parseIdsXml(x)` for every spec not
marked unimported, which can run over all 2,815 corpus files as a single test.

The cheapest thing that raises representability most, if the user prefers narrowing the gap over
building pass-through. Counted as **distinct specifications** citing the change as at least one
of their blockers — a spec usually has several, so removing one blocker does not by itself make
it importable.

| Change | All corpora (14,213 specs) | Hand-authored only, B+D (464 specs) |
|---|---:|---:|
| Carry `dataType` through instead of hardcoding `IFCLABEL` | 13,876 (97.6%) | 127 (27.4%) |
| Applicability by attribute/property value | 13,766 (96.9%) | 17 (3.7%) |
| Classification / material / partOf requirement facets | 129 (0.9%) | 129 (27.8%) |
| Spec-level metadata (description, identifier, instructions) | 111 (0.8%) | 111 (23.9%) |
| Numeric bounds (`min`/`maxInclusive`, `min`/`maxExclusive`) | 34 (0.2%) | 34 (7.3%) |
| `<entity>` as a *requirement* facet | 26 (0.2%) | 26 (5.6%) |
| `cardinality="optional"` | 23 (0.2%) | 23 (5.0%) |
| Entity name pattern / `predefinedType` in applicability | 23 (0.2%) | 23 (5.0%) |
| `propertySet` / `baseName` / attribute name as restriction | 18 (0.1%) | 18 (3.9%) |
| Length restrictions | 6 (0.0%) | 6 (1.3%) |
| Classification / material facets in applicability | 5 (0.0%) | 5 (1.1%) |
| Applicability-only or empty specification | 2 (0.0%) | 2 (0.4%) |

**The two columns tell different stories, and the difference is the most important thing in this
document.** Corpus C is one authority's machine-generated output, and it is so large that it
decides any total it is included in. Judged on it alone, the gap is two changes wide. Judged on
hand-authored files — which is what a user is likely to be handed by a client or a national
standard body — the gap is broad and flat: no single change clears more than 28%, and the top
four are four unrelated pieces of work.

So "just add the two big things" is an artefact of one corpus. Only `dataType` pass-through
scores well on both, which is what makes it the clear first move.

---

## Immediate follow-up, independent of the import decision

1. **Fix the silent no-op.** A specification whose applicability we could not fully parse must not
   evaluate as "matches nothing". At minimum, `parseIdsXml` should mark it and
   `parseAndValidateFiles` should refuse the file with a clear message. This is `goals.md` §3e
   (parser reports instead of warning) — but it is a bug fix, not import scaffolding, and should
   be pulled forward.
2. **Carry `dataType` through.** Listed in `goals.md` under "Smaller known gaps"; the measurement
   promotes it — it blocks round-trip on ~99% of real specifications.
