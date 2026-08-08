# Session: web-ifc reads only one of the six IFC property value kinds

**Goal:** the two engines should agree, and both should read the property kinds IDS says it checks.

**Size:** medium. Adapter work, plus a decision about what a non-scalar property value *is* in our
element model.

The odd one out among the current notes: this is the **IFC** side, not the IDS side. It is here
because it makes IDS property checks wrong regardless of how good the IDS half gets.

---

## The finding

`packages/parser-adapters/src/web-ifc-buffer.ts:177`:

```ts
props[propName] = normalizePropertyValue(prop.NominalValue);
```

`NominalValue` exists only on `IfcPropertySingleValue`. The other five carry their value elsewhere:

| IFC type | Where the value lives | Read today |
| --- | --- | --- |
| `IfcPropertySingleValue` | `NominalValue` | ✅ |
| `IfcPropertyBoundedValue` | `UpperBoundValue`, `LowerBoundValue`, `SetPointValue` | ❌ null |
| `IfcPropertyListValue` | `ListValues` | ❌ null |
| `IfcPropertyTableValue` | `DefiningValues`, `DefinedValues` | ❌ null |
| `IfcPropertyEnumeratedValue` | `EnumerationValues` | ❌ null |
| `IfcPropertyReferenceValue` | `PropertyReference` | ❌ null |

So on web-ifc those properties read as absent. A rule requiring one **fails every element** — loud,
at least, rather than a false pass. But it is the wrong answer, and it differs from ifc-lite: the
engines were previously measured as disagreeing on 280 elements of a real model.

## Why it matters more than it looks

`Documentation/UserManual/property-facet.md` is explicit that IDS supports single, bounded, list,
table and enumerated values — and that the interpretation *differs per kind*:

> - If the IDS value is a single value, at least one of the IFC values should match.
> - If the IDS value is a restriction (with minExclusive, maxExclusive, minInclusive,
>   maxInclusive), all IFC values should respect the range.

with a further table for how a bounded value must sit entirely inside an IDS range. Complex
properties and reference values are the two IDS explicitly does **not** support, so
`IfcPropertyReferenceValue` above may be legitimately skippable — confirm from the manual.

This is a prerequisite for numeric bounds (stage 3 of `2026-08-07-full-ids-scope.md`): a bounds
check against a bounded property is exactly the case the manual spends a table on.

## The modelling decision

`NormalizedElement.propertySets` is `Record<string, Record<string, PropertyValue>>` where
`PropertyValue` is `string | number | boolean | null` — a single scalar. A list, an enumeration and
a bounded value are not scalars.

Options, in rough order of cost:

1. **Collapse to a scalar** (first value, or a joined string). Cheap, keeps the type, and quietly
   loses the distinction the IDS interpretation rules depend on. Would report a wrong verdict for
   the "all values must respect the range" case.
2. **Widen `PropertyValue` to allow an array**, keeping bounded values as a small tagged shape.
   Touches the schema in `shared-types`, both adapters, `facet-evaluation`, and the builder's
   value pickers and coverage counts.
3. **Keep the scalar for display, add the full value alongside** for evaluation. Least disruption
   to the UI, two representations to keep in step — which is its own failure mode.

Worth deciding with the property-facet interpretation table in hand, not before.

## Done when

- Both adapters read all the property value kinds IDS supports, and `adapter-parity.test.ts` pins
  the agreement rather than documenting a divergence.
- The `property/` conformance cases pass (74 of them — see
  `2026-08-07-conformance-testing.md`), including the bounded-value range table.
- A fixture covers each value kind; today's fixtures are single-value only.

## Gotchas

- **ifc-lite already handles all six**, joining list and enumerated values with `", "` — recorded
  in the hub Decisions-Log entry of 2026-08-02, which also measured the divergence: 280 elements
  differ on `Pset_PipeConnection`/`Pset_DuctConnection`.`ConnectionType`, `null` against
  `"Generic"`, from an `IFCPROPERTYLISTVALUE`. So this is web-ifc catching up, not a joint audit —
  but note ifc-lite's joined string is a *display* choice, and the IDS interpretation rules
  ("at least one of the IFC values should match") may not be satisfiable from it.
- **Scale.** Real federated models run to 1.6 GB and parse in ~120 s; these are new reads per
  property. Measure, and see `feedback-verify-scale-against-real-models` — do not extrapolate from
  sandbox hardware or synthetic fixtures.
- `web-ifc` also cannot name a type outside its own schema (reports
  `<web-ifc-type-unknown> (type code N)`), which is goal 2 in `goals.md` — related, not the same.
