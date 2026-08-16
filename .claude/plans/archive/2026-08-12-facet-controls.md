# A control for the read-only facet kinds

Stage 5's remaining half. Written 2026-08-12 against `master` at `9da2437`, before any code.
Continues `.claude/plans/2026-08-07-full-ids-scope.md`, which stays the live scope document.

## What is read-only, and why there are nine of them

| where | kinds | rendered by |
| --- | --- | --- |
| requirements | classification, material, partOf, entity | `UnshownFacetRow` |
| applicability | property, attribute, classification, material, partOf | `ApplicabilityFacetRow` |

Corpus frequency among the 464 hand-authored specifications, requirement side: classification 51,
material 41, partOf 40, entity 26. Applicability side: property 13, attribute 7, classification 3,
material 3, partOf 0.

The importer reads all nine. The validator evaluates all nine. Neither can be written or edited.

## The decision: the shared piece is a value editor, and the row frame is shared too

Both, and for different reasons.

### 1. `FacetValueEditor` — one `idsValue`, everywhere

Every facet parameter `ids.xsd` types as an `idsValue` gets the same control: the operator select,
the text box with the model's observed values behind it, and the `ValuePicker` for an enumeration.
Counting them, this is not a two-use abstraction:

| facet | `idsValue` parameters |
| --- | --- |
| attribute | value |
| property | value |
| material | value |
| classification | **system, value** |
| partOf | **entity name, predefined type** |
| entity | **name, predefined type** |

Nine parameters over six kinds, and four of the kinds carry two. A row component per kind that
inlined the operator and text box would state the same four controls six times, and the shared
restriction editor is what the scope document argued for in the first place ("learn it once").

**One prop decides more than it looks like: whether the parameter may be absent.** `ids.xsd` makes
a classification's `<system>` and a partOf's `<entity><name>` mandatory, and the drafts type them as
a non-null `ValueDraft`; a `<value>` on a material or a classification is optional and `null` there
means "any". So the editor takes the sentence to show for the absent case, and offers it only where
`null` is legal. Getting this backwards would export a document no conforming checker reads.

### 2. `FacetRowFrame` — the head and the tail

Every row has the same head (a kind token) and the same tail (the hit score, duplicate, delete, the
author's `instructions` and `uri`, and the completeness error). Six siblings each repeating that is
the duplication a per-kind component invites. The frame takes the middle as children.

### Why not one component switching on kind

It is less code today and it is the wrong shape by the second facet: classification needs two value
editors and a system select fed from the model, partOf needs a `relation` enumeration from the
schema, entity needs no cardinality at all. Those are not variations on a property row — they share
its frame and its value editor and nothing else. A single `switch` would grow past 900 lines and
every kind's rules would sit in the same function.

### Why not one row component per kind, standing alone

The head and tail are identical, and `ConditionRow` already proves they are non-trivial: the score
class, the duplicate and delete affordances, the note, the `aria-describedby` wiring for the error.

## Cardinality is already solved, and each kind's alphabet differs

The row states cardinality in its own select as of `9da2437`. What each kind may say is **not** the
same, and `ids.xsd` is the authority:

| kind | cardinality |
| --- | --- |
| attribute, property, classification, material (requirements) | `conditionalCardinality` — required / optional / prohibited |
| partOf (requirements) | `simpleCardinality` — required / prohibited, **no optional** |
| entity (requirements) | **none at all** |
| every facet in an applicability | **none at all** |

So the frame takes the alphabet rather than assuming three. A `partOf cardinality="optional"` is a
document the schema does not describe, and the importer already refuses one.

## The explorer rail has to grow, or the promise breaks

The builder's whole promise is that everything offered comes from the user's own file. A
classification row offering a free-text system box breaks it exactly where users are least
confident — nobody remembers their classification system's spelling.

`ModelIntrospection` carries entity types, groups and fields. It carries **no** classifications, no
materials and no partOf wholes, although `NormalizedElement` has held all three since the missing
facets landed. That is introspection work, not adapter work, and it comes before the rows that need
it.

## Staging

Each commit its own, and the guard rails checked at every one even though none of them should move:
this is authoring-side work, and a conformance or corpus number moving means something leaked out of
the draft model into the engine.

1. **Extract `FacetValueEditor`** from `ConditionRow`. Pure refactor; the row's own tests must pass
   untouched.
2. **`ModelIntrospection` gains classifications, materials and partOf wholes.** No UI. Measured on
   the real 37 MB model, whose systems are `Uniformat` (736) and `Default Classification` (123).
3. **An editable classification row** — 51 corpus uses, the most frequent of the four.
4. **An editable material row** — 41.
5. **An editable partOf row** — 40, and the one whose cardinality alphabet is short.
6. **An editable requirement-entity row** — 26, and the one with no cardinality at all.
7. **The applicability side**, which is the same rows with the cardinality control withheld.

Stopping between any two leaves the tool strictly better than it was, because a kind that has no row
yet keeps the read-only one it has today.

## The second decision: one row per kind, with a `side` parameter

Written before step 7, and it is the question the brief asked outright — an applicability facet row
and a requirement facet row of the same kind differ only in which attributes they may state, so is
that one component with a side parameter or two components?

**One component per kind, taking a `side`,** the way `facetXml` and `readFacetShell` already do.

The two sides differ in exactly four things, and `ids.xsd` supplies all four:

| | requirements | applicability |
| --- | --- | --- |
| `cardinality` | a select, alphabet per kind | **not writable at all** |
| `instructions`, `uri` | shown when the author wrote them | **not writable at all** |
| a per-facet score | how many of the applicable elements pass | none — it narrows the count instead |
| the sentence's lead | "must be classified in…" | "selects only those classified in…" |

Everything else is the same control: the property-set select, the field select, the stored-as
picker, both value editors, the model's observed values behind each, the completeness error, and
the degradation to a read-only phrase when a name is a restriction rather than a plain name.

**What two components would cost.** `ConditionRow` is 400 lines and serves two of the five
applicability kinds. A second copy of it would be a second place for the pattern-valued-name
phrases, the retargeting rules and the stored-as picker to diverge, in exchange for removing one
conditional per row. The three small rows would each double for the same reason. The `side`
parameter is one prop threaded to one conditional in each of five files.

**What the `side` parameter costs.** The frame has to withhold the score and the note, which means
`hits` and `matched` become optional and one component decides what a row without them looks like.
That is the price, and it is paid once.

`ApplicabilityFacetRow` and `UnshownFacetRow` both disappear at the end of this: every kind on both
sides has controls, so a read-only fallback matches nothing.
