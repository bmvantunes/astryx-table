import { sumProductionFrameWork } from "./performance-frame-work";
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

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

test.for(["start", "end"] as const)(
  "accounts for complete %s resize work over 5,000 × 150 rows",
  { timeout: 30_000 },
  async (side, { annotate }) => {
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
    const tableId = `resize-performance-${side}`;
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
          <div style={{ width: 1024 }}>
            <AstryxTableClient
              tableId={tableId}
              columns={columns}
              getRowId={(row: Row) => row.id}
              initialOrderBy={[{ columnId: "COL_ID_0", direction: "asc" }]}
              clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
              onPersistChange={() => {
                commits++;
              }}
            />
          </div>
        </Profiler>,
      );
      for (let i = 0; i < 8; i++) await nextFrame();
      const grid = page.getByRole("grid", { name: tableId }).element();
      const name = `Column ${side === "start" ? 0 : 149}`;
      const handle = page.getByRole("separator", { name: `Resize ${name}`, exact: true }).element();
      const x = handle.getBoundingClientRect().left;
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
        const result =
          sumProductionFrameWork(interval.callbacks, interval.react) + observers.take();
        interval = { callbacks: 0, react: 0 };
        return result;
      };
      const samples: number[] = [];
      const cadence: number[] = [];
      recording = true;
      for (let sample = 0; sample < 112; sample++) {
        writes = 0;
        const started = performance.now();
        // Four pointer events share one preview frame; widths remain inside the
        // committed virtual window so ordinary resizing must not rerender the grid.
        for (let move = 0; move < 4; move++)
          window.dispatchEvent(
            new PointerEvent("pointermove", {
              pointerId: 31,
              clientX: x + 20 + (sample % 40) + move,
            }),
          );
        let work = performance.now() - started;
        const renderedAt = await nextFrame();
        work += capture();
        const presentedAt = await nextFrame();
        work += capture();
        await nextFrame();
        work += capture();
        samples.push(work);
        cadence.push(presentedAt - renderedAt);
        expect(writes).toBeGreaterThan(0);
        expect(writes).toBeLessThanOrEqual(12);
        expect(scheduled).toBe(sample + 1);
        expect(ran).toBe(sample + 1);
        expect(commits).toBe(0);
        expect(roots).toBe(0);
        expect(surfaces).toBe(0);
      }
      // Charge final commit, React work and all deferred cleanup to the last sample.
      const finishStarted = performance.now();
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 31, clientX: x + 80 }));
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
      expect(handle.getAttribute("aria-valuenow")).toBe("200");
      const header = page.getByRole("columnheader", { name, exact: true }).element();
      expect(header.getBoundingClientRect().width).toBe(200);
      for (const cell of grid.querySelectorAll(
        `[role="gridcell"][aria-colindex="${side === "start" ? 1 : 150}"]`,
      ))
        expect(
          Math.abs(cell.getBoundingClientRect().left - header.getBoundingClientRect().left),
        ).toBeLessThan(1);
      expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThanOrEqual(33 * 37);
      const environment = getAstryxTableBenchmarkEnvironment();
      const evidence = [
        finalizeAstryxTableBenchmarkEvidence(samples, {
          environment,
          scenario: `client-resize-${side}-work-5000x150`,
          profile: "chromium-capable-hardware-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          maxDroppedFrameCount: 2,
        }),
        finalizeAstryxTableBenchmarkEvidence(cadence, {
          environment,
          scenario: `client-resize-${side}-presentation-cadence-5000x150`,
          profile: "chromium-production-presentation-cadence-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 20,
          droppedFrameThresholdMs: 20,
          maxDroppedFrameCount: 2,
        }),
      ];
      await annotate(
        JSON.stringify({ benchmark: `AstryxTable ${side} resize production evidence`, evidence }),
        "benchmark",
      );
    } finally {
      observers.restore();
      recording = false;
      restoreFrames?.();
      await cleanup();
      for (const dispose of remove) dispose();
    }
  },
);
