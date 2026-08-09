import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The conformance suite is fetched rather than vendored, so it cannot be part of the gate
    // without the gate silently passing wherever the suite is absent. `test:conformance` runs it.
    exclude: ["**/node_modules/**", "**/dist/**", "src/conformance-suite.test.ts"],
  },
});
