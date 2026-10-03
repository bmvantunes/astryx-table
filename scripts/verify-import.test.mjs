import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "astryx-import-audit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "migration/table/src"), { recursive: true });
  cpSync(new URL("./verify-import.mjs", import.meta.url), join(root, "scripts/verify-import.mjs"));
  const target = "migration/table/src/example.ts";
  const content = "export const value = 1;\n";
  writeFileSync(join(root, target), content);
  writeFileSync(
    join(root, "migration/manifest.json"),
    JSON.stringify({
      files: [{ target, targetSha256: createHash("sha256").update(content).digest("hex") }],
    }),
  );
  return {
    root,
    target,
    run: (...args) =>
      spawnSync(process.execPath, ["scripts/verify-import.mjs", ...args], {
        cwd: root,
        encoding: "utf8",
      }),
  };
}

test("accepts the exact retained tree", (t) => {
  assert.equal(fixture(t).run().status, 0);
});
test("rejects changed bytes even when the source filename is unchanged", (t) => {
  const { root, target, run } = fixture(t);
  writeFileSync(join(root, target), "export const value = 2;\n");
  assert.equal(run().status, 1);
});
test("rejects a removed retained file", (t) => {
  const { root, target, run } = fixture(t);
  rmSync(join(root, target));
  assert.equal(run().status, 1);
});
test("rejects an unrecorded extensionless file", (t) => {
  const { root, run } = fixture(t);
  writeFileSync(join(root, "migration/table/UNRECORDED"), "unrecorded");
  assert.equal(run().status, 1);
});
test("rejects an incomplete inventory even when the remaining hashes match", (t) => {
  const { root, run } = fixture(t);
  const path = join(root, "migration/manifest.json");
  const manifest = JSON.parse(readFileSync(path));
  manifest.files = [];
  writeFileSync(path, JSON.stringify(manifest));
  assert.equal(run().status, 1);
});

test("rejects an unrecorded hidden source file", (t) => {
  const { root, run } = fixture(t);
  writeFileSync(join(root, "migration/table/src/.unrecorded.ts"), "export {};\n");
  assert.equal(run().status, 1);
});
test("rejects an unrecorded file inside a hidden directory", (t) => {
  const { root, run } = fixture(t);
  mkdirSync(join(root, "migration/table/.hidden"));
  writeFileSync(join(root, "migration/table/.hidden/source.ts"), "export {};\n");
  assert.equal(run().status, 1);
});

test("verifies source names containing Unicode, tabs and newlines exactly", (t) => {
  const { root, target, run } = fixture(t);
  const repository = join(root, "source");
  mkdirSync(repository);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const git = (...args) =>
    execFileSync("git", ["-C", repository, ...args], { env })
      .toString()
      .trim();
  git("init", "--quiet");
  const source = "données\tline\n.ts";
  const bytes = readFileSync(join(root, target));
  writeFileSync(join(repository, source), bytes);
  git("add", "--all");
  const revision = git("write-tree");
  const object = git("hash-object", "--", source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(
    join(root, "migration/manifest.json"),
    JSON.stringify({
      revision,
      files: [
        {
          source,
          mode: "100644",
          object,
          sourceSha256: hash,
          target,
          targetSha256: hash,
          disposition: "reference",
        },
      ],
    }),
  );
  const result = run(repository);
  assert.equal(result.status, 0, result.stderr);
});
