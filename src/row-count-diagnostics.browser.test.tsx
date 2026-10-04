import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  AstryxTableQuickFilter,
  type AstryxTableColumns,
} from "../packages/table/src";
import { installAstryxTableToolbarSubscriptionListener } from "../packages/table/src/internal/toolbar-instrumentation";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "count-diagnostics",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  quickFilterFields: ["name"] as const,
  clientSource: {
    rows: [
      { id: "ada", name: "Ada" },
      { id: "alan", name: "Alan" },
    ],
    totalRows: 2,
    version: 1,
    status: "ready" as const,
  },
};

test("count subscriptions ignore value-only publications, retain callback changes, and clean up", async () => {
  const events = vi.fn();
  const remove = installAstryxTableToolbarSubscriptionListener(events);
  const result = vi.fn((count: number) => `Result: ${count}`);
  const loaded = vi.fn((count: number) => `Loaded: ${count}`);
  const controls = (
    <>
      <AstryxTableResultRowCount>{result}</AstryxTableResultRowCount>
      <AstryxTableLoadedRowCount>{loaded}</AstryxTableLoadedRowCount>
      <AstryxTableQuickFilter />
    </>
  );
  try {
    const view = await render(<AstryxTableClient {...props}>{controls}</AstryxTableClient>);
    await expect
      .element(page.getByRole("status", { name: "Result rows", exact: true }))
      .toHaveTextContent("Result: 2");
    expect(events.mock.calls.map(([event]) => [event.projection, event.phase])).toEqual([
      ["result-row-count", "subscribe"],
      ["loaded-row-count", "subscribe"],
    ]);
    events.mockClear();
    result.mockClear();
    loaded.mockClear();
    const clientSource = {
      ...props.clientSource,
      rows: [props.clientSource.rows[0]!, { id: "alan", name: "Alan updated" }],
      version: 2,
    };
    await view.rerender(
      <AstryxTableClient {...props} clientSource={clientSource}>
        {controls}
      </AstryxTableClient>,
    );
    await expect
      .element(page.getByRole("gridcell", { name: "Alan updated", exact: true }))
      .toBeVisible();
    expect(events).not.toHaveBeenCalled();
    expect(result).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();
    await page.getByRole("searchbox", { name: "Quick Filter", exact: true }).fill("Ada");
    await expect
      .element(page.getByRole("status", { name: "Result rows", exact: true }))
      .toHaveTextContent("Result: 1");
    expect(events.mock.calls.map(([event]) => [event.projection, event.phase])).toEqual([
      ["result-row-count", "notify"],
    ]);
    expect(loaded).not.toHaveBeenCalled();
    events.mockClear();
    await view.rerender(
      <AstryxTableClient {...props} clientSource={clientSource}>
        <AstryxTableResultRowCount>{(count) => `New: ${count}`}</AstryxTableResultRowCount>
        <AstryxTableLoadedRowCount>{loaded}</AstryxTableLoadedRowCount>
        <AstryxTableQuickFilter />
      </AstryxTableClient>,
    );
    await expect
      .element(page.getByRole("status", { name: "Result rows", exact: true }))
      .toHaveTextContent("New: 1");
    expect(events).not.toHaveBeenCalled();
    await view.unmount();
    expect(events.mock.calls.map(([event]) => [event.projection, event.phase])).toEqual([
      ["result-row-count", "unsubscribe"],
      ["loaded-row-count", "unsubscribe"],
    ]);
  } finally {
    remove();
  }
});
