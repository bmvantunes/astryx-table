import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vite-plus/test";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";

test("SSR loading never reads or presents candidate row values and terminal chrome invokes no retry", () => {
  type Row = { id: string; name: string };
  const renderValue = vi.fn(() => "Unconfirmed");
  const columns = [
    {
      columnId: "COL_ID_NAME",
      headerName: "Name",
      field: "name",
      valueType: "text",
      cellRenderer: renderValue,
    },
  ] as const satisfies AstryxTableColumns<Row>;
  const getRowId = vi.fn((row: Row) => row.id);
  const run = vi.fn();
  const props = {
    tableId: "lifecycle-ssr",
    columns,
    getRowId,
    initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  };
  const loading = renderToString(
    createElement(AstryxTableClient<Row, typeof columns>, {
      ...props,
      clientSource: {
        rows: [{ id: "a", name: "Unconfirmed" }],
        totalRows: 1,
        version: 1,
        status: "loading",
      },
    }),
  );
  expect(loading).toContain('aria-busy="true"');
  expect(loading).toContain('aria-label="Loading Name"');
  expect(loading).not.toContain("Unconfirmed");
  expect(getRowId).not.toHaveBeenCalled();
  expect(renderValue).not.toHaveBeenCalled();
  const error = renderToString(
    createElement(AstryxTableClient<Row, typeof columns>, {
      ...props,
      clientSource: {
        rows: [],
        totalRows: 0,
        version: 1,
        status: "error",
        message: "Offline",
        retry: { run, pending: true },
      },
    }),
  );
  expect(error).toContain('role="alert"');
  expect(error).toContain('aria-disabled="true"');
  expect(error).toContain("Offline");
  expect(error).not.toContain("No rows");
  expect(run).not.toHaveBeenCalled();
});
