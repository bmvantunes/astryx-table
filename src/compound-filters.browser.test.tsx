import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableFilterExpression,
  type AstryxTableColumns,
  type AstryxTablePersistedState,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "compound-filters",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [
      { id: "ada", name: "Ada" },
      { id: "alan", name: "Alan" },
      { id: "grace", name: "Grace" },
    ],
    totalRows: 3,
    version: 1,
    status: "ready" as const,
  },
};

test("editing one restored OR condition commits the complete column expression", async () => {
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  const view = await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        {
          type: "OR",
          conditions: [
            { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
            { columnId: "COL_ID_NAME", type: "equals", filter: "Grace" },
          ],
        },
      ]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  const first = page.getByRole("group", { name: "Filter condition 1 for Name", exact: true });
  await first.getByRole("textbox", { name: "Filter value", exact: true }).fill("Alan");
  await expect.element(page.getByRole("gridcell", { name: "Alan", exact: true })).toBeVisible();
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(2);
  expect(persisted).toHaveLength(1);
  await view.unmount();
  await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={persisted[0]!}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await expect.element(page.getByRole("gridcell", { name: "Alan", exact: true })).toBeVisible();
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  await expect
    .element(first.getByRole("textbox", { name: "Filter value", exact: true }))
    .toHaveValue("Alan");
  expect(persisted).toHaveLength(1);
});

test("new compound conditions remain one atomic draft and NOT wraps the complete expression", async () => {
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "A" }]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  const mode = page.getByRole("combobox", { name: "Filter expression for Name", exact: true });
  await mode.click();
  await page.getByRole("option", { name: "Any condition (OR)", exact: true }).click();
  const first = page
    .getByRole("group", { name: "Filter condition 1 for Name", exact: true })
    .getByRole("textbox", { name: "Filter value", exact: true });
  const second = page
    .getByRole("group", { name: "Filter condition 2 for Name", exact: true })
    .getByRole("textbox", { name: "Filter value", exact: true });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await first.fill("Grace");
    await vi.advanceTimersByTimeAsync(200);
    await expect.element(second).toHaveAttribute("aria-invalid", "true");
    await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    expect(persisted).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
  await second.fill("Alan");
  await expect
    .element(page.getByRole("gridcell", { name: "Ada", exact: true }))
    .not.toBeInTheDocument();
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(persisted).toHaveLength(1);
  await mode.click();
  await page.getByRole("option", { name: "Not (NOT)", exact: true }).click();
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  expect(persisted).toHaveLength(2);
});

test("aggregate admission rejection retains the complete authored draft until corrected", async () => {
  const value = (index: number) => String(index).padStart(4, "0") + "x".repeat(665);
  const leaf = (index: number) => ({
    columnId: "COL_ID_NAME" as const,
    type: "equals" as const,
    filter: value(index),
  });
  const rows = [
    { id: "first", name: value(0) },
    { id: "second", name: value(1) },
  ];
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      initialFilters={[
        {
          type: "OR",
          conditions: [leaf(0), ...Array.from({ length: 299 }, (_, index) => leaf(index + 1))],
        },
      ]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  const first = page
    .getByRole("group", { name: "Filter condition 1 for Name", exact: true })
    .getByRole("textbox", { name: "Filter value", exact: true });
  const rejected = "0000" + "x".repeat(1020);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await first.fill(rejected);
    await vi.advanceTimersByTimeAsync(200);
    await expect
      .element(page.getByRole("status", { name: "Filter draft status", exact: true }))
      .toHaveTextContent("could not be applied");
    await expect.element(first).toHaveValue(rejected);
    expect(page.getByRole("gridcell").all()).toHaveLength(2);
    expect(persisted).toHaveLength(0);
    await first.fill("Grace");
    await vi.advanceTimersByTimeAsync(200);
    await expect.element(first).toHaveValue("Grace");
    expect(page.getByRole("gridcell").all()).toHaveLength(1);
    expect(persisted).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

test("opening a large compound filter mounts at most 64 condition inputs", async () => {
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        {
          type: "OR",
          conditions: [
            { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
            ...Array.from({ length: 69 }, (_, index) => ({
              columnId: "COL_ID_NAME" as const,
              type: "equals" as const,
              filter: index === 0 ? "Alan" : `Item ${String(index + 1)}`,
            })),
          ],
        },
      ]}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  // Count mounted native inputs inside the role-located dialog without an
  // expensive accessible-name traversal for every individual input.
  expect(
    page
      .getByRole("dialog", { name: "Filter Name", exact: true })
      .element()
      .querySelectorAll('input[type="text"]'),
  ).toHaveLength(64);
});

test("condition windows stay bounded while editing, removing and adding preserves off-window conditions", async () => {
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        {
          type: "OR",
          conditions: [
            { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
            ...Array.from({ length: 69 }, (_, index) => ({
              columnId: "COL_ID_NAME" as const,
              type: "equals" as const,
              filter: index === 0 ? "Alan" : `Item ${String(index + 1)}`,
            })),
          ],
        },
      ]}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  await page.getByRole("button", { name: "Next conditions for Name", exact: true }).click();
  const last = page.getByRole("group", { name: "Filter condition 70 for Name", exact: true });
  await last.getByRole("textbox", { name: "Filter value", exact: true }).fill("Grace");
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(3);
  await page.getByRole("button", { name: "Remove condition 70 for Name", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Remove condition 69 for Name", exact: true }))
    .toHaveFocus();
  await expect
    .element(page.getByRole("gridcell", { name: "Grace", exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Add condition for Name", exact: true }).click();
  await expect
    .element(last.getByRole("textbox", { name: "Filter value", exact: true }))
    .toHaveFocus();
  expect(page.getByRole("gridcell").all()).toHaveLength(2);
  await last.getByRole("textbox", { name: "Filter value", exact: true }).fill("Grace");
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(3);
  expect(
    page
      .getByRole("dialog", { name: "Filter Name", exact: true })
      .element()
      .querySelectorAll('input[type="text"]'),
  ).toHaveLength(64);
});

test("changing expression structure cancels IME and rejects late composition events", async () => {
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        {
          type: "OR",
          conditions: [
            { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
            { columnId: "COL_ID_NAME", type: "equals", filter: "Alan" },
          ],
        },
      ]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  const first = page
    .getByRole("group", { name: "Filter condition 1 for Name", exact: true })
    .getByRole("textbox", { name: "Filter value", exact: true });
  first.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await first.fill("Gr");
  const mode = page.getByRole("combobox", { name: "Filter expression for Name", exact: true });
  await mode.click();
  await page.getByRole("option", { name: "All conditions (AND)", exact: true }).click();
  await expect.element(first).toHaveValue("Ada");
  await first.fill("Grace");
  await expect.element(first).toHaveValue("Ada");
  first
    .element()
    .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
  await first.fill("Alan");
  await expect.element(page.getByRole("gridcell", { name: "Alan", exact: true })).toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  expect(persisted).toHaveLength(2);
});

test("the editor preserves a maximum-depth expression when a wrapper would exceed its budget", async () => {
  const persisted: unknown[] = [];
  let expression: AstryxTableFilterExpression<Row, typeof columns> = {
    columnId: "COL_ID_NAME",
    type: "equals",
    filter: "Ada",
  };
  for (let depth = 0; depth < 64; depth++) expression = { type: "NOT", condition: expression };
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[expression]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  const mode = page.getByRole("combobox", { name: "Filter expression for Name", exact: true });
  await mode.click();
  await page.getByRole("option", { name: "Any condition (OR)", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Filter draft status", exact: true }))
    .toHaveTextContent("complexity limit");
  expect(persisted).toHaveLength(0);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
});

test("the shared node budget disables adding conditions without truncating the committed expression", async () => {
  const blank = { columnId: "COL_ID_NAME", type: "blank" } as const;
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        { type: "OR", conditions: [blank, ...Array.from({ length: 16_382 }, () => blank)] },
      ]}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Add condition for Name", exact: true }))
    .toBeDisabled();
  await page.getByRole("button", { name: "Remove condition 1 for Name", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Add condition for Name", exact: true }))
    .toBeEnabled();
});

test("nested condition trees share one bounded mounted editor budget", async () => {
  const leaf = { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" } as const;
  const group = {
    type: "OR",
    conditions: [leaf, ...Array.from({ length: 31 }, () => leaf)],
  } as const;
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        { type: "AND", conditions: [group, ...Array.from({ length: 31 }, () => group)] },
      ]}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter Name", exact: true }).element();
  expect(
    dialog.querySelectorAll('[role="group"][aria-label^="Filter "]').length,
  ).toBeLessThanOrEqual(255);
  expect(dialog.querySelectorAll('input[type="text"]').length).toBeLessThanOrEqual(256);
  await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
});

test("hidden nested conditions can be opened and edited without losing sibling expressions", async () => {
  const leaf = { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" } as const;
  const branch = {
    type: "NOT",
    condition: { type: "NOT", condition: { type: "NOT", condition: leaf } },
  } as const;
  const persisted: AstryxTablePersistedState<Row, typeof columns, true>[] = [];
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        { type: "AND", conditions: [branch, ...Array.from({ length: 63 }, () => branch)] },
      ]}
      onPersistChange={(state) => persisted.push(state)}
    />,
  );
  await page.getByRole("button", { name: "Filter Name (active)", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Open conditions for Name (condition 1 / not / not)",
      exact: true,
    })
    .click();
  const input = page.getByRole("textbox", { name: "Filter value", exact: true });
  await expect.element(input).toHaveFocus();
  await input.fill("Grace");
  await expect
    .element(page.getByRole("gridcell", { name: "Grace", exact: true }))
    .not.toBeInTheDocument();
  await expect.element(page.getByRole("gridcell", { name: "Alan", exact: true })).toBeVisible();
  await expect.element(input).toHaveValue("Grace");
  expect(persisted).toHaveLength(1);
  expect(persisted[0]?.filters).toMatchObject([
    {
      type: "AND",
      conditions: [
        {
          type: "NOT",
          condition: {
            type: "NOT",
            condition: {
              type: "NOT",
              condition: {
                ...leaf,
                filter: { $astryxTableValue: "text", version: 1, value: "Grace" },
              },
            },
          },
        },
        ...Array.from({ length: 63 }, () => ({
          type: "NOT",
          condition: {
            type: "NOT",
            condition: {
              type: "NOT",
              condition: {
                ...leaf,
                filter: { $astryxTableValue: "text", version: 1, value: "Ada" },
              },
            },
          },
        })),
      ],
    },
  ]);
  await page.getByRole("button", { name: "Back to full expression", exact: true }).click();
  await expect
    .element(page.getByRole("combobox", { name: "Filter expression for Name", exact: true }))
    .toHaveFocus();
  const dialog = page.getByRole("dialog", { name: "Filter Name", exact: true }).element();
  expect(
    dialog.querySelectorAll('[role="group"][aria-label^="Filter "]').length,
  ).toBeLessThanOrEqual(255);
  expect(dialog.querySelectorAll('input[type="text"]').length).toBeLessThanOrEqual(256);
  expect(persisted).toHaveLength(1);
  await page
    .getByRole("button", {
      name: "Open conditions for Name (condition 1 / not / not)",
      exact: true,
    })
    .click();
  await input.fill("Alan");
  await page.getByRole("button", { name: "Back to full expression", exact: true }).click();
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "Alan", exact: true }))
    .not.toBeInTheDocument();
  expect(persisted).toHaveLength(2);
});
