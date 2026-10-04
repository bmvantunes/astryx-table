import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import { runBrowserValidation } from "./test-browser.mjs";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
rmSync("test-results/performance.json", { force: true });
process.env.NODE_ENV = "production";
// The expanded suite includes grouped scroll (~20s) and grouped live (~6s)
// on top of the prior ~159s run. Per-scenario work and
// cadence budgets remain enforced by the unchanged production assertions.
process.exitCode = await runBrowserValidation(
  "vp",
  ["test", "--config", "vitest.performance-browser.config.ts", "--mode", "production", "--run"],
  240_000,
);
