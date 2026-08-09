# Session: IFC values are compared as strings

**Goal:** compare an IFC value as the type it is, not as its text. This is the second-largest source
of **false passes** in the conformance baseline — roughly 26 cases where we approve a model that
must fail.

Do this after `2026-08-09-element-scope.md`. It is independent of the `FacetDraft` refactor
(stage 2) and of restrictions (stage 3) — a third axis the staged plan did not separate out.

Related: `2026-08-07-full-ids-scope.md` (the conformance baseline at the end of it).

---

## What the suite says

Every one of these is a conformance case we currently get wrong, and almost all in the approving
direction. The case names are the specification:

**attribute — 16 false passes**

- `fail-booleans_must_be_specified_as_lowercase_strings_1_3`, and `invalid-…_2_3`
- `fail-attributes_with_a_logical_unknown_always_fail` — IFC logical has three states; `UNKNOWN`
  is not `false` and is not a match
- `fail-attributes_with_an_empty_list_always_fail`, `…_an_empty_set_always_fail`
- `invalid-value_checks_always_fail_for_lists`, `…_for_objects`, `…_for_selects` — an aggregate or
  an entity reference is not comparable to a value, and the answer is *fail*, not *ignore*
- `invalid-derived_attributes_cannot_be_checked_and_always_fail`,
  `invalid-inverse_attributes_cannot_be_checked_and_always_fail`
- `fail-numeric_values_are_checked_using_type_casting_4_4`,
  `invalid-only_specifically_formatted_numbers_are_allowed_1_4` and `_2_4`
- `fail-dates_are_treated_as_strings_1_2`, `fail-durations_are_treated_as_strings_2_2`
- `fail-ids_does_not_handle_string_truncation_such_as_for_identifiers`

**property — the type-shaped share of 23 wrong**

- `fail-measures_are_used_to_specify_an_ifc_data_type_1_2` — `dataType` is a real constraint we
  currently write out and then ignore when evaluating
- `invalid-integer_values_cannot_be_stored_with_decimal_2_4` and `_3_4`
- `fail-properties_can_be_overriden_by_an_occurrence_2_2`

Note how many are `invalid-` cases: the suite's third prefix, meaning *the specification asks
something nonsensical and must therefore fail*. We answer "pass" because a comparison that cannot
be made returns no violation. **"Cannot compare" must resolve to fail, not to silence** — that is
the same false-pass shape as a rule that checks nothing, one level down.

## Where it lives

`PropertyValue` is `string | number | boolean | null` (`packages/shared-types/src/domain.ts`), so
the JS primitive does survive — this is not "everything is a string" in the crude sense. What is
lost is narrower and more specific:

- **The IFC type name.** `IfcLabel`, `IfcInteger`, `IfcReal`, `IfcDuration`, `IfcDate` all arrive as
  the same three primitives, so "is this integer stored with a decimal" and "is this a date or a
  string that looks like one" are unanswerable downstream.
- **`IfcLogical`'s third state.** `UNKNOWN` has nowhere to go in a `boolean | null` union, and
  `null` already means absent.
- **Aggregates and references.** `normalize-property-value.ts` JSON-stringifies arrays and falls
  through to `String(value)` for anything else — so a list, a select or an entity reference becomes
  a plausible-looking string that then compares equal to things, instead of failing as the suite
  requires.

The comparison itself is in `packages/ids-validator/src/facet-evaluation.ts`. Widening
`PropertyValueSchema` is the breaking part, and it ripples through both adapters, the Validate
page and the explorer rail.

`BUILDER_PROPERTY_DATA_TYPE` is `IFCLABEL` for everything the builder authors, and `dataType` is
already carried verbatim through import and export. What is missing is that nothing *evaluates*
against it.

## Ordering note

Do this before bounds and tolerance, not after. Numeric bounds compared against a string-typed
value is a fix built on the thing that is broken — and bounds fail in the approving direction too.

## Done when

- A boolean, logical, integer, real, date and duration each compare as their own type, and a value
  that cannot be compared fails rather than passing silently.
- `dataType` on a property facet is enforced, not just carried.
- `test:conformance` re-run and the baseline refreshed, with the attribute and property groups
  reported separately.
- The engine-parity picture is re-checked: `bug-web-ifc-property-subtypes` means web-ifc returns
  `null` for five of six property value kinds, so typed comparison will make the two engines
  disagree more visibly, not less. That note may want to land first.
