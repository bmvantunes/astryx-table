import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";

test("the workspace is non-publishable and has no legacy UI dependencies", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(manifest.private).toBe(true);
  const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  expect(names).toContain("vite-plus");
  expect(names).toContain("@astryxdesign/core");
  expect(names.filter((name) => /tailwind|base-ui|shadcn/.test(name))).toEqual([]);
});
