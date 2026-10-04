import { measureMutationObserverWork } from "./performance-observers";
import { Profiler, createElement, useEffect, useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  type AstryxTableColumns,
  type AstryxTableColumnId,
} from "../packages/table/src";
import {
  captureAstryxTableReactCommitWork,
  combineAstryxTableBenchmarkFrameWork,
  finalizeAstryxTableBenchmarkEvidence,
} from "../packages/table/src/internal/benchmark-budget";
import { getAstryxTableBenchmarkEnvironment } from "../packages/table/src/internal/benchmark-profile";
import {
  installAstryxTableClientColumnFilterRenderListener,
  installAstryxTableClientColumnFilterTriggerRenderListener,
  installAstryxTableClientViewRenderListenerForTable,
  installAstryxTableClientGridSurfaceRenderListenerForTable,
} from "../packages/table/src/internal/render-instrumentation";
import {
  installAstryxTableClientReconciliationListener,
  type AstryxTableClientReconciliationEvent,
} from "../packages/table/src/internal/client-source-adapter";
import { ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL } from "../packages/table/src/internal/benchmark-profile";
import "./styles.css";

type ProductionWorkloadRow = Row;
type RenderedFrameWorkSample = Work;
const ROW_COUNT = 5_000;
const LIVE_PUBLICATION_SAMPLE_COUNT = 112;
const LIVE_PUBLICATION_INTERVAL_MS = 50;
const LIVE_PUBLICATION_WAIT_TIMEOUT_MS = 10_600;
const LIVE_PUBLICATION_TEST_TIMEOUT_MS = 15_600;
async function settleAstryxTableBrowserFrames(count = 2) {
  for (let i = 0; i < count; i++) await nextFrame();
}
const columns = Array.from({ length: 150 }, (_, index) => ({
  columnId: `COL_ID_C${index}` as Uppercase<`COL_ID_C${number}`>,
  headerName: `Column ${index}`,
  field: "sequence" as const,
  valueType: "number" as const,
  width: 120,
})) satisfies AstryxTableColumns<Row>;

type Row = { id: string; sequence: number; symbol: string };
const rows = Array.from({ length: 5_000 }, (_, sequence) => ({
  id: `row-${sequence}`,
  sequence,
  symbol: `SYMBOL-${sequence % 500}`,
}));
const nativeFrame = window.requestAnimationFrame.bind(window);
const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
type Work = { callbackDurationMs: number; reactDurationMs: number };
afterEach(cleanup);

test.for(["raw", "pinned", "filters"] as const)(
  "production Client accounts for complete two-axis frame work over 5,000 × 150 rows (%s)",
  { timeout: 30_000 },
  async (layout, { annotate }) => {
    expect(import.meta.env.MODE).toBe("production");
    expect(__ASTRYX_TABLE_DEVELOPMENT__).toBe(false);
    expect(__ASTRYX_TABLE_TEST_DIAGNOSTICS__).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(createElement("div"), "_store")).toBe(false);
    const customRenderer = vi.fn(({ row }: { row: Row }) => row.symbol);
    const columns = Array.from({ length: 150 }, (_, index) => ({
      columnId: `COL_ID_C${index}` as AstryxTableColumnId,
      headerName: `Column ${index}`,
      ...(layout === "filters"
        ? { field: "symbol" as const, valueType: "text" as const }
        : { field: "sequence" as const, valueType: "number" as const }),
      width: 120,
      ...(index === (layout === "pinned" ? 24 : 10) ? { cellRenderer: customRenderer } : {}),
      ...(layout === "pinned" && index === 0
        ? { pinned: "start" as const }
        : layout === "pinned" && index === 149
          ? { pinned: "end" as const }
          : {}),
    })) satisfies AstryxTableColumns<Row>;
    const tableId = `production-client-${layout}`;
    // Begin beyond the retained header overscan in the narrower pinned centre region.
    const horizontalStart = layout === "pinned" ? 2400 : 880;
    let pending: Work | undefined;
    let scheduling: Work | undefined;
    let profilerCalls = 0;
    let recordingScroll = false;
    let unownedReactCommits = 0;
    let unownedCallbacks = 0;
    let deferredReactCommits = 0;
    let collectingDeferredWork = false;
    let observations = 0;
    const queuedFrames = new Set<number>();
    let roots = 0;
    let surfaces = 0;
    let restoreFrameProbe: (() => void) | undefined;
    const removeRoot = installAstryxTableClientViewRenderListenerForTable(tableId, () => {
      roots++;
    });
    const removeSurface = installAstryxTableClientGridSurfaceRenderListenerForTable(tableId, () => {
      surfaces++;
    });
    const observers = measureMutationObserverWork(() => {
      observations++;
    });
    try {
      await render(
        <Profiler
          id={tableId}
          onRender={(_id, _phase, actualDuration, _baseDuration, startTime, commitTime) => {
            profilerCalls++;
            observations++;
            if (recordingScroll && collectingDeferredWork) deferredReactCommits++;
            if (recordingScroll && !pending) unownedReactCommits++;
            if (pending)
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
              tableId={tableId}
              columns={columns}
              getRowId={(row: Row) => row.id}
              initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
              clientSource={{ rows, totalRows: rows.length, version: 1, status: "ready" }}
            />
          </div>
        </Profiler>,
      );
      const gridLocator = page.getByRole("grid", { name: tableId });
      await expect.element(gridLocator).toBeVisible();
      const grid = gridLocator.element();
      await nextFrame();
      await nextFrame();
      const centreCell = [...grid.querySelectorAll<HTMLElement>('[role="gridcell"]')].find(
        (cell) => getComputedStyle(cell).position !== "sticky",
      );
      expect(centreCell).toBeDefined();
      expect(getComputedStyle(centreCell!).overflow).toBe("clip");
      expect(profilerCalls).toBeGreaterThan(0);
      expect(roots).toBeGreaterThan(0);
      expect(surfaces).toBeGreaterThan(0);
      roots = 0;
      surfaces = 0;
      const nativeCancelFrame = window.cancelAnimationFrame.bind(window);
      const probe = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        const request = nativeFrame((timestamp) => {
          queuedFrames.delete(request);
          observations++;
          const started = performance.now();
          try {
            callback(timestamp);
          } finally {
            if (recordingScroll && !scheduling) unownedCallbacks++;
            if (scheduling) scheduling.callbackDurationMs += performance.now() - started;
          }
        });
        queuedFrames.add(request);
        return request;
      });
      const cancellationProbe = vi
        .spyOn(window, "cancelAnimationFrame")
        .mockImplementation((request) => {
          queuedFrames.delete(request);
          nativeCancelFrame(request);
        });
      restoreFrameProbe = () => {
        probe.mockRestore();
        cancellationProbe.mockRestore();
      };
      // Every interval belongs to a sample, including preparation after presentation.
      // Keep React and callback work together to avoid double-charging synchronous commits.
      function captureInterval() {
        if (!pending) throw new Error("Scroll work has no owning sample.");
        const duration =
          Math.max(pending.callbackDurationMs, pending.reactDurationMs) + observers.take();
        pending = { callbackDurationMs: 0, reactDurationMs: 0 };
        scheduling = pending;
        return duration;
      }
      const work: number[] = [];
      const cadence: number[] = [];
      const rowWindows = new Set<string>();
      const columnWindows = new Set<string>();
      let customBeforeMeasured = 0;
      await nextFrame();
      pending = { callbackDurationMs: 0, reactDurationMs: 0 };
      scheduling = pending;
      for (let sample = 0; sample < 112; sample++) {
        const warmup = sample < 12;
        if (sample === 12) {
          recordingScroll = true;
          customBeforeMeasured = customRenderer.mock.calls.length;
        }
        grid.scrollTop = warmup
          ? sample === 11
            ? 8656
            : (sample + 1) * 720
          : 8656 + (sample - 12) * 4;
        grid.scrollLeft = warmup
          ? sample === 11
            ? horizontalStart
            : (sample + 1) * 72
          : horizontalStart + (sample - 12) * 4;
        const started = performance.now();
        grid.dispatchEvent(new Event("scroll"));
        const admissionDurationMs = performance.now() - started;
        const renderedAt = await nextFrame();
        let sampleWork = admissionDurationMs + captureInterval();
        const presentedAt = await nextFrame();
        sampleWork += captureInterval();
        cadence.push(presentedAt - renderedAt);
        collectingDeferredWork = true;
        await nextFrame();
        sampleWork += captureInterval();
        collectingDeferredWork = false;
        work.push(sampleWork);
        if (!warmup) {
          rowWindows.add(
            [...grid.querySelectorAll('[role="row"]')]
              .map((row) => row.getAttribute("aria-rowindex"))
              .join("|"),
          );
          columnWindows.add(
            [...grid.querySelectorAll('[role="columnheader"]')]
              .map((column) => column.getAttribute("aria-colindex"))
              .join("|"),
          );
        }
      }
      // Drain multi-frame preparation/promotion/cleanup into the final measured sample.
      // Quiescence requires an empty scheduled queue and two intervals without callbacks/commits.
      collectingDeferredWork = true;
      let quietFrames = 0;
      for (let frame = 0; frame < 120 && quietFrames < 2; frame++) {
        const before = observations;
        await nextFrame();
        work[work.length - 1]! += captureInterval();
        quietFrames = observations === before && queuedFrames.size === 0 ? quietFrames + 1 : 0;
      }
      expect(quietFrames).toBe(2);
      expect(unownedReactCommits).toBe(0);
      expect(unownedCallbacks).toBe(0);
      // This workload must exercise commits later than the old two-frame capture window.
      expect(deferredReactCommits).toBeGreaterThan(0);
      recordingScroll = false;
      expect(rowWindows.size).toBeGreaterThan(5);
      expect(columnWindows.size).toBeGreaterThan(2);
      expect(customRenderer.mock.calls.length).toBeGreaterThan(customBeforeMeasured);
      expect(roots).toBe(0);
      expect(surfaces).toBe(0);
      expect(grid.querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(33);
      expect(grid.querySelectorAll('[role="columnheader"]').length).toBeLessThanOrEqual(37);
      if (layout === "pinned") {
        for (const name of ["Column 0", "Column 149"]) {
          const header = page.getByRole("columnheader", { name, exact: true }).element();
          expect(getComputedStyle(header).position).toBe("sticky");
          const cells = grid.querySelectorAll(
            `[role="gridcell"][aria-colindex="${header.getAttribute("aria-colindex")}"]`,
          );
          expect(cells.length).toBeGreaterThan(0);
          for (const cell of cells)
            expect(
              Math.abs(cell.getBoundingClientRect().left - header.getBoundingClientRect().left),
            ).toBeLessThan(1);
        }
      }
      const environment = getAstryxTableBenchmarkEnvironment();
      const evidence = [
        finalizeAstryxTableBenchmarkEvidence(work, {
          environment,
          scenario: `client-${layout}-two-axis-custom-renderer-work-5000x150`,
          profile: "chromium-capable-hardware-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          maxDroppedFrameCount: 2,
        }),
        finalizeAstryxTableBenchmarkEvidence(cadence, {
          environment,
          scenario: `client-${layout}-two-axis-presentation-cadence-5000x150`,
          profile: "chromium-production-presentation-cadence-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 20,
          droppedFrameThresholdMs: 20,
          maxDroppedFrameCount: 2,
        }),
      ];
      await annotate(
        JSON.stringify({ benchmark: `AstryxTable ${layout} Client production evidence`, evidence }),
        "benchmark",
      );
    } finally {
      observers.restore();
      restoreFrameProbe?.();
      removeRoot();
      removeSurface();
    }
  },
);

test.for(["plain", "open-filter", "open-list-filter"] as const)(
  "keeps 20 Hz publications bounded and isolated with stable row references (%s)",
  { timeout: LIVE_PUBLICATION_TEST_TIMEOUT_MS },
  async (variant, { annotate }) => {
    const tableId = "TABLE_ID_PRODUCTION_20_HZ";
    const reconciliationEvents: AstryxTableClientReconciliationEvent[] = [];
    const viewRenders = vi.fn();
    const gridSurfaceRenders = vi.fn();
    const toolbarCommits = vi.fn();
    const cellRenderCounts = new Map<string, number>();
    let filterRenders = 0;
    let filterTriggers = 0;
    const removeFilterRender = installAstryxTableClientColumnFilterRenderListener(() => {
      filterRenders++;
    });
    const removeFilterTrigger = installAstryxTableClientColumnFilterTriggerRenderListener(() => {
      filterTriggers++;
    });
    type PublicationSample = {
      readonly index: number;
      admissionDurationMs: number;
      readonly rendered: RenderedFrameWorkSample;
      readonly presentation: RenderedFrameWorkSample;
      phase: "rendered" | "presentation";
      reactCommits: number;
      observedText?: string | null;
      complete: boolean;
      observerDurationMs: number;
    };
    const publicationSamples: PublicationSample[] = [];
    let activePublication: PublicationSample | undefined;
    let startPublications: (() => void) | undefined;
    let observedCell: Element | undefined;
    let overlappingPublications = 0;
    let unownedReactCommits = 0;
    let recordingPublications = false;
    const publicationObservers = measureMutationObserverWork((duration) => {
      if (recordingPublications && activePublication !== undefined)
        activePublication.observerDurationMs += duration;
    });
    const nativeRequestFrame = window.requestAnimationFrame.bind(window);
    let restoreFrameProbe: (() => void) | undefined;
    const removeReconciliation = installAstryxTableClientReconciliationListener((event) => {
      if (recordingPublications) reconciliationEvents.push(event);
    });
    const removeView = installAstryxTableClientViewRenderListenerForTable(tableId, viewRenders);
    const removeGrid = installAstryxTableClientGridSurfaceRenderListenerForTable(
      tableId,
      gridSurfaceRenders,
    );
    const instrumentedColumns = columns.map((column, index) =>
      index === 0
        ? {
            ...column,
            cellRenderer: ({ row }: { readonly row: ProductionWorkloadRow }) => {
              cellRenderCounts.set(row.id, (cellRenderCounts.get(row.id) ?? 0) + 1);
              return row.symbol;
            },
          }
        : variant !== "plain" && index === 1
          ? {
              ...column,
              columnId: "COL_ID_FILTER" as const,
              field: "symbol" as const,
              valueType: "text" as const,
            }
          : column,
    ) satisfies AstryxTableColumns<ProductionWorkloadRow>;
    function ToolbarProbe() {
      useEffect(() => {
        toolbarCommits();
      });
      return <button type="button">Stable production command</button>;
    }
    const unchangedRow = rows[0]!;
    let referenceViolations = 0;
    function SustainedPublicationHarness() {
      const [publication, setPublication] = useState(
        Object.freeze({ rows, version: 1 }) as Readonly<{
          readonly rows: readonly ProductionWorkloadRow[];
          readonly version: number;
        }>,
      );
      useEffect(() => {
        let nextPublication = 1;
        let timer: ReturnType<typeof setInterval> | undefined;
        startPublications = () => {
          recordingPublications = true;
          timer = setInterval(() => {
            const publicationIndex = nextPublication;
            if (activePublication !== undefined) overlappingPublications += 1;
            const sample: PublicationSample = {
              index: publicationIndex,
              admissionDurationMs: 0,
              rendered: { callbackDurationMs: 0, reactDurationMs: 0 },
              presentation: { callbackDurationMs: 0, reactDurationMs: 0 },
              phase: "rendered",
              reactCommits: 0,
              complete: false,
              observerDurationMs: 0,
            };
            publicationSamples.push(sample);
            activePublication = sample;
            const admissionStartedAt = performance.now();
            setPublication((current) => {
              const nextRows = Object.freeze(
                current.rows.with(
                  1,
                  Object.freeze({
                    ...current.rows[1]!,
                    symbol: `SYMBOL-LIVE-${String(publicationIndex).padStart(3, "0")}`,
                  }),
                ),
              );
              if (current.rows[0] !== unchangedRow || nextRows[0] !== unchangedRow) {
                referenceViolations += 1;
              }
              return Object.freeze({ rows: nextRows, version: current.version + 1 });
            });
            sample.admissionDurationMs = performance.now() - admissionStartedAt;
            // These observer callbacks are harness work, not grid callbacks. Keep
            // the source timer at 20 Hz regardless of how quickly rendering settles.
            nativeRequestFrame(() => {
              sample.phase = "presentation";
              nativeRequestFrame(() => {
                sample.observedText = observedCell?.textContent ?? null;
                sample.complete = true;
                if (activePublication === sample) activePublication = undefined;
              });
            });
            if (nextPublication === LIVE_PUBLICATION_SAMPLE_COUNT) clearInterval(timer);
            nextPublication += 1;
          }, LIVE_PUBLICATION_INTERVAL_MS);
        };
        return () => {
          clearInterval(timer);
          startPublications = undefined;
        };
      }, []);
      return (
        <AstryxTableClient
          tableId={tableId}
          getRowId={(row: ProductionWorkloadRow) => row.id}
          columns={instrumentedColumns}
          initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
          initialFilters={
            variant === "open-list-filter"
              ? [
                  {
                    columnId: "COL_ID_FILTER",
                    type: "in",
                    filter: [
                      "SYMBOL-0",
                      ...Array.from({ length: 499 }, (_, index) => `SYMBOL-${String(index + 1)}`),
                      ...Array.from(
                        { length: LIVE_PUBLICATION_SAMPLE_COUNT },
                        (_, index) => `SYMBOL-LIVE-${String(index + 1).padStart(3, "0")}`,
                      ),
                    ],
                  },
                ]
              : undefined
          }
          clientSource={{
            rows: publication.rows,
            totalRows: publication.rows.length,
            version: publication.version,
            status: "ready",
          }}
        >
          <ToolbarProbe />
        </AstryxTableClient>
      );
    }

    try {
      const screen = await render(
        <Profiler
          id="production-live-publication"
          onRender={(_id, _phase, actualDuration, _baseDuration, startTime, commitTime) => {
            if (!recordingPublications) return;
            if (activePublication === undefined) {
              unownedReactCommits += 1;
              return;
            }
            activePublication.reactCommits += 1;
            activePublication[activePublication.phase].reactDurationMs +=
              captureAstryxTableReactCommitWork({
                actualDurationMs: actualDuration,
                commitTimeMs: commitTime,
                observedAtMs: performance.now(),
                startTimeMs: startTime,
              }).durationMs;
          }}
        >
          <SustainedPublicationHarness />
        </Profiler>,
      );
      await expect
        .element(screen.getByRole("button", { name: "Stable production command" }))
        .toBeInTheDocument();
      if (variant !== "plain") {
        await screen.getByRole("button", { name: /^Filter Column 1(?: \(active\))?$/ }).click();
        await expect
          .element(screen.getByRole("textbox", { name: "Filter value", exact: true }))
          .toHaveFocus();
        if (variant === "open-list-filter")
          expect(screen.getByRole("textbox").all()).toHaveLength(64);
        expect(filterRenders).toBeGreaterThan(0);
        expect(filterTriggers).toBeGreaterThan(0);
      }
      await settleAstryxTableBrowserFrames(2);
      const initialFilterRenders = filterRenders;
      const initialFilterTriggers = filterTriggers;
      observedCell =
        screen
          .getByRole("grid")
          .element()
          .querySelector('[role="row"][aria-rowindex="3"] [role="gridcell"][aria-colindex="1"]') ??
        undefined;
      expect(observedCell).toBeDefined();
      const initialViewRenders = viewRenders.mock.calls.length;
      const initialGridRenders = gridSurfaceRenders.mock.calls.length;
      const initialUnchangedCellRenders = cellRenderCounts.get(unchangedRow.id);
      const initialChangedCellRenders = cellRenderCounts.get(rows[1]!.id);
      reconciliationEvents.length = 0;
      const frameProbe = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
        nativeRequestFrame((timestamp) => {
          const sample = activePublication;
          const phase = sample?.phase;
          const startedAt = performance.now();
          try {
            callback(timestamp);
          } finally {
            if (sample !== undefined && phase !== undefined) {
              sample[phase].callbackDurationMs += performance.now() - startedAt;
            }
          }
        }),
      );
      restoreFrameProbe = () => frameProbe.mockRestore();
      expect(startPublications).toBeDefined();
      startPublications!();

      await vi.waitFor(
        () => {
          expect(reconciliationEvents).toHaveLength(LIVE_PUBLICATION_SAMPLE_COUNT);
          expect(publicationSamples).toHaveLength(LIVE_PUBLICATION_SAMPLE_COUNT);
          expect(publicationSamples.every((sample) => sample.complete)).toBe(true);
        },
        { timeout: LIVE_PUBLICATION_WAIT_TIMEOUT_MS },
      );
      expect(
        screen
          .getByRole("gridcell", {
            name: `SYMBOL-LIVE-${String(LIVE_PUBLICATION_SAMPLE_COUNT).padStart(3, "0")}`,
          })
          .all().length,
      ).toBeGreaterThan(0);
      expect(referenceViolations).toBe(0);
      expect(overlappingPublications).toBe(0);
      expect(unownedReactCommits).toBe(0);
      for (const sample of publicationSamples) {
        expect(sample.reactCommits).toBeGreaterThan(0);
        expect(sample.observedText).toBe(`SYMBOL-LIVE-${String(sample.index).padStart(3, "0")}`);
      }
      for (const event of reconciliationEvents) {
        expect(event).toMatchObject({
          changedRows: 1,
          identityPatches: 1,
          rebuiltIdentityIndex: false,
          rebuiltSourceSequence: false,
          residentRows: ROW_COUNT,
          resolvedRowIds: 1,
        });
      }
      const evidence = finalizeAstryxTableBenchmarkEvidence(
        publicationSamples.map(
          (sample) =>
            combineAstryxTableBenchmarkFrameWork({
              admissionDurationMs: sample.admissionDurationMs,
              renderedFrame: sample.rendered,
              presentationFrame: sample.presentation,
            }) + sample.observerDurationMs,
        ),
        {
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          environment: getAstryxTableBenchmarkEnvironment(),
          maxDroppedFrameCount: 2,
          measuredSampleCount: ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL.measuredSampleCount,
          profile: "chromium-capable-hardware-v1",
          scenario:
            variant === "open-list-filter"
              ? "client-open-list-filter-live-publication-5000x150-20hz"
              : variant === "open-filter"
                ? "client-open-filter-live-publication-5000x150-20hz"
                : "client-live-publication-5000x150-20hz",
          warmupSampleCount: ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL.warmupSampleCount,
        },
      );
      await annotate(
        JSON.stringify({ benchmark: "AstryxTable live Client production evidence", evidence }),
        "benchmark",
      );
      expect(evidence.summary.sampleCount).toBe(
        ASTRYX_TABLE_CAPABLE_HARDWARE_SAMPLE_PROTOCOL.measuredSampleCount,
      );
      expect(viewRenders).toHaveBeenCalledTimes(initialViewRenders);
      expect(gridSurfaceRenders).toHaveBeenCalledTimes(initialGridRenders);
      expect(toolbarCommits).toHaveBeenCalledOnce();
      expect(filterRenders).toBe(initialFilterRenders);
      expect(filterTriggers).toBe(initialFilterTriggers);
      expect(cellRenderCounts.get(unchangedRow.id)).toBe(initialUnchangedCellRenders);
      expect(cellRenderCounts.get(rows[1]!.id)).toBe(
        (initialChangedCellRenders ?? 0) + LIVE_PUBLICATION_SAMPLE_COUNT,
      );
    } finally {
      recordingPublications = false;
      restoreFrameProbe?.();
      publicationObservers.restore();
      removeGrid();
      removeView();
      removeReconciliation();
      removeFilterRender();
      removeFilterTrigger();
    }
  },
);
