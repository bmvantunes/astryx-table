import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableActiveFilters,
  AstryxTableClient,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; team: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  { columnId: "COL_ID_TEAM", headerName: "Team", field: "team", valueType: "text" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "active-filter-review",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [
      { id: "ada", name: "Ada", team: "Core" },
      { id: "alan", name: "Alan", team: "Core" },
      { id: "grace", name: "Grace", team: "Data" },
    ],
    totalRows: 3,
    version: 1,
    status: "ready" as const,
  },
};

test("active filters count columns, remove complete expressions, and return focus after the final removal", async () => {
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[
        { columnId: "COL_ID_NAME", type: "contains", filter: "A" },
        { columnId: "COL_ID_NAME", type: "startsWith", filter: "A" },
        { columnId: "COL_ID_TEAM", type: "equals", filter: "Core" },
      ]}
      onPersistChange={(value) => persisted.push(value)}
    >
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  const trigger = page.getByRole("button", { name: "Active filters (2)", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  const review = page.getByRole("dialog", { name: "Active filters", exact: true });
  const name = review.getByRole("button", { name: /^Remove Name/ });
  await expect.element(name).toHaveFocus();
  await name.click();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({ filters: [{ columnId: "COL_ID_TEAM" }] });
  const team = review.getByRole("button", { name: /^Remove Team/ });
  await expect.element(team).toHaveFocus();
  await team.click();
  await expect.element(review).not.toBeInTheDocument();
  const empty = page.getByRole("button", { name: "Active filters (0)", exact: true });
  await expect.element(empty).toHaveFocus();
  await expect.element(empty).toHaveAttribute("aria-disabled", "true");
  expect(persisted).toHaveLength(2);
  expect(persisted[1]).toMatchObject({ filters: [] });
  await userEvent.keyboard("{Enter}");
  await expect.element(review).not.toBeInTheDocument();
});

test("active-filter review includes hidden columns and clears all grid filters atomically", async () => {
  const persisted: unknown[] = [];
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
          {
            columnId: "COL_ID_TEAM",
            type: "contains",
            filter: "Core",
            codecId: "@bruno/table/text",
            codecVersion: 1,
          },
        ],
        orderBy: props.initialOrderBy,
        groupBy: [],
        groupOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
        columnOrder: ["COL_ID_NAME", "COL_ID_TEAM"],
        columnVisibility: { COL_ID_TEAM: false },
        columnWidths: {},
        columnPinning: { start: [], end: [] },
      }}
      initialFilters={[
        { columnId: "COL_ID_NAME", type: "contains", filter: "Ada" },
        { columnId: "COL_ID_TEAM", type: "equals", filter: "Core" },
      ]}
      onPersistChange={(value) => persisted.push(value)}
    >
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  await expect
    .element(page.getByRole("columnheader", { name: "Team", exact: true }))
    .not.toBeInTheDocument();
  const before = persisted.length;
  await page.getByRole("button", { name: "Active filters (2)", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Active filters", exact: true });
  await expect.element(review.getByRole("button", { name: /^Remove Team/ })).toBeVisible();
  await review.getByRole("button", { name: "Clear all Grid Filters", exact: true }).click();
  await expect.element(review).not.toBeInTheDocument();
  expect(persisted).toHaveLength(before + 1);
  expect(persisted.at(-1)).toMatchObject({ filters: [] });
  expect(page.getByRole("gridcell").all()).toHaveLength(3);
});

test("the complete filter review stays bounded and keeps focus when removing its final window entry", async () => {
  const many = Array.from({ length: 70 }, (_, index) => ({
    columnId: `COL_ID_FIELD_${index}` as `COL_ID_FIELD_${Uppercase<`${number}`>}`,
    headerName: `Field ${index}`,
    field: "name" as const,
    valueType: "text" as const,
  })) satisfies AstryxTableColumns<Row>;
  const persisted: unknown[] = [];
  await render(
    <AstryxTableClient
      {...props}
      columns={many}
      initialOrderBy={[{ columnId: "COL_ID_FIELD_0", direction: "asc" }]}
      initialFilters={many.map((column) => ({
        columnId: column.columnId,
        type: "contains" as const,
        filter: "A",
      }))}
      onPersistChange={(state) => persisted.push(state)}
    >
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  await page.getByRole("button", { name: "Active filters (70)", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Active filters", exact: true });
  expect(review.getByRole("button", { name: /^Remove / }).all()).toHaveLength(64);
  await review.getByRole("button", { name: "Next active filters", exact: true }).click();
  expect(review.getByRole("button", { name: /^Remove / }).all()).toHaveLength(64);
  await review.getByRole("button", { name: /^Remove Field 69\b/ }).click();
  await expect.element(review.getByRole("button", { name: /^Remove Field 68\b/ })).toHaveFocus();
  expect(review.getByRole("button", { name: /^Remove / }).all()).toHaveLength(64);
  expect(persisted).toHaveLength(1);
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByRole("button", { name: "Active filters (69)", exact: true }))
    .toHaveFocus();
});

test("an open review follows current column labels without changing filter identity", async () => {
  const persisted: unknown[] = [];
  const initialFilters = [{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }] as const;
  const view = await render(
    <AstryxTableClient
      {...props}
      initialFilters={initialFilters}
      onPersistChange={(state) => persisted.push(state)}
    >
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  await page.getByRole("button", { name: "Active filters (1)", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Active filters", exact: true });
  await expect.element(review.getByRole("button", { name: /^Remove Name/ })).toBeVisible();
  await view.rerender(
    <AstryxTableClient
      {...props}
      columns={[{ ...columns[0], headerName: "Person" }, columns[1]]}
      initialFilters={initialFilters}
      onPersistChange={(state) => persisted.push(state)}
    >
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  await expect.element(review.getByRole("button", { name: /^Remove Person/ })).toBeVisible();
  expect(persisted).toHaveLength(0);
  await review.getByRole("button", { name: /^Remove Person/ }).click();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({ filters: [] });
});
