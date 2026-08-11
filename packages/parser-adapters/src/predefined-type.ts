import { normalizePropertyValue } from "./normalize-property-value.js";

/**
 * The predefined type as IDS compares it, which is not always the enumeration the file stores.
 *
 * IFC reserves `USERDEFINED` to mean "the name is elsewhere": an `IfcObject` carries it in
 * `ObjectType`, an `IfcTypeObject` in `ElementType`, and an `IfcTypeProcess` in `ProcessType` —
 * three names for one idea, because the attribute is declared afresh on each branch of the
 * hierarchy. So a furniture item written as
 *
 *     IFCFURNITURE(…, 'WATERBOTTLE', …, .USERDEFINED.)
 *
 * has a predefined type of `WATERBOTTLE` for the purpose of a rule, and comparing against the
 * literal `USERDEFINED` matches nothing any author would write.
 *
 * When the enumeration says `USERDEFINED` but none of the fields names anything, the stored value
 * is kept: that is what the model actually says, and inventing `null` would let an "is this type
 * stated at all" check pass on an element that states only that it is unstated.
 */
export function effectivePredefinedType(
  storedPredefinedType: string | null,
  objectType: unknown,
  elementType?: unknown,
  processType?: unknown
): string | null {
  if (storedPredefinedType === null) return null;
  if (storedPredefinedType.toUpperCase() !== "USERDEFINED") return storedPredefinedType;

  for (const candidate of [objectType, elementType, processType]) {
    const name = normalizePropertyValue(candidate);
    if (typeof name === "string" && name !== "") return name;
  }
  return storedPredefinedType;
}
