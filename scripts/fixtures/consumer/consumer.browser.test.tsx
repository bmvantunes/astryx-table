import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import {
  AstryxTableClient,
  AstryxTableBigIntColumn,
  type AstryxTableColumns,
} from "@bmvantunes/astryx-table";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "@bmvantunes/astryx-table/styles.css";

type Row = { id: string; amount: bigint };
const columns = [
  AstryxTableBigIntColumn({ columnId: "COL_ID_AMOUNT", headerName: "Amount", field: "amount" }),
] as const satisfies AstryxTableColumns<Row>;
const rows = [
  { id: "low", amount: 9007199254740992n },
  { id: "high", amount: 9007199254740993n },
];
afterEach(cleanup);

test("installed JavaScript, declarations and CSS render an exact styled Client without source transforms", async () => {
  await render(
    <Theme theme={neutralTheme}>
      <AstryxTableClient
        tableId="installed"
        columns={columns}
        getRowId={(row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_AMOUNT", direction: "desc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      />
    </Theme>,
  );
  await expect.element(page.getByRole("row").nth(1)).toHaveTextContent("9007199254740993");
  await expect
    .element(page.getByRole("grid", { name: "installed" }))
    .toHaveStyle({ overflow: "auto", position: "relative", fontSize: "14px" });
  await expect
    .element(page.getByRole("gridcell", { name: "9007199254740993", exact: true }))
    .toHaveStyle({ paddingInlineStart: "10px", boxSizing: "border-box" });
  const trigger = page.getByRole("button", { name: "Amount column menu", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("menuitem", { name: "Sort ascending", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("row").nth(1)).toHaveTextContent("9007199254740992");
  await expect.element(trigger).toHaveFocus();
});
