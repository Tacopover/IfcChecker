/**
 * Fixed allowlist of physical building-element IFC type names, iterated
 * identically by WebIfcAdapter and IfcLiteAdapter so a Run's engine
 * comparison measures parse speed only, never a difference in which
 * elements each engine happened to enumerate.
 */
export const ELEMENT_TYPE_NAMES = [
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCSLAB",
  "IFCBEAM",
  "IFCCOLUMN",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCROOF",
  "IFCSTAIR",
  "IFCRAILING",
  "IFCSPACE",
  "IFCCOVERING",
  "IFCFURNISHINGELEMENT",
  "IFCPIPESEGMENT",
  "IFCDUCTSEGMENT",
  "IFCFLOWTERMINAL",
  "IFCFLOWFITTING",
] as const;

export type ElementTypeName = (typeof ELEMENT_TYPE_NAMES)[number];
