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
    columnId: "COL_ID_START",
    headerName: "Start",
    field: "value",
    valueType: "number",
    width: 120,
    pinned: "start",
  },
  {
    columnId: "COL_ID_CENTRE",
    headerName: "Centre",
    field: "value",
    valueType: "number",
    width: 240,
  },
  {
    columnId: "COL_ID_END",
    headerName: "End",
    field: "value",
    valueType: "number",
    width: 120,
    pinned: "end",
  },
] as const satisfies AstryxTableColumns<Row>;
const rows = Array.from({ length: 100 }, (_, value) => ({ id: `row-${value}`, value }));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function settle() {
  for (let i = 0; i < 8; i++) await frame();
}
afterEach(cleanup);

async function mount(direction: "ltr" | "rtl", changes: unknown[]) {
  const screen = await render(
    <div dir={direction} style={{ width: 640 }}>
      <AstryxTableClient
        tableId="column-resize"
        columns={columns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        onPersistChange={(state) => changes.push(state)}
      />
    </div>,
  );
  await settle();
  return screen;
}

test.each(["ltr", "rtl"] as const)(
  "%s resizes through native handles with exact keyboard commits",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    const handle = page.getByRole("separator", { name: "Resize Start", exact: true });
    await expect.element(handle).toBeVisible();
    handle.element().focus();
    await userEvent.keyboard(direction === "ltr" ? "{ArrowRight}" : "{ArrowLeft}");
    await expect.element(handle).toHaveAttribute("aria-valuenow", "130");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ columnWidths: { COL_ID_START: 130 } });
    await userEvent.keyboard("{Home}");
    await expect.element(handle).toHaveAttribute("aria-valuenow", "32");
    await userEvent.keyboard("{End}");
    await expect.element(handle).toHaveAttribute("aria-valuenow", "1000");
    expect(changes).toHaveLength(3);
    await userEvent.keyboard(direction === "ltr" ? "{ArrowRight}" : "{ArrowLeft}");
    expect(changes).toHaveLength(3);
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s previews a pointer resize without persistence and cancels cleanly",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    const handle = page.getByRole("separator", { name: "Resize Start", exact: true });
    await expect.element(handle).toBeVisible();
    const element = handle.element();
    const start = element.getBoundingClientRect().left;
    const target = start + (direction === "ltr" ? 40 : -40);
    element.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, button: 0, clientX: start }),
    );
    for (let i = 1; i <= 4; i++)
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: start + ((target - start) * i) / 4,
        }),
      );
    await settle();
    await expect.element(handle).toHaveAttribute("aria-valuenow", "160");
    expect(changes).toHaveLength(0);
    const header = page.getByRole("columnheader", { name: "Start", exact: true }).element();
    expect(header.getBoundingClientRect().width).toBe(160);
    const cells = page
      .getByRole("grid")
      .element()
      .querySelectorAll('[role="gridcell"][aria-colindex="1"]');
    for (const cell of cells) expect(cell.getBoundingClientRect().width).toBe(160);
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));
    await settle();
    expect(changes).toHaveLength(0);
    expect(header.getBoundingClientRect().width).toBe(120);
    await expect.element(handle).toHaveAttribute("aria-valuenow", "120");
    element.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 2, button: 0, clientX: start }),
    );
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, clientX: target }));
    await settle();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ columnWidths: { COL_ID_START: 160 } });
  },
);

function beginResize(name: string, pointerId: number) {
  const element = page.getByRole("separator", { name, exact: true }).element();
  const x = element.getBoundingClientRect().left;
  element.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId, button: 0, clientX: x }),
  );
  return { element, x };
}

test("modified Escape cancels a pending frame and prevents a later pointerup commit", async () => {
  const changes: unknown[] = [];
  await mount("ltr", changes);
  const { x } = beginResize("Resize Start", 7);
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7, clientX: x + 40 }));
  await userEvent.keyboard("{Alt>}{Shift>}{Escape}{/Shift}{/Alt}");
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, clientX: x + 80 }));
  await settle();
  expect(changes).toHaveLength(0);
  await expect
    .element(page.getByRole("separator", { name: "Resize Start" }))
    .toHaveAttribute("aria-valuenow", "120");
  await expect
    .element(page.getByRole("status", { name: "column-resize interaction status" }))
    .toHaveTextContent("Column layout change cancelled");
});

test("unmount cancels pointer work without persisting a width", async () => {
  const changes: unknown[] = [];
  const screen = await mount("ltr", changes);
  const { x } = beginResize("Resize End", 9);
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 9, clientX: x + 40 }));
  await screen.unmount();
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 9, clientX: x + 80 }));
  await settle();
  expect(changes).toHaveLength(0);
});

test.each(["ltr", "rtl"] as const)(
  "%s previews the end boundary and commits once",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    const { x } = beginResize("Resize End", 4);
    const target = x + (direction === "ltr" ? 40 : -40);
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 4, clientX: target }));
    await settle();
    expect(changes).toHaveLength(0);
    const grid = page.getByRole("grid").element();
    const header = page.getByRole("columnheader", { name: "End", exact: true }).element();
    expect(header.getBoundingClientRect().width).toBe(160);
    for (const cell of grid.querySelectorAll('[role="gridcell"][aria-colindex="3"]')) {
      expect(cell.getBoundingClientRect().width).toBe(160);
      expect(
        Math.abs(cell.getBoundingClientRect().left - header.getBoundingClientRect().left),
      ).toBeLessThan(1);
    }
    const boundary = direction === "ltr" ? "right" : "left";
    expect(
      Math.abs(header.getBoundingClientRect()[boundary] - grid.getBoundingClientRect()[boundary]),
    ).toBeLessThan(3);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 4, clientX: target }));
    await settle();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ columnWidths: { COL_ID_END: 160 } });
  },
);

test("a preview may suspend pinning and restore it on cancellation", async () => {
  const changes: unknown[] = [];
  await mount("ltr", changes);
  const { x } = beginResize("Resize Start", 12);
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 12, clientX: x + 420 }));
  await settle();
  const header = page.getByRole("columnheader", { name: "Start", exact: true }).element();
  expect(header.getBoundingClientRect().width).toBe(540);
  expect(getComputedStyle(header).position).not.toBe("sticky");
  expect(changes).toHaveLength(0);
  window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 12 }));
  await settle();
  expect(header.getBoundingClientRect().width).toBe(120);
  expect(getComputedStyle(header).position).toBe("sticky");
  expect(changes).toHaveLength(0);
});

test("same-shape live rows preserve resize but source staleness cancels it", async () => {
  const changes: unknown[] = [];
  const view = (version: number, status: "ready" | "stale") => (
    <div style={{ width: 640 }}>
      <AstryxTableClient
        tableId="live-resize"
        columns={columns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
        clientSource={{
          rows: rows.map((row) => ({ ...row, value: row.value + version })),
          totalRows: rows.length,
          version,
          status,
        }}
        onPersistChange={(state) => changes.push(state)}
      />
    </div>
  );
  const screen = await render(view(1, "ready"));
  await settle();
  const { x } = beginResize("Resize Start", 14);
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 14, clientX: x + 40 }));
  await settle();
  await screen.rerender(view(2, "ready"));
  await settle();
  await expect
    .element(page.getByRole("separator", { name: "Resize Start" }))
    .toHaveAttribute("aria-valuenow", "160");
  expect(changes).toHaveLength(0);
  await screen.rerender(view(3, "stale"));
  await settle();
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 14, clientX: x + 80 }));
  await expect
    .element(page.getByRole("separator", { name: "Resize Start" }))
    .toHaveAttribute("aria-valuenow", "120");
  expect(changes).toHaveLength(0);
});

test.each(["input", "contenteditable"] as const)(
  "preserves Alt+Arrow ownership inside a custom %s",
  async (kind) => {
    const changes: unknown[] = [];
    const customColumns = columns.map((column, index) =>
      index === 1
        ? {
            ...column,
            cellRenderer: () =>
              kind === "input" ? (
                <input aria-label="Cell note" />
              ) : (
                <div
                  role="textbox"
                  aria-label="Cell note"
                  contentEditable
                  suppressContentEditableWarning
                />
              ),
          }
        : column,
    );
    await render(
      <div style={{ width: 640 }}>
        <AstryxTableClient
          tableId="input-resize"
          columns={customColumns}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
          clientSource={{ rows: rows.slice(0, 1), totalRows: 1, version: 1, status: "ready" }}
          onPersistChange={(state) => changes.push(state)}
        />
      </div>,
    );
    await settle();
    page.getByRole("separator", { name: "Resize Start", exact: true }).element().focus();
    const input = page.getByRole("textbox", { name: "Cell note" }).element();
    input.focus();
    const inputKey = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowRight",
      altKey: true,
    });
    input.dispatchEvent(inputKey);
    await settle();
    expect(inputKey.defaultPrevented).toBe(false);
    expect(changes).toHaveLength(0);
    await expect
      .element(page.getByRole("separator", { name: "Resize Start" }))
      .toHaveAttribute("aria-valuenow", "120");
    const grid = page.getByRole("grid", { name: "input-resize" }).element();
    grid.focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await expect
      .element(page.getByRole("separator", { name: "Resize Start" }))
      .toHaveAttribute("aria-valuenow", "130");
    expect(changes).toHaveLength(1);
  },
);

test("a ready source row-count change cancels its active width preview", async () => {
  const changes: unknown[] = [];
  const view = (count: number) => (
    <div style={{ width: 640 }}>
      <AstryxTableClient
        tableId="shape-resize"
        columns={columns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
        clientSource={{
          rows: rows.slice(0, count),
          totalRows: count,
          version: count,
          status: "ready",
        }}
        onPersistChange={(state) => changes.push(state)}
      />
    </div>
  );
  const screen = await render(view(50));
  await settle();
  const { x } = beginResize("Resize Start", 18);
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 18, clientX: x + 40 }));
  await settle();
  await screen.rerender(view(51));
  await settle();
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 18, clientX: x + 80 }));
  await settle();
  expect(changes).toHaveLength(0);
  await expect
    .element(page.getByRole("separator", { name: "Resize Start" }))
    .toHaveAttribute("aria-valuenow", "120");
});

test("a sort query change cancels resize without persisting its preview", async () => {
  const changes: unknown[] = [];
  await mount("ltr", changes);
  const { x } = beginResize("Resize Start", 19);
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 19, clientX: x + 40 }));
  await settle();
  await page.getByRole("button", { name: "Start column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sort descending", exact: true }).click();
  await settle();
  expect(changes).toHaveLength(1);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 19, clientX: x + 80 }));
  await settle();
  expect(changes).toHaveLength(1);
  await expect
    .element(page.getByRole("separator", { name: "Resize Start" }))
    .toHaveAttribute("aria-valuenow", "120");
});

test("shrinking a wide centre column exposes and aligns the previously virtual columns", async () => {
  const wideColumns = Array.from({ length: 40 }, (_, index) => ({
    columnId: `COL_ID_WIDE_${index}` as AstryxTableColumnId,
    headerName: `Wide ${index}`,
    field: "value" as const,
    valueType: "number" as const,
    width: index === 0 ? 1000 : 120,
  })) satisfies AstryxTableColumns<Row>;
  const changes: unknown[] = [];
  await render(
    <div style={{ width: 640 }}>
      <AstryxTableClient
        tableId="wide-resize"
        columns={wideColumns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_WIDE_0", direction: "asc" }]}
        clientSource={{ rows: rows.slice(0, 1), totalRows: 1, version: 1, status: "ready" }}
        onPersistChange={(state) => changes.push(state)}
      />
    </div>,
  );
  await settle();
  const { x } = beginResize("Resize Wide 0", 22);
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 22, clientX: x - 900 }));
  await settle();
  expect(changes).toHaveLength(0);
  const grid = page.getByRole("grid", { name: "wide-resize" }).element();
  for (let index = 0; index < 5; index++) {
    const header = page.getByRole("columnheader", { name: `Wide ${index}`, exact: true }).element();
    const cell = grid.querySelector(`[role="gridcell"][aria-colindex="${index + 1}"]`)!;
    expect(cell).not.toBeNull();
    expect(
      Math.abs(header.getBoundingClientRect().left - cell.getBoundingClientRect().left),
    ).toBeLessThan(1);
    expect(cell.getBoundingClientRect().left).toBeLessThan(grid.getBoundingClientRect().right);
  }
  expect(page.getByRole("columnheader").elements().length).toBeLessThan(40);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 22, clientX: x - 900 }));
  await settle();
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ columnWidths: { COL_ID_WIDE_0: 100 } });
});

test("modified Escape respects sibling table toolbar ownership", async () => {
  const changes: unknown[] = [];
  await render(
    <>
      {["one", "two"].map((id) => (
        <div key={id} style={{ width: 640 }}>
          <AstryxTableClient
            tableId={id}
            columns={columns}
            getRowId={(row: Row) => row.id}
            initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
            clientSource={{ rows: rows.slice(0, 1), totalRows: 1, version: 1, status: "ready" }}
            onPersistChange={(state) => changes.push(state)}
          >
            <button type="button">Action {id}</button>
          </AstryxTableClient>
        </div>
      ))}
    </>,
  );
  await settle();
  const handle = page
    .getByRole("grid", { name: "one", exact: true })
    .getByRole("separator", { name: "Resize Start", exact: true });
  const x = handle.element().getBoundingClientRect().left;
  handle
    .element()
    .dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 24, button: 0, clientX: x }),
    );
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 24, clientX: x + 40 }));
  await settle();
  page.getByRole("button", { name: "Action two", exact: true }).element().focus();
  await userEvent.keyboard("{Alt>}{Escape}{/Alt}");
  await expect.element(handle).toHaveAttribute("aria-valuenow", "160");
  const ownerAction = page.getByRole("button", { name: "Action one", exact: true });
  ownerAction.element().focus();
  await userEvent.keyboard("{Alt>}{Escape}{/Alt}");
  await expect.element(handle).toHaveAttribute("aria-valuenow", "120");
  await expect.element(ownerAction).toHaveFocus();
  expect(changes).toHaveLength(0);
});
