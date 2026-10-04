import { measureMutationObserverWork } from "./performance-observers";
import { Profiler } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumnId,
  type AstryxTableColumns,
} from "../packages/table/src";
import {
  captureAstryxTableReactCommitWork,
  finalizeAstryxTableBenchmarkEvidence,
} from "../packages/table/src/internal/benchmark-budget";
import { getAstryxTableBenchmarkEnvironment } from "../packages/table/src/internal/benchmark-profile";
import {
  installAstryxTableClientColumnGestureFrameListener,
  installAstryxTableClientColumnPreviewStyleWriteListener,
  installAstryxTableClientViewRenderListenerForTable,
  installAstryxTableClientGridSurfaceRenderListenerForTable,
} from "../packages/table/src/internal/render-instrumentation";
import "./styles.css";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test.for(["preview", "autoscroll"] as const)(
  "accounts for complete %s reorder work over 5,000 × 150 rows",
  { timeout: 30_000 },
  async (mode, { annotate }) => {
    expect(import.meta.env.MODE).toBe("production");
    expect(__ASTRYX_TABLE_DEVELOPMENT__).toBe(false);
    expect(__ASTRYX_TABLE_TEST_DIAGNOSTICS__).toBe(true);
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
      ...(index === 3
        ? { cellRenderer: ({ value }: { value: number }) => <span>{value.toString()}</span> }
        : {}),
    })) satisfies AstryxTableColumns<Row>;
    const rows = Array.from({ length: 5_000 }, (_, value) => ({ id: `row-${value}`, value }));
    const tableId = `reorder-performance-${mode}`;
    // Full-range fractional scrolling can intersect one additional column.
    // 784px centre + two 32px scroll guards, intersected column, body overscan
    // (2 each side), header overscan (12 each side), and two pinned columns.
    // Existing raw/pinned scenario assertions remain unchanged.
    const maxMountedHeaders = Math.ceil((1024 - 240 + 64) / 120) + 1 + 4 + 24 + 2;
    const nativeFrame = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
    const queued = new Set<number>();
    let recording = false;
    let interval = { callbacks: 0, react: 0 };
    let observations = 0;
    let roots = 0;
    let surfaces = 0;
    let writes = 0;
    let scheduled = 0;
    let ran = 0;
    let commits = 0;
    let cancelled = 0;
    let persisted: unknown;
    let restoreFrames: (() => void) | undefined;
    const remove = [
      installAstryxTableClientViewRenderListenerForTable(tableId, () => {
        roots++;
      }),
      installAstryxTableClientGridSurfaceRenderListenerForTable(tableId, () => {
        surfaces++;
      }),
      installAstryxTableClientColumnPreviewStyleWriteListener(() => {
        writes++;
      }),
      installAstryxTableClientColumnGestureFrameListener(tableId, (event) => {
        if (event.phase === "scheduled") scheduled++;
        if (event.phase === "ran") ran++;
        if (event.phase === "cancelled") cancelled++;
      }),
    ];
    const observers = measureMutationObserverWork();
    try {
      await render(
        <Profiler
          id={tableId}
          onRender={(_id, _phase, actualDuration, _base, startTime, commitTime) => {
            observations++;
            if (recording)
              interval.react += captureAstryxTableReactCommitWork({
                actualDurationMs: actualDuration,
                startTimeMs: startTime,
                commitTimeMs: commitTime,
                observedAtMs: performance.now(),
              }).durationMs;
          }}
        >
          <div dir={mode === "autoscroll" ? "rtl" : "ltr"} style={{ width: 1024 }}>
            <AstryxTableClient
              tableId={tableId}
              columns={columns}
              getRowId={(row: Row) => row.id}
              initialOrderBy={[{ columnId: "COL_ID_0", direction: "asc" }]}
              clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
              onPersistChange={(state) => {
                persisted = state;
                commits++;
              }}
            />
          </div>
        </Profiler>,
      );
      for (let i = 0; i < 8; i++) await nextFrame();
      const grid = page.getByRole("grid", { name: tableId }).element();
      const name = "Column 3";
      const handle = page.getByRole("button", { name: `Reorder ${name}`, exact: true }).element();
      const x = handle.getBoundingClientRect().left + handle.getBoundingClientRect().width / 2;
      const pinnedEnd = page
        .getByRole("columnheader", { name: "Column 149", exact: true })
        .element()
        .getBoundingClientRect();
      const edgeX = pinnedEnd.right + 8;
      handle.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerId: 31, button: 0, clientX: x }),
      );
      for (let i = 0; i < 4; i++) await nextFrame();
      roots = surfaces = 0;
      const requestProbe = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          const id = nativeFrame((time) => {
            queued.delete(id);
            observations++;
            const started = performance.now();
            try {
              callback(time);
            } finally {
              if (recording) interval.callbacks += performance.now() - started;
            }
          });
          queued.add(id);
          return id;
        });
      const cancelProbe = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
        queued.delete(id);
        nativeCancel(id);
      });
      restoreFrames = () => {
        requestProbe.mockRestore();
        cancelProbe.mockRestore();
      };
      const capture = () => {
        const result = Math.max(interval.callbacks, interval.react) + observers.take();
        interval = { callbacks: 0, react: 0 };
        return result;
      };
      const samples: number[] = [];
      const cadence: number[] = [];
      let previousFrame = await nextFrame();
      recording = true;
      for (let sample = 0; sample < 112; sample++) {
        writes = 0;
        const started = performance.now();
        // Coalesced pointer moves plus every automatic scroll/React frame are
        // charged to this sample. The RTL path crosses multiple virtual windows.
        for (let move = 0; move < 4; move++)
          window.dispatchEvent(
            new PointerEvent("pointermove", {
              pointerId: 31,
              clientX: mode === "preview" ? x + 180 + (sample % 10) + move : edgeX + move,
            }),
          );
        let work = performance.now() - started;
        const renderedAt = await nextFrame();
        work += capture();
        samples.push(work);
        cadence.push(renderedAt - previousFrame);
        previousFrame = renderedAt;
        // At most one removal and one write per mounted column, per frame.
        expect(writes).toBeLessThanOrEqual(2 * maxMountedHeaders);
        expect(ran).toBeGreaterThan(0);
        expect(scheduled - ran - cancelled).toBeLessThanOrEqual(1);
        expect(grid.querySelectorAll('[role="columnheader"]').length).toBeLessThanOrEqual(
          maxMountedHeaders,
        );
        expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThanOrEqual(33 * 37);
        expect(commits).toBe(0);
        expect(roots).toBe(0);
        expect(surfaces).toBe(0);
      }
      // Charge final commit, React work and all deferred cleanup to the last sample.
      const finishStarted = performance.now();
      const bounds = grid.getBoundingClientRect();
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerId: 31,
          clientX: mode === "preview" ? x + 190 : bounds.left + bounds.width / 2,
        }),
      );
      samples[samples.length - 1]! += performance.now() - finishStarted;
      let quiet = 0;
      for (let frame = 0; frame < 120 && quiet < 2; frame++) {
        const before = observations;
        await nextFrame();
        samples[samples.length - 1]! += capture();
        quiet = observations === before && queued.size === 0 ? quiet + 1 : 0;
      }
      recording = false;
      expect(quiet).toBe(2);
      expect(commits).toBe(1);
      expect(scheduled).toBe(ran + cancelled);
      const saved = persisted as { columnOrder: string[]; columnPinning: unknown };
      const destination = saved.columnOrder.indexOf("COL_ID_3");
      expect(destination).toBeGreaterThan(mode === "preview" ? 3 : 20);
      expect(saved.columnPinning).toEqual({ start: ["COL_ID_0"], end: ["COL_ID_149"] });
      await expect
        .element(page.getByRole("button", { name: `Reorder ${name}`, exact: true }))
        .toHaveFocus();
      const header = page.getByRole("columnheader", { name, exact: true }).element();
      expect(getComputedStyle(header).transform).toBe("none");
      for (const cell of grid.querySelectorAll(
        `[role="gridcell"][aria-colindex="${destination + 1}"]`,
      )) {
        expect(
          Math.abs(cell.getBoundingClientRect().left - header.getBoundingClientRect().left),
        ).toBeLessThan(1);
        expect(getComputedStyle(cell).transform).toBe("none");
      }
      const environment = getAstryxTableBenchmarkEnvironment();
      const evidence = [
        finalizeAstryxTableBenchmarkEvidence(samples, {
          environment,
          scenario: `client-reorder-${mode}-work-5000x150`,
          profile: "chromium-capable-hardware-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          maxDroppedFrameCount: 2,
        }),
        finalizeAstryxTableBenchmarkEvidence(cadence, {
          environment,
          scenario: `client-reorder-${mode}-presentation-cadence-5000x150`,
          profile: "chromium-production-presentation-cadence-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 20,
          droppedFrameThresholdMs: 20,
          maxDroppedFrameCount: 2,
        }),
      ];
      await annotate(
        JSON.stringify({ benchmark: `AstryxTable ${mode} reorder production evidence`, evidence }),
        "benchmark",
      );
    } finally {
      observers.restore();
      recording = false;
      restoreFrames?.();
      cleanup();
      for (const dispose of remove) dispose();
    }
  },
);
