import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vite-plus/test";
import {
  AstryxTableClient,
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  type AstryxTableColumns,
} from "../packages/table/src";
import { installAstryxTableToolbarLifetimeListener } from "../packages/table/src/internal/toolbar-instrumentation";

test("SSR initializes the filtered result lazily once and renders truthful initial counts", () => {
  type Row = { id: string; name: string };
  const columns = [
    { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  ] as const satisfies AstryxTableColumns<Row>;
  const props = {
    tableId: "ssr-count",
    columns,
    getRowId: (row: Row) => row.id,
    initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
    initialFilters: [{ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" }] as const,
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
  const events = vi.fn();
  const remove = installAstryxTableToolbarLifetimeListener(events);
  try {
    renderToString(createElement(AstryxTableClient<Row, typeof columns>, props));
    renderToString(
      createElement(
        AstryxTableClient<Row, typeof columns>,
        props,
        createElement(AstryxTableLoadedRowCount),
      ),
    );
    expect(
      events.mock.calls.filter(([event]) => event.kind === "result-row-count-initialize"),
    ).toHaveLength(0);
    const html = renderToString(
      createElement(
        AstryxTableClient<Row, typeof columns>,
        props,
        createElement(
          Fragment,
          null,
          createElement(AstryxTableResultRowCount),
          createElement(AstryxTableResultRowCount),
          createElement(AstryxTableLoadedRowCount),
          createElement(AstryxTableActiveFilterCount),
          createElement(AstryxTableActiveSortCount),
        ),
      ),
    );
    expect(html).toContain("1 result row");
    expect(html).toContain("2 loaded rows");
    expect(html).toContain("1 active filter");
    expect(html).toContain("1 active sort");
    expect(html).not.toContain("2 result rows");
    expect(
      events.mock.calls.filter(([event]) => event.kind === "result-row-count-initialize"),
    ).toHaveLength(1);
  } finally {
    remove();
  }
});
