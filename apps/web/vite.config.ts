import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // @testing-library/react's automatic between-test DOM cleanup only
    // registers when `afterEach` is available as a true global — without
    // this, render() output from one test leaks into the next.
    globals: true,
  },
});
