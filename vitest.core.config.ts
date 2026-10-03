import { defineConfig } from "vite-plus";

export default defineConfig({
  define: {
    __ASTRYX_TABLE_DEVELOPMENT__: "true",
    __ASTRYX_TABLE_TEST_DIAGNOSTICS__: "true",
  },
  test: {
    include: ["migration/table/src/internal/**/*.test.ts"],
    // Source-layout and UI integration contracts run in the pinned import fixture.
    exclude: [
      "**/*.browser.test.*",
      "**/benchmark-runner.test.ts",
      "**/react-compiler-contract.test.ts",
      "**/server-facet.test.ts",
    ],
    environment: "node",
  },
});
