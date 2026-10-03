import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent, server } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumnId,
  type AstryxTableColumns,
} from "../packages/table/src";

import "./styles.css";

type Row = { id: string; sequence: number };
const rows = Array.from({ length: 2_000 }, (_, sequence) => ({ id: `row-${sequence}`, sequence }));
const columns = Array.from({ length: 40 }, (_, index) => ({
  columnId: `COL_ID_COLUMN_${index}` as AstryxTableColumnId,
  headerName: `Column ${index}`,
  field: "sequence" as const,
  valueType: "number" as const,
  width: 120,
  ...(index === 0 ? { pinned: "start" as const } : index === 39 ? { pinned: "end" as const } : {}),
})) satisfies AstryxTableColumns<Row>;
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function settle() {
  for (let index = 0; index < 30; index++) await frame();
}
afterEach(cleanup);

test.each(["ltr", "rtl"] as const)(
  "%s keeps start/end columns mounted and aligned through two-axis scrolling",
  async (direction) => {
    const tableId = `pinned-${direction}`;
    await render(
      <div dir={direction} style={{ width: 640 }}>
        <AstryxTableClient
          tableId={tableId}
          columns={columns}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_COLUMN_0", direction: "asc" }]}
          clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        />
      </div>,
    );
    const gridLocator = page.getByRole("grid", { name: tableId });
    await expect.element(gridLocator).toBeVisible();
    await settle();
    const grid = gridLocator.element();
    const start = page.getByRole("columnheader", { name: "Column 0", exact: true }).element();
    const end = page.getByRole("columnheader", { name: "Column 39", exact: true }).element();
    const initialStart = start.getBoundingClientRect();
    const initialEnd = end.getBoundingClientRect();
    const bounds = grid.getBoundingClientRect();
    expect(
      Math.abs(
        (direction === "ltr" ? initialStart.left : initialStart.right) -
          (direction === "ltr" ? bounds.left : bounds.right),
      ),
    ).toBeLessThan(3);
    expect(
      Math.abs(
        (direction === "ltr" ? initialEnd.right : initialEnd.left) -
          (direction === "ltr" ? bounds.right : bounds.left),
      ),
    ).toBeLessThan(3);
    grid.scrollTop = 720;
    grid.scrollLeft = direction === "rtl" ? -1800 : 1800;
    grid.dispatchEvent(new Event("scroll"));
    await settle();
    expect(Math.abs(start.getBoundingClientRect().left - initialStart.left)).toBeLessThan(1);
    expect(Math.abs(end.getBoundingClientRect().left - initialEnd.left)).toBeLessThan(1);
    for (const [columnIndex, header] of [
      [1, start],
      [40, end],
    ] as const) {
      const cells = [...grid.querySelectorAll(`[role="gridcell"][aria-colindex="${columnIndex}"]`)];
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.length).toBeLessThanOrEqual(33);
      for (const cell of cells) {
        expect(
          Math.abs(cell.getBoundingClientRect().left - header.getBoundingClientRect().left),
        ).toBeLessThan(1);
        expect(cell.getBoundingClientRect().width).toBe(120);
      }
    }
    const headerIndexes = [...grid.querySelectorAll('[role="columnheader"]')].map((element) =>
      Number(element.getAttribute("aria-colindex")),
    );
    expect(headerIndexes[0]).toBe(1);
    expect(headerIndexes.at(-1)).toBe(40);
    expect(headerIndexes.length).toBeLessThan(40);
    expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThanOrEqual(33 * 37);
    expect(
      [...grid.querySelectorAll('[role="row"]')].some(
        (element) => Number(element.getAttribute("aria-rowindex")) > 15,
      ),
    ).toBe(true);
  },
);

test("pin commands preserve scroll, identity and persisted intent for unsortable columns", async () => {
  const changes: unknown[] = [];
  const configured = columns.map((column, index) =>
    index === 1 ? { ...column, enableSorting: false } : column,
  );
  await render(
    <div style={{ width: 640 }}>
      <AstryxTableClient
        tableId="pin-commands"
        columns={configured}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_COLUMN_0", direction: "asc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        onPersistChange={(state) => changes.push(state)}
      />
    </div>,
  );
  const grid = page.getByRole("grid", { name: "pin-commands" }).element();
  await settle();
  grid.scrollTop = 720;
  await settle();
  await page.getByRole("button", { name: "Column 1 column menu", exact: true }).click();
  expect(grid.scrollTop, "opening the header menu").toBe(720);
  await page.getByRole("menuitem", { name: "Pin to end", exact: true }).click();
  await settle();
  await expect
    .element(page.getByRole("status", { name: "pin-commands interaction status" }))
    .toHaveTextContent("Column 1 pinned to logical end");
  expect(grid.scrollTop).toBe(720);
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({
    columnPinning: { start: ["COL_ID_COLUMN_0"], end: ["COL_ID_COLUMN_1", "COL_ID_COLUMN_39"] },
  });
  const pinned = page.getByRole("columnheader", { name: "Column 1", exact: true }).element();
  expect(pinned.getAttribute("aria-colindex")).toBe("39");
  grid.scrollLeft = 1800;
  await settle();
  const before = pinned.getBoundingClientRect();
  expect(before.right).toBeLessThan(grid.getBoundingClientRect().right);
  await page.getByRole("button", { name: "Column 1 column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Unpin column", exact: true }).click();
  await settle();
  expect(grid.scrollTop).toBe(720);
  // Unpinning moves the active header into the centre: reveal it with the minimum delta.
  const unpinned = page.getByRole("columnheader", { name: "Column 1", exact: true }).element();
  expect(unpinned.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    grid.getBoundingClientRect().left + 120,
  );
  expect(unpinned.getBoundingClientRect().right).toBeLessThanOrEqual(
    grid.getBoundingClientRect().right - 120,
  );
  await expect
    .element(page.getByRole("status", { name: "pin-commands interaction status" }))
    .toHaveTextContent("Column 1 unpinned");
  expect(changes).toHaveLength(2);
  expect(changes[1]).toMatchObject({
    columnPinning: { start: ["COL_ID_COLUMN_0"], end: ["COL_ID_COLUMN_39"] },
  });
  await page.getByRole("button", { name: "Column 1 column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Pin to start", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "pin-commands interaction status" }))
    .toHaveTextContent("Column 1 pinned to logical start");
  expect(changes).toHaveLength(3);
});

test.each(["ltr", "rtl"] as const)(
  "%s suspends and restores pinning without resetting scroll",
  async (direction) => {
    const view = (width: number) => (
      <div dir={direction} style={{ width }}>
        <AstryxTableClient
          tableId={`suspension-${direction}`}
          columns={columns}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_COLUMN_0", direction: "asc" }]}
          clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        />
      </div>
    );
    const screen = await render(view(640));
    const grid = page.getByRole("grid", { name: `suspension-${direction}` }).element();
    await settle();
    grid.scrollTop = 720;
    grid.scrollLeft = direction === "rtl" ? -1800 : 1800;
    await settle();
    await screen.rerender(view(280));
    await settle();
    expect(grid.scrollTop).toBe(720);
    // Suspension includes the former 120px start region in the scrolling coordinate.
    expect(Math.abs(grid.scrollLeft)).toBe(1920);
    for (const header of page.getByRole("columnheader").elements())
      expect(getComputedStyle(header).position).not.toBe("sticky");
    expect(page.getByRole("columnheader").elements().length).toBeLessThan(40);
    await screen.rerender(view(640));
    await settle();
    expect(grid.scrollTop).toBe(720);
    expect(Math.abs(grid.scrollLeft)).toBe(1800);
    for (const name of ["Column 0", "Column 39"]) {
      const header = page.getByRole("columnheader", { name, exact: true }).element();
      expect(getComputedStyle(header).position).toBe("sticky");
      expect(header.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        grid.getBoundingClientRect().left,
      );
      expect(header.getBoundingClientRect().right).toBeLessThanOrEqual(
        grid.getBoundingClientRect().right,
      );
    }
  },
);

test("keyboard pinning keeps focus on the same header menu trigger", async () => {
  await render(
    <div style={{ width: 640 }}>
      <AstryxTableClient
        tableId="pin-keyboard"
        columns={columns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_COLUMN_0", direction: "asc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
      />
    </div>,
  );
  await settle();
  const trigger = page.getByRole("button", { name: "Column 1 column menu", exact: true });
  const original = trigger.element();
  original.focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  await settle();
  expect(trigger.element()).toBe(original);
  await expect.element(trigger).toHaveFocus();
  expect(
    page
      .getByRole("columnheader", { name: "Column 1", exact: true })
      .element()
      .getAttribute("aria-colindex"),
  ).toBe("39");
});

test.each(["ltr", "rtl"] as const)(
  "%s exposes one accessible row with logically ordered cells across pinned regions",
  async (direction) => {
    const namedColumns = columns.map((column, index) => ({
      ...column,
      valueFormatter: ({ value }: { value: number }) => `${value}:c${index}`,
    }));
    await render(
      <div dir={direction} style={{ width: 640 }}>
        <AstryxTableClient
          tableId={`accessible-pins-${direction}`}
          columns={namedColumns}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_COLUMN_0", direction: "asc" }]}
          clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        />
      </div>,
    );
    const grid = page.getByRole("grid", { name: `accessible-pins-${direction}` }).element();
    await settle();
    for (const horizontal of [0, 1800, 1680, 2400, 0]) {
      grid.scrollTop = 720;
      grid.scrollLeft = direction === "rtl" ? -horizontal : horizontal;
      await frame();
      await frame();
      const tree = await server.commands.readGridAccessibility();
      const byId = new Map(tree.map((node) => [node.id, node]));
      const axRows = tree.filter((node) => node.role === "row");
      const domRows = [...grid.querySelectorAll('[role="row"]')];
      expect(axRows.length).toBe(domRows.length);
      const bodyRows = axRows.filter((row) =>
        row.children.some((id) => byId.get(id)?.role === "gridcell"),
      );
      expect(bodyRows.length).toBeGreaterThan(0);
      for (const row of bodyRows) {
        const cells = row.children
          .map((id) => byId.get(id))
          .filter((node) => node?.role === "gridcell");
        const labels = cells.map((cell) => cell!.name);
        const indexes = labels.map((label) => Number(label.split(":c")[1]));
        expect(indexes[0]).toBe(0);
        expect(indexes.at(-1)).toBe(39);
        expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
        expect(new Set(labels.map((label) => label.split(":c")[0])).size).toBe(1);
      }
    }
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s clips long and tall native cell content without adding cell scroll containers",
  async (direction) => {
    const content = "Very long cell content ".repeat(20);
    const textColumns = [0, 1, 2].map((index) => ({
      columnId: `COL_ID_TEXT_${index}` as AstryxTableColumnId,
      headerName: `Text ${index}`,
      field: "sequence" as const,
      valueType: "number" as const,
      width: 120,
      ...(index === 0
        ? { pinned: "start" as const }
        : index === 2
          ? { pinned: "end" as const }
          : {}),
      cellRenderer: () => <div style={{ height: 100 }}>{content}</div>,
    })) satisfies AstryxTableColumns<Row>;
    await render(
      <div dir={direction} style={{ width: 420 }}>
        <AstryxTableClient
          tableId={`clip-${direction}`}
          columns={textColumns}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_TEXT_0", direction: "asc" }]}
          clientSource={{ rows: rows.slice(0, 1), totalRows: 1, version: 1, status: "ready" }}
        />
      </div>,
    );
    await settle();
    const cells = page.getByRole("gridcell").elements();
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(cell.getBoundingClientRect().width).toBe(120);
      expect(cell.getBoundingClientRect().height).toBe(36);
      const clipped = getComputedStyle(cell).overflow === "clip" ? cell : cell.firstElementChild!;
      expect(getComputedStyle(clipped).overflow).toBe("clip");
      expect(getComputedStyle(clipped).textOverflow).toBe("ellipsis");
      expect(clipped.scrollWidth).toBeGreaterThan(clipped.clientWidth);
      expect(clipped.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        cell.getBoundingClientRect().bottom,
      );
      expect(clipped.scrollHeight).toBeGreaterThan(clipped.clientHeight);
      clipped.scrollLeft = 100;
      expect(clipped.scrollLeft).toBe(0);
    }
  },
);

for (const count of [1, 3]) {
  test.each(["ltr", "rtl"] as const)(
    `%s anchors an end region to a wider viewport with ${count} columns`,
    async (direction) => {
      const compact = columns.slice(0, count).map((column, index) => ({
        ...column,
        pinned:
          index === count - 1 ? ("end" as const) : index === 0 ? ("start" as const) : undefined,
      }));
      await render(
        <div role="group" aria-label="Pinning host" dir={direction} style={{ width: 640 }}>
          <AstryxTableClient
            tableId="short-pinned"
            columns={compact}
            getRowId={(row: Row) => row.id}
            initialOrderBy={[{ columnId: "COL_ID_COLUMN_0", direction: "asc" }]}
            clientSource={{ rows: rows.slice(0, 1), totalRows: 1, version: 1, status: "ready" }}
          />
        </div>,
      );
      const host = page.getByRole("group", { name: "Pinning host" }).element();
      for (const width of [640, 800]) {
        host.style.width = `${width}px`;
        await settle();
        const grid = page.getByRole("grid", { name: "short-pinned" }).element();
        const header = page
          .getByRole("columnheader", { name: `Column ${count - 1}`, exact: true })
          .element();
        const cell = grid.querySelector(`[role="gridcell"][aria-colindex="${count}"]`)!;
        const edge = direction === "ltr" ? "right" : "left";
        expect(
          Math.abs(header.getBoundingClientRect()[edge] - grid.getBoundingClientRect()[edge]),
        ).toBeLessThan(3);
        expect(
          Math.abs(cell.getBoundingClientRect()[edge] - grid.getBoundingClientRect()[edge]),
        ).toBeLessThan(3);
        expect(grid.scrollWidth - grid.clientWidth).toBeLessThanOrEqual(1);
      }
    },
  );
}

test("announces each accepted pin command when distinct columns share a label", async () => {
  const repeatedColumns = columns
    .slice(0, 2)
    .map((column) => ({ ...column, headerName: "Repeated", pinned: undefined }));
  await render(
    <div style={{ width: 640 }}>
      <AstryxTableClient
        tableId="repeated-announcement"
        columns={repeatedColumns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_COLUMN_0", direction: "asc" }]}
        clientSource={{ rows: rows.slice(0, 1), totalRows: 1, version: 1, status: "ready" }}
      />
    </div>,
  );
  await settle();
  const status = page
    .getByRole("status", { name: "repeated-announcement interaction status" })
    .element();
  const announcements: string[] = [];
  const observer = new MutationObserver(() => announcements.push(status.textContent ?? ""));
  observer.observe(status, { subtree: true, childList: true, characterData: true });
  try {
    for (const index of [0, 1]) {
      await page
        .getByRole("button", { name: "Repeated column menu", exact: true })
        .nth(index)
        .click();
      await page.getByRole("menuitem", { name: "Pin to start", exact: true }).click();
      await settle();
    }
    expect(
      announcements.filter((text) => text === "Repeated pinned to logical start"),
    ).toHaveLength(2);
  } finally {
    observer.disconnect();
  }
});
