import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const workspaceRoot = new URL("../", import.meta.url);
const manifests = [
  "package.json",
  ...globSync("packages/*/package.json", { cwd: fileURLToPath(workspaceRoot) }).sort(),
].map((path) => ({
  path,
  manifest: JSON.parse(readFileSync(new URL(path, workspaceRoot), "utf8")),
}));

test.each(manifests)("$path remains non-publishable", ({ manifest }) => {
  expect(manifest.private).toBe(true);
});

test.each(manifests)("$path has no legacy UI dependencies", ({ manifest }) => {
  const names = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  });
  expect(names.filter((name) => /tailwind|base-ui|shadcn/.test(name))).toEqual([]);
});

test("the root retains its toolchain and exact patched StyleX version", () => {
  const manifest = manifests[0]!.manifest;
  const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  expect(names).toContain("vite-plus");
  expect(names).toContain("@astryxdesign/core");
  expect(manifest.devDependencies["@stylexjs/unplugin"]).toBe("0.19.0");
});
