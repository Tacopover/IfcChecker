// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-ifc-entity-table.mjs
// Source: @ifc-lite/data schema tables, IFC4 merged with IFC2X3-only names.

/**
 * Every IFC entity either schema declares, mapped to its direct EXPRESS
 * supertype; an entity with no supertype maps to `null`. Declaration order is
 * depth-first from each root, so a parent always appears before its children.
 *
 * The whole schema and not just the product subtree, because an IDS
 * applicability may name any entity — a type this table cannot resolve matches
 * nothing, and a rule that matches nothing used to report the model clean.
 */
export const IFC_ENTITY_PARENTS: Readonly<Record<string, string | null>> = {
  IfcApplication: null,
  IfcGloballyUniqueId: null,
  IfcOwnerHistory: null,
  IfcTable: null,
  IfcTableColumn: null,
  IfcTableRow: null,
  IfcRepresentationItem: null,
  IfcTopologicalRepresentationItem: "IfcRepresentationItem",
  IfcFace: "IfcTopologicalRepresentationItem",
  IfcFaceSurface: "IfcFace",
  IfcAdvancedFace: "IfcFaceSurface",
  IfcConnectedFaceSet: "IfcTopologicalRepresentationItem",
  IfcClosedShell: "IfcConnectedFaceSet",
  IfcOpenShell: "IfcConnectedFaceSet",
  IfcEdge: "IfcTopologicalRepresentationItem",
  IfcEdgeCurve: "IfcEdge",
  IfcOrientedEdge: "IfcEdge",
  IfcSubedge: "IfcEdge",
  IfcLoop: "IfcTopologicalRepresentationItem",
  IfcEdgeLoop: "IfcLoop",
  IfcPolyLoop: "IfcLoop",
  IfcVertexLoop: "IfcLoop",
  IfcFaceBound: "IfcTopologicalRepresentationItem",
  IfcFaceOuterBound: "IfcFaceBound",
  IfcPath: "IfcTopologicalRepresentationItem",
  IfcVertex: "IfcTopologicalRepresentationItem",
  IfcVertexPoint: "IfcVertex",
  IfcGeometricRepresentationItem: "IfcRepresentationItem",
  IfcLightSource: "IfcGeometricRepresentationItem",
  IfcLightSourceAmbient: "IfcLightSource",
  IfcLightSourceDirectional: "IfcLightSource",
  IfcLightSourceGoniometric: "IfcLightSource",
  IfcLightSourcePositional: "IfcLightSource",
  IfcLightSourceSpot: "IfcLightSourcePositional",
  IfcAnnotationFillArea: "IfcGeometricRepresentationItem",
  IfcPlanarExtent: "IfcGeometricRepresentationItem",
  IfcPlanarBox: "IfcPlanarExtent",
  IfcTextLiteral: "IfcGeometricRepresentationItem",
  IfcTextLiteralWithExtent: "IfcTextLiteral",
  IfcFillAreaStyleHatching: "IfcGeometricRepresentationItem",
  IfcFillAreaStyleTiles: "IfcGeometricRepresentationItem",
  IfcPlacement: "IfcGeometricRepresentationItem",
  IfcAxis1Placement: "IfcPlacement",
  IfcAxis2Placement2D: "IfcPlacement",
  IfcAxis2Placement3D: "IfcPlacement",
  IfcCurve: "IfcGeometricRepresentationItem",
  IfcBoundedCurve: "IfcCurve",
  IfcCompositeCurve: "IfcBoundedCurve",
  IfcCompositeCurveOnSurface: "IfcCompositeCurve",
  IfcBoundaryCurve: "IfcCompositeCurveOnSurface",
  IfcOuterBoundaryCurve: "IfcBoundaryCurve",
  IfcBSplineCurve: "IfcBoundedCurve",
  IfcBSplineCurveWithKnots: "IfcBSplineCurve",
  IfcRationalBSplineCurveWithKnots: "IfcBSplineCurveWithKnots",
  IfcCurveSegment2D: "IfcBoundedCurve",
  IfcCircularArcSegment2D: "IfcCurveSegment2D",
  IfcLineSegment2D: "IfcCurveSegment2D",
  IfcTransitionCurveSegment2D: "IfcCurveSegment2D",
  IfcIndexedPolyCurve: "IfcBoundedCurve",
  IfcPolyline: "IfcBoundedCurve",
  IfcTrimmedCurve: "IfcBoundedCurve",
  IfcAlignmentCurve: "IfcBoundedCurve",
  IfcConic: "IfcCurve",
  IfcCircle: "IfcConic",
  IfcEllipse: "IfcConic",
  IfcSurfaceCurve: "IfcCurve",
  IfcIntersectionCurve: "IfcSurfaceCurve",
  IfcSeamCurve: "IfcSurfaceCurve",
  IfcLine: "IfcCurve",
  IfcOffsetCurve: "IfcCurve",
  IfcOffsetCurve2D: "IfcOffsetCurve",
  IfcOffsetCurve3D: "IfcOffsetCurve",
  IfcOffsetCurveByDistances: "IfcOffsetCurve",
  IfcPcurve: "IfcCurve",
  IfcSurface: "IfcGeometricRepresentationItem",
  IfcBoundedSurface: "IfcSurface",
  IfcBSplineSurface: "IfcBoundedSurface",
  IfcBSplineSurfaceWithKnots: "IfcBSplineSurface",
  IfcRationalBSplineSurfaceWithKnots: "IfcBSplineSurfaceWithKnots",
  IfcCurveBoundedPlane: "IfcBoundedSurface",
  IfcCurveBoundedSurface: "IfcBoundedSurface",
  IfcRectangularTrimmedSurface: "IfcBoundedSurface",
  IfcElementarySurface: "IfcSurface",
  IfcCylindricalSurface: "IfcElementarySurface",
  IfcPlane: "IfcElementarySurface",
  IfcSphericalSurface: "IfcElementarySurface",
  IfcToroidalSurface: "IfcElementarySurface",
  IfcSweptSurface: "IfcSurface",
  IfcSurfaceOfLinearExtrusion: "IfcSweptSurface",
  IfcSurfaceOfRevolution: "IfcSweptSurface",
  IfcPoint: "IfcGeometricRepresentationItem",
  IfcCartesianPoint: "IfcPoint",
  IfcPointOnCurve: "IfcPoint",
  IfcPointOnSurface: "IfcPoint",
  IfcCartesianTransformationOperator: "IfcGeometricRepresentationItem",
  IfcCartesianTransformationOperator2D: "IfcCartesianTransformationOperator",
  IfcCartesianTransformationOperator2DnonUniform: "IfcCartesianTransformationOperator2D",
  IfcCartesianTransformationOperator3D: "IfcCartesianTransformationOperator",
  IfcCartesianTransformationOperator3DnonUniform: "IfcCartesianTransformationOperator3D",
  IfcCompositeCurveSegment: "IfcGeometricRepresentationItem",
  IfcReparametrisedCompositeCurveSegment: "IfcCompositeCurveSegment",
  IfcDirection: "IfcGeometricRepresentationItem",
  IfcDistanceExpression: "IfcGeometricRepresentationItem",
  IfcOrientationExpression: "IfcGeometricRepresentationItem",
  IfcVector: "IfcGeometricRepresentationItem",
  IfcSolidModel: "IfcGeometricRepresentationItem",
  IfcManifoldSolidBrep: "IfcSolidModel",
  IfcAdvancedBrep: "IfcManifoldSolidBrep",
  IfcAdvancedBrepWithVoids: "IfcAdvancedBrep",
  IfcFacetedBrep: "IfcManifoldSolidBrep",
  IfcFacetedBrepWithVoids: "IfcFacetedBrep",
  IfcCsgSolid: "IfcSolidModel",
  IfcSweptAreaSolid: "IfcSolidModel",
  IfcExtrudedAreaSolid: "IfcSweptAreaSolid",
  IfcExtrudedAreaSolidTapered: "IfcExtrudedAreaSolid",
  IfcFixedReferenceSweptAreaSolid: "IfcSweptAreaSolid",
  IfcRevolvedAreaSolid: "IfcSweptAreaSolid",
  IfcRevolvedAreaSolidTapered: "IfcRevolvedAreaSolid",
  IfcSurfaceCurveSweptAreaSolid: "IfcSweptAreaSolid",
  IfcSectionedSolid: "IfcSolidModel",
  IfcSectionedSolidHorizontal: "IfcSectionedSolid",
  IfcSweptDiskSolid: "IfcSolidModel",
  IfcSweptDiskSolidPolygonal: "IfcSweptDiskSolid",
  IfcCsgPrimitive3D: "IfcGeometricRepresentationItem",
  IfcBlock: "IfcCsgPrimitive3D",
  IfcRectangularPyramid: "IfcCsgPrimitive3D",
  IfcRightCircularCone: "IfcCsgPrimitive3D",
  IfcRightCircularCylinder: "IfcCsgPrimitive3D",
  IfcSphere: "IfcCsgPrimitive3D",
  IfcBooleanResult: "IfcGeometricRepresentationItem",
  IfcBooleanClippingResult: "IfcBooleanResult",
  IfcBoundingBox: "IfcGeometricRepresentationItem",
  IfcHalfSpaceSolid: "IfcGeometricRepresentationItem",
  IfcBoxedHalfSpace: "IfcHalfSpaceSolid",
  IfcPolygonalBoundedHalfSpace: "IfcHalfSpaceSolid",
  IfcCartesianPointList: "IfcGeometricRepresentationItem",
  IfcCartesianPointList2D: "IfcCartesianPointList",
  IfcCartesianPointList3D: "IfcCartesianPointList",
  IfcFaceBasedSurfaceModel: "IfcGeometricRepresentationItem",
  IfcGeometricSet: "IfcGeometricRepresentationItem",
  IfcGeometricCurveSet: "IfcGeometricSet",
  IfcTessellatedItem: "IfcGeometricRepresentationItem",
  IfcIndexedPolygonalFace: "IfcTessellatedItem",
  IfcIndexedPolygonalFaceWithVoids: "IfcIndexedPolygonalFace",
  IfcTessellatedFaceSet: "IfcTessellatedItem",
  IfcPolygonalFaceSet: "IfcTessellatedFaceSet",
  IfcTriangulatedFaceSet: "IfcTessellatedFaceSet",
  IfcTriangulatedIrregularNetwork: "IfcTriangulatedFaceSet",
  IfcSectionedSpine: "IfcGeometricRepresentationItem",
  IfcShellBasedSurfaceModel: "IfcGeometricRepresentationItem",
  IfcAlignment2DHorizontal: "IfcGeometricRepresentationItem",
  IfcAlignment2DSegment: "IfcGeometricRepresentationItem",
  IfcAlignment2DHorizontalSegment: "IfcAlignment2DSegment",
  IfcAlignment2DVerticalSegment: "IfcAlignment2DSegment",
  IfcAlignment2DVerSegCircularArc: "IfcAlignment2DVerticalSegment",
  IfcAlignment2DVerSegLine: "IfcAlignment2DVerticalSegment",
  IfcAlignment2DVerSegParabolicArc: "IfcAlignment2DVerticalSegment",
  IfcAlignment2DVertical: "IfcGeometricRepresentationItem",
  IfcStyledItem: "IfcRepresentationItem",
  IfcMappedItem: "IfcRepresentationItem",
  IfcBoundaryCondition: null,
  IfcBoundaryEdgeCondition: "IfcBoundaryCondition",
  IfcBoundaryFaceCondition: "IfcBoundaryCondition",
  IfcBoundaryNodeCondition: "IfcBoundaryCondition",
  IfcBoundaryNodeConditionWarping: "IfcBoundaryNodeCondition",
  IfcStructuralConnectionCondition: null,
  IfcFailureConnectionCondition: "IfcStructuralConnectionCondition",
  IfcSlippageConnectionCondition: "IfcStructuralConnectionCondition",
  IfcStructuralLoad: null,
  IfcStructuralLoadConfiguration: "IfcStructuralLoad",
  IfcStructuralLoadOrResult: "IfcStructuralLoad",
  IfcStructuralLoadStatic: "IfcStructuralLoadOrResult",
  IfcStructuralLoadLinearForce: "IfcStructuralLoadStatic",
  IfcStructuralLoadPlanarForce: "IfcStructuralLoadStatic",
  IfcStructuralLoadSingleDisplacement: "IfcStructuralLoadStatic",
  IfcStructuralLoadSingleDisplacementDistortion: "IfcStructuralLoadSingleDisplacement",
  IfcStructuralLoadSingleForce: "IfcStructuralLoadStatic",
  IfcStructuralLoadSingleForceWarping: "IfcStructuralLoadSingleForce",
  IfcStructuralLoadTemperature: "IfcStructuralLoadStatic",
  IfcSurfaceReinforcementArea: "IfcStructuralLoadOrResult",
  IfcRoot: null,
  IfcObjectDefinition: "IfcRoot",
  IfcObject: "IfcObjectDefinition",
  IfcProduct: "IfcObject",
  IfcElement: "IfcProduct",
  IfcBuildingElement: "IfcElement",
  IfcFooting: "IfcBuildingElement",
  IfcPile: "IfcBuildingElement",
  IfcBeam: "IfcBuildingElement",
  IfcBeamStandardCase: "IfcBeam",
  IfcBuildingElementProxy: "IfcBuildingElement",
  IfcChimney: "IfcBuildingElement",
  IfcColumn: "IfcBuildingElement",
  IfcColumnStandardCase: "IfcColumn",
  IfcCovering: "IfcBuildingElement",
  IfcCurtainWall: "IfcBuildingElement",
  IfcDoor: "IfcBuildingElement",
  IfcDoorStandardCase: "IfcDoor",
  IfcMember: "IfcBuildingElement",
  IfcMemberStandardCase: "IfcMember",
  IfcPlate: "IfcBuildingElement",
  IfcPlateStandardCase: "IfcPlate",
  IfcRailing: "IfcBuildingElement",
  IfcRamp: "IfcBuildingElement",
  IfcRampFlight: "IfcBuildingElement",
  IfcRoof: "IfcBuildingElement",
  IfcShadingDevice: "IfcBuildingElement",
  IfcSlab: "IfcBuildingElement",
  IfcSlabElementedCase: "IfcSlab",
  IfcSlabStandardCase: "IfcSlab",
  IfcStair: "IfcBuildingElement",
  IfcStairFlight: "IfcBuildingElement",
  IfcWall: "IfcBuildingElement",
  IfcWallElementedCase: "IfcWall",
  IfcWallStandardCase: "IfcWall",
  IfcWindow: "IfcBuildingElement",
  IfcWindowStandardCase: "IfcWindow",
  IfcElementComponent: "IfcElement",
  IfcReinforcingElement: "IfcElementComponent",
  IfcReinforcingBar: "IfcReinforcingElement",
  IfcReinforcingMesh: "IfcReinforcingElement",
  IfcTendon: "IfcReinforcingElement",
  IfcTendonAnchor: "IfcReinforcingElement",
  IfcBuildingElementPart: "IfcElementComponent",
  IfcDiscreteAccessory: "IfcElementComponent",
  IfcFastener: "IfcElementComponent",
  IfcMechanicalFastener: "IfcElementComponent",
  IfcVibrationIsolator: "IfcElementComponent",
  IfcFeatureElement: "IfcElement",
  IfcSurfaceFeature: "IfcFeatureElement",
  IfcFeatureElementSubtraction: "IfcFeatureElement",
  IfcVoidingFeature: "IfcFeatureElementSubtraction",
  IfcOpeningElement: "IfcFeatureElementSubtraction",
  IfcOpeningStandardCase: "IfcOpeningElement",
  IfcFeatureElementAddition: "IfcFeatureElement",
  IfcProjectionElement: "IfcFeatureElementAddition",
  IfcFurnishingElement: "IfcElement",
  IfcFurniture: "IfcFurnishingElement",
  IfcSystemFurnitureElement: "IfcFurnishingElement",
  IfcDistributionElement: "IfcElement",
  IfcDistributionFlowElement: "IfcDistributionElement",
  IfcDistributionChamberElement: "IfcDistributionFlowElement",
  IfcEnergyConversionDevice: "IfcDistributionFlowElement",
  IfcAirToAirHeatRecovery: "IfcEnergyConversionDevice",
  IfcBoiler: "IfcEnergyConversionDevice",
  IfcBurner: "IfcEnergyConversionDevice",
  IfcChiller: "IfcEnergyConversionDevice",
  IfcCoil: "IfcEnergyConversionDevice",
  IfcCondenser: "IfcEnergyConversionDevice",
  IfcCooledBeam: "IfcEnergyConversionDevice",
  IfcCoolingTower: "IfcEnergyConversionDevice",
  IfcEngine: "IfcEnergyConversionDevice",
  IfcEvaporativeCooler: "IfcEnergyConversionDevice",
  IfcEvaporator: "IfcEnergyConversionDevice",
  IfcHeatExchanger: "IfcEnergyConversionDevice",
  IfcHumidifier: "IfcEnergyConversionDevice",
  IfcTubeBundle: "IfcEnergyConversionDevice",
  IfcUnitaryEquipment: "IfcEnergyConversionDevice",
  IfcElectricGenerator: "IfcEnergyConversionDevice",
  IfcElectricMotor: "IfcEnergyConversionDevice",
  IfcMotorConnection: "IfcEnergyConversionDevice",
  IfcSolarDevice: "IfcEnergyConversionDevice",
  IfcTransformer: "IfcEnergyConversionDevice",
  IfcFlowController: "IfcDistributionFlowElement",
  IfcAirTerminalBox: "IfcFlowController",
  IfcDamper: "IfcFlowController",
  IfcFlowMeter: "IfcFlowController",
  IfcValve: "IfcFlowController",
  IfcElectricDistributionBoard: "IfcFlowController",
  IfcElectricTimeControl: "IfcFlowController",
  IfcProtectiveDevice: "IfcFlowController",
  IfcSwitchingDevice: "IfcFlowController",
  IfcFlowFitting: "IfcDistributionFlowElement",
  IfcDuctFitting: "IfcFlowFitting",
  IfcPipeFitting: "IfcFlowFitting",
  IfcCableCarrierFitting: "IfcFlowFitting",
  IfcCableFitting: "IfcFlowFitting",
  IfcJunctionBox: "IfcFlowFitting",
  IfcFlowMovingDevice: "IfcDistributionFlowElement",
  IfcCompressor: "IfcFlowMovingDevice",
  IfcFan: "IfcFlowMovingDevice",
  IfcPump: "IfcFlowMovingDevice",
  IfcFlowSegment: "IfcDistributionFlowElement",
  IfcDuctSegment: "IfcFlowSegment",
  IfcPipeSegment: "IfcFlowSegment",
  IfcCableCarrierSegment: "IfcFlowSegment",
  IfcCableSegment: "IfcFlowSegment",
  IfcFlowStorageDevice: "IfcDistributionFlowElement",
  IfcTank: "IfcFlowStorageDevice",
  IfcElectricFlowStorageDevice: "IfcFlowStorageDevice",
  IfcFlowTerminal: "IfcDistributionFlowElement",
  IfcFireSuppressionTerminal: "IfcFlowTerminal",
  IfcSanitaryTerminal: "IfcFlowTerminal",
  IfcStackTerminal: "IfcFlowTerminal",
  IfcWasteTerminal: "IfcFlowTerminal",
  IfcAirTerminal: "IfcFlowTerminal",
  IfcMedicalDevice: "IfcFlowTerminal",
  IfcSpaceHeater: "IfcFlowTerminal",
  IfcAudioVisualAppliance: "IfcFlowTerminal",
  IfcCommunicationsAppliance: "IfcFlowTerminal",
  IfcElectricAppliance: "IfcFlowTerminal",
  IfcLamp: "IfcFlowTerminal",
  IfcLightFixture: "IfcFlowTerminal",
  IfcOutlet: "IfcFlowTerminal",
  IfcFlowTreatmentDevice: "IfcDistributionFlowElement",
  IfcInterceptor: "IfcFlowTreatmentDevice",
  IfcDuctSilencer: "IfcFlowTreatmentDevice",
  IfcFilter: "IfcFlowTreatmentDevice",
  IfcDistributionControlElement: "IfcDistributionElement",
  IfcProtectiveDeviceTrippingUnit: "IfcDistributionControlElement",
  IfcActuator: "IfcDistributionControlElement",
  IfcAlarm: "IfcDistributionControlElement",
  IfcController: "IfcDistributionControlElement",
  IfcFlowInstrument: "IfcDistributionControlElement",
  IfcSensor: "IfcDistributionControlElement",
  IfcUnitaryControlElement: "IfcDistributionControlElement",
  IfcCivilElement: "IfcElement",
  IfcElementAssembly: "IfcElement",
  IfcGeographicElement: "IfcElement",
  IfcTransportElement: "IfcElement",
  IfcVirtualElement: "IfcElement",
  IfcStructuralActivity: "IfcProduct",
  IfcStructuralAction: "IfcStructuralActivity",
  IfcStructuralCurveAction: "IfcStructuralAction",
  IfcStructuralLinearAction: "IfcStructuralCurveAction",
  IfcStructuralSurfaceAction: "IfcStructuralAction",
  IfcStructuralPlanarAction: "IfcStructuralSurfaceAction",
  IfcStructuralPointAction: "IfcStructuralAction",
  IfcStructuralReaction: "IfcStructuralActivity",
  IfcStructuralCurveReaction: "IfcStructuralReaction",
  IfcStructuralPointReaction: "IfcStructuralReaction",
  IfcStructuralSurfaceReaction: "IfcStructuralReaction",
  IfcStructuralItem: "IfcProduct",
  IfcStructuralConnection: "IfcStructuralItem",
  IfcStructuralCurveConnection: "IfcStructuralConnection",
  IfcStructuralPointConnection: "IfcStructuralConnection",
  IfcStructuralSurfaceConnection: "IfcStructuralConnection",
  IfcStructuralMember: "IfcStructuralItem",
  IfcStructuralCurveMember: "IfcStructuralMember",
  IfcStructuralCurveMemberVarying: "IfcStructuralCurveMember",
  IfcStructuralSurfaceMember: "IfcStructuralMember",
  IfcStructuralSurfaceMemberVarying: "IfcStructuralSurfaceMember",
  IfcPort: "IfcProduct",
  IfcDistributionPort: "IfcPort",
  IfcPositioningElement: "IfcProduct",
  IfcLinearPositioningElement: "IfcPositioningElement",
  IfcAlignment: "IfcLinearPositioningElement",
  IfcReferent: "IfcPositioningElement",
  IfcAnnotation: "IfcProduct",
  IfcSpatialElement: "IfcProduct",
  IfcSpatialStructureElement: "IfcSpatialElement",
  IfcBuilding: "IfcSpatialStructureElement",
  IfcBuildingStorey: "IfcSpatialStructureElement",
  IfcSite: "IfcSpatialStructureElement",
  IfcSpace: "IfcSpatialStructureElement",
  IfcExternalSpatialStructureElement: "IfcSpatialElement",
  IfcExternalSpatialElement: "IfcExternalSpatialStructureElement",
  IfcSpatialZone: "IfcSpatialElement",
  IfcGrid: "IfcProduct",
  IfcProxy: "IfcProduct",
  IfcGroup: "IfcObject",
  IfcSystem: "IfcGroup",
  IfcStructuralAnalysisModel: "IfcSystem",
  IfcDistributionSystem: "IfcSystem",
  IfcDistributionCircuit: "IfcDistributionSystem",
  IfcBuildingSystem: "IfcSystem",
  IfcZone: "IfcSystem",
  IfcStructuralLoadGroup: "IfcGroup",
  IfcStructuralLoadCase: "IfcStructuralLoadGroup",
  IfcStructuralResultGroup: "IfcGroup",
  IfcAsset: "IfcGroup",
  IfcInventory: "IfcGroup",
  IfcControl: "IfcObject",
  IfcActionRequest: "IfcControl",
  IfcCostItem: "IfcControl",
  IfcCostSchedule: "IfcControl",
  IfcPermit: "IfcControl",
  IfcProjectOrder: "IfcControl",
  IfcWorkCalendar: "IfcControl",
  IfcWorkControl: "IfcControl",
  IfcWorkPlan: "IfcWorkControl",
  IfcWorkSchedule: "IfcWorkControl",
  IfcPerformanceHistory: "IfcControl",
  IfcActor: "IfcObject",
  IfcOccupant: "IfcActor",
  IfcProcess: "IfcObject",
  IfcEvent: "IfcProcess",
  IfcProcedure: "IfcProcess",
  IfcTask: "IfcProcess",
  IfcResource: "IfcObject",
  IfcConstructionResource: "IfcResource",
  IfcConstructionEquipmentResource: "IfcConstructionResource",
  IfcConstructionMaterialResource: "IfcConstructionResource",
  IfcConstructionProductResource: "IfcConstructionResource",
  IfcCrewResource: "IfcConstructionResource",
  IfcLaborResource: "IfcConstructionResource",
  IfcSubContractResource: "IfcConstructionResource",
  IfcTypeObject: "IfcObjectDefinition",
  IfcTypeProduct: "IfcTypeObject",
  IfcElementType: "IfcTypeProduct",
  IfcBuildingElementType: "IfcElementType",
  IfcFootingType: "IfcBuildingElementType",
  IfcPileType: "IfcBuildingElementType",
  IfcBeamType: "IfcBuildingElementType",
  IfcBuildingElementProxyType: "IfcBuildingElementType",
  IfcChimneyType: "IfcBuildingElementType",
  IfcColumnType: "IfcBuildingElementType",
  IfcCoveringType: "IfcBuildingElementType",
  IfcCurtainWallType: "IfcBuildingElementType",
  IfcDoorType: "IfcBuildingElementType",
  IfcMemberType: "IfcBuildingElementType",
  IfcPlateType: "IfcBuildingElementType",
  IfcRailingType: "IfcBuildingElementType",
  IfcRampFlightType: "IfcBuildingElementType",
  IfcRampType: "IfcBuildingElementType",
  IfcRoofType: "IfcBuildingElementType",
  IfcShadingDeviceType: "IfcBuildingElementType",
  IfcSlabType: "IfcBuildingElementType",
  IfcStairFlightType: "IfcBuildingElementType",
  IfcStairType: "IfcBuildingElementType",
  IfcWallType: "IfcBuildingElementType",
  IfcWindowType: "IfcBuildingElementType",
  IfcElementComponentType: "IfcElementType",
  IfcReinforcingElementType: "IfcElementComponentType",
  IfcReinforcingBarType: "IfcReinforcingElementType",
  IfcReinforcingMeshType: "IfcReinforcingElementType",
  IfcTendonAnchorType: "IfcReinforcingElementType",
  IfcTendonType: "IfcReinforcingElementType",
  IfcBuildingElementPartType: "IfcElementComponentType",
  IfcDiscreteAccessoryType: "IfcElementComponentType",
  IfcFastenerType: "IfcElementComponentType",
  IfcMechanicalFastenerType: "IfcElementComponentType",
  IfcVibrationIsolatorType: "IfcElementComponentType",
  IfcFurnishingElementType: "IfcElementType",
  IfcFurnitureType: "IfcFurnishingElementType",
  IfcSystemFurnitureElementType: "IfcFurnishingElementType",
  IfcDistributionElementType: "IfcElementType",
  IfcDistributionFlowElementType: "IfcDistributionElementType",
  IfcDistributionChamberElementType: "IfcDistributionFlowElementType",
  IfcEnergyConversionDeviceType: "IfcDistributionFlowElementType",
  IfcAirToAirHeatRecoveryType: "IfcEnergyConversionDeviceType",
  IfcBoilerType: "IfcEnergyConversionDeviceType",
  IfcBurnerType: "IfcEnergyConversionDeviceType",
  IfcChillerType: "IfcEnergyConversionDeviceType",
  IfcCoilType: "IfcEnergyConversionDeviceType",
  IfcCondenserType: "IfcEnergyConversionDeviceType",
  IfcCooledBeamType: "IfcEnergyConversionDeviceType",
  IfcCoolingTowerType: "IfcEnergyConversionDeviceType",
  IfcEngineType: "IfcEnergyConversionDeviceType",
  IfcEvaporativeCoolerType: "IfcEnergyConversionDeviceType",
  IfcEvaporatorType: "IfcEnergyConversionDeviceType",
  IfcHeatExchangerType: "IfcEnergyConversionDeviceType",
  IfcHumidifierType: "IfcEnergyConversionDeviceType",
  IfcTubeBundleType: "IfcEnergyConversionDeviceType",
  IfcUnitaryEquipmentType: "IfcEnergyConversionDeviceType",
  IfcElectricGeneratorType: "IfcEnergyConversionDeviceType",
  IfcElectricMotorType: "IfcEnergyConversionDeviceType",
  IfcMotorConnectionType: "IfcEnergyConversionDeviceType",
  IfcSolarDeviceType: "IfcEnergyConversionDeviceType",
  IfcTransformerType: "IfcEnergyConversionDeviceType",
  IfcFlowControllerType: "IfcDistributionFlowElementType",
  IfcAirTerminalBoxType: "IfcFlowControllerType",
  IfcDamperType: "IfcFlowControllerType",
  IfcFlowMeterType: "IfcFlowControllerType",
  IfcValveType: "IfcFlowControllerType",
  IfcElectricDistributionBoardType: "IfcFlowControllerType",
  IfcElectricTimeControlType: "IfcFlowControllerType",
  IfcProtectiveDeviceType: "IfcFlowControllerType",
  IfcSwitchingDeviceType: "IfcFlowControllerType",
  IfcFlowFittingType: "IfcDistributionFlowElementType",
  IfcDuctFittingType: "IfcFlowFittingType",
  IfcPipeFittingType: "IfcFlowFittingType",
  IfcCableCarrierFittingType: "IfcFlowFittingType",
  IfcCableFittingType: "IfcFlowFittingType",
  IfcJunctionBoxType: "IfcFlowFittingType",
  IfcFlowMovingDeviceType: "IfcDistributionFlowElementType",
  IfcCompressorType: "IfcFlowMovingDeviceType",
  IfcFanType: "IfcFlowMovingDeviceType",
  IfcPumpType: "IfcFlowMovingDeviceType",
  IfcFlowSegmentType: "IfcDistributionFlowElementType",
  IfcDuctSegmentType: "IfcFlowSegmentType",
  IfcPipeSegmentType: "IfcFlowSegmentType",
  IfcCableCarrierSegmentType: "IfcFlowSegmentType",
  IfcCableSegmentType: "IfcFlowSegmentType",
  IfcFlowStorageDeviceType: "IfcDistributionFlowElementType",
  IfcTankType: "IfcFlowStorageDeviceType",
  IfcElectricFlowStorageDeviceType: "IfcFlowStorageDeviceType",
  IfcFlowTerminalType: "IfcDistributionFlowElementType",
  IfcFireSuppressionTerminalType: "IfcFlowTerminalType",
  IfcSanitaryTerminalType: "IfcFlowTerminalType",
  IfcStackTerminalType: "IfcFlowTerminalType",
  IfcWasteTerminalType: "IfcFlowTerminalType",
  IfcAirTerminalType: "IfcFlowTerminalType",
  IfcMedicalDeviceType: "IfcFlowTerminalType",
  IfcSpaceHeaterType: "IfcFlowTerminalType",
  IfcAudioVisualApplianceType: "IfcFlowTerminalType",
  IfcCommunicationsApplianceType: "IfcFlowTerminalType",
  IfcElectricApplianceType: "IfcFlowTerminalType",
  IfcLampType: "IfcFlowTerminalType",
  IfcLightFixtureType: "IfcFlowTerminalType",
  IfcOutletType: "IfcFlowTerminalType",
  IfcFlowTreatmentDeviceType: "IfcDistributionFlowElementType",
  IfcInterceptorType: "IfcFlowTreatmentDeviceType",
  IfcDuctSilencerType: "IfcFlowTreatmentDeviceType",
  IfcFilterType: "IfcFlowTreatmentDeviceType",
  IfcDistributionControlElementType: "IfcDistributionElementType",
  IfcProtectiveDeviceTrippingUnitType: "IfcDistributionControlElementType",
  IfcActuatorType: "IfcDistributionControlElementType",
  IfcAlarmType: "IfcDistributionControlElementType",
  IfcControllerType: "IfcDistributionControlElementType",
  IfcFlowInstrumentType: "IfcDistributionControlElementType",
  IfcSensorType: "IfcDistributionControlElementType",
  IfcUnitaryControlElementType: "IfcDistributionControlElementType",
  IfcCivilElementType: "IfcElementType",
  IfcElementAssemblyType: "IfcElementType",
  IfcGeographicElementType: "IfcElementType",
  IfcTransportElementType: "IfcElementType",
  IfcSpatialElementType: "IfcTypeProduct",
  IfcSpatialStructureElementType: "IfcSpatialElementType",
  IfcSpaceType: "IfcSpatialStructureElementType",
  IfcSpatialZoneType: "IfcSpatialElementType",
  IfcDoorStyle: "IfcTypeProduct",
  IfcWindowStyle: "IfcTypeProduct",
  IfcTypeProcess: "IfcTypeObject",
  IfcEventType: "IfcTypeProcess",
  IfcProcedureType: "IfcTypeProcess",
  IfcTaskType: "IfcTypeProcess",
  IfcTypeResource: "IfcTypeObject",
  IfcConstructionResourceType: "IfcTypeResource",
  IfcConstructionEquipmentResourceType: "IfcConstructionResourceType",
  IfcConstructionMaterialResourceType: "IfcConstructionResourceType",
  IfcConstructionProductResourceType: "IfcConstructionResourceType",
  IfcCrewResourceType: "IfcConstructionResourceType",
  IfcLaborResourceType: "IfcConstructionResourceType",
  IfcSubContractResourceType: "IfcConstructionResourceType",
  IfcContext: "IfcObjectDefinition",
  IfcProject: "IfcContext",
  IfcProjectLibrary: "IfcContext",
  IfcPropertyDefinition: "IfcRoot",
  IfcPropertySetDefinition: "IfcPropertyDefinition",
  IfcPreDefinedPropertySet: "IfcPropertySetDefinition",
  IfcReinforcementDefinitionProperties: "IfcPreDefinedPropertySet",
  IfcDoorLiningProperties: "IfcPreDefinedPropertySet",
  IfcDoorPanelProperties: "IfcPreDefinedPropertySet",
  IfcPermeableCoveringProperties: "IfcPreDefinedPropertySet",
  IfcWindowLiningProperties: "IfcPreDefinedPropertySet",
  IfcWindowPanelProperties: "IfcPreDefinedPropertySet",
  IfcQuantitySet: "IfcPropertySetDefinition",
  IfcElementQuantity: "IfcQuantitySet",
  IfcPropertySet: "IfcPropertySetDefinition",
  IfcPropertyTemplateDefinition: "IfcPropertyDefinition",
  IfcPropertyTemplate: "IfcPropertyTemplateDefinition",
  IfcComplexPropertyTemplate: "IfcPropertyTemplate",
  IfcSimplePropertyTemplate: "IfcPropertyTemplate",
  IfcPropertySetTemplate: "IfcPropertyTemplateDefinition",
  IfcRelationship: "IfcRoot",
  IfcRelConnects: "IfcRelationship",
  IfcRelConnectsStructuralActivity: "IfcRelConnects",
  IfcRelConnectsStructuralMember: "IfcRelConnects",
  IfcRelConnectsWithEccentricity: "IfcRelConnectsStructuralMember",
  IfcRelFlowControlElements: "IfcRelConnects",
  IfcRelConnectsElements: "IfcRelConnects",
  IfcRelConnectsPathElements: "IfcRelConnectsElements",
  IfcRelConnectsWithRealizingElements: "IfcRelConnectsElements",
  IfcRelCoversBldgElements: "IfcRelConnects",
  IfcRelCoversSpaces: "IfcRelConnects",
  IfcRelConnectsPorts: "IfcRelConnects",
  IfcRelConnectsPortToElement: "IfcRelConnects",
  IfcRelContainedInSpatialStructure: "IfcRelConnects",
  IfcRelFillsElement: "IfcRelConnects",
  IfcRelInterferesElements: "IfcRelConnects",
  IfcRelReferencedInSpatialStructure: "IfcRelConnects",
  IfcRelServicesBuildings: "IfcRelConnects",
  IfcRelSpaceBoundary: "IfcRelConnects",
  IfcRelSpaceBoundary1stLevel: "IfcRelSpaceBoundary",
  IfcRelSpaceBoundary2ndLevel: "IfcRelSpaceBoundary1stLevel",
  IfcRelSequence: "IfcRelConnects",
  IfcRelAssociates: "IfcRelationship",
  IfcRelAssociatesMaterial: "IfcRelAssociates",
  IfcRelAssociatesClassification: "IfcRelAssociates",
  IfcRelAssociatesDocument: "IfcRelAssociates",
  IfcRelAssociatesLibrary: "IfcRelAssociates",
  IfcRelAssociatesApproval: "IfcRelAssociates",
  IfcRelAssociatesConstraint: "IfcRelAssociates",
  IfcRelDecomposes: "IfcRelationship",
  IfcRelProjectsElement: "IfcRelDecomposes",
  IfcRelVoidsElement: "IfcRelDecomposes",
  IfcRelAggregates: "IfcRelDecomposes",
  IfcRelNests: "IfcRelDecomposes",
  IfcRelAssigns: "IfcRelationship",
  IfcRelAssignsToActor: "IfcRelAssigns",
  IfcRelAssignsToControl: "IfcRelAssigns",
  IfcRelAssignsToGroup: "IfcRelAssigns",
  IfcRelAssignsToGroupByFactor: "IfcRelAssignsToGroup",
  IfcRelAssignsToProcess: "IfcRelAssigns",
  IfcRelAssignsToProduct: "IfcRelAssigns",
  IfcRelAssignsToResource: "IfcRelAssigns",
  IfcRelDeclares: "IfcRelationship",
  IfcRelDefines: "IfcRelationship",
  IfcRelDefinesByObject: "IfcRelDefines",
  IfcRelDefinesByProperties: "IfcRelDefines",
  IfcRelDefinesByTemplate: "IfcRelDefines",
  IfcRelDefinesByType: "IfcRelDefines",
  IfcCoordinateOperation: null,
  IfcMapConversion: "IfcCoordinateOperation",
  IfcCoordinateReferenceSystem: null,
  IfcProjectedCRS: "IfcCoordinateReferenceSystem",
  IfcRepresentationContext: null,
  IfcGeometricRepresentationContext: "IfcRepresentationContext",
  IfcGeometricRepresentationSubContext: "IfcGeometricRepresentationContext",
  IfcProductRepresentation: null,
  IfcMaterialDefinitionRepresentation: "IfcProductRepresentation",
  IfcProductDefinitionShape: "IfcProductRepresentation",
  IfcRepresentation: null,
  IfcShapeModel: "IfcRepresentation",
  IfcShapeRepresentation: "IfcShapeModel",
  IfcTopologyRepresentation: "IfcShapeModel",
  IfcStyleModel: "IfcRepresentation",
  IfcStyledRepresentation: "IfcStyleModel",
  IfcShapeAspect: null,
  IfcPhysicalQuantity: null,
  IfcPhysicalComplexQuantity: "IfcPhysicalQuantity",
  IfcPhysicalSimpleQuantity: "IfcPhysicalQuantity",
  IfcQuantityArea: "IfcPhysicalSimpleQuantity",
  IfcQuantityCount: "IfcPhysicalSimpleQuantity",
  IfcQuantityLength: "IfcPhysicalSimpleQuantity",
  IfcQuantityTime: "IfcPhysicalSimpleQuantity",
  IfcQuantityVolume: "IfcPhysicalSimpleQuantity",
  IfcQuantityWeight: "IfcPhysicalSimpleQuantity",
  IfcPropertyAbstraction: null,
  IfcProperty: "IfcPropertyAbstraction",
  IfcComplexProperty: "IfcProperty",
  IfcSimpleProperty: "IfcProperty",
  IfcPropertyBoundedValue: "IfcSimpleProperty",
  IfcPropertyEnumeratedValue: "IfcSimpleProperty",
  IfcPropertyListValue: "IfcSimpleProperty",
  IfcPropertyReferenceValue: "IfcSimpleProperty",
  IfcPropertySingleValue: "IfcSimpleProperty",
  IfcPropertyTableValue: "IfcSimpleProperty",
  IfcExtendedProperties: "IfcPropertyAbstraction",
  IfcProfileProperties: "IfcExtendedProperties",
  IfcMaterialProperties: "IfcExtendedProperties",
  IfcPreDefinedProperties: "IfcPropertyAbstraction",
  IfcReinforcementBarProperties: "IfcPreDefinedProperties",
  IfcSectionProperties: "IfcPreDefinedProperties",
  IfcSectionReinforcementProperties: "IfcPreDefinedProperties",
  IfcPropertyEnumeration: "IfcPropertyAbstraction",
  IfcResourceLevelRelationship: null,
  IfcPropertyDependencyRelationship: "IfcResourceLevelRelationship",
  IfcMaterialRelationship: "IfcResourceLevelRelationship",
  IfcDocumentInformationRelationship: "IfcResourceLevelRelationship",
  IfcExternalReferenceRelationship: "IfcResourceLevelRelationship",
  IfcCurrencyRelationship: "IfcResourceLevelRelationship",
  IfcResourceConstraintRelationship: "IfcResourceLevelRelationship",
  IfcApprovalRelationship: "IfcResourceLevelRelationship",
  IfcResourceApprovalRelationship: "IfcResourceLevelRelationship",
  IfcOrganizationRelationship: "IfcResourceLevelRelationship",
  IfcProfileDef: null,
  IfcArbitraryClosedProfileDef: "IfcProfileDef",
  IfcArbitraryProfileDefWithVoids: "IfcArbitraryClosedProfileDef",
  IfcArbitraryOpenProfileDef: "IfcProfileDef",
  IfcCenterLineProfileDef: "IfcArbitraryOpenProfileDef",
  IfcParameterizedProfileDef: "IfcProfileDef",
  IfcAsymmetricIShapeProfileDef: "IfcParameterizedProfileDef",
  IfcCircleProfileDef: "IfcParameterizedProfileDef",
  IfcCircleHollowProfileDef: "IfcCircleProfileDef",
  IfcCShapeProfileDef: "IfcParameterizedProfileDef",
  IfcEllipseProfileDef: "IfcParameterizedProfileDef",
  IfcIShapeProfileDef: "IfcParameterizedProfileDef",
  IfcLShapeProfileDef: "IfcParameterizedProfileDef",
  IfcRectangleProfileDef: "IfcParameterizedProfileDef",
  IfcRectangleHollowProfileDef: "IfcRectangleProfileDef",
  IfcRoundedRectangleProfileDef: "IfcRectangleProfileDef",
  IfcTrapeziumProfileDef: "IfcParameterizedProfileDef",
  IfcTShapeProfileDef: "IfcParameterizedProfileDef",
  IfcUShapeProfileDef: "IfcParameterizedProfileDef",
  IfcZShapeProfileDef: "IfcParameterizedProfileDef",
  IfcCompositeProfileDef: "IfcProfileDef",
  IfcDerivedProfileDef: "IfcProfileDef",
  IfcMirroredProfileDef: "IfcDerivedProfileDef",
  IfcLightDistributionData: null,
  IfcLightIntensityDistribution: null,
  IfcPresentationLayerAssignment: null,
  IfcPresentationLayerWithStyle: "IfcPresentationLayerAssignment",
  IfcBoxAlignment: null,
  IfcPresentationItem: null,
  IfcSurfaceTexture: "IfcPresentationItem",
  IfcBlobTexture: "IfcSurfaceTexture",
  IfcImageTexture: "IfcSurfaceTexture",
  IfcPixelTexture: "IfcSurfaceTexture",
  IfcColourSpecification: "IfcPresentationItem",
  IfcColourRgb: "IfcColourSpecification",
  IfcColourRgbList: "IfcPresentationItem",
  IfcCurveStyleFont: "IfcPresentationItem",
  IfcCurveStyleFontAndScaling: "IfcPresentationItem",
  IfcCurveStyleFontPattern: "IfcPresentationItem",
  IfcPreDefinedItem: "IfcPresentationItem",
  IfcPreDefinedColour: "IfcPreDefinedItem",
  IfcDraughtingPreDefinedColour: "IfcPreDefinedColour",
  IfcPreDefinedCurveFont: "IfcPreDefinedItem",
  IfcDraughtingPreDefinedCurveFont: "IfcPreDefinedCurveFont",
  IfcPreDefinedTextFont: "IfcPreDefinedItem",
  IfcTextStyleFontModel: "IfcPreDefinedTextFont",
  IfcIndexedColourMap: "IfcPresentationItem",
  IfcTextureCoordinate: "IfcPresentationItem",
  IfcIndexedTextureMap: "IfcTextureCoordinate",
  IfcIndexedTriangleTextureMap: "IfcIndexedTextureMap",
  IfcTextureCoordinateGenerator: "IfcTextureCoordinate",
  IfcTextureMap: "IfcTextureCoordinate",
  IfcSurfaceStyleLighting: "IfcPresentationItem",
  IfcSurfaceStyleRefraction: "IfcPresentationItem",
  IfcSurfaceStyleShading: "IfcPresentationItem",
  IfcSurfaceStyleRendering: "IfcSurfaceStyleShading",
  IfcSurfaceStyleWithTextures: "IfcPresentationItem",
  IfcTextStyleForDefinedFont: "IfcPresentationItem",
  IfcTextStyleTextModel: "IfcPresentationItem",
  IfcTextureVertex: "IfcPresentationItem",
  IfcTextureVertexList: "IfcPresentationItem",
  IfcPresentationStyle: null,
  IfcCurveStyle: "IfcPresentationStyle",
  IfcFillAreaStyle: "IfcPresentationStyle",
  IfcSurfaceStyle: "IfcPresentationStyle",
  IfcTextStyle: "IfcPresentationStyle",
  IfcExternalReference: null,
  IfcExternallyDefinedHatchStyle: "IfcExternalReference",
  IfcExternallyDefinedSurfaceStyle: "IfcExternalReference",
  IfcExternallyDefinedTextFont: "IfcExternalReference",
  IfcClassificationReference: "IfcExternalReference",
  IfcDocumentReference: "IfcExternalReference",
  IfcLibraryReference: "IfcExternalReference",
  IfcFontStyle: null,
  IfcFontVariant: null,
  IfcFontWeight: null,
  IfcNullStyle: null,
  IfcPresentableText: null,
  IfcPresentationStyleAssignment: null,
  IfcSpecularExponent: null,
  IfcSpecularRoughness: null,
  IfcTextAlignment: null,
  IfcTextDecoration: null,
  IfcTextFontName: null,
  IfcTextTransformation: null,
  IfcCardinalPointReference: null,
  IfcMaterialDefinition: null,
  IfcMaterial: "IfcMaterialDefinition",
  IfcMaterialConstituent: "IfcMaterialDefinition",
  IfcMaterialConstituentSet: "IfcMaterialDefinition",
  IfcMaterialLayer: "IfcMaterialDefinition",
  IfcMaterialLayerWithOffsets: "IfcMaterialLayer",
  IfcMaterialLayerSet: "IfcMaterialDefinition",
  IfcMaterialProfile: "IfcMaterialDefinition",
  IfcMaterialProfileWithOffsets: "IfcMaterialProfile",
  IfcMaterialProfileSet: "IfcMaterialDefinition",
  IfcMaterialClassificationRelationship: null,
  IfcMaterialUsageDefinition: null,
  IfcMaterialLayerSetUsage: "IfcMaterialUsageDefinition",
  IfcMaterialProfileSetUsage: "IfcMaterialUsageDefinition",
  IfcMaterialProfileSetUsageTapering: "IfcMaterialProfileSetUsage",
  IfcMaterialList: null,
  IfcPropertySetDefinitionSet: null,
  IfcLengthMeasure: null,
  IfcNonNegativeLengthMeasure: null,
  IfcPositiveLengthMeasure: null,
  IfcAbsorbedDoseMeasure: null,
  IfcAccelerationMeasure: null,
  IfcAmountOfSubstanceMeasure: null,
  IfcAngularVelocityMeasure: null,
  IfcAreaDensityMeasure: null,
  IfcAreaMeasure: null,
  IfcBinary: null,
  IfcBoolean: null,
  IfcComplexNumber: null,
  IfcCompoundPlaneAngleMeasure: null,
  IfcContextDependentMeasure: null,
  IfcNamedUnit: null,
  IfcContextDependentUnit: "IfcNamedUnit",
  IfcConversionBasedUnit: "IfcNamedUnit",
  IfcConversionBasedUnitWithOffset: "IfcConversionBasedUnit",
  IfcSIUnit: "IfcNamedUnit",
  IfcCountMeasure: null,
  IfcCurvatureMeasure: null,
  IfcDerivedUnit: null,
  IfcDerivedUnitElement: null,
  IfcDescriptiveMeasure: null,
  IfcDimensionalExponents: null,
  IfcDoseEquivalentMeasure: null,
  IfcDynamicViscosityMeasure: null,
  IfcElectricCapacitanceMeasure: null,
  IfcElectricChargeMeasure: null,
  IfcElectricConductanceMeasure: null,
  IfcElectricCurrentMeasure: null,
  IfcElectricResistanceMeasure: null,
  IfcElectricVoltageMeasure: null,
  IfcEnergyMeasure: null,
  IfcForceMeasure: null,
  IfcFrequencyMeasure: null,
  IfcHeatFluxDensityMeasure: null,
  IfcHeatingValueMeasure: null,
  IfcIdentifier: null,
  IfcIlluminanceMeasure: null,
  IfcInductanceMeasure: null,
  IfcInteger: null,
  IfcIntegerCountRateMeasure: null,
  IfcIonConcentrationMeasure: null,
  IfcIsothermalMoistureCapacityMeasure: null,
  IfcKinematicViscosityMeasure: null,
  IfcLabel: null,
  IfcLinearForceMeasure: null,
  IfcLinearMomentMeasure: null,
  IfcLinearStiffnessMeasure: null,
  IfcLinearVelocityMeasure: null,
  IfcLogical: null,
  IfcLuminousFluxMeasure: null,
  IfcLuminousIntensityDistributionMeasure: null,
  IfcLuminousIntensityMeasure: null,
  IfcMagneticFluxDensityMeasure: null,
  IfcMagneticFluxMeasure: null,
  IfcMassDensityMeasure: null,
  IfcMassFlowRateMeasure: null,
  IfcMassMeasure: null,
  IfcMassPerLengthMeasure: null,
  IfcMeasureWithUnit: null,
  IfcModulusOfElasticityMeasure: null,
  IfcModulusOfLinearSubgradeReactionMeasure: null,
  IfcModulusOfRotationalSubgradeReactionMeasure: null,
  IfcModulusOfSubgradeReactionMeasure: null,
  IfcMoistureDiffusivityMeasure: null,
  IfcMolecularWeightMeasure: null,
  IfcMomentOfInertiaMeasure: null,
  IfcMonetaryMeasure: null,
  IfcMonetaryUnit: null,
  IfcNormalisedRatioMeasure: null,
  IfcNumericMeasure: null,
  IfcParameterValue: null,
  IfcPHMeasure: null,
  IfcPlanarForceMeasure: null,
  IfcPlaneAngleMeasure: null,
  IfcPositiveInteger: null,
  IfcPositivePlaneAngleMeasure: null,
  IfcPositiveRatioMeasure: null,
  IfcPowerMeasure: null,
  IfcPressureMeasure: null,
  IfcRadioActivityMeasure: null,
  IfcRatioMeasure: null,
  IfcReal: null,
  IfcRotationalFrequencyMeasure: null,
  IfcRotationalMassMeasure: null,
  IfcRotationalStiffnessMeasure: null,
  IfcSectionalAreaIntegralMeasure: null,
  IfcSectionModulusMeasure: null,
  IfcShearModulusMeasure: null,
  IfcSolidAngleMeasure: null,
  IfcSoundPowerLevelMeasure: null,
  IfcSoundPowerMeasure: null,
  IfcSoundPressureLevelMeasure: null,
  IfcSoundPressureMeasure: null,
  IfcSpecificHeatCapacityMeasure: null,
  IfcTemperatureGradientMeasure: null,
  IfcTemperatureRateOfChangeMeasure: null,
  IfcText: null,
  IfcThermalAdmittanceMeasure: null,
  IfcThermalConductivityMeasure: null,
  IfcThermalExpansionCoefficientMeasure: null,
  IfcThermalResistanceMeasure: null,
  IfcThermalTransmittanceMeasure: null,
  IfcThermodynamicTemperatureMeasure: null,
  IfcTimeMeasure: null,
  IfcTorqueMeasure: null,
  IfcUnitAssignment: null,
  IfcVaporPermeabilityMeasure: null,
  IfcVolumeMeasure: null,
  IfcVolumetricFlowRateMeasure: null,
  IfcWarpingConstantMeasure: null,
  IfcWarpingMomentMeasure: null,
  IfcArcIndex: null,
  IfcDimensionCount: null,
  IfcLineIndex: null,
  IfcRepresentationMap: null,
  IfcConnectionGeometry: null,
  IfcConnectionCurveGeometry: "IfcConnectionGeometry",
  IfcConnectionPointGeometry: "IfcConnectionGeometry",
  IfcConnectionPointEccentricity: "IfcConnectionPointGeometry",
  IfcConnectionSurfaceGeometry: "IfcConnectionGeometry",
  IfcConnectionVolumeGeometry: "IfcConnectionGeometry",
  IfcGridAxis: null,
  IfcObjectPlacement: null,
  IfcGridPlacement: "IfcObjectPlacement",
  IfcLinearPlacement: "IfcObjectPlacement",
  IfcLocalPlacement: "IfcObjectPlacement",
  IfcVirtualGridIntersection: null,
  IfcExternalInformation: null,
  IfcClassification: "IfcExternalInformation",
  IfcDocumentInformation: "IfcExternalInformation",
  IfcLibraryInformation: "IfcExternalInformation",
  IfcLanguageId: null,
  IfcURIReference: null,
  IfcDate: null,
  IfcDateTime: null,
  IfcDayInMonthNumber: null,
  IfcDayInWeekNumber: null,
  IfcDuration: null,
  IfcSchedulingTime: null,
  IfcEventTime: "IfcSchedulingTime",
  IfcLagTime: "IfcSchedulingTime",
  IfcResourceTime: "IfcSchedulingTime",
  IfcTaskTime: "IfcSchedulingTime",
  IfcTaskTimeRecurring: "IfcTaskTime",
  IfcWorkTime: "IfcSchedulingTime",
  IfcTimeSeries: null,
  IfcIrregularTimeSeries: "IfcTimeSeries",
  IfcRegularTimeSeries: "IfcTimeSeries",
  IfcIrregularTimeSeriesValue: null,
  IfcMonthInYearNumber: null,
  IfcRecurrencePattern: null,
  IfcTime: null,
  IfcTimePeriod: null,
  IfcTimeSeriesValue: null,
  IfcTimeStamp: null,
  IfcAppliedValue: null,
  IfcCostValue: "IfcAppliedValue",
  IfcConstraint: null,
  IfcMetric: "IfcConstraint",
  IfcObjective: "IfcConstraint",
  IfcReference: null,
  IfcApproval: null,
  IfcActorRole: null,
  IfcAddress: null,
  IfcPostalAddress: "IfcAddress",
  IfcTelecomAddress: "IfcAddress",
  IfcOrganization: null,
  IfcPerson: null,
  IfcPersonAndOrganization: null,
  IfcDraughtingCallout: "IfcGeometricRepresentationItem",
  IfcDimensionCurveDirectedCallout: "IfcDraughtingCallout",
  IfcAngularDimension: "IfcDimensionCurveDirectedCallout",
  IfcDiameterDimension: "IfcDimensionCurveDirectedCallout",
  IfcDraughtingCalloutRelationship: null,
  IfcDimensionCalloutRelationship: "IfcDraughtingCalloutRelationship",
  IfcAnnotationOccurrence: "IfcStyledItem",
  IfcAnnotationCurveOccurrence: "IfcAnnotationOccurrence",
  IfcDimensionCurve: "IfcAnnotationCurveOccurrence",
  IfcAnnotationSymbolOccurrence: "IfcAnnotationOccurrence",
  IfcTerminatorSymbol: "IfcAnnotationSymbolOccurrence",
  IfcDimensionCurveTerminator: "IfcTerminatorSymbol",
  IfcDimensionPair: "IfcDraughtingCalloutRelationship",
  IfcLinearDimension: "IfcDimensionCurveDirectedCallout",
  IfcPreDefinedSymbol: "IfcPreDefinedItem",
  IfcPreDefinedDimensionSymbol: "IfcPreDefinedSymbol",
  IfcPreDefinedPointMarkerSymbol: "IfcPreDefinedSymbol",
  IfcPreDefinedTerminatorSymbol: "IfcPreDefinedSymbol",
  IfcProjectionCurve: "IfcAnnotationCurveOccurrence",
  IfcRadiusDimension: "IfcDimensionCurveDirectedCallout",
  IfcStructuredDimensionCallout: "IfcDraughtingCallout",
  IfcRelAssociatesProfileProperties: "IfcRelAssociates",
  IfcRelConnectsStructuralElement: "IfcRelConnects",
  IfcStructuralLinearActionVarying: "IfcStructuralLinearAction",
  IfcStructuralPlanarActionVarying: "IfcStructuralPlanarAction",
  IfcGeneralProfileProperties: "IfcProfileProperties",
  IfcRibPlateProfileProperties: "IfcProfileProperties",
  IfcStructuralProfileProperties: "IfcGeneralProfileProperties",
  IfcStructuralSteelProfileProperties: "IfcStructuralProfileProperties",
  IfcRelAssignsTasks: "IfcRelAssignsToControl",
  IfcScheduleTimeControl: "IfcControl",
  IfcExtendedMaterialProperties: "IfcMaterialProperties",
  IfcFuelProperties: "IfcMaterialProperties",
  IfcGeneralMaterialProperties: "IfcMaterialProperties",
  IfcHygroscopicMaterialProperties: "IfcMaterialProperties",
  IfcMechanicalMaterialProperties: "IfcMaterialProperties",
  IfcMechanicalConcreteMaterialProperties: "IfcMechanicalMaterialProperties",
  IfcMechanicalSteelMaterialProperties: "IfcMechanicalMaterialProperties",
  IfcOpticalMaterialProperties: "IfcMaterialProperties",
  IfcProductsOfCombustionProperties: "IfcMaterialProperties",
  IfcRelaxation: null,
  IfcThermalMaterialProperties: "IfcMaterialProperties",
  IfcWaterProperties: "IfcMaterialProperties",
  IfcTimeSeriesReferenceRelationship: null,
  IfcEnergyProperties: "IfcPropertySetDefinition",
  IfcElectricalBaseProperties: "IfcEnergyProperties",
  IfcFluidFlowProperties: "IfcPropertySetDefinition",
  IfcSoundProperties: "IfcPropertySetDefinition",
  IfcSoundValue: "IfcPropertySetDefinition",
  IfcSpaceThermalLoadProperties: "IfcPropertySetDefinition",
  IfcEdgeFeature: "IfcFeatureElementSubtraction",
  IfcChamferEdgeFeature: "IfcEdgeFeature",
  IfcRoundedEdgeFeature: "IfcEdgeFeature",
  IfcProjectOrderRecord: "IfcControl",
  IfcRelAssignsToProjectOrder: "IfcRelAssignsToControl",
  IfcRelAssociatesAppliedValue: "IfcRelAssociates",
  IfcRelSchedulesCostItems: "IfcRelAssignsToControl",
  IfcDraughtingPreDefinedTextFont: "IfcPreDefinedTextFont",
  IfcBuildingElementComponent: "IfcBuildingElement",
  IfcFillAreaStyleTileSymbolWithStyle: "IfcGeometricRepresentationItem",
  IfcOneDirectionRepeatFactor: "IfcGeometricRepresentationItem",
  IfcSymbolStyle: "IfcPresentationStyle",
  IfcTextStyleWithBoxCharacteristics: null,
  IfcTwoDirectionRepeatFactor: "IfcOneDirectionRepeatFactor",
  IfcRelOccupiesSpaces: "IfcRelAssignsToActor",
  IfcServiceLife: "IfcControl",
  IfcServiceLifeFactor: "IfcPropertySetDefinition",
  IfcCraneRailAShapeProfileDef: "IfcParameterizedProfileDef",
  IfcCraneRailFShapeProfileDef: "IfcParameterizedProfileDef",
  IfcAnnotationFillAreaOccurrence: "IfcAnnotationOccurrence",
  IfcAnnotationSurface: "IfcGeometricRepresentationItem",
  IfcAnnotationSurfaceOccurrence: "IfcAnnotationOccurrence",
  IfcAnnotationTextOccurrence: "IfcAnnotationOccurrence",
  IfcDefinedSymbol: "IfcGeometricRepresentationItem",
  IfcExternallyDefinedSymbol: "IfcExternalReference",
  IfcVertexBasedTextureMap: null,
  IfcElectricalElement: "IfcElement",
  IfcEquipmentElement: "IfcElement",
  IfcRelOverridesProperties: "IfcRelDefinesByProperties",
  IfcGasTerminalType: "IfcFlowTerminalType",
  Ifc2DCompositeCurve: "IfcCompositeCurve",
  IfcBezierCurve: "IfcBSplineCurve",
  IfcRationalBezierCurve: "IfcBezierCurve",
  IfcConnectionPortGeometry: "IfcConnectionGeometry",
  IfcCondition: "IfcGroup",
  IfcConditionCriterion: "IfcControl",
  IfcEquipmentStandard: "IfcControl",
  IfcFurnitureStandard: "IfcControl",
  IfcMove: "IfcTask",
  IfcOrderAction: "IfcTask",
  IfcClassificationItem: null,
  IfcClassificationItemRelationship: null,
  IfcClassificationNotation: null,
  IfcClassificationNotationFacet: null,
  IfcDocumentElectronicFormat: null,
  IfcElectricalCircuit: "IfcSystem",
  IfcElectricDistributionPoint: "IfcFlowController",
  IfcElectricHeaterType: "IfcFlowTerminalType",
  IfcCalendarDate: null,
  IfcCoordinatedUniversalTimeOffset: null,
  IfcDateAndTime: null,
  IfcDaylightSavingHour: null,
  IfcHourInDay: null,
  IfcLocalTime: null,
  IfcMinuteInHour: null,
  IfcSecondInMinute: null,
  IfcYearNumber: null,
  IfcAppliedValueRelationship: null,
  IfcEnvironmentalImpactValue: "IfcAppliedValue",
  IfcReferencesValueDocument: null,
  IfcTimeSeriesSchedule: "IfcControl",
  IfcConstraintAggregationRelationship: null,
  IfcConstraintClassificationRelationship: null,
  IfcConstraintRelationship: null,
  IfcPropertyConstraintRelationship: null,
  IfcRelInteractionRequirements: "IfcRelConnects",
  IfcSpaceProgram: "IfcControl",
  IfcApprovalActorRelationship: null,
  IfcApprovalPropertyRelationship: null,
};

/**
 * Names that exist only in IFC2X3. They are part of
 * `IFC_ENTITY_PARENTS` so a 2x3 export is not gutted, but a rule written
 * against one will not match anything in an IFC4 model.
 */
export const IFC_LEGACY_TYPE_NAMES: readonly string[] = [
  "Ifc2DCompositeCurve",
  "IfcAngularDimension",
  "IfcAnnotationCurveOccurrence",
  "IfcAnnotationFillAreaOccurrence",
  "IfcAnnotationOccurrence",
  "IfcAnnotationSurface",
  "IfcAnnotationSurfaceOccurrence",
  "IfcAnnotationSymbolOccurrence",
  "IfcAnnotationTextOccurrence",
  "IfcAppliedValueRelationship",
  "IfcApprovalActorRelationship",
  "IfcApprovalPropertyRelationship",
  "IfcBezierCurve",
  "IfcBuildingElementComponent",
  "IfcCalendarDate",
  "IfcChamferEdgeFeature",
  "IfcClassificationItem",
  "IfcClassificationItemRelationship",
  "IfcClassificationNotation",
  "IfcClassificationNotationFacet",
  "IfcCondition",
  "IfcConditionCriterion",
  "IfcConnectionPortGeometry",
  "IfcConstraintAggregationRelationship",
  "IfcConstraintClassificationRelationship",
  "IfcConstraintRelationship",
  "IfcCoordinatedUniversalTimeOffset",
  "IfcCraneRailAShapeProfileDef",
  "IfcCraneRailFShapeProfileDef",
  "IfcDateAndTime",
  "IfcDaylightSavingHour",
  "IfcDefinedSymbol",
  "IfcDiameterDimension",
  "IfcDimensionCalloutRelationship",
  "IfcDimensionCurve",
  "IfcDimensionCurveDirectedCallout",
  "IfcDimensionCurveTerminator",
  "IfcDimensionPair",
  "IfcDocumentElectronicFormat",
  "IfcDraughtingCallout",
  "IfcDraughtingCalloutRelationship",
  "IfcDraughtingPreDefinedTextFont",
  "IfcEdgeFeature",
  "IfcElectricDistributionPoint",
  "IfcElectricHeaterType",
  "IfcElectricalBaseProperties",
  "IfcElectricalCircuit",
  "IfcElectricalElement",
  "IfcEnergyProperties",
  "IfcEnvironmentalImpactValue",
  "IfcEquipmentElement",
  "IfcEquipmentStandard",
  "IfcExtendedMaterialProperties",
  "IfcExternallyDefinedSymbol",
  "IfcFillAreaStyleTileSymbolWithStyle",
  "IfcFluidFlowProperties",
  "IfcFuelProperties",
  "IfcFurnitureStandard",
  "IfcGasTerminalType",
  "IfcGeneralMaterialProperties",
  "IfcGeneralProfileProperties",
  "IfcHourInDay",
  "IfcHygroscopicMaterialProperties",
  "IfcLinearDimension",
  "IfcLocalTime",
  "IfcMechanicalConcreteMaterialProperties",
  "IfcMechanicalMaterialProperties",
  "IfcMechanicalSteelMaterialProperties",
  "IfcMinuteInHour",
  "IfcMove",
  "IfcOneDirectionRepeatFactor",
  "IfcOpticalMaterialProperties",
  "IfcOrderAction",
  "IfcPreDefinedDimensionSymbol",
  "IfcPreDefinedPointMarkerSymbol",
  "IfcPreDefinedSymbol",
  "IfcPreDefinedTerminatorSymbol",
  "IfcProductsOfCombustionProperties",
  "IfcProjectOrderRecord",
  "IfcProjectionCurve",
  "IfcPropertyConstraintRelationship",
  "IfcRadiusDimension",
  "IfcRationalBezierCurve",
  "IfcReferencesValueDocument",
  "IfcRelAssignsTasks",
  "IfcRelAssignsToProjectOrder",
  "IfcRelAssociatesAppliedValue",
  "IfcRelAssociatesProfileProperties",
  "IfcRelConnectsStructuralElement",
  "IfcRelInteractionRequirements",
  "IfcRelOccupiesSpaces",
  "IfcRelOverridesProperties",
  "IfcRelSchedulesCostItems",
  "IfcRelaxation",
  "IfcRibPlateProfileProperties",
  "IfcRoundedEdgeFeature",
  "IfcScheduleTimeControl",
  "IfcSecondInMinute",
  "IfcServiceLife",
  "IfcServiceLifeFactor",
  "IfcSoundProperties",
  "IfcSoundValue",
  "IfcSpaceProgram",
  "IfcSpaceThermalLoadProperties",
  "IfcStructuralLinearActionVarying",
  "IfcStructuralPlanarActionVarying",
  "IfcStructuralProfileProperties",
  "IfcStructuralSteelProfileProperties",
  "IfcStructuredDimensionCallout",
  "IfcSymbolStyle",
  "IfcTerminatorSymbol",
  "IfcTextStyleWithBoxCharacteristics",
  "IfcThermalMaterialProperties",
  "IfcTimeSeriesReferenceRelationship",
  "IfcTimeSeriesSchedule",
  "IfcTwoDirectionRepeatFactor",
  "IfcVertexBasedTextureMap",
  "IfcWaterProperties",
  "IfcYearNumber",
];

/**
 * Upper-case names of every entity in IFC4 or IFC2X3,
 * product or not. Membership answers "is this type known to this build at
 * all?"; it says nothing about whether the type is worth keeping.
 */
export const IFC_RECOGNISED_ENTITY_NAMES: readonly string[] = `
IFC2DCOMPOSITECURVE
IFCABSORBEDDOSEMEASURE
IFCACCELERATIONMEASURE
IFCACTIONREQUEST
IFCACTOR
IFCACTORROLE
IFCACTUATOR
IFCACTUATORTYPE
IFCADDRESS
IFCADVANCEDBREP
IFCADVANCEDBREPWITHVOIDS
IFCADVANCEDFACE
IFCAIRTERMINAL
IFCAIRTERMINALBOX
IFCAIRTERMINALBOXTYPE
IFCAIRTERMINALTYPE
IFCAIRTOAIRHEATRECOVERY
IFCAIRTOAIRHEATRECOVERYTYPE
IFCALARM
IFCALARMTYPE
IFCALIGNMENT
IFCALIGNMENT2DHORIZONTAL
IFCALIGNMENT2DHORIZONTALSEGMENT
IFCALIGNMENT2DSEGMENT
IFCALIGNMENT2DVERSEGCIRCULARARC
IFCALIGNMENT2DVERSEGLINE
IFCALIGNMENT2DVERSEGPARABOLICARC
IFCALIGNMENT2DVERTICAL
IFCALIGNMENT2DVERTICALSEGMENT
IFCALIGNMENTCURVE
IFCAMOUNTOFSUBSTANCEMEASURE
IFCANGULARDIMENSION
IFCANGULARVELOCITYMEASURE
IFCANNOTATION
IFCANNOTATIONCURVEOCCURRENCE
IFCANNOTATIONFILLAREA
IFCANNOTATIONFILLAREAOCCURRENCE
IFCANNOTATIONOCCURRENCE
IFCANNOTATIONSURFACE
IFCANNOTATIONSURFACEOCCURRENCE
IFCANNOTATIONSYMBOLOCCURRENCE
IFCANNOTATIONTEXTOCCURRENCE
IFCAPPLICATION
IFCAPPLIEDVALUE
IFCAPPLIEDVALUERELATIONSHIP
IFCAPPROVAL
IFCAPPROVALACTORRELATIONSHIP
IFCAPPROVALPROPERTYRELATIONSHIP
IFCAPPROVALRELATIONSHIP
IFCARBITRARYCLOSEDPROFILEDEF
IFCARBITRARYOPENPROFILEDEF
IFCARBITRARYPROFILEDEFWITHVOIDS
IFCARCINDEX
IFCAREADENSITYMEASURE
IFCAREAMEASURE
IFCASSET
IFCASYMMETRICISHAPEPROFILEDEF
IFCAUDIOVISUALAPPLIANCE
IFCAUDIOVISUALAPPLIANCETYPE
IFCAXIS1PLACEMENT
IFCAXIS2PLACEMENT2D
IFCAXIS2PLACEMENT3D
IFCBEAM
IFCBEAMSTANDARDCASE
IFCBEAMTYPE
IFCBEZIERCURVE
IFCBINARY
IFCBLOBTEXTURE
IFCBLOCK
IFCBOILER
IFCBOILERTYPE
IFCBOOLEAN
IFCBOOLEANCLIPPINGRESULT
IFCBOOLEANRESULT
IFCBOUNDARYCONDITION
IFCBOUNDARYCURVE
IFCBOUNDARYEDGECONDITION
IFCBOUNDARYFACECONDITION
IFCBOUNDARYNODECONDITION
IFCBOUNDARYNODECONDITIONWARPING
IFCBOUNDEDCURVE
IFCBOUNDEDSURFACE
IFCBOUNDINGBOX
IFCBOXALIGNMENT
IFCBOXEDHALFSPACE
IFCBSPLINECURVE
IFCBSPLINECURVEWITHKNOTS
IFCBSPLINESURFACE
IFCBSPLINESURFACEWITHKNOTS
IFCBUILDING
IFCBUILDINGELEMENT
IFCBUILDINGELEMENTCOMPONENT
IFCBUILDINGELEMENTPART
IFCBUILDINGELEMENTPARTTYPE
IFCBUILDINGELEMENTPROXY
IFCBUILDINGELEMENTPROXYTYPE
IFCBUILDINGELEMENTTYPE
IFCBUILDINGSTOREY
IFCBUILDINGSYSTEM
IFCBURNER
IFCBURNERTYPE
IFCCABLECARRIERFITTING
IFCCABLECARRIERFITTINGTYPE
IFCCABLECARRIERSEGMENT
IFCCABLECARRIERSEGMENTTYPE
IFCCABLEFITTING
IFCCABLEFITTINGTYPE
IFCCABLESEGMENT
IFCCABLESEGMENTTYPE
IFCCALENDARDATE
IFCCARDINALPOINTREFERENCE
IFCCARTESIANPOINT
IFCCARTESIANPOINTLIST
IFCCARTESIANPOINTLIST2D
IFCCARTESIANPOINTLIST3D
IFCCARTESIANTRANSFORMATIONOPERATOR
IFCCARTESIANTRANSFORMATIONOPERATOR2D
IFCCARTESIANTRANSFORMATIONOPERATOR2DNONUNIFORM
IFCCARTESIANTRANSFORMATIONOPERATOR3D
IFCCARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM
IFCCENTERLINEPROFILEDEF
IFCCHAMFEREDGEFEATURE
IFCCHILLER
IFCCHILLERTYPE
IFCCHIMNEY
IFCCHIMNEYTYPE
IFCCIRCLE
IFCCIRCLEHOLLOWPROFILEDEF
IFCCIRCLEPROFILEDEF
IFCCIRCULARARCSEGMENT2D
IFCCIVILELEMENT
IFCCIVILELEMENTTYPE
IFCCLASSIFICATION
IFCCLASSIFICATIONITEM
IFCCLASSIFICATIONITEMRELATIONSHIP
IFCCLASSIFICATIONNOTATION
IFCCLASSIFICATIONNOTATIONFACET
IFCCLASSIFICATIONREFERENCE
IFCCLOSEDSHELL
IFCCOIL
IFCCOILTYPE
IFCCOLOURRGB
IFCCOLOURRGBLIST
IFCCOLOURSPECIFICATION
IFCCOLUMN
IFCCOLUMNSTANDARDCASE
IFCCOLUMNTYPE
IFCCOMMUNICATIONSAPPLIANCE
IFCCOMMUNICATIONSAPPLIANCETYPE
IFCCOMPLEXNUMBER
IFCCOMPLEXPROPERTY
IFCCOMPLEXPROPERTYTEMPLATE
IFCCOMPOSITECURVE
IFCCOMPOSITECURVEONSURFACE
IFCCOMPOSITECURVESEGMENT
IFCCOMPOSITEPROFILEDEF
IFCCOMPOUNDPLANEANGLEMEASURE
IFCCOMPRESSOR
IFCCOMPRESSORTYPE
IFCCONDENSER
IFCCONDENSERTYPE
IFCCONDITION
IFCCONDITIONCRITERION
IFCCONIC
IFCCONNECTEDFACESET
IFCCONNECTIONCURVEGEOMETRY
IFCCONNECTIONGEOMETRY
IFCCONNECTIONPOINTECCENTRICITY
IFCCONNECTIONPOINTGEOMETRY
IFCCONNECTIONPORTGEOMETRY
IFCCONNECTIONSURFACEGEOMETRY
IFCCONNECTIONVOLUMEGEOMETRY
IFCCONSTRAINT
IFCCONSTRAINTAGGREGATIONRELATIONSHIP
IFCCONSTRAINTCLASSIFICATIONRELATIONSHIP
IFCCONSTRAINTRELATIONSHIP
IFCCONSTRUCTIONEQUIPMENTRESOURCE
IFCCONSTRUCTIONEQUIPMENTRESOURCETYPE
IFCCONSTRUCTIONMATERIALRESOURCE
IFCCONSTRUCTIONMATERIALRESOURCETYPE
IFCCONSTRUCTIONPRODUCTRESOURCE
IFCCONSTRUCTIONPRODUCTRESOURCETYPE
IFCCONSTRUCTIONRESOURCE
IFCCONSTRUCTIONRESOURCETYPE
IFCCONTEXT
IFCCONTEXTDEPENDENTMEASURE
IFCCONTEXTDEPENDENTUNIT
IFCCONTROL
IFCCONTROLLER
IFCCONTROLLERTYPE
IFCCONVERSIONBASEDUNIT
IFCCONVERSIONBASEDUNITWITHOFFSET
IFCCOOLEDBEAM
IFCCOOLEDBEAMTYPE
IFCCOOLINGTOWER
IFCCOOLINGTOWERTYPE
IFCCOORDINATEDUNIVERSALTIMEOFFSET
IFCCOORDINATEOPERATION
IFCCOORDINATEREFERENCESYSTEM
IFCCOSTITEM
IFCCOSTSCHEDULE
IFCCOSTVALUE
IFCCOUNTMEASURE
IFCCOVERING
IFCCOVERINGTYPE
IFCCRANERAILASHAPEPROFILEDEF
IFCCRANERAILFSHAPEPROFILEDEF
IFCCREWRESOURCE
IFCCREWRESOURCETYPE
IFCCSGPRIMITIVE3D
IFCCSGSOLID
IFCCSHAPEPROFILEDEF
IFCCURRENCYRELATIONSHIP
IFCCURTAINWALL
IFCCURTAINWALLTYPE
IFCCURVATUREMEASURE
IFCCURVE
IFCCURVEBOUNDEDPLANE
IFCCURVEBOUNDEDSURFACE
IFCCURVESEGMENT2D
IFCCURVESTYLE
IFCCURVESTYLEFONT
IFCCURVESTYLEFONTANDSCALING
IFCCURVESTYLEFONTPATTERN
IFCCYLINDRICALSURFACE
IFCDAMPER
IFCDAMPERTYPE
IFCDATE
IFCDATEANDTIME
IFCDATETIME
IFCDAYINMONTHNUMBER
IFCDAYINWEEKNUMBER
IFCDAYLIGHTSAVINGHOUR
IFCDEFINEDSYMBOL
IFCDERIVEDPROFILEDEF
IFCDERIVEDUNIT
IFCDERIVEDUNITELEMENT
IFCDESCRIPTIVEMEASURE
IFCDIAMETERDIMENSION
IFCDIMENSIONALEXPONENTS
IFCDIMENSIONCALLOUTRELATIONSHIP
IFCDIMENSIONCOUNT
IFCDIMENSIONCURVE
IFCDIMENSIONCURVEDIRECTEDCALLOUT
IFCDIMENSIONCURVETERMINATOR
IFCDIMENSIONPAIR
IFCDIRECTION
IFCDISCRETEACCESSORY
IFCDISCRETEACCESSORYTYPE
IFCDISTANCEEXPRESSION
IFCDISTRIBUTIONCHAMBERELEMENT
IFCDISTRIBUTIONCHAMBERELEMENTTYPE
IFCDISTRIBUTIONCIRCUIT
IFCDISTRIBUTIONCONTROLELEMENT
IFCDISTRIBUTIONCONTROLELEMENTTYPE
IFCDISTRIBUTIONELEMENT
IFCDISTRIBUTIONELEMENTTYPE
IFCDISTRIBUTIONFLOWELEMENT
IFCDISTRIBUTIONFLOWELEMENTTYPE
IFCDISTRIBUTIONPORT
IFCDISTRIBUTIONSYSTEM
IFCDOCUMENTELECTRONICFORMAT
IFCDOCUMENTINFORMATION
IFCDOCUMENTINFORMATIONRELATIONSHIP
IFCDOCUMENTREFERENCE
IFCDOOR
IFCDOORLININGPROPERTIES
IFCDOORPANELPROPERTIES
IFCDOORSTANDARDCASE
IFCDOORSTYLE
IFCDOORTYPE
IFCDOSEEQUIVALENTMEASURE
IFCDRAUGHTINGCALLOUT
IFCDRAUGHTINGCALLOUTRELATIONSHIP
IFCDRAUGHTINGPREDEFINEDCOLOUR
IFCDRAUGHTINGPREDEFINEDCURVEFONT
IFCDRAUGHTINGPREDEFINEDTEXTFONT
IFCDUCTFITTING
IFCDUCTFITTINGTYPE
IFCDUCTSEGMENT
IFCDUCTSEGMENTTYPE
IFCDUCTSILENCER
IFCDUCTSILENCERTYPE
IFCDURATION
IFCDYNAMICVISCOSITYMEASURE
IFCEDGE
IFCEDGECURVE
IFCEDGEFEATURE
IFCEDGELOOP
IFCELECTRICALBASEPROPERTIES
IFCELECTRICALCIRCUIT
IFCELECTRICALELEMENT
IFCELECTRICAPPLIANCE
IFCELECTRICAPPLIANCETYPE
IFCELECTRICCAPACITANCEMEASURE
IFCELECTRICCHARGEMEASURE
IFCELECTRICCONDUCTANCEMEASURE
IFCELECTRICCURRENTMEASURE
IFCELECTRICDISTRIBUTIONBOARD
IFCELECTRICDISTRIBUTIONBOARDTYPE
IFCELECTRICDISTRIBUTIONPOINT
IFCELECTRICFLOWSTORAGEDEVICE
IFCELECTRICFLOWSTORAGEDEVICETYPE
IFCELECTRICGENERATOR
IFCELECTRICGENERATORTYPE
IFCELECTRICHEATERTYPE
IFCELECTRICMOTOR
IFCELECTRICMOTORTYPE
IFCELECTRICRESISTANCEMEASURE
IFCELECTRICTIMECONTROL
IFCELECTRICTIMECONTROLTYPE
IFCELECTRICVOLTAGEMEASURE
IFCELEMENT
IFCELEMENTARYSURFACE
IFCELEMENTASSEMBLY
IFCELEMENTASSEMBLYTYPE
IFCELEMENTCOMPONENT
IFCELEMENTCOMPONENTTYPE
IFCELEMENTQUANTITY
IFCELEMENTTYPE
IFCELLIPSE
IFCELLIPSEPROFILEDEF
IFCENERGYCONVERSIONDEVICE
IFCENERGYCONVERSIONDEVICETYPE
IFCENERGYMEASURE
IFCENERGYPROPERTIES
IFCENGINE
IFCENGINETYPE
IFCENVIRONMENTALIMPACTVALUE
IFCEQUIPMENTELEMENT
IFCEQUIPMENTSTANDARD
IFCEVAPORATIVECOOLER
IFCEVAPORATIVECOOLERTYPE
IFCEVAPORATOR
IFCEVAPORATORTYPE
IFCEVENT
IFCEVENTTIME
IFCEVENTTYPE
IFCEXTENDEDMATERIALPROPERTIES
IFCEXTENDEDPROPERTIES
IFCEXTERNALINFORMATION
IFCEXTERNALLYDEFINEDHATCHSTYLE
IFCEXTERNALLYDEFINEDSURFACESTYLE
IFCEXTERNALLYDEFINEDSYMBOL
IFCEXTERNALLYDEFINEDTEXTFONT
IFCEXTERNALREFERENCE
IFCEXTERNALREFERENCERELATIONSHIP
IFCEXTERNALSPATIALELEMENT
IFCEXTERNALSPATIALSTRUCTUREELEMENT
IFCEXTRUDEDAREASOLID
IFCEXTRUDEDAREASOLIDTAPERED
IFCFACE
IFCFACEBASEDSURFACEMODEL
IFCFACEBOUND
IFCFACEOUTERBOUND
IFCFACESURFACE
IFCFACETEDBREP
IFCFACETEDBREPWITHVOIDS
IFCFAILURECONNECTIONCONDITION
IFCFAN
IFCFANTYPE
IFCFASTENER
IFCFASTENERTYPE
IFCFEATUREELEMENT
IFCFEATUREELEMENTADDITION
IFCFEATUREELEMENTSUBTRACTION
IFCFILLAREASTYLE
IFCFILLAREASTYLEHATCHING
IFCFILLAREASTYLETILES
IFCFILLAREASTYLETILESYMBOLWITHSTYLE
IFCFILTER
IFCFILTERTYPE
IFCFIRESUPPRESSIONTERMINAL
IFCFIRESUPPRESSIONTERMINALTYPE
IFCFIXEDREFERENCESWEPTAREASOLID
IFCFLOWCONTROLLER
IFCFLOWCONTROLLERTYPE
IFCFLOWFITTING
IFCFLOWFITTINGTYPE
IFCFLOWINSTRUMENT
IFCFLOWINSTRUMENTTYPE
IFCFLOWMETER
IFCFLOWMETERTYPE
IFCFLOWMOVINGDEVICE
IFCFLOWMOVINGDEVICETYPE
IFCFLOWSEGMENT
IFCFLOWSEGMENTTYPE
IFCFLOWSTORAGEDEVICE
IFCFLOWSTORAGEDEVICETYPE
IFCFLOWTERMINAL
IFCFLOWTERMINALTYPE
IFCFLOWTREATMENTDEVICE
IFCFLOWTREATMENTDEVICETYPE
IFCFLUIDFLOWPROPERTIES
IFCFONTSTYLE
IFCFONTVARIANT
IFCFONTWEIGHT
IFCFOOTING
IFCFOOTINGTYPE
IFCFORCEMEASURE
IFCFREQUENCYMEASURE
IFCFUELPROPERTIES
IFCFURNISHINGELEMENT
IFCFURNISHINGELEMENTTYPE
IFCFURNITURE
IFCFURNITURESTANDARD
IFCFURNITURETYPE
IFCGASTERMINALTYPE
IFCGENERALMATERIALPROPERTIES
IFCGENERALPROFILEPROPERTIES
IFCGEOGRAPHICELEMENT
IFCGEOGRAPHICELEMENTTYPE
IFCGEOMETRICCURVESET
IFCGEOMETRICREPRESENTATIONCONTEXT
IFCGEOMETRICREPRESENTATIONITEM
IFCGEOMETRICREPRESENTATIONSUBCONTEXT
IFCGEOMETRICSET
IFCGLOBALLYUNIQUEID
IFCGRID
IFCGRIDAXIS
IFCGRIDPLACEMENT
IFCGROUP
IFCHALFSPACESOLID
IFCHEATEXCHANGER
IFCHEATEXCHANGERTYPE
IFCHEATFLUXDENSITYMEASURE
IFCHEATINGVALUEMEASURE
IFCHOURINDAY
IFCHUMIDIFIER
IFCHUMIDIFIERTYPE
IFCHYGROSCOPICMATERIALPROPERTIES
IFCIDENTIFIER
IFCILLUMINANCEMEASURE
IFCIMAGETEXTURE
IFCINDEXEDCOLOURMAP
IFCINDEXEDPOLYCURVE
IFCINDEXEDPOLYGONALFACE
IFCINDEXEDPOLYGONALFACEWITHVOIDS
IFCINDEXEDTEXTUREMAP
IFCINDEXEDTRIANGLETEXTUREMAP
IFCINDUCTANCEMEASURE
IFCINTEGER
IFCINTEGERCOUNTRATEMEASURE
IFCINTERCEPTOR
IFCINTERCEPTORTYPE
IFCINTERSECTIONCURVE
IFCINVENTORY
IFCIONCONCENTRATIONMEASURE
IFCIRREGULARTIMESERIES
IFCIRREGULARTIMESERIESVALUE
IFCISHAPEPROFILEDEF
IFCISOTHERMALMOISTURECAPACITYMEASURE
IFCJUNCTIONBOX
IFCJUNCTIONBOXTYPE
IFCKINEMATICVISCOSITYMEASURE
IFCLABEL
IFCLABORRESOURCE
IFCLABORRESOURCETYPE
IFCLAGTIME
IFCLAMP
IFCLAMPTYPE
IFCLANGUAGEID
IFCLENGTHMEASURE
IFCLIBRARYINFORMATION
IFCLIBRARYREFERENCE
IFCLIGHTDISTRIBUTIONDATA
IFCLIGHTFIXTURE
IFCLIGHTFIXTURETYPE
IFCLIGHTINTENSITYDISTRIBUTION
IFCLIGHTSOURCE
IFCLIGHTSOURCEAMBIENT
IFCLIGHTSOURCEDIRECTIONAL
IFCLIGHTSOURCEGONIOMETRIC
IFCLIGHTSOURCEPOSITIONAL
IFCLIGHTSOURCESPOT
IFCLINE
IFCLINEARDIMENSION
IFCLINEARFORCEMEASURE
IFCLINEARMOMENTMEASURE
IFCLINEARPLACEMENT
IFCLINEARPOSITIONINGELEMENT
IFCLINEARSTIFFNESSMEASURE
IFCLINEARVELOCITYMEASURE
IFCLINEINDEX
IFCLINESEGMENT2D
IFCLOCALPLACEMENT
IFCLOCALTIME
IFCLOGICAL
IFCLOOP
IFCLSHAPEPROFILEDEF
IFCLUMINOUSFLUXMEASURE
IFCLUMINOUSINTENSITYDISTRIBUTIONMEASURE
IFCLUMINOUSINTENSITYMEASURE
IFCMAGNETICFLUXDENSITYMEASURE
IFCMAGNETICFLUXMEASURE
IFCMANIFOLDSOLIDBREP
IFCMAPCONVERSION
IFCMAPPEDITEM
IFCMASSDENSITYMEASURE
IFCMASSFLOWRATEMEASURE
IFCMASSMEASURE
IFCMASSPERLENGTHMEASURE
IFCMATERIAL
IFCMATERIALCLASSIFICATIONRELATIONSHIP
IFCMATERIALCONSTITUENT
IFCMATERIALCONSTITUENTSET
IFCMATERIALDEFINITION
IFCMATERIALDEFINITIONREPRESENTATION
IFCMATERIALLAYER
IFCMATERIALLAYERSET
IFCMATERIALLAYERSETUSAGE
IFCMATERIALLAYERWITHOFFSETS
IFCMATERIALLIST
IFCMATERIALPROFILE
IFCMATERIALPROFILESET
IFCMATERIALPROFILESETUSAGE
IFCMATERIALPROFILESETUSAGETAPERING
IFCMATERIALPROFILEWITHOFFSETS
IFCMATERIALPROPERTIES
IFCMATERIALRELATIONSHIP
IFCMATERIALUSAGEDEFINITION
IFCMEASUREWITHUNIT
IFCMECHANICALCONCRETEMATERIALPROPERTIES
IFCMECHANICALFASTENER
IFCMECHANICALFASTENERTYPE
IFCMECHANICALMATERIALPROPERTIES
IFCMECHANICALSTEELMATERIALPROPERTIES
IFCMEDICALDEVICE
IFCMEDICALDEVICETYPE
IFCMEMBER
IFCMEMBERSTANDARDCASE
IFCMEMBERTYPE
IFCMETRIC
IFCMINUTEINHOUR
IFCMIRROREDPROFILEDEF
IFCMODULUSOFELASTICITYMEASURE
IFCMODULUSOFLINEARSUBGRADEREACTIONMEASURE
IFCMODULUSOFROTATIONALSUBGRADEREACTIONMEASURE
IFCMODULUSOFSUBGRADEREACTIONMEASURE
IFCMOISTUREDIFFUSIVITYMEASURE
IFCMOLECULARWEIGHTMEASURE
IFCMOMENTOFINERTIAMEASURE
IFCMONETARYMEASURE
IFCMONETARYUNIT
IFCMONTHINYEARNUMBER
IFCMOTORCONNECTION
IFCMOTORCONNECTIONTYPE
IFCMOVE
IFCNAMEDUNIT
IFCNONNEGATIVELENGTHMEASURE
IFCNORMALISEDRATIOMEASURE
IFCNULLSTYLE
IFCNUMERICMEASURE
IFCOBJECT
IFCOBJECTDEFINITION
IFCOBJECTIVE
IFCOBJECTPLACEMENT
IFCOCCUPANT
IFCOFFSETCURVE
IFCOFFSETCURVE2D
IFCOFFSETCURVE3D
IFCOFFSETCURVEBYDISTANCES
IFCONEDIRECTIONREPEATFACTOR
IFCOPENINGELEMENT
IFCOPENINGSTANDARDCASE
IFCOPENSHELL
IFCOPTICALMATERIALPROPERTIES
IFCORDERACTION
IFCORGANIZATION
IFCORGANIZATIONRELATIONSHIP
IFCORIENTATIONEXPRESSION
IFCORIENTEDEDGE
IFCOUTERBOUNDARYCURVE
IFCOUTLET
IFCOUTLETTYPE
IFCOWNERHISTORY
IFCPARAMETERIZEDPROFILEDEF
IFCPARAMETERVALUE
IFCPATH
IFCPCURVE
IFCPERFORMANCEHISTORY
IFCPERMEABLECOVERINGPROPERTIES
IFCPERMIT
IFCPERSON
IFCPERSONANDORGANIZATION
IFCPHMEASURE
IFCPHYSICALCOMPLEXQUANTITY
IFCPHYSICALQUANTITY
IFCPHYSICALSIMPLEQUANTITY
IFCPILE
IFCPILETYPE
IFCPIPEFITTING
IFCPIPEFITTINGTYPE
IFCPIPESEGMENT
IFCPIPESEGMENTTYPE
IFCPIXELTEXTURE
IFCPLACEMENT
IFCPLANARBOX
IFCPLANAREXTENT
IFCPLANARFORCEMEASURE
IFCPLANE
IFCPLANEANGLEMEASURE
IFCPLATE
IFCPLATESTANDARDCASE
IFCPLATETYPE
IFCPOINT
IFCPOINTONCURVE
IFCPOINTONSURFACE
IFCPOLYGONALBOUNDEDHALFSPACE
IFCPOLYGONALFACESET
IFCPOLYLINE
IFCPOLYLOOP
IFCPORT
IFCPOSITIONINGELEMENT
IFCPOSITIVEINTEGER
IFCPOSITIVELENGTHMEASURE
IFCPOSITIVEPLANEANGLEMEASURE
IFCPOSITIVERATIOMEASURE
IFCPOSTALADDRESS
IFCPOWERMEASURE
IFCPREDEFINEDCOLOUR
IFCPREDEFINEDCURVEFONT
IFCPREDEFINEDDIMENSIONSYMBOL
IFCPREDEFINEDITEM
IFCPREDEFINEDPOINTMARKERSYMBOL
IFCPREDEFINEDPROPERTIES
IFCPREDEFINEDPROPERTYSET
IFCPREDEFINEDSYMBOL
IFCPREDEFINEDTERMINATORSYMBOL
IFCPREDEFINEDTEXTFONT
IFCPRESENTABLETEXT
IFCPRESENTATIONITEM
IFCPRESENTATIONLAYERASSIGNMENT
IFCPRESENTATIONLAYERWITHSTYLE
IFCPRESENTATIONSTYLE
IFCPRESENTATIONSTYLEASSIGNMENT
IFCPRESSUREMEASURE
IFCPROCEDURE
IFCPROCEDURETYPE
IFCPROCESS
IFCPRODUCT
IFCPRODUCTDEFINITIONSHAPE
IFCPRODUCTREPRESENTATION
IFCPRODUCTSOFCOMBUSTIONPROPERTIES
IFCPROFILEDEF
IFCPROFILEPROPERTIES
IFCPROJECT
IFCPROJECTEDCRS
IFCPROJECTIONCURVE
IFCPROJECTIONELEMENT
IFCPROJECTLIBRARY
IFCPROJECTORDER
IFCPROJECTORDERRECORD
IFCPROPERTY
IFCPROPERTYABSTRACTION
IFCPROPERTYBOUNDEDVALUE
IFCPROPERTYCONSTRAINTRELATIONSHIP
IFCPROPERTYDEFINITION
IFCPROPERTYDEPENDENCYRELATIONSHIP
IFCPROPERTYENUMERATEDVALUE
IFCPROPERTYENUMERATION
IFCPROPERTYLISTVALUE
IFCPROPERTYREFERENCEVALUE
IFCPROPERTYSET
IFCPROPERTYSETDEFINITION
IFCPROPERTYSETDEFINITIONSET
IFCPROPERTYSETTEMPLATE
IFCPROPERTYSINGLEVALUE
IFCPROPERTYTABLEVALUE
IFCPROPERTYTEMPLATE
IFCPROPERTYTEMPLATEDEFINITION
IFCPROTECTIVEDEVICE
IFCPROTECTIVEDEVICETRIPPINGUNIT
IFCPROTECTIVEDEVICETRIPPINGUNITTYPE
IFCPROTECTIVEDEVICETYPE
IFCPROXY
IFCPUMP
IFCPUMPTYPE
IFCQUANTITYAREA
IFCQUANTITYCOUNT
IFCQUANTITYLENGTH
IFCQUANTITYSET
IFCQUANTITYTIME
IFCQUANTITYVOLUME
IFCQUANTITYWEIGHT
IFCRADIOACTIVITYMEASURE
IFCRADIUSDIMENSION
IFCRAILING
IFCRAILINGTYPE
IFCRAMP
IFCRAMPFLIGHT
IFCRAMPFLIGHTTYPE
IFCRAMPTYPE
IFCRATIOMEASURE
IFCRATIONALBEZIERCURVE
IFCRATIONALBSPLINECURVEWITHKNOTS
IFCRATIONALBSPLINESURFACEWITHKNOTS
IFCREAL
IFCRECTANGLEHOLLOWPROFILEDEF
IFCRECTANGLEPROFILEDEF
IFCRECTANGULARPYRAMID
IFCRECTANGULARTRIMMEDSURFACE
IFCRECURRENCEPATTERN
IFCREFERENCE
IFCREFERENCESVALUEDOCUMENT
IFCREFERENT
IFCREGULARTIMESERIES
IFCREINFORCEMENTBARPROPERTIES
IFCREINFORCEMENTDEFINITIONPROPERTIES
IFCREINFORCINGBAR
IFCREINFORCINGBARTYPE
IFCREINFORCINGELEMENT
IFCREINFORCINGELEMENTTYPE
IFCREINFORCINGMESH
IFCREINFORCINGMESHTYPE
IFCRELAGGREGATES
IFCRELASSIGNS
IFCRELASSIGNSTASKS
IFCRELASSIGNSTOACTOR
IFCRELASSIGNSTOCONTROL
IFCRELASSIGNSTOGROUP
IFCRELASSIGNSTOGROUPBYFACTOR
IFCRELASSIGNSTOPROCESS
IFCRELASSIGNSTOPRODUCT
IFCRELASSIGNSTOPROJECTORDER
IFCRELASSIGNSTORESOURCE
IFCRELASSOCIATES
IFCRELASSOCIATESAPPLIEDVALUE
IFCRELASSOCIATESAPPROVAL
IFCRELASSOCIATESCLASSIFICATION
IFCRELASSOCIATESCONSTRAINT
IFCRELASSOCIATESDOCUMENT
IFCRELASSOCIATESLIBRARY
IFCRELASSOCIATESMATERIAL
IFCRELASSOCIATESPROFILEPROPERTIES
IFCRELATIONSHIP
IFCRELAXATION
IFCRELCONNECTS
IFCRELCONNECTSELEMENTS
IFCRELCONNECTSPATHELEMENTS
IFCRELCONNECTSPORTS
IFCRELCONNECTSPORTTOELEMENT
IFCRELCONNECTSSTRUCTURALACTIVITY
IFCRELCONNECTSSTRUCTURALELEMENT
IFCRELCONNECTSSTRUCTURALMEMBER
IFCRELCONNECTSWITHECCENTRICITY
IFCRELCONNECTSWITHREALIZINGELEMENTS
IFCRELCONTAINEDINSPATIALSTRUCTURE
IFCRELCOVERSBLDGELEMENTS
IFCRELCOVERSSPACES
IFCRELDECLARES
IFCRELDECOMPOSES
IFCRELDEFINES
IFCRELDEFINESBYOBJECT
IFCRELDEFINESBYPROPERTIES
IFCRELDEFINESBYTEMPLATE
IFCRELDEFINESBYTYPE
IFCRELFILLSELEMENT
IFCRELFLOWCONTROLELEMENTS
IFCRELINTERACTIONREQUIREMENTS
IFCRELINTERFERESELEMENTS
IFCRELNESTS
IFCRELOCCUPIESSPACES
IFCRELOVERRIDESPROPERTIES
IFCRELPROJECTSELEMENT
IFCRELREFERENCEDINSPATIALSTRUCTURE
IFCRELSCHEDULESCOSTITEMS
IFCRELSEQUENCE
IFCRELSERVICESBUILDINGS
IFCRELSPACEBOUNDARY
IFCRELSPACEBOUNDARY1STLEVEL
IFCRELSPACEBOUNDARY2NDLEVEL
IFCRELVOIDSELEMENT
IFCREPARAMETRISEDCOMPOSITECURVESEGMENT
IFCREPRESENTATION
IFCREPRESENTATIONCONTEXT
IFCREPRESENTATIONITEM
IFCREPRESENTATIONMAP
IFCRESOURCE
IFCRESOURCEAPPROVALRELATIONSHIP
IFCRESOURCECONSTRAINTRELATIONSHIP
IFCRESOURCELEVELRELATIONSHIP
IFCRESOURCETIME
IFCREVOLVEDAREASOLID
IFCREVOLVEDAREASOLIDTAPERED
IFCRIBPLATEPROFILEPROPERTIES
IFCRIGHTCIRCULARCONE
IFCRIGHTCIRCULARCYLINDER
IFCROOF
IFCROOFTYPE
IFCROOT
IFCROTATIONALFREQUENCYMEASURE
IFCROTATIONALMASSMEASURE
IFCROTATIONALSTIFFNESSMEASURE
IFCROUNDEDEDGEFEATURE
IFCROUNDEDRECTANGLEPROFILEDEF
IFCSANITARYTERMINAL
IFCSANITARYTERMINALTYPE
IFCSCHEDULETIMECONTROL
IFCSCHEDULINGTIME
IFCSEAMCURVE
IFCSECONDINMINUTE
IFCSECTIONALAREAINTEGRALMEASURE
IFCSECTIONEDSOLID
IFCSECTIONEDSOLIDHORIZONTAL
IFCSECTIONEDSPINE
IFCSECTIONMODULUSMEASURE
IFCSECTIONPROPERTIES
IFCSECTIONREINFORCEMENTPROPERTIES
IFCSENSOR
IFCSENSORTYPE
IFCSERVICELIFE
IFCSERVICELIFEFACTOR
IFCSHADINGDEVICE
IFCSHADINGDEVICETYPE
IFCSHAPEASPECT
IFCSHAPEMODEL
IFCSHAPEREPRESENTATION
IFCSHEARMODULUSMEASURE
IFCSHELLBASEDSURFACEMODEL
IFCSIMPLEPROPERTY
IFCSIMPLEPROPERTYTEMPLATE
IFCSITE
IFCSIUNIT
IFCSLAB
IFCSLABELEMENTEDCASE
IFCSLABSTANDARDCASE
IFCSLABTYPE
IFCSLIPPAGECONNECTIONCONDITION
IFCSOLARDEVICE
IFCSOLARDEVICETYPE
IFCSOLIDANGLEMEASURE
IFCSOLIDMODEL
IFCSOUNDPOWERLEVELMEASURE
IFCSOUNDPOWERMEASURE
IFCSOUNDPRESSURELEVELMEASURE
IFCSOUNDPRESSUREMEASURE
IFCSOUNDPROPERTIES
IFCSOUNDVALUE
IFCSPACE
IFCSPACEHEATER
IFCSPACEHEATERTYPE
IFCSPACEPROGRAM
IFCSPACETHERMALLOADPROPERTIES
IFCSPACETYPE
IFCSPATIALELEMENT
IFCSPATIALELEMENTTYPE
IFCSPATIALSTRUCTUREELEMENT
IFCSPATIALSTRUCTUREELEMENTTYPE
IFCSPATIALZONE
IFCSPATIALZONETYPE
IFCSPECIFICHEATCAPACITYMEASURE
IFCSPECULAREXPONENT
IFCSPECULARROUGHNESS
IFCSPHERE
IFCSPHERICALSURFACE
IFCSTACKTERMINAL
IFCSTACKTERMINALTYPE
IFCSTAIR
IFCSTAIRFLIGHT
IFCSTAIRFLIGHTTYPE
IFCSTAIRTYPE
IFCSTRUCTURALACTION
IFCSTRUCTURALACTIVITY
IFCSTRUCTURALANALYSISMODEL
IFCSTRUCTURALCONNECTION
IFCSTRUCTURALCONNECTIONCONDITION
IFCSTRUCTURALCURVEACTION
IFCSTRUCTURALCURVECONNECTION
IFCSTRUCTURALCURVEMEMBER
IFCSTRUCTURALCURVEMEMBERVARYING
IFCSTRUCTURALCURVEREACTION
IFCSTRUCTURALITEM
IFCSTRUCTURALLINEARACTION
IFCSTRUCTURALLINEARACTIONVARYING
IFCSTRUCTURALLOAD
IFCSTRUCTURALLOADCASE
IFCSTRUCTURALLOADCONFIGURATION
IFCSTRUCTURALLOADGROUP
IFCSTRUCTURALLOADLINEARFORCE
IFCSTRUCTURALLOADORRESULT
IFCSTRUCTURALLOADPLANARFORCE
IFCSTRUCTURALLOADSINGLEDISPLACEMENT
IFCSTRUCTURALLOADSINGLEDISPLACEMENTDISTORTION
IFCSTRUCTURALLOADSINGLEFORCE
IFCSTRUCTURALLOADSINGLEFORCEWARPING
IFCSTRUCTURALLOADSTATIC
IFCSTRUCTURALLOADTEMPERATURE
IFCSTRUCTURALMEMBER
IFCSTRUCTURALPLANARACTION
IFCSTRUCTURALPLANARACTIONVARYING
IFCSTRUCTURALPOINTACTION
IFCSTRUCTURALPOINTCONNECTION
IFCSTRUCTURALPOINTREACTION
IFCSTRUCTURALPROFILEPROPERTIES
IFCSTRUCTURALREACTION
IFCSTRUCTURALRESULTGROUP
IFCSTRUCTURALSTEELPROFILEPROPERTIES
IFCSTRUCTURALSURFACEACTION
IFCSTRUCTURALSURFACECONNECTION
IFCSTRUCTURALSURFACEMEMBER
IFCSTRUCTURALSURFACEMEMBERVARYING
IFCSTRUCTURALSURFACEREACTION
IFCSTRUCTUREDDIMENSIONCALLOUT
IFCSTYLEDITEM
IFCSTYLEDREPRESENTATION
IFCSTYLEMODEL
IFCSUBCONTRACTRESOURCE
IFCSUBCONTRACTRESOURCETYPE
IFCSUBEDGE
IFCSURFACE
IFCSURFACECURVE
IFCSURFACECURVESWEPTAREASOLID
IFCSURFACEFEATURE
IFCSURFACEOFLINEAREXTRUSION
IFCSURFACEOFREVOLUTION
IFCSURFACEREINFORCEMENTAREA
IFCSURFACESTYLE
IFCSURFACESTYLELIGHTING
IFCSURFACESTYLEREFRACTION
IFCSURFACESTYLERENDERING
IFCSURFACESTYLESHADING
IFCSURFACESTYLEWITHTEXTURES
IFCSURFACETEXTURE
IFCSWEPTAREASOLID
IFCSWEPTDISKSOLID
IFCSWEPTDISKSOLIDPOLYGONAL
IFCSWEPTSURFACE
IFCSWITCHINGDEVICE
IFCSWITCHINGDEVICETYPE
IFCSYMBOLSTYLE
IFCSYSTEM
IFCSYSTEMFURNITUREELEMENT
IFCSYSTEMFURNITUREELEMENTTYPE
IFCTABLE
IFCTABLECOLUMN
IFCTABLEROW
IFCTANK
IFCTANKTYPE
IFCTASK
IFCTASKTIME
IFCTASKTIMERECURRING
IFCTASKTYPE
IFCTELECOMADDRESS
IFCTEMPERATUREGRADIENTMEASURE
IFCTEMPERATURERATEOFCHANGEMEASURE
IFCTENDON
IFCTENDONANCHOR
IFCTENDONANCHORTYPE
IFCTENDONTYPE
IFCTERMINATORSYMBOL
IFCTESSELLATEDFACESET
IFCTESSELLATEDITEM
IFCTEXT
IFCTEXTALIGNMENT
IFCTEXTDECORATION
IFCTEXTFONTNAME
IFCTEXTLITERAL
IFCTEXTLITERALWITHEXTENT
IFCTEXTSTYLE
IFCTEXTSTYLEFONTMODEL
IFCTEXTSTYLEFORDEFINEDFONT
IFCTEXTSTYLETEXTMODEL
IFCTEXTSTYLEWITHBOXCHARACTERISTICS
IFCTEXTTRANSFORMATION
IFCTEXTURECOORDINATE
IFCTEXTURECOORDINATEGENERATOR
IFCTEXTUREMAP
IFCTEXTUREVERTEX
IFCTEXTUREVERTEXLIST
IFCTHERMALADMITTANCEMEASURE
IFCTHERMALCONDUCTIVITYMEASURE
IFCTHERMALEXPANSIONCOEFFICIENTMEASURE
IFCTHERMALMATERIALPROPERTIES
IFCTHERMALRESISTANCEMEASURE
IFCTHERMALTRANSMITTANCEMEASURE
IFCTHERMODYNAMICTEMPERATUREMEASURE
IFCTIME
IFCTIMEMEASURE
IFCTIMEPERIOD
IFCTIMESERIES
IFCTIMESERIESREFERENCERELATIONSHIP
IFCTIMESERIESSCHEDULE
IFCTIMESERIESVALUE
IFCTIMESTAMP
IFCTOPOLOGICALREPRESENTATIONITEM
IFCTOPOLOGYREPRESENTATION
IFCTOROIDALSURFACE
IFCTORQUEMEASURE
IFCTRANSFORMER
IFCTRANSFORMERTYPE
IFCTRANSITIONCURVESEGMENT2D
IFCTRANSPORTELEMENT
IFCTRANSPORTELEMENTTYPE
IFCTRAPEZIUMPROFILEDEF
IFCTRIANGULATEDFACESET
IFCTRIANGULATEDIRREGULARNETWORK
IFCTRIMMEDCURVE
IFCTSHAPEPROFILEDEF
IFCTUBEBUNDLE
IFCTUBEBUNDLETYPE
IFCTWODIRECTIONREPEATFACTOR
IFCTYPEOBJECT
IFCTYPEPROCESS
IFCTYPEPRODUCT
IFCTYPERESOURCE
IFCUNITARYCONTROLELEMENT
IFCUNITARYCONTROLELEMENTTYPE
IFCUNITARYEQUIPMENT
IFCUNITARYEQUIPMENTTYPE
IFCUNITASSIGNMENT
IFCURIREFERENCE
IFCUSHAPEPROFILEDEF
IFCVALVE
IFCVALVETYPE
IFCVAPORPERMEABILITYMEASURE
IFCVECTOR
IFCVERTEX
IFCVERTEXBASEDTEXTUREMAP
IFCVERTEXLOOP
IFCVERTEXPOINT
IFCVIBRATIONISOLATOR
IFCVIBRATIONISOLATORTYPE
IFCVIRTUALELEMENT
IFCVIRTUALGRIDINTERSECTION
IFCVOIDINGFEATURE
IFCVOLUMEMEASURE
IFCVOLUMETRICFLOWRATEMEASURE
IFCWALL
IFCWALLELEMENTEDCASE
IFCWALLSTANDARDCASE
IFCWALLTYPE
IFCWARPINGCONSTANTMEASURE
IFCWARPINGMOMENTMEASURE
IFCWASTETERMINAL
IFCWASTETERMINALTYPE
IFCWATERPROPERTIES
IFCWINDOW
IFCWINDOWLININGPROPERTIES
IFCWINDOWPANELPROPERTIES
IFCWINDOWSTANDARDCASE
IFCWINDOWSTYLE
IFCWINDOWTYPE
IFCWORKCALENDAR
IFCWORKCONTROL
IFCWORKPLAN
IFCWORKSCHEDULE
IFCWORKTIME
IFCYEARNUMBER
IFCZONE
IFCZSHAPEPROFILEDEF
`.trim().split("\n");

/**
 * Per entity, the attributes that hold a comparable value rather than a
 * reference to another entity or an aggregate of them. Upper-case entity names,
 * as a STEP file spells them; attribute names in their schema spelling.
 *
 * Only the schema can draw this line: both parsers hand back a reference as a
 * bare number, so filtering on the value alone would let a rule compare against
 * an express id. Inheritance is already accounted for, so each list is complete
 * on its own.
 *
 * `GlobalId`, `Name` and `PredefinedType` are deliberately absent — they have
 * dedicated fields on `NormalizedElement`.
 */
export const IFC_SIMPLE_ATTRIBUTE_NAMES: Readonly<Record<string, readonly string[]>> = {
  "IFC2DCOMPOSITECURVE": ["SelfIntersect"],
  "IFCACTIONREQUEST": ["Description", "Identification", "LongDescription", "ObjectType", "Status"],
  "IFCACTOR": ["Description", "ObjectType"],
  "IFCACTORROLE": ["Description", "Role", "UserDefinedRole"],
  "IFCACTUATOR": ["Description", "ObjectType", "Tag"],
  "IFCACTUATORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCADDRESS": ["Description", "Purpose", "UserDefinedPurpose"],
  "IFCADVANCEDFACE": ["SameSense"],
  "IFCAIRTERMINAL": ["Description", "ObjectType", "Tag"],
  "IFCAIRTERMINALBOX": ["Description", "ObjectType", "Tag"],
  "IFCAIRTERMINALBOXTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCAIRTERMINALTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCAIRTOAIRHEATRECOVERY": ["Description", "ObjectType", "Tag"],
  "IFCAIRTOAIRHEATRECOVERYTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCALARM": ["Description", "ObjectType", "Tag"],
  "IFCALARMTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCALIGNMENT": ["Description", "ObjectType"],
  "IFCALIGNMENT2DHORIZONTAL": ["StartDistAlong"],
  "IFCALIGNMENT2DHORIZONTALSEGMENT": ["EndTag", "StartTag", "TangentialContinuity"],
  "IFCALIGNMENT2DSEGMENT": ["EndTag", "StartTag", "TangentialContinuity"],
  "IFCALIGNMENT2DVERSEGCIRCULARARC": ["EndTag", "HorizontalLength", "IsConvex", "Radius", "StartDistAlong", "StartGradient", "StartHeight", "StartTag", "TangentialContinuity"],
  "IFCALIGNMENT2DVERSEGLINE": ["EndTag", "HorizontalLength", "StartDistAlong", "StartGradient", "StartHeight", "StartTag", "TangentialContinuity"],
  "IFCALIGNMENT2DVERSEGPARABOLICARC": ["EndTag", "HorizontalLength", "IsConvex", "ParabolaConstant", "StartDistAlong", "StartGradient", "StartHeight", "StartTag", "TangentialContinuity"],
  "IFCALIGNMENT2DVERTICALSEGMENT": ["EndTag", "HorizontalLength", "StartDistAlong", "StartGradient", "StartHeight", "StartTag", "TangentialContinuity"],
  "IFCALIGNMENTCURVE": ["Tag"],
  "IFCANNOTATION": ["Description", "ObjectType"],
  "IFCANNOTATIONFILLAREAOCCURRENCE": ["GlobalOrLocal"],
  "IFCAPPLICATION": ["ApplicationFullName", "ApplicationIdentifier", "Version"],
  "IFCAPPLIEDVALUE": ["ApplicableDate", "ArithmeticOperator", "Category", "Condition", "Description", "FixedUntilDate"],
  "IFCAPPLIEDVALUERELATIONSHIP": ["ArithmeticOperator", "Description"],
  "IFCAPPROVAL": ["Description", "Identifier", "Level", "Qualifier", "Status", "TimeOfApproval"],
  "IFCAPPROVALACTORRELATIONSHIP": ["Role"],
  "IFCAPPROVALRELATIONSHIP": ["Description"],
  "IFCARBITRARYCLOSEDPROFILEDEF": ["ProfileName", "ProfileType"],
  "IFCARBITRARYOPENPROFILEDEF": ["ProfileName", "ProfileType"],
  "IFCARBITRARYPROFILEDEFWITHVOIDS": ["ProfileName", "ProfileType"],
  "IFCASSET": ["Description", "Identification", "IncorporationDate", "ObjectType"],
  "IFCASYMMETRICISHAPEPROFILEDEF": ["BottomFlangeEdgeRadius", "BottomFlangeFilletRadius", "BottomFlangeSlope", "BottomFlangeThickness", "BottomFlangeWidth", "OverallDepth", "Position", "ProfileName", "ProfileType", "TopFlangeEdgeRadius", "TopFlangeFilletRadius", "TopFlangeSlope", "TopFlangeThickness", "TopFlangeWidth", "WebThickness"],
  "IFCAUDIOVISUALAPPLIANCE": ["Description", "ObjectType", "Tag"],
  "IFCAUDIOVISUALAPPLIANCETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCAXIS1PLACEMENT": ["Location"],
  "IFCAXIS2PLACEMENT2D": ["Location"],
  "IFCAXIS2PLACEMENT3D": ["Location"],
  "IFCBEAM": ["Description", "ObjectType", "Tag"],
  "IFCBEAMSTANDARDCASE": ["Description", "ObjectType", "Tag"],
  "IFCBEAMTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCBEZIERCURVE": ["ClosedCurve", "CurveForm", "Degree", "SelfIntersect"],
  "IFCBLOBTEXTURE": ["Mode", "Parameter", "RasterFormat", "RepeatS", "RepeatT"],
  "IFCBLOCK": ["Position", "XLength", "YLength", "ZLength"],
  "IFCBOILER": ["Description", "ObjectType", "Tag"],
  "IFCBOILERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCBOOLEANCLIPPINGRESULT": ["Operator"],
  "IFCBOOLEANRESULT": ["Operator"],
  "IFCBOUNDARYCURVE": ["SelfIntersect"],
  "IFCBOUNDARYEDGECONDITION": ["LinearStiffnessByLengthX", "LinearStiffnessByLengthY", "LinearStiffnessByLengthZ", "RotationalStiffnessByLengthX", "RotationalStiffnessByLengthY", "RotationalStiffnessByLengthZ"],
  "IFCBOUNDARYFACECONDITION": ["LinearStiffnessByAreaX", "LinearStiffnessByAreaY", "LinearStiffnessByAreaZ"],
  "IFCBOUNDARYNODECONDITION": ["LinearStiffnessX", "LinearStiffnessY", "LinearStiffnessZ", "RotationalStiffnessX", "RotationalStiffnessY", "RotationalStiffnessZ"],
  "IFCBOUNDARYNODECONDITIONWARPING": ["LinearStiffnessX", "LinearStiffnessY", "LinearStiffnessZ", "RotationalStiffnessX", "RotationalStiffnessY", "RotationalStiffnessZ", "WarpingStiffness"],
  "IFCBOUNDINGBOX": ["XDim", "YDim", "ZDim"],
  "IFCBOXEDHALFSPACE": ["AgreementFlag"],
  "IFCBSPLINECURVE": ["ClosedCurve", "CurveForm", "Degree", "SelfIntersect"],
  "IFCBSPLINECURVEWITHKNOTS": ["ClosedCurve", "CurveForm", "Degree", "KnotMultiplicities", "KnotSpec", "Knots", "SelfIntersect"],
  "IFCBSPLINESURFACE": ["SelfIntersect", "SurfaceForm", "UClosed", "UDegree", "VClosed", "VDegree"],
  "IFCBSPLINESURFACEWITHKNOTS": ["KnotSpec", "SelfIntersect", "SurfaceForm", "UClosed", "UDegree", "UKnots", "UMultiplicities", "VClosed", "VDegree", "VKnots", "VMultiplicities"],
  "IFCBUILDING": ["CompositionType", "Description", "ElevationOfRefHeight", "ElevationOfTerrain", "LongName", "ObjectType"],
  "IFCBUILDINGELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCBUILDINGELEMENTCOMPONENT": ["Description", "ObjectType", "Tag"],
  "IFCBUILDINGELEMENTPART": ["Description", "ObjectType", "Tag"],
  "IFCBUILDINGELEMENTPARTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCBUILDINGELEMENTPROXY": ["Description", "ObjectType", "Tag"],
  "IFCBUILDINGELEMENTPROXYTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCBUILDINGELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCBUILDINGSTOREY": ["CompositionType", "Description", "Elevation", "LongName", "ObjectType"],
  "IFCBUILDINGSYSTEM": ["Description", "LongName", "ObjectType"],
  "IFCBURNER": ["Description", "ObjectType", "Tag"],
  "IFCBURNERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCABLECARRIERFITTING": ["Description", "ObjectType", "Tag"],
  "IFCCABLECARRIERFITTINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCABLECARRIERSEGMENT": ["Description", "ObjectType", "Tag"],
  "IFCCABLECARRIERSEGMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCABLEFITTING": ["Description", "ObjectType", "Tag"],
  "IFCCABLEFITTINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCABLESEGMENT": ["Description", "ObjectType", "Tag"],
  "IFCCABLESEGMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCALENDARDATE": ["DayComponent", "MonthComponent", "YearComponent"],
  "IFCCARTESIANPOINT": ["Coordinates"],
  "IFCCARTESIANPOINTLIST2D": ["CoordList", "TagList"],
  "IFCCARTESIANPOINTLIST3D": ["CoordList", "TagList"],
  "IFCCARTESIANTRANSFORMATIONOPERATOR": ["Scale"],
  "IFCCARTESIANTRANSFORMATIONOPERATOR2D": ["Scale"],
  "IFCCARTESIANTRANSFORMATIONOPERATOR2DNONUNIFORM": ["Scale", "Scale2"],
  "IFCCARTESIANTRANSFORMATIONOPERATOR3D": ["Scale"],
  "IFCCARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM": ["Scale", "Scale2", "Scale3"],
  "IFCCENTERLINEPROFILEDEF": ["ProfileName", "ProfileType", "Thickness"],
  "IFCCHAMFEREDGEFEATURE": ["Description", "FeatureLength", "Height", "ObjectType", "Tag", "Width"],
  "IFCCHILLER": ["Description", "ObjectType", "Tag"],
  "IFCCHILLERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCHIMNEY": ["Description", "ObjectType", "Tag"],
  "IFCCHIMNEYTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCIRCLE": ["Position", "Radius"],
  "IFCCIRCLEHOLLOWPROFILEDEF": ["Position", "ProfileName", "ProfileType", "Radius", "WallThickness"],
  "IFCCIRCLEPROFILEDEF": ["Position", "ProfileName", "ProfileType", "Radius"],
  "IFCCIRCULARARCSEGMENT2D": ["IsCCW", "Radius", "SegmentLength", "StartDirection"],
  "IFCCIVILELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCCIVILELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCLASSIFICATION": ["Description", "Edition", "EditionDate", "Location", "ReferenceTokens", "Source"],
  "IFCCLASSIFICATIONITEM": ["Title"],
  "IFCCLASSIFICATIONNOTATIONFACET": ["NotationValue"],
  "IFCCLASSIFICATIONREFERENCE": ["Description", "Identification", "Location", "Sort"],
  "IFCCOIL": ["Description", "ObjectType", "Tag"],
  "IFCCOILTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCOLOURRGB": ["Blue", "Green", "Red"],
  "IFCCOLOURRGBLIST": ["ColourList"],
  "IFCCOLUMN": ["Description", "ObjectType", "Tag"],
  "IFCCOLUMNSTANDARDCASE": ["Description", "ObjectType", "Tag"],
  "IFCCOLUMNTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCOMMUNICATIONSAPPLIANCE": ["Description", "ObjectType", "Tag"],
  "IFCCOMMUNICATIONSAPPLIANCETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCOMPLEXPROPERTY": ["Description", "UsageName"],
  "IFCCOMPLEXPROPERTYTEMPLATE": ["Description", "TemplateType", "UsageName"],
  "IFCCOMPOSITECURVE": ["SelfIntersect"],
  "IFCCOMPOSITECURVEONSURFACE": ["SelfIntersect"],
  "IFCCOMPOSITECURVESEGMENT": ["SameSense", "Transition"],
  "IFCCOMPOSITEPROFILEDEF": ["Label", "ProfileName", "ProfileType"],
  "IFCCOMPRESSOR": ["Description", "ObjectType", "Tag"],
  "IFCCOMPRESSORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCONDENSER": ["Description", "ObjectType", "Tag"],
  "IFCCONDENSERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCONDITION": ["Description", "ObjectType"],
  "IFCCONDITIONCRITERION": ["Description", "ObjectType"],
  "IFCCONIC": ["Position"],
  "IFCCONNECTIONPOINTECCENTRICITY": ["EccentricityInX", "EccentricityInY", "EccentricityInZ"],
  "IFCCONSTRAINT": ["ConstraintGrade", "ConstraintSource", "CreationTime", "Description", "UserDefinedGrade"],
  "IFCCONSTRAINTAGGREGATIONRELATIONSHIP": ["Description", "LogicalAggregator"],
  "IFCCONSTRAINTRELATIONSHIP": ["Description"],
  "IFCCONSTRUCTIONEQUIPMENTRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType", "Usage"],
  "IFCCONSTRUCTIONEQUIPMENTRESOURCETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCCONSTRUCTIONMATERIALRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType", "Usage"],
  "IFCCONSTRUCTIONMATERIALRESOURCETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCCONSTRUCTIONPRODUCTRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType", "Usage"],
  "IFCCONSTRUCTIONPRODUCTRESOURCETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCCONSTRUCTIONRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType", "Usage"],
  "IFCCONSTRUCTIONRESOURCETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCCONTEXT": ["Description", "LongName", "ObjectType", "Phase"],
  "IFCCONTEXTDEPENDENTUNIT": ["UnitType"],
  "IFCCONTROL": ["Description", "Identification", "ObjectType"],
  "IFCCONTROLLER": ["Description", "ObjectType", "Tag"],
  "IFCCONTROLLERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCONVERSIONBASEDUNIT": ["UnitType"],
  "IFCCONVERSIONBASEDUNITWITHOFFSET": ["ConversionOffset", "UnitType"],
  "IFCCOOLEDBEAM": ["Description", "ObjectType", "Tag"],
  "IFCCOOLEDBEAMTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCOOLINGTOWER": ["Description", "ObjectType", "Tag"],
  "IFCCOOLINGTOWERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCOORDINATEDUNIVERSALTIMEOFFSET": ["HourOffset", "MinuteOffset", "Sense"],
  "IFCCOORDINATEREFERENCESYSTEM": ["Description", "GeodeticDatum", "VerticalDatum"],
  "IFCCOSTITEM": ["Description", "Identification", "ObjectType"],
  "IFCCOSTSCHEDULE": ["Description", "Identification", "ObjectType", "Status", "SubmittedOn", "UpdateDate"],
  "IFCCOSTVALUE": ["ApplicableDate", "ArithmeticOperator", "Category", "Condition", "Description", "FixedUntilDate"],
  "IFCCOVERING": ["Description", "ObjectType", "Tag"],
  "IFCCOVERINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCRANERAILASHAPEPROFILEDEF": ["BaseDepth1", "BaseDepth2", "BaseDepth3", "BaseWidth2", "BaseWidth4", "CentreOfGravityInY", "HeadDepth2", "HeadDepth3", "HeadWidth", "OverallHeight", "ProfileName", "ProfileType", "Radius", "WebThickness"],
  "IFCCRANERAILFSHAPEPROFILEDEF": ["BaseDepth1", "BaseDepth2", "CentreOfGravityInY", "HeadDepth2", "HeadDepth3", "HeadWidth", "OverallHeight", "ProfileName", "ProfileType", "Radius", "WebThickness"],
  "IFCCREWRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType", "Usage"],
  "IFCCREWRESOURCETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCCSGPRIMITIVE3D": ["Position"],
  "IFCCSHAPEPROFILEDEF": ["Depth", "Girth", "InternalFilletRadius", "Position", "ProfileName", "ProfileType", "WallThickness", "Width"],
  "IFCCURRENCYRELATIONSHIP": ["Description", "ExchangeRate", "RateDateTime"],
  "IFCCURTAINWALL": ["Description", "ObjectType", "Tag"],
  "IFCCURTAINWALLTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCCURVEBOUNDEDSURFACE": ["ImplicitOuter"],
  "IFCCURVESEGMENT2D": ["SegmentLength", "StartDirection"],
  "IFCCURVESTYLE": ["ModelOrDraughting"],
  "IFCCURVESTYLEFONTANDSCALING": ["CurveFontScaling"],
  "IFCCURVESTYLEFONTPATTERN": ["InvisibleSegmentLength", "VisibleSegmentLength"],
  "IFCCYLINDRICALSURFACE": ["Position", "Radius"],
  "IFCDAMPER": ["Description", "ObjectType", "Tag"],
  "IFCDAMPERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDERIVEDPROFILEDEF": ["Label", "Operator", "ProfileName", "ProfileType"],
  "IFCDERIVEDUNIT": ["UnitType", "UserDefinedType"],
  "IFCDERIVEDUNITELEMENT": ["Exponent"],
  "IFCDIMENSIONALEXPONENTS": ["AmountOfSubstanceExponent", "ElectricCurrentExponent", "LengthExponent", "LuminousIntensityExponent", "MassExponent", "ThermodynamicTemperatureExponent", "TimeExponent"],
  "IFCDIMENSIONCALLOUTRELATIONSHIP": ["Description"],
  "IFCDIMENSIONCURVETERMINATOR": ["Role"],
  "IFCDIMENSIONPAIR": ["Description"],
  "IFCDIRECTION": ["DirectionRatios"],
  "IFCDISCRETEACCESSORY": ["Description", "ObjectType", "Tag"],
  "IFCDISCRETEACCESSORYTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDISTANCEEXPRESSION": ["AlongHorizontal", "DistanceAlong", "OffsetLateral", "OffsetLongitudinal", "OffsetVertical"],
  "IFCDISTRIBUTIONCHAMBERELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCDISTRIBUTIONCHAMBERELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDISTRIBUTIONCIRCUIT": ["Description", "LongName", "ObjectType"],
  "IFCDISTRIBUTIONCONTROLELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCDISTRIBUTIONCONTROLELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDISTRIBUTIONELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCDISTRIBUTIONELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDISTRIBUTIONFLOWELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCDISTRIBUTIONFLOWELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDISTRIBUTIONPORT": ["Description", "FlowDirection", "ObjectType", "SystemType"],
  "IFCDISTRIBUTIONSYSTEM": ["Description", "LongName", "ObjectType"],
  "IFCDOCUMENTELECTRONICFORMAT": ["FileExtension", "MimeContentType", "MimeSubtype"],
  "IFCDOCUMENTINFORMATION": ["Confidentiality", "CreationTime", "Description", "ElectronicFormat", "Identification", "IntendedUse", "LastRevisionTime", "Location", "Purpose", "Revision", "Scope", "Status", "ValidFrom", "ValidUntil"],
  "IFCDOCUMENTINFORMATIONRELATIONSHIP": ["Description", "RelationshipType"],
  "IFCDOCUMENTREFERENCE": ["Description", "Identification", "Location"],
  "IFCDOOR": ["Description", "ObjectType", "OperationType", "OverallHeight", "OverallWidth", "Tag", "UserDefinedOperationType"],
  "IFCDOORLININGPROPERTIES": ["CasingDepth", "CasingThickness", "Description", "LiningDepth", "LiningOffset", "LiningThickness", "LiningToPanelOffsetX", "LiningToPanelOffsetY", "ThresholdDepth", "ThresholdOffset", "ThresholdThickness", "TransomOffset", "TransomThickness"],
  "IFCDOORPANELPROPERTIES": ["Description", "PanelDepth", "PanelOperation", "PanelPosition", "PanelWidth"],
  "IFCDOORSTANDARDCASE": ["Description", "ObjectType", "OperationType", "OverallHeight", "OverallWidth", "Tag", "UserDefinedOperationType"],
  "IFCDOORSTYLE": ["ApplicableOccurrence", "ConstructionType", "Description", "OperationType", "ParameterTakesPrecedence", "Sizeable", "Tag"],
  "IFCDOORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "OperationType", "ParameterTakesPrecedence", "Tag", "UserDefinedOperationType"],
  "IFCDRAUGHTINGCALLOUTRELATIONSHIP": ["Description"],
  "IFCDUCTFITTING": ["Description", "ObjectType", "Tag"],
  "IFCDUCTFITTINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDUCTSEGMENT": ["Description", "ObjectType", "Tag"],
  "IFCDUCTSEGMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCDUCTSILENCER": ["Description", "ObjectType", "Tag"],
  "IFCDUCTSILENCERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCEDGECURVE": ["SameSense"],
  "IFCEDGEFEATURE": ["Description", "FeatureLength", "ObjectType", "Tag"],
  "IFCELECTRICALBASEPROPERTIES": ["Description", "ElectricCurrentType", "EnergySequence", "FullLoadCurrent", "InputFrequency", "InputPhase", "InputVoltage", "MaximumPowerInput", "MinimumCircuitCurrent", "RatedPowerInput", "UserDefinedEnergySequence"],
  "IFCELECTRICALCIRCUIT": ["Description", "ObjectType"],
  "IFCELECTRICALELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCELECTRICAPPLIANCE": ["Description", "ObjectType", "Tag"],
  "IFCELECTRICAPPLIANCETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELECTRICDISTRIBUTIONBOARD": ["Description", "ObjectType", "Tag"],
  "IFCELECTRICDISTRIBUTIONBOARDTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELECTRICDISTRIBUTIONPOINT": ["Description", "DistributionPointFunction", "ObjectType", "Tag", "UserDefinedFunction"],
  "IFCELECTRICFLOWSTORAGEDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCELECTRICFLOWSTORAGEDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELECTRICGENERATOR": ["Description", "ObjectType", "Tag"],
  "IFCELECTRICGENERATORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELECTRICHEATERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELECTRICMOTOR": ["Description", "ObjectType", "Tag"],
  "IFCELECTRICMOTORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELECTRICTIMECONTROL": ["Description", "ObjectType", "Tag"],
  "IFCELECTRICTIMECONTROLTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCELEMENTARYSURFACE": ["Position"],
  "IFCELEMENTASSEMBLY": ["AssemblyPlace", "Description", "ObjectType", "Tag"],
  "IFCELEMENTASSEMBLYTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELEMENTCOMPONENT": ["Description", "ObjectType", "Tag"],
  "IFCELEMENTCOMPONENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELEMENTQUANTITY": ["Description", "MethodOfMeasurement"],
  "IFCELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCELLIPSE": ["Position", "SemiAxis1", "SemiAxis2"],
  "IFCELLIPSEPROFILEDEF": ["Position", "ProfileName", "ProfileType", "SemiAxis1", "SemiAxis2"],
  "IFCENERGYCONVERSIONDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCENERGYCONVERSIONDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCENERGYPROPERTIES": ["Description", "EnergySequence", "UserDefinedEnergySequence"],
  "IFCENGINE": ["Description", "ObjectType", "Tag"],
  "IFCENGINETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCENVIRONMENTALIMPACTVALUE": ["Category", "Description", "ImpactType", "UserDefinedCategory"],
  "IFCEQUIPMENTELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCEQUIPMENTSTANDARD": ["Description", "ObjectType"],
  "IFCEVAPORATIVECOOLER": ["Description", "ObjectType", "Tag"],
  "IFCEVAPORATIVECOOLERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCEVAPORATOR": ["Description", "ObjectType", "Tag"],
  "IFCEVAPORATORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCEVENT": ["Description", "EventTriggerType", "Identification", "LongDescription", "ObjectType", "UserDefinedEventTriggerType"],
  "IFCEVENTTIME": ["ActualDate", "DataOrigin", "EarlyDate", "LateDate", "ScheduleDate", "UserDefinedDataOrigin"],
  "IFCEVENTTYPE": ["ApplicableOccurrence", "Description", "EventTriggerType", "Identification", "LongDescription", "ProcessType", "UserDefinedEventTriggerType"],
  "IFCEXTENDEDMATERIALPROPERTIES": ["Description"],
  "IFCEXTENDEDPROPERTIES": ["Description"],
  "IFCEXTERNALLYDEFINEDHATCHSTYLE": ["Identification", "Location"],
  "IFCEXTERNALLYDEFINEDSURFACESTYLE": ["Identification", "Location"],
  "IFCEXTERNALLYDEFINEDSYMBOL": ["ItemReference", "Location"],
  "IFCEXTERNALLYDEFINEDTEXTFONT": ["Identification", "Location"],
  "IFCEXTERNALREFERENCE": ["Identification", "Location"],
  "IFCEXTERNALREFERENCERELATIONSHIP": ["Description"],
  "IFCEXTERNALSPATIALELEMENT": ["Description", "LongName", "ObjectType"],
  "IFCEXTERNALSPATIALSTRUCTUREELEMENT": ["Description", "LongName", "ObjectType"],
  "IFCEXTRUDEDAREASOLID": ["Depth", "Position"],
  "IFCEXTRUDEDAREASOLIDTAPERED": ["Depth", "Position"],
  "IFCFACEBOUND": ["Orientation"],
  "IFCFACEOUTERBOUND": ["Orientation"],
  "IFCFACESURFACE": ["SameSense"],
  "IFCFAILURECONNECTIONCONDITION": ["CompressionFailureX", "CompressionFailureY", "CompressionFailureZ", "TensionFailureX", "TensionFailureY", "TensionFailureZ"],
  "IFCFAN": ["Description", "ObjectType", "Tag"],
  "IFCFANTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFASTENER": ["Description", "ObjectType", "Tag"],
  "IFCFASTENERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFEATUREELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCFEATUREELEMENTADDITION": ["Description", "ObjectType", "Tag"],
  "IFCFEATUREELEMENTSUBTRACTION": ["Description", "ObjectType", "Tag"],
  "IFCFILLAREASTYLE": ["ModelorDraughting"],
  "IFCFILLAREASTYLEHATCHING": ["HatchLineAngle"],
  "IFCFILLAREASTYLETILES": ["TilingScale"],
  "IFCFILTER": ["Description", "ObjectType", "Tag"],
  "IFCFILTERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFIRESUPPRESSIONTERMINAL": ["Description", "ObjectType", "Tag"],
  "IFCFIRESUPPRESSIONTERMINALTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFIXEDREFERENCESWEPTAREASOLID": ["EndParam", "Position", "StartParam"],
  "IFCFLOWCONTROLLER": ["Description", "ObjectType", "Tag"],
  "IFCFLOWCONTROLLERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWFITTING": ["Description", "ObjectType", "Tag"],
  "IFCFLOWFITTINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWINSTRUMENT": ["Description", "ObjectType", "Tag"],
  "IFCFLOWINSTRUMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWMETER": ["Description", "ObjectType", "Tag"],
  "IFCFLOWMETERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWMOVINGDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCFLOWMOVINGDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWSEGMENT": ["Description", "ObjectType", "Tag"],
  "IFCFLOWSEGMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWSTORAGEDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCFLOWSTORAGEDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWTERMINAL": ["Description", "ObjectType", "Tag"],
  "IFCFLOWTERMINALTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLOWTREATMENTDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCFLOWTREATMENTDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFLUIDFLOWPROPERTIES": ["Description", "FlowConditionSingleValue", "PressureSingleValue", "PropertySource", "TemperatureSingleValue", "UserDefinedPropertySource", "VelocitySingleValue", "WetBulbTemperatureSingleValue"],
  "IFCFOOTING": ["Description", "ObjectType", "Tag"],
  "IFCFOOTINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFUELPROPERTIES": ["CarbonContent", "CombustionTemperature", "HigherHeatingValue", "LowerHeatingValue"],
  "IFCFURNISHINGELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCFURNISHINGELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCFURNITURE": ["Description", "ObjectType", "Tag"],
  "IFCFURNITURESTANDARD": ["Description", "ObjectType"],
  "IFCFURNITURETYPE": ["ApplicableOccurrence", "AssemblyPlace", "Description", "ElementType", "Tag"],
  "IFCGASTERMINALTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCGENERALMATERIALPROPERTIES": ["MassDensity", "MolecularWeight", "Porosity"],
  "IFCGENERALPROFILEPROPERTIES": ["CrossSectionArea", "MaximumPlateThickness", "MinimumPlateThickness", "Perimeter", "PhysicalWeight", "ProfileName"],
  "IFCGEOGRAPHICELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCGEOGRAPHICELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCGEOMETRICREPRESENTATIONCONTEXT": ["ContextIdentifier", "ContextType", "CoordinateSpaceDimension", "Precision"],
  "IFCGEOMETRICREPRESENTATIONSUBCONTEXT": ["ContextIdentifier", "ContextType", "CoordinateSpaceDimension", "Precision", "TargetScale", "TargetView", "UserDefinedTargetView"],
  "IFCGRID": ["Description", "ObjectType"],
  "IFCGRIDAXIS": ["AxisTag", "SameSense"],
  "IFCGROUP": ["Description", "ObjectType"],
  "IFCHALFSPACESOLID": ["AgreementFlag"],
  "IFCHEATEXCHANGER": ["Description", "ObjectType", "Tag"],
  "IFCHEATEXCHANGERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCHUMIDIFIER": ["Description", "ObjectType", "Tag"],
  "IFCHUMIDIFIERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCHYGROSCOPICMATERIALPROPERTIES": ["IsothermalMoistureCapacity", "LowerVaporResistanceFactor", "MoistureDiffusivity", "UpperVaporResistanceFactor", "VaporPermeability"],
  "IFCIMAGETEXTURE": ["Mode", "Parameter", "RepeatS", "RepeatT", "URLReference"],
  "IFCINDEXEDCOLOURMAP": ["ColourIndex", "Opacity"],
  "IFCINDEXEDPOLYCURVE": ["SelfIntersect"],
  "IFCINDEXEDPOLYGONALFACE": ["CoordIndex"],
  "IFCINDEXEDPOLYGONALFACEWITHVOIDS": ["CoordIndex", "InnerCoordIndices"],
  "IFCINDEXEDTRIANGLETEXTUREMAP": ["TexCoordIndex"],
  "IFCINTERCEPTOR": ["Description", "ObjectType", "Tag"],
  "IFCINTERCEPTORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCINTERSECTIONCURVE": ["MasterRepresentation"],
  "IFCINVENTORY": ["Description", "LastUpdateDate", "ObjectType"],
  "IFCIRREGULARTIMESERIES": ["DataOrigin", "Description", "EndTime", "StartTime", "TimeSeriesDataType", "UserDefinedDataOrigin"],
  "IFCIRREGULARTIMESERIESVALUE": ["TimeStamp"],
  "IFCISHAPEPROFILEDEF": ["FilletRadius", "FlangeEdgeRadius", "FlangeSlope", "FlangeThickness", "OverallDepth", "OverallWidth", "Position", "ProfileName", "ProfileType", "WebThickness"],
  "IFCJUNCTIONBOX": ["Description", "ObjectType", "Tag"],
  "IFCJUNCTIONBOXTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCLABORRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType", "Usage"],
  "IFCLABORRESOURCETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCLAGTIME": ["DataOrigin", "DurationType", "UserDefinedDataOrigin"],
  "IFCLAMP": ["Description", "ObjectType", "Tag"],
  "IFCLAMPTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCLIBRARYINFORMATION": ["Description", "Location", "Version", "VersionDate"],
  "IFCLIBRARYREFERENCE": ["Description", "Identification", "Language", "Location"],
  "IFCLIGHTDISTRIBUTIONDATA": ["LuminousIntensity", "MainPlaneAngle", "SecondaryPlaneAngle"],
  "IFCLIGHTFIXTURE": ["Description", "ObjectType", "Tag"],
  "IFCLIGHTFIXTURETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCLIGHTINTENSITYDISTRIBUTION": ["LightDistributionCurve"],
  "IFCLIGHTSOURCE": ["AmbientIntensity", "Intensity"],
  "IFCLIGHTSOURCEAMBIENT": ["AmbientIntensity", "Intensity"],
  "IFCLIGHTSOURCEDIRECTIONAL": ["AmbientIntensity", "Intensity", "Orientation"],
  "IFCLIGHTSOURCEGONIOMETRIC": ["AmbientIntensity", "ColourTemperature", "Intensity", "LightEmissionSource", "LuminousFlux", "Position"],
  "IFCLIGHTSOURCEPOSITIONAL": ["AmbientIntensity", "ConstantAttenuation", "DistanceAttenuation", "Intensity", "Position", "QuadricAttenuation", "Radius"],
  "IFCLIGHTSOURCESPOT": ["AmbientIntensity", "BeamWidthAngle", "ConcentrationExponent", "ConstantAttenuation", "DistanceAttenuation", "Intensity", "Orientation", "Position", "QuadricAttenuation", "Radius", "SpreadAngle"],
  "IFCLINEARPLACEMENT": ["Distance", "Orientation"],
  "IFCLINEARPOSITIONINGELEMENT": ["Description", "ObjectType"],
  "IFCLINESEGMENT2D": ["SegmentLength", "StartDirection"],
  "IFCLOCALTIME": ["DaylightSavingOffset", "HourComponent", "MinuteComponent", "SecondComponent"],
  "IFCLSHAPEPROFILEDEF": ["Depth", "EdgeRadius", "FilletRadius", "LegSlope", "Position", "ProfileName", "ProfileType", "Thickness", "Width"],
  "IFCMAPCONVERSION": ["Eastings", "Northings", "OrthogonalHeight", "Scale", "XAxisAbscissa", "XAxisOrdinate"],
  "IFCMATERIAL": ["Category", "Description"],
  "IFCMATERIALCONSTITUENT": ["Category", "Description", "Fraction"],
  "IFCMATERIALCONSTITUENTSET": ["Description"],
  "IFCMATERIALDEFINITIONREPRESENTATION": ["Description"],
  "IFCMATERIALLAYER": ["Category", "Description", "IsVentilated", "LayerThickness", "Priority"],
  "IFCMATERIALLAYERSET": ["Description", "LayerSetName"],
  "IFCMATERIALLAYERSETUSAGE": ["DirectionSense", "LayerSetDirection", "OffsetFromReferenceLine", "ReferenceExtent"],
  "IFCMATERIALLAYERWITHOFFSETS": ["Category", "Description", "IsVentilated", "LayerThickness", "OffsetDirection", "OffsetValues", "Priority"],
  "IFCMATERIALPROFILE": ["Category", "Description", "Priority"],
  "IFCMATERIALPROFILESET": ["Description"],
  "IFCMATERIALPROFILESETUSAGE": ["CardinalPoint", "ReferenceExtent"],
  "IFCMATERIALPROFILESETUSAGETAPERING": ["CardinalEndPoint", "CardinalPoint", "ReferenceExtent"],
  "IFCMATERIALPROFILEWITHOFFSETS": ["Category", "Description", "OffsetValues", "Priority"],
  "IFCMATERIALPROPERTIES": ["Description"],
  "IFCMATERIALRELATIONSHIP": ["Description", "Expression"],
  "IFCMECHANICALCONCRETEMATERIALPROPERTIES": ["AdmixturesDescription", "CompressiveStrength", "DynamicViscosity", "MaxAggregateSize", "PoissonRatio", "ProtectivePoreRatio", "ShearModulus", "ThermalExpansionCoefficient", "WaterImpermeability", "Workability", "YoungModulus"],
  "IFCMECHANICALFASTENER": ["Description", "NominalDiameter", "NominalLength", "ObjectType", "Tag"],
  "IFCMECHANICALFASTENERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "NominalDiameter", "NominalLength", "Tag"],
  "IFCMECHANICALMATERIALPROPERTIES": ["DynamicViscosity", "PoissonRatio", "ShearModulus", "ThermalExpansionCoefficient", "YoungModulus"],
  "IFCMECHANICALSTEELMATERIALPROPERTIES": ["DynamicViscosity", "HardeningModule", "PlasticStrain", "PoissonRatio", "ProportionalStress", "ShearModulus", "ThermalExpansionCoefficient", "UltimateStrain", "UltimateStress", "YieldStress", "YoungModulus"],
  "IFCMEDICALDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCMEDICALDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCMEMBER": ["Description", "ObjectType", "Tag"],
  "IFCMEMBERSTANDARDCASE": ["Description", "ObjectType", "Tag"],
  "IFCMEMBERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCMETRIC": ["Benchmark", "ConstraintGrade", "ConstraintSource", "CreationTime", "Description", "UserDefinedGrade", "ValueSource"],
  "IFCMIRROREDPROFILEDEF": ["Label", "Operator", "ProfileName", "ProfileType"],
  "IFCMONETARYUNIT": ["Currency"],
  "IFCMOTORCONNECTION": ["Description", "ObjectType", "Tag"],
  "IFCMOTORCONNECTIONTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCMOVE": ["Description", "IsMilestone", "ObjectType", "Priority", "PunchList", "Status", "TaskId", "WorkMethod"],
  "IFCNAMEDUNIT": ["UnitType"],
  "IFCOBJECT": ["Description", "ObjectType"],
  "IFCOBJECTDEFINITION": ["Description"],
  "IFCOBJECTIVE": ["ConstraintGrade", "ConstraintSource", "CreationTime", "Description", "LogicalAggregator", "ObjectiveQualifier", "UserDefinedGrade", "UserDefinedQualifier"],
  "IFCOCCUPANT": ["Description", "ObjectType"],
  "IFCOFFSETCURVE2D": ["Distance", "SelfIntersect"],
  "IFCOFFSETCURVE3D": ["Distance", "SelfIntersect"],
  "IFCOFFSETCURVEBYDISTANCES": ["OffsetValues", "Tag"],
  "IFCOPENINGELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCOPENINGSTANDARDCASE": ["Description", "ObjectType", "Tag"],
  "IFCOPTICALMATERIALPROPERTIES": ["SolarReflectanceBack", "SolarReflectanceFront", "SolarTransmittance", "ThermalIrEmissivityBack", "ThermalIrEmissivityFront", "ThermalIrTransmittance", "VisibleReflectanceBack", "VisibleReflectanceFront", "VisibleTransmittance"],
  "IFCORDERACTION": ["ActionID", "Description", "IsMilestone", "ObjectType", "Priority", "Status", "TaskId", "WorkMethod"],
  "IFCORGANIZATION": ["Description", "Identification"],
  "IFCORGANIZATIONRELATIONSHIP": ["Description"],
  "IFCORIENTEDEDGE": ["Orientation"],
  "IFCOUTERBOUNDARYCURVE": ["SelfIntersect"],
  "IFCOUTLET": ["Description", "ObjectType", "Tag"],
  "IFCOUTLETTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCOWNERHISTORY": ["ChangeAction", "CreationDate", "LastModifiedDate", "State"],
  "IFCPARAMETERIZEDPROFILEDEF": ["Position", "ProfileName", "ProfileType"],
  "IFCPERFORMANCEHISTORY": ["Description", "Identification", "LifeCyclePhase", "ObjectType"],
  "IFCPERMEABLECOVERINGPROPERTIES": ["Description", "FrameDepth", "FrameThickness", "OperationType", "PanelPosition"],
  "IFCPERMIT": ["Description", "Identification", "LongDescription", "ObjectType", "Status"],
  "IFCPERSON": ["FamilyName", "GivenName", "Identification", "MiddleNames", "PrefixTitles", "SuffixTitles"],
  "IFCPHYSICALCOMPLEXQUANTITY": ["Description", "Discrimination", "Quality", "Usage"],
  "IFCPHYSICALQUANTITY": ["Description"],
  "IFCPHYSICALSIMPLEQUANTITY": ["Description"],
  "IFCPILE": ["ConstructionType", "Description", "ObjectType", "Tag"],
  "IFCPILETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCPIPEFITTING": ["Description", "ObjectType", "Tag"],
  "IFCPIPEFITTINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCPIPESEGMENT": ["Description", "ObjectType", "Tag"],
  "IFCPIPESEGMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCPIXELTEXTURE": ["ColourComponents", "Height", "Mode", "Parameter", "RepeatS", "RepeatT", "Width"],
  "IFCPLACEMENT": ["Location"],
  "IFCPLANARBOX": ["SizeInX", "SizeInY"],
  "IFCPLANAREXTENT": ["SizeInX", "SizeInY"],
  "IFCPLANE": ["Position"],
  "IFCPLATE": ["Description", "ObjectType", "Tag"],
  "IFCPLATESTANDARDCASE": ["Description", "ObjectType", "Tag"],
  "IFCPLATETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCPOINTONCURVE": ["PointParameter"],
  "IFCPOINTONSURFACE": ["PointParameterU", "PointParameterV"],
  "IFCPOLYGONALBOUNDEDHALFSPACE": ["AgreementFlag", "Position"],
  "IFCPOLYGONALFACESET": ["Closed", "Coordinates", "PnIndex"],
  "IFCPORT": ["Description", "ObjectType"],
  "IFCPOSITIONINGELEMENT": ["Description", "ObjectType"],
  "IFCPOSTALADDRESS": ["AddressLines", "Country", "Description", "InternalLocation", "PostalBox", "PostalCode", "Purpose", "Region", "Town", "UserDefinedPurpose"],
  "IFCPREDEFINEDPROPERTYSET": ["Description"],
  "IFCPRESENTATIONLAYERASSIGNMENT": ["Description", "Identifier"],
  "IFCPRESENTATIONLAYERWITHSTYLE": ["Description", "Identifier", "LayerBlocked", "LayerFrozen", "LayerOn"],
  "IFCPROCEDURE": ["Description", "Identification", "LongDescription", "ObjectType"],
  "IFCPROCEDURETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ProcessType"],
  "IFCPROCESS": ["Description", "Identification", "LongDescription", "ObjectType"],
  "IFCPRODUCT": ["Description", "ObjectType"],
  "IFCPRODUCTDEFINITIONSHAPE": ["Description"],
  "IFCPRODUCTREPRESENTATION": ["Description"],
  "IFCPRODUCTSOFCOMBUSTIONPROPERTIES": ["CO2Content", "COContent", "N20Content", "SpecificHeatCapacity"],
  "IFCPROFILEDEF": ["ProfileName", "ProfileType"],
  "IFCPROFILEPROPERTIES": ["Description"],
  "IFCPROJECT": ["Description", "LongName", "ObjectType", "Phase"],
  "IFCPROJECTEDCRS": ["Description", "GeodeticDatum", "MapProjection", "MapZone", "VerticalDatum"],
  "IFCPROJECTIONELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCPROJECTLIBRARY": ["Description", "LongName", "ObjectType", "Phase"],
  "IFCPROJECTORDER": ["Description", "Identification", "LongDescription", "ObjectType", "Status"],
  "IFCPROJECTORDERRECORD": ["Description", "ObjectType"],
  "IFCPROPERTY": ["Description"],
  "IFCPROPERTYBOUNDEDVALUE": ["Description"],
  "IFCPROPERTYCONSTRAINTRELATIONSHIP": ["Description"],
  "IFCPROPERTYDEFINITION": ["Description"],
  "IFCPROPERTYDEPENDENCYRELATIONSHIP": ["Description", "Expression"],
  "IFCPROPERTYENUMERATEDVALUE": ["Description"],
  "IFCPROPERTYLISTVALUE": ["Description"],
  "IFCPROPERTYREFERENCEVALUE": ["Description", "UsageName"],
  "IFCPROPERTYSET": ["Description"],
  "IFCPROPERTYSETDEFINITION": ["Description"],
  "IFCPROPERTYSETTEMPLATE": ["ApplicableEntity", "Description", "TemplateType"],
  "IFCPROPERTYSINGLEVALUE": ["Description"],
  "IFCPROPERTYTABLEVALUE": ["CurveInterpolation", "Description", "Expression"],
  "IFCPROPERTYTEMPLATE": ["Description"],
  "IFCPROPERTYTEMPLATEDEFINITION": ["Description"],
  "IFCPROTECTIVEDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCPROTECTIVEDEVICETRIPPINGUNIT": ["Description", "ObjectType", "Tag"],
  "IFCPROTECTIVEDEVICETRIPPINGUNITTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCPROTECTIVEDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCPROXY": ["Description", "ObjectType", "ProxyType", "Tag"],
  "IFCPUMP": ["Description", "ObjectType", "Tag"],
  "IFCPUMPTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCQUANTITYAREA": ["AreaValue", "Description", "Formula"],
  "IFCQUANTITYCOUNT": ["CountValue", "Description", "Formula"],
  "IFCQUANTITYLENGTH": ["Description", "Formula", "LengthValue"],
  "IFCQUANTITYSET": ["Description"],
  "IFCQUANTITYTIME": ["Description", "Formula", "TimeValue"],
  "IFCQUANTITYVOLUME": ["Description", "Formula", "VolumeValue"],
  "IFCQUANTITYWEIGHT": ["Description", "Formula", "WeightValue"],
  "IFCRAILING": ["Description", "ObjectType", "Tag"],
  "IFCRAILINGTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCRAMP": ["Description", "ObjectType", "Tag"],
  "IFCRAMPFLIGHT": ["Description", "ObjectType", "Tag"],
  "IFCRAMPFLIGHTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCRAMPTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCRATIONALBEZIERCURVE": ["ClosedCurve", "CurveForm", "Degree", "SelfIntersect", "WeightsData"],
  "IFCRATIONALBSPLINECURVEWITHKNOTS": ["ClosedCurve", "CurveForm", "Degree", "KnotMultiplicities", "KnotSpec", "Knots", "SelfIntersect", "WeightsData"],
  "IFCRATIONALBSPLINESURFACEWITHKNOTS": ["KnotSpec", "SelfIntersect", "SurfaceForm", "UClosed", "UDegree", "UKnots", "UMultiplicities", "VClosed", "VDegree", "VKnots", "VMultiplicities", "WeightsData"],
  "IFCRECTANGLEHOLLOWPROFILEDEF": ["InnerFilletRadius", "OuterFilletRadius", "Position", "ProfileName", "ProfileType", "WallThickness", "XDim", "YDim"],
  "IFCRECTANGLEPROFILEDEF": ["Position", "ProfileName", "ProfileType", "XDim", "YDim"],
  "IFCRECTANGULARPYRAMID": ["Height", "Position", "XLength", "YLength"],
  "IFCRECTANGULARTRIMMEDSURFACE": ["U1", "U2", "Usense", "V1", "V2", "Vsense"],
  "IFCRECURRENCEPATTERN": ["DayComponent", "Interval", "MonthComponent", "Occurrences", "Position", "RecurrenceType", "WeekdayComponent"],
  "IFCREFERENCE": ["AttributeIdentifier", "InstanceName", "ListPositions", "TypeIdentifier"],
  "IFCREFERENCESVALUEDOCUMENT": ["Description"],
  "IFCREFERENT": ["Description", "ObjectType", "RestartDistance"],
  "IFCREGULARTIMESERIES": ["DataOrigin", "Description", "EndTime", "StartTime", "TimeSeriesDataType", "TimeStep", "UserDefinedDataOrigin"],
  "IFCREINFORCEMENTBARPROPERTIES": ["BarCount", "BarSurface", "EffectiveDepth", "NominalBarDiameter", "SteelGrade", "TotalCrossSectionArea"],
  "IFCREINFORCEMENTDEFINITIONPROPERTIES": ["DefinitionType", "Description"],
  "IFCREINFORCINGBAR": ["BarLength", "BarSurface", "CrossSectionArea", "Description", "NominalDiameter", "ObjectType", "SteelGrade", "Tag"],
  "IFCREINFORCINGBARTYPE": ["ApplicableOccurrence", "BarLength", "BarSurface", "BendingShapeCode", "CrossSectionArea", "Description", "ElementType", "NominalDiameter", "Tag"],
  "IFCREINFORCINGELEMENT": ["Description", "ObjectType", "SteelGrade", "Tag"],
  "IFCREINFORCINGELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCREINFORCINGMESH": ["Description", "LongitudinalBarCrossSectionArea", "LongitudinalBarNominalDiameter", "LongitudinalBarSpacing", "MeshLength", "MeshWidth", "ObjectType", "SteelGrade", "Tag", "TransverseBarCrossSectionArea", "TransverseBarNominalDiameter", "TransverseBarSpacing"],
  "IFCREINFORCINGMESHTYPE": ["ApplicableOccurrence", "BendingShapeCode", "Description", "ElementType", "LongitudinalBarCrossSectionArea", "LongitudinalBarNominalDiameter", "LongitudinalBarSpacing", "MeshLength", "MeshWidth", "Tag", "TransverseBarCrossSectionArea", "TransverseBarNominalDiameter", "TransverseBarSpacing"],
  "IFCRELAGGREGATES": ["Description"],
  "IFCRELASSIGNS": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTASKS": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTOACTOR": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTOCONTROL": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTOGROUP": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTOGROUPBYFACTOR": ["Description", "Factor", "RelatedObjectsType"],
  "IFCRELASSIGNSTOPROCESS": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTOPRODUCT": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTOPROJECTORDER": ["Description", "RelatedObjectsType"],
  "IFCRELASSIGNSTORESOURCE": ["Description", "RelatedObjectsType"],
  "IFCRELASSOCIATES": ["Description"],
  "IFCRELASSOCIATESAPPLIEDVALUE": ["Description"],
  "IFCRELASSOCIATESAPPROVAL": ["Description"],
  "IFCRELASSOCIATESCLASSIFICATION": ["Description"],
  "IFCRELASSOCIATESCONSTRAINT": ["Description", "Intent"],
  "IFCRELASSOCIATESDOCUMENT": ["Description"],
  "IFCRELASSOCIATESLIBRARY": ["Description"],
  "IFCRELASSOCIATESMATERIAL": ["Description"],
  "IFCRELASSOCIATESPROFILEPROPERTIES": ["Description"],
  "IFCRELATIONSHIP": ["Description"],
  "IFCRELAXATION": ["InitialStress", "RelaxationValue"],
  "IFCRELCONNECTS": ["Description"],
  "IFCRELCONNECTSELEMENTS": ["Description"],
  "IFCRELCONNECTSPATHELEMENTS": ["Description", "RelatedConnectionType", "RelatedPriorities", "RelatingConnectionType", "RelatingPriorities"],
  "IFCRELCONNECTSPORTS": ["Description"],
  "IFCRELCONNECTSPORTTOELEMENT": ["Description"],
  "IFCRELCONNECTSSTRUCTURALACTIVITY": ["Description"],
  "IFCRELCONNECTSSTRUCTURALELEMENT": ["Description"],
  "IFCRELCONNECTSSTRUCTURALMEMBER": ["Description", "SupportedLength"],
  "IFCRELCONNECTSWITHECCENTRICITY": ["Description", "SupportedLength"],
  "IFCRELCONNECTSWITHREALIZINGELEMENTS": ["ConnectionType", "Description"],
  "IFCRELCONTAINEDINSPATIALSTRUCTURE": ["Description"],
  "IFCRELCOVERSBLDGELEMENTS": ["Description"],
  "IFCRELCOVERSSPACES": ["Description"],
  "IFCRELDECLARES": ["Description"],
  "IFCRELDECOMPOSES": ["Description"],
  "IFCRELDEFINES": ["Description"],
  "IFCRELDEFINESBYOBJECT": ["Description"],
  "IFCRELDEFINESBYPROPERTIES": ["Description"],
  "IFCRELDEFINESBYTEMPLATE": ["Description"],
  "IFCRELDEFINESBYTYPE": ["Description"],
  "IFCRELFILLSELEMENT": ["Description"],
  "IFCRELFLOWCONTROLELEMENTS": ["Description"],
  "IFCRELINTERACTIONREQUIREMENTS": ["DailyInteraction", "Description", "ImportanceRating"],
  "IFCRELINTERFERESELEMENTS": ["Description", "ImpliedOrder", "InterferenceType"],
  "IFCRELNESTS": ["Description"],
  "IFCRELOCCUPIESSPACES": ["Description", "RelatedObjectsType"],
  "IFCRELOVERRIDESPROPERTIES": ["Description"],
  "IFCRELPROJECTSELEMENT": ["Description"],
  "IFCRELREFERENCEDINSPATIALSTRUCTURE": ["Description"],
  "IFCRELSCHEDULESCOSTITEMS": ["Description", "RelatedObjectsType"],
  "IFCRELSEQUENCE": ["Description", "SequenceType", "UserDefinedSequenceType"],
  "IFCRELSERVICESBUILDINGS": ["Description"],
  "IFCRELSPACEBOUNDARY": ["Description", "InternalOrExternalBoundary", "PhysicalOrVirtualBoundary"],
  "IFCRELSPACEBOUNDARY1STLEVEL": ["Description", "InternalOrExternalBoundary", "PhysicalOrVirtualBoundary"],
  "IFCRELSPACEBOUNDARY2NDLEVEL": ["Description", "InternalOrExternalBoundary", "PhysicalOrVirtualBoundary"],
  "IFCRELVOIDSELEMENT": ["Description"],
  "IFCREPARAMETRISEDCOMPOSITECURVESEGMENT": ["ParamLength", "SameSense", "Transition"],
  "IFCREPRESENTATION": ["RepresentationIdentifier", "RepresentationType"],
  "IFCREPRESENTATIONCONTEXT": ["ContextIdentifier", "ContextType"],
  "IFCRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType"],
  "IFCRESOURCEAPPROVALRELATIONSHIP": ["Description"],
  "IFCRESOURCECONSTRAINTRELATIONSHIP": ["Description"],
  "IFCRESOURCELEVELRELATIONSHIP": ["Description"],
  "IFCRESOURCETIME": ["ActualFinish", "ActualStart", "ActualUsage", "ActualWork", "Completion", "DataOrigin", "IsOverAllocated", "LevelingDelay", "RemainingUsage", "RemainingWork", "ScheduleContour", "ScheduleFinish", "ScheduleStart", "ScheduleUsage", "ScheduleWork", "StatusTime", "UserDefinedDataOrigin"],
  "IFCREVOLVEDAREASOLID": ["Angle", "Position"],
  "IFCREVOLVEDAREASOLIDTAPERED": ["Angle", "Position"],
  "IFCRIBPLATEPROFILEPROPERTIES": ["Direction", "ProfileName", "RibHeight", "RibSpacing", "RibWidth", "Thickness"],
  "IFCRIGHTCIRCULARCONE": ["BottomRadius", "Height", "Position"],
  "IFCRIGHTCIRCULARCYLINDER": ["Height", "Position", "Radius"],
  "IFCROOF": ["Description", "ObjectType", "Tag"],
  "IFCROOFTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCROOT": ["Description"],
  "IFCROUNDEDEDGEFEATURE": ["Description", "FeatureLength", "ObjectType", "Radius", "Tag"],
  "IFCROUNDEDRECTANGLEPROFILEDEF": ["Position", "ProfileName", "ProfileType", "RoundingRadius", "XDim", "YDim"],
  "IFCSANITARYTERMINAL": ["Description", "ObjectType", "Tag"],
  "IFCSANITARYTERMINALTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSCHEDULETIMECONTROL": ["ActualDuration", "Completion", "Description", "FinishFloat", "FreeFloat", "IsCritical", "ObjectType", "RemainingTime", "ScheduleDuration", "StartFloat", "TotalFloat"],
  "IFCSCHEDULINGTIME": ["DataOrigin", "UserDefinedDataOrigin"],
  "IFCSEAMCURVE": ["MasterRepresentation"],
  "IFCSECTIONEDSOLIDHORIZONTAL": ["FixedAxisVertical"],
  "IFCSECTIONPROPERTIES": ["SectionType"],
  "IFCSECTIONREINFORCEMENTPROPERTIES": ["LongitudinalEndPosition", "LongitudinalStartPosition", "ReinforcementRole", "TransversePosition"],
  "IFCSENSOR": ["Description", "ObjectType", "Tag"],
  "IFCSENSORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSERVICELIFE": ["Description", "ObjectType", "ServiceLifeDuration", "ServiceLifeType"],
  "IFCSERVICELIFEFACTOR": ["Description"],
  "IFCSHADINGDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCSHADINGDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSHAPEASPECT": ["Description", "ProductDefinitional"],
  "IFCSHAPEMODEL": ["RepresentationIdentifier", "RepresentationType"],
  "IFCSHAPEREPRESENTATION": ["RepresentationIdentifier", "RepresentationType"],
  "IFCSIMPLEPROPERTY": ["Description"],
  "IFCSIMPLEPROPERTYTEMPLATE": ["AccessState", "Description", "Expression", "PrimaryMeasureType", "SecondaryMeasureType", "TemplateType"],
  "IFCSITE": ["CompositionType", "Description", "LandTitleNumber", "LongName", "ObjectType", "RefElevation"],
  "IFCSIUNIT": ["Prefix", "UnitType"],
  "IFCSLAB": ["Description", "ObjectType", "Tag"],
  "IFCSLABELEMENTEDCASE": ["Description", "ObjectType", "Tag"],
  "IFCSLABSTANDARDCASE": ["Description", "ObjectType", "Tag"],
  "IFCSLABTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSLIPPAGECONNECTIONCONDITION": ["SlippageX", "SlippageY", "SlippageZ"],
  "IFCSOLARDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCSOLARDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSOUNDPROPERTIES": ["Description", "IsAttenuating", "SoundScale"],
  "IFCSOUNDVALUE": ["Description", "Frequency"],
  "IFCSPACE": ["CompositionType", "Description", "ElevationWithFlooring", "LongName", "ObjectType"],
  "IFCSPACEHEATER": ["Description", "ObjectType", "Tag"],
  "IFCSPACEHEATERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSPACEPROGRAM": ["Description", "MaxRequiredArea", "MinRequiredArea", "ObjectType", "SpaceProgramIdentifier", "StandardRequiredArea"],
  "IFCSPACETHERMALLOADPROPERTIES": ["ApplicableValueRatio", "Description", "MaximumValue", "MinimumValue", "PropertySource", "SourceDescription", "ThermalLoadSource", "ThermalLoadType", "UserDefinedPropertySource", "UserDefinedThermalLoadSource"],
  "IFCSPACETYPE": ["ApplicableOccurrence", "Description", "ElementType", "LongName", "Tag"],
  "IFCSPATIALELEMENT": ["Description", "LongName", "ObjectType"],
  "IFCSPATIALELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSPATIALSTRUCTUREELEMENT": ["CompositionType", "Description", "LongName", "ObjectType"],
  "IFCSPATIALSTRUCTUREELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSPATIALZONE": ["Description", "LongName", "ObjectType"],
  "IFCSPATIALZONETYPE": ["ApplicableOccurrence", "Description", "ElementType", "LongName", "Tag"],
  "IFCSPHERE": ["Position", "Radius"],
  "IFCSPHERICALSURFACE": ["Position", "Radius"],
  "IFCSTACKTERMINAL": ["Description", "ObjectType", "Tag"],
  "IFCSTACKTERMINALTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSTAIR": ["Description", "ObjectType", "Tag"],
  "IFCSTAIRFLIGHT": ["Description", "NumberOfRisers", "NumberOfTreads", "ObjectType", "RiserHeight", "Tag", "TreadLength"],
  "IFCSTAIRFLIGHTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSTAIRTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSTRUCTURALACTION": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType"],
  "IFCSTRUCTURALACTIVITY": ["Description", "GlobalOrLocal", "ObjectType"],
  "IFCSTRUCTURALANALYSISMODEL": ["Description", "ObjectType"],
  "IFCSTRUCTURALCONNECTION": ["Description", "ObjectType"],
  "IFCSTRUCTURALCURVEACTION": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType", "ProjectedOrTrue"],
  "IFCSTRUCTURALCURVECONNECTION": ["Description", "ObjectType"],
  "IFCSTRUCTURALCURVEMEMBER": ["Description", "ObjectType"],
  "IFCSTRUCTURALCURVEMEMBERVARYING": ["Description", "ObjectType"],
  "IFCSTRUCTURALCURVEREACTION": ["Description", "GlobalOrLocal", "ObjectType"],
  "IFCSTRUCTURALITEM": ["Description", "ObjectType"],
  "IFCSTRUCTURALLINEARACTION": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType", "ProjectedOrTrue"],
  "IFCSTRUCTURALLINEARACTIONVARYING": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType", "ProjectedOrTrue"],
  "IFCSTRUCTURALLOADCASE": ["ActionSource", "ActionType", "Coefficient", "Description", "ObjectType", "Purpose", "SelfWeightCoefficients"],
  "IFCSTRUCTURALLOADCONFIGURATION": ["Locations"],
  "IFCSTRUCTURALLOADGROUP": ["ActionSource", "ActionType", "Coefficient", "Description", "ObjectType", "Purpose"],
  "IFCSTRUCTURALLOADLINEARFORCE": ["LinearForceX", "LinearForceY", "LinearForceZ", "LinearMomentX", "LinearMomentY", "LinearMomentZ"],
  "IFCSTRUCTURALLOADPLANARFORCE": ["PlanarForceX", "PlanarForceY", "PlanarForceZ"],
  "IFCSTRUCTURALLOADSINGLEDISPLACEMENT": ["DisplacementX", "DisplacementY", "DisplacementZ", "RotationalDisplacementRX", "RotationalDisplacementRY", "RotationalDisplacementRZ"],
  "IFCSTRUCTURALLOADSINGLEDISPLACEMENTDISTORTION": ["DisplacementX", "DisplacementY", "DisplacementZ", "Distortion", "RotationalDisplacementRX", "RotationalDisplacementRY", "RotationalDisplacementRZ"],
  "IFCSTRUCTURALLOADSINGLEFORCE": ["ForceX", "ForceY", "ForceZ", "MomentX", "MomentY", "MomentZ"],
  "IFCSTRUCTURALLOADSINGLEFORCEWARPING": ["ForceX", "ForceY", "ForceZ", "MomentX", "MomentY", "MomentZ", "WarpingMoment"],
  "IFCSTRUCTURALLOADTEMPERATURE": ["DeltaTConstant", "DeltaTY", "DeltaTZ"],
  "IFCSTRUCTURALMEMBER": ["Description", "ObjectType"],
  "IFCSTRUCTURALPLANARACTION": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType", "ProjectedOrTrue"],
  "IFCSTRUCTURALPLANARACTIONVARYING": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType", "ProjectedOrTrue"],
  "IFCSTRUCTURALPOINTACTION": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType"],
  "IFCSTRUCTURALPOINTCONNECTION": ["Description", "ObjectType"],
  "IFCSTRUCTURALPOINTREACTION": ["Description", "GlobalOrLocal", "ObjectType"],
  "IFCSTRUCTURALPROFILEPROPERTIES": ["CentreOfGravityInX", "CentreOfGravityInY", "CrossSectionArea", "MaximumPlateThickness", "MaximumSectionModulusY", "MaximumSectionModulusZ", "MinimumPlateThickness", "MinimumSectionModulusY", "MinimumSectionModulusZ", "MomentOfInertiaY", "MomentOfInertiaYZ", "MomentOfInertiaZ", "Perimeter", "PhysicalWeight", "ProfileName", "ShearCentreY", "ShearCentreZ", "ShearDeformationAreaY", "ShearDeformationAreaZ", "TorsionalConstantX", "TorsionalSectionModulus", "WarpingConstant"],
  "IFCSTRUCTURALREACTION": ["Description", "GlobalOrLocal", "ObjectType"],
  "IFCSTRUCTURALRESULTGROUP": ["Description", "IsLinear", "ObjectType", "TheoryType"],
  "IFCSTRUCTURALSTEELPROFILEPROPERTIES": ["CentreOfGravityInX", "CentreOfGravityInY", "CrossSectionArea", "MaximumPlateThickness", "MaximumSectionModulusY", "MaximumSectionModulusZ", "MinimumPlateThickness", "MinimumSectionModulusY", "MinimumSectionModulusZ", "MomentOfInertiaY", "MomentOfInertiaYZ", "MomentOfInertiaZ", "Perimeter", "PhysicalWeight", "PlasticShapeFactorY", "PlasticShapeFactorZ", "ProfileName", "ShearAreaY", "ShearAreaZ", "ShearCentreY", "ShearCentreZ", "ShearDeformationAreaY", "ShearDeformationAreaZ", "TorsionalConstantX", "TorsionalSectionModulus", "WarpingConstant"],
  "IFCSTRUCTURALSURFACEACTION": ["Description", "DestabilizingLoad", "GlobalOrLocal", "ObjectType", "ProjectedOrTrue"],
  "IFCSTRUCTURALSURFACECONNECTION": ["Description", "ObjectType"],
  "IFCSTRUCTURALSURFACEMEMBER": ["Description", "ObjectType", "Thickness"],
  "IFCSTRUCTURALSURFACEMEMBERVARYING": ["Description", "ObjectType", "Thickness"],
  "IFCSTRUCTURALSURFACEREACTION": ["Description", "GlobalOrLocal", "ObjectType"],
  "IFCSTYLEDREPRESENTATION": ["RepresentationIdentifier", "RepresentationType"],
  "IFCSTYLEMODEL": ["RepresentationIdentifier", "RepresentationType"],
  "IFCSUBCONTRACTRESOURCE": ["Description", "Identification", "LongDescription", "ObjectType", "Usage"],
  "IFCSUBCONTRACTRESOURCETYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCSURFACECURVE": ["MasterRepresentation"],
  "IFCSURFACECURVESWEPTAREASOLID": ["EndParam", "Position", "StartParam"],
  "IFCSURFACEFEATURE": ["Description", "ObjectType", "Tag"],
  "IFCSURFACEOFLINEAREXTRUSION": ["Depth", "Position"],
  "IFCSURFACEOFREVOLUTION": ["Position"],
  "IFCSURFACEREINFORCEMENTAREA": ["ShearReinforcement", "SurfaceReinforcement1", "SurfaceReinforcement2"],
  "IFCSURFACESTYLE": ["Side"],
  "IFCSURFACESTYLEREFRACTION": ["DispersionFactor", "RefractionIndex"],
  "IFCSURFACESTYLERENDERING": ["ReflectanceMethod", "Transparency"],
  "IFCSURFACESTYLESHADING": ["Transparency"],
  "IFCSURFACETEXTURE": ["Mode", "Parameter", "RepeatS", "RepeatT"],
  "IFCSWEPTAREASOLID": ["Position"],
  "IFCSWEPTDISKSOLID": ["EndParam", "InnerRadius", "Radius", "StartParam"],
  "IFCSWEPTDISKSOLIDPOLYGONAL": ["EndParam", "FilletRadius", "InnerRadius", "Radius", "StartParam"],
  "IFCSWEPTSURFACE": ["Position"],
  "IFCSWITCHINGDEVICE": ["Description", "ObjectType", "Tag"],
  "IFCSWITCHINGDEVICETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCSYSTEM": ["Description", "ObjectType"],
  "IFCSYSTEMFURNITUREELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCSYSTEMFURNITUREELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCTABLECOLUMN": ["Description", "Identifier"],
  "IFCTABLEROW": ["IsHeading"],
  "IFCTANK": ["Description", "ObjectType", "Tag"],
  "IFCTANKTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCTASK": ["Description", "Identification", "IsMilestone", "LongDescription", "ObjectType", "Priority", "Status", "WorkMethod"],
  "IFCTASKTIME": ["ActualDuration", "ActualFinish", "ActualStart", "Completion", "DataOrigin", "DurationType", "EarlyFinish", "EarlyStart", "FreeFloat", "IsCritical", "LateFinish", "LateStart", "RemainingTime", "ScheduleDuration", "ScheduleFinish", "ScheduleStart", "StatusTime", "TotalFloat", "UserDefinedDataOrigin"],
  "IFCTASKTIMERECURRING": ["ActualDuration", "ActualFinish", "ActualStart", "Completion", "DataOrigin", "DurationType", "EarlyFinish", "EarlyStart", "FreeFloat", "IsCritical", "LateFinish", "LateStart", "RemainingTime", "ScheduleDuration", "ScheduleFinish", "ScheduleStart", "StatusTime", "TotalFloat", "UserDefinedDataOrigin"],
  "IFCTASKTYPE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ProcessType", "WorkMethod"],
  "IFCTELECOMADDRESS": ["Description", "ElectronicMailAddresses", "FacsimileNumbers", "MessagingIDs", "PagerNumber", "Purpose", "TelephoneNumbers", "UserDefinedPurpose", "WWWHomePageURL"],
  "IFCTENDON": ["AnchorageSlip", "CrossSectionArea", "Description", "FrictionCoefficient", "MinCurvatureRadius", "NominalDiameter", "ObjectType", "PreStress", "SteelGrade", "Tag", "TensionForce"],
  "IFCTENDONANCHOR": ["Description", "ObjectType", "SteelGrade", "Tag"],
  "IFCTENDONANCHORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCTENDONTYPE": ["ApplicableOccurrence", "CrossSectionArea", "Description", "ElementType", "NominalDiameter", "SheathDiameter", "Tag"],
  "IFCTESSELLATEDFACESET": ["Coordinates"],
  "IFCTEXTLITERAL": ["Literal", "Path"],
  "IFCTEXTLITERALWITHEXTENT": ["BoxAlignment", "Literal", "Path"],
  "IFCTEXTSTYLE": ["ModelOrDraughting"],
  "IFCTEXTSTYLEFONTMODEL": ["FontFamily", "FontStyle", "FontVariant", "FontWeight"],
  "IFCTEXTSTYLETEXTMODEL": ["TextAlign", "TextDecoration", "TextTransform"],
  "IFCTEXTSTYLEWITHBOXCHARACTERISTICS": ["BoxHeight", "BoxRotateAngle", "BoxSlantAngle", "BoxWidth"],
  "IFCTEXTURECOORDINATEGENERATOR": ["Mode", "Parameter"],
  "IFCTEXTUREVERTEX": ["Coordinates"],
  "IFCTEXTUREVERTEXLIST": ["TexCoordsList"],
  "IFCTHERMALMATERIALPROPERTIES": ["BoilingPoint", "FreezingPoint", "SpecificHeatCapacity", "ThermalConductivity"],
  "IFCTIMEPERIOD": ["EndTime", "StartTime"],
  "IFCTIMESERIES": ["DataOrigin", "Description", "EndTime", "StartTime", "TimeSeriesDataType", "UserDefinedDataOrigin"],
  "IFCTIMESERIESSCHEDULE": ["Description", "ObjectType", "TimeSeriesScheduleType"],
  "IFCTOPOLOGYREPRESENTATION": ["RepresentationIdentifier", "RepresentationType"],
  "IFCTOROIDALSURFACE": ["MajorRadius", "MinorRadius", "Position"],
  "IFCTRANSFORMER": ["Description", "ObjectType", "Tag"],
  "IFCTRANSFORMERTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCTRANSITIONCURVESEGMENT2D": ["EndRadius", "IsEndRadiusCCW", "IsStartRadiusCCW", "SegmentLength", "StartDirection", "StartRadius", "TransitionCurveType"],
  "IFCTRANSPORTELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCTRANSPORTELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCTRAPEZIUMPROFILEDEF": ["BottomXDim", "Position", "ProfileName", "ProfileType", "TopXDim", "TopXOffset", "YDim"],
  "IFCTRIANGULATEDFACESET": ["Closed", "CoordIndex", "Coordinates", "Normals", "PnIndex"],
  "IFCTRIANGULATEDIRREGULARNETWORK": ["Closed", "CoordIndex", "Coordinates", "Flags", "Normals", "PnIndex"],
  "IFCTRIMMEDCURVE": ["MasterRepresentation", "SenseAgreement"],
  "IFCTSHAPEPROFILEDEF": ["Depth", "FilletRadius", "FlangeEdgeRadius", "FlangeSlope", "FlangeThickness", "FlangeWidth", "Position", "ProfileName", "ProfileType", "WebEdgeRadius", "WebSlope", "WebThickness"],
  "IFCTUBEBUNDLE": ["Description", "ObjectType", "Tag"],
  "IFCTUBEBUNDLETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCTYPEOBJECT": ["ApplicableOccurrence", "Description"],
  "IFCTYPEPROCESS": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ProcessType"],
  "IFCTYPEPRODUCT": ["ApplicableOccurrence", "Description", "Tag"],
  "IFCTYPERESOURCE": ["ApplicableOccurrence", "Description", "Identification", "LongDescription", "ResourceType"],
  "IFCUNITARYCONTROLELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCUNITARYCONTROLELEMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCUNITARYEQUIPMENT": ["Description", "ObjectType", "Tag"],
  "IFCUNITARYEQUIPMENTTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCUSHAPEPROFILEDEF": ["Depth", "EdgeRadius", "FilletRadius", "FlangeSlope", "FlangeThickness", "FlangeWidth", "Position", "ProfileName", "ProfileType", "WebThickness"],
  "IFCVALVE": ["Description", "ObjectType", "Tag"],
  "IFCVALVETYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCVECTOR": ["Magnitude", "Orientation"],
  "IFCVIBRATIONISOLATOR": ["Description", "ObjectType", "Tag"],
  "IFCVIBRATIONISOLATORTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCVIRTUALELEMENT": ["Description", "ObjectType", "Tag"],
  "IFCVIRTUALGRIDINTERSECTION": ["OffsetDistances"],
  "IFCVOIDINGFEATURE": ["Description", "ObjectType", "Tag"],
  "IFCWALL": ["Description", "ObjectType", "Tag"],
  "IFCWALLELEMENTEDCASE": ["Description", "ObjectType", "Tag"],
  "IFCWALLSTANDARDCASE": ["Description", "ObjectType", "Tag"],
  "IFCWALLTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCWASTETERMINAL": ["Description", "ObjectType", "Tag"],
  "IFCWASTETERMINALTYPE": ["ApplicableOccurrence", "Description", "ElementType", "Tag"],
  "IFCWATERPROPERTIES": ["AcidityConcentration", "AlkalinityConcentration", "DissolvedSolidsContent", "Hardness", "ImpuritiesContent", "IsPotable", "PHLevel"],
  "IFCWINDOW": ["Description", "ObjectType", "OverallHeight", "OverallWidth", "PartitioningType", "Tag", "UserDefinedPartitioningType"],
  "IFCWINDOWLININGPROPERTIES": ["Description", "FirstMullionOffset", "FirstTransomOffset", "LiningDepth", "LiningOffset", "LiningThickness", "LiningToPanelOffsetX", "LiningToPanelOffsetY", "MullionThickness", "SecondMullionOffset", "SecondTransomOffset", "TransomThickness"],
  "IFCWINDOWPANELPROPERTIES": ["Description", "FrameDepth", "FrameThickness", "OperationType", "PanelPosition"],
  "IFCWINDOWSTANDARDCASE": ["Description", "ObjectType", "OverallHeight", "OverallWidth", "PartitioningType", "Tag", "UserDefinedPartitioningType"],
  "IFCWINDOWSTYLE": ["ApplicableOccurrence", "ConstructionType", "Description", "OperationType", "ParameterTakesPrecedence", "Sizeable", "Tag"],
  "IFCWINDOWTYPE": ["ApplicableOccurrence", "Description", "ElementType", "ParameterTakesPrecedence", "PartitioningType", "Tag", "UserDefinedPartitioningType"],
  "IFCWORKCALENDAR": ["Description", "Identification", "ObjectType"],
  "IFCWORKCONTROL": ["CreationDate", "Description", "Duration", "FinishTime", "Identification", "ObjectType", "Purpose", "StartTime", "TotalFloat"],
  "IFCWORKPLAN": ["CreationDate", "Description", "Duration", "FinishTime", "Identification", "ObjectType", "Purpose", "StartTime", "TotalFloat"],
  "IFCWORKSCHEDULE": ["CreationDate", "Description", "Duration", "FinishTime", "Identification", "ObjectType", "Purpose", "StartTime", "TotalFloat"],
  "IFCWORKTIME": ["DataOrigin", "Finish", "Start", "UserDefinedDataOrigin"],
  "IFCZONE": ["Description", "LongName", "ObjectType"],
  "IFCZSHAPEPROFILEDEF": ["Depth", "EdgeRadius", "FilletRadius", "FlangeThickness", "FlangeWidth", "Position", "ProfileName", "ProfileType", "WebThickness"],
};
