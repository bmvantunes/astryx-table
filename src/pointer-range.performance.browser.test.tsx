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
  installAstryxTableClientViewRenderListenerForTable,
  installAstryxTableClientGridSurfaceRenderListenerForTable,
} from "../packages/table/src/internal/render-instrumentation";
import { installAstryxTableCellRangeInstrumentationListener } from "../packages/table/src/internal/cell-range-clipboard";
import "./styles.css";

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

test.for(["vertical", "horizontal"] as const)(
  "accounts for complete %s pointer-range autoscroll over 5,000 × 150 rows",
  { timeout: 30_000 },
  async (axis, { annotate }) => {
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
    const tableId = `pointer-range-performance-${axis}`;
    const nativeFrame = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
    const queued = new Set<number>();
    let recording = false;
    let interval = { callbacks: 0, react: 0 };
    let observations = 0;
    let roots = 0;
    let surfaces = 0;
    let pointerFrames = 0;
    let commits = 0;
    let restoreFrames: (() => void) | undefined;
    const remove = [
      installAstryxTableClientViewRenderListenerForTable(tableId, () => {
        roots++;
      }),
      installAstryxTableClientGridSurfaceRenderListenerForTable(tableId, () => {
        surfaces++;
      }),
      installAstryxTableCellRangeInstrumentationListener(tableId, (event) => {
        if (event.kind === "pointer-frame") pointerFrames++;
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
      const anchor = page
        .getByRole("gridcell", { name: "0", exact: true })
        .elements()
        .find((cell) => cell.getAttribute("aria-colindex") === "1")!;
      const bounds = grid.getBoundingClientRect();
      const anchorBounds = anchor.getBoundingClientRect();
      const start = {
        clientX: anchorBounds.left + anchorBounds.width / 2,
        clientY: anchorBounds.top + anchorBounds.height / 2,
      };
      anchor.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 31,
          button: 0,
          ...start,
        }),
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
        // React can commit outside RAF execution. Sum conservatively rather
        // than assume those intervals overlap and omit independent React work.
        const result = interval.callbacks + interval.react + observers.take();
        interval = { callbacks: 0, react: 0 };
        return result;
      };
      const samples: number[] = [];
      const cadence: number[] = [];
      let previousFrame = await nextFrame();
      let maximumHorizontalScroll = 0;
      recording = true;
      for (let sample = 0; sample < 224; sample++) {
        const started = performance.now();
        maximumHorizontalScroll = Math.max(maximumHorizontalScroll, Math.abs(grid.scrollLeft));
        // Coalesced input plus every automatic scroll, React and decoration frame
        // belongs to this workload. Horizontal reverses halfway to keep moving.
        const point =
          axis === "vertical"
            ? { clientX: start.clientX, clientY: bounds.bottom + 10 }
            : {
                clientX: sample < 112 ? bounds.right + 10 : bounds.left - 10,
                clientY: start.clientY,
              };
        for (let move = 0; move < 4; move++)
          window.dispatchEvent(
            new PointerEvent("pointermove", { pointerId: 31, cancelable: true, ...point }),
          );
        let work = performance.now() - started;
        const presentedAt = await nextFrame();
        work += capture();
        samples.push(work);
        cadence.push(presentedAt - previousFrame);
        previousFrame = presentedAt;
        expect(commits).toBe(0);
        expect(roots).toBe(0);
        expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThanOrEqual(33 * 37);
      }
      // Charge final commit, React work and all deferred cleanup to the last sample.
      const finishStarted = performance.now();
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerId: 31,
          ...(axis === "vertical"
            ? { clientX: start.clientX, clientY: bounds.bottom + 10 }
            : { clientX: bounds.left - 10, clientY: start.clientY }),
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
      expect(commits).toBe(0);
      expect(roots).toBe(0);
      expect(pointerFrames).toBeGreaterThanOrEqual(224);
      expect(surfaces).toBeLessThanOrEqual(224 + 3);
      if (axis === "vertical") {
        // 224 measured/warmup frames use the retained 12px autoscroll step.
        expect(grid.scrollTop).toBeGreaterThan(2500);
        expect(grid.scrollLeft).toBe(0);
      } else {
        expect(maximumHorizontalScroll).toBeGreaterThan(1000);
        expect(grid.scrollTop).toBe(0);
      }
      expect(
        grid.querySelectorAll('[role="gridcell"][aria-selected="true"]').length,
      ).toBeGreaterThan(0);
      expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThanOrEqual(33 * 37);
      const environment = getAstryxTableBenchmarkEnvironment();
      const evidence = [
        finalizeAstryxTableBenchmarkEvidence(samples, {
          environment,
          scenario: `client-pointer-range-${axis}-work-5000x150-pinned`,
          profile: "chromium-capable-hardware-v1",
          warmupSampleCount: 24,
          measuredSampleCount: 200,
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          maxDroppedFrameCount: 2,
        }),
        finalizeAstryxTableBenchmarkEvidence(cadence, {
          environment,
          scenario: `client-pointer-range-${axis}-presentation-cadence-5000x150-pinned`,
          profile: "chromium-production-presentation-cadence-v1",
          warmupSampleCount: 24,
          measuredSampleCount: 200,
          budgetMs: 20,
          droppedFrameThresholdMs: 20,
          maxDroppedFrameCount: 2,
        }),
      ];
      await annotate(
        JSON.stringify({
          benchmark: `AstryxTable ${axis} pointer-range production evidence`,
          evidence,
        }),
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
