# Goals

Planned work, roughly in priority order. Each goal states what "done" means, so it can be
picked up cold. Verify everything with `node scripts/verify.mjs --visual` (see `CLAUDE.md`).

Completed work is not tracked here — it lives in git history and in the project's
Decisions-Log in the documentation hub.

---

## 1. Merge IFC4X3 entities into the generated type table

**Why:** `scripts/generate-ifc-entity-table.mjs` currently emits IFC4 plus a handful of
IFC2X3-only names. `@ifc-lite/data` also ships `IFC4X3` and `IFC4X3_ADD2` tables. Until they
are merged, infrastructure classes — `IfcBuiltElement` (the IFC4.3 rename of
`IfcBuildingElement`), `IfcCourse`, `IfcSign`, `IfcKerb`, `IfcPavement` and the rest — are
reported as unrecognised rather than parsed, so an IFC4.3 export is largely invisible in the
same way MEP models were before the allowlist was removed.

**Done when:**
- The generator merges IFC4X3 alongside IFC4 and IFC2X3, with each name's origin schema
  recorded so `IfcBuiltElement` vs `IfcBuildingElement` can be told apart.
- A test asserts a representative set of IFC4.3 infrastructure classes classify as physical
  elements.
- An IFC4.3 fixture parses with no unrecognised types.
- Decided and documented: whether `IfcBuiltElement` and `IfcBuildingElement` should present
  as one group in the model tree or two. They are the same concept under different schema
  versions, and showing both would fragment a mixed-vintage federated model.

**Size:** small — mostly a generator change, plus the naming decision above.

---

## 2. Surface unrecognised entity types in the app

**Why:** parsing now reports types it does not recognise on `IfcParseResult.unrecognizedTypes`
and logs one `console.warn`, but `parseFile` does not forward it and no UI shows it. A
user whose model contains an unknown class sees a smaller number with no explanation — the
exact silent failure the allowlist removal was meant to end, surviving one layer up.

**Done when:**
- `parseFile` forwards `unrecognizedTypes`, and the rule builder shows them near the
  model summary — visible, not buried, and not styled as an error, since an unrecognised
  class is usually a schema-version gap rather than a broken file.
- The Validate page reports the same, since it under-counts identically.
- The message tells the user what it means for them: these elements were not checked.
- Note `web-ifc` cannot name a type outside its own schema and reports
  `<web-ifc-type-unknown> (type code N)`; `ifc-lite` names it. Either present the engine
  difference honestly or recommend ifc-lite for diagnosing an unrecognised-type report.

**Size:** small.

---

## 3. Import an existing IDS file into the builder

**Why:** the builder authors rules from scratch. Users already hold IDS files — from a client,
a national standard (e.g. a BIM basis ILS), or an earlier tool — and cannot open them here to
inspect, adjust or re-run them against a model. This is the most-requested direction for a v2
and was explicitly deferred from the MVP.

**The central risk, which the scoping sub-goals exist to resolve:** our `RuleDraft` model is
deliberately narrower than IDS 1.0. We support Entity applicability, and Attribute/Property
requirements with exact/enumeration/pattern restrictions and required/prohibited cardinality.
IDS also has Classification, Material and PartOf facets, numeric bounds, length restrictions,
optional cardinality, `ifcVersion` targeting, and file- and spec-level metadata.
`parseIdsXml` currently `console.warn`s and drops what it does not understand.

So a naive import means: user opens a rich IDS file, we silently drop half of it, they edit
one rule, export — and hand back a file that quietly lost their colleague's Classification
requirements. That is exactly the failure the MVP was built to prevent (see the Decisions-Log
entry on exports that contradict the preview). **No import ships until the fidelity contract
is settled.**

### 3a. Scope: inventory the gap — DONE 2026-07-25

Written up in `.claude/plans/2026-07-25-ids-import-scope.md`, measured against a corpus of real
`.ids` files (buildingSMART, bSI Japan/MLIT, Molio, BimBem, OpenAEC, ifc-audit) rather than
against the spec text. Read that before touching 3f or 3g.

### 3b. Scope: decide the fidelity contract — DECIDED 2026-08-05

**A split contract**, because the losses are not evenly distributed and one flat "some things
were lost" warning would hide that:

1. **Represent** what the builder covers — entity applicability, attribute/property
   requirements, exact/enum/pattern restrictions, required/prohibited cardinality.
2. **Refuse to import a specification whose _applicability_ we cannot fully represent.** That
   is the case where a partial import is silently wrong rather than merely incomplete: we
   cannot display which elements the rule selects, so we cannot let anyone edit it. Listed in
   the loss report as "not imported", kept out of the rule list.
3. **Pass through unrepresented _requirement_ facets** as opaque XML attached to the rule,
   hidden from the UI and re-emitted verbatim. The rule still means what it meant.
4. **Report** everything in 2 and 3 before the user can edit.

Measured 2026-08-05 against the 464 hand-authored specifications in the 3a corpus (the whole
corpus excluding bSI Japan, which is machine-generated and 100% unrepresentable): **421 are
importable and 43 (9%) are refused**. Of the 421, **195 carry at least one requirement
construct that needs pass-through** — an unsupported facet, an optional cardinality, or a
numeric bound — leaving 226 that round-trip with nothing attached.

The alternatives were measured too: refusing whole files rejects the large majority of them
(see 3a), and lossy-with-a-warning leaves 37% of specifications drifting toward *approval*
after one acknowledgement click — the one direction a compliance tool must never fail in.

Promoting the four pass-through facets (`classification` 47, `partOf` 39, `material` 34,
`entity` 25) to real editable conditions comes later, driven by what is actually hit.

### 3c. Scope: decide the round-trip guarantee — DECIDED 2026-08-05

**Semantic equivalence for imported-and-untouched rules; best-effort with a diff for edited
ones.** Testable as: for every specification not marked unimported,
`idsXmlToDrafts(x) → buildIdsXml → parseIdsXml` equals `parseIdsXml(x)`. That test can run over
the whole 3a corpus.

This required two fixes that block round-trip on almost every real file, both **done in 3f**:
`dataType` was hardcoded to `IFCLABEL` (`rule-draft.ts`) though that covers only 61 of the 310
hand-authored property facets — `IFCREAL` 53, `IFCTEXT` 39, `IFCLENGTHMEASURE` 38, `IFCBOOLEAN`
35, and 27 omit the attribute entirely; and `ifcVersion` was hardcoded to `IFC4` though 344 of
the 464 hand-authored specifications say `"IFC2X3 IFC4"` and only 49 say plain `IFC4`. (Both
figures correct earlier ones measured over the whole corpus, where machine-generated bSI Japan
files dominate.)

### 3d. Scope: decide the UX — DECIDED 2026-08-06

- **Import lives on the Build rules page**, in the load bar beside the file picker.
- **Importing replaces the current rule set**, after a confirm when anything would be lost. The
  builder is a view onto one document, which is what makes "open, edit, re-export" coherent and
  what lets the preserved parts belong to a single file.
- **Refused specifications appear as read-only cards in the rule list, in document order** —
  dashed and greyed, naming the construct that made them unshowable, with a delete button for a
  user who does want them gone. A user comparing the page to their file has to be able to see
  that nothing went missing, and where.
- **The loss report is permanent and per rule**, mirroring 3e on the validate page: a "N kept"
  badge in the rule header, visible while collapsed, and the detail inside. Not a dismissible
  panel — the moment it matters is export, which can come long after the import.
- **A rule whose entity types or property sets are absent from the loaded model needs nothing
  new**: the existing card already reads "No matching elements in this file" and shows 0 counts,
  which is the honest answer.
- **A rule's pass/fail summary is qualified** ("All 12 pass on the conditions shown") whenever
  requirements were kept but not shown, so it never reads as a verdict on the whole
  specification.

### 3e. Implement: parser reports instead of warning — DONE 2026-08-05

`parseIdsXml` returns `unsupported: UnsupportedConstruct[]` and `applicabilityComplete` per
specification instead of `console.warn`ing, and `isEvaluable` decides whether a specification
can be judged at all.

This was also a live bug on the validate page, not just import scaffolding: a specification
whose applicability we only partly understood parsed to an empty entity list, and
`matchesApplicability` over an empty list matches *nothing* — so it contributed zero violations
and the model was reported clean. 41,318 of 41,751 corpus specifications (99%) parsed to an
empty applicability this way, including 31 of the 464 hand-authored ones — among them the
classification rule of the demo BIM basis ILS file, whose entity names are an `xs:enumeration`.
`validateBySpecification` now refuses any specification it cannot fully read (43 of the 464,
two of the ILS file's three) instead of running it, and the results table shows those as
"not checked" with no counts rather than as zeros.

### 3f. Implement: `idsXmlToDrafts` — DONE 2026-08-06

`(xml) => { rules, refused, title, extraInfo }` in `packages/ids-validator/src/import-ids.ts`.

The governing rule is **carry verbatim whatever we cannot represent**, at every level: a
requirement facet outside the builder's model, a whole refused specification, `<info>` children,
and the raw attribute maps of `<specification>`, `<applicability>` and `<requirements>`. Naming
those attributes individually was the first attempt and it lost five different things — real
files put `minOccurs` on `<specification>` and `description` on `<requirements>`, neither of
which the schema advertises loudly.

A facet is either fully representable or kept whole; there is no partial import. So
`cardinality="optional"`, a prohibited facet that names a value, an `xs:` bound, an author's
`xs:annotation`, and an unmodelled attribute all pass through rather than importing weakened.
Pattern restrictions become `contains`/`startsWith`/`endsWith` only when `escapeRegExp` would
reproduce the source character for character, otherwise `matches`, which stores it verbatim.

Measured over the 3a corpus, re-exporting a file that was only opened:
- **464 of 464** hand-authored specifications satisfy the 3c semantic contract (421 imported as
  rules, 43 refused and passed through — exactly the split 3b predicted).
- **7,784 of 7,784** files reproduce their `<specifications>` subtree element for element,
  attribute for attribute, under a check far stricter than 3c asks for.
- 212 of the 421 imported rules carry at least one passed-through requirement facet.

Committed coverage is `import-ids.test.ts`, `import-ids.roundtrip.test.ts` and the
`mixed-fidelity.ids` fixture; the corpus runs stay ad-hoc, since the corpus is not in the repo.

### 3g. Implement: import UI — DONE 2026-08-06

Per 3d. `importIds.ts` turns a picked file into rules or one sentence saying why not;
`RefusedSpecificationCard.tsx` holds what cannot be edited; `RuleCard` gained the badge and the
permanent note; `IdsXmlPreview` writes the refused specifications and `<info>` children back.
Covered by component tests and by an extension to the `builder` browser scenario, which imports
a partly-understood document and asserts the export still carries what the builder could not read.

**Remaining, deliberately not built:**
- **Import needs a parsed IFC model.** The whole builder does — every card reads counts and
  field lists from one — so a user cannot open a client's IDS just to look at it. Decoupling
  `RuleCard` from a model is its own piece of work.
- **`exportBlockers` cannot see a passed-through facet's own problems.** It validates the
  conditions the builder shows; a preserved facet is trusted because it came in that way.
- Editing an imported rule still degrades its round-trip guarantee to best-effort per 3c, and
  nothing on screen says which rules have been touched since import.

**Size:** large — treat 3a–3d as one scoping pass to review before any code is written.

---

## 4. A 3D viewer page

**Why:** the tool can tell a user *that* an element fails a rule, but never *where* it is. A
third page shows the loaded models in 3D: a model tree browsing all loaded files, a property
browser for the selected element, section planes to clip the view, and hide/unhide/isolate at
file and element level. Parsing stays as fast as it is now — geometry is opt-in in both
engines and is only produced when this page asks for it.

**Governing constraint:** models are federated across disciplines at up to 1.6 GB each, sharing
an origin. The Validate page already parses one in ~120 s with ifc-lite.

**Done when:**
- Geometry is produced by `@ifc-lite/wasm` (already installed, a direct dependency of
  `@ifc-lite/parser`). web-ifc's geometry path is not viable at this scale.
- Elements carry an `expressId`, so an element record can be joined to a mesh. Both adapters
  already have it and drop it.
- The spatial structure carries element **ids**, not just per-type counts, so the tree can be
  expanded down to individual elements.
- Geometry loads per model on demand and can be unloaded — the always-mounted pattern in
  `App.tsx` cannot extend to resident mesh buffers plus a live WebGL context.
- Viewer state (selection, visibility, isolation, section planes) lives in plain modules under
  vitest; `scripts/verify.mjs` gains SwiftShader flags and one `readPixels` smoke assertion.
  Note the viewer must expose a deterministic render-one-frame hook — `requestAnimationFrame`
  is starved under the harness's `--virtual-time-budget`.
- Decided: whether the geometry pre-pass fuses with parsing (ifc-lite supports handing
  `parseColumnar` a pre-built entity index) or runs as a separate second scan.
- Decided: section plane vs box clip, capped vs open; picking by GPU colour-pick vs raycast;
  default visibility for `IfcSpace` and `IfcOpeningElement`.

**Size:** large.

---

## 5. Navigate from a check result to its elements in the viewer

**Why:** a results table is a list of GlobalIds. Clicking a row should take the user to the
elements that failed, isolated and framed, so a violation becomes something they can see.

**Done when:**
- Clicking a row in the Validate page's issue table isolates the failing elements in the viewer
  and zooms to fit, with a visible un-isolate / reset control.
- ~~Results carry the `LoadedModel` key rather than the file name~~ — done: `CheckRow.modelKey`.
- Failing elements only; the validator needs no change, since that is exactly what it returns.
- ~~Decided: whether a row navigates to its one element or the table groups by rule~~ — done:
  results group by specification, and a row selects its one element.
- Handled honestly: a failing element with no geometry, and a clicked result whose model has
  not had its geometry loaded yet.

**Size:** medium, and only after goal 4 — it shares goal 4's `expressId` prerequisite.

---

## Smaller known gaps

Not scheduled; each is self-contained.

- **`dataType="IFCLABEL"` is still the default** for a property condition authored in the
  builder (`packages/ids-validator/src/build-ids.ts`); an imported one now carries its own.
  Numeric properties the user types here are mistyped in exported IDS. Matters as soon as
  numeric bounds are supported.
- **Numeric bounds and length restrictions** are unsupported in both directions — the natural
  next facet capability after import, and the reason the item above will start to bite.
- **`scripts/verify.mjs` runs the browser check without a scenario**, so the loaded-model path
  is only covered when run by hand via `--scenario builder`. Adding it to the gate roughly
  triples the browser stage; worth doing if a regression ever slips through the empty-state
  check.
- **Engine divergence on `IfcSpace`**: ifc-lite promotes it to a spatial tree node, web-ifc
  leaves it in the storey's `elementCounts`. Pinned in a named `adapter-parity` test rather
  than hidden. A product decision about which is right.
- **Theme toggle** from the approved mockup was never implemented; the app follows the OS
  preference only.
