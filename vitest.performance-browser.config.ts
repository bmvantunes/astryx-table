import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { Reporter } from "vitest/node";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { appPlugins } from "./config/plugins";

if (process.env.NODE_ENV !== "production") {
  throw new Error("Performance Browser tests require NODE_ENV=production.");
}
const startCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const startedClean =
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "";
const evidenceReporter: Reporter = {
  onTestRunEnd(modules, errors, reason) {
    const tests = modules.flatMap((module) =>
      [...module.children.allTests()].map((test) => ({
        name: test.fullName,
        state: test.result().state,
        evidence: test
          .annotations()
          .filter((annotation) => annotation.type === "benchmark")
          .map((annotation) => JSON.parse(annotation.message) as unknown),
      })),
    );
    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      "test-results/performance.json",
      JSON.stringify(
        {
          version: 1,
          startCommit,
          startedClean,
          commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          clean: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() === "",
          completedAt: new Date().toISOString(),
          reason,
          unhandledErrors: errors.length,
          tests,
        },
        null,
        2,
      ) + "\n",
    );
  },
};

export default defineConfig({
  define: { __ASTRYX_TABLE_DEVELOPMENT__: "false", __ASTRYX_TABLE_TEST_DIAGNOSTICS__: "true" },
  plugins: appPlugins(),
  resolve: { alias: { "react-dom/client": "react-dom/profiling" }, dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: [
      "effect",
      "effect-view-server/config",
      "effect-view-server/react",
      "react",
      "@tanstack/react-pacer",
      "react-dom/client",
      "react/jsx-runtime",
      "@astryxdesign/core/Toolbar",
      "@astryxdesign/core/Stack",
      "@astryxdesign/core/Divider",
      "@astryxdesign/core/Button",
      "@astryxdesign/core/Text",
      "@astryxdesign/core/Banner",
      "@astryxdesign/core/Skeleton",
      "@astryxdesign/core/EmptyState",
      "@astryxdesign/core/TextInput",
      "@astryxdesign/core/Selector",
      "@astryxdesign/core/MultiSelector",
      "@astryxdesign/core/List",
      "@astryxdesign/core/VisuallyHidden",
      "@astryxdesign/core/CheckboxInput",
      "@astryxdesign/core/Popover",
      "@astryxdesign/core/Table",
      "@astryxdesign/core/DropdownMenu",
      "vitest-browser-react",
    ],
  },
  test: {
    name: "astryx-performance",
    reporters: ["default", evidenceReporter],
    fileParallelism: false,
    include: ["src/**/*.performance.browser.test.tsx"],
    setupFiles: ["src/performance-browser.setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1440, height: 900 } }],
    },
  },
});
