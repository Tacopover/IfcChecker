import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { FormData as UndiciFormData, Request as UndiciRequest } from "undici";
import { File as NodeFile } from "node:buffer";
import { server } from "./mocks/server";

// jsdom's own FormData/File/Request classes don't round-trip a File's `name`
// through the real fetch()/msw interception path (undici doesn't recognize
// them as its own Blob/File-like types and silently drops the filename,
// reporting "blob" instead). Swapping these three globals for their real
// undici/Node-native counterparts fixes multipart file-upload tests while
// leaving jsdom's window/document/location untouched for component tests.
globalThis.FormData = UndiciFormData as unknown as typeof FormData;
globalThis.File = NodeFile as unknown as typeof File;
globalThis.Request = UndiciRequest as unknown as typeof Request;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
