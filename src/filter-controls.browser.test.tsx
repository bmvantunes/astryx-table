import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableFilterControl,
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableQuickFilter,
  type AstryxTableGridFilterCommandCapability,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; score: number };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  { columnId: "COL_ID_SCORE", headerName: "Score", field: "score", valueType: "number" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "filter-controls",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [
      { id: "ada", name: "Ada", score: 10 },
      { id: "alan", name: "Alan", score: 20 },
      { id: "grace", name: "Grace", score: 30 },
    ],
    totalRows: 3,
    version: 1,
    status: "ready" as const,
  },
};

test("typed grid commands replace, clear, reset and clear all persisted Grid Filters", async () => {
  const results: boolean[] = [];
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" }]}
      onPersistChange={(state) => persisted.push(state)}
    >
      <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
        {(commands) => (
          <>
            <button
              onClick={() =>
                results.push(
                  commands.replace({ columnId: "COL_ID_NAME", type: "equals", filter: "Grace" }),
                )
              }
            >
              Show Grace
            </button>
            <button onClick={() => results.push(commands.clear("COL_ID_NAME"))}>Clear name</button>
            <button onClick={() => results.push(commands.reset("COL_ID_NAME"))}>Reset name</button>
            <button onClick={() => results.push(commands.clearAll())}>Clear Grid Filters</button>
          </>
        )}
      </AstryxTableFilterControl>
    </AstryxTableClient>,
  );
  await page.getByRole("button", { name: "Show Grace", exact: true }).click();
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "Ada", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Clear name", exact: true }).click();
  await expect.element(page.getByRole("gridcell", { name: "Alan", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset name", exact: true }).click();
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "Grace", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Clear Grid Filters", exact: true }).click();
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(results).toEqual([true, true, true, true]);
  expect(persisted).toHaveLength(4);
});

test("active counts include Quick Filter and track sort cardinality independently", async () => {
  await render(
    <AstryxTableClient
      {...props}
      quickFilterFields={["name"]}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "startsWith", filter: "A" }]}
    >
      <AstryxTableActiveFilterCount />
      <AstryxTableActiveSortCount />
      <AstryxTableQuickFilter />
      <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
        {(commands) => <button onClick={() => commands.clearAll()}>Clear Grid Filters</button>}
      </AstryxTableFilterControl>
    </AstryxTableClient>,
  );
  const filters = page.getByRole("status", { name: "Active filters", exact: true });
  const sorts = page.getByRole("status", { name: "Active sorts", exact: true });
  await expect.element(filters).toHaveTextContent("1 active filter");
  await expect.element(sorts).toHaveTextContent("1 active sort");
  const quick = page.getByRole("searchbox", { name: "Quick Filter", exact: true });
  await quick.fill("Ada");
  await expect.element(filters).toHaveTextContent("2 active filters");
  await page.getByRole("button", { name: "Clear Grid Filters", exact: true }).click();
  await expect.element(filters).toHaveTextContent("1 active filter");
  await expect.element(quick).toHaveValue("Ada");
  await quick.fill("");
  await expect.element(filters).toHaveTextContent("0 active filters");
  await page.getByRole("button", { name: "Sort rows, 1 active", exact: true }).click();
  await page.getByRole("button", { name: "Add sort column", exact: true }).click();
  await page.getByRole("option", { name: "Score", exact: true }).click();
  await expect.element(sorts).toHaveTextContent("2 active sorts");
  await page.getByRole("button", { name: "Remove Score sort", exact: true }).click();
  await expect.element(sorts).toHaveTextContent("1 active sort");
});

test.for(["removed", "disabled"] as const)(
  "saved commands reject a %s filter column without changing preferences",
  async (change) => {
    let saved: AstryxTableGridFilterCommandCapability<Row, typeof columns> | undefined;
    const results: boolean[] = [];
    const persisted: unknown[] = [];
    const controls = (
      <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
        {(commands) => {
          saved ??= commands;
          return (
            <button
              onClick={() =>
                results.push(
                  saved!.replace({ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" }),
                  saved!.clear("COL_ID_NAME"),
                  saved!.reset("COL_ID_NAME"),
                )
              }
            >
              Use saved commands
            </button>
          );
        }}
      </AstryxTableFilterControl>
    );
    const view = await render(
      <AstryxTableClient {...props} onPersistChange={(state) => persisted.push(state)}>
        {controls}
      </AstryxTableClient>,
    );
    const nextColumns =
      change === "removed"
        ? ([columns[1]] as const)
        : ([{ ...columns[0], enableFilter: false }, columns[1]] as const);
    await view.rerender(
      <AstryxTableClient
        {...props}
        columns={nextColumns}
        initialOrderBy={[{ columnId: "COL_ID_SCORE", direction: "asc" }]}
        onPersistChange={(state) => persisted.push(state)}
      >
        {controls}
      </AstryxTableClient>,
    );
    const before = persisted.length;
    await page.getByRole("button", { name: "Use saved commands", exact: true }).click();
    expect(results).toEqual([false, false, false]);
    expect(persisted).toHaveLength(before);
  },
);

test("invalid and over-budget replacements preserve the committed filter", async () => {
  const outcomes: boolean[] = [];
  const persisted: unknown[] = [];
  const candidates: unknown[] = [
    { columnId: "COL_ID_UNKNOWN", type: "equals", filter: "Grace" },
    {
      type: "AND",
      conditions: [
        { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
        { columnId: "COL_ID_SCORE", type: "equals", filter: 10 },
      ],
    },
    { columnId: "COL_ID_SCORE", type: "equals", filter: "not a number" },
    {
      columnId: "COL_ID_NAME",
      type: "in",
      filter: Array.from({ length: 16385 }, (_, index) => `value ${index}`),
    },
    { columnId: "COL_ID_NAME", type: "unsupported", filter: "Grace" },
  ];
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" }]}
      onPersistChange={(state) => persisted.push(state)}
    >
      <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
        {(commands) => (
          <button
            onClick={() => {
              for (const candidate of candidates)
                outcomes.push(
                  commands.replace(candidate as Parameters<typeof commands.replace>[0]),
                );
            }}
          >
            Try invalid filters
          </button>
        )}
      </AstryxTableFilterControl>
    </AstryxTableClient>,
  );
  await page.getByRole("button", { name: "Try invalid filters", exact: true }).click();
  expect(outcomes).toEqual([false, false, false, false, false]);
  expect(persisted).toHaveLength(0);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "Grace", exact: true }))
    .not.toBeInTheDocument();
});

test("external controls render without a table or grid capability", async () => {
  const view = await render(
    <AstryxTableFilterControl ownership="external">
      <button>Application filter</button>
    </AstryxTableFilterControl>,
  );
  await expect
    .element(page.getByRole("button", { name: "Application filter", exact: true }))
    .toBeVisible();
  await view.rerender(
    <AstryxTableFilterControl ownership="external">
      <span role="status">Application state</span>
    </AstryxTableFilterControl>,
  );
  await expect.element(page.getByRole("status")).toHaveTextContent("Application state");
});

test("command capabilities stay scoped to their owning table", async () => {
  const control = (label: string) => (
    <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
      {(commands) => (
        <button
          onClick={() =>
            commands.replace({ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" })
          }
        >
          {label}
        </button>
      )}
    </AstryxTableFilterControl>
  );
  await render(
    <>
      <AstryxTableClient {...props} tableId="first">
        {control("Filter first")}
        <AstryxTableActiveFilterCount>{(count) => `First: ${count}`}</AstryxTableActiveFilterCount>
      </AstryxTableClient>
      <AstryxTableClient {...props} tableId="second">
        {control("Filter second")}
        <AstryxTableActiveFilterCount>{(count) => `Second: ${count}`}</AstryxTableActiveFilterCount>
      </AstryxTableClient>
    </>,
  );
  await page.getByRole("button", { name: "Filter first", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Active filters", exact: true }).nth(0))
    .toHaveTextContent("First: 1");
  await expect
    .element(page.getByRole("status", { name: "Active filters", exact: true }).nth(1))
    .toHaveTextContent("Second: 0");
});

test("one command admits a complete single-column compound expression", async () => {
  const outcomes: boolean[] = [];
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient {...props} onPersistChange={(state) => persisted.push(state)}>
      <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
        {(commands) => (
          <button
            onClick={() =>
              outcomes.push(
                commands.replace({
                  type: "AND",
                  conditions: [
                    { columnId: "COL_ID_NAME", type: "startsWith", filter: "A" },
                    { columnId: "COL_ID_NAME", type: "endsWith", filter: "a" },
                  ],
                }),
              )
            }
          >
            Compound name filter
          </button>
        )}
      </AstryxTableFilterControl>
    </AstryxTableClient>,
  );
  await page.getByRole("button", { name: "Compound name filter", exact: true }).click();
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "Alan", exact: true }))
    .not.toBeInTheDocument();
  expect(outcomes).toEqual([true]);
  expect(persisted).toHaveLength(1);
});
