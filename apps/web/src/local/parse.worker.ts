import { runParse } from "./parseWorkerCore.js";
import type { ParseRequestMessage, ParseWorkerResponse } from "./parseWorkerProtocol.js";

// The result is structured-cloned back to the page, and a large enough one fails with "Data cannot
// be cloned, out of memory" — after the whole parse has already been paid for. Say what was parsed
// and why it could not come back instead.
function resultTooLargeMessage(fileName: string, elements: number, entities: number): string {
  return (
    `${fileName} was parsed (${elements.toLocaleString("en-US")} ${elements === 1 ? "element" : "elements"}, ` +
    `${entities.toLocaleString("en-US")} ${entities === 1 ? "entity" : "entities"}) but the result is too large ` +
    `for the browser to hand back to the page. Split the model, for example by level or discipline, and parse the parts.`
  );
}

self.onmessage = async (event: MessageEvent<ParseRequestMessage>) => {
  const { requestId, engine, file } = event.data;
  try {
    const result = await runParse(file, engine, (phase, percent) => {
      const progress: ParseWorkerResponse = { type: "progress", requestId, phase, percent };
      self.postMessage(progress);
    });
    const message: ParseWorkerResponse = { type: "success", requestId, result };
    try {
      self.postMessage(message);
    } catch {
      throw new Error(resultTooLargeMessage(file.name, result.elements.length, result.idsScope.length));
    }
  } catch (error) {
    const message: ParseWorkerResponse = {
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
};
