import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";
import { installAstryxTableRowSelectionRenderListener } from "../packages/table/src/internal/row-selection";
import {
  installAstryxTableClientGridSurfaceRenderListenerForTable,
  installAstryxTableClientViewRenderListenerForTable,
} from "../packages/table/src/internal/render-instrumentation";
import "./styles.css";
afterEach(cleanup);
test("one checkbox commits only its row and header without structural grid commits", async () => {
  type Row = { id: string; value: number };
  const columns = [
    { columnId: "COL_ID_VALUE", headerName: "Value", field: "value", valueType: "number" },
  ] as const satisfies AstryxTableColumns<Row>;
  const props = {
    tableId: "selection-isolation",
    columns,
    getRowId: (row: Row) => row.id,
    initialOrderBy: [{ columnId: "COL_ID_VALUE", direction: "asc" }] as const,
    clientSource: {
      rows: [
        { id: "a", value: 1 },
        { id: "b", value: 2 },
      ],
      totalRows: 2,
      version: 1,
      status: "ready" as const,
    },
  };
  const events: string[] = [];
  let structural = 0;
  const remove = installAstryxTableRowSelectionRenderListener(props.tableId, (part, rowId) =>
    events.push(`${part}:${rowId ?? ""}`),
  );
  const removeRoot = installAstryxTableClientViewRenderListenerForTable(props.tableId, () => {
    structural++;
  });
  const removeSurface = installAstryxTableClientGridSurfaceRenderListenerForTable(
    props.tableId,
    () => {
      structural++;
    },
  );
  try {
    const view = await render(<AstryxTableClient {...props} rowSelection />);
    await expect
      .element(page.getByRole("checkbox", { name: "Select row 1", exact: true }))
      .toBeVisible();
    events.length = 0;
    structural = 0;
    await page.getByRole("checkbox", { name: "Select row 1", exact: true }).click();
    await expect
      .element(page.getByRole("checkbox", { name: "Select row 1", exact: true }))
      .toBeChecked();
    expect(events.toSorted()).toEqual(["header:", "row:a"]);
    expect(structural).toBe(0);
    events.length = 0;
    await view.rerender(
      <AstryxTableClient
        {...props}
        rowSelection
        clientSource={{
          ...props.clientSource,
          version: 2,
          rows: [props.clientSource.rows[0]!, { id: "b", value: 3 }],
        }}
      />,
    );
    await expect.element(page.getByRole("gridcell", { name: "3", exact: true })).toBeVisible();
    expect(events).toEqual([]);
    expect(structural).toBe(0);
  } finally {
    remove();
    removeRoot();
    removeSurface();
  }
});
