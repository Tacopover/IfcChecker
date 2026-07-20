// web-ifc's browser build fetches its .wasm binary at runtime from a URL —
// it has no filesystem to read from in a browser, so Vite must serve the file
// as a static asset. Rolldown (this repo's Vite bundler) can't resolve
// `web-ifc/web-ifc.wasm?url` through web-ifc's package.json export map (a real
// resolver limitation, confirmed by testing both `vite build` and `vitest`),
// so instead this copies the real installed binary into public/ before every
// dev/build run, where Vite serves it unmodified at a fixed path.
import { createRequire } from "node:module";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const wasmSrc = require.resolve("web-ifc/web-ifc.wasm");

const __dirname = dirname(fileURLToPath(import.meta.url));
const destDir = join(__dirname, "..", "public", "wasm");
const dest = join(destDir, "web-ifc.wasm");

await mkdir(destDir, { recursive: true });
await copyFile(wasmSrc, dest);
console.log(`[copy-web-ifc-wasm] ${wasmSrc} -> ${dest}`);
