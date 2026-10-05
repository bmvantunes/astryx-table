import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumnId,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

type Row = { id: string; value: number };
const columns = [
  {
    columnId: "COL_ID_A",
    headerName: "A",
    field: "value",
    valueType: "number",
    width: 120,
    pinned: "start",
  },
  { columnId: "COL_ID_B", headerName: "B", field: "value", valueType: "number", width: 120 },
  {
    columnId: "COL_ID_C",
    headerName: "C",
    field: "value",
    valueType: "number",
    width: 120,
    pinned: "end",
  },
] as const satisfies AstryxTableColumns<Row>;
const rows = Array.from({ length: 100 }, (_, value) => ({ id: `row-${value}`, value }));
afterEach(cleanup);
async function mount(
  direction: "ltr" | "rtl" = "ltr",
  data = rows,
  definition: AstryxTableColumns<Row> = columns,
) {
  return render(
    <>
      <button>Before</button>
      <div dir={direction} style={{ width: 400 }}>
        <AstryxTableClient
          tableId="navigation"
          columns={definition}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_A", direction: "asc" }]}
          clientSource={{ rows: data, totalRows: data.length, version: 1, status: "ready" }}
        />
      </div>
      <button>After</button>
    </>,
  );
}
function active() {
  const grid = page.getByRole("grid").element();
  const id = grid.getAttribute("aria-activedescendant");
  return id === null ? null : grid.ownerDocument.getElementById(id);
}

test.each(["ltr", "rtl"] as const)(
  "%s enters the side management controls before navigating headers and body through one grid tab stop",
  async (direction) => {
    await mount(direction);
    page.getByRole("button", { name: "Before", exact: true }).element().focus();
    await userEvent.keyboard("{Tab}");
    await expect
      .element(page.getByRole("button", { name: "Column preferences", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect
      .element(page.getByRole("button", { name: "Sort rows, 1 active", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Tab}");
    const grid = page.getByRole("grid");
    await expect.element(grid).toHaveFocus();
    await expect.poll(() => active()?.getAttribute("aria-colindex")).toBe("1");
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => active()?.getAttribute("aria-colindex")).toBe("2");
    await userEvent.keyboard("{ArrowUp}");
    await expect.poll(() => active()?.getAttribute("role")).toBe("columnheader");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => active()?.getAttribute("role")).toBe("gridcell");
    await userEvent.keyboard("{Tab}");
    await expect.element(page.getByRole("button", { name: "After", exact: true })).toHaveFocus();
  },
);

test("held commands retain every logical move and reveal the destination", async () => {
  await mount();
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{ArrowDown>45/}");
  await expect.poll(() => active()?.textContent).toBe("45");
  await expect.poll(() => grid.element().scrollTop).toBeGreaterThan(0);
  const rect = active()!.getBoundingClientRect();
  const viewport = grid.element().getBoundingClientRect();
  expect(rect.bottom).toBeLessThanOrEqual(viewport.bottom + 1);
  await expect.element(grid).toHaveFocus();
});

test("custom inputs own their keys and Escape returns to the same Active Cell", async () => {
  await mount("ltr", rows, [
    {
      ...columns[0],
      cellRenderer: ({ value }: { value: unknown }) => (
        <input aria-label={`Value ${value}`} defaultValue={String(value)} />
      ),
    },
    columns[1],
    columns[2],
  ]);
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("textbox", { name: "Value 0", exact: true })).toHaveFocus();
  const id = grid.element().getAttribute("aria-activedescendant");
  await userEvent.keyboard("{ArrowDown}{ArrowRight}");
  expect(grid.element().getAttribute("aria-activedescendant")).toBe(id);
  await userEvent.keyboard("{Escape}");
  await expect.element(grid).toHaveFocus();
  expect(grid.element().getAttribute("aria-activedescendant")).toBe(id);
  await userEvent.keyboard("{Tab}");
  await expect.element(page.getByRole("button", { name: "After", exact: true })).toHaveFocus();
});

test("empty grids navigate headers without inventing a body cell", async () => {
  await mount("ltr", []);
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{ArrowRight}{ArrowDown}");
  await expect.poll(() => active()?.getAttribute("role")).toBe("columnheader");
  expect(active()?.getAttribute("aria-colindex")).toBe("2");
  await expect.element(grid).toHaveFocus();
});

test.each(["Shift+F10", "ContextMenu"])(
  "%s opens the active header menu and restores connected focus",
  async (shortcut) => {
    await mount();
    const grid = page.getByRole("grid");
    grid.element().focus();
    await userEvent.keyboard("{ArrowUp}");
    if (shortcut === "Shift+F10") await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    else await userEvent.keyboard("{ContextMenu}");
    await expect
      .element(page.getByRole("menuitem", { name: "Sort descending", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect
      .element(page.getByRole("button", { name: "A column menu", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect.element(grid).toHaveFocus();
    expect(active()?.getAttribute("aria-label")).toBe("A");
  },
);

test("pointer activation retains stable row and column identities", async () => {
  await mount();
  const cell = page
    .getByRole("gridcell", { name: "3", exact: true })
    .elements()
    .find((cell) => cell.getAttribute("aria-colindex") === "2")!;
  cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  await expect.poll(() => active()).toBe(cell);
  await expect.element(page.getByRole("grid")).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  expect(active()).toBe(cell);
  cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
  await userEvent.keyboard("{ArrowDown}");
  expect(active()?.textContent).toBe("4");
  expect(active()?.getAttribute("aria-colindex")).toBe("2");
});

test("scrolling away clears only the mounted descendant and restores it on return", async () => {
  await mount();
  const grid = page.getByRole("grid");
  grid.element().focus();
  const id = grid.element().getAttribute("aria-activedescendant");
  grid.element().scrollTop = 2400;
  await expect.poll(() => grid.element().getAttribute("aria-activedescendant")).toBeNull();
  await expect.element(grid).toHaveFocus();
  grid.element().scrollTop = 0;
  await expect.poll(() => grid.element().getAttribute("aria-activedescendant")).toBe(id);
});

test("composition and descendant-owned Escape remain native", async () => {
  await mount("ltr", rows, [
    {
      ...columns[0],
      cellRenderer: () => (
        <input aria-label="Owned input" onKeyDown={(event) => event.stopPropagation()} />
      ),
    },
    columns[1],
    columns[2],
  ]);
  const grid = page.getByRole("grid");
  grid.element().focus();
  const id = grid.element().getAttribute("aria-activedescendant");
  const composing = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    isComposing: true,
    key: "ArrowDown",
  });
  grid.element().dispatchEvent(composing);
  expect(composing.defaultPrevented).toBe(false);
  expect(grid.element().getAttribute("aria-activedescendant")).toBe(id);
  await userEvent.keyboard("{F2}");
  const input = page.getByRole("textbox", { name: "Owned input", exact: true }).elements()[0]!;
  expect(document.activeElement).toBe(input);
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(input);
});

test("a recycled focused control falls back to its grid without revealing the old row", async () => {
  await mount("ltr", rows, [
    {
      ...columns[0],
      cellRenderer: ({ value }: { value: unknown }) => <input aria-label={`Value ${value}`} />,
    },
    columns[1],
    columns[2],
  ]);
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByRole("textbox", { name: "Value 0", exact: true })).toHaveFocus();
  grid.element().scrollTop = 2400;
  await expect.element(grid).toHaveFocus();
  expect(grid.element().scrollTop).toBeGreaterThan(2000);
  await expect.poll(() => grid.element().getAttribute("aria-activedescendant")).toBeNull();
});

test.each(["ltr", "rtl"] as const)(
  "%s reveals one centre destination while pinned destinations retain horizontal scroll",
  async (direction) => {
    const many = [
      columns[0],
      ...Array.from({ length: 40 }, (_, index) => ({
        ...columns[1],
        columnId: `COL_ID_CENTRE_${index}` as AstryxTableColumnId,
        headerName: `Centre ${index}`,
      })),
      columns[2],
    ] satisfies AstryxTableColumns<Row>;
    await mount(direction, rows, many);
    const grid = page.getByRole("grid");
    grid.element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => active()?.getAttribute("aria-colindex")).toBe("2");
    expect(Math.abs(grid.element().scrollLeft)).toBeLessThan(1);
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => Math.abs(grid.element().scrollLeft)).toBeGreaterThan(0);
    // The second centre column ends at 360px; the 120px end pin reduces the visible edge.
    expect(Math.abs(grid.element().scrollLeft)).toBe(Math.max(480 - grid.element().clientWidth, 0));
    await userEvent.keyboard("{End}");
    await expect.poll(() => active()?.getAttribute("aria-colindex")).toBe("42");
    const before = grid.element().scrollLeft;
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => active()?.textContent).toBe("1");
    expect(grid.element().scrollLeft).toBe(before);
  },
);

test("Enter and Space sort the active header without leaving navigation", async () => {
  await mount();
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{ArrowUp}{Enter}");
  await expect
    .element(page.getByRole("columnheader", { name: "A", exact: true }))
    .toHaveAttribute("aria-sort", "descending");
  await expect.element(grid).toHaveFocus();
  await userEvent.keyboard(" ");
  await expect
    .element(page.getByRole("columnheader", { name: "A", exact: true }))
    .toHaveAttribute("aria-sort", "ascending");
  await expect.element(grid).toHaveFocus();
});

test("nested grid commands and descendant Escape belong to the nearest table", async () => {
  const inner = [
    { ...columns[0], pinned: undefined, cellRenderer: () => <input aria-label="Nested value" /> },
  ] satisfies AstryxTableColumns<Row>;
  const outer = [
    {
      ...columns[0],
      pinned: undefined,
      width: 360,
      cellRenderer: () => (
        <AstryxTableClient
          tableId="nested"
          columns={inner}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_A", direction: "asc" }]}
          clientSource={{ rows: rows.slice(0, 2), totalRows: 2, version: 1, status: "ready" }}
        />
      ),
    },
  ] satisfies AstryxTableColumns<Row>;
  await mount("ltr", rows.slice(0, 1), outer);
  const parent = page.getByRole("grid", { name: "navigation", exact: true });
  const child = page.getByRole("grid", { name: "nested", exact: true });
  parent.element().focus();
  const parentId = parent.element().getAttribute("aria-activedescendant");
  child.element().focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(parent.element().getAttribute("aria-activedescendant")).toBe(parentId);
  await userEvent.keyboard("{Enter}");
  const focused = document.activeElement;
  expect(focused?.getAttribute("aria-label")).toBe("Nested value");
  await userEvent.keyboard("{Escape}");
  await expect.element(child).toHaveFocus();
  expect(parent.element().getAttribute("aria-activedescendant")).toBe(parentId);
});

test("a header context menu activates its own column and restores focus", async () => {
  await mount();
  const header = page.getByRole("columnheader", { name: "B", exact: true });
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
  header.element().dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await expect
    .element(page.getByRole("menuitem", { name: "Sort ascending", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Escape}{Escape}");
  await expect.element(page.getByRole("grid")).toHaveFocus();
  expect(active()?.getAttribute("aria-label")).toBe("B");
});

test("SVG content activates the containing cell", async () => {
  await mount("ltr", rows, [
    columns[0],
    {
      ...columns[1],
      cellRenderer: ({ value }: { value: unknown }) => (
        <svg aria-label={`Icon ${value}`}>
          <circle cx="5" cy="5" r="4" />
        </svg>
      ),
    },
    columns[2],
  ]);
  const icon = document.querySelector('[aria-label="Icon 3"] circle')!;
  icon.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }),
  );
  await expect.element(page.getByRole("grid")).toHaveFocus();
  expect(active()?.getAttribute("data-astryx-row-id")).toBe("row-3");
  expect(active()?.getAttribute("aria-colindex")).toBe("2");
});

test.each([false, true])(
  "recycled menu ownership respects external focus: %s",
  async (externalFocus) => {
    const many = [
      columns[0],
      ...Array.from({ length: 40 }, (_, index) => ({
        ...columns[1],
        columnId: `COL_ID_CENTRE_${index}` as AstryxTableColumnId,
        headerName: `Centre ${index}`,
      })),
      columns[2],
    ] satisfies AstryxTableColumns<Row>;
    await mount("ltr", rows, many);
    const grid = page.getByRole("grid");
    grid.element().focus();
    await userEvent.keyboard("{ArrowRight}{ArrowUp}{Shift>}{F10}{/Shift}");
    await expect
      .element(page.getByRole("menuitem", { name: "Sort ascending", exact: true }))
      .toHaveFocus();
    const after = page.getByRole("button", { name: "After", exact: true });
    if (externalFocus) after.element().focus();
    grid.element().scrollLeft = grid.element().scrollWidth;
    await expect.poll(() => grid.element().scrollLeft).toBeGreaterThan(2500);
    await expect
      .poll(
        () =>
          page.getByRole("button", { name: "Centre 0 column menu", exact: true }).elements().length,
      )
      .toBe(0);
    await expect.element(externalFocus ? after : grid).toHaveFocus();
    expect(grid.element().scrollLeft).toBeGreaterThan(2500);
  },
);

test("live publications retain Active Cell identity and clamp a removed row", async () => {
  const view = (data: readonly Row[], version: number) => (
    <div style={{ width: 400 }}>
      <AstryxTableClient
        tableId="live-navigation"
        columns={columns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_A", direction: "asc" }]}
        clientSource={{ rows: data, totalRows: data.length, version, status: "ready" }}
      />
    </div>
  );
  const initial = rows.slice(0, 6);
  const screen = await render(view(initial, 1));
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{ArrowDown>3/}{ArrowRight}");
  await expect.poll(() => active()?.getAttribute("data-astryx-row-id")).toBe("row-3");
  const id = active()!.id;
  const changed = initial.map((row) => (row.id === "row-3" ? { ...row, value: -1 } : row));
  await screen.rerender(view(changed, 2));
  await expect.poll(() => active()?.textContent).toBe("-1");
  expect(active()?.id).toBe(id);
  expect(active()?.getAttribute("aria-colindex")).toBe("2");
  const remaining = changed.filter((row) => row.id !== "row-3");
  await screen.rerender(view(remaining, 3));
  await expect.poll(() => active()?.getAttribute("data-astryx-row-id")).toBe("row-0");
  expect(active()?.getAttribute("aria-colindex")).toBe("2");
  await screen.rerender(view([], 4));
  await expect.poll(active).toBeNull();
  await userEvent.keyboard("{ArrowUp}");
  await expect.poll(() => active()?.getAttribute("role")).toBe("columnheader");
  await expect.element(grid).toHaveFocus();
});

test.each(["ltr", "rtl"] as const)(
  "%s navigation crosses suspended pinned regions in both directions",
  async (direction) => {
    const definition = [
      columns[0],
      { ...columns[1], pinned: "start" },
      { ...columns[1], columnId: "COL_ID_D", headerName: "D" },
      columns[2],
    ] satisfies AstryxTableColumns<Row>;
    await mount(direction, rows, definition);
    const grid = page.getByRole("grid");
    await expect
      .poll(
        () =>
          getComputedStyle(page.getByRole("columnheader", { name: "A", exact: true }).element())
            .position,
      )
      .not.toBe("sticky");
    grid.element().focus();
    for (const column of [2, 3, 4, 3, 2, 1]) {
      await userEvent.keyboard(
        column > Number(active()?.getAttribute("aria-colindex")) ? "{ArrowRight}" : "{ArrowLeft}",
      );
      await expect.poll(() => active()?.getAttribute("aria-colindex")).toBe(String(column));
      await expect
        .poll(() => {
          const rect = active()!.getBoundingClientRect();
          const viewport = grid.element().getBoundingClientRect();
          return rect.left >= viewport.left - 1 && rect.right <= viewport.right + 1;
        })
        .toBe(true);
    }
    await userEvent.keyboard("{ArrowUp}{End}");
    await expect.poll(() => active()?.getAttribute("aria-label")).toBe("C");
    await userEvent.keyboard("{Home}");
    await expect.poll(() => active()?.getAttribute("aria-label")).toBe("A");
    await expect.element(grid).toHaveFocus();
  },
);

test("SVG controls share Tab, entry, Escape and recycled-focus ownership", async () => {
  await mount("ltr", rows, [
    {
      ...columns[0],
      cellRenderer: ({ value }: { value: unknown }) => (
        <svg width="30" height="20">
          <circle
            cx="10"
            cy="10"
            r="5"
            role="button"
            tabIndex={0}
            aria-label={`SVG action ${value}`}
          />
        </svg>
      ),
    },
    columns[1],
    columns[2],
  ]);
  const grid = page.getByRole("grid");
  const action = page.getByRole("button", { name: "SVG action 0", exact: true });
  await expect.element(action).toHaveAttribute("tabindex", "-1");
  grid.element().focus();
  await userEvent.keyboard("{Tab}");
  await expect.element(page.getByRole("button", { name: "After", exact: true })).toHaveFocus();
  grid.element().focus();
  await userEvent.keyboard("{F2}");
  await expect.element(action).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect.element(grid).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(action).toHaveFocus();
  grid.element().scrollTop = 2400;
  await expect.element(grid).toHaveFocus();
  expect(grid.element().scrollTop).toBeGreaterThan(2000);
});

test.each(["disabled", "hidden", "inert", "aria-hidden", "style"])(
  "unusable custom controls return focus after %s changes",
  async (attribute) => {
    await mount("ltr", rows.slice(0, 1), [
      {
        ...columns[0],
        cellRenderer: () => (
          <span>
            <button>Custom action</button>
          </span>
        ),
      },
      columns[1],
      columns[2],
    ]);
    const grid = page.getByRole("grid");
    grid.element().focus();
    await userEvent.keyboard("{Enter}");
    const control = page.getByRole("button", { name: "Custom action", exact: true }).element();
    expect(document.activeElement).toBe(control);
    const target = attribute === "disabled" ? control : control.parentElement!;
    target.setAttribute(
      attribute,
      attribute === "aria-hidden" ? "true" : attribute === "style" ? "visibility: hidden" : "",
    );
    await expect.element(grid).toHaveFocus();
    await userEvent.keyboard("{F2}");
    await expect.element(grid).toHaveFocus();
  },
);

test.each(["href", "contenteditable"])(
  "new %s focusability stays outside ordinary Tab order",
  async (attribute) => {
    await mount("ltr", rows.slice(0, 1), [
      { ...columns[0], cellRenderer: () => <a>Custom link</a> },
      columns[1],
      columns[2],
    ]);
    const link = page
      .getByRole("gridcell", { name: "Custom link", exact: true })
      .element()
      .querySelector("a")!;
    link.setAttribute(attribute, attribute === "href" ? "#example" : "true");
    await expect.poll(() => link.getAttribute("tabindex")).toBe("-1");
    page.getByRole("grid").element().focus();
    await userEvent.keyboard("{Tab}");
    await expect.element(page.getByRole("button", { name: "After", exact: true })).toHaveFocus();
  },
);

test("detached custom controls recover their latest authored tab index", async () => {
  await mount("ltr", rows.slice(0, 1), [
    { ...columns[0], cellRenderer: () => <button tabIndex={2}>Restored action</button> },
    columns[1],
    columns[2],
  ]);
  const action = page.getByRole("button", { name: "Restored action", exact: true }).element();
  await expect.poll(() => action.tabIndex).toBe(-1);
  action.setAttribute("tabindex", "3");
  await expect.poll(() => action.tabIndex).toBe(-1);
  action.remove();
  await expect.poll(() => action.tabIndex).toBe(3);
});

test("live conditional cell styling recovers focus from a newly hidden control", async () => {
  const definition = [
    {
      ...columns[0],
      cellClassName: ({ value }: { value: number }) =>
        value === 1 ? "navigation-hidden-cell" : undefined,
      cellRenderer: () => <button>Live custom action</button>,
    },
    columns[1],
    columns[2],
  ] satisfies AstryxTableColumns<Row>;
  const view = (value: number) => (
    <>
      <style>{".navigation-hidden-cell { visibility: hidden; }"}</style>
      <div style={{ width: 400 }}>
        <AstryxTableClient
          tableId="conditional-focus"
          columns={definition}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_A", direction: "asc" }]}
          clientSource={{
            rows: [{ id: "stable", value }],
            totalRows: 1,
            version: value + 1,
            status: "ready",
          }}
        />
      </div>
    </>
  );
  const screen = await render(view(0));
  const grid = page.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{Enter}");
  const action = page.getByRole("button", { name: "Live custom action", exact: true }).element();
  expect(document.activeElement).toBe(action);
  await screen.rerender(view(1));
  expect(action.isConnected).toBe(true);
  expect(getComputedStyle(action).visibility).toBe("hidden");
  await expect.element(grid, { timeout: 1500 }).toHaveFocus();
});

test.each(["ltr", "rtl"] as const)(
  "%s oversized columns reveal with the minimum delta from either side",
  async (direction) => {
    const oversized = [
      { ...columns[0], pinned: undefined, width: 1200 },
      { ...columns[1], width: 2000 },
      { ...columns[2], pinned: undefined, width: 2000 },
    ] satisfies AstryxTableColumns<Row>;
    await mount(direction, rows, oversized);
    const grid = page.getByRole("grid");
    await expect.element(page.getByRole("columnheader", { name: "A", exact: true })).toBeVisible();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    expect(grid.element().clientWidth).toBeLessThan(1200);
    expect(grid.element().scrollLeft).toBe(0);
    grid.element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => Math.abs(grid.element().scrollLeft)).toBe(1200);
    expect(active()?.getAttribute("aria-colindex")).toBe("2");
    grid.element().scrollLeft = direction === "rtl" ? -4000 : 4000;
    await expect.poll(() => Math.abs(grid.element().scrollLeft)).toBe(4000);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .poll(() => Math.abs(grid.element().scrollLeft))
      .toBe(Math.max(3200 - grid.element().clientWidth, 0));
    expect(active()?.getAttribute("aria-colindex")).toBe("2");
    expect(active()?.textContent).toBe("1");
    await expect.element(grid).toHaveFocus();
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s sticky header navigation preserves the manually scrolled body position",
  async (direction) => {
    await mount(direction);
    const grid = page.getByRole("grid");
    grid.element().focus();
    await expect.poll(() => active()?.getAttribute("role")).toBe("gridcell");
    grid.element().scrollTop = 720;
    await expect.poll(() => grid.element().scrollTop).toBe(720);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await userEvent.keyboard("{ArrowUp}{ArrowRight}");
    await expect.poll(() => active()?.getAttribute("role")).toBe("columnheader");
    expect(active()?.getAttribute("aria-colindex")).toBe("2");
    expect(grid.element().scrollTop).toBe(720);
    await expect.element(grid).toHaveFocus();
  },
);
