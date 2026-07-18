import { XMLParser } from "fast-xml-parser";

export interface ParsedAttributeFacet {
  kind: "attribute";
  name: string;
  patternSource: string | null;
  pattern: RegExp | null;
}

export interface ParsedPropertyFacet {
  kind: "property";
  propertySet: string;
  baseName: string;
  dataType: string | null;
}

export type ParsedRequirementFacet = ParsedAttributeFacet | ParsedPropertyFacet;

export interface ParsedSpecification {
  name: string;
  applicabilityEntityNames: string[];
  requirements: ParsedRequirementFacet[];
}

interface RawSimpleValueContainer {
  simpleValue?: string | number | boolean;
}

interface RawEntityFacet {
  name?: RawSimpleValueContainer;
}

interface RawApplicability {
  entity?: RawEntityFacet[];
  [otherFacet: string]: unknown;
}

interface RawAttributeFacet {
  name?: RawSimpleValueContainer;
  value?: {
    restriction?: {
      pattern?: { "@_value"?: string };
    };
  };
}

interface RawPropertyFacet {
  "@_dataType"?: string;
  propertySet?: RawSimpleValueContainer;
  baseName?: RawSimpleValueContainer;
}

interface RawRequirements {
  attribute?: RawAttributeFacet[];
  property?: RawPropertyFacet[];
  [otherFacet: string]: unknown;
}

interface RawSpecification {
  "@_name": string;
  applicability?: RawApplicability;
  requirements?: RawRequirements;
}

interface RawIdsDocument {
  ids?: {
    specifications?: {
      specification?: RawSpecification[];
    };
  };
}

const FORCE_ARRAY_PATHS = new Set([
  "ids.specifications.specification",
  "ids.specifications.specification.applicability.entity",
  "ids.specifications.specification.requirements.attribute",
  "ids.specifications.specification.requirements.property",
]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: true,
  isArray: (_tagName, jPath) => FORCE_ARRAY_PATHS.has(jPath as string),
});

function readSimpleValue(node: RawSimpleValueContainer | undefined): string | null {
  if (!node || node.simpleValue === undefined || node.simpleValue === null) {
    return null;
  }
  return String(node.simpleValue);
}

export function parseIdsXml(idsXml: string): ParsedSpecification[] {
  const document = xmlParser.parse(idsXml) as RawIdsDocument;
  const rawSpecifications = document.ids?.specifications?.specification ?? [];

  return rawSpecifications.map((rawSpec) => parseSpecification(rawSpec));
}

function parseSpecification(rawSpec: RawSpecification): ParsedSpecification {
  const name = rawSpec["@_name"];
  const rawApplicability = rawSpec.applicability ?? {};
  const applicabilityEntityNames = (rawApplicability.entity ?? [])
    .map((entity) => readSimpleValue(entity.name))
    .filter((value): value is string => value !== null);

  for (const key of Object.keys(rawApplicability)) {
    if (key !== "entity" && !key.startsWith("@_")) {
      console.warn(
        `ids-validator: skipping unsupported applicability facet "<${key}>" in specification "${name}"`
      );
    }
  }

  const rawRequirements = rawSpec.requirements ?? {};
  const requirements: ParsedRequirementFacet[] = [
    ...parseAttributeFacets(rawRequirements.attribute ?? []),
    ...parsePropertyFacets(rawRequirements.property ?? []),
  ];

  for (const key of Object.keys(rawRequirements)) {
    if (key !== "attribute" && key !== "property" && !key.startsWith("@_")) {
      console.warn(
        `ids-validator: skipping unsupported requirement facet "<${key}>" in specification "${name}"`
      );
    }
  }

  return { name, applicabilityEntityNames, requirements };
}

function parseAttributeFacets(rawAttributes: RawAttributeFacet[]): ParsedAttributeFacet[] {
  const facets: ParsedAttributeFacet[] = [];
  for (const rawAttribute of rawAttributes) {
    const name = readSimpleValue(rawAttribute.name);
    if (name === null) continue;
    const patternSource = rawAttribute.value?.restriction?.pattern?.["@_value"] ?? null;
    facets.push({
      kind: "attribute",
      name,
      patternSource,
      pattern: patternSource ? new RegExp(`^(?:${patternSource})$`) : null,
    });
  }
  return facets;
}

function parsePropertyFacets(rawProperties: RawPropertyFacet[]): ParsedPropertyFacet[] {
  const facets: ParsedPropertyFacet[] = [];
  for (const rawProperty of rawProperties) {
    const propertySet = readSimpleValue(rawProperty.propertySet);
    const baseName = readSimpleValue(rawProperty.baseName);
    if (propertySet === null || baseName === null) continue;
    facets.push({
      kind: "property",
      propertySet,
      baseName,
      dataType: rawProperty["@_dataType"] ?? null,
    });
  }
  return facets;
}
