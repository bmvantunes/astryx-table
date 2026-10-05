import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vite-plus/test";
import {
  AstryxTableClient,
  type AstryxTableColumnId,
  type AstryxTableColumns,
} from "../packages/table/src";

test.each([false, true])(
  "server rendering starts with bounded suspended pinning and stable row identities (Row Selection: %s)",
  (selection) => {
    type Row = { id: string; value: number };
    const columns = Array.from({ length: 60 }, (_, index) => ({
      columnId: `COL_ID_SSR_${index}` as AstryxTableColumnId,
      headerName: `SSR ${index}`,
      field: "value" as const,
      valueType: "number" as const,
      width: 120,
      pinned: index < 30 ? ("start" as const) : ("end" as const),
    })) satisfies AstryxTableColumns<Row>;
    const html = renderToString(
      createElement(AstryxTableClient<Row, typeof columns>, {
        tableId: "ssr-pinned",
        rowSelection: selection ? true : undefined,
        columns,
        getRowId: (row) => row.id,
        initialOrderBy: [{ columnId: "COL_ID_SSR_0", direction: "asc" }],
        clientSource: {
          rows: [{ id: "row-\ud800", value: 1 }],
          totalRows: 1,
          version: 1,
          status: "ready",
        },
      }),
    );
    expect(html).toContain(`aria-colcount="${selection ? 61 : 60}"`);
    expect(html.includes("Select all rows")).toBe(selection);
    expect(html.match(/role="columnheader"/g)!.length).toBeLessThan(60);
    expect(html.match(/role="gridcell"/g)!.length).toBeLessThan(60);
    expect(html).not.toContain("pinned-start-offset");
    expect(html).not.toContain("pinned-end-offset");
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("d800");
  },
);
