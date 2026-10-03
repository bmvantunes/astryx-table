import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("packages/table/core-provenance.json", root), "utf8"),
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const file of [...manifest.files, ...manifest.tests]) {
  const source = readFileSync(new URL(file.source, root));
  if (file.sourceSha256 && hash(source) !== file.sourceSha256)
    throw new Error(`Source evidence changed: ${file.source}`);
  let expected = source.toString("utf8");
  for (const [before, after] of file.renames ?? []) expected = expected.replaceAll(before, after);
  const target = readFileSync(new URL(file.target, root));
  if (hash(target) !== file.sha256 || !target.equals(Buffer.from(expected)))
    throw new Error(`Activated core differs from verified source: ${file.target}`);
}
console.log(
  `Verified ${manifest.files.length} activated core modules and ${manifest.tests.length} current-source contract files.`,
);
