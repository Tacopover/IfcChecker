import type { PropertyValue } from "@ifc-qa/shared-types";

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
