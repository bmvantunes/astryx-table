import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumns,
  type AstryxTableColumnId,
} from "../packages/table/src";
import "./styles.css";

const originalViewport = { width: window.innerWidth, height: window.innerHeight };
beforeEach(async () => {
  await page.viewport(1280, 900);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await page.viewport(originalViewport.width, originalViewport.height);
});
type Row = { id: string; name: string; amount: bigint; city: string };
const rows: Row[] = [
  { id: "a", name: "Ada", amount: 9007199254740993n, city: "Lisbon" },
  { id: "b", name: "Alan", amount: 9007199254740995n, city: "Porto" },
  { id: "c", name: "Grace", amount: 9007199254740997n, city: "Braga" },
];
const columns = [
  {
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    valueType: "text",
    width: 140,
    pinned: "start",
    groupBy: true,
  },
  {
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    valueType: "bigint",
    width: 140,
  },
  {
    columnId: "COL_ID_CITY",
    headerName: "City",
    field: "city",
    valueType: "text",
    width: 140,
    pinned: "end",
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "pointer-range",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: { rows, totalRows: rows.length, version: 1, status: "ready" as const },
};
const cell = (name: string) =>
  page.getByRole("gridcell", { name, exact: true }).element() as HTMLElement;
const center = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
};
function pointer(
  type: string,
  target: EventTarget,
  point: ReturnType<typeof center>,
  options: PointerEventInit = {},
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 23,
      button: 0,
      ...point,
      ...options,
    }),
  );
}
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const copy = () => userEvent.keyboard("{ControlOrMeta>}c{/ControlOrMeta}");

for (const direction of ["ltr", "rtl"] as const) {
  test(`${direction} pointer ranges cross native pinned regions and copy the exact linear span`, async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await render(
      <div dir={direction}>
        <AstryxTableClient {...props} />
      </div>,
    );
    const ada = cell("Ada");
    const grace = cell("Grace");
    pointer("pointerdown", ada, center(ada));
    pointer("pointermove", grace, center(grace));
    await frame();
    pointer("pointerup", window, center(grace));
    await copy();
    expect(write).toHaveBeenLastCalledWith("Ada\nAlan\nGrace");
    const lisbon = cell("Lisbon");
    pointer("pointerdown", ada, center(ada));
    pointer("pointermove", lisbon, center(lisbon));
    await frame();
    pointer("pointerup", window, center(lisbon));
    await copy();
    expect(write).toHaveBeenLastCalledWith("Ada\t9007199254740993\tLisbon");
  });
}

for (const ending of ["escape", "pointercancel"] as const) {
  test(`${ending} restores the exact range and Active Cell from before the drag`, async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await render(<AstryxTableClient {...props} />);
    const grid = page
      .getByRole("grid", { name: "pointer-range", exact: true })
      .element() as HTMLElement;
    grid.focus();
    await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    const active = grid.getAttribute("aria-activedescendant");
    pointer("pointerdown", cell("Ada"), center(cell("Ada")));
    pointer("pointermove", cell("Lisbon"), center(cell("Lisbon")));
    await frame();
    if (ending === "escape") await userEvent.keyboard("{Escape}");
    else pointer("pointercancel", window, center(cell("Lisbon")));
    expect(grid.getAttribute("aria-activedescendant")).toBe(active);
    pointer("pointerup", window, center(cell("Lisbon")));
    await copy();
    expect(write).toHaveBeenLastCalledWith("Ada\nAlan\nGrace");
  });
}

const gridElement = () =>
  page.getByRole("grid", { name: "pointer-range", exact: true }).element() as HTMLElement;
const selectedNames = () =>
  [...gridElement().querySelectorAll('[role="gridcell"][aria-selected="true"]')].map(
    (element) => element.textContent,
  );

test("slop and equal displacement stay single-cell, then diagonal movement keeps the acquired axis", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await render(<AstryxTableClient {...props} />);
  const ada = cell("Ada");
  const start = center(ada);
  pointer("pointerdown", ada, start);
  pointer("pointermove", ada, { clientX: start.clientX + 2, clientY: start.clientY + 1 });
  await frame();
  await expect.poll(selectedNames).toEqual(["Ada"]);
  pointer("pointermove", cell("Alan"), {
    clientX: start.clientX + 12,
    clientY: start.clientY + 12,
  });
  await frame();
  await expect.poll(selectedNames).toEqual(["Ada"]);
  pointer("pointermove", cell("Alan"), center(cell("Alan")));
  await frame();
  await expect.poll(selectedNames).toEqual(["Ada", "Alan"]);
  pointer("pointermove", cell("Braga"), center(cell("Braga")));
  await frame();
  pointer("pointerup", window, center(cell("Braga")));
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada\nAlan\nGrace");
});

test("Shift-click extends the current span; Ctrl and Meta clicks replace it", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await render(<AstryxTableClient {...props} />);
  await page.getByRole("gridcell", { name: "Ada", exact: true }).click();
  pointer("pointerdown", cell("Grace"), center(cell("Grace")), { shiftKey: true });
  pointer("pointerup", window, center(cell("Grace")), { shiftKey: true });
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada\nAlan\nGrace");
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    pointer("pointerdown", cell("Lisbon"), center(cell("Lisbon")), modifier);
    pointer("pointerup", window, center(cell("Lisbon")), modifier);
    await copy();
    expect(write).toHaveBeenLastCalledWith("Lisbon");
    gridElement().focus();
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
    await copy();
    expect(write).toHaveBeenLastCalledWith("Lisbon\nPorto");
  }
});

test("custom controls and nested grids never acquire the outer pointer gesture", async () => {
  const customColumns = columns.map((column) =>
    column.columnId !== "COL_ID_CITY"
      ? column
      : {
          ...column,
          cellRenderer: ({ row }: { row: Row }) => (
            <>
              <button>{row.city} action</button>
              <div role="grid" aria-label={`${row.city} nested`}>
                <span role="gridcell">Nested {row.city}</span>
              </div>
            </>
          ),
        },
  ) satisfies AstryxTableColumns<Row>;
  await render(<AstryxTableClient {...props} columns={customColumns} />);
  for (const target of [
    page.getByRole("button", { name: "Lisbon action", exact: true }).element(),
    page.getByRole("gridcell", { name: "Nested Lisbon", exact: true }).element(),
  ]) {
    pointer("pointerdown", target, center(target as HTMLElement));
    pointer("pointermove", cell("Grace"), center(cell("Grace")));
    await frame();
    pointer("pointerup", window, center(cell("Grace")));
    expect(selectedNames().length).toBeLessThanOrEqual(1);
  }
  await page.getByRole("gridcell", { name: "Ada", exact: true }).click();
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
  await expect.poll(selectedNames).toEqual(["Ada", "Alan"]);
});

test("a live covered-identity change cancels the drag and ignores late pointer delivery", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const view = await render(<AstryxTableClient {...props} />);
  pointer("pointerdown", cell("Ada"), center(cell("Ada")));
  pointer("pointermove", cell("Grace"), center(cell("Grace")));
  await frame();
  await expect.poll(selectedNames).toEqual(["Ada", "Alan", "Grace"]);
  const next = rows.filter((row) => row.id !== "b");
  await view.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{ rows: next, totalRows: next.length, version: 2, status: "ready" }}
    />,
  );
  pointer("pointermove", cell("Lisbon"), center(cell("Lisbon")));
  pointer("pointerup", window, center(cell("Lisbon")));
  await expect.poll(selectedNames).toEqual([]);
  await copy();
  expect(write).not.toHaveBeenCalled();
  await expect
    .element(page.getByRole("status", { name: "pointer-range interaction status", exact: true }))
    .toHaveTextContent("selected cells are no longer available");
  await page.getByRole("gridcell", { name: "Ada", exact: true }).click();
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada");
});

for (const direction of ["ltr", "rtl"] as const) {
  test(`${direction} vertical drag autoscrolls through virtual rows and stops on outside release`, async () => {
    const manyRows = Array.from({ length: 500 }, (_, index) => ({
      id: String(index),
      name: `Name ${String(index).padStart(3, "0")}`,
      amount: BigInt(index),
      city: "City",
    }));
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await render(
      <div dir={direction}>
        <AstryxTableClient
          {...props}
          clientSource={{ rows: manyRows, totalRows: manyRows.length, version: 1, status: "ready" }}
        />
      </div>,
    );
    const grid = gridElement();
    const first = cell("Name 000");
    const start = center(first);
    const bounds = grid.getBoundingClientRect();
    const outside = { clientX: start.clientX, clientY: bounds.bottom + 20 };
    pointer("pointerdown", first, start);
    pointer("pointermove", window, outside);
    await expect.poll(() => grid.scrollTop).toBeGreaterThan(500);
    expect(grid.scrollLeft).toBe(0);
    pointer("pointerup", window, outside);
    const end = grid.scrollTop;
    await frame();
    await frame();
    expect(grid.scrollTop).toBe(end);
    expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThan(200);
    await copy();
    const text = write.mock.calls.at(-1)?.[0];
    expect(text).toBeDefined();
    const copied = text!.split("\n");
    expect(copied.length).toBeGreaterThan(15);
    expect(copied).toEqual(manyRows.slice(0, copied.length).map((row) => row.name));
  });
}

for (const direction of ["ltr", "rtl"] as const) {
  test(`${direction} horizontal autoscroll keeps pinned boundaries mounted and never scrolls vertically`, async () => {
    const wideColumns = Array.from({ length: 60 }, (_, index) => ({
      columnId: `COL_ID_WIDE_${index}` as AstryxTableColumnId,
      headerName: `Wide ${index}`,
      field: "name" as const,
      valueType: "text" as const,
      width: 140,
      valueFormatter: ({ value }: { value: string }) => `${index}: ${value}`,
      ...(index === 0
        ? { pinned: "start" as const }
        : index === 59
          ? { pinned: "end" as const }
          : {}),
    })) satisfies AstryxTableColumns<Row>;
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await render(
      <div dir={direction} style={{ width: 1024 }}>
        <AstryxTableClient
          {...props}
          columns={wideColumns}
          initialOrderBy={[{ columnId: "COL_ID_WIDE_0", direction: "asc" }]}
        />
      </div>,
    );
    const grid = gridElement();
    const anchor = cell("0: Ada");
    const start = center(anchor);
    const bounds = grid.getBoundingClientRect();
    const edge = {
      clientX: direction === "rtl" ? bounds.left + 1 : bounds.right - 1,
      clientY: start.clientY,
    };
    const initialHeaders = [...grid.querySelectorAll('[role="columnheader"]')].map(
      (element) => element.textContent,
    );
    pointer("pointerdown", anchor, start);
    pointer("pointermove", window, edge);
    await expect
      .poll(
        () =>
          [...grid.querySelectorAll('[role="columnheader"]')].map((element) => element.textContent),
        { timeout: 5000 },
      )
      .not.toEqual(initialHeaders);
    expect(Math.abs(grid.scrollLeft)).toBeGreaterThan(700);
    expect(Math.sign(grid.scrollLeft)).toBe(direction === "rtl" ? -1 : 1);
    expect(grid.scrollTop).toBe(0);
    pointer("pointerup", window, edge);
    const end = grid.scrollLeft;
    await frame();
    await frame();
    expect(grid.scrollLeft).toBe(end);
    expect(
      [...grid.querySelectorAll('[role="columnheader"]')].map((element) => element.textContent),
    ).not.toEqual(initialHeaders);
    await expect
      .element(page.getByRole("columnheader", { name: "Wide 0", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("columnheader", { name: "Wide 59", exact: true }))
      .toBeVisible();
    expect(grid.querySelectorAll('[role="columnheader"]').length).toBeLessThan(40);
    await copy();
    expect(write).toHaveBeenLastCalledWith(Array.from({ length: 60 }, () => "Ada").join("\t"));
  });
}

test("changing direction cancels an active drag and restores its previous selection", async () => {
  const view = await render(
    <div dir="ltr">
      <AstryxTableClient {...props} />
    </div>,
  );
  gridElement().focus();
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
  const before = gridElement().getAttribute("aria-activedescendant");
  pointer("pointerdown", cell("Ada"), center(cell("Ada")));
  pointer("pointermove", cell("Lisbon"), center(cell("Lisbon")));
  await frame();
  await view.rerender(
    <div dir="rtl">
      <AstryxTableClient {...props} />
    </div>,
  );
  await expect.poll(() => gridElement().getAttribute("aria-activedescendant")).toBe(before);
  await expect.poll(selectedNames).toEqual(["Ada", "Alan"]);
  pointer("pointerup", window, center(cell("Lisbon")));
  await expect.poll(selectedNames).toEqual(["Ada", "Alan"]);
});
