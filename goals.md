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

### 3a. Scope: inventory the gap

Produce a written comparison of IDS 1.0 against what `parseIdsXml` + `RuleDraft` represent
today: every facet, restriction, cardinality and metadata field, marked
supported / droppable / blocking. Ground it in real files — pull several published IDS files
(buildingSMART samples, a national standard) and measure which constructs actually occur in
practice, rather than reasoning from the spec alone. Cheap, and it decides how much of the
rest matters.

### 3b. Scope: decide the fidelity contract

Pick one, and write down why:
- **Refuse** anything we cannot fully represent. Safest, probably too strict to be useful.
- **Import lossily, with an explicit report** of what will be lost, and require the user to
  acknowledge it before editing.
- **Import with pass-through**: keep unrepresented constructs as opaque XML attached to the
  rule, hidden from the UI but re-emitted verbatim on export. Highest fidelity; the most work;
  needs care that an edited rule and its passed-through fragment cannot contradict each other.

This is a product decision, not a technical one — it needs the user, not just an implementer.

### 3c. Scope: decide the round-trip guarantee

State precisely what `import → export` promises: byte-identical, semantically equivalent, or
best-effort-with-a-diff. Whatever is chosen becomes a test, the way
`parseIdsXml(buildIdsXml(d)) === compileDraft(d)` already is.

### 3d. Scope: decide the UX

Where import lives; what the user sees for a partially-understood file; whether an imported
rule is visibly marked as such; what happens when an imported rule references a property set
absent from the loaded model (likely common, and the coverage percentages will read 0%).

### 3e. Implement: parser reports instead of warning

`parseIdsXml` should return what it skipped rather than only logging it — a structured list of
unsupported constructs per specification. Everything above depends on this.

### 3f. Implement: `idsXmlToDrafts`

The reverse of `compileDraft`: `(xml) => { rules: RuleDraft[]; unsupported: UnsupportedConstruct[] }`.
Round-trip tested per the contract from 3c, against the real-world files gathered in 3a.

### 3g. Implement: import UI

Per 3d, including the loss report from 3b.

**Size:** large — treat 3a–3d as one scoping pass to review before any code is written.

---

## 4. Navigate from a check result to its elements in the viewer

**Why:** a results table is a list of GlobalIds. Clicking a row should take the user to the
elements that failed, isolated and framed, so a violation becomes something they can see.

**Done when:**
- Clicking a row in the Validate page's issue table isolates the failing elements in the viewer
  and zooms to fit, with a visible un-isolate / reset control.
- Results carry the `LoadedModel` key rather than the file name — two files named `Model.ifc`
  must not navigate into the wrong model.
- Failing elements only; the validator needs no change, since that is exactly what it returns.
- Decided: whether a row navigates to its one element or the table groups by rule so that
  clicking a rule shows every element failing it.
- Handled honestly: a failing element with no geometry, and a clicked result whose model has
  not had its geometry loaded yet. The viewer already reports both
  (`MeshMapping.geometrylessExpressIds`, and per-model load-on-demand), so this is about the
  interaction rather than the data.

**Size:** medium. The prerequisites are done: elements carry `expressId`, and the viewer's
`isolateElements` + `frameBounds` are already the two operations this needs.

---

## Smaller known gaps

Not scheduled; each is self-contained.

- **`dataType="IFCLABEL"` is hardcoded** on every exported property facet
  (`packages/ids-validator/src/build-ids.ts`). Numeric properties are mistyped in exported
  IDS. Matters as soon as numeric bounds are supported.
- **Numeric bounds and length restrictions** are unsupported in both directions — the natural
  next facet capability after import, and the reason the item above will start to bite.
- **The browser gate covers the viewer scenario but not the builder one.** `verify.mjs` runs
  `visual-check.mjs` twice: once with no scenario, once with `--scenario viewer`. The
  `builder` scenario still only runs by hand, so the rule-builder loaded-model path is
  uncovered in the gate.
- **The viewer has never been run against a real model.** Every measurement behind it comes
  from a 2.4 KB fixture in a software renderer. Nothing is known about frame times, upload
  cost, or memory at 1.6 GB, and the flat non-instanced path was chosen for federation
  correctness rather than measured throughput.
- **The section box is uncapped**, so a clipped solid reads as a hollow shell rather than a cut
  face. Capping wants a stencil pass or generated cap geometry; the maths and the six planes
  are already in place, so it is a renderer change only.
- **Engine divergence on `IfcSpace`**: ifc-lite promotes it to a spatial tree node, web-ifc
  leaves it in the storey's `elementIdsByType`. Pinned in a named `adapter-parity` test rather
  than hidden. A product decision about which is right.
- **Theme toggle** from the approved mockup was never implemented; the app follows the OS
  preference only.
