import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumns,
  type AstryxTableColumnId,
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
  { columnId: "COL_ID_A", headerName: "A", field: "value", valueType: "number", width: 120 },
  { columnId: "COL_ID_B", headerName: "B", field: "value", valueType: "number", width: 120 },
  {
    columnId: "COL_ID_END",
    headerName: "End",
    field: "value",
    valueType: "number",
    width: 120,
    pinned: "end",
  },
] as const satisfies AstryxTableColumns<Row>;
const rows = [{ id: "row-0", value: 1 }];
afterEach(cleanup);

async function mount(
  direction: "ltr" | "rtl",
  changes: unknown[],
  definition: AstryxTableColumns<Row> = columns,
  width = 640,
) {
  return render(
    <div dir={direction} style={{ width }}>
      <AstryxTableClient
        tableId="column-reorder"
        columns={definition}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
        clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        onPersistChange={(state) => changes.push(state)}
      />
    </div>,
  );
}

async function openMenu(name: string) {
  const trigger = page.getByRole("button", { name: `${name} column menu`, exact: true });
  await expect.element(trigger).toBeVisible();
  trigger.element().focus();
  await userEvent.keyboard("{Enter}");
  return trigger;
}

function headerOrder() {
  return Array.from(
    page.getByRole("grid").element().querySelectorAll('[role="columnheader"]'),
    (header) => header.getAttribute("aria-label"),
  );
}

test.each(["ltr", "rtl"] as const)(
  "%s moves a centre column through its native menu with one durable change",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    const trigger = await openMenu("A");
    const move = page.getByRole("menuitem", { name: "Move toward logical end", exact: true });
    await expect.element(move).toBeVisible();
    move.element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(headerOrder).toEqual(["Start", "B", "A", "End"]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      columnOrder: ["COL_ID_START", "COL_ID_B", "COL_ID_A", "COL_ID_END"],
      columnPinning: { start: ["COL_ID_START"], end: ["COL_ID_END"] },
    });
    await expect.element(trigger).toHaveFocus();
    await expect
      .element(page.getByRole("status", { name: "column-reorder interaction status" }))
      .toHaveTextContent("A position 3 of 4");
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s disables moves at each pinning boundary and updates after moving back",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    for (const name of ["Start", "End"]) {
      await openMenu(name);
      for (const edge of ["start", "end"]) {
        await expect
          .element(page.getByRole("menuitem", { name: `Move toward logical ${edge}`, exact: true }))
          .toHaveAttribute("aria-disabled", "true");
      }
      await userEvent.keyboard("{Escape}");
    }
    await openMenu("A");
    await expect
      .element(page.getByRole("menuitem", { name: "Move toward logical start", exact: true }))
      .toHaveAttribute("aria-disabled", "true");
    await page.getByRole("menuitem", { name: "Move toward logical end", exact: true }).click();
    await expect.poll(headerOrder).toEqual(["Start", "B", "A", "End"]);
    await openMenu("A");
    await expect
      .element(page.getByRole("menuitem", { name: "Move toward logical end", exact: true }))
      .toHaveAttribute("aria-disabled", "true");
    await page.getByRole("menuitem", { name: "Move toward logical start", exact: true }).click();
    await expect.poll(headerOrder).toEqual(["Start", "A", "B", "End"]);
    expect(changes).toHaveLength(2);
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s previews a column drag and commits the final pointer position once",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    const handle = page.getByRole("button", { name: "Reorder A", exact: true });
    await expect.element(handle).toBeVisible();
    const element = handle.element();
    const startRect = element.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const targetRect = page
      .getByRole("columnheader", { name: "B", exact: true })
      .element()
      .getBoundingClientRect();
    const targetX = direction === "ltr" ? targetRect.right - 8 : targetRect.left + 8;
    element.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, button: 0, clientX: startX }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 1,
        clientX: startX + (direction === "ltr" ? 20 : -20),
      }),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(changes).toHaveLength(0);
    const header = page.getByRole("columnheader", { name: "A", exact: true }).element();
    const cell = page
      .getByRole("grid")
      .element()
      .querySelector('[role="gridcell"][aria-colindex="2"]')!;
    expect(getComputedStyle(header).transform).not.toBe("none");
    expect(getComputedStyle(cell).transform).toBe(getComputedStyle(header).transform);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: targetX }));
    await expect.poll(headerOrder).toEqual(["Start", "B", "A", "End"]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      columnOrder: ["COL_ID_START", "COL_ID_B", "COL_ID_A", "COL_ID_END"],
      columnPinning: { start: ["COL_ID_START"], end: ["COL_ID_END"] },
    });
    await expect.element(handle).toHaveFocus();
    expect(getComputedStyle(header).transform).toBe("none");
  },
);

test.each([
  ["ltr", false],
  ["rtl", false],
  ["ltr", true],
  ["rtl", true],
] as const)(
  "%s autoscrolls past the mounted source and commits into the new column window (original X: %s)",
  async (direction, returnToOrigin) => {
    const changes: unknown[] = [];
    const many = [
      columns[0],
      ...Array.from({ length: 38 }, (_, i) => ({
        columnId: `COL_ID_CENTRE_${i}` as AstryxTableColumnId,
        headerName: `Centre ${i}`,
        field: "value" as const,
        valueType: "number" as const,
        width: 120,
      })),
      columns[3],
    ] satisfies AstryxTableColumns<Row>;
    await mount(direction, changes, many);
    const grid = page.getByRole("grid").element();
    const handle = page.getByRole("button", { name: "Reorder Centre 0", exact: true });
    await expect.element(handle).toBeVisible();
    const element = handle.element();
    const rect = element.getBoundingClientRect();
    const end = page
      .getByRole("columnheader", { name: "End", exact: true })
      .element()
      .getBoundingClientRect();
    const targetX = direction === "ltr" ? end.left - 8 : end.right + 8;
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 8,
        clientX: rect.left + rect.width / 2,
      }),
    );
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 8, clientX: targetX }));
    await expect.poll(() => Math.abs(grid.scrollLeft)).toBeGreaterThan(600);
    await expect.poll(() => element.isConnected).toBe(false);
    expect(changes).toHaveLength(0);
    expect(grid.querySelectorAll('[role="columnheader"]').length).toBeLessThanOrEqual(37);
    const bounds = grid.getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 8,
        clientX: returnToOrigin ? rect.left + rect.width / 2 : bounds.left + bounds.width / 2,
      }),
    );
    await expect.poll(() => changes.length).toBe(1);
    const saved = changes[0] as { columnOrder: string[]; columnPinning: unknown };
    expect(saved.columnOrder.indexOf("COL_ID_CENTRE_0")).toBeGreaterThan(4);
    expect(saved.columnPinning).toEqual({ start: ["COL_ID_START"], end: ["COL_ID_END"] });
    await expect.element(handle).toHaveFocus();
    await expect.element(handle).toBeVisible();
  },
);

async function beginDrag(name: string, pointerId = 21) {
  const handle = page.getByRole("button", { name: `Reorder ${name}`, exact: true });
  await expect.element(handle).toBeVisible();
  const target = handle.element();
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  target.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId, button: 0, clientX: x }),
  );
  return { target, x, pointerId };
}

test.each(["ltr", "rtl"] as const)(
  "%s commits order and pinning atomically across a sticky boundary",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    const { pointerId } = await beginDrag("A");
    const end = page
      .getByRole("columnheader", { name: "End", exact: true })
      .element()
      .getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId,
        clientX: direction === "ltr" ? end.right - 8 : end.left + 8,
      }),
    );
    await expect.poll(headerOrder).toEqual(["Start", "B", "End", "A"]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      columnOrder: ["COL_ID_START", "COL_ID_B", "COL_ID_END", "COL_ID_A"],
      columnPinning: { start: ["COL_ID_START"], end: ["COL_ID_END", "COL_ID_A"] },
    });
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s uses the centre fill gap as an unpin drop zone",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes);
    const { pointerId } = await beginDrag("End");
    const centre = page
      .getByRole("columnheader", { name: "B", exact: true })
      .element()
      .getBoundingClientRect();
    const end = page
      .getByRole("columnheader", { name: "End", exact: true })
      .element()
      .getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId,
        clientX:
          direction === "ltr" ? (centre.right + end.left) / 2 : (centre.left + end.right) / 2,
      }),
    );
    await expect.poll(() => changes.length).toBe(1);
    expect(changes[0]).toMatchObject({ columnPinning: { start: ["COL_ID_START"], end: [] } });
    expect(headerOrder()).toEqual(["Start", "A", "B", "End"]);
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s preserves source pinning while a centreless layout is suspended",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(
      direction,
      changes,
      [columns[0], { ...columns[1], pinned: "start" }, columns[3]],
      160,
    );
    const { pointerId } = await beginDrag("A");
    const start = page
      .getByRole("columnheader", { name: "Start", exact: true })
      .element()
      .getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId,
        clientX: direction === "ltr" ? start.left + 8 : start.right - 8,
      }),
    );
    await expect.poll(headerOrder).toEqual(["A", "Start", "End"]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      columnPinning: { start: ["COL_ID_A", "COL_ID_START"], end: ["COL_ID_END"] },
    });
  },
);

test.each(["pointercancel", "escape", "unmount", "noop"] as const)(
  "cleans up reorder on %s without persistence",
  async (ending) => {
    const changes: unknown[] = [];
    const screen = await mount("ltr", changes);
    const { pointerId, x } = await beginDrag("A");
    if (ending !== "noop") {
      window.dispatchEvent(new PointerEvent("pointermove", { pointerId, clientX: x + 40 }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    if (ending === "pointercancel")
      window.dispatchEvent(new PointerEvent("pointercancel", { pointerId }));
    if (ending === "escape") await userEvent.keyboard("{Alt>}{Shift>}{Escape}{/Shift}{/Alt}");
    if (ending === "unmount") await screen.unmount();
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId, clientX: ending === "noop" ? x : x + 200 }),
    );
    for (let frame = 0; frame < 6; frame++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(changes).toHaveLength(0);
    if (ending !== "unmount") {
      expect(headerOrder()).toEqual(["Start", "A", "B", "End"]);
      for (const header of page.getByRole("columnheader").elements())
        expect(getComputedStyle(header).transform).toBe("none");
    }
  },
);

test("does not take focus back from another header control after a drag", async () => {
  const changes: unknown[] = [];
  await mount("ltr", changes);
  const { pointerId, x } = await beginDrag("A");
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId, clientX: x + 180 }));
  const external = page.getByRole("button", { name: "Start column menu", exact: true });
  external.element().focus();
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId, clientX: x + 180 }));
  for (let frame = 0; frame < 6; frame++)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(changes).toHaveLength(1);
  await expect.element(external).toHaveFocus();
});

test.each(["value", "count", "stale"] as const)(
  "handles a %s source publication during reorder",
  async (change) => {
    const changes: unknown[] = [];
    const view = (updated: boolean) => {
      const nextRows =
        updated && change === "count"
          ? [...rows, { id: "row-1", value: 2 }]
          : updated
            ? [{ id: "row-0", value: 42 }]
            : rows;
      return (
        <div style={{ width: 640 }}>
          <AstryxTableClient
            tableId="column-reorder"
            columns={columns}
            getRowId={(row: Row) => row.id}
            initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
            clientSource={{
              rows: nextRows,
              totalRows: nextRows.length,
              version: updated ? 2 : 1,
              status: updated && change === "stale" ? "stale" : "ready",
            }}
            onPersistChange={(state) => changes.push(state)}
          />
        </div>
      );
    };
    const screen = await render(view(false));
    const { pointerId, x } = await beginDrag("A");
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId, clientX: x + 180 }));
    await screen.rerender(view(true));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId, clientX: x + 180 }));
    for (let frame = 0; frame < 6; frame++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(changes).toHaveLength(change === "value" ? 1 : 0);
    expect(headerOrder()).toEqual(
      change === "value" ? ["Start", "B", "A", "End"] : ["Start", "A", "B", "End"],
    );
  },
);

test.each([0, 1])(
  "keeps status announcements outside the grid's row ownership with %i rows",
  async (count) => {
    await render(
      <AstryxTableClient
        tableId="status-ownership"
        columns={columns}
        getRowId={(row: Row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_START", direction: "asc" }]}
        clientSource={{ rows: rows.slice(0, count), totalRows: count, version: 1, status: "ready" }}
      />,
    );
    const grid = page.getByRole("grid", { name: "status-ownership" }).element();
    const status = page
      .getByRole("status", { name: "status-ownership interaction status" })
      .element();
    expect(grid.contains(status)).toBe(false);
    if (count === 0)
      expect(
        grid.contains(
          page.getByRole("status", { name: "status-ownership status", exact: true }).element(),
        ),
      ).toBe(false);
    // Native controls may own status descendants inside a header cell.
    for (const nested of grid.querySelectorAll('[role="status"]'))
      expect(nested.closest('[role="columnheader"], [role="gridcell"]')).not.toBeNull();
    expect(status.closest("[data-astryx-table]")).toBe(grid.closest("[data-astryx-table]"));
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s preserves exact drop identity after autoscrolling variable-width columns",
  async (direction) => {
    const changes: unknown[] = [];
    const many = [
      columns[0],
      ...Array.from({ length: 58 }, (_, i) => ({
        columnId: `COL_ID_VAR_${i}` as AstryxTableColumnId,
        headerName: `Variable ${i}`,
        field: "value" as const,
        valueType: "number" as const,
        width: i % 2 === 0 ? 80 : 220,
      })),
      columns[3],
    ] satisfies AstryxTableColumns<Row>;
    await mount(direction, changes, many);
    const { pointerId, target } = await beginDrag("Variable 0");
    const grid = page.getByRole("grid").element();
    const startBounds = page
      .getByRole("columnheader", { name: "Start", exact: true })
      .element()
      .getBoundingClientRect();
    const endBounds = page
      .getByRole("columnheader", { name: "End", exact: true })
      .element()
      .getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId,
        clientX: direction === "ltr" ? endBounds.left - 8 : endBounds.right + 8,
      }),
    );
    // The retained header window is wider in pixels with these variable widths;
    // allow the real 64px/frame gesture to traverse it (not a performance gate).
    await expect.poll(() => target.isConnected, { timeout: 5_000 }).toBe(false);
    const left = direction === "ltr" ? startBounds.right : endBounds.right;
    const right = direction === "ltr" ? endBounds.left : startBounds.left;
    const destination = page
      .getByRole("columnheader")
      .elements()
      .flatMap((header) => {
        const name = header.getAttribute("aria-label")!;
        if (!name.startsWith("Variable ")) return [];
        const rect = header.getBoundingClientRect();
        const transform = getComputedStyle(header).transform;
        const offset = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
        const x = rect.left - offset + rect.width * (direction === "ltr" ? 0.75 : 0.25);
        return x > left + 48 && x < right - 48
          ? [{ name, x, index: Number(header.getAttribute("aria-colindex")) - 1 }]
          : [];
      })[0];
    expect(destination).toBeDefined();
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId, clientX: destination!.x }));
    await expect.poll(() => changes.length).toBe(1);
    const saved = changes[0] as { columnOrder: string[] };
    expect(saved.columnOrder[destination!.index]).toBe("COL_ID_VAR_0");
    expect(saved.columnOrder[destination!.index - 1]).toBe(
      `COL_ID_VAR_${destination!.name.slice("Variable ".length)}`,
    );
    await expect
      .element(page.getByRole("button", { name: "Reorder Variable 0", exact: true }))
      .toHaveFocus();
    const header = page
      .getByRole("columnheader", { name: "Variable 0", exact: true })
      .element()
      .getBoundingClientRect();
    const cell = grid
      .querySelector(`[role="gridcell"][aria-colindex="${destination!.index + 1}"]`)!
      .getBoundingClientRect();
    expect(Math.abs(cell.left - header.left)).toBeLessThan(1);
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s preserves a suspended pinned column on a stationary click",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes, columns, 160);
    const { pointerId, x } = await beginDrag("Start");
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId, clientX: x }));
    for (let frame = 0; frame < 6; frame++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(changes).toHaveLength(0);
    expect(headerOrder()).toEqual(["Start", "A", "B", "End"]);
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s preserves a suspended pinned column when released inside its own region",
  async (direction) => {
    const changes: unknown[] = [];
    await mount(direction, changes, columns, 160);
    const { pointerId, x } = await beginDrag("Start");
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId, clientX: x + (direction === "ltr" ? 2 : -2) }),
    );
    for (let frame = 0; frame < 6; frame++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(changes).toHaveLength(0);
    expect(headerOrder()).toEqual(["Start", "A", "B", "End"]);
  },
);

test.each(["ltr", "rtl"] as const)(
  "%s retains mixed-region semantics after centre columns leave the suspended window",
  async (direction) => {
    const changes: unknown[] = [];
    const many = [
      ...columns.slice(0, 3),
      ...Array.from({ length: 40 }, (_, i) => ({
        ...columns[3],
        columnId: `COL_ID_END_${i}` as AstryxTableColumnId,
        headerName: `End ${i}`,
      })),
    ] satisfies AstryxTableColumns<Row>;
    await mount(direction, changes, many, 280);
    const { pointerId } = await beginDrag("A");
    const grid = page.getByRole("grid").element();
    const bounds = grid.getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId,
        clientX: direction === "ltr" ? bounds.right - 8 : bounds.left + 8,
      }),
    );
    await expect.poll(() => headerOrder().includes("B"), { timeout: 5_000 }).toBe(false);
    window.dispatchEvent(
      new PointerEvent("pointerup", { pointerId, clientX: (bounds.left + bounds.right) / 2 }),
    );
    await expect.poll(() => changes.length).toBe(1);
    const saved = changes[0] as { columnPinning: { start: string[]; end: string[] } };
    expect(saved.columnPinning.end).toContain("COL_ID_A");
    expect(saved.columnPinning.start).toEqual(["COL_ID_START"]);
  },
);
