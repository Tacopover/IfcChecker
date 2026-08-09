import { defineConfig } from "vitest/config";

/** Tier B only. The default config excludes this file; see `conformance-suite.test.ts`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/conformance-suite.test.ts"],
    testTimeout: 600_000,
  },
});
