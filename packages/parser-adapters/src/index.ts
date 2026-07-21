export * from "./types.js";
export * from "./element-types.js";
export * from "./normalize-property-value.js";
export * from "./step-well-formed.js";
export * from "./web-ifc-adapter.js";
export * from "./ifc-lite-adapter.js";

// fixture-path.js is a test-only helper (uses node:url/node:path); it's
// deliberately not part of the public barrel so bundling this package for a
// browser client (apps/web) doesn't pull in Node-only module evaluation.
// Every test in this package already imports it directly (./fixture-path.js).
