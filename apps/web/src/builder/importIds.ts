import { idsXmlToDrafts, type IdsImportResult } from "@ifc-qa/ids-validator";
import { nextDraftId } from "./draftIds.js";

export type ImportOutcome =
  | { ok: true; result: IdsImportResult }
  | { ok: false; message: string };

/** The importer mints its own ids; re-key onto the page's counter so they cannot collide. */
function rekey(result: IdsImportResult): IdsImportResult {
  return {
    ...result,
    rules: result.rules.map((rule) => ({
      ...rule,
      id: nextDraftId("r"),
      conditions: rule.conditions.map((condition) => ({ ...condition, id: nextDraftId("c") })),
    })),
  };
}

/**
 * A file the page can show, or the one sentence explaining why not. A document with no
 * specifications is called out rather than silently emptying the builder: it is almost always the
 * wrong file, and "nothing happened" is the least useful thing to show for that.
 */
export function importIdsText(fileName: string, text: string): ImportOutcome {
  let result: IdsImportResult;
  try {
    result = idsXmlToDrafts(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `${fileName} could not be read as XML: ${detail}` };
  }

  if (result.rules.length === 0 && result.refused.length === 0) {
    return { ok: false, message: `${fileName} contains no IDS specifications.` };
  }
  return { ok: true, result: rekey(result) };
}
