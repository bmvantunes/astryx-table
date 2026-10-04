import { Component, type ReactNode } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";

type Row = { id: string; name: string };
const columns = [
  {
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    valueType: "text",
    groupBy: true,
    valueFormatter: ({ row }) => row.id.toUpperCase(),
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "capabilities",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [{ id: "one", name: "One" }],
    totalRows: 1,
    version: 1,
    status: "ready" as const,
  },
};
const preferences = {
  version: 1 as const,
  tableId: props.tableId,
  filters: [],
  orderBy: props.initialOrderBy,
  groupBy: [],
  groupOrderBy: props.initialOrderBy,
  columnOrder: ["COL_ID_NAME"] as const,
  columnVisibility: {},
  columnWidths: {},
  columnPinning: { start: [], end: [] },
};
class Boundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message === null ? (
      this.props.children
    ) : (
      <div role="alert">{this.state.message}</div>
    );
  }
}
afterEach(cleanup);

test.each(["start", "end"] as const)(
  "initial %s pinning preserves its only column",
  async (pinned) => {
    await render(
      <Boundary>
        <AstryxTableClient {...props} columns={[{ ...columns[0], pinned }]} />
      </Boundary>,
    );
    await expect
      .element(page.getByRole("columnheader", { name: "Name", exact: true }))
      .toBeVisible();
    await expect.element(page.getByRole("gridcell", { name: "ONE", exact: true })).toBeVisible();
  },
);
test.each(["start", "end"] as const)(
  "restored %s pinning preserves its only column",
  async (side) => {
    const columnPinning =
      side === "start"
        ? { start: ["COL_ID_NAME"] as const, end: [] }
        : { start: [], end: ["COL_ID_NAME"] as const };
    await render(
      <Boundary>
        <AstryxTableClient {...props} initialPersistedState={{ ...preferences, columnPinning }} />
      </Boundary>,
    );
    await expect
      .element(page.getByRole("columnheader", { name: "Name", exact: true }))
      .toBeVisible();
    await expect.element(page.getByRole("gridcell", { name: "ONE", exact: true })).toBeVisible();
  },
);
test("restored grouping uses Group Key presentation instead of fabricated raw rows", async () => {
  await render(
    <Boundary>
      <AstryxTableClient
        {...props}
        initialPersistedState={{ ...preferences, groupBy: ["COL_ID_NAME"] }}
      />
    </Boundary>,
  );
  await expect.element(page.getByRole("gridcell", { name: "One", exact: true })).toBeVisible();
  await expect.element(page.getByRole("columnheader", { name: "Rows", exact: true })).toBeVisible();
});
test("untyped consumers cannot silently enable Row Selection", async () => {
  const untyped = { ...props, rowSelection: true };
  // Deliberately cross the type boundary as a JavaScript consumer would.
  await render(
    <Boundary>
      <AstryxTableClient {...(untyped as typeof props)} />
    </Boundary>,
  );
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("Row Selection is not available in this Client slice");
});
