import { useMemo } from "react";
import type { ConditionDraft, ConditionalCardinality, ValueDraft } from "@ifc-qa/ids-validator";
import {
  carryAnnotation,
  friendlyReadingOf,
  plainName,
  plainNameOf,
  valueDraftForOperator,
} from "@ifc-qa/ids-validator";
import type { FieldsForResult } from "./introspect.js";
import { allIfcDataTypeNames } from "./allIfcDataTypes.js";
import type { ObservedValue } from "./ValuePicker.js";
import { FacetValueEditor, OPERATORS } from "./FacetValueEditor.js";
import { FacetRowFrame, errorIdOf, rowNoun, type FacetSide } from "./FacetRowFrame.js";
import { SuggestCombobox } from "./SuggestCombobox.js";
import { SearchPicker, type SearchPickerGroup, type SearchPickerOption } from "./SearchPicker.js";
import { conditionProblem } from "./completeness.js";

export { OPERATORS } from "./FacetValueEditor.js";

/**
 * The three cardinalities `ids.xsd` gives an attribute or a property, worded so the row still reads
 * as a sentence: "Pset_WallCommon · FireRating **must** be one of 60, 90".
 *
 * A separate control from the operator, because IDS treats them as orthogonal. Folding them into
 * one list is what used to make three combinations unreachable — an optional facet, a prohibited
 * value ("must not be Steel") and prohibited with no value all shared one `notExists` entry or none
 * at all, and the row showed the first two read-only.
 */
export const CARDINALITIES: Array<{ id: ConditionalCardinality; label: string }> = [
  { id: "required", label: "must" },
  { id: "optional", label: "if present, must" },
  { id: "prohibited", label: "must NOT" },
];

/** The value a `dataType` picker carries when the facet should declare none. */
export const NO_DATA_TYPE = "";

/** How that reads in the list, and in the box while it is what the facet states. */
export const ANY_DATA_TYPE = "any type";

/**
 * Enough to draw the schema's whole list at once — 108 names and the "any type" row above them.
 * The picker's default cap is for the ~900-name entity list; here it would cut the list off partway
 * through the alphabet, leaving a stated type past the cut with no row standing for it.
 */
export const DATA_TYPE_ROWS = 200;

function propertyFieldIn(source: FieldsForResult, propertySet: string | null, name: string | null) {
  if (name === null) return undefined;
  return source.propertySets.find((set) => set.name === propertySet)?.fields.find((field) => field.name === name);
}

/**
 * The plain names a condition points at, or `null` where it names a restriction instead.
 *
 * Everything the row looks up in the model — the field list, the observed values, the stored type —
 * needs one name to look up. A pattern names a set of them, so each of those has to say "not this
 * time" rather than search for a name nobody wrote.
 */
function plainNamesOf(condition: ConditionDraft): { propertySet: string | null; name: string | null } {
  return {
    propertySet: condition.kind === "property" ? plainNameOf(condition.propertySet) : null,
    name: plainNameOf(condition.name),
  };
}

/** How a name the row cannot edit reads as a phrase, mirroring the operator labels above. */
export function nameSummary(value: ValueDraft): string {
  switch (value.kind) {
    case "simple":
      return value.value;
    case "enum":
      return `one of ${value.values.join(", ")}`;
    // Several are a disjunction, so "or" is what the file means rather than a joined regex.
    case "pattern":
      return `matching ${value.sources.join(" or ")}`;
    case "affix": {
      const label = OPERATORS.find((operator) => operator.id === value.operator)?.label ?? "";
      return `${label.replace(/^must /, "")} ${value.literal}`;
    }
    case "bounds":
      return "in a numeric range";
    case "length":
      return "of a given length";
  }
}

/**
 * The types offered for a property, commonest in the model first.
 *
 * Where the file holds the property, its own storage is the only honest source: a declared type
 * the model does not hold fails every element. That is the usual case, since the field is
 * normally picked off the model in the first place.
 *
 * Where it does not — a name typed by hand, or one from a file that never carried it — there is
 * nothing to derive from, and offering nothing would leave a hand-authored rule unable to state a
 * type at all. The schema's own closed list stands in for the file there.
 *
 * A type an imported rule already states is kept selectable either way, so opening a file never
 * silently rewrites it.
 */
export function dataTypeOptionsFor(
  source: FieldsForResult,
  condition: ConditionDraft
): SearchPickerOption[] {
  if (condition.kind !== "property") return [];
  const { propertySet, name } = plainNamesOf(condition);
  const observed = propertyFieldIn(source, propertySet, name)?.dataTypes ?? [];
  const options: SearchPickerOption[] =
    observed.length > 0
      ? observed.map((entry) => ({ value: entry.value, label: entry.value, note: String(entry.count) }))
      : allIfcDataTypeNames().map((value) => ({ value, label: value }));
  const current = condition.dataType;
  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: current, note: "not in file" });
  }
  return options;
}

/** The stored-as list as the picker takes it, with "declare none" leading every reading of it. */
export function dataTypeGroupsFor(options: SearchPickerOption[]): SearchPickerGroup[] {
  return [{ label: "", options: [{ value: NO_DATA_TYPE, label: ANY_DATA_TYPE }, ...options] }];
}

/**
 * The type to declare for a property the user just pointed at: the one the model stores it as,
 * or none where the model is silent or disagrees with itself. A field stored as two types cannot
 * be checked against either without failing the other, so it declares nothing.
 */
export function dataTypeFromModel(
  source: FieldsForResult,
  propertySet: string | null,
  name: string | null
): string | null {
  const observed = propertyFieldIn(source, propertySet, name)?.dataTypes ?? [];
  return observed.length === 1 ? observed[0].value : null;
}

export function observedValuesFor(source: FieldsForResult, condition: ConditionDraft): ObservedValue[] {
  const { propertySet, name } = plainNamesOf(condition);
  if (name === null) return [];
  const field =
    condition.kind === "attribute"
      ? source.attributes.find((entry) => entry.name === name)
      : source.propertySets
          .find((set) => set.name === propertySet)
          ?.fields.find((entry) => entry.name === name);
  return field?.values ?? [];
}


export interface ConditionRowProps {
  condition: ConditionDraft;
  source: FieldsForResult;
  side?: FacetSide;
  hits?: number;
  matched?: number;
  /** Whether this row's completeness error may be shown yet — see `FacetRowFrameProps.onTouch`. */
  touched: boolean;
  onTouch: () => void;
  onChange: (next: ConditionDraft) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * A property or an attribute, on either side of the specification.
 *
 * These are the two most frequent applicability facets in the corpus — 41,300 and 41,294 — and the
 * row serving them is the same one, because the two sides differ in four things and share every
 * control: the property-set select, the field select, the stored-as picker, the value editor and
 * the phrases each degrades to when a name is a restriction rather than a plain name.
 */
export function ConditionRow({
  condition,
  source,
  side = "requirements",
  hits,
  matched,
  touched,
  onTouch,
  onChange,
  onDuplicate,
  onDelete,
}: ConditionRowProps) {
  const selects = side === "applicability";
  const observed = useMemo(() => observedValuesFor(source, condition), [source, condition]);
  const dataTypeGroups = useMemo(
    () => dataTypeGroupsFor(dataTypeOptionsFor(source, condition)),
    [source, condition]
  );
  // Not shown the instant a facet is added — only once the user leaves the row or the wizard tries
  // to advance, both of which mark it touched. `conditionProblem` itself is unaffected; it still
  // decides whether the facet can export, which `exportBlockers` reads regardless of `touched`.
  const error = touched ? conditionProblem(condition) : null;
  // Read here as well as inside the editor, because retargeting the row to another field keeps the
  // operator and the text and drops only the ticked values — a new field has its own.
  const reading = friendlyReadingOf(condition.value);
  // ids.xsd gives uri to the property and not to the attribute, so the row asks before showing it.
  const uri = condition.kind === "property" ? condition.uri : null;
  // A restriction-valued name shows as a phrase instead of a select: it names a set of fields, and
  // a select over the model's field list cannot state one. The rest of the row still works.
  const { propertySet: plainSet, name: plainField } = plainNamesOf(condition);

  const nameOptions = (
    condition.kind === "attribute"
      ? source.attributes.map((field) => field.name)
      : (source.propertySets.find((set) => set.name === plainSet)?.fields ?? []).map(
          (field) => field.name
        )
  ).sort((a, b) => a.localeCompare(b));

  const propertySetOptions = source.propertySets
    .map((set) => set.name)
    .sort((a, b) => a.localeCompare(b));

  const errorId = errorIdOf(condition.id);

  /** The same operator and text, with the ticked values dropped — a new field has its own. */
  function retargetedValue() {
    if (!reading) return condition.value;
    // The author's prose describes the restriction, and retargeting keeps the restriction. Pointing
    // the row at another field is not a reason to delete the sentence explaining what it must say.
    return carryAnnotation(
      condition.value,
      valueDraftForOperator(reading.operator, reading.text, [])
    );
  }

  /** The fields both kinds share, so switching between them carries the rest of the row across. */
  function shared() {
    const { id, cardinality, instructions, explicitCardinality } = condition;
    return { id, cardinality, instructions, explicitCardinality };
  }

  function changeKind(kind: ConditionDraft["kind"]) {
    if (kind === "property") {
      const set = source.propertySets[0];
      const name = set?.fields[0]?.name ?? "";
      onChange({
        ...shared(),
        kind,
        propertySet: set ? plainName(set.name) : null,
        name: plainName(name),
        value: retargetedValue(),
        dataType: dataTypeFromModel(source, set?.name ?? null, name),
      });
      return;
    }
    // IDS declares dataType and uri on <property> alone, so neither crosses to an attribute.
    onChange({
      ...shared(),
      kind,
      propertySet: null,
      name: plainName(source.attributes[0]?.name ?? "Name"),
      value: retargetedValue(),
    });
  }

  // The field name is carried across rather than reset to the new set's first field: the name is
  // typed here, so replacing it would throw away something the user wrote. Its suggestion list
  // follows the new set on its own, and a name that set has nothing under shows as typed.
  function changePropertySet(propertySet: string) {
    if (condition.kind !== "property") return;
    const name = plainField ?? "";
    onChange({
      ...condition,
      propertySet: plainName(propertySet),
      name: plainName(name),
      value: retargetedValue(),
      dataType: dataTypeFromModel(source, propertySet, name),
    });
  }

  function changeFieldName(name: string) {
    if (condition.kind === "attribute") {
      onChange({ ...condition, name: plainName(name), value: retargetedValue() });
      return;
    }
    onChange({
      ...condition,
      name: plainName(name),
      value: retargetedValue(),
      dataType: dataTypeFromModel(source, plainSet, name),
    });
  }


  return (
    <FacetRowFrame
      id={condition.id}
      side={side}
      prohibited={condition.cardinality === "prohibited"}
      hits={hits}
      matched={matched}
      instructions={condition.instructions}
      uri={uri}
      error={error}
      what={rowNoun(side, condition.kind)}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onTouch={onTouch}
    >
      <select
        aria-label="Condition kind"
        value={condition.kind}
        onChange={(event) => changeKind(event.target.value as ConditionDraft["kind"])}
      >
        <option value="property">Property</option>
        <option value="attribute">Attribute</option>
      </select>

      {condition.kind === "property" && (
        <>
          {condition.propertySet !== null && plainSet === null ? (
            <span className="tok cond-unshown" aria-label="Property set">
              property sets {nameSummary(condition.propertySet)}
            </span>
          ) : (
            <SuggestCombobox
              label="Property set"
              value={plainSet ?? ""}
              options={propertySetOptions}
              placeholder="property set name"
              onChange={changePropertySet}
            />
          )}
          <span className="glue">·</span>
        </>
      )}

      {plainField === null ? (
        <span className="tok cond-unshown" aria-label="Field name">
          fields {nameSummary(condition.name)}
        </span>
      ) : (
        <SuggestCombobox
          label="Field name"
          value={plainField}
          options={nameOptions}
          placeholder="field name"
          onChange={changeFieldName}
        />
      )}

      {condition.kind === "property" && (
        <SearchPicker
          label="Stored as"
          title="The IFC data type the property must be stored as"
          inputClassName="tok subtle"
          value={condition.dataType ?? NO_DATA_TYPE}
          groups={dataTypeGroups}
          maxRows={DATA_TYPE_ROWS}
          onPick={(picked) =>
            onChange({ ...condition, dataType: picked === NO_DATA_TYPE ? null : picked })
          }
        />
      )}

      {selects ? (
        <span className="glue">selects only those where it must</span>
      ) : (
        <select
          aria-label="Cardinality"
          title="Whether the field has to be there at all"
          value={condition.cardinality}
          onChange={(event) =>
            onChange({ ...condition, cardinality: event.target.value as ConditionalCardinality })
          }
        >
          {CARDINALITIES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      )}

      <FacetValueEditor
        label="Value"
        operatorLabel="Operator"
        value={condition.value}
        onChange={(value) => onChange({ ...condition, value })}
        observed={observed}
        absentLabel="be filled in"
        errorId={errorId}
        invalid={error !== null}
      />
    </FacetRowFrame>
  );
}
