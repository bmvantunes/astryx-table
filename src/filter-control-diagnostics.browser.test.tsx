import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableFilterControl,
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  type AstryxTableColumns,
  type AstryxTableGridFilterCommandCapability,
} from "../packages/table/src";
import {
  installAstryxTableToolbarSubscriptionListener,
  installAstryxTableToolbarLifetimeListener,
} from "../packages/table/src/internal/toolbar-instrumentation";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "command-isolation",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [
      { id: "ada", name: "Ada" },
      { id: "grace", name: "Grace" },
    ],
    totalRows: 2,
    version: 1,
    status: "ready" as const,
  },
};

test("commands own no subscriptions and all count sources ignore unchanged cardinality", async () => {
  const events = vi.fn();
  const lifetime = vi.fn();
  const remove = installAstryxTableToolbarSubscriptionListener(events);
  const removeLifetime = installAstryxTableToolbarLifetimeListener(lifetime);
  const commandRenders = vi.fn();
  const filters = vi.fn((count: number) => `Filters: ${count}`);
  const sorts = vi.fn((count: number) => `Sorts: ${count}`);
  const capabilities: AstryxTableGridFilterCommandCapability<Row, typeof columns>[] = [];
  const commandControl = (
    <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
      {(commands) => {
        commandRenders();
        capabilities.push(commands);
        return (
          <>
            <button
              onClick={() =>
                commands.replace({ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" })
              }
            >
              Show Ada
            </button>
            <button
              onClick={() =>
                commands.replace({ columnId: "COL_ID_NAME", type: "equals", filter: "Grace" })
              }
            >
              Show Grace
            </button>
          </>
        );
      }}
    </AstryxTableFilterControl>
  );
  const controls = (
    <>
      {commandControl}
      <AstryxTableActiveFilterCount>{filters}</AstryxTableActiveFilterCount>
      <AstryxTableActiveSortCount>{sorts}</AstryxTableActiveSortCount>
      <AstryxTableResultRowCount />
      <AstryxTableLoadedRowCount />
    </>
  );
  try {
    const view = await render(<AstryxTableClient {...props}>{commandControl}</AstryxTableClient>);
    expect(events).not.toHaveBeenCalled();
    expect(
      lifetime.mock.calls.filter(([event]) => event.kind === "result-row-count-initialize"),
    ).toHaveLength(0);
    expect(Object.keys(capabilities[0]!).sort()).toEqual(["clear", "clearAll", "replace", "reset"]);
    expect(Object.isFrozen(capabilities[0])).toBe(true);
    await view.rerender(<AstryxTableClient {...props}>{controls}</AstryxTableClient>);
    await expect
      .element(page.getByRole("status", { name: "Active filters", exact: true }))
      .toHaveTextContent("Filters: 0");
    expect(
      events.mock.calls
        .filter(([event]) => event.phase === "subscribe")
        .map(([event]) => event.projection)
        .sort(),
    ).toEqual(["active-filter-count", "active-sort-count", "loaded-row-count", "result-row-count"]);
    const commandCount = commandRenders.mock.calls.length;
    events.mockClear();
    filters.mockClear();
    sorts.mockClear();
    await view.rerender(
      <AstryxTableClient
        {...props}
        clientSource={{
          ...props.clientSource,
          rows: [props.clientSource.rows[0]!, { id: "grace", name: "Grace updated" }],
          version: 2,
        }}
      >
        {controls}
      </AstryxTableClient>,
    );
    await expect
      .element(page.getByRole("gridcell", { name: "Grace updated", exact: true }))
      .toBeVisible();
    expect(events).not.toHaveBeenCalled();
    expect(filters).not.toHaveBeenCalled();
    expect(sorts).not.toHaveBeenCalled();
    expect(commandRenders).toHaveBeenCalledTimes(commandCount);
    await page.getByRole("button", { name: "Show Ada", exact: true }).click();
    await expect
      .element(page.getByRole("status", { name: "Result rows", exact: true }))
      .toHaveTextContent("1 result row");
    await expect
      .element(page.getByRole("status", { name: "Active filters", exact: true }))
      .toHaveTextContent("Filters: 1");
    expect(events.mock.calls.map(([event]) => [event.projection, event.phase]).sort()).toEqual([
      ["active-filter-count", "notify"],
      ["result-row-count", "notify"],
    ]);
    events.mockClear();
    filters.mockClear();
    await view.rerender(
      <AstryxTableClient {...props} clientSource={{ ...props.clientSource, version: 3 }}>
        {controls}
      </AstryxTableClient>,
    );
    await page.getByRole("button", { name: "Show Grace", exact: true }).click();
    await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
    expect(events).not.toHaveBeenCalled();
    expect(filters).not.toHaveBeenCalled();
    expect(sorts).not.toHaveBeenCalled();
    expect(commandRenders).toHaveBeenCalledTimes(commandCount);
    expect(capabilities.every((value) => value === capabilities[0])).toBe(true);
    await view.unmount();
    expect(events.mock.calls.map(([event]) => [event.projection, event.phase]).sort()).toEqual([
      ["active-filter-count", "unsubscribe"],
      ["active-sort-count", "unsubscribe"],
      ["loaded-row-count", "unsubscribe"],
      ["result-row-count", "unsubscribe"],
    ]);
  } finally {
    remove();
    removeLifetime();
  }
});
