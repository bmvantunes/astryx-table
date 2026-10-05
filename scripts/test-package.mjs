import { mkdtempSync, readFileSync, writeFileSync, cpSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { runBrowserValidation } from "./test-browser.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "astryx-installed-consumer-"));
const versions = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", timeout: 120_000 });
  if (result.error || result.status !== 0)
    throw result.error ?? new Error(`${command} failed (${result.status})`);
}
console.log(`Installed consumer evidence: ${directory}`);
run("vp", ["pack"], root);
run("pnpm", ["pack", "--pack-destination", directory], resolve(root, "packages/table"));
const tarball = readdirSync(directory).find((file) => file.endsWith(".tgz"));
if (!tarball) throw new Error("No package tarball was created.");
cpSync(resolve(root, "scripts/fixtures/consumer"), directory, { recursive: true });
function consumerFixture(path, sourceImport) {
  const text = readFileSync(resolve(root, path), "utf8");
  if (!text.includes(sourceImport))
    throw new Error(`Consumer fixture ${path} lacks expected import ${sourceImport}`);
  return text.replaceAll(sourceImport, 'from "@bmvantunes/astryx-table"');
}
for (const name of ["client-types.tsx", "select-aggregation.test-d.ts"]) {
  writeFileSync(
    join(directory, name),
    consumerFixture(`packages/table/tests/${name}`, 'from "../src"'),
  );
}
cpSync(
  resolve(root, "config/browser-accessibility.ts"),
  join(directory, "browser-accessibility.ts"),
);
for (const name of [
  "client-capabilities.browser.test.tsx",
  "client-query-errors.browser.test.tsx",
  "client-row-selection.browser.test.tsx",
  "client-cell-range.browser.test.tsx",
  "client-pointer-range.browser.test.tsx",
  "client-grouping.browser.test.tsx",
  "source-lifecycle.browser.test.tsx",
  "client-toolbar.browser.test.tsx",
  "client-column-layout.browser.test.tsx",
  "client-column-resize.browser.test.tsx",
  "client-column-reorder.browser.test.tsx",
  "client-navigation.browser.test.tsx",
  "client-filter.browser.test.tsx",
  "active-filters.browser.test.tsx",
  "quick-filter.browser.test.tsx",
  "compound-filters.browser.test.tsx",
  "column-preferences.browser.test.tsx",
  "sort-controls.browser.test.tsx",
  "row-counts.browser.test.tsx",
  "filter-controls.browser.test.tsx",
]) {
  writeFileSync(
    join(directory, name),
    consumerFixture(`src/${name}`, 'from "../packages/table/src"').replace(
      'import "./styles.css";',
      'import "@astryxdesign/core/reset.css";\nimport "@astryxdesign/core/astryx.css";\nimport "@astryxdesign/theme-neutral/theme.css";\nimport "@bmvantunes/astryx-table/styles.css";',
    ),
  );
}
const dependencies = { "@bmvantunes/astryx-table": `file:${join(directory, tarball)}` };
for (const name of [
  "@astryxdesign/core",
  "@astryxdesign/theme-neutral",
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
  "@types/node",
  "typescript",
  "vitest",
  "vitest-browser-react",
  "playwright",
  "@vitest/browser-playwright",
])
  dependencies[name] = versions.dependencies[name] ?? versions.devDependencies[name];
dependencies["vite-plus"] = createRequire(import.meta.url)("vite-plus/package.json").version;
writeFileSync(
  join(directory, "package.json"),
  JSON.stringify(
    {
      name: "astryx-installed-consumer",
      private: true,
      type: "module",
      packageManager: versions.packageManager,
      scripts: { typecheck: "tsc --noEmit" },
      dependencies,
    },
    null,
    2,
  ),
);
writeFileSync(
  join(directory, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2023",
        lib: ["ES2023", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
      },
      include: ["client-types.tsx", "select-aggregation.test-d.ts"],
    },
    null,
    2,
  ),
);
run("pnpm", ["install", "--ignore-scripts"]);
if (existsSync(join(directory, "node_modules/effect")))
  throw new Error("The standalone root consumer unexpectedly requires Effect.");
const consumerRequire = createRequire(join(directory, "package.json"));
const entry = consumerRequire.resolve("@bmvantunes/astryx-table");
if (!entry.endsWith("/dist/index.mjs"))
  throw new Error(`Consumer did not resolve emitted JavaScript: ${entry}`);
const css = readFileSync(consumerRequire.resolve("@bmvantunes/astryx-table/styles.css"), "utf8");
if (!/overflow:\s*clip/.test(css) || !css.includes("--color-border"))
  throw new Error("Package CSS lacks the renderer styles/theme tokens.");
run("vp", ["run", "typecheck"]);
process.chdir(directory);
const code = await runBrowserValidation("vp", ["test", "--config", "vitest.config.ts", "--run"]);
process.chdir(root);
if (code !== 0) process.exitCode = code;

// First prove the root consumer above without Effect. Only the real Server
// integration fixture below opts into the published View Server toolchain.
if (code === 0) {
  for (const name of ["effect", "effect-view-server", "@effect/atom-react"])
    dependencies[name] = versions.devDependencies[name];
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ ...manifest, dependencies }, null, 2),
  );
  writeFileSync(
    join(directory, "server-types.tsx"),
    consumerFixture("packages/table/tests/server-types.tsx", 'from "../src"'),
  );
  const config = JSON.parse(readFileSync(join(directory, "tsconfig.json"), "utf8"));
  writeFileSync(
    join(directory, "tsconfig.json"),
    JSON.stringify(
      {
        ...config,
        compilerOptions: { ...config.compilerOptions, types: ["node"] },
        include: [...config.include, "server-types.tsx"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(directory, "server.browser.test.tsx"),
    consumerFixture("src/server.browser.test.tsx", 'from "../packages/table/src"').replace(
      'import "./styles.css";',
      'import "@astryxdesign/core/reset.css";\nimport "@astryxdesign/core/astryx.css";\nimport "@astryxdesign/theme-neutral/theme.css";\nimport "@bmvantunes/astryx-table/styles.css";',
    ),
  );
  // This temporary consumer intentionally gains dependencies after the Effect-free phase.
  // Refresh its generated lockfile even when the outer runner sets CI=true.
  run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"]);
  run("vp", ["run", "typecheck"]);
  process.chdir(directory);
  const serverCode = await runBrowserValidation("vp", [
    "test",
    "--config",
    "vitest.server.config.ts",
    "--run",
    "server.browser.test.tsx",
  ]);
  process.chdir(root);
  if (serverCode !== 0) process.exitCode = serverCode;
}

// Conditional dependency-patch evidence is deliberately separate from the two
// unpatched consumer phases above. pnpm workspace patches do not travel inside
// the library tarball. Issue #16 must resolve this before npm publication.
if (code === 0 && !process.exitCode) {
  console.log("Conditional iframe evidence: explicitly applying @tanstack/hotkeys@0.8.0 patch");
  cpSync(
    resolve(root, "patches/@tanstack__hotkeys@0.8.0.patch"),
    join(directory, "hotkeys-iframe.patch"),
  );
  writeFileSync(
    join(directory, "pnpm-workspace.yaml"),
    'patchedDependencies:\n  "@tanstack/hotkeys@0.8.0": hotkeys-iframe.patch\n',
  );
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  manifest.dependencies["@tanstack/react-hotkeys"] =
    versions.dependencies["@tanstack/react-hotkeys"];
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(
    join(directory, "client-iframe-hotkeys.browser.test.tsx"),
    consumerFixture(
      "src/client-iframe-hotkeys.browser.test.tsx",
      'from "../packages/table/src"',
    ).replace(
      'import "./styles.css";',
      'import "@astryxdesign/core/reset.css";\nimport "@astryxdesign/core/astryx.css";\nimport "@astryxdesign/theme-neutral/theme.css";\nimport "@bmvantunes/astryx-table/styles.css";',
    ),
  );
  run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"]);
  process.chdir(directory);
  const iframeCode = await runBrowserValidation("vp", [
    "test",
    "--config",
    "vitest.config.ts",
    "--run",
    "client-iframe-hotkeys.browser.test.tsx",
  ]);
  process.chdir(root);
  if (iframeCode !== 0) process.exitCode = iframeCode;
}
