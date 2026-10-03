// Re-prove the mechanical rename against its original UI/toolchain in a disposable
// checkout. Nothing from this fixture is an AstryxTable runtime dependency.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = process.argv[2];
assert.ok(source, "Pass a Git checkout containing the pinned shadcn-table commit.");
const manifest = JSON.parse(readFileSync(join(root, "migration/manifest.json")));
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
);
function run(command, args, cwd) {
  const isolated = {
    ...env,
    CI: "true",
    PWD: cwd,
    PATH: [
      join(cwd, "node_modules/.bin"),
      ...(env.PATH ?? "").split(delimiter).filter((path) => path && !path.includes("node_modules")),
    ].join(delimiter),
  };
  delete isolated.NODE_PATH;
  console.log(`Running ${command} ${args.join(" ")} in ${cwd}`);
  const result = spawnSync(command, args, {
    cwd,
    env: isolated,
    stdio: "inherit",
    timeout: 600_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed`);
}
run(process.execPath, ["scripts/verify-import.mjs", source], root);
const directory = mkdtempSync(join(tmpdir(), "astryx-import-verification-"));
console.log(`Pinned import fixture: ${directory}`);
const archive = join(directory, "source.tar");
run(
  "git",
  ["-C", source, "archive", "--format=tar", `--output=${archive}`, manifest.revision],
  root,
);
run("tar", ["-xf", archive], directory);
run("vp", ["install", "--frozen-lockfile"], directory);
run("vp", ["run", "@bruno/shadcn#build"], directory);
// Replace the table source as a complete tree so renamed files cannot coexist.
// mv retains the pristine original as evidence outside every source glob.
run("mv", ["packages/table/src", "original-table-source"], directory);
for (const file of manifest.files.filter((entry) => entry.disposition === "mechanical")) {
  const target = join(directory, file.target.replace("migration/table/", "packages/table/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, readFileSync(join(root, file.target)));
}
// Fixture-only compiler defines must follow the renamed source's global names.
for (const file of [
  "packages/table/vite.config.ts",
  "packages/table/config/production-defines.js",
]) {
  const path = join(directory, file);
  const text = readFileSync(path, "utf8");
  writeFileSync(
    path,
    manifest.rules.reduce((value, [from, to]) => value.replaceAll(from, to), text),
  );
}
run(
  "vp",
  ["exec", "tsc", "--project", "tsconfig.type-tests.json"],
  join(directory, "packages/table"),
);
run(
  "vp",
  ["test", "--run", "--exclude", "src/**/*.browser.test.tsx"],
  join(directory, "packages/table"),
);
console.log(
  `Retained type and Node tests passed in ${directory}. This is import evidence, not Astryx renderer parity.`,
);
