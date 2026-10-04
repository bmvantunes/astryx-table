import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
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
  expect(page.getByRole("textbox").all()).toHaveLength(0);
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
