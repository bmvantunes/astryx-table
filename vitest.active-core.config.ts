import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const root = dirname(fileURLToPath(import.meta.url));
const baseline = resolve(root, "migration/table/src");
const manifest = JSON.parse(
  readFileSync(resolve(root, "packages/table/core-provenance.json"), "utf8"),
) as { files: { target: string }[]; reviewedChanges: { target: string }[] };
const activated = new Set(
  [...manifest.files, ...manifest.reviewedChanges].map(({ target }) => resolve(root, target)),
);

export default defineConfig({
  define: { __ASTRYX_TABLE_DEVELOPMENT__: "true", __ASTRYX_TABLE_TEST_DIAGNOSTICS__: "true" },
  plugins: [
    {
      name: "astryx-activated-core-tests",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer?.startsWith(`${baseline}/`) || !source.startsWith(".")) return;
        const requested = resolve(dirname(importer), source);
        if (!requested.startsWith(`${baseline}/`)) return;
        const destination = requested.replace(baseline, resolve(root, "packages/table/src"));
        for (const extension of ["", ".ts", ".tsx"])
          if (activated.has(`${destination}${extension}`)) return `${destination}${extension}`;
      },
    },
  ],
  test: {
    include: ["migration/table/src/internal/**/*.test.ts"],
    exclude: [
      "**/*.browser.test.*",
      "**/benchmark-runner.test.ts",
      "**/react-compiler-contract.test.ts",
      "**/server-facet.test.ts",
    ],
    environment: "node",
  },
});
