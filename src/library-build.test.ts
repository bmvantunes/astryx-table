import { fileURLToPath } from "node:url";
import { build } from "vite";
import { expect, test } from "vite-plus/test";
import { libraryPlugins } from "../config/library-plugins";

test("library definitions preserve literals, property names and local bindings", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = await build({
      configFile: false,
      plugins: libraryPlugins(),
      build: {
        lib: {
          entry: fileURLToPath(
            new URL("../scripts/fixtures/production-defines/entry.js", import.meta.url),
          ),
          formats: ["es"],
        },
        minify: false,
        write: false,
      },
    });
    const chunks = (Array.isArray(result) ? result : [result]).flatMap((output) => {
      if (!("output" in output)) throw new Error("A one-shot build must not return a watcher.");
      return output.output;
    });
    const entry = chunks.find((chunk) => chunk.type === "chunk" && chunk.isEntry);
    if (entry?.type !== "chunk") throw new Error("Expected a compiled entry chunk.");
    const { evidence } = await import(
      `data:text/javascript;base64,${Buffer.from(entry.code).toString("base64")}`
    );
    expect(evidence).toEqual({
      development: false,
      testDiagnostics: false,
      literal: "__ASTRYX_TABLE_DEVELOPMENT__ __ASTRYX_TABLE_TEST_DIAGNOSTICS__",
      larger: "larger identifier",
      property: "property name",
      shadow: "local binding",
    });
    expect(entry.code).toContain("Diagnostic spelling in a comment: __ASTRYX_TABLE_DEVELOPMENT__");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
