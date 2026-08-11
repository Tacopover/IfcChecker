Continue the full-spec IDS authoring UI. **Stage 2 is done and merged; take stage 3 and stage 4.**

`master` is at `9b12229` and pushed. No branch stack — branch off `master`, and ask before merging
anything back to it.

Read `.claude/plans/2026-08-11-stage-2-facet-draft.md` first. Its final section, "Landed and
measured — 2026-08-11", is the current state: what each of the five commits moved, where the one
prediction missed and why, and the four places the plan as written turned out to be wrong. Then
read `.claude/plans/2026-08-07-full-ids-scope.md` for stages 3–5, and these Decisions-Log entries
in the Obsidian hub: **2026-08-11 "`ConditionDraft` → `FacetDraft` shipped"**, **2026-08-11 "a
`ValueDraft` stores an affix operator"**, **2026-08-11 "refusal-count predictions are biased by
first-reason-wins"**, and **2026-08-11 "the no-facet-lost invariant is now pinned"**.

## Where stage 2 left the model

`FacetDraft` is a union over all six facets `ids.xsd` allows in `<requirements>`. `compileFacet`
and `build-ids`'s `facetXml` are already **total over all six**, and libxml2 accepts a document
holding every kind at once. `ConditionDraft` is now just the two members a condition row can edit,
and `isConditionFacet()` narrows to it. **The importer is the only thing that has not caught up**:
it reads two kinds and keeps the other four verbatim. That is what makes stage 4 additive.

## The task

**Stage 3 — `length`.** `ParsedRestriction` has no `length` variant, so the importer refuses a
restriction carrying `xs:length`, `xs:minLength` or `xs:maxLength`. Worth **6 corpus facets**, all
attribute. This one changes the *validator*, not just the draft, so it is the one that can move a
conformance number legitimately — say so out loud if it does, and say which cases moved.

**Stage 4 — the importer reads the four new facet kinds.** classification (47), partOf (39),
material (34) and requirement-side entity (25): **145 of the 191 remaining pass-throughs.** The
draft shapes, the compile and the exporter all exist already; `readFacet` refuses them at its first
line. `RuleCard` already renders a read-only `UnshownFacetRow` for a facet no condition row can
edit, so a newly-imported classification will appear in the rule rather than vanish from it.

Land one mechanism per commit, and report which cases moved — never just the total.

## Guard rails, at every commit

- **Conformance**: `corepack pnpm --filter @ifc-qa/ids-validator test:conformance`, holding at
  **302 agreed / 18 wrong / 14 refused / 0 errored** of 334. Stage 4 must not move it — the
  importer feeds the builder, not the validator. Stage 3 may; if it does, name the cases.
- **Corpus**: `npx tsx .claude/plans/corpus-roundtrip.mjs /tmp/ids-corpus`. Reproduced stays
  **7,784 / 7,784**, drifted **0**, schema-invalid out **3**, and **files losing a requirement
  facet stays 0** — that last line is the check that a facet read into the model but never compiled
  cannot produce a false pass. Pass-through is at **191** and may fall, never rise.
- **Read the refusal reasons broken down by construct**, not the total. `readFacet` reports the
  first reason and stops, so removing one exposes the next — stage 2's C4 predicted 183 and landed
  191 for exactly this reason. Treat every prediction as a lower bound.
- `isEvaluable()` must narrow, never widen.
- **Applicability-side** classification, material and partOf stay deferred (stage 5). Requirements
  only. Do not quietly add them.
- Validation runs against `idsScope`, not `elements`.
- `node scripts/verify.mjs --visual` is the gate — 720 tests in 48 files at the merge. A scrolled
  page screenshots blank; that is a known harness trap, not a failure.

## Do not spend the session on

- **Pattern-valued names.** `name` and `propertySet` on an attribute or a property are still plain
  strings rather than `ValueDraft`. That is 15 property + 4 attribute corpus facets and all 14
  conformance refusals, and it was deliberately left out of stage 2.
- The 3D viewer branch, which stays parked and unmerged.

## Cheap and worth doing if there is room

The **13 permanent pass-throughs** — `<name>` (8) and `measure` (5) on a property — are not in IDS
1.0 at all. Their refusal message currently implies a capability is coming. It should say they are
kept verbatim on purpose, because that is the final answer for them.

## Data handling

The real 37 MB model is at `fixtures/ifc/E_AIH_68_INS_NDZ_Sanitair.ifc` and its IDS at
`fixtures/ifc/3.6_contain_NlSfb.ids`. Both are untracked, and **never `git add -A` from the repo
root** — `.claude/worktrees/` holds an embedded git repo that a broad add will swallow. Parse on
that model is 2,593–2,788 ms. Do not extrapolate performance from the 2 KB conformance fixtures,
and do not extrapolate to the 1.6 GB federated model without asking.
