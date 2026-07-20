import { readFile } from "node:fs/promises";
import { IfcParser, extractPropertiesOnDemand, extractAllEntityAttributes } from "@ifc-lite/parser";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult, IfcParserAdapter } from "./types.js";
import { ELEMENT_TYPE_NAMES } from "./element-types.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue } from "./normalize-property-value.js";

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" && normalized !== "" ? normalized.replace(/^\.|\.$/g, "") : null;
}

// Buffer-based entry point shared by the Node adapter (below, which reads the
// file itself) and the browser client (apps/web), which only ever has an
// in-memory ArrayBuffer from a <input type="file"> — never a filesystem path.
export async function parseIfcLiteBuffer(raw: Uint8Array): Promise<IfcParseResult> {
  const start = performance.now();
  assertWellFormedStepFile(new TextDecoder("utf-8").decode(raw));

  const parser = new IfcParser();
  const store = await parser.parseColumnar(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  );

  const elements: NormalizedElement[] = [];

  for (const typeName of ELEMENT_TYPE_NAMES) {
    const expressIds = store.entityIndex.byType.get(typeName) ?? [];

    for (const expressId of expressIds) {
      const psets = extractPropertiesOnDemand(store, expressId);
      const propertySets: Record<string, Record<string, string | number | boolean | null>> = {};
      for (const pset of psets) {
        const props: Record<string, string | number | boolean | null> = {};
        for (const prop of pset.properties) {
          props[prop.name] = normalizePropertyValue(prop.value);
        }
        propertySets[pset.name] = props;
      }

      // store.entities.getPredefinedType/getTag are optional and not
      // populated on this in-process parseColumnar() path (confirmed
      // empirically against the real installed package: both return
      // `undefined` for a wall parsed via parseColumnar()) —
      // extractAllEntityAttributes always works because it re-derives
      // named attributes from the source buffer.
      const attrs = extractAllEntityAttributes(store, expressId);
      const findAttr = (name: string) => attrs.find((a) => a.name === name)?.value ?? null;

      const name = store.entities.getName(expressId);

      elements.push({
        globalId: store.entities.getGlobalId(expressId),
        ifcType: typeName,
        predefinedType: stripEnumDots(findAttr("PredefinedType")),
        name: name === "" ? null : name,
        attributes: {
          tag: normalizePropertyValue(findAttr("Tag")),
          description: normalizePropertyValue(findAttr("Description")),
          objectType: normalizePropertyValue(findAttr("ObjectType")),
        },
        propertySets,
      });
    }
  }

  return { elements, parseMs: performance.now() - start };
}

export class IfcLiteAdapter implements IfcParserAdapter {
  async parse(filePath: string): Promise<IfcParseResult> {
    const raw = await readFile(filePath);
    return parseIfcLiteBuffer(raw);
  }
}
