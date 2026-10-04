import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; age: number; note: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text", width: 180 },
  { columnId: "COL_ID_AGE", headerName: "Age", field: "age", valueType: "number", width: 120 },
  {
    columnId: "COL_ID_NOTE",
    headerName: "Note",
    field: "note",
    valueType: "text",
    enableSorting: false,
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "sort-controls",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [
      { id: "b", name: "B", age: 2, note: "Second" },
      { id: "a", name: "A", age: 3, note: "Third" },
      { id: "c", name: "C", age: 1, note: "First" },
    ],
    totalRows: 3,
    version: 1,
    status: "ready" as const,
  },
};
function names() {
  return page
    .getByRole("gridcell")
    .elements()
    .filter((cell) => cell.getAttribute("aria-colindex") === "1")
    .map((cell) => cell.textContent);
}

test("the side sort panel displays priority and toggles direction without an unsorted state", async () => {
  const persisted: unknown[] = [];
  await render(<AstryxTableClient {...props} onPersistChange={(state) => persisted.push(state)} />);
  await expect.poll(names).toEqual(["A", "B", "C"]);
  const trigger = page.getByRole("button", { name: "Sort rows, 1 active", exact: true });
  await trigger.click();
  await expect
    .element(page.getByRole("listitem", { name: "Priority 1, Name, ascending", exact: true }))
    .toBeVisible();
  await page
    .getByRole("button", { name: "Toggle Name direction, currently ascending", exact: true })
    .click();
  await expect.poll(names).toEqual(["C", "B", "A"]);
  await expect
    .element(page.getByRole("listitem", { name: "Priority 1, Name, descending", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("columnheader", { name: "Name", exact: true }))
    .toHaveAttribute("aria-sort", "descending");
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({ orderBy: [{ columnId: "COL_ID_NAME", direction: "desc" }] });
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
});

test("users add an ascending numeric sort, change its priority and remove it without losing the final sort", async () => {
  const persisted: unknown[] = [];
  await render(<AstryxTableClient {...props} onPersistChange={(state) => persisted.push(state)} />);
  await page.getByRole("button", { name: "Sort rows, 1 active", exact: true }).click();
  await page.getByRole("button", { name: "Add sort column", exact: true }).click();
  await expect
    .element(page.getByRole("option", { name: "Note", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("option", { name: "Name", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("option", { name: "Age", exact: true }).click();
  await expect
    .element(page.getByRole("listitem", { name: "Priority 2, Age, ascending", exact: true }))
    .toBeVisible();
  const move = page.getByRole("button", { name: "Move Age earlier", exact: true });
  move.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(move).toHaveFocus();
  await expect
    .element(page.getByRole("listitem", { name: "Priority 1, Age, ascending", exact: true }))
    .toBeVisible();
  await expect.poll(names).toEqual(["C", "B", "A"]);
  expect(persisted[1]).toMatchObject({
    orderBy: [
      { columnId: "COL_ID_AGE", direction: "asc" },
      { columnId: "COL_ID_NAME", direction: "asc" },
    ],
  });
  await page.getByRole("button", { name: "Remove Age sort", exact: true }).click();
  await expect
    .element(
      page.getByRole("button", { name: "Toggle Name direction, currently ascending", exact: true }),
    )
    .toHaveFocus();
  await expect.poll(names).toEqual(["A", "B", "C"]);
  const remove = page.getByRole("button", { name: "Remove Name sort", exact: true });
  await expect.element(remove).toHaveAttribute("aria-disabled", "true");
  remove.element().focus();
  await userEvent.keyboard("{Enter}");
  expect(persisted).toHaveLength(3);
  expect(persisted[2]).toMatchObject({ orderBy: props.initialOrderBy });
});

test("reset restores the original non-empty baseline without resetting hidden columns or widths", async () => {
  const persisted: unknown[] = [];
  const view = await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={{
        version: 1,
        tableId: props.tableId,
        filters: [],
        groupBy: [],
        groupOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
        orderBy: [
          { columnId: "COL_ID_AGE", direction: "asc" },
          { columnId: "COL_ID_NAME", direction: "desc" },
        ],
        columnOrder: ["COL_ID_NAME", "COL_ID_AGE", "COL_ID_NOTE"],
        columnWidths: { COL_ID_NAME: 240 },
        columnVisibility: { COL_ID_AGE: false },
        columnPinning: { start: [], end: [] },
      }}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Sort rows, 2 active", exact: true }).click();
  await expect
    .element(page.getByRole("listitem", { name: "Priority 1, Age, ascending", exact: true }))
    .toBeVisible();
  expect(persisted).toHaveLength(0);
  await view.rerender(
    <AstryxTableClient
      {...props}
      initialOrderBy={[{ columnId: "COL_ID_AGE", direction: "desc" }]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  const reset = page.getByRole("button", { name: "Reset sorting", exact: true });
  await reset.click();
  await expect.element(reset).toHaveFocus();
  await expect
    .element(page.getByRole("status", { name: "Sorting status", exact: true }))
    .toHaveTextContent("Sorting reset");
  await expect
    .element(page.getByRole("listitem", { name: "Priority 1, Name, ascending", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("columnheader", { name: "Age", exact: true }))
    .not.toBeInTheDocument();
  await expect.poll(names).toEqual(["A", "B", "C"]);
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({
    orderBy: props.initialOrderBy,
    columnWidths: { COL_ID_NAME: 240 },
    columnVisibility: { COL_ID_AGE: false },
  });
  await reset.click();
  expect(persisted).toHaveLength(1);
});

test("a bounded sort review reaches every priority and retains visible focus across a window boundary", async () => {
  const wideColumns = Array.from({ length: 150 }, (_, index) => ({
    ...columns[0],
    columnId: `COL_ID_C${index}` as `COL_ID_C${Uppercase<`${number}`>}`,
    headerName: `Column ${index}`,
  }));
  const order = [
    { columnId: wideColumns[0]!.columnId, direction: "asc" as const },
    ...wideColumns
      .slice(1)
      .map((column) => ({ columnId: column.columnId, direction: "asc" as const })),
  ] as const;
  await render(<AstryxTableClient {...props} columns={wideColumns} initialOrderBy={order} />);
  await page.getByRole("button", { name: "Sort rows, 150 active", exact: true }).click();
  const list = page.getByRole("list", { name: "Active sorts", exact: true });
  expect(await list.getByRole("listitem").all()).toHaveLength(64);
  const move = page.getByRole("button", { name: "Move Column 63 later", exact: true });
  await move.click();
  await expect.element(move).toHaveFocus();
  await expect
    .element(page.getByRole("listitem", { name: "Priority 65, Column 63, ascending", exact: true }))
    .toBeVisible();
  const rect = move.element().getBoundingClientRect();
  const panel = page
    .getByRole("dialog", { name: "Sort rows", exact: true })
    .element()
    .getBoundingClientRect();
  expect(rect.top).toBeGreaterThanOrEqual(panel.top);
  expect(rect.bottom).toBeLessThanOrEqual(panel.bottom);
  await expect
    .element(page.getByRole("status", { name: "Sorting status", exact: true }))
    .toHaveTextContent("Column 63 moved to priority 65");
  await page.getByRole("button", { name: "Next sorts", exact: true }).click();
  expect(await list.getByRole("listitem").all()).toHaveLength(22);
  await expect
    .element(
      page.getByRole("listitem", { name: "Priority 150, Column 149, ascending", exact: true }),
    )
    .toBeInTheDocument();
  await page.getByRole("button", { name: "Reset sorting", exact: true }).click();
  expect(await list.getByRole("listitem").all()).toHaveLength(64);
  await expect
    .element(page.getByRole("listitem", { name: "Priority 1, Column 0, ascending", exact: true }))
    .toBeInTheDocument();
});

test("native search adds a far hidden column without truncating eligible options", async () => {
  const wideColumns = Array.from({ length: 150 }, (_, index) => ({
    ...columns[0],
    columnId: `COL_ID_C${index}` as `COL_ID_C${Uppercase<`${number}`>}`,
    headerName: `Column ${index}`,
  }));
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      columns={wideColumns}
      initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  await page.getByRole("button", { name: "Visible columns", exact: true }).click();
  await page.getByRole("combobox", { name: "Search options", exact: true }).fill("Column 149");
  await page.getByRole("option", { name: "Column 149", exact: true }).click();
  await userEvent.keyboard("{Escape}{Escape}");
  await page.getByRole("button", { name: "Sort rows, 1 active", exact: true }).click();
  const add = page.getByRole("button", { name: "Add sort column", exact: true });
  await add.click();
  const search = page.getByRole("combobox", { name: "Search options", exact: true });
  await expect.element(search).toHaveFocus();
  await search.fill("Column 149");
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await expect.element(add).toHaveFocus();
  await expect
    .element(page.getByRole("listitem", { name: "Priority 2, Column 149, ascending", exact: true }))
    .toBeVisible();
  expect(persisted).toHaveLength(2);
  expect(persisted[1]).toMatchObject({
    orderBy: [
      { columnId: "COL_ID_C0", direction: "asc" },
      { columnId: "COL_ID_C149", direction: "asc" },
    ],
    columnVisibility: { COL_ID_C149: false },
  });
});

test("replacement labels and duplicate names never change which sort a command owns", async () => {
  const persisted: unknown[] = [];
  const order = [
    { columnId: "COL_ID_NAME", direction: "asc" },
    { columnId: "COL_ID_AGE", direction: "asc" },
  ] as const;
  const onPersistChange = (state: unknown) => persisted.push(state);
  const view = await render(
    <AstryxTableClient {...props} initialOrderBy={order} onPersistChange={onPersistChange} />,
  );
  await page.getByRole("button", { name: "Sort rows, 2 active", exact: true }).click();
  await view.rerender(
    <AstryxTableClient
      {...props}
      initialOrderBy={order}
      columns={[columns[0], { ...columns[1], headerName: "Name" }, columns[2]]}
      onPersistChange={onPersistChange}
    />,
  );
  const second = page.getByRole("listitem", { name: "Priority 2, Name, ascending", exact: true });
  await second
    .getByRole("button", { name: "Toggle Name direction, currently ascending", exact: true })
    .click();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({
    orderBy: [
      { columnId: "COL_ID_NAME", direction: "asc" },
      { columnId: "COL_ID_AGE", direction: "desc" },
    ],
  });
  await expect
    .element(page.getByRole("listitem", { name: "Priority 1, Name, ascending", exact: true }))
    .toBeVisible();
});

test("clicking an outside control closes the sort panel without stealing focus", async () => {
  await render(
    <>
      <AstryxTableClient {...props} />
      <div style={{ marginTop: 400 }}>
        <button>Outside action</button>
      </div>
    </>,
  );
  const trigger = page.getByRole("button", { name: "Sort rows, 1 active", exact: true });
  await trigger.click();
  const outside = page.getByRole("button", { name: "Outside action", exact: true });
  await outside.click();
  await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  await expect.element(outside).toHaveFocus();
});

test.each([
  "Toggle Age direction, currently ascending",
  "Move Age earlier",
  "Move Age later",
  "Remove Age sort",
])("removing a focused sort through replacement definitions recovers focus: %s", async (label) => {
  const view = await render(
    <AstryxTableClient
      {...props}
      initialOrderBy={[
        { columnId: "COL_ID_NAME", direction: "asc" },
        { columnId: "COL_ID_AGE", direction: "asc" },
      ]}
    />,
  );
  await page.getByRole("button", { name: "Sort rows, 2 active", exact: true }).click();
  page.getByRole("button", { name: label, exact: true }).element().focus();
  await view.rerender(<AstryxTableClient {...props} columns={[columns[0], columns[2]]} />);
  await expect
    .element(page.getByRole("button", { name: "Sort rows, 1 active", exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole("button", { name: "Toggle Name direction, currently ascending", exact: true }),
    )
    .toHaveFocus();
});

test("an open add picker follows changes to sorting eligibility", async () => {
  const persisted: unknown[] = [];
  const onPersistChange = (state: unknown) => persisted.push(state);
  const view = await render(<AstryxTableClient {...props} onPersistChange={onPersistChange} />);
  await page.getByRole("button", { name: "Sort rows, 1 active", exact: true }).click();
  await page.getByRole("button", { name: "Add sort column", exact: true }).click();
  await expect
    .element(page.getByRole("option", { name: "Note", exact: true }))
    .not.toBeInTheDocument();
  await view.rerender(
    <AstryxTableClient
      {...props}
      columns={[columns[0], columns[1], { ...columns[2], enableSorting: true }]}
      onPersistChange={onPersistChange}
    />,
  );
  await page.getByRole("option", { name: "Note", exact: true }).click();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({
    orderBy: [
      { columnId: "COL_ID_NAME", direction: "asc" },
      { columnId: "COL_ID_NOTE", direction: "asc" },
    ],
  });
});

test("live sorting preserves positions only while current neighbours agree, and reprojects moves and query changes", async () => {
  let rows = [
    { id: "a", name: "A", age: 10, note: "" },
    { id: "b", name: "B", age: 20, note: "" },
    { id: "c", name: "C", age: 30, note: "" },
  ];
  let version = 1;
  const view = () => (
    <AstryxTableClient
      {...props}
      initialOrderBy={[{ columnId: "COL_ID_AGE", direction: "asc" }]}
      clientSource={{ rows, version, totalRows: rows.length, status: "ready" }}
    />
  );
  const screen = await render(view());
  await expect.poll(names).toEqual(["A", "B", "C"]);
  for (const age of [25, 26]) {
    rows = rows.with(1, { ...rows[1]!, age });
    version++;
    await screen.rerender(view());
    await expect
      .element(page.getByRole("gridcell", { name: String(age), exact: true }))
      .toBeVisible();
    expect(names()).toEqual(["A", "B", "C"]);
  }
  rows = rows.with(0, { ...rows[0]!, age: 27 });
  version++;
  await screen.rerender(view());
  await expect.poll(names).toEqual(["B", "A", "C"]);
  rows = rows.with(1, { ...rows[1]!, age: 31 }).with(2, { ...rows[2]!, age: 25 });
  version++;
  await screen.rerender(view());
  await expect.poll(names).toEqual(["C", "A", "B"]);
  await page.getByRole("button", { name: "Sort rows, 1 active", exact: true }).click();
  await page
    .getByRole("button", { name: "Toggle Age direction, currently ascending", exact: true })
    .click();
  await expect.poll(names).toEqual(["B", "A", "C"]);
  rows = rows.with(0, { ...rows[0]!, age: 40 });
  version++;
  await screen.rerender(view());
  await expect.poll(names).toEqual(["A", "B", "C"]);
  rows = rows.filter((row) => row.id !== "b");
  version++;
  await screen.rerender(view());
  await expect.poll(names).toEqual(["A", "C"]);
});

test("live filtered sort projections admit membership changes even when positions otherwise remain valid", async () => {
  let rows = props.clientSource.rows.map((row) => ({ ...row, name: `Keep ${row.name}` }));
  let version = 1;
  const view = () => (
    <AstryxTableClient
      {...props}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Keep" }]}
      initialOrderBy={[{ columnId: "COL_ID_AGE", direction: "asc" }]}
      clientSource={{ rows, version, totalRows: rows.length, status: "ready" }}
    />
  );
  const screen = await render(view());
  await expect.poll(names).toEqual(["Keep C", "Keep B", "Keep A"]);
  rows = rows.with(0, { ...rows[0]!, name: "Excluded B", age: 2.5 });
  version++;
  await screen.rerender(view());
  await expect.poll(names).toEqual(["Keep C", "Keep A"]);
  rows = rows.with(0, { ...rows[0]!, name: "Keep B", age: 4 });
  version++;
  await screen.rerender(view());
  await expect.poll(names).toEqual(["Keep C", "Keep A", "Keep B"]);
});

test("returning to an old source value still checks neighbours changed by earlier retained publications", async () => {
  let rows = [
    { id: "a", name: "A", age: 10, note: "" },
    { id: "b", name: "B", age: 20, note: "" },
    { id: "c", name: "C", age: 30, note: "" },
  ];
  const originalA = rows[0]!;
  let version = 1;
  const view = () => (
    <AstryxTableClient
      {...props}
      initialOrderBy={[{ columnId: "COL_ID_AGE", direction: "asc" }]}
      clientSource={{ rows, version, totalRows: rows.length, status: "ready" }}
    />
  );
  const screen = await render(view());
  await expect.poll(names).toEqual(["A", "B", "C"]);
  for (const [index, age] of [
    [1, 15],
    [0, 5],
    [1, 7],
  ] as const) {
    rows = rows.with(index, { ...rows[index]!, age });
    version++;
    await screen.rerender(view());
    await expect
      .element(page.getByRole("gridcell", { name: String(age), exact: true }))
      .toBeVisible();
    expect(names()).toEqual(["A", "B", "C"]);
  }
  rows = rows.with(0, originalA);
  version++;
  await screen.rerender(view());
  await expect.poll(names).toEqual(["B", "A", "C"]);
});

test.each([
  { label: "Previous sorts", remaining: 64 },
  { label: "Next sorts", remaining: 2 },
])(
  "recovers focus when $label disappears after a column replacement",
  async ({ label, remaining }) => {
    const wideColumns = Array.from({ length: 65 }, (_, index) => ({
      ...columns[0],
      columnId: `COL_ID_C${index}` as `COL_ID_C${Uppercase<`${number}`>}`,
      headerName: `Column ${index}`,
    }));
    const order = [
      { columnId: wideColumns[0]!.columnId, direction: "asc" as const },
      ...wideColumns
        .slice(1)
        .map((column) => ({ columnId: column.columnId, direction: "asc" as const })),
    ] as const;
    const view = await render(
      <AstryxTableClient {...props} columns={wideColumns} initialOrderBy={order} />,
    );
    await page.getByRole("button", { name: "Sort rows, 65 active", exact: true }).click();
    await page.getByRole("button", { name: "Next sorts", exact: true }).click();
    await expect
      .element(
        page.getByRole("listitem", { name: "Priority 65, Column 64, ascending", exact: true }),
      )
      .toBeVisible();
    page.getByRole("button", { name: label, exact: true }).element().focus();
    await view.rerender(
      <AstryxTableClient
        {...props}
        columns={wideColumns.slice(0, remaining)}
        initialOrderBy={order}
      />,
    );
    await expect
      .element(page.getByRole("button", { name: label, exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", {
          name: `Toggle Column ${remaining - 1} direction, currently ascending`,
          exact: true,
        }),
      )
      .toHaveFocus();
  },
);
