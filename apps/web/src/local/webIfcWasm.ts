// web-ifc's browser build fetches its .wasm binary from a URL at runtime.
// Rolldown (this app's Vite bundler) can't resolve web-ifc's package.json
// export map through a `?url` suffix, so scripts/copy-web-ifc-wasm.mjs copies
// the real installed binary into public/wasm/ before every dev/build run —
// Vite serves anything under public/ unmodified at the site root.
export function locateWebIfcWasm(): string {
  return "/wasm/web-ifc.wasm";
}
