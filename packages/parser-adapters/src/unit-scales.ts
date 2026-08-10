import { measureUnit } from "@ifc-lite/parser";
import type { UnitScales } from "@ifc-qa/shared-types";

/**
 * Builds the model's {@link UnitScales} from the measure types it actually uses.
 *
 * Collecting on demand rather than enumerating avoids restating IFC's ~90-row measure table: the
 * adapter already sees every `dataType` in the file, and anything it never sees cannot be compared
 * against either. `measureUnit` — a pure lookup shared with the ifc-lite engine — answers which
 * unit type a measure is expressed in; each adapter supplies its own reader for what the file
 * declared that unit to be.
 *
 * A factor of exactly 1 is not recorded. That keeps the map to the handful of measures a model
 * really rescales, and makes "absent" mean "already SI" in one place rather than at every read.
 */
export class UnitScaleCollector {
  private readonly scales: UnitScales = {};
  private readonly seen = new Set<string>();

  constructor(private readonly siScaleForUnitType: (unitType: string) => number | undefined) {}

  observe(measureType: string | undefined): void {
    if (!measureType) return;
    const key = measureType.toUpperCase();
    if (this.seen.has(key)) return;
    this.seen.add(key);

    // Monetary and dimensionless measures have no SI form to convert to.
    const measure = measureUnit(key);
    if (!measure || measure.kind !== "typed") return;

    const scale = this.siScaleForUnitType(measure.unitType);
    if (scale !== undefined && Number.isFinite(scale) && scale !== 1) this.scales[key] = scale;
  }

  result(): UnitScales {
    return this.scales;
  }
}

/** SI prefixes as IFC spells them, with the factor each one multiplies its unit by. */
const SI_PREFIX_FACTORS: Record<string, number> = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
  FEMTO: 1e-15,
  ATTO: 1e-18,
};

/**
 * How many times a prefix applies to a unit — squared for an area, cubed for a volume. A
 * millimetre is 1e-3 of a metre, but a square millimetre is 1e-6 of a square metre.
 */
const SI_UNIT_EXPONENTS: Record<string, number> = {
  SQUARE_METRE: 2,
  CUBIC_METRE: 3,
};

/**
 * The SI unit names whose base is not the unprefixed unit. IFC names the mass unit GRAM, but SI's
 * base — and so IDS's — is the kilogram, which is why an unprefixed gram is 1e-3 and the
 * `.KILO.` a real file writes comes back out as exactly 1.
 */
const SI_UNIT_BASE_FACTORS: Record<string, number> = {
  GRAM: 1e-3,
};

/**
 * The factor an `IfcSIUnit` contributes, from its prefix and name.
 *
 * An unrecognised prefix returns `undefined` rather than 1: silently treating an unknown unit as
 * SI would compare a rescaled number against the specification's literal and approve it.
 */
export function siUnitScale(prefix: string | null, name: string): number | undefined {
  const base = SI_UNIT_BASE_FACTORS[name.toUpperCase()] ?? 1;
  if (prefix === null) return base;

  const factor = SI_PREFIX_FACTORS[prefix.toUpperCase()];
  if (factor === undefined) return undefined;
  return base * factor ** (SI_UNIT_EXPONENTS[name.toUpperCase()] ?? 1);
}
