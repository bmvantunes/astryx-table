import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";

type Row = { id: string; value: number };
const columns = [
  { columnId: "COL_ID_VALUE", headerName: "Value", field: "value", valueType: "number" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "toolbar",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_VALUE", direction: "asc" }] as const,
  clientSource: {
    rows: [{ id: "one", value: 1 }],
    totalRows: 1,
    version: 1,
    status: "ready" as const,
  },
};
afterEach(cleanup);

test("optional page controls belong to a named published toolbar and remain operable", async () => {
  const onAction = vi.fn();
  const screen = await render(
    <AstryxTableClient {...props}>
      <button type="button" onClick={onAction}>
        Refresh
      </button>
      <button type="button">Export</button>
    </AstryxTableClient>,
  );
  const toolbar = page.getByRole("toolbar", { name: "toolbar controls" });
  await expect.element(toolbar).toBeVisible();
  const refresh = toolbar.getByRole("button", { name: "Refresh" });
  refresh.element().focus();
  await userEvent.keyboard("{Enter}");
  expect(onAction).toHaveBeenCalledTimes(1);
  await screen.rerender(<AstryxTableClient {...props} />);
  await expect.element(toolbar).not.toBeInTheDocument();
});
