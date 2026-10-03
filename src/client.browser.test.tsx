import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import {
  AstryxTableClient,
  type AstryxTableColumnId,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";
import {
  installAstryxTableClientViewRenderListenerForTable,
  installAstryxTableClientGridSurfaceRenderListenerForTable,
} from "../packages/table/src/internal/render-instrumentation";

type Quote = { id: string; name: string; price: bigint };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  { columnId: "COL_ID_PRICE", headerName: "Price", field: "price", valueType: "bigint" },
] as const satisfies AstryxTableColumns<Quote>;
const rows: readonly Quote[] = [
  { id: "lower", name: "Lower", price: 9007199254740992n },
  { id: "higher", name: "Higher", price: 9007199254740993n },
];

afterEach(cleanup);

test("Client renders explicit headers and sorts exact bigint values without losing precision", async () => {
  await render(
    <Theme theme={neutralTheme}>
      <AstryxTableClient
        tableId="quotes"
        columns={columns}
        getRowId={(row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_PRICE", direction: "desc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      />
    </Theme>,
  );
  const grid = page.getByRole("grid", { name: "quotes" });
  await expect.element(grid).toHaveAttribute("aria-rowcount", "3");
  await expect.element(page.getByRole("columnheader", { name: "Name", exact: true })).toBeVisible();
  await expect.element(page.getByRole("row").nth(1)).toHaveTextContent("Higher");
  await expect.element(page.getByRole("row").nth(2)).toHaveTextContent("Lower");
  await expect
    .element(page.getByRole("gridcell", { name: "9007199254740993", exact: true }))
    .toBeVisible();
});

test("empty Client preserves headers and reports an empty result", async () => {
  await render(
    <Theme theme={neutralTheme}>
      <AstryxTableClient
        tableId="empty"
        columns={columns}
        getRowId={(row: Quote) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_PRICE", direction: "asc" }]}
        clientSource={{ rows: [], totalRows: 0, version: 1, status: "ready" }}
      />
    </Theme>,
  );
  await expect
    .element(page.getByRole("grid", { name: "empty" }))
    .toHaveAttribute("aria-rowcount", "1");
  await expect
    .element(page.getByRole("status", { name: "empty status" }))
    .toHaveTextContent("No rows");
  await expect.element(page.getByRole("columnheader", { name: "Name", exact: true })).toBeVisible();
});

test("published Astryx column menu sorts exact values and restores keyboard focus", async () => {
  await render(
    <Theme theme={neutralTheme}>
      <AstryxTableClient
        tableId="menu"
        columns={columns}
        getRowId={(row: Quote) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_PRICE", direction: "desc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      />
    </Theme>,
  );
  const trigger = page.getByRole("button", { name: "Price column menu", exact: true });
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("menuitem", { name: "Sort ascending", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("row").nth(1)).toHaveTextContent("Lower");
  await expect.element(trigger).toHaveFocus();
  await expect
    .element(page.getByRole("columnheader", { name: "Price", exact: true }))
    .toHaveAttribute("aria-sort", "ascending");
});

test("a large Client keeps a bounded two-axis window while reaching its final rows and columns", async () => {
  type Item = { id: string; rank: number };
  const wideColumns = Array.from({ length: 150 }, (_, index) => ({
    columnId: `COL_ID_C${index}` as AstryxTableColumnId,
    headerName: `Column ${index}`,
    field: "rank" as const,
    valueType: "number" as const,
    width: 120,
    valueFormatter: ({ value }: { value: number }) => `${index}:${value}`,
  })) satisfies AstryxTableColumns<Item>;
  const data = Array.from({ length: 10_000 }, (_, rank) => ({ id: `row-${rank}`, rank }));
  await render(
    <Theme theme={neutralTheme}>
      <div style={{ width: 640 }}>
        <AstryxTableClient
          tableId="large"
          columns={wideColumns}
          getRowId={(row: Item) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
          clientSource={{ rows: data, totalRows: data.length, version: 1, status: "ready" }}
        />
      </div>
    </Theme>,
  );
  const grid = page.getByRole("grid", { name: "large" });
  await expect.element(grid).toHaveAttribute("aria-rowcount", "10001");
  const element = grid.element();
  const assertBounded = () => {
    expect(element.querySelectorAll('[role="row"]').length).toBeLessThan(80);
    // The retained viewport reserves 12 extra headers on each side, versus 2 body columns.
    expect(element.querySelectorAll('[role="columnheader"]').length).toBeLessThanOrEqual(
      Math.ceil(640 / 120) + 4 + 24,
    );
    expect(element.querySelectorAll('[role="gridcell"]').length).toBeLessThan(1600);
  };
  assertBounded();
  // Let the initial measurement commit; scroll windows must not rerender either root.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  let roots = 0;
  let surfaces = 0;
  const stopRoot = installAstryxTableClientViewRenderListenerForTable("large", () => {
    roots += 1;
  });
  const stopSurface = installAstryxTableClientGridSurfaceRenderListenerForTable("large", () => {
    surfaces += 1;
  });
  element.scrollTo({ top: element.scrollHeight, left: element.scrollWidth });
  await expect
    .element(page.getByRole("columnheader", { name: "Column 149", exact: true }))
    .toBeVisible();
  await expect.element(page.getByRole("gridcell", { name: "149:9999", exact: true })).toBeVisible();
  assertBounded();
  element.scrollTo({ top: 0, left: 0 });
  await expect.element(page.getByRole("gridcell", { name: "0:0", exact: true })).toBeVisible();
  assertBounded();
  stopRoot();
  stopSurface();
  expect(roots).toBe(0);
  expect(surfaces).toBe(0);
});

test("immutable publications update the changed cell without reformatting unchanged rows", async () => {
  const rendered: string[] = [];
  const liveColumns = [
    {
      columnId: "COL_ID_NAME",
      headerName: "Name",
      field: "name",
      valueType: "text",
      valueFormatter: ({ row, value }) => {
        rendered.push(row.id);
        return value;
      },
    },
    columns[1],
  ] as const satisfies AstryxTableColumns<Quote>;
  const getRowId = (row: Quote) => row.id;
  const view = (data: readonly Quote[], version: number) => (
    <Theme theme={neutralTheme}>
      <AstryxTableClient
        tableId="live"
        columns={liveColumns}
        getRowId={getRowId}
        initialOrderBy={[{ columnId: "COL_ID_PRICE", direction: "desc" }]}
        clientSource={{ rows: data, totalRows: data.length, version, status: "ready" }}
      />
    </Theme>
  );
  const screen = await render(view(rows, 1));
  await expect.element(page.getByRole("gridcell", { name: "Higher", exact: true })).toBeVisible();
  expect(rendered).toContain("lower");
  rendered.length = 0;
  const unchangedCell = page.getByRole("gridcell", { name: "Lower", exact: true }).element();
  await screen.rerender(view([rows[0]!, { ...rows[1]!, name: "Updated higher" }], 2));
  await expect
    .element(page.getByRole("gridcell", { name: "Updated higher", exact: true }))
    .toBeVisible();
  expect(page.getByRole("gridcell", { name: "Lower", exact: true }).element()).toBe(unchangedCell);
  expect(rendered).toContain("higher");
  expect(rendered).not.toContain("lower");
});

test("horizontal preparation keeps every visible row aligned with its headers on each frame", async () => {
  type Item = { id: string; rank: number };
  const wideColumns = Array.from({ length: 80 }, (_, index) => ({
    columnId: `COL_ID_C${index}` as AstryxTableColumnId,
    headerName: `Column ${index}`,
    field: "rank" as const,
    valueType: "number" as const,
    width: 120,
  })) satisfies AstryxTableColumns<Item>;
  const data = Array.from({ length: 100 }, (_, rank) => ({ id: String(rank), rank }));
  await render(
    <Theme theme={neutralTheme}>
      <div style={{ width: 640 }}>
        <AstryxTableClient
          tableId="frames"
          columns={wideColumns}
          getRowId={(row: Item) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
          clientSource={{ rows: data, totalRows: data.length, version: 1, status: "ready" }}
        />
      </div>
    </Theme>,
  );
  const grid = page.getByRole("grid", { name: "frames" }).element();
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await nextFrame();
  await nextFrame();
  for (let step = 1; step <= 12; step += 1) {
    grid.scrollLeft = step * 120;
    for (let frame = 0; frame < 8; frame += 1) {
      await nextFrame();
      const gridBox = grid.getBoundingClientRect();
      const firstRow = grid.querySelector<HTMLElement>('[role="row"][aria-rowindex="2"]')!;
      for (const cell of firstRow.querySelectorAll<HTMLElement>('[role="gridcell"]')) {
        const box = cell.getBoundingClientRect();
        if (box.width === 0 || box.right <= gridBox.left || box.left >= gridBox.right) continue;
        const header = grid.querySelector<HTMLElement>(
          `[role="columnheader"][aria-colindex="${cell.getAttribute("aria-colindex")}"]`,
        )!;
        expect(Math.abs(box.left - header.getBoundingClientRect().left)).toBeLessThan(1);
      }
      const visibleRows = [
        ...grid.querySelectorAll<HTMLElement>('[role="row"][aria-rowindex]'),
      ].filter(
        (row) =>
          Number(row.getAttribute("aria-rowindex")) > 1 &&
          row.getBoundingClientRect().top < gridBox.bottom,
      );
      const visibleColumns = (row: HTMLElement) =>
        [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')]
          .filter((cell) => {
            const box = cell.getBoundingClientRect();
            return box.width > 0 && box.right > gridBox.left && box.left < gridBox.right;
          })
          .map((cell) => cell.getAttribute("aria-colindex"));
      const expected = visibleColumns(firstRow);
      expect(expected.length).toBeGreaterThan(0);
      for (const row of visibleRows) expect(visibleColumns(row)).toEqual(expected);
    }
  }
});
