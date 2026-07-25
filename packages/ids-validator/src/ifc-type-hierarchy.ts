export const IFC_SCHEMA = "IFC4" as const;

interface IfcTreeNode {
  [name: string]: IfcTreeNode;
}

const IFC_TREE: IfcTreeNode = {
  IfcProduct: {
    IfcElement: {
      IfcBuildingElement: { IfcWall: {}, IfcDoor: {}, IfcWindow: {}, IfcSlab: {}, IfcBeam: {}, IfcColumn: {},
        IfcRoof: {}, IfcStair: {}, IfcRamp: {}, IfcCovering: {}, IfcCurtainWall: {}, IfcRailing: {},
        IfcPlate: {}, IfcMember: {}, IfcFooting: {}, IfcPile: {}, IfcChimney: {}, IfcShadingDevice: {} },
      IfcDistributionElement: {
        IfcDistributionFlowElement: {
          IfcFlowSegment: { IfcDuctSegment: {}, IfcPipeSegment: {}, IfcCableSegment: {}, IfcCableCarrierSegment: {} },
          IfcFlowFitting: { IfcDuctFitting: {}, IfcPipeFitting: {}, IfcCableFitting: {}, IfcCableCarrierFitting: {}, IfcJunctionBox: {} },
          IfcFlowTerminal: { IfcAirTerminal: {}, IfcSanitaryTerminal: {}, IfcLightFixture: {}, IfcOutlet: {},
            IfcWasteTerminal: {}, IfcFireSuppressionTerminal: {}, IfcSpaceHeater: {}, IfcStackTerminal: {},
            IfcElectricAppliance: {}, IfcAudioVisualAppliance: {}, IfcCommunicationsAppliance: {}, IfcMedicalDevice: {} },
          IfcFlowController: { IfcValve: {}, IfcDamper: {}, IfcSwitchingDevice: {}, IfcFlowMeter: {},
            IfcProtectiveDevice: {}, IfcElectricDistributionBoard: {}, IfcAirTerminalBox: {} },
          IfcFlowMovingDevice: { IfcFan: {}, IfcPump: {}, IfcCompressor: {} },
          IfcFlowStorageDevice: { IfcTank: {}, IfcElectricFlowStorageDevice: {} },
          IfcFlowTreatmentDevice: { IfcFilter: {}, IfcDuctSilencer: {}, IfcInterceptor: {} },
          IfcEnergyConversionDevice: { IfcBoiler: {}, IfcChiller: {}, IfcCoil: {}, IfcHeatExchanger: {},
            IfcAirToAirHeatRecovery: {}, IfcCooledBeam: {}, IfcHumidifier: {}, IfcUnitaryEquipment: {},
            IfcEvaporator: {}, IfcCondenser: {}, IfcBurner: {}, IfcCoolingTower: {}, IfcElectricGenerator: {},
            IfcElectricMotor: {}, IfcMotorConnection: {}, IfcSolarDevice: {}, IfcTransformer: {}, IfcTubeBundle: {}, IfcEngine: {} },
        },
        IfcDistributionControlElement: { IfcSensor: {}, IfcActuator: {}, IfcController: {}, IfcAlarm: {},
          IfcFlowInstrument: {}, IfcProtectiveDeviceTrippingUnit: {}, IfcUnitaryControlElement: {} },
      },
      IfcFurnishingElement: { IfcFurniture: {}, IfcSystemFurnitureElement: {} },
      IfcElementComponent: { IfcFastener: {}, IfcMechanicalFastener: {}, IfcDiscreteAccessory: {},
        IfcBuildingElementPart: {}, IfcVibrationIsolator: {},
        IfcReinforcingElement: { IfcReinforcingBar: {}, IfcReinforcingMesh: {}, IfcTendon: {} } },
      IfcFeatureElement: { IfcOpeningElement: {}, IfcProjectionElement: {}, IfcVoidingFeature: {}, IfcSurfaceFeature: {} },
      IfcElementAssembly: {}, IfcTransportElement: {}, IfcVirtualElement: {}, IfcGeographicElement: {}, IfcCivilElement: {},
    },
    IfcSpatialElement: {
      IfcSpatialStructureElement: { IfcSite: {}, IfcBuilding: {}, IfcBuildingStorey: {}, IfcSpace: {} },
      IfcSpatialZone: {},
    },
    IfcAnnotation: {}, IfcGrid: {}, IfcProxy: {}, IfcPort: { IfcDistributionPort: {} },
  },
};

const CANONICAL_BY_UPPER = new Map<string, string>();
const ANCESTORS = new Map<string, string[]>();
const DESCENDANTS = new Map<string, string[]>();

(function walk(node: IfcTreeNode, trail: string[]): string[] {
  const collected: string[] = [];
  for (const [name, children] of Object.entries(node)) {
    CANONICAL_BY_UPPER.set(name.toUpperCase(), name);
    ANCESTORS.set(name, trail);
    const subtypes = walk(children, [name, ...trail]);
    DESCENDANTS.set(name, subtypes);
    collected.push(name, ...subtypes);
  }
  return collected;
})(IFC_TREE, []);

export function canonicalIfcType(t: string): string | null {
  return CANONICAL_BY_UPPER.get(t.trim().toUpperCase()) ?? null;
}

export function isKnownIfcType(t: string): boolean {
  return canonicalIfcType(t) !== null;
}

export function ancestorsOf(t: string): string[] {
  const canonical = canonicalIfcType(t);
  return canonical ? [...(ANCESTORS.get(canonical) ?? [])] : [];
}

export function descendantsOf(t: string): string[] {
  const canonical = canonicalIfcType(t);
  return canonical ? [...(DESCENDANTS.get(canonical) ?? [])] : [];
}

export function isSubtypeOf(t: string, candidate: string): boolean {
  const type = canonicalIfcType(t);
  const target = canonicalIfcType(candidate);
  // Unknown types still compare by name, so a rule against a type outside the
  // table keeps matching the elements that literally carry it.
  if (!type || !target) return t.trim().toUpperCase() === candidate.trim().toUpperCase();
  return type === target || (ANCESTORS.get(type) ?? []).includes(target);
}
