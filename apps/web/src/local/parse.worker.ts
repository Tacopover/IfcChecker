import { runParse } from "./parseWorkerCore.js";
import type { ParseRequestMessage, ParseWorkerResponse } from "./parseWorkerProtocol.js";

self.onmessage = async (event: MessageEvent<ParseRequestMessage>) => {
  const { requestId, engine, file } = event.data;
  try {
    const result = await runParse(file, engine);
    const message: ParseWorkerResponse = { type: "success", requestId, result };
    self.postMessage(message);
  } catch (error) {
    const message: ParseWorkerResponse = {
      type: "error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
};
