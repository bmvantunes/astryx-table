import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumns,
  type AstryxTablePersistedState,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; age: number };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text", width: 180 },
  {
    columnId: "COL_ID_AGE",
    headerName: "Age",
    field: "age",
    valueType: "number",
    width: 120,
    pinned: "end",
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "column-preferences",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [{ id: "ada", name: "Ada", age: 42 }],
    totalRows: 1,
    version: 1,
    status: "ready" as const,
  },
};

test("native column visibility preserves hidden sorting, protects the last column and restores persisted intent", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  const onPersistChange = (state: AstryxTablePersistedState<Row, typeof columns, true>) =>
    persisted.push(state);
  const view = await render(<AstryxTableClient {...props} onPersistChange={onPersistChange} />);
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Visible columns", exact: true });
  await trigger.click();
  await page.getByRole("option", { name: "Name", exact: true }).click();
  await expect
    .element(page.getByRole("columnheader", { name: "Name", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("option", { name: "Age", exact: true }))
    .toHaveAttribute("aria-disabled", "true");
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({
    columnVisibility: { COL_ID_NAME: false },
    orderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }],
  });
  await page.getByRole("option", { name: "Name", exact: true }).click();
  await expect.element(page.getByRole("columnheader", { name: "Name", exact: true })).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
  expect(persisted).toHaveLength(2);
  await view.unmount();
  await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={persisted[0]!}
      onPersistChange={onPersistChange}
    />,
  );
  await expect
    .element(page.getByRole("columnheader", { name: "Name", exact: true }))
    .not.toBeInTheDocument();
  await expect.element(page.getByRole("columnheader", { name: "Age", exact: true })).toBeVisible();
  expect(persisted).toHaveLength(2);
});

test("resetting the complete layout emits one snapshot and keeps active filters and sorting", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={{
        version: 1,
        tableId: props.tableId,
        filters: [
          {
            columnId: "COL_ID_NAME",
            type: "contains",
            filter: "Ada",
            codecId: "@bruno/table/text",
            codecVersion: 1,
          },
        ],
        orderBy: props.initialOrderBy,
        groupBy: [],
        groupOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
        columnOrder: ["COL_ID_AGE", "COL_ID_NAME"],
        columnVisibility: { COL_ID_AGE: false },
        columnWidths: { COL_ID_NAME: 240 },
        columnPinning: { start: ["COL_ID_NAME"], end: [] },
      }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  await page.getByRole("button", { name: "Reset columns", exact: true }).click();
  await page.getByRole("menuitem", { name: "Reset entire column layout", exact: true }).click();
  await expect.element(page.getByRole("columnheader", { name: "Age", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Reset columns", exact: true }))
    .toHaveFocus();
  await expect
    .element(page.getByRole("status", { name: "Column preferences status", exact: true }))
    .toHaveTextContent("Column layout reset");
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({
    columnOrder: ["COL_ID_NAME", "COL_ID_AGE"],
    columnWidths: {},
    columnPinning: { start: [], end: ["COL_ID_AGE"] },
    filters: [{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }],
    orderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }],
  });
  expect(
    page.getByRole("columnheader", { name: "Name", exact: true }).element().getBoundingClientRect()
      .width,
  ).toBe(180);
});

test.for([
  ["Reset column order", { columnOrder: ["COL_ID_NAME", "COL_ID_AGE"] }],
  ["Reset column widths", { columnWidths: {} }],
  ["Reset column visibility", { columnVisibility: { COL_ID_NAME: true, COL_ID_AGE: true } }],
  ["Reset column pinning", { columnPinning: { start: [], end: ["COL_ID_AGE"] } }],
] as const)("%s changes only its own preference and is idempotent", async ([label, expected]) => {
  const initial: AstryxTablePersistedState<Row, typeof columns, true> = {
    version: 1,
    tableId: props.tableId,
    filters: [],
    orderBy: props.initialOrderBy,
    groupBy: [],
    groupOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
    columnOrder: ["COL_ID_AGE", "COL_ID_NAME"],
    columnVisibility: { COL_ID_NAME: true, COL_ID_AGE: false },
    columnWidths: { COL_ID_NAME: 240 },
    columnPinning: { start: ["COL_ID_NAME"], end: [] },
  };
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={initial}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Reset columns", exact: true });
  await trigger.click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await expect.element(trigger).toHaveFocus();
  expect(persisted).toEqual([{ ...initial, ...expected }]);
  await trigger.click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  expect(persisted).toHaveLength(1);
});

test("native search and keyboard toggles reach virtualized columns without changing column order", async () => {
  const wideColumns = Array.from({ length: 80 }, (_, index) => ({
    columnId: `COL_ID_C${index}` as `COL_ID_C${Uppercase<`${number}`>}`,
    headerName: `Column ${index}`,
    field: "age" as const,
    valueType: "number" as const,
    width: 120,
  })) satisfies AstryxTableColumns<Row>;
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      columns={wideColumns}
      initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  const grid = page.getByRole("grid", { name: props.tableId, exact: true }).element();
  // Let the initial measured window commit before issuing the test's scroll.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await expect
    .element(page.getByRole("columnheader", { name: "Column 0", exact: true }))
    .toBeVisible();
  expect(grid.scrollWidth).toBeGreaterThan(grid.clientWidth);
  grid.scrollLeft = 100_000;
  grid.dispatchEvent(new Event("scroll"));
  await expect
    .element(page.getByRole("columnheader", { name: "Column 79", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Visible columns", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  const search = page.getByRole("combobox", { name: "Search options", exact: true });
  await expect.element(search).toHaveFocus();
  await search.fill("Column 79");
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await expect
    .element(page.getByRole("option", { name: "Column 79", exact: true }))
    .toHaveAttribute("aria-selected", "false");
  await expect
    .element(page.getByRole("columnheader", { name: "Column 79", exact: true }))
    .not.toBeInTheDocument();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({
    columnVisibility: { COL_ID_C79: false },
    columnOrder: wideColumns.map((column) => column.columnId),
  });
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
});

test("an open picker follows replacement column definitions and retains hidden identities", async () => {
  const persisted: unknown[] = [];
  const onPersistChange = (state: unknown) => persisted.push(state);
  const view = await render(<AstryxTableClient {...props} onPersistChange={onPersistChange} />);
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  await page.getByRole("button", { name: "Visible columns", exact: true }).click();
  await page.getByRole("option", { name: "Name", exact: true }).click();
  const nextColumns = [
    { ...columns[0], headerName: "Full name" },
    columns[1],
    { columnId: "COL_ID_ID", headerName: "Identifier", field: "id", valueType: "text" },
  ] as const satisfies AstryxTableColumns<Row>;
  await view.rerender(
    <AstryxTableClient {...props} columns={nextColumns} onPersistChange={onPersistChange} />,
  );
  await expect
    .element(page.getByRole("option", { name: "Full name", exact: true }))
    .toHaveAttribute("aria-selected", "false");
  await expect
    .element(page.getByRole("option", { name: "Identifier", exact: true }))
    .toHaveAttribute("aria-selected", "true");
  await page.getByRole("option", { name: "Full name", exact: true }).click();
  await expect
    .element(page.getByRole("columnheader", { name: "Full name", exact: true }))
    .toBeVisible();
  expect(persisted).toHaveLength(2);
});

test("a label-only replacement updates picker labels and search without changing preferences", async () => {
  const persisted: unknown[] = [];
  const onPersistChange = (state: unknown) => persisted.push(state);
  const view = await render(<AstryxTableClient {...props} onPersistChange={onPersistChange} />);
  const open = async () => {
    await page.getByRole("button", { name: "Column preferences", exact: true }).click();
    await page.getByRole("button", { name: "Visible columns", exact: true }).click();
  };
  await open();
  const nextColumns = [{ ...columns[0], headerName: "Customer" }, columns[1]] as const;
  await view.rerender(
    <AstryxTableClient {...props} columns={nextColumns} onPersistChange={onPersistChange} />,
  );
  await expect.element(page.getByRole("option", { name: "Customer", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("option", { name: "Name", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("combobox", { name: "Search options", exact: true }).fill("Customer");
  await expect.element(page.getByRole("option", { name: "Customer", exact: true })).toBeVisible();
  await userEvent.keyboard("{Escape}{Escape}");
  await open();
  await expect.element(page.getByRole("option", { name: "Customer", exact: true })).toBeVisible();
  expect(persisted).toHaveLength(0);
});

test("column management occupies a compact side rail without a page toolbar", async () => {
  await render(
    <div style={{ width: 640 }}>
      <AstryxTableClient {...props} />
    </div>,
  );
  await expect.element(page.getByRole("toolbar")).not.toBeInTheDocument();
  const grid = page.getByRole("grid").element().getBoundingClientRect();
  const rail = page
    .getByRole("complementary", { name: "column-preferences column management" })
    .element()
    .getBoundingClientRect();
  expect(rail.top).toBe(grid.top);
  expect(rail.left).toBeGreaterThanOrEqual(grid.right);
  expect(rail.width).toBeLessThanOrEqual(40);
  expect(grid.width + rail.width).toBeLessThanOrEqual(640);
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Visible columns", exact: true }))
    .toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("button", { name: "Column preferences", exact: true }))
    .toHaveFocus();
});

test("repeated successful resets produce a fresh accessible announcement", async () => {
  await render(<AstryxTableClient {...props} />);
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  const status = page.getByRole("status", { name: "Column preferences status", exact: true });
  let previous: ChildNode | null = null;
  for (let pass = 0; pass < 2; pass++) {
    await page.getByRole("button", { name: "Visible columns", exact: true }).click();
    await page.getByRole("option", { name: "Name", exact: true }).click();
    await userEvent.keyboard("{Escape}");
    await page.getByRole("button", { name: "Reset columns", exact: true }).click();
    await page.getByRole("menuitem", { name: "Reset column visibility", exact: true }).click();
    await expect.element(status).toHaveTextContent("Column visibility reset");
    await expect
      .element(page.getByRole("columnheader", { name: "Name", exact: true }))
      .toBeVisible();
    const current = status.element().firstChild;
    expect(current).not.toBe(previous);
    previous = current;
  }
});
