// The bundled example .ids files a user can try without sourcing their own live in fixtures/ids/
// at the repo root, alongside the fixtures/ifc/*.ifc convention for held-out sample files — not
// under apps/web, so nothing there is ever bundled into the shipped app. This copies them into
// public/ before every dev/build run, the same way copy-web-ifc-wasm.mjs stages web-ifc's binary,
// so Vite serves them at a fixed path the picker can fetch() at runtime.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "..", "..", "..", "fixtures", "ids");
const destDir = join(__dirname, "..", "public", "examples", "ids");

await mkdir(destDir, { recursive: true });
const entries = await readdir(srcDir);
const idsFiles = entries.filter((name) => name.endsWith(".ids"));
for (const name of idsFiles) {
  await copyFile(join(srcDir, name), join(destDir, name));
}
console.log(`[copy-example-ids] ${idsFiles.length} file(s) -> ${destDir}`);
