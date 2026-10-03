import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("../migration/manifest.json", import.meta.url)));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const retained = manifest.files.filter((file) => file.target);
function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    assert.ok(entry.isFile(), `Import evidence must be an ordinary file: ${path}`);
    return [relative(root, path)];
  });
}
const actual = ["migration/table", "migration/reference"].flatMap((path) =>
  listFiles(join(root, path)),
);
assert.deepEqual(
  actual.sort(),
  retained.map((file) => file.target).sort(),
  "Import inventory drift",
);
for (const file of retained) {
  assert.equal(
    digest(readFileSync(new URL(`../${file.target}`, import.meta.url))),
    file.targetSha256,
    file.target,
  );
}
const repository = process.argv[2];
if (repository) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const git = (...args) => execFileSync("git", ["-C", repository, ...args], { env });
  const tree = git("ls-tree", "-r", "-z", manifest.revision).toString().split("\0").filter(Boolean);
  assert.equal(tree.length, manifest.files.length, "Incomplete source inventory");
  for (const [index, entry] of tree.entries()) {
    const separator = entry.indexOf("\t");
    const metadata = entry.slice(0, separator);
    const source = entry.slice(separator + 1);
    const [mode, kind, object] = metadata.split(" ");
    const file = manifest.files[index];
    assert.deepEqual(
      { source, mode, object },
      { source: file.source, mode: file.mode, object: file.object },
    );
    if (kind !== "blob") continue;
    const bytes = git("cat-file", "blob", object);
    assert.equal(digest(bytes), file.sourceSha256, source);
    if (!file.target) continue;
    let expected = bytes;
    if (file.disposition === "mechanical") {
      expected = Buffer.from(
        manifest.rules.reduce((text, [from, to]) => text.replaceAll(from, to), bytes.toString()),
      );
    }
    assert.equal(digest(expected), file.targetSha256, `Non-mechanical change: ${source}`);
  }
}
console.log(
  `Verified ${retained.length} retained files; ${manifest.files.length} source dispositions${repository ? " against pinned Git source" : " (supply a source Git checkout to verify origin)"}.`,
);
