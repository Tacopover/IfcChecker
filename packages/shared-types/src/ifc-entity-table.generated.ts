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
