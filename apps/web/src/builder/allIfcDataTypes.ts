import { IFC_RECOGNISED_ENTITY_NAMES } from "@ifc-qa/shared-types";

/**
 * `IfcSimpleValue`'s members, which no naming rule picks out. Everything else `ids.xsd` accepts as
 * a `dataType` is an `IfcMeasureValue` or an `IfcDerivedMeasureValue`, and all but a handful of
 * those end in MEASURE — hence the sweep below rather than 100 more lines of them here.
 */
const SIMPLE_VALUE_NAMES = [
  "IFCBINARY",
  "IFCBOOLEAN",
  "IFCDATE",
  "IFCDATETIME",
  "IFCDURATION",
  "IFCIDENTIFIER",
  "IFCINTEGER",
  "IFCLABEL",
  "IFCLOGICAL",
  "IFCPOSITIVEINTEGER",
  "IFCREAL",
  "IFCTEXT",
  "IFCTIME",
  "IFCTIMESTAMP",
];

/** The measure types whose names the sweep cannot recognise. */
const UNSWEPT_MEASURE_NAMES = ["IFCCOMPLEXNUMBER"];

/**
 * The types a property may declare it is stored as, for a property the loaded file says nothing
 * about — one typed by hand, or named with no file open at all.
 *
 * A closed list rather than a free-text box: `dataType` is an IFC schema name, and one the schema
 * does not define fails every element rather than checking anything. Drawn from this build's own
 * schema table, so it says what this checker can actually resolve; a rule imported with a type
 * outside it keeps that type selectable (see `dataTypeOptionsFor`) rather than being rewritten.
 *
 * Not offered when the model does hold the property — the types it is *stored as* there are the
 * honest answer, and a declared type the file contradicts fails every element that carries it.
 */
export function allIfcDataTypeNames(): string[] {
  const swept = IFC_RECOGNISED_ENTITY_NAMES.filter((name) => name.endsWith("MEASURE"));
  return [...new Set([...SIMPLE_VALUE_NAMES, ...swept, ...UNSWEPT_MEASURE_NAMES])].sort((a, b) =>
    a.localeCompare(b)
  );
}
