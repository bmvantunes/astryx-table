import { defineConfig } from "vite-plus";
import { appPlugins } from "./config/plugins";
import { libraryPlugins } from "./config/library-plugins";
import coreProvenance from "./packages/table/core-provenance.json";

export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: [
      "@astryxdesign/core/Toolbar",
      "@astryxdesign/core/Divider",
      "@astryxdesign/core/Button",
      "@astryxdesign/core/Banner",
      "@astryxdesign/core/Skeleton",
      "@astryxdesign/core/EmptyState",
      "@astryxdesign/core/TextInput",
      "@astryxdesign/core/Selector",
      "@astryxdesign/core/MultiSelector",
      "@astryxdesign/core/List",
      "@astryxdesign/core/Text",
      "@astryxdesign/core/Stack",
      "@astryxdesign/core/VisuallyHidden",
      "@astryxdesign/core/CheckboxInput",
      "@astryxdesign/core/Popover",
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-table",
      "@tanstack/react-pacer",
      "@tanstack/react-hotkeys",
    ],
  },
  define: { __ASTRYX_TABLE_DEVELOPMENT__: "true", __ASTRYX_TABLE_TEST_DIAGNOSTICS__: "true" },
  // Byte-exact imported modules are checked by verify:import and verify:active-core.
  // They still participate in lint, typechecking and regression tests.
  fmt: {
    ignorePatterns: [
      "migration/**",
      ...[...coreProvenance.files, ...coreProvenance.tests].map(({ target }) => target),
    ],
  },
  lint: { ignorePatterns: ["migration/**"] },
  // Public helper tests import the compiled Client entry; keep the same compiler policy.
  plugins: appPlugins(),
  test: { include: ["src/**/*.test.ts", "packages/table/tests/**/*.test.ts"], environment: "node" },
  pack: {
    entry: ["packages/table/src/index.ts"],
    outDir: "packages/table/dist",
    dts: true,
    plugins: libraryPlugins(),
    deps: { onlyBundle: ["effect-view-server"] },
    outputOptions: { banner: '"use client";' },
  },
});
