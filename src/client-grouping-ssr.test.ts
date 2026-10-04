import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vite-plus/test";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";

test("SSR restores exact flat grouping and Rows presentation without invoking raw callbacks", () => {
  type Row = { id: string; desk: string; amount: bigint };
  const rawFormatter = vi.fn(({ row }: { row: Row }) => {
    if (typeof row.id !== "string") throw new Error("Fabricated raw row");
    return row.desk;
  });
  const columns = [
    {
      columnId: "COL_ID_DESK",
      headerName: "Desk",
      field: "desk",
      valueType: "text",
      groupBy: true,
      valueFormatter: rawFormatter,
    },
    {
      columnId: "COL_ID_AMOUNT",
      headerName: "Amount",
      field: "amount",
      valueType: "bigint",
      aggFunc: "sum",
      aggregateValueFormatter: ({ value }) => `sum ${String(value)}`,
    },
  ] as const satisfies AstryxTableColumns<Row>;
  const orderBy = [{ columnId: "COL_ID_DESK", direction: "asc" }] as const;
  const onPersistChange = vi.fn();
  const html = renderToString(
    createElement(AstryxTableClient<Row, typeof columns>, {
      tableId: "grouped-ssr",
      columns,
      getRowId: (row) => row.id,
      initialOrderBy: orderBy,
      clientSource: {
        rows: [
          { id: "a", desk: "Alpha", amount: 9007199254740993n },
          { id: "b", desk: "Alpha", amount: 2n },
        ],
        totalRows: 2,
        version: 1,
        status: "ready",
      },
      initialPersistedState: {
        version: 1,
        tableId: "grouped-ssr",
        filters: [],
        orderBy,
        groupBy: ["COL_ID_DESK"],
        groupOrderBy: orderBy,
        columnOrder: ["COL_ID_DESK", "COL_ID_AMOUNT"],
        columnVisibility: {},
        columnWidths: {},
        columnPinning: { start: [], end: [] },
      },
      groupRowsColumn: {
        headerName: "Records",
        valueFormatter: ({ value }) => `${String(value)} records`,
      },
      onPersistChange,
    }),
  );
  expect(html).toContain("sum 9007199254740995");
  expect(html).toContain("2 records");
  expect(html).toContain('aria-rowcount="2"');
  expect(rawFormatter).not.toHaveBeenCalled();
  expect(onPersistChange).not.toHaveBeenCalled();
});
