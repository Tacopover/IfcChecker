Work on the next step in IfcChecker: **settle the applicability entity question, then start the
full-spec authoring UI.** Two parts, in that order — the first decides a constraint the second has
to build against, so doing them the other way round means drawing the controls twice.

Read `.claude/plans/2026-08-07-full-ids-scope.md` first. The "landed and measured" sections at the
end are the current state and where every number comes from; the last one covers requirement-side
`entity`, which just merged. Then read the Next-Steps README in the Obsidian hub for the ordering,
and these Decisions-Log entries: **2026-08-11 "Applicability entity matching may be wrong"**,
**2026-08-11 "Requirement-side `entity`"**, **2026-08-10 "Full-spec authoring UI"**, and
**2026-08-10 "Requirement-side `entity` is next, and the UI is now the blocking question"**.

**All IDS engine work is merged.** `master` is at `23a32cd` and pushed — no branch stack this time.
Branch off `master`. Ask before merging anything back to it.

Conformance is **302 agreed of 334 — 18 wrong, 14 refused, 0 errored, and 0 false passes.** The 14
refusals are all one block (a property or attribute *name* given as a pattern). Do not spend the
session on them; they are cheap filler, not the point.

Set up the measurement before writing code, because part 2 can regress the engine without touching
it:

    node scripts/fetch-conformance-cases.mjs
    corepack pnpm --filter @ifc-qa/ids-validator test:conformance

Baseline is `packages/ids-validator/conformance-baseline.json`. Run the ratchet FIRST (it asserts
nothing regresses), then re-run with `UPDATE_CONFORMANCE_BASELINE=1` and diff the two files to see
how many cases moved AND in which direction.

---

## Part 1 — the applicability entity decision

`matchesApplicability` in `packages/ids-validator/src/facet-evaluation.ts` uses `isSubtypeOf`, so an
applicability naming `IFCWALL` also selects an `IfcWallStandardCase`. **The IDS specification
appears to forbid that**, and the previous session verified it rather than assuming:

- `Documentation/UserManual/entity-facet.md` says the `Name` parameter is "a valid IFC class from
  the IFC schema. **The IFC Class must match exactly**", and separately that "**there is no
  automatic inheritance in IDS entity facet interpretation** … all the entities need to be listed
  explicitly". The document then supplies copy-paste lists of every `IfcElement` subtype per schema
  version, precisely because there is no inheritance. Neither statement is scoped to requirements.
- **Switching to exact matching moves 0 of the 334 conformance cases.** Measured, not guessed —
  every applicability name in the suite is present literally in its own model, so the suite cannot
  discriminate. That is why this survived nine stages of scoring.
- **The user's own file turns on it.** `fixtures/ifc/3.6_contain_NlSfb.ids` (untracked) names
  `IFCELEMENT`. Today it selects **757 elements** of the 37 MB model and checks them. Under exact
  matching it selects **0** — `IfcElement` is abstract and appears in no model — and the
  specification fails on applicability cardinality instead. `entity-facet.md` calls that authoring
  shape out by name: "the IfcElement should not be listed, as it is an abstract entity".

`scripts/fetch-conformance-cases.mjs` fetches only `TestCases`. To read the User Manual yourself:

    git clone --depth 1 --filter=blob:none --sparse https://github.com/buildingSMART/IDS.git <tmp>
    cd <tmp> && git sparse-checkout set Documentation

**What to do:** do not just flip it. Harm runs both ways — subtype matching can let a `required`
specification pass on a subtype when nothing it actually named exists, which is a false pass on a
board that is at 0; exact matching reports a widely-used authoring shorthand as checking nothing.
Come back to the user with a recommendation and the evidence for it, including what other
implementers do if you can establish that (IfcOpenShell's `ids.py` is the reference implementation
and is worth reading on this specific point). If the answer is exact matching, the change is small
in the validator and large in the builder — see part 2 — so land the validator half only once the
builder can expand a supertype into its subtypes, or the user's own file breaks the day it ships.

Requirement-side and partOf entity names **are** exact and that is settled. Only the applicability
side is open.

---

## Part 2 — the full-spec authoring UI

**The engine is far ahead of the interface.** Requirements can state six facets — attribute,
property, classification, material, partOf, entity — and the builder can author two of them. The
three facets that landed 2026-08-10 and the one that landed 2026-08-11 are all checkable and all
unauthorable.

The design direction is **already decided** by the user and is not yours to re-open (Decisions-Log
2026-08-10, "Full-spec authoring UI"): *"we basically have 3 stages for every check: specification,
applicability and requirements … a UI that winds everything down to those 3 items, while giving the
user the ability to expose more complex options underneath those 3."* Three visible levels with
progressive disclosure under each — **not** a separate advanced mode, and **not** a flat form
carrying every facet.

The plan's §"UI: keeping it accessible" has the three mechanisms that make it tractable, and they
matter more than which page anything sits on: one collapsed line per facet that reads as a sentence,
one restriction editor behind every value parameter, and explorer-rail sections for the new facets
so "everything offered comes from your own file" stays true.

**The real work is the `ConditionDraft` → `FacetDraft` refactor** (plan stage 2), not the controls.
Today's model conflates cardinality and restriction into one `operator` field of 8 values in
`packages/ids-validator/src/rule-draft.ts`; IDS treats them as orthogonal, which is why the importer
still passes some facets through. The plan gives the target shape. Keep the friendly operators as a
shortcut layer over it, not as the storage — `contains` stays the fastest way to write `.*X.*`, the
way the importer already derives it.

Builder surface: `apps/web/src/builder/` — `RuleBuilderPage.tsx`, `RuleCard.tsx`,
`ConditionRow.tsx`, `ValuePicker.tsx`, `ModelTree.tsx`, plus `draftIds.ts`, `evaluateDraft.ts`,
`importIds.ts`, `completeness.ts`, `introspect.ts`. `ConditionRow` is already close to the collapsed
facet row; the work is generalising it to six kinds.

Two things are newly load-bearing and easy to miss:

- **`BUILDER_PROPERTY_DATA_TYPE` is `"IFCLABEL"`** (`rule-draft.ts:84`), and every property the
  builder writes is declared with it. The checker now *enforces* the declared type, so authoring the
  wrong one produces a rule that fails everything. A `dataType` picker is not a nice-to-have.
- **`UnsupportedConstruct` already carries precise "this rule cannot be fully checked" reasons that
  never reach the screen.** Surfacing them is cheap and is probably the single highest-value thing
  the user sees, since `isEvaluable` refusals are currently silent.

---

## Watch for

- **The corpus round-trip must stay 7,784/7,784** throughout the refactor. It is the safety net, and
  the number of specifications needing pass-through should *fall* as facets become representable,
  never rise.
- **The conformance ratchet must not move at all in part 2.** If a UI refactor changes a conformance
  number, something leaked from the draft model into the validator.
- **`isEvaluable()` must narrow, never widen.** A partly-understood facet must still refuse.
- Applicability-side classification, material and partOf are still deliberately unimplemented
  (stage 5). Do not quietly add them.
- Validation runs against `idsScope`, not `elements`.
- **Standing preference is one consolidated page**, with a route earned only by a genuinely heavy
  workflow. Do not split the builder speculatively. The plan names a measurable trigger for
  revisiting: if a real imported national standard cannot be scanned without the rule list scrolling
  past two screens, say so with the file on screen.
- Do not extrapolate performance from the 2 KB conformance fixtures, and do not extrapolate to the
  1.6 GB federated model without asking. The real 37 MB model is at
  `fixtures/ifc/E_AIH_68_INS_NDZ_Sanitair.ifc` (untracked — never commit it, and never `git add -A`
  from the repo root). Parse there is currently 2,593–2,788 ms.
- Land one mechanism per commit and report which way each case moved, never just the total.

`node scripts/verify.mjs` is the gate. **This work touches the UI, so run `--visual`** — the two
browser stages are opt-in behind that flag. Note the known harness trap: a scrolled page screenshots
blank.
