import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // @ifc-lite/geometry spawns its worker pool with the standard
  // `new Worker(new URL(...), { type: "module" })` pattern, which Vite's
  // default iife worker format cannot host.
  worker: { format: "es" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // @testing-library/react's automatic between-test DOM cleanup only
    // registers when `afterEach` is available as a true global — without
    // this, render() output from one test leaks into the next.
    globals: true,
  },
});
