import * as WebIFC from "web-ifc";
import type { NormalizedElement } from "@ifc-qa/shared-types";
import type { IfcParseResult } from "./types.js";
import { ELEMENT_TYPE_NAMES } from "./element-types.js";
import { assertWellFormedStepFile } from "./step-well-formed.js";
import { normalizePropertyValue } from "./normalize-property-value.js";

type WebIfcLine = Record<string, any>;

function stripEnumDots(value: unknown): string | null {
  const normalized = normalizePropertyValue(value);
  return typeof normalized === "string" ? normalized.replace(/^\.|\.$/g, "") : null;
}

// Buffer-based entry point shared by the Node adapter (web-ifc-adapter.ts,
// which reads the file itself) and the browser client (apps/web), which only
// ever has an in-memory ArrayBuffer from a <input type="file"> — never a
// filesystem path. This module deliberately has no Node-only imports (no
// node:fs, node:url, etc.) so it's safe to import from a browser bundle via
// the package's "./browser" export — even a top-level `import { readFile }
// from "node:fs/promises"` elsewhere would crash a Vite browser build the
// instant the importing module is evaluated, regardless of whether it's ever
// called (confirmed empirically: "Cannot access ... in client code").
//
// `locateWasm` lets a browser caller override where web-ifc's .wasm binary is
// fetched from. web-ifc's default lookup (relative to the *importing script's*
// URL) is Node-build-specific; a Vite-bundled browser build has no filesystem
// to resolve that path against, so it must supply the real served URL itself
// (see apps/web/src/local/webIfcWasm.ts). The Node adapter never passes one,
// so web-ifc's own Node-condition build resolves its default path as before.
export async function parseWebIfcBuffer(
  raw: Uint8Array,
  locateWasm?: (path: string, prefix: string) => string
): Promise<IfcParseResult> {
  const start = performance.now();
  assertWellFormedStepFile(new TextDecoder("utf-8").decode(raw));

  const ifcApi = new WebIFC.IfcAPI();
  await ifcApi.Init(locateWasm, true);
  const modelID = ifcApi.OpenModel(new Uint8Array(raw));

  try {
    const elements: NormalizedElement[] = [];

    // Collect every IFCRELDEFINESBYPROPERTIES relationship once so each
    // element doesn't re-scan the whole model for its property sets.
    const relLineIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
    const rels: WebIfcLine[] = [];
    for (let i = 0; i < relLineIds.size(); i++) {
      rels.push(ifcApi.GetLine(modelID, relLineIds.get(i)) as WebIfcLine);
    }

    for (const typeName of ELEMENT_TYPE_NAMES) {
      const typeCode = (WebIFC as unknown as Record<string, number>)[typeName];
      if (typeCode === undefined) continue;

      const lineIds = ifcApi.GetLineIDsWithType(modelID, typeCode);
      for (let i = 0; i < lineIds.size(); i++) {
        const expressID = lineIds.get(i);
        const line = ifcApi.GetLine(modelID, expressID) as WebIfcLine;

        const propertySets: Record<string, Record<string, string | number | boolean | null>> = {};
        for (const rel of rels) {
          const related: WebIfcLine[] = rel.RelatedObjects ?? [];
          const isForThisElement = related.some((ref) => ref?.value === expressID);
          if (!isForThisElement) continue;

          const defId = rel.RelatingPropertyDefinition?.value;
          if (defId === undefined) continue;

          const propSet = ifcApi.GetLine(modelID, defId, true) as WebIfcLine;
          const psetName = normalizePropertyValue(propSet.Name);
          if (typeof psetName !== "string") continue;

          const props: Record<string, string | number | boolean | null> = {};
          for (const prop of propSet.HasProperties ?? []) {
            const propName = normalizePropertyValue(prop.Name);
            if (typeof propName !== "string") continue;
            props[propName] = normalizePropertyValue(prop.NominalValue);
          }
          propertySets[psetName] = props;
        }

        const globalId = normalizePropertyValue(line.GlobalId);
        const name = normalizePropertyValue(line.Name);

        elements.push({
          globalId: typeof globalId === "string" ? globalId : String(globalId ?? ""),
          ifcType: typeName,
          predefinedType: stripEnumDots(line.PredefinedType),
          name: typeof name === "string" ? name : null,
          attributes: {
            tag: normalizePropertyValue(line.Tag),
            description: normalizePropertyValue(line.Description),
            objectType: normalizePropertyValue(line.ObjectType),
          },
          propertySets,
        });
      }
    }

    return { elements, parseMs: performance.now() - start };
  } finally {
    ifcApi.CloseModel(modelID);
  }
}
