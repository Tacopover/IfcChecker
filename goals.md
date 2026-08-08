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

## 3. Support the rest of the IDS specification

**Why:** the builder covers entity applicability plus attribute/property requirements with
exact/enum/pattern restrictions. IDS 1.0 has six facets, four restriction kinds, three
cardinalities, and document metadata. Users hold national standards that use all of it, and can
now import them — but the parts we cannot represent are carried through untouched rather than
edited, which is a holding position, not the destination.

**Scope, measured against `Schema/ids.xsd` 1.0.0 and the 3a corpus:**
`.claude/plans/2026-08-07-full-ids-scope.md`. Read it before starting — it inverts the obvious
order of work twice, and its "what stage 0 turned up" section is the reason the ordering matters.

**Stage 0 is done** (2026-08-07): the multi-entity applicability export is valid, both readers
handle entity-name enumerations, `idsSchemaViolations` guards every export, and a specification
with no checkable requirement left is refused instead of passing. Stages 1–5 remain.

**Done when:** every construct in `ids.xsd` can be authored, imported and edited; the corpus
round-trip still reproduces 7,784/7,784 files; and the number of specifications needing
pass-through has fallen to the prose we choose not to surface.

**Size:** large — five stages, the first of which is parser work in both adapters, not UI.

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
  Numeric properties the user types here are mistyped in exported IDS. Folded into goal 3
  stage 3, which cannot ship bounds without a data type the user chose.
- **`idsSchemaViolations` is structural only** — element order and cardinality, required elements
  and attributes, enumerated attribute values. It does not check data types or the `xs:`
  restriction grammar, so it is a guard against our own output drifting, not a conformance claim.
- **`scripts/verify.mjs` runs the browser check without a scenario**, so the loaded-model path
  is only covered when run by hand via `--scenario builder`. Adding it to the gate roughly
  triples the browser stage; worth doing if a regression ever slips through the empty-state
  check.
- **Engine divergence on `IfcSpace`**: ifc-lite promotes it to a spatial tree node, web-ifc
  leaves it in the storey's `elementCounts`. Pinned in a named `adapter-parity` test rather
  than hidden. A product decision about which is right.
- **Theme toggle** from the approved mockup was never implemented; the app follows the OS
  preference only.
