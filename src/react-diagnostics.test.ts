import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, test } from "vite-plus/test";

const require = createRequire(import.meta.url);
const root = dirname(require.resolve("react-dom/package.json"));

// Exercise both installed private diagnostic entry points: the public Browser
// regression covers React's render lifecycle, while this isolates the profiling
// build too, without replacing the browser renderer or importing a second React.
for (const build of ["react-dom-client.development.js", "react-dom-profiling.development.js"]) {
  test(`${build} describes exact arrays without mutating their values`, () => {
    const source = readFileSync(join(root, "cjs", build), "utf8");
    const start = source.indexOf("    function getArrayKind(array)");
    const end = source.indexOf("    function addObjectDiffToProperties(", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const values = Object.freeze([90071992547409931234567891n, -5n, 1.25, null, "value"]);
    const properties: [string, string][] = [];
    runInNewContext(
      `${source.slice(start, end)}\naddValueToProperties("values", values, properties, 0, "");`,
      {
        values,
        properties,
        EMPTY_ARRAY: 0,
        COMPLEX_ARRAY: 1,
        PRIMITIVE_ARRAY: 2,
        ENTRIES_ARRAY: 3,
        isArrayImpl: Array.isArray,
        REACT_ELEMENT_TYPE: Symbol.for("react.transitional.element"),
      },
    );
    expect(properties).toEqual([
      ["values", '["90071992547409931234567891n","-5n",1.25,null,"value"]'],
    ]);
    expect(values[0]).toBe(90071992547409931234567891n);
    expect(() => JSON.stringify(values)).toThrow(TypeError);
  });
}
