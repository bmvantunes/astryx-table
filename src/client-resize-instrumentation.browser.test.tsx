import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumnId,
  type AstryxTableColumns,
} from "../packages/table/src";
import {
  installAstryxTableClientColumnGestureFrameListener,
  installAstryxTableClientColumnGestureListener,
  installAstryxTableClientColumnPreviewStyleWriteListener,
  installAstryxTableClientViewRenderListenerForTable,
  installAstryxTableClientGridSurfaceRenderListenerForTable,
} from "../packages/table/src/internal/render-instrumentation";
import "./styles.css";

afterEach(cleanup);
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
test("coalesces resize work and cleans up its bounded listeners", async () => {
  type Row = { id: string; value: number };
  const columns = Array.from({ length: 150 }, (_, index) => ({
    columnId: `COL_ID_${index}` as AstryxTableColumnId,
    headerName: `Column ${index}`,
    field: "value" as const,
    valueType: "number" as const,
    width: 120,
    ...(index === 0
      ? { pinned: "start" as const }
      : index === 149
        ? { pinned: "end" as const }
        : {}),
  })) satisfies AstryxTableColumns<Row>;
  const rows = Array.from({ length: 5_000 }, (_, value) => ({ id: `row-${value}`, value }));
  const tableId = "resize-work";
  const phases: string[] = [];
  const listeners: string[] = [];
  let roots = 0;
  let surfaces = 0;
  let writes = 0;
  const remove = [
    installAstryxTableClientColumnGestureFrameListener(tableId, (event) =>
      phases.push(event.phase),
    ),
    installAstryxTableClientColumnGestureListener(tableId, (event) =>
      listeners.push(`${event.phase}:${event.event}`),
    ),
    installAstryxTableClientColumnPreviewStyleWriteListener(() => {
      writes++;
    }),
    installAstryxTableClientViewRenderListenerForTable(tableId, () => {
      roots++;
    }),
    installAstryxTableClientGridSurfaceRenderListenerForTable(tableId, () => {
      surfaces++;
    }),
  ];
  try {
    const screen = await render(
      <div style={{ width: 1024 }}>
        <AstryxTableClient
          tableId={tableId}
          columns={columns}
          getRowId={(row: Row) => row.id}
          initialOrderBy={[{ columnId: "COL_ID_0", direction: "asc" }]}
          clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
        />
      </div>,
    );
    for (let i = 0; i < 8; i++) await frame();
    const handle = page.getByRole("separator", { name: "Resize Column 0", exact: true }).element();
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 100, button: 0 }),
    );
    for (let i = 0; i < 4; i++) await frame();
    roots = surfaces = writes = 0;
    for (const clientX of [110, 120, 130, 140])
      window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX }));
    await frame();
    await frame();
    expect(phases).toEqual(["scheduled", "ran"]);
    expect(writes).toBeGreaterThan(0);
    expect(writes).toBeLessThanOrEqual(12);
    expect(roots).toBe(0);
    expect(surfaces).toBe(0);
    expect(page.getByRole("gridcell").elements().length).toBeLessThanOrEqual(33 * 37);
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 150 }));
    await screen.unmount();
    await frame();
    expect(phases).toEqual(["scheduled", "ran", "scheduled", "cancelled", "synchronous"]);
    expect(listeners).toEqual([
      "attach:pointermove",
      "attach:pointerup",
      "attach:pointercancel",
      "detach:pointermove",
      "detach:pointerup",
      "detach:pointercancel",
    ]);
  } finally {
    cleanup();
    for (const dispose of remove) dispose();
  }
});
