import { createElement, Profiler } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { Schema } from "effect";
import { ViewServerId, defineViewServerConfig } from "effect-view-server/config";
import { createViewServerReact } from "effect-view-server/react";
import { AstryxTableServer, type AstryxTableColumns } from "../packages/table/src";
import {
  captureAstryxTableReactCommitWork,
  finalizeAstryxTableBenchmarkEvidence,
} from "../packages/table/src/internal/benchmark-budget";
import { getAstryxTableBenchmarkEnvironment } from "../packages/table/src/internal/benchmark-profile";
import {
  installAstryxTableClientViewRenderListenerForTable,
  installAstryxTableClientGridSurfaceRenderListenerForTable,
} from "../packages/table/src/internal/render-instrumentation";
import { measureMutationObserverWork } from "./performance-observers";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; amount: number };
type Window = { firstRow: number; lastRow: number };
type Request = {
  window: Window;
  query: unknown;
  sink: {
    setRowCount: (count: number, retain?: boolean) => void;
    setRowData: (
      rows: Readonly<Record<number, Row>>,
      keys: Readonly<Record<number, string>>,
    ) => void;
  };
};
const binding = createViewServerReact(
  defineViewServerConfig({
    topics: {
      orders: {
        schema: Schema.Struct({ id: ViewServerId, name: Schema.String, amount: Schema.Number }),
      },
    },
  }),
);
type Source = ReturnType<typeof binding.useLiveQueryViewport>;
const columns = [
  {
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    valueType: "text",
    width: 120,
    pinned: "start",
  },
  ...Array.from({ length: 149 }, (_, index) => ({
    columnId: `COL_ID_AMOUNT_${index}` as Uppercase<`COL_ID_AMOUNT_${number}`>,
    headerName: `Amount ${index}`,
    field: "amount" as const,
    valueType: "number" as const,
    width: 120,
    ...(index === 148 ? { pinned: "end" as const } : {}),
  })),
] as const satisfies AstryxTableColumns<Row>;
const nativeFrame = window.requestAnimationFrame.bind(window);
const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
function sourceFixture() {
  const requests: Request[] = [];
  const windows: Window[] = [];
  const release = vi.fn();
  const viewport = {
    semanticKey: (query: unknown) => JSON.stringify(query),
    replace(request: Request) {
      requests.push(request);
      windows.push(request.window);
      request.sink.setRowCount(5000, true);
      return { setWindow: (window: Window) => windows.push(window), release };
    },
  } as unknown as Omit<Source["viewport"], "destroy">;
  return {
    requests,
    windows,
    release,
    source: {
      viewport,
      completeRawSelect: ["id", "name", "amount"] as unknown as Source["completeRawSelect"],
      useWholeResult: () => ({ rows: [], totalRows: 0, version: 1, status: "ready" as const }),
      totalRows: 5000,
      version: 1,
      status: "ready" as const,
    },
  };
}
function publishWindow(request: Request, next: Window, previous?: Window) {
  const rows: Record<number, Row> = {};
  const keys: Record<number, string> = {};
  for (let index = next.firstRow; index <= next.lastRow; index++) {
    if (previous !== undefined && index >= previous.firstRow && index <= previous.lastRow) continue;
    rows[index] = { id: `raw-${index}`, name: `Record ${index}`, amount: index };
    keys[index] = `source-${index}`;
  }
  request.sink.setRowData(rows, keys);
  return Object.keys(rows).length;
}
type Work = { callback: number; react: number; commits: number };

test.for(["scroll", "delivery"] as const)(
  "Server budgets complete sparse %s work with 5,000 × 150 pinned cells",
  { timeout: 30_000 },
  async (mode, { annotate }) => {
    expect(import.meta.env.MODE).toBe("production");
    expect(__ASTRYX_TABLE_DEVELOPMENT__).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(createElement("div"), "_store")).toBe(false);
    const f = sourceFixture();
    const tableId = `server-production-${mode}`;
    let pending: Work | undefined;
    let recording = false;
    let observations = 0;
    let unownedCommits = 0;
    let unownedCallbacks = 0;
    let profilerCalls = 0;
    let restoreFrames: (() => void) | undefined;
    const queued = new Set<number>();
    const observers = measureMutationObserverWork(() => {
      observations++;
    });
    const removeListeners: (() => void)[] = [];
    try {
      await render(
        <Profiler
          id={tableId}
          onRender={(_id, _phase, actualDuration, _baseDuration, startTime, commitTime) => {
            observations++;
            profilerCalls++;
            if (recording && pending === undefined) unownedCommits++;
            if (pending !== undefined) {
              pending.commits++;
              pending.react += captureAstryxTableReactCommitWork({
                actualDurationMs: actualDuration,
                commitTimeMs: commitTime,
                observedAtMs: performance.now(),
                startTimeMs: startTime,
              }).durationMs;
            }
          }}
        >
          <div style={{ width: 1200 }}>
            <AstryxTableServer
              tableId={tableId}
              columns={columns}
              initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
              viewportSource={f.source}
            />
          </div>
        </Profiler>,
      );
      const gridLocator = page.getByRole("grid", { name: tableId });
      await expect.element(gridLocator).toBeVisible();
      const grid = gridLocator.element();
      const request = f.requests[0]!;
      let delivered = f.windows.at(-1)!;
      publishWindow(request, delivered);
      await nextFrame();
      await nextFrame();
      if (mode === "delivery") {
        grid.scrollTop = 4000 * 36;
        grid.scrollLeft = 7200;
        grid.dispatchEvent(new Event("scroll"));
        await nextFrame();
        await nextFrame();
        delivered = f.windows.at(-1)!;
        publishWindow(request, delivered);
        await expect
          .element(page.getByRole("gridcell", { name: "Record 4000", exact: true }))
          .toBeVisible();
        await nextFrame();
        await nextFrame();
      }
      expect(profilerCalls).toBeGreaterThan(0);
      const viewCommits = vi.fn();
      const surfaceCommits = vi.fn();
      removeListeners.push(
        installAstryxTableClientViewRenderListenerForTable(tableId, viewCommits),
        installAstryxTableClientGridSurfaceRenderListenerForTable(tableId, surfaceCommits),
      );
      const nativeCancel = window.cancelAnimationFrame.bind(window);
      const frameProbe = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          const requestId = nativeFrame((timestamp) => {
            queued.delete(requestId);
            observations++;
            const start = performance.now();
            try {
              callback(timestamp);
            } finally {
              if (recording && pending === undefined) unownedCallbacks++;
              if (pending !== undefined) pending.callback += performance.now() - start;
            }
          });
          queued.add(requestId);
          return requestId;
        });
      const cancelProbe = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
        queued.delete(id);
        nativeCancel(id);
      });
      restoreFrames = () => {
        frameProbe.mockRestore();
        cancelProbe.mockRestore();
      };
      observers.take();
      const capture = () => {
        if (pending === undefined) throw new Error("Server work has no owning sample");
        const result = Math.max(pending.callback, pending.react) + observers.take();
        pending.callback = 0;
        pending.react = 0;
        return result;
      };
      const work: number[] = [];
      const cadence: number[] = [];
      const enteredRows = new Set<string>();
      const enteredColumns = new Set<string>();
      let loadingFrames = 0;
      let renderingSamples = 0;
      let deliveredRows = 0;
      const initialWindowCount = f.windows.length;
      pending = { callback: 0, react: 0, commits: 0 };
      for (let sample = 0; sample < 112; sample++) {
        if (sample === 12) recording = true;
        pending.commits = 0;
        const started = performance.now();
        if (mode === "scroll") {
          // A two-row step admits new rows even when overscan rebalances its
          // leading edge without advancing the trailing edge for a one-row step.
          grid.scrollTop = (sample + 1) * 72;
          grid.scrollLeft = (sample + 1) * 4;
          grid.dispatchEvent(new Event("scroll"));
        } else {
          request.sink.setRowData(
            { 4000: { id: "raw-4000", name: "Record 4000", amount: 5000 + sample } },
            { 4000: "source-4000" },
          );
        }
        let measured = performance.now() - started;
        const renderedAt = await nextFrame();
        measured += capture();
        if (mode === "scroll") {
          if (grid.querySelector('[role="gridcell"][aria-label^="Loading "]') !== null)
            loadingFrames++;
          const next = f.windows.at(-1)!;
          const deliveryStart = performance.now();
          deliveredRows += publishWindow(request, next, delivered);
          measured += performance.now() - deliveryStart;
          delivered = next;
        }
        const presentedAt = await nextFrame();
        measured += capture();
        cadence.push(presentedAt - renderedAt);
        await nextFrame();
        measured += capture();
        if (pending.commits > 0) renderingSamples++;
        const cells = grid.querySelectorAll<HTMLElement>('[role="gridcell"][data-astryx-row-id]');
        for (const cell of cells) {
          const id = cell.dataset["astryxRowId"]!;
          const index = Number(id.slice("source-".length));
          expect(index).toBeGreaterThanOrEqual(delivered.firstRow);
          expect(index).toBeLessThanOrEqual(delivered.lastRow);
          enteredRows.add(id);
          enteredColumns.add(cell.dataset["astryxColumnId"]!);
          expect(cell.textContent).toBe(
            cell.dataset["astryxColumnId"] === "COL_ID_NAME"
              ? `Record ${index}`
              : String(mode === "delivery" && index === 4000 ? 5000 + sample : index),
          );
        }
        expect(cells.length).toBeLessThanOrEqual(33 * 37);
        expect(grid.querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(34);
        work.push(measured);
      }
      let quiet = 0;
      for (let frame = 0; frame < 120 && quiet < 2; frame++) {
        const before = observations;
        await nextFrame();
        work[work.length - 1]! += capture();
        quiet = observations === before && queued.size === 0 ? quiet + 1 : 0;
      }
      expect(quiet).toBe(2);
      expect(unownedCommits).toBe(0);
      expect(unownedCallbacks).toBe(0);
      recording = false;
      expect(f.requests).toHaveLength(1);
      expect(f.release).not.toHaveBeenCalled();
      expect(renderingSamples).toBeGreaterThan(100);
      if (mode === "scroll") {
        expect(f.windows.length - initialWindowCount).toBeGreaterThan(100);
        expect(loadingFrames).toBeGreaterThan(100);
        expect(deliveredRows).toBeGreaterThan(100);
        expect(enteredRows.size).toBeGreaterThan(100);
        expect(enteredColumns.size).toBeGreaterThan(12);
      } else {
        expect(viewCommits).not.toHaveBeenCalled();
        expect(surfaceCommits).not.toHaveBeenCalled();
      }
      const environment = getAstryxTableBenchmarkEnvironment();
      const evidence = [
        finalizeAstryxTableBenchmarkEvidence(work, {
          environment,
          scenario:
            mode === "scroll"
              ? "server-sustained-scroll-request-loading-delivery-5000x150-pinned"
              : "server-sparse-raw-delivery-5000x150-pinned",
          profile: "chromium-capable-hardware-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          maxDroppedFrameCount: 2,
        }),
      ];
      if (mode === "scroll")
        evidence.push(
          finalizeAstryxTableBenchmarkEvidence(cadence, {
            environment,
            scenario: "server-sustained-scroll-presentation-cadence-5000x150-pinned",
            profile: "chromium-production-presentation-cadence-v1",
            warmupSampleCount: 12,
            measuredSampleCount: 100,
            budgetMs: 20,
            droppedFrameThresholdMs: 20,
            maxDroppedFrameCount: 2,
          }),
        );
      await annotate(
        JSON.stringify({
          benchmark: "AstryxTable Server production evidence",
          evidence,
          diagnostics: {
            mode,
            sourceReplacements: f.requests.length,
            windows: f.windows.length - initialWindowCount,
            deliveredRows,
            loadingFrames,
            renderingSamples,
            viewCommits: viewCommits.mock.calls.length,
            surfaceCommits: surfaceCommits.mock.calls.length,
            unownedCommits,
            unownedCallbacks,
            quietFrames: quiet,
          },
        }),
        "benchmark",
      );
    } finally {
      recording = false;
      restoreFrames?.();
      observers.restore();
      removeListeners.forEach((remove) => remove());
      await cleanup();
    }
  },
);
