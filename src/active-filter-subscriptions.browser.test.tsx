import { useMemo } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableActiveFilters,
  AstryxTableClient,
  type AstryxTableColumns,
} from "../packages/table/src";
import { ClientContext, useClientContext } from "../packages/table/src/internal/client-context";
import "./styles.css";

afterEach(cleanup);

test("closed filter review owns only a count subscription and ignores same-count operand changes", async () => {
  const stats = { detailSubscriptions: 0, countSubscriptions: 0, countNotifications: 0 };
  function ObservedControl() {
    const context = useClientContext();
    const observed = useMemo(
      () => ({
        ...context,
        runtime: {
          ...context.runtime,
          subscribeFilter(listener: () => void) {
            stats.detailSubscriptions++;
            const unsubscribe = context.runtime.subscribeFilter(listener);
            return () => {
              stats.detailSubscriptions--;
              unsubscribe();
            };
          },
          subscribeActiveFilterCount(listener: () => void) {
            stats.countSubscriptions++;
            const unsubscribe = context.runtime.subscribeActiveFilterCount(() => {
              stats.countNotifications++;
              listener();
            });
            return () => {
              stats.countSubscriptions--;
              unsubscribe();
            };
          },
        },
      }),
      [context],
    );
    return (
      <ClientContext value={observed}>
        <AstryxTableActiveFilters />
      </ClientContext>
    );
  }
  type Row = { id: string; name: string };
  const columns = [
    { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  ] as const satisfies AstryxTableColumns<Row>;
  const rows = [
    { id: "ada", name: "Ada" },
    { id: "alan", name: "Alan" },
  ];
  const view = await render(
    <AstryxTableClient
      tableId="active-filter-subscriptions"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "A" }]}
      clientSource={{ rows, totalRows: 2, version: 1, status: "ready" }}
    >
      <ObservedControl />
    </AstryxTableClient>,
  );
  expect(stats).toEqual({ detailSubscriptions: 0, countSubscriptions: 1, countNotifications: 0 });
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  await page.getByRole("textbox", { name: "Filter value", exact: true }).fill("Ada");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  expect(stats).toEqual({ detailSubscriptions: 0, countSubscriptions: 1, countNotifications: 0 });
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Active filters (1)", exact: true }).click();
  await expect
    .element(page.getByRole("dialog", { name: "Active filters", exact: true }))
    .toBeVisible();
  expect(stats.detailSubscriptions).toBe(1);
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("dialog", { name: "Active filters", exact: true }))
    .not.toBeInTheDocument();
  expect(stats.detailSubscriptions).toBe(0);
  await page.getByRole("button", { name: "Name column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Clear column filter", exact: true }).click();
  expect(stats.countNotifications).toBe(1);
  await expect
    .element(page.getByRole("button", { name: "Active filters (0)", exact: true }))
    .toBeVisible();
  await view.unmount();
  expect(stats.countSubscriptions).toBe(0);
});
