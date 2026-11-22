import { defineConfig } from "vitest/config";

/** Unit tests for the frontend logic that does not need a browser (npm test). */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    unstubGlobals: true,
  },
});
