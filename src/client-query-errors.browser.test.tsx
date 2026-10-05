import { afterEach, expect, test } from "vite-plus/test";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumns,
  type AstryxTablePersistedState,
  type AstryxTableValueType,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);

type Row = { id: string; name: string; code: string };
const text = (input: unknown) =>
  typeof input === "string"
    ? ({ _tag: "Success", value: input } as const)
    : ({ _tag: "Failure", message: "Expected text." } as const);
const codeType = {
  codecId: "test/comparison-failure",
  codecVersion: 1,
  filterFamily: "equality",
  editorFamily: "text",
  cellAlign: "start",
  editorLayout: "inline",
  defaultWidth: 120,
  decodeRuntime: text,
  equivalent: (left, right) => left === right,
  compare: (left, right) => {
    if (left === "broken" || right === "broken") throw new Error("Comparison failed.");
    return left === right ? 0 : left < right ? -1 : 1;
  },
  formatCanonicalText: (value) => value,
  parseCanonicalText: text,
  formatDisplay: (value) => value,
  encodePersisted: (value) => value,
  decodePersisted: text,
} satisfies AstryxTableValueType<string, "equality", "text">;
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  { columnId: "COL_ID_CODE", headerName: "Code", field: "code", valueType: codeType },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "query-errors",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_CODE", direction: "asc" }] as const,
};

test.for([false, true])(
  "contains custom comparison failure and recovers (hidden: %s)",
  async (hidden) => {
    const instanceProps = {
      ...props,
      initialPersistedState: {
        version: 1,
        tableId: props.tableId,
        filters: [],
        orderBy: props.initialOrderBy,
        groupBy: [],
        groupOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
        columnOrder: ["COL_ID_NAME", "COL_ID_CODE"],
        columnVisibility: { COL_ID_CODE: !hidden },
        columnWidths: {},
        columnPinning: { start: [], end: [] },
      } satisfies AstryxTablePersistedState<Row, typeof columns, true>,
    };
    const rows = [
      { id: "a", name: "Ada", code: "broken" },
      { id: "b", name: "Grace", code: "b" },
    ];
    const screen = await render(
      <AstryxTableClient
        {...instanceProps}
        clientSource={{ rows, totalRows: 2, version: 1, status: "ready" }}
      />,
    );
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Unable to display table values.");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Code: Unable to compare source values.");
    await expect
      .element(screen.getByRole("gridcell", { name: "Ada", exact: true }))
      .not.toBeInTheDocument();
    await screen.rerender(
      <AstryxTableClient
        {...instanceProps}
        clientSource={{
          rows: [{ ...rows[0]!, code: "a" }, rows[1]!],
          totalRows: 2,
          version: 2,
          status: "ready",
        }}
      />,
    );
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    await expect
      .element(screen.getByRole("gridcell", { name: "Grace", exact: true }))
      .toBeVisible();
    await screen.rerender(
      <AstryxTableClient
        {...instanceProps}
        clientSource={{ rows, totalRows: 2, version: 3, status: "ready" }}
      />,
    );
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Code: Unable to compare source values.");
    await screen.rerender(
      <AstryxTableClient
        {...instanceProps}
        clientSource={{
          rows: [{ ...rows[0]!, code: "a" }, rows[1]!],
          totalRows: 2,
          version: 4,
          status: "ready",
        }}
      />,
    );
    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  },
);

test("contains a non-finite value in a visible non-query column and recovers the cell", async () => {
  type NumericRow = { id: string; name: string; score: number };
  const numericColumns = [
    columns[0],
    { columnId: "COL_ID_SCORE", headerName: "Score", field: "score", valueType: "number" },
  ] as const satisfies AstryxTableColumns<NumericRow>;
  const rows = [
    { id: "a", name: "Ada", score: 1 },
    { id: "b", name: "Grace", score: Number.NaN },
  ];
  const numericProps = {
    tableId: "invalid-visible-value",
    columns: numericColumns,
    getRowId: (row: NumericRow) => row.id,
    initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  };
  const screen = await render(
    <AstryxTableClient
      {...numericProps}
      clientSource={{ rows, totalRows: 2, version: 1, status: "ready" }}
    />,
  );
  await expect.element(screen.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  await expect.element(screen.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("Score: Expected a finite number value.");
  expect(rows[1]!.score).toBeNaN();
  await screen.rerender(
    <AstryxTableClient
      {...numericProps}
      clientSource={{
        rows: [rows[0]!, { ...rows[1]!, score: 5 }],
        totalRows: 2,
        version: 2,
        status: "ready",
      }}
    />,
  );
  await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("gridcell", { name: "5", exact: true })).toBeVisible();
});

test("keeps invalid canonical markers out of pinned row-aware presentation callbacks", async () => {
  type NumericRow = { id: string; name: string; score: number };
  const received: number[] = [];
  const numericColumns = [
    columns[0],
    {
      columnId: "COL_ID_SCORE",
      headerName: "Score",
      field: "score",
      valueType: "number",
      pinned: "end",
      cellClassName: ({ value }) => {
        received.push(value);
        return "score-cell";
      },
      valueFormatter: ({ value }) => {
        received.push(value);
        return value.toFixed(1);
      },
      cellRenderer: ({ value, row }) => {
        received.push(value);
        return (
          <span>
            {row.name}: {value.toFixed(1)}
          </span>
        );
      },
    },
  ] as const satisfies AstryxTableColumns<NumericRow>;
  const rows = [{ id: "a", name: "Ada", score: Number.NaN }];
  const numericProps = {
    tableId: "invalid-custom-value",
    columns: numericColumns,
    getRowId: (row: NumericRow) => row.id,
    initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  };
  const screen = await render(
    <AstryxTableClient
      {...numericProps}
      clientSource={{ rows, totalRows: 1, version: 1, status: "ready" }}
    />,
  );
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("Score: Expected a finite number value.");
  expect(received).toEqual([]);
  await screen.rerender(
    <AstryxTableClient
      {...numericProps}
      clientSource={{
        rows: [{ ...rows[0]!, score: 5 }],
        totalRows: 1,
        version: 2,
        status: "ready",
      }}
    />,
  );
  await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "Ada: 5.0", exact: true }))
    .toBeVisible();
  expect(received.length).toBeGreaterThan(0);
  expect(received.every((value) => value === 5)).toBe(true);
});
