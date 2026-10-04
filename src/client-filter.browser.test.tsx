import { useEffect, useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableSelectColumn,
  type AstryxTableColumns,
  type AstryxTableColumnId,
  type AstryxTablePersistedState,
} from "../packages/table/src";
import "./styles.css";

type Row = { id: string; name: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text", width: 240 },
] as const satisfies AstryxTableColumns<Row>;
const rows = [
  { id: "ada", name: "Ada" },
  { id: "alan", name: "Alan" },
  { id: "grace", name: "Grace" },
];
afterEach(cleanup);

test("a column menu transfers to a debounced text filter and persists only the committed expression", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  const view = await render(
    <AstryxTableClient
      tableId="filter"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  const menu = page.getByRole("button", { name: "Name column menu", exact: true });
  menu.element().focus();
  await userEvent.keyboard("{Enter}");
  await page.getByRole("menuitem", { name: "Filter column", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Filter value", exact: true });
  await expect.element(input).toHaveFocus();
  expect(persisted).toHaveLength(0);
  await input.fill("Ada");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]?.filters).toEqual([
    {
      columnId: "COL_ID_NAME",
      type: "contains",
      filter: "Ada",
      codecId: "@bruno/table/text",
      codecVersion: 1,
    },
  ]);
  await userEvent.keyboard("{Escape}");
  await expect.element(menu).toHaveFocus();
  const snapshot = persisted[0]!;
  await view.unmount();
  await render(
    <AstryxTableClient
      tableId="filter"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialPersistedState={snapshot}
      clientSource={{ rows, totalRows: rows.length, version: 2, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  expect(persisted).toHaveLength(1);
});

test("Alt+Enter opens the active header filter; invalid input and dismissed pending drafts preserve the committed filter", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <>
      <AstryxTableClient
        tableId="filter-drafts"
        columns={columns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        onPersistChange={(state) => persisted.push(state)}
      />
      <button>Outside</button>
    </>,
  );
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{ArrowUp}{Alt>}{Enter}{/Alt}");
  const input = page.getByRole("textbox", { name: "Filter value", exact: true });
  await expect.element(input).toHaveFocus();
  await expect.element(input).toHaveValue("Ada");
  await input.fill("");
  await expect.element(input).toHaveAttribute("aria-invalid", "true");
  expect(persisted).toHaveLength(0);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await input.fill("Grace");
    await page.getByRole("button", { name: "Outside", exact: true }).click();
    await expect.element(page.getByRole("button", { name: "Outside", exact: true })).toHaveFocus();
    await vi.advanceTimersByTimeAsync(220);
    expect(persisted).toHaveLength(0);
    await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  } finally {
    vi.useRealTimers();
  }
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  await expect.element(input).toHaveValue("Ada");
});

test("text operators and sensitivity choices commit immediately through native controls", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  const values = [
    { id: "upper", name: "Ada" },
    { id: "lower", name: "ada" },
    { id: "accent", name: "Áda" },
    { id: "other", name: "Alan" },
  ];
  await render(
    <AstryxTableClient
      tableId="filter-operators"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }]}
      clientSource={{ rows: values, totalRows: values.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  await page.getByRole("combobox", { name: "Operator", exact: true }).click();
  await page.getByRole("option", { name: "Equals", exact: true }).click();
  await expect.poll(() => persisted.length).toBe(1);
  expect(page.getByRole("gridcell").all()).toHaveLength(3);
  await page.getByRole("checkbox", { name: "Case sensitive", exact: true }).click();
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(2);
  await page.getByRole("checkbox", { name: "Accent sensitive", exact: true }).click();
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  expect(persisted).toHaveLength(3);
  expect(persisted[2]?.filters).toEqual([
    {
      columnId: "COL_ID_NAME",
      type: "equals",
      filter: { $astryxTableValue: "text", version: 1, value: "Ada" },
      codecId: "@bruno/table/text",
      codecVersion: 1,
      caseSensitive: true,
      accentSensitive: true,
    },
  ]);
});

test("IME composition keeps intermediate text local until composition ends", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-ime"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  const input = page.getByRole("textbox", { name: "Filter value", exact: true });
  input.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await input.fill("Gr");
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(persisted).toHaveLength(0);
  expect(page.getByRole("gridcell").all()).toHaveLength(3);
  await input.fill("Grace");
  input
    .element()
    .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
  await expect.poll(() => persisted.length).toBe(1);
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
});

test("nested operator Escape closes only the selector before the filter", async () => {
  await render(
    <AstryxTableClient
      tableId="filter-nested"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  const selector = page.getByRole("combobox", { name: "Operator", exact: true });
  await selector.click();
  await expect.element(page.getByRole("listbox")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("dialog", { name: "Filter Name", exact: true }))
    .toBeVisible();
  await expect.element(selector).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }))
    .toHaveFocus();
});

test("a recycled open filter cancels its draft and returns focus without revealing its old column", async () => {
  const persisted: unknown[] = [];
  const wide: AstryxTableColumns<Row> = [
    columns[0],
    ...Array.from({ length: 70 }, (_, index) => ({
      columnId: `COL_ID_EXTRA_${index}` as AstryxTableColumnId,
      headerName: `Extra ${index}`,
      field: "name" as const,
      valueType: "text" as const,
      width: 120,
    })),
  ];
  await render(
    <div style={{ width: 400 }}>
      <AstryxTableClient
        tableId="filter-recycle"
        columns={wide}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        onPersistChange={(state) => persisted.push(state)}
      />
    </div>,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await page.getByRole("textbox", { name: "Filter value", exact: true }).fill("Grace");
    const grid = page.getByRole("grid");
    grid.element().scrollLeft = grid.element().scrollWidth;
    grid.element().dispatchEvent(new Event("scroll"));
    await expect
      .element(page.getByRole("columnheader", { name: "Name", exact: true }))
      .not.toBeInTheDocument();
    await expect.element(grid).toHaveFocus();
    expect(grid.element().scrollLeft).toBeGreaterThan(1000);
    await vi.advanceTimersByTimeAsync(220);
    expect(persisted).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});

test("column commands clear and restore the baseline filter without opening an editor", async () => {
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-clear"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Name column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Clear column filter", exact: true }).click();
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(3);
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{Alt>}{Shift>}{Enter}{/Shift}{/Alt}");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  await expect.element(grid).toHaveFocus();
  await expect
    .element(page.getByRole("dialog", { name: "Filter Name", exact: true }))
    .not.toBeInTheDocument();
  expect(persisted).toHaveLength(2);
  await userEvent.keyboard("{Alt>}{Shift>}{Enter}{/Shift}{/Alt}");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(3);
  expect(persisted).toHaveLength(3);
});

test("column replacement invalidates the entire old IME session", async () => {
  const persisted: unknown[] = [];
  const fixture = (
    definition: readonly [
      Omit<(typeof columns)[0], "headerName"> & { readonly headerName: string },
    ],
  ) => (
    <AstryxTableClient
      tableId="filter-ime-replace"
      columns={definition}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />
  );
  const view = await render(fixture(columns));
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  const input = page.getByRole("textbox", { name: "Filter value", exact: true });
  input.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await input.fill("Gr");
  await view.rerender(fixture([{ ...columns[0], headerName: "Person" }]));
  await expect.element(input).toHaveValue("Ada");
  await input.fill("Grace");
  input
    .element()
    .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(persisted).toHaveLength(0);
  await expect.element(input).toHaveValue("Ada");
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
});

test("opening an existing compound expression preserves it without a lossy draft", async () => {
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-compound"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[
        {
          type: "OR",
          conditions: [
            { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
            { columnId: "COL_ID_NAME", type: "equals", filter: "Grace" },
          ],
        },
      ]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  await expect
    .element(page.getByRole("dialog", { name: "Filter Name", exact: true }))
    .toBeVisible();
  expect(page.getByRole("textbox").all()).toHaveLength(2);
  await userEvent.keyboard("{Escape}");
  expect(persisted).toHaveLength(0);
  expect(page.getByRole("gridcell").all()).toHaveLength(2);
});

test("an unsortable text header opens its filter with Enter and F2 remains a no-op", async () => {
  const definition = [
    { ...columns[0], enableSorting: false },
    {
      columnId: "COL_ID_ID",
      headerName: "Identity",
      field: "id",
      valueType: "text",
      enableFilter: false,
    },
  ] as const satisfies AstryxTableColumns<Row>;
  await render(
    <AstryxTableClient
      tableId="filter-unsortable"
      columns={definition}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_ID", direction: "asc" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
    />,
  );
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{ArrowUp}{F2}");
  expect(page.getByRole("dialog").all()).toHaveLength(0);
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("textbox", { name: "Filter value", exact: true }))
    .toHaveFocus();
});

test("an active filter is announced by its header control", async () => {
  await render(
    <AstryxTableClient
      tableId="filter-indicator"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
    />,
  );
  await expect
    .element(page.getByRole("button", { name: "Filter Name (active)", exact: true }))
    .toBeVisible();
});

test("text operand lists restore exact values and publish only complete valid drafts", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-list"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "in", filter: ["Ada", "Alan"] }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  const first = page.getByRole("textbox", { name: "Filter value", exact: true });
  const second = page.getByRole("textbox", { name: "Filter value 2", exact: true });
  await expect.element(first).toHaveValue("Ada");
  await expect.element(second).toHaveValue("Alan");
  await second.fill("Grace");
  await expect.poll(() => persisted.length).toBe(1);
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(2);
  expect(persisted[0]?.filters).toEqual([
    {
      columnId: "COL_ID_NAME",
      type: "in",
      filter: [
        { $astryxTableValue: "text", version: 1, value: "Ada" },
        { $astryxTableValue: "text", version: 1, value: "Grace" },
      ],
      codecId: "@bruno/table/text",
      codecVersion: 1,
    },
  ]);
  await second.fill("");
  await expect.element(second).toHaveAttribute("aria-invalid", "true");
  await first.fill("Alan");
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(persisted).toHaveLength(1);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  await expect.element(first).toHaveValue("Ada");
  await expect.element(second).toHaveValue("Grace");
});

test("list values can be added and removed without publishing an unfinished expression or losing focus", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-list-controls"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  await page.getByRole("combobox", { name: "Operator", exact: true }).click();
  await page.getByRole("option", { name: "Is one of", exact: true }).click();
  await expect.poll(() => persisted.length).toBe(1);
  await page.getByRole("button", { name: "Add filter value", exact: true }).click();
  const second = page.getByRole("textbox", { name: "Filter value 2", exact: true });
  await expect.element(second).toHaveFocus();
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(persisted).toHaveLength(1);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  await second.fill("Grace");
  await expect.poll(() => persisted.length).toBe(2);
  await page.getByRole("button", { name: "Remove filter value 1", exact: true }).click();
  const first = page.getByRole("textbox", { name: "Filter value", exact: true });
  await expect.element(first).toHaveFocus();
  await expect.element(first).toHaveValue("Grace");
  expect(persisted).toHaveLength(3);
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(page.getByRole("button", { name: /^Remove filter value/ }).all()).toHaveLength(0);
});

test("large restored lists mount a bounded operand window and reveal an added value", async () => {
  const values = [
    "Ada",
    ...Array.from({ length: 69 }, (_, index) => `Item ${String(index)}`),
  ] as const;
  await render(
    <AstryxTableClient
      tableId="filter-list-window"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "in", filter: values }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  await expect
    .element(page.getByRole("textbox", { name: "Filter value", exact: true }))
    .toHaveFocus();
  expect(page.getByRole("textbox").all()).toHaveLength(64);
  await page.getByRole("button", { name: "Next filter values", exact: true }).click();
  await expect
    .element(page.getByRole("textbox", { name: "Filter value 70", exact: true }))
    .toHaveValue("Item 68");
  expect(page.getByRole("textbox").all()).toHaveLength(64);
  await page.getByRole("button", { name: "Add filter value", exact: true }).click();
  await expect
    .element(page.getByRole("textbox", { name: "Filter value 71", exact: true }))
    .toHaveFocus();
  expect(page.getByRole("textbox").all()).toHaveLength(64);
  await page.getByRole("button", { name: "Previous filter values", exact: true }).click();
  await expect
    .element(page.getByRole("textbox", { name: "Filter value", exact: true }))
    .toHaveValue("Ada");
});

test("a local list-shape change invalidates IME events even before a new filter can commit", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-list-ime"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "in", filter: ["Ada", "Alan"] }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  await page.getByRole("button", { name: "Add filter value", exact: true }).click();
  const first = page.getByRole("textbox", { name: "Filter value", exact: true });
  first.element().focus();
  first.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await first.fill("Gr");
  await page.getByRole("button", { name: "Remove filter value 1", exact: true }).click();
  await expect.element(first).toHaveValue("Alan");
  await first.fill("Grace");
  await expect.element(first).toHaveValue("Alan");
  first
    .element()
    .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
  await expect.element(first).toHaveValue("Alan");
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(persisted).toHaveLength(0);
});

test.for([false, true])(
  "the list editor respects the shared operand limit with another column: %s",
  async (otherFilter) => {
    const budgetColumns = [
      ...columns,
      { columnId: "COL_ID_ID", headerName: "Identity", field: "id", valueType: "text" },
    ] as const satisfies AstryxTableColumns<Row>;
    const values = [
      "Ada",
      ...Array.from(
        { length: otherFilter ? 16_382 : 16_383 },
        (_, index) => `Item ${String(index)}`,
      ),
    ] as const;
    await render(
      <AstryxTableClient
        tableId="filter-list-budget"
        columns={budgetColumns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        initialFilters={[
          { columnId: "COL_ID_NAME", type: "in", filter: values },
          ...(otherFilter
            ? [{ columnId: "COL_ID_ID", type: "equals", filter: "ada" } as const]
            : []),
        ]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      />,
    );
    await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
    await expect.poll(() => page.getByRole("textbox").all().length).toBe(64);
    await expect
      .element(page.getByRole("button", { name: "Add filter value", exact: true }))
      .toBeDisabled();
    await page.getByRole("button", { name: "Remove filter value 1", exact: true }).click();
    await expect
      .element(page.getByRole("button", { name: "Add filter value", exact: true }))
      .toBeEnabled();
  },
);

test("removing another operand during composition never publishes intermediate text", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-list-interrupted-ime"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "in", filter: ["Ada", "Alan"] }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  const first = page.getByRole("textbox", { name: "Filter value", exact: true });
  first.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await first.fill("Gr");
  await page.getByRole("button", { name: "Remove filter value 2", exact: true }).click();
  await expect.element(first).toHaveValue("Ada");
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]?.filters).toEqual([
    {
      columnId: "COL_ID_NAME",
      type: "in",
      filter: [{ $astryxTableValue: "text", version: 1, value: "Ada" }],
      codecId: "@bruno/table/text",
      codecVersion: 1,
    },
  ]);
  await first.fill("Grace");
  first
    .element()
    .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
  await expect.element(first).toHaveValue("Ada");
  await new Promise((resolve) => setTimeout(resolve, 220));
  expect(persisted).toHaveLength(1);
});

test("moving the operand window cancels composition without blocking another value", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  const values = [
    "Ada",
    ...Array.from({ length: 69 }, (_, index) => `Item ${String(index)}`),
  ] as const;
  await render(
    <AstryxTableClient
      tableId="filter-list-window-ime"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "in", filter: values }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  const first = page.getByRole("textbox", { name: "Filter value", exact: true });
  first.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await first.fill("Gr");
  await page.getByRole("button", { name: "Next filter values", exact: true }).click();
  expect(persisted).toHaveLength(0);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await page.getByRole("textbox", { name: "Filter value 70", exact: true }).fill("Alan");
    await page.getByRole("button", { name: "Previous filter values", exact: true }).click();
    await vi.advanceTimersByTimeAsync(220);
    expect(persisted).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(2);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  await expect.element(page.getByRole("gridcell", { name: "Alan", exact: true })).toBeVisible();
  await first.fill("Grace");
  await expect.poll(() => persisted.length).toBe(2);
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell", { name: "Ada", exact: true }).all()).toHaveLength(0);
});

test("editing another operand keeps the whole expression local during composition", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="filter-list-concurrent-ime"
      columns={columns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "in", filter: ["Ada", "Alan"] }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: /^Filter Name(?: \(active\))?$/ }).click();
  const first = page.getByRole("textbox", { name: "Filter value", exact: true });
  first.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await first.fill("Gr");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await page.getByRole("textbox", { name: "Filter value 2", exact: true }).fill("Ada");
    await vi.advanceTimersByTimeAsync(220);
    expect(persisted).toHaveLength(0);
    await first.fill("Grace");
    first
      .element()
      .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
    await vi.advanceTimersByTimeAsync(220);
    expect(persisted).toHaveLength(1);
    await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
    await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    expect(page.getByRole("gridcell", { name: "Alan", exact: true }).all()).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});

test("boolean filters use native choices, commit immediately and restore exact false", async () => {
  type BooleanRow = { id: string; enabled: boolean | null };
  const booleanColumns = [
    {
      columnId: "COL_ID_ENABLED",
      headerName: "Enabled",
      field: "enabled",
      valueType: "boolean",
      enableSetFilter: false,
    },
  ] as const satisfies AstryxTableColumns<BooleanRow>;
  const booleanRows = [
    { id: "yes", enabled: true },
    { id: "no", enabled: false },
    { id: "empty", enabled: null },
  ];
  const persisted: AstryxTablePersistedState<BooleanRow, typeof booleanColumns, true>[] = [];
  const view = await render(
    <AstryxTableClient
      tableId="boolean-filter"
      columns={booleanColumns}
      getRowId={(row: BooleanRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_ENABLED", direction: "asc" }]}
      clientSource={{
        rows: booleanRows,
        totalRows: booleanRows.length,
        version: 1,
        status: "ready",
      }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Enabled", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Filter value", exact: true });
  await expect.element(input).toHaveFocus();
  expect(page.getByRole("textbox").all()).toHaveLength(0);
  expect(
    page.getByRole("dialog", { name: "Filter Enabled", exact: true }).getByRole("checkbox").all(),
  ).toHaveLength(0);
  expect(persisted).toHaveLength(0);
  await input.click();
  await page.getByRole("option", { name: "False", exact: true }).click();
  expect(persisted).toHaveLength(1);
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  await expect
    .element(page.getByRole("checkbox", { name: "Enabled", exact: true }))
    .not.toBeChecked();
  const snapshot = persisted[0]!;
  expect(snapshot.filters).toEqual([
    {
      columnId: "COL_ID_ENABLED",
      type: "equals",
      filter: { $astryxTableValue: "boolean", version: 1, value: false },
      codecId: "@bruno/table/boolean",
      codecVersion: 1,
    },
  ]);
  const operator = page.getByRole("combobox", { name: "Operator", exact: true });
  await operator.click();
  expect(page.getByRole("option", { name: "Contains", exact: true }).all()).toHaveLength(0);
  expect(page.getByRole("option", { name: "Is one of", exact: true }).all()).toHaveLength(0);
  await page.getByRole("option", { name: "Not equal", exact: true }).click();
  expect(persisted).toHaveLength(2);
  await expect.element(page.getByRole("checkbox", { name: "Enabled", exact: true })).toBeChecked();
  expect(
    page.getByRole("checkbox", { name: "Enabled", exact: true, checked: false }).all(),
  ).toHaveLength(0);
  await operator.click();
  await page.getByRole("option", { name: "Blank", exact: true }).click();
  expect(persisted).toHaveLength(3);
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  expect(input.all()).toHaveLength(0);
  await operator.click();
  await page.getByRole("option", { name: "Not blank", exact: true }).click();
  expect(persisted).toHaveLength(4);
  expect(page.getByRole("gridcell").all()).toHaveLength(2);
  await view.unmount();
  await render(
    <AstryxTableClient
      tableId="boolean-filter"
      columns={booleanColumns}
      getRowId={(row: BooleanRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_ENABLED", direction: "asc" }]}
      initialPersistedState={JSON.parse(JSON.stringify(snapshot))}
      clientSource={{
        rows: booleanRows,
        totalRows: booleanRows.length,
        version: 2,
        status: "ready",
      }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  expect(persisted).toHaveLength(4);
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  await page.getByRole("button", { name: "Filter Enabled (active)", exact: true }).click();
  await expect.element(input).toHaveTextContent("False");
  await input.click();
  await userEvent.keyboard("{Escape}");
  await expect.element(input).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("button", { name: "Filter Enabled (active)", exact: true }))
    .toHaveFocus();
});

test("Select filters publish exact configured numbers and restore zero", async () => {
  type ChoiceRow = { id: string; choice: 0 | 1 | 2 };
  const choiceColumns = [
    AstryxTableSelectColumn({
      enableSetFilter: false,
      columnId: "COL_ID_CHOICE",
      headerName: "Choice",
      field: "choice",
      options: [0, 1, 2],
    }),
  ] as const satisfies AstryxTableColumns<ChoiceRow>;
  const choiceRows: ChoiceRow[] = [
    { id: "zero", choice: 0 },
    { id: "one", choice: 1 },
    { id: "two", choice: 2 },
  ];
  const persisted: AstryxTablePersistedState<ChoiceRow, typeof choiceColumns, true>[] = [];
  const view = await render(
    <AstryxTableClient
      tableId="select-filter"
      columns={choiceColumns}
      getRowId={(row: ChoiceRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_CHOICE", direction: "asc" }]}
      clientSource={{ rows: choiceRows, totalRows: choiceRows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Choice column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Filter column", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Filter value", exact: true });
  await expect.element(input).toHaveFocus();
  expect(persisted).toHaveLength(0);
  await input.click();
  await page.getByRole("option", { name: "0", exact: true }).click();
  expect(persisted).toHaveLength(1);
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  await expect.element(page.getByRole("gridcell", { name: "0", exact: true })).toBeVisible();
  const snapshot = persisted[0]!;
  expect(snapshot.filters).toEqual([
    {
      columnId: "COL_ID_CHOICE",
      type: "equals",
      filter: { $astryxTableValue: "select", version: 1, value: { type: "number", value: "0" } },
      codecId: "@bruno/table/select",
      codecVersion: 1,
    },
  ]);
  await page.getByRole("combobox", { name: "Operator", exact: true }).click();
  await page.getByRole("option", { name: "Not equal", exact: true }).click();
  expect(persisted).toHaveLength(2);
  expect(page.getByRole("gridcell").all()).toHaveLength(2);
  expect(page.getByRole("gridcell", { name: "0", exact: true }).all()).toHaveLength(0);
  await view.unmount();
  await render(
    <AstryxTableClient
      tableId="select-filter"
      columns={choiceColumns}
      getRowId={(row: ChoiceRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_CHOICE", direction: "asc" }]}
      initialPersistedState={JSON.parse(JSON.stringify(snapshot))}
      clientSource={{ rows: choiceRows, totalRows: choiceRows.length, version: 2, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  expect(persisted).toHaveLength(2);
  await page.getByRole("button", { name: "Filter Choice (active)", exact: true }).click();
  await expect.element(input).toHaveTextContent("0");
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
});

test("Select option windows stay bounded and retain an off-window selected value", async () => {
  type ChoiceRow = { id: string; choice: string };
  const choices = [
    "Item 0",
    ...Array.from({ length: 69 }, (_, index) => `Item ${String(index + 1)}`),
  ] as const;
  const choiceColumns = [
    AstryxTableSelectColumn({
      enableSetFilter: false,
      columnId: "COL_ID_CHOICE",
      headerName: "Choice",
      field: "choice",
      options: choices,
    }),
  ] as const satisfies AstryxTableColumns<ChoiceRow>;
  const choiceRows = choices.map((choice) => ({ id: choice, choice }));
  const persisted: AstryxTablePersistedState<ChoiceRow, typeof choiceColumns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="select-filter-window"
      columns={choiceColumns}
      getRowId={(row: ChoiceRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_CHOICE", direction: "asc" }]}
      initialFilters={[{ columnId: "COL_ID_CHOICE", type: "equals", filter: "Item 69" }]}
      clientSource={{ rows: choiceRows, totalRows: choiceRows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Choice (active)", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Filter value", exact: true });
  await expect.element(input).toHaveFocus();
  await expect.element(input).toHaveTextContent("Item 69");
  await input.click();
  expect(page.getByRole("option").all()).toHaveLength(65);
  await expect
    .element(page.getByRole("option", { name: "Item 69", exact: true }))
    .toHaveAttribute("aria-selected", "true");
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Next filter options", exact: true }).click();
  expect(persisted).toHaveLength(0);
  await input.click();
  expect(page.getByRole("option").all()).toHaveLength(64);
  await page.getByRole("option", { name: "Item 68", exact: true }).click();
  expect(persisted).toHaveLength(1);
  await expect.element(page.getByRole("gridcell", { name: "Item 68", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous filter options", exact: true }).click();
  expect(persisted).toHaveLength(1);
  await input.click();
  expect(page.getByRole("option").all()).toHaveLength(65);
  await expect
    .element(page.getByRole("option", { name: "Item 68", exact: true }))
    .toHaveAttribute("aria-selected", "true");
  await page.getByRole("option", { name: "Item 0", exact: true }).click();
  expect(persisted).toHaveLength(2);
  await expect.element(page.getByRole("gridcell", { name: "Item 0", exact: true })).toBeVisible();
});

test("an empty-string Select option survives persisted restoration in a fresh instance", async () => {
  type ChoiceRow = { id: string; choice: "" | "Filled" };
  const choiceColumns = [
    AstryxTableSelectColumn({
      enableSetFilter: false,
      columnId: "COL_ID_CHOICE",
      headerName: "Choice",
      field: "choice",
      options: ["", "Filled"],
    }),
  ] as const satisfies AstryxTableColumns<ChoiceRow>;
  const choiceRows: ChoiceRow[] = [
    { id: "empty", choice: "" },
    { id: "filled", choice: "Filled" },
  ];
  const persisted: AstryxTablePersistedState<ChoiceRow, typeof choiceColumns, true>[] = [];
  const view = await render(
    <AstryxTableClient
      tableId="select-empty"
      columns={choiceColumns}
      getRowId={(row: ChoiceRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_CHOICE", direction: "asc" }]}
      clientSource={{ rows: choiceRows, totalRows: 2, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Choice", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Filter value", exact: true });
  await input.click();
  await page.getByRole("option", { name: "Empty value", exact: true }).click();
  expect(persisted).toHaveLength(1);
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  expect(page.getByRole("gridcell", { name: "Filled", exact: true }).all()).toHaveLength(0);
  expect(persisted[0]?.filters).toEqual([
    {
      columnId: "COL_ID_CHOICE",
      type: "equals",
      filter: { $astryxTableValue: "select", version: 1, value: { type: "string", value: "" } },
      codecId: "@bruno/table/select",
      codecVersion: 1,
    },
  ]);
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Filter Choice (active)", exact: true }).click();
  await expect.element(input).toHaveTextContent("Empty value");
  expect(persisted).toHaveLength(1);
  const snapshot: (typeof persisted)[number] = JSON.parse(JSON.stringify(persisted[0]));
  await view.unmount();
  await render(
    <AstryxTableClient
      tableId="select-empty"
      columns={choiceColumns}
      getRowId={(row: ChoiceRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_CHOICE", direction: "asc" }]}
      initialPersistedState={snapshot}
      clientSource={{ rows: choiceRows, totalRows: 2, version: 2, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Choice (active)", exact: true }).click();
  await expect
    .element(page.getByRole("combobox", { name: "Filter value", exact: true }))
    .toHaveTextContent("Empty value");
  await expect.poll(async () => (await page.getByRole("gridcell").all()).length).toBe(1);
  await expect
    .element(page.getByRole("gridcell", { name: "Filled", exact: true }))
    .not.toBeInTheDocument();
  expect(persisted).toHaveLength(1);
});

test("Set filters preserve Match None for future values and restore without echo", async () => {
  const facetColumns = [
    { ...columns[0], enableSetFilter: true },
  ] as const satisfies AstryxTableColumns<Row>;
  const persisted: AstryxTablePersistedState<Row, typeof facetColumns, true>[] = [];
  const view = await render(
    <AstryxTableClient
      tableId="set-none"
      columns={facetColumns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name", exact: true }).click();
  await expect
    .element(page.getByRole("searchbox", { name: "Search values for Name", exact: true }))
    .toHaveFocus();
  await expect
    .element(page.getByRole("checkbox", { name: "Select Ada, 1", exact: true }))
    .toBeChecked();
  await page.getByRole("button", { name: "Clear All", exact: true }).click();
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(0);
  expect(persisted).toHaveLength(1);
  expect(persisted[0]?.filters?.[0]).toMatchObject({ columnId: "COL_ID_NAME", type: "matchNone" });
  const saved = JSON.parse(JSON.stringify(persisted[0])) as (typeof persisted)[number];
  await view.unmount();
  const futureRows = [...rows, { id: "future", name: "Future" }];
  await render(
    <AstryxTableClient
      tableId="set-none"
      columns={facetColumns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      initialPersistedState={saved}
      clientSource={{ rows: futureRows, totalRows: futureRows.length, version: 2, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  expect(page.getByRole("gridcell").all()).toHaveLength(0);
  expect(persisted).toHaveLength(1);
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "Select Future, 1", exact: true }))
    .not.toBeChecked();
  await page.getByRole("checkbox", { name: "Select Ada, 1", exact: true }).click();
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  expect(persisted).toHaveLength(2);
  await page.getByRole("button", { name: "Select All", exact: true }).click();
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(4);
  expect(persisted).toHaveLength(3);
  expect(persisted[2]?.filters).toEqual([]);
});

test("Set filters retain exclusion intent and live zero-count values beyond the viewport", async () => {
  const facetColumns = [
    { ...columns[0], enableSetFilter: true },
  ] as const satisfies AstryxTableColumns<Row>;
  let publish: ((next: readonly Row[]) => void) | undefined;
  const persisted: AstryxTablePersistedState<Row, typeof facetColumns, true>[] = [];
  const initialRows = Array.from({ length: 90 }, (_, index) => ({
    id: String(index),
    name: `Value ${String(index).padStart(2, "0")}`,
  }));
  function Harness() {
    const [source, setSource] = useState({ rows: initialRows as readonly Row[], version: 1 });
    useEffect(() => {
      publish = (next) => setSource((current) => ({ rows: next, version: current.version + 1 }));
      return () => {
        publish = undefined;
      };
    }, []);
    return (
      <AstryxTableClient
        tableId="set-live"
        columns={facetColumns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        clientSource={{ ...source, totalRows: source.rows.length, status: "ready" }}
        onPersistChange={(state) => persisted.push(state)}
      />
    );
  }
  await render(<Harness />);
  await page.getByRole("button", { name: "Filter Name", exact: true }).click();
  const values = page.getByRole("group", { name: "Filter values", exact: true });
  expect(values.getByRole("checkbox").all()).toHaveLength(64);
  const search = page.getByRole("searchbox", { name: "Search values for Name", exact: true });
  await page.getByRole("button", { name: "Next values", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "Select Value 89, 1", exact: true }))
    .toBeChecked();
  expect(values.getByRole("checkbox").all()).toHaveLength(64);
  await search.fill("89");
  await page.getByRole("checkbox", { name: "Select Value 89, 1", exact: true }).click();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]?.filters?.[0]).toMatchObject({
    type: "NOT",
    condition: { columnId: "COL_ID_NAME", type: "in" },
  });
  publish?.([...initialRows.slice(0, 89), { id: "future", name: "Future" }]);
  await expect
    .element(page.getByRole("checkbox", { name: "Select Value 89, 0", exact: true }))
    .not.toBeChecked();
  expect(persisted).toHaveLength(1);
  await search.fill("Future");
  await expect
    .element(page.getByRole("checkbox", { name: "Select Future, 1", exact: true }))
    .toBeChecked();
  await expect.element(page.getByRole("gridcell", { name: "Future", exact: true })).toBeVisible();
  publish?.([...initialRows, { id: "future", name: "Future" }]);
  await search.fill("89");
  await expect
    .element(page.getByRole("checkbox", { name: "Select Value 89, 1", exact: true }))
    .not.toBeChecked();
  expect(persisted).toHaveLength(1);
  await page.getByRole("checkbox", { name: "Select Value 89, 1", exact: true }).click();
  expect(persisted).toHaveLength(2);
  expect(persisted[1]?.filters).toEqual([]);
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("button", { name: "Filter Name", exact: true }))
    .toHaveFocus();
  publish?.([{ id: "new", name: "Reopened" }]);
  await page.getByRole("button", { name: "Filter Name", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "Select Reopened, 1", exact: true }))
    .toBeChecked();
  expect(values.getByRole("checkbox").all()).toHaveLength(1);
});

test("default Boolean Set filters exclude their own expression and respect other columns", async () => {
  type FacetRow = { id: string; enabled: boolean; team: string };
  const facetColumns = [
    { columnId: "COL_ID_ENABLED", headerName: "Enabled", field: "enabled", valueType: "boolean" },
    { columnId: "COL_ID_TEAM", headerName: "Team", field: "team", valueType: "text" },
  ] as const satisfies AstryxTableColumns<FacetRow>;
  const facetRows = [
    { id: "a", enabled: true, team: "A" },
    { id: "b", enabled: false, team: "A" },
    { id: "c", enabled: true, team: "B" },
  ];
  const persisted: AstryxTablePersistedState<FacetRow, typeof facetColumns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="set-other"
      columns={facetColumns}
      getRowId={(row: FacetRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_ENABLED", direction: "asc" }]}
      initialFilters={[
        { columnId: "COL_ID_TEAM", type: "equals", filter: "A" },
        { columnId: "COL_ID_ENABLED", type: "equals", filter: true },
      ]}
      clientSource={{ rows: facetRows, totalRows: 3, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Enabled (active)", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "Select true, 1", exact: true }))
    .toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select false, 1", exact: true }))
    .toBeChecked();
  await page.getByRole("button", { name: "Clear All", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select false, 1", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select true, 1", exact: true }).click();
  expect(persisted).toHaveLength(3);
  expect(persisted[2]?.filters).toHaveLength(1);
  expect(persisted[2]?.filters?.[0]).toMatchObject({ columnId: "COL_ID_TEAM", type: "equals" });
  expect(page.getByRole("gridcell").all()).toHaveLength(4);
});

test("default Select Set filters keep exact empty and case-distinct values", async () => {
  type OptionRow = { id: string; choice: "a" | "" | "A" | "Empty value" };
  const facetColumns = [
    AstryxTableSelectColumn({
      columnId: "COL_ID_CHOICE",
      headerName: "Choice",
      field: "choice",
      options: ["a", "", "A", "Empty value"],
    }),
  ] as const satisfies AstryxTableColumns<OptionRow>;
  const facetRows: OptionRow[] = [
    { id: "lower", choice: "a" },
    { id: "empty", choice: "" },
    { id: "upper", choice: "A" },
    { id: "label", choice: "Empty value" },
  ];
  const persisted: AstryxTablePersistedState<OptionRow, typeof facetColumns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="set-options"
      columns={facetColumns}
      getRowId={(row: OptionRow) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_CHOICE", direction: "asc" }]}
      clientSource={{ rows: facetRows, totalRows: 4, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Choice", exact: true }).click();
  await page.getByRole("button", { name: "Clear All", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select a, 1, option 1 of 4", exact: true }).click();
  expect(persisted[1]?.filters?.[0]).toMatchObject({
    type: "in",
    filter: [{ $astryxTableValue: "select", version: 1, value: { type: "string", value: "a" } }],
  });
  await page
    .getByRole("checkbox", { name: "Select Empty value, 1, option 2 of 4", exact: true })
    .click();
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(2);
  expect(persisted).toHaveLength(3);
});

test("Set commands cancel pending scalar drafts and return keyboard focus to conditions", async () => {
  const facetColumns = [
    { ...columns[0], enableSetFilter: true },
  ] as const satisfies AstryxTableColumns<Row>;
  const persisted: AstryxTablePersistedState<Row, typeof facetColumns, true>[] = [];
  await render(
    <AstryxTableClient
      tableId="set-draft"
      columns={facetColumns}
      getRowId={(row: Row) => row.id}
      initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name", exact: true }).click();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await page.getByRole("textbox", { name: "Filter value", exact: true }).fill("Grace");
    await page.getByRole("button", { name: "Clear All", exact: true }).click();
    await vi.advanceTimersByTimeAsync(220);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.filters?.[0]).toMatchObject({ type: "matchNone" });
  } finally {
    vi.useRealTimers();
  }
  await page.getByRole("button", { name: "Use conditions", exact: true }).click();
  await expect
    .element(page.getByRole("textbox", { name: "Filter value", exact: true }))
    .toHaveFocus();
  expect(persisted).toHaveLength(2);
  expect(persisted[1]?.filters).toEqual([]);
});
