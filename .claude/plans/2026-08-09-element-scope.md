# Session: our element scope is narrower than IDS's

**Goal:** stop dropping every IFC entity that is not a physical element, so a rule written against
one has something to check. Then, separately, make a specification that matches nothing fail
instead of reading green.

**Do this session first** of what remains. It is the cheapest fix on the board and it removes 27 of
our 34 false passes — the direction that reports a bad model clean.

Related: `2026-08-07-full-ids-scope.md` (the conformance baseline is at the end of it, and is where
these numbers come from).

---

## The finding

`packages/parser-adapters/src/element-filter.ts` decides what becomes a `NormalizedElement`:

```ts
const KEPT_ROOTS = ["IFCELEMENT", "IFCSPACE", "IFCSPATIALZONE"];
```

Everything else is `ignored` — geometry, relationships, units, ports, openings, the spatial
backbone. That was the right call for "which things does a QA reviewer check", and it is the wrong
call for IDS, which can name **any** IFC entity in an applicability.

Measured against the conformance suite: **28 of our 34 false passes report
`0 applicable, 0 passed, 0 failed`**, and reading their applicability splits them 27 / 1.

The 27 target, with case counts:

| entity | cases | why it is not an `IfcElement` |
| --- | --- | --- |
| `IfcSurfaceStyleRefraction` | 8 | presentation appearance |
| `IfcTask` | 3 | process, not product |
| `IfcPresentationLayerWithStyle` | 2 | presentation organisation |
| `IfcPerson` | 2 | actor resource |
| `IfcCartesianPoint` | 2 | geometry resource |
| `IfcMaterial` | 2 | material resource |
| `IfcProject` | 2 | context root |
| **`IfcWallType`** | 2 | **a type object, not an occurrence** |
| `IfcRelConnectsPathElements` | 1 | a relationship |
| `IfcClassification` | 1 | external reference resource |
| `IfcTaskTime` | 1 | process resource |
| `IfcSurfaceStyleRendering` | 1 | presentation appearance |

**`IfcWallType` is the one to notice.** Type objects are not exotic, two property cases turn on
them, and a user writing "every wall type carries a fire rating" is asking something completely
ordinary that we currently answer "clean" to.

The 28th is `ids/fail-required_specifications_need_at_least_one_applicable_entity_2_2`, which
targets `IfcWall` — in scope, simply not in that model. That one is cardinality, below.

## Two changes, and the order between them is the point

**1. Element scope (27 cases).** Widen what reaches the validator.

**2. Applicability cardinality (1 case directly).** IDS defaults a specification's applicability to
*required*: at least one element must match, so zero matches is a failure of the specification, not
an absence of work. We currently return `applicableCount: 0, failedCount: 0`, which the Validate
page renders as a clean pass.

**Land (1), re-measure, then land (2).** Together they cannot be told apart on the scoreboard —
cardinality alone would flip most of the 27 to "agreed" while the elements still never reach the
validator, and the score would show progress that is not there.

## The design question this session has to answer

Widening the filter is not a one-line change to `KEPT_ROOTS`, because three things currently depend
on the narrow scope and one of them is a hard constraint:

- **Scale.** Real federated models run to 1.6 GB. `IfcCartesianPoint` is the single most numerous
  entity in any IFC file by a wide margin — normalising all of them would be catastrophic, and the
  conformance suite's 2 KB files will tell you nothing about it. Check with the user before
  extrapolating from sandbox timings; see the standing note on verifying scale against real models.
- **The Validate page and the explorer rail** are built around "elements the reviewer checks".
  Flooding the element list with styles and cartesian points would wreck both.
- **`unrecognizedTypes`** exists so that nothing vanishes silently. Whatever the new scope is, that
  guarantee has to survive it.

So the likely shape — to be decided, not assumed — is **two scopes rather than one wider scope**:
the reviewer-facing element list stays as it is, and IDS evaluation resolves its applicability
against a broader set, fetched on demand for the entity types a loaded ruleset actually names. That
turns an unbounded traversal into one bounded by the rules in play, which is what makes
`IfcCartesianPoint` affordable — nobody writes a production rule against it, and if they do, they
have asked for it explicitly.

Both adapters need whatever is decided: `ifc-lite-buffer.ts` and `web-ifc-buffer.ts`, with
`adapter-parity.test.ts` extended to cover it.

## Done when

- A rule whose applicability names `IfcWallType`, `IfcProject` or `IfcMaterial` finds elements and
  reports a real verdict.
- A specification whose applicability matches nothing fails, and says so in words that distinguish
  it from "matched elements, all clean".
- `test:conformance` re-run and the baseline refreshed, with element scope and cardinality measured
  **separately** — the write-up should say how many cases each one moved.
- Parse time on a real model is unchanged, or the change is measured and accepted by the user.
- `2026-08-07-full-ids-scope.md` updated: this is a stage the plan did not have.

## Gotchas

- Fetch the suite first: `node scripts/fetch-conformance-cases.mjs`, then
  `corepack pnpm --filter @ifc-qa/ids-validator test:conformance`. Refresh the baseline with
  `UPDATE_CONFORMANCE_BASELINE=1`, and only after reading what moved.
- The baseline ratchet asserts no case we pass today may start failing. If widening the scope makes
  a currently-agreeing case disagree, that is a real regression and not baseline noise — a rule that
  used to match nothing may now match something and be judged on merits.
- **The type hierarchy only covers products, and this is the sharpest constraint.** All twelve
  entities above are already in `IFC_RECOGNISED_ENTITY_NAMES` — they are known and deliberately
  ignored, not unrecognised. But **none of them is in `IFC_PRODUCT_PARENTS`**, and that is the map
  `ifc-type-hierarchy.ts` flattens into its ancestor and descendant chains at module load. So
  `isSubtypeOf` has no answer for `IfcWallType`, and an IDS rule naming `IfcTypeObject` or
  `IfcObjectDefinition` cannot match a subtype today. Both tables come from
  `scripts/generate-ifc-entity-table.mjs` over `@ifc-lite/data`; widening `IFC_PRODUCT_PARENTS` to
  a full entity-parent map is probably part of this work, and it grows a committed artifact that is
  loaded eagerly in the browser — check the size cost.
- Do not fold this together with the missing facets (classification, material, partOf). Those are
  127 *refused* cases — an honest capability gap that produces no wrong answers. This is 27 wrong
  answers in the approving direction, which is a different and more urgent kind of problem.
