import { sumProductionFrameWork } from "./performance-frame-work";
import { Profiler, createElement } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";
import {
  captureAstryxTableReactCommitWork,
  finalizeAstryxTableBenchmarkEvidence,
} from "../packages/table/src/internal/benchmark-budget";
import { getAstryxTableBenchmarkEnvironment } from "../packages/table/src/internal/benchmark-profile";
import { measureMutationObserverWork } from "./performance-observers";
import "./styles.css";

afterEach(async () => {
  await cleanup();
});
const nativeFrame = window.requestAnimationFrame.bind(window);
const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
type Work = { callbackDurationMs: number; reactDurationMs: number };
type Row = { id: string; name: string };

test(
  "loading accounts for complete two-axis work with 5,000 candidate rows and 150 columns",
  { timeout: 30_000 },
  async ({ annotate }) => {
    expect(import.meta.env.MODE).toBe("production");
    expect(__ASTRYX_TABLE_DEVELOPMENT__).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(createElement("div"), "_store")).toBe(false);
    const getRowId = vi.fn((row: Row) => row.id);
    const renderValue = vi.fn(() => "Unconfirmed");
    const columns = Array.from({ length: 150 }, (_, index) => ({
      columnId: `COL_ID_C${index}` as Uppercase<`COL_ID_C${number}`>,
      headerName: `Column ${index}`,
      field: "name",
      valueType: "text",
      width: 120,
      cellRenderer: renderValue,
      ...(index === 0
        ? { pinned: "start" as const }
        : index === 149
          ? { pinned: "end" as const }
          : {}),
    })) satisfies AstryxTableColumns<Row>;
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: String(i), name: "Unconfirmed" }));
    let pending: Work | undefined;
    let scheduling: Work | undefined;
    let observations = 0;
    let recording = false;
    let profilerCalls = 0;
    let unownedReactCommits = 0;
    let unownedCallbacks = 0;
    const queuedFrames = new Set<number>();
    let restoreFrames: (() => void) | undefined;
    const observers = measureMutationObserverWork(() => {
      observations += 1;
    });
    try {
      await render(
        <Profiler
          id="loading"
          onRender={(_id, _phase, actualDuration, _baseDuration, startTime, commitTime) => {
            observations += 1;
            profilerCalls += 1;
            if (recording && pending === undefined) unownedReactCommits += 1;
            if (pending !== undefined)
              pending.reactDurationMs += captureAstryxTableReactCommitWork({
                actualDurationMs: actualDuration,
                commitTimeMs: commitTime,
                observedAtMs: performance.now(),
                startTimeMs: startTime,
              }).durationMs;
          }}
        >
          <div style={{ width: 1024 }}>
            <AstryxTableClient
              tableId="loading-production"
              columns={columns}
              getRowId={getRowId}
              initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
              clientSource={{ rows, totalRows: 5000, version: 1, status: "loading" }}
            />
          </div>
        </Profiler>,
      );
      const gridLocator = page.getByRole("grid", { name: "Loading table rows" });
      await expect.element(gridLocator).toBeVisible();
      await nextFrame();
      await nextFrame();
      const grid = gridLocator.element();
      expect(profilerCalls).toBeGreaterThan(0);
      expect(getRowId).not.toHaveBeenCalled();
      expect(renderValue).not.toHaveBeenCalled();
      const nativeCancel = window.cancelAnimationFrame.bind(window);
      const frameProbe = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          const request = nativeFrame((timestamp) => {
            queuedFrames.delete(request);
            observations += 1;
            const started = performance.now();
            try {
              callback(timestamp);
            } finally {
              if (recording && scheduling === undefined) unownedCallbacks += 1;
              if (scheduling !== undefined)
                scheduling.callbackDurationMs += performance.now() - started;
            }
          });
          queuedFrames.add(request);
          return request;
        });
      const cancellation = vi
        .spyOn(window, "cancelAnimationFrame")
        .mockImplementation((request) => {
          queuedFrames.delete(request);
          nativeCancel(request);
        });
      restoreFrames = () => {
        frameProbe.mockRestore();
        cancellation.mockRestore();
      };
      function captureInterval() {
        if (pending === undefined) throw new Error("Loading work has no owning sample");
        const duration =
          sumProductionFrameWork(pending.callbackDurationMs, pending.reactDurationMs) +
          observers.take();
        pending = { callbackDurationMs: 0, reactDurationMs: 0 };
        scheduling = pending;
        return duration;
      }
      const work: number[] = [];
      const cadence: number[] = [];
      const rowWindows = new Set<string>();
      const columnWindows = new Set<string>();
      await nextFrame();
      pending = { callbackDurationMs: 0, reactDurationMs: 0 };
      scheduling = pending;
      for (let sample = 0; sample < 112; sample += 1) {
        const warmup = sample < 12;
        if (sample === 12) recording = true;
        grid.scrollTop = warmup
          ? sample === 11
            ? 8656
            : (sample + 1) * 720
          : 8656 + (sample - 12) * 4;
        grid.scrollLeft = warmup
          ? sample === 11
            ? 2400
            : (sample + 1) * 72
          : 2400 + (sample - 12) * 4;
        const started = performance.now();
        grid.dispatchEvent(new Event("scroll"));
        const admission = performance.now() - started;
        const renderedAt = await nextFrame();
        let sampleWork = admission + captureInterval();
        const presentedAt = await nextFrame();
        sampleWork += captureInterval();
        cadence.push(presentedAt - renderedAt);
        await nextFrame();
        sampleWork += captureInterval();
        work.push(sampleWork);
        if (!warmup) {
          rowWindows.add(
            [...grid.querySelectorAll('[role="row"]')]
              .map((row) => row.getAttribute("aria-rowindex"))
              .join("|"),
          );
          columnWindows.add(
            [...grid.querySelector('[role="row"]')!.querySelectorAll('[role="gridcell"]')]
              .map((cell) => cell.getAttribute("aria-colindex"))
              .join("|"),
          );
        }
      }
      let quietFrames = 0;
      for (let frame = 0; frame < 120 && quietFrames < 2; frame += 1) {
        const before = observations;
        await nextFrame();
        work[work.length - 1]! += captureInterval();
        quietFrames = observations === before && queuedFrames.size === 0 ? quietFrames + 1 : 0;
      }
      expect(quietFrames).toBe(2);
      expect(unownedReactCommits).toBe(0);
      expect(unownedCallbacks).toBe(0);
      recording = false;
      expect(rowWindows.size).toBeGreaterThan(5);
      expect(columnWindows.size).toBeGreaterThan(2);
      expect(getRowId).not.toHaveBeenCalled();
      expect(renderValue).not.toHaveBeenCalled();
      expect(grid.querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(33);
      expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThanOrEqual(33 * 37);
      const left = page
        .getByRole("gridcell", { name: "Loading Column 0", exact: true })
        .nth(0)
        .element();
      const right = page
        .getByRole("gridcell", { name: "Loading Column 149", exact: true })
        .nth(0)
        .element();
      expect(
        Math.abs(left.getBoundingClientRect().left - grid.getBoundingClientRect().left),
      ).toBeLessThan(1);
      expect(
        Math.abs(right.getBoundingClientRect().right - grid.getBoundingClientRect().right),
      ).toBeLessThan(1);
      const environment = getAstryxTableBenchmarkEnvironment();
      const evidence = [
        finalizeAstryxTableBenchmarkEvidence(work, {
          environment,
          scenario: "client-loading-two-axis-work-5000x150",
          profile: "chromium-capable-hardware-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          maxDroppedFrameCount: 2,
        }),
        finalizeAstryxTableBenchmarkEvidence(cadence, {
          environment,
          scenario: "client-loading-two-axis-presentation-cadence-5000x150",
          profile: "chromium-production-presentation-cadence-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 20,
          droppedFrameThresholdMs: 20,
          maxDroppedFrameCount: 2,
        }),
      ];
      await annotate(
        JSON.stringify({ benchmark: "AstryxTable loading production evidence", evidence }),
        "benchmark",
      );
    } finally {
      observers.restore();
      restoreFrames?.();
      await cleanup();
    }
  },
);
