import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import { runBrowserValidation } from "./test-browser.mjs";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
rmSync("test-results/performance.json", { force: true });
process.env.NODE_ENV = "production";
process.exitCode = await runBrowserValidation("vp", [
  "test",
  "--config",
  "vitest.performance-browser.config.ts",
  "--mode",
  "production",
  "--run",
]);
