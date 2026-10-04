import { expect, test, vi } from "vite-plus/test";
import { compileColumns } from "../src/internal/compile-columns";
import {
  AstryxTableClientGroupingInputCache,
  deriveAstryxTableClientGroupedProjection,
  deriveAstryxTableClientGroupedProjectionFromRows,
  type AstryxTableClientGroupingInputRow,
} from "../src/internal/client-grouping";

const definitions = [
  { columnId: "COL_ID_KEY", headerName: "Key", field: "key", valueType: "text", groupBy: true },
  {
    columnId: "COL_ID_NUMBER",
    headerName: "Number",
    field: "number",
    valueType: "number",
    groupBy: true,
    aggFunc: "max",
  },
  {
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    valueType: "bigint",
    aggFunc: "sum",
  },
];
const columns = compileColumns(definitions);
function input(
  raw: Readonly<Record<string, unknown>>,
  rowIndex: number,
): AstryxTableClientGroupingInputRow {
  return {
    raw,
    rowIndex,
    rowId: String(rowIndex),
    preparationIdentity: raw,
    readValue: vi.fn((column) => (column.kind === "field" ? raw[column.field] : undefined)),
  };
}

test("changing a column from aggregate to group key invalidates prepared input even when the combined column sequence is unchanged", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const rows = [
    input({ key: "A", number: 1, amount: 2n }, 0),
    input({ key: "A", number: 2, amount: 3n }, 1),
  ];
  const base = { rows, columns, groupOrderBy: [], inputCache, reuseNativeResults: true as const };
  const first = deriveAstryxTableClientGroupedProjection({ ...base, groupBy: ["COL_ID_KEY"] });
  expect(first.kind === "ready" && first.rows.length).toBe(1);
  const next = deriveAstryxTableClientGroupedProjection({
    ...base,
    groupBy: ["COL_ID_KEY", "COL_ID_NUMBER"],
  });
  expect(next.kind === "ready" && next.rows.length).toBe(2);
  expect(next).toEqual(
    deriveAstryxTableClientGroupedProjection({
      rows,
      columns,
      groupOrderBy: [],
      groupBy: ["COL_ID_KEY", "COL_ID_NUMBER"],
    }),
  );
});

test("cached and uncached projections preserve exact sums, missing keys, signed zero and tuple order through replacements", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const rows = [
    input({ key: "A", number: -0, amount: 9007199254740993n }, 0),
    input({ key: "A", number: 0, amount: 2n }, 1),
    input({ number: 0, amount: 3n }, 2),
    input({ key: null, number: 0, amount: 4n }, 3),
    input({ key: undefined, number: 0, amount: 5n }, 4),
  ];
  const derive = (
    current: readonly AstryxTableClientGroupingInputRow[],
    groupBy = ["COL_ID_KEY", "COL_ID_NUMBER"],
    definition = columns,
  ) => {
    const args = { rows: current, columns: definition, groupBy, groupOrderBy: [] };
    const cached = deriveAstryxTableClientGroupedProjection({
      ...args,
      inputCache,
      reuseNativeResults: true,
    });
    expect(cached).toEqual(deriveAstryxTableClientGroupedProjection(args));
    return cached;
  };
  const initial = derive(rows);
  expect(initial.kind === "ready" && initial.rows.length).toBe(4);
  expect(initial.kind === "ready" && initial.rows[0]?.values.get("COL_ID_AMOUNT")).toBe(
    9007199254740995n,
  );
  derive(rows);
  derive(rows, ["COL_ID_NUMBER", "COL_ID_KEY"]);
  derive(rows.filter((_row, index) => index !== 1));
  derive(rows);
  const changed = rows.with(0, input({ key: "B", number: 3, amount: 7n }, 0));
  derive(changed);
  // The same admission objects are valid across a column replacement: plan identity must change.
  const replacement = compileColumns(
    definitions.map((column) =>
      column.columnId === "COL_ID_AMOUNT" ? { ...column, aggFunc: "max" } : column,
    ),
  );
  const maximum = derive(rows, ["COL_ID_KEY", "COL_ID_NUMBER"], replacement);
  expect(maximum.kind === "ready" && maximum.rows[0]?.values.get("COL_ID_AMOUNT")).toBe(
    9007199254740993n,
  );
});

test("prepared input is bounded and discarded after filtering or explicit release", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const rows = Array.from({ length: 6000 }, (_, index) =>
    input({ key: "A", number: 1, amount: BigInt(index) }, index),
  );
  const derive = (current: readonly AstryxTableClientGroupingInputRow[]) =>
    deriveAstryxTableClientGroupedProjection({
      rows: current,
      columns,
      groupBy: ["COL_ID_KEY"],
      groupOrderBy: [],
      inputCache,
    });
  const first = derive(rows);
  expect(first.kind === "ready" && first.rows[0]?.values.get("COL_ID_AMOUNT")).toBe(17997000n);
  rows.forEach((row) => vi.mocked(row.readValue).mockClear());
  expect(derive(rows)).toEqual(first);
  // Three prepared slots per row: at most 5,461 rows fit in the 16,384-slot budget.
  expect(rows[0]!.readValue).not.toHaveBeenCalled();
  expect(rows[5461]!.readValue).toHaveBeenCalledTimes(3);
  derive(rows.slice(5999));
  vi.mocked(rows[0]!.readValue).mockClear();
  derive(rows.slice(0, 1));
  expect(rows[0]!.readValue).toHaveBeenCalledTimes(3);
  inputCache.clear();
  vi.mocked(rows[0]!.readValue).mockClear();
  derive(rows.slice(0, 1));
  expect(rows[0]!.readValue).toHaveBeenCalledTimes(3);
});

test("cached builtin inputs still run aggregate operations in source order and recover from failures", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const calls: Array<readonly [unknown, unknown]> = [];
  let reject = false;
  const aggregate = columns[2]!;
  const definition = [
    columns[0]!,
    columns[1]!,
    {
      ...aggregate,
      semantics: {
        ...aggregate.semantics,
        aggregateAlgebra: {
          add: (left: unknown, right: unknown) => {
            calls.push([left, right]);
            if (reject) return { _tag: "Failure" as const, message: "Rejected aggregate" };
            return aggregate.semantics.aggregateAlgebra!.add(left, right);
          },
        },
      },
    },
  ];
  const rows = [
    input({ key: "A", number: 0, amount: 1n }, 0),
    input({ key: "A", number: 0, amount: 2n }, 1),
    input({ key: "A", number: 0, amount: 4n }, 2),
  ];
  const args = {
    rows,
    columns: definition,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache,
    reuseNativeResults: true as const,
  };
  const initial = deriveAstryxTableClientGroupedProjection(args);
  expect(calls).toEqual([
    [1n, 2n],
    [3n, 4n],
  ]);
  calls.length = 0;
  expect(deriveAstryxTableClientGroupedProjection(args)).toEqual(initial);
  expect(calls).toEqual([
    [1n, 2n],
    [3n, 4n],
  ]);
  reject = true;
  expect(deriveAstryxTableClientGroupedProjection(args)).toMatchObject({
    kind: "invalid",
    invalid: { message: "Rejected aggregate" },
  });
  reject = false;
  expect(deriveAstryxTableClientGroupedProjection(args)).toEqual(initial);
});

test("custom key encoding remains observable on every derivation and preserves failure recovery", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  let reject = false;
  const key = columns[0]!;
  const format = vi.fn((value: unknown) => {
    if (reject) throw new Error("Key encoding failed");
    return key.semantics.formatCanonicalText(value);
  });
  const definition = [
    { ...key, valueType: {}, semantics: { ...key.semantics, formatCanonicalText: format } },
    columns[1]!,
    columns[2]!,
  ];
  const rows = [input({ key: "A", number: 0, amount: 1n }, 0)];
  const args = {
    rows,
    columns: definition,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache,
    reuseNativeResults: true as const,
  };
  const initial = deriveAstryxTableClientGroupedProjection(args);
  expect(initial.kind).toBe("ready");
  const before = format.mock.calls.length;
  deriveAstryxTableClientGroupedProjection(args);
  expect(format.mock.calls.length).toBeGreaterThan(before);
  reject = true;
  expect(deriveAstryxTableClientGroupedProjection(args)).toMatchObject({ kind: "invalid" });
  reject = false;
  expect(deriveAstryxTableClientGroupedProjection(args)).toEqual(initial);
});

test("custom aggregate inputs are reread and a later read failure is never hidden by native preparation", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const definition = [columns[0]!, columns[1]!, { ...columns[2]!, valueType: {} }];
  const row = input({ key: "A", number: 0, amount: 1n }, 0);
  const args = {
    rows: [row],
    columns: definition,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache,
  };
  const initial = deriveAstryxTableClientGroupedProjection(args);
  vi.mocked(row.readValue).mockClear();
  expect(deriveAstryxTableClientGroupedProjection(args)).toEqual(initial);
  expect(row.readValue).toHaveBeenCalledTimes(1);
  expect(vi.mocked(row.readValue).mock.calls[0]?.[0].columnId).toBe("COL_ID_AMOUNT");
  vi.mocked(row.readValue).mockImplementationOnce(() => {
    throw new Error("Custom input failed");
  });
  expect(deriveAstryxTableClientGroupedProjection(args)).toMatchObject({ kind: "invalid" });
  expect(deriveAstryxTableClientGroupedProjection(args)).toEqual(initial);
});

test.for([
  { valueType: "text", values: ["", "0", "1", "2", "3", "0", ""], count: 8n },
  { valueType: "boolean", values: [false, true, false], count: 5n },
  { valueType: "number", values: [-0, 0, 1, 2, 1], count: 6n },
  { valueType: "bigint", values: [0n, 9007199254740993n, 9007199254740994n, 0n], count: 6n },
])(
  "native distinct counts preserve presence and exact scalar identity: $valueType",
  ({ valueType, values, count }) => {
    const definition = compileColumns([
      definitions[0]!,
      {
        columnId: "COL_ID_DISTINCT",
        headerName: "Distinct",
        field: "value",
        valueType,
        aggFunc: "countDistinct",
      },
    ]);
    const rows = [
      { key: "A" },
      { key: "A", value: null },
      { key: "A", value: undefined },
      ...values.map((value) => ({ key: "A", value })),
    ].map(input);
    const args = { rows, columns: definition, groupBy: ["COL_ID_KEY"], groupOrderBy: [] };
    const inputCache = new AstryxTableClientGroupingInputCache();
    for (const preparation of [undefined, inputCache, inputCache]) {
      const result = deriveAstryxTableClientGroupedProjection({
        ...args,
        ...(preparation ? { inputCache: preparation, reuseNativeResults: true as const } : {}),
      });
      expect(result.kind === "ready" && result.rows[0]?.values.get("COL_ID_DISTINCT")).toBe(count);
    }
  },
);

test("custom distinct values use canonical identity on every derivation, including failures", () => {
  const compiled = compileColumns([
    definitions[0]!,
    {
      columnId: "COL_ID_DISTINCT",
      headerName: "Distinct",
      field: "value",
      valueType: "text",
      aggFunc: "countDistinct",
    },
  ]);
  let reject = false;
  const distinct = compiled[1]!;
  const format = vi.fn((value: unknown) => {
    if (reject) throw new Error("Distinct encoding failed");
    return String(value).toLowerCase();
  });
  const definition = [
    compiled[0]!,
    {
      ...distinct,
      valueType: {},
      semantics: { ...distinct.semantics, formatCanonicalText: format },
    },
  ];
  const rows = [input({ key: "A", value: "YES" }, 0), input({ key: "A", value: "yes" }, 1)];
  const args = {
    rows,
    columns: definition,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache: new AstryxTableClientGroupingInputCache(),
  };
  for (let index = 0; index < 2; index += 1) {
    format.mockClear();
    const result = deriveAstryxTableClientGroupedProjection(args);
    expect(result.kind === "ready" && result.rows[0]?.values.get("COL_ID_DISTINCT")).toBe(1n);
    expect(format).toHaveBeenCalledTimes(2);
  }
  reject = true;
  expect(deriveAstryxTableClientGroupedProjection(args)).toMatchObject({ kind: "invalid" });
  reject = false;
  const recovered = deriveAstryxTableClientGroupedProjection(args);
  expect(recovered.kind === "ready" && recovered.rows[0]?.values.get("COL_ID_DISTINCT")).toBe(1n);
});

test("shared-reader projection preserves exact results, admission identity and read failures", () => {
  const records: readonly Readonly<Record<string, unknown>>[] = [
    { key: "A", number: 1, amount: 9007199254740993n },
    { key: "A", number: 2, amount: 2n },
    { key: "B", number: 3, amount: 5n },
  ];
  const rows = records.map((raw, rowIndex) => ({ raw, rowIndex, rowId: String(rowIndex) }));
  const readValue = vi.fn((row: (typeof rows)[number], column: (typeof columns)[number]) =>
    column.kind === "field" ? row.raw[column.field] : undefined,
  );
  const inputCache = new AstryxTableClientGroupingInputCache();
  const args = {
    rows,
    columns,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache,
    preparationIdentity: (row: (typeof rows)[number]) => row,
    readValue,
  };
  const expected = deriveAstryxTableClientGroupedProjection({
    rows: records.map(input),
    columns,
    groupBy: args.groupBy,
    groupOrderBy: [],
  });
  expect(deriveAstryxTableClientGroupedProjectionFromRows(args)).toEqual(expected);
  readValue.mockClear();
  expect(deriveAstryxTableClientGroupedProjectionFromRows(args)).toEqual(expected);
  expect(readValue).not.toHaveBeenCalled();
  const changed = rows.with(0, { ...rows[0]!, raw: { ...records[0], amount: 7n } });
  const replacement = deriveAstryxTableClientGroupedProjectionFromRows({ ...args, rows: changed });
  expect(replacement.kind === "ready" && replacement.rows[0]?.values.get("COL_ID_AMOUNT")).toBe(9n);
  expect(readValue).toHaveBeenCalledTimes(3);
  readValue.mockImplementationOnce(() => {
    throw new Error("Read failed");
  });
  inputCache.clear();
  expect(deriveAstryxTableClientGroupedProjectionFromRows(args)).toMatchObject({ kind: "invalid" });
  expect(deriveAstryxTableClientGroupedProjectionFromRows(args)).toEqual(expected);
});

test("native result reuse retains only groups with identical ordered admission membership", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const a = input({ key: "A", number: 1, amount: 9007199254740993n }, 0);
  const b = input({ key: "A", number: 2, amount: 2n }, 1);
  const c = input({ key: "B", number: 3, amount: 5n }, 2);
  const derive = (rows: readonly AstryxTableClientGroupingInputRow[], definition = columns) => {
    const args = { rows, columns: definition, groupBy: ["COL_ID_KEY"], groupOrderBy: [] };
    const result = deriveAstryxTableClientGroupedProjection({
      ...args,
      inputCache,
      reuseNativeResults: true,
    });
    expect(result).toEqual(deriveAstryxTableClientGroupedProjection(args));
    if (result.kind !== "ready") throw new Error("Expected valid native grouping");
    return result;
  };
  const first = derive([a, b, c]);
  const second = derive([a, b, c]);
  expect(second.rows[0]).toBe(first.rows[0]);
  expect(second.rows[1]).toBe(first.rows[1]);
  const changed = derive([input({ key: "A", number: 4, amount: 7n }, 0), b, c]);
  expect(changed.rows[0]?.values.get("COL_ID_AMOUNT")).toBe(9n);
  expect(changed.rows[0]).not.toBe(first.rows[0]);
  expect(changed.rows[1]).toBe(first.rows[1]);
  const reordered = derive([c, a, b]);
  expect(reordered.rows[0]).toBe(first.rows[1]);
  expect(reordered.rows[1]?.values.get("COL_ID_AMOUNT")).toBe(9007199254740995n);
  const reversedMembers = derive([c, b, a]);
  expect(reversedMembers.rows[1]).not.toBe(reordered.rows[1]);
  expect(reversedMembers.rows[0]).toBe(reordered.rows[0]);
  derive([c, a]);
  derive([c, input({ key: "B", number: 1, amount: 3n }, 0)]);
  const replacement = compileColumns(
    definitions.map((column) =>
      column.columnId === "COL_ID_AMOUNT" ? { ...column, aggFunc: "max" } : column,
    ),
  );
  derive([a, b, c], replacement);
  inputCache.clear();
  const reopened = derive([a, b, c]);
  expect(reopened.rows[1]).not.toBe(first.rows[1]);
});

test("failed native derivations preserve the last successful membership and original first error", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const rows = [
    input({ key: "A", number: 1, amount: 1n }, 0),
    input({ key: "A", number: 2, amount: 2n }, 1),
  ];
  const args = {
    columns,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache,
    reuseNativeResults: true as const,
  };
  const first = deriveAstryxTableClientGroupedProjection({ ...args, rows });
  const badAmount = input({ key: "A", number: 2, amount: null }, 1);
  const badKey = input({ key: 100, number: 3, amount: 4n }, 2);
  const failedRows = [rows[0]!, badAmount, badKey];
  expect(deriveAstryxTableClientGroupedProjection({ ...args, rows: failedRows })).toEqual(
    deriveAstryxTableClientGroupedProjection({ ...args, inputCache: undefined, rows: failedRows }),
  );
  const failed = deriveAstryxTableClientGroupedProjection({ ...args, rows: failedRows });
  expect(failed.kind).toBe("invalid");
  const restored = deriveAstryxTableClientGroupedProjection({ ...args, rows });
  expect(first.kind === "ready" && restored.kind === "ready" && restored.rows[0]).toBe(
    first.kind === "ready" && first.rows[0],
  );
});

test("result reuse is bounded by native value slots as well as membership and result slots", () => {
  const inputCache = new AstryxTableClientGroupingInputCache();
  const rows = Array.from({ length: 6000 }, (_, i) =>
    input({ key: "A", number: i, amount: BigInt(i) }, i),
  );
  const args = {
    rows,
    columns,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache,
    reuseNativeResults: true as const,
  };
  const first = deriveAstryxTableClientGroupedProjection(args);
  const second = deriveAstryxTableClientGroupedProjection(args);
  expect(second).toEqual(first);
  expect(first.kind === "ready" && second.kind === "ready" && second.rows[0]).not.toBe(
    first.kind === "ready" && first.rows[0],
  );
  const manyGroups = rows
    .slice(0, 5000)
    .map((row, i) => input({ ...(row.raw as object), key: String(i) }, i));
  const manyArgs = { ...args, rows: manyGroups };
  const manyFirst = deriveAstryxTableClientGroupedProjection(manyArgs);
  const manySecond = deriveAstryxTableClientGroupedProjection(manyArgs);
  expect(manySecond).toEqual(manyFirst);
  expect(manyFirst.kind === "ready" && manySecond.kind === "ready" && manySecond.rows[0]).not.toBe(
    manyFirst.kind === "ready" && manyFirst.rows[0],
  );
});

test("cloned native key and comparison semantics cannot certify result reuse", () => {
  const key = columns[0]!;
  const max = columns[1]!;
  const encode = vi.fn(key.semantics.formatCanonicalText);
  const compare = vi.fn(max.semantics.compare);
  const definitions = [
    { ...key, semantics: { ...key.semantics, formatCanonicalText: encode } },
    { ...max, semantics: { ...max.semantics, compare } },
    columns[2]!,
  ];
  const rows = [
    input({ key: "A", number: 1, amount: 1n }, 0),
    input({ key: "A", number: 2, amount: 2n }, 1),
  ];
  const args = {
    rows,
    columns: definitions,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache: new AstryxTableClientGroupingInputCache(),
    reuseNativeResults: true as const,
  };
  deriveAstryxTableClientGroupedProjection(args);
  encode.mockClear();
  compare.mockClear();
  const result = deriveAstryxTableClientGroupedProjection(args);
  expect(result.kind === "ready" && result.rows[0]?.values.get("COL_ID_NUMBER")).toBe(2);
  expect(encode).toHaveBeenCalledTimes(2);
  expect(compare).toHaveBeenCalled();
});

test("cloned native distinct semantics keep canonical collisions and every encoder invocation", () => {
  const compiled = compileColumns([
    definitions[0],
    {
      columnId: "COL_ID_DISTINCT",
      headerName: "Distinct",
      field: "value",
      valueType: "text",
      aggFunc: "countDistinct",
    },
  ]);
  const distinct = compiled[1]!;
  const encode = vi.fn((value: unknown) => String(value).toLowerCase());
  const definition = [
    compiled[0]!,
    { ...distinct, semantics: { ...distinct.semantics, formatCanonicalText: encode } },
  ];
  const args = {
    rows: [input({ key: "A", value: "X" }, 0), input({ key: "A", value: "x" }, 1)],
    columns: definition,
    groupBy: ["COL_ID_KEY"],
    groupOrderBy: [],
    inputCache: new AstryxTableClientGroupingInputCache(),
    reuseNativeResults: true as const,
  };
  for (let i = 0; i < 2; i += 1) {
    encode.mockClear();
    const result = deriveAstryxTableClientGroupedProjection(args);
    expect(result.kind === "ready" && result.rows[0]?.values.get("COL_ID_DISTINCT")).toBe(1n);
    expect(encode).toHaveBeenCalledTimes(2);
  }
});
