import { expect, test, vi } from "vite-plus/test";
import { compileColumns } from "../src/internal/compile-columns";
import {
  createAstryxTableClientFacetSnapshot,
  createAstryxTableClientFacetStore,
} from "../src/internal/client-facet";
import { compileClientFilterCollection } from "../src/internal/grid-query";
import type {
  AstryxTableClientAdmittedRow,
  AstryxTableClientFacetRowsSnapshot,
} from "../src/internal/client-source-adapter";
import type { AstryxTableRowPipelineRuntimeView } from "../src/internal/grid-runtime";

test("open facets update only changed row contributions and preserve source order", () => {
  const columns = compileColumns([
    {
      columnId: "COL_ID_VALUE",
      headerName: "Value",
      field: "value",
      valueType: "text",
      enableSetFilter: true,
    },
  ]);
  const column = columns[0]!;
  const read = vi.fn((raw: unknown) => (raw as { value: string }).value);
  const row = (value: string, rowIndex: number) => ({
    raw: { value },
    rowId: String(rowIndex),
    rowIndex,
    values: { read },
  });
  const first = [row("A", 0), row("B", 1), row("A", 2)];
  let snapshot: AstryxTableClientFacetRowsSnapshot = {
    rows: first,
    token: {},
    changedIndexes: [],
  };
  const filters = compileClientFilterCollection([], columns);
  const runtime = {
    getQuerySnapshot: () => ({ columns, filterCollection: filters, quickFilter: "" }),
    getRowSpaceSnapshot: () => undefined,
    getQuickFilterFieldsSnapshot: () => [],
  } as unknown as AstryxTableRowPipelineRuntimeView;
  const store = createAstryxTableClientFacetStore({
    column,
    runtime,
    rows: { getFacetRowsSnapshot: () => snapshot },
  });
  expect(store.getSnapshot().options).toEqual([
    { value: "A", display: "A", count: 2 },
    { value: "B", display: "B", count: 1 },
  ]);
  read.mockClear();
  snapshot = {
    rows: [first[0]!, row("C", 1), first[2]!],
    token: {},
    parentToken: snapshot.token,
    changedIndexes: [1],
  };
  expect(store.getSnapshot().options).toEqual([
    { value: "A", display: "A", count: 2 },
    { value: "C", display: "C", count: 1 },
  ]);
  expect(
    read.mock.calls.filter(([raw]) => raw === first[0]!.raw || raw === first[2]!.raw),
  ).toHaveLength(0);
  // A reopened store derives fresh evidence without an application-wide index.
  read.mockClear();
  const reopened = createAstryxTableClientFacetStore({
    column,
    runtime,
    rows: { getFacetRowsSnapshot: () => snapshot },
  });
  expect(reopened.getSnapshot()).toEqual(store.getSnapshot());
  expect(read).toHaveBeenCalledTimes(3);
});

test.for(["text", "number", "bigint", "boolean"] as const)(
  "incremental %s facets match complete recomputation through value and query changes",
  (valueType) => {
    const columns = compileColumns([
      {
        columnId: "COL_ID_VALUE",
        headerName: "Value",
        field: "value",
        valueType,
        enableSetFilter: true,
      },
      { columnId: "COL_ID_KEEP", headerName: "Keep", field: "keep", valueType: "boolean" },
    ]);
    const column = columns[0]!;
    const values =
      valueType === "text"
        ? ["A", "B", "", "A"]
        : valueType === "number"
          ? [0, -0, 2, 3]
          : valueType === "bigint"
            ? [9007199254740993123n, 9007199254740993124n, 0n, -1n]
            : [true, false, false, true];
    const read = (column: (typeof columns)[number], row: AstryxTableClientAdmittedRow) =>
      column.kind === "field" ? Reflect.get(Object(row.raw), column.field) : undefined;
    const makeRow = (
      index: number,
      value: unknown,
      keep: boolean,
    ): AstryxTableClientAdmittedRow => ({
      rowId: String(index),
      rowIndex: index,
      raw: { value, keep },
      values: {
        read: (raw, _id, _index, column) =>
          column.kind === "field" ? Reflect.get(Object(raw), column.field) : undefined,
      },
    });
    let snapshot: AstryxTableClientFacetRowsSnapshot = {
      rows: Array.from({ length: 12 }, (_, index) =>
        makeRow(index, values[index % 4], index % 2 === 0),
      ),
      token: {},
      changedIndexes: [],
    };
    let filters = compileClientFilterCollection([], columns);
    const runtime = {
      getQuerySnapshot: () => ({ columns, filterCollection: filters, quickFilter: "" }),
      getRowSpaceSnapshot: () => undefined,
      getQuickFilterFieldsSnapshot: () => [],
    } as unknown as AstryxTableRowPipelineRuntimeView;
    const store = createAstryxTableClientFacetStore({
      column,
      runtime,
      rows: { getFacetRowsSnapshot: () => snapshot },
    });
    const verify = () =>
      expect(store.getSnapshot()).toEqual(
        createAstryxTableClientFacetSnapshot({
          column,
          columns,
          filterCollection: filters,
          quickFilter: "",
          quickFilterFields: [],
          rows: snapshot.rows,
          readColumnValue: read,
          readQuickFilterField: () => undefined,
        }),
      );
    verify();
    for (let step = 0; step < 24; step++) {
      const firstIndex = step % 12;
      const secondIndex = (firstIndex + 5) % 12;
      const next = snapshot.rows
        .with(
          firstIndex,
          makeRow(firstIndex, step % 7 === 0 ? null : values[(step + 1) % 4], step % 3 === 0),
        )
        .with(secondIndex, makeRow(secondIndex, values[(step + 2) % 4], step % 3 !== 0));
      snapshot = {
        rows: next,
        token: {},
        parentToken: snapshot.token,
        changedIndexes: [firstIndex, secondIndex],
      };
      verify();
      if (step === 7)
        filters = compileClientFilterCollection(
          [{ columnId: "COL_ID_KEEP", type: "equals", filter: true }],
          columns,
        );
      if (step === 15)
        filters = compileClientFilterCollection(
          [{ columnId: "COL_ID_VALUE", type: "matchNone" }],
          columns,
        );
      verify();
    }
    // A cardinality change or changed row identity takes the complete rebuild path.
    snapshot = {
      rows: snapshot.rows.slice(1),
      token: {},
      parentToken: snapshot.token,
      changedIndexes: [0],
    };
    verify();
    snapshot = {
      rows: [...snapshot.rows].reverse(),
      token: {},
      parentToken: snapshot.token,
      changedIndexes: Array.from({ length: snapshot.rows.length }, (_, index) => index),
    };
    verify();
  },
);
