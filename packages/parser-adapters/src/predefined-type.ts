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

/**
 * What one entity says about its predefined type: the enumeration itself, and the three attributes
 * that carry the real name when the enumeration says `USERDEFINED`.
 *
 * All three are listed rather than one, because an occurrence, an element type and a type process
 * spell the attribute differently and an adapter reads whichever the entity happens to declare.
 */
export interface PredefinedTypeSource {
  /** The `PredefinedType` enumeration with its STEP dots already stripped. */
  predefinedType: string | null;
  objectType?: unknown;
  elementType?: unknown;
  processType?: unknown;
}

/**
 * Whether this entity states a predefined type at all.
 *
 * `NOTDEFINED` does not. It is the enumeration's way of saying "no value here", so a type object
 * carrying it defines nothing and the occurrence's own value stands — which is what the suite's
 * "overridden predefined types should pass" case turns on.
 */
function statesAPredefinedType(source: PredefinedTypeSource): boolean {
  const stored = source.predefinedType;
  return stored !== null && stored !== "" && stored.toUpperCase() !== "NOTDEFINED";
}

/**
 * Both strings a rule may name the element's predefined type by, resolved through its type object.
 *
 * `entity-facet.md` gives the order outright: **the type object is consulted first**, and only when
 * it defines nothing does the occurrence's own value apply. So an `IfcWall` stating no predefined
 * type of its own still has one if its `IfcWallType` does, and the name behind a type's
 * `USERDEFINED` comes from the *type's* `ElementType`.
 *
 * The one departure from the document as written is `NOTDEFINED`, which it files under "a value
 * other than USERDEFINED" and would therefore have override an occurrence. The suite states the
 * opposite as a document that must pass, so `NOTDEFINED` on a type is read as defining nothing.
 * There is no equivalent fall-through on the occurrence, which is the last place to look — a
 * `NOTDEFINED` there is kept, exactly as an unresolvable `USERDEFINED` is.
 *
 * An element storing `.USERDEFINED.` with an `ElementType` of `WALDO` satisfies a requirement
 * asking for `WALDO` *and* one asking for `USERDEFINED` — the document's own table marks both as
 * matches — so `storedPredefinedType` keeps the enumeration literal alongside the resolved name.
 * It is `null` whenever the two would be the same string, so nothing is carried twice.
 */
export function resolvePredefinedType(
  occurrence: PredefinedTypeSource,
  typeObject?: PredefinedTypeSource | null
): { predefinedType: string | null; storedPredefinedType: string | null } {
  const source = typeObject && statesAPredefinedType(typeObject) ? typeObject : occurrence;
  const stored = source.predefinedType;
  const predefinedType = effectivePredefinedType(
    stored,
    source.objectType,
    source.elementType,
    source.processType
  );
  return {
    predefinedType,
    storedPredefinedType: predefinedType === stored ? null : stored,
  };
}
