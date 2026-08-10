import type { NormalizedValue, PropertyValue } from "@ifc-qa/shared-types";

/**
 * Coerces a raw value read from either engine into NormalizedElement's
 * PropertyValue union (string | number | boolean | null). web-ifc wraps
 * "defined type" attributes (IfcLabel, IfcGloballyUniqueId, ...) as
 * { value: ... }; this unwraps that shape too so callers can pass either
 * engine's raw output through the same function. Arrays (ifc-lite's
 * multi-valued PropertyValue) are JSON-stringified since NormalizedElement
 * has no array member.
 */
export function normalizePropertyValue(value: unknown): PropertyValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return normalizePropertyValue((value as { value: unknown }).value);
  }
  return String(value);
}

/**
 * Wraps a raw value into the slot NormalizedElement stores. The extras are optional because most
 * slots have none: an attribute carries no measure type, and a single-valued property carries no
 * candidate list. Omitting them rather than storing `undefined` keeps the parsed shape small on a
 * model with hundreds of thousands of entities.
 */
export function normalizeValue(
  value: unknown,
  extras: { values?: unknown[]; dataType?: string; unit?: string } = {}
): NormalizedValue {
  const slot: NormalizedValue = { value: normalizePropertyValue(value) };
  if (extras.values !== undefined && extras.values.length > 0) {
    slot.values = extras.values.map(normalizePropertyValue);
  }
  if (extras.dataType !== undefined) slot.dataType = extras.dataType;
  if (extras.unit !== undefined) slot.unit = extras.unit;
  return slot;
}
