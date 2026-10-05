import { installAstryxTableRowSelectionRenderListener } from "../packages/table/src/internal/row-selection";
import { installAstryxTableSourceLifecycleRenderListener } from "../packages/table/src/internal/source-lifecycle-instrumentation";
import { installAstryxTableToolbarSubscriptionListener } from "../packages/table/src/internal/toolbar-instrumentation";
import { installAstryxTableSortControlRenderListener } from "../packages/table/src/internal/sort-control-instrumentation";
import { installAstryxTableColumnSettingsRenderListener } from "../packages/table/src/internal/column-settings-instrumentation";
import { installAstryxTableActiveFilterRenderListener } from "../packages/table/src/internal/active-filter-instrumentation";
import { installAstryxTableClientFacetSubscriptionListener } from "../packages/table/src/internal/client-facet";
import { measureMutationObserverWork } from "./performance-observers";
import { Profiler, createElement, useEffect, useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableFilterControl,
  AstryxTableToolbar,
  AstryxTableToolbarSpacer,
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  AstryxTableActiveFilters,
  AstryxTableQuickFilter,
  AstryxTableSelectColumn,
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
  installAstryxTableClientQuickFilterRenderListener,
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

type Row = { id: string; sequence: number; symbol: string; ready: boolean };
const rows = Array.from({ length: 5_000 }, (_, sequence) => ({
  id: `row-${sequence}`,
  sequence,
  symbol: `SYMBOL-${sequence % 500}`,
  ready: true,
}));
const nativeFrame = window.requestAnimationFrame.bind(window);
const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
type Work = { callbackDurationMs: number; reactDurationMs: number };
afterEach(cleanup);

test.for(["raw", "pinned", "filters", "grouped", "row-selection"] as const)(
  "production Client accounts for complete two-axis frame work over 5,000 × 150 rows (%s)",
  { timeout: 30_000 },
  async (layout, { annotate }) => {
    expect(import.meta.env.MODE).toBe("production");
    expect(__ASTRYX_TABLE_DEVELOPMENT__).toBe(false);
    expect(__ASTRYX_TABLE_TEST_DIAGNOSTICS__).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(createElement("div"), "_store")).toBe(false);
    const customRenderer = vi.fn(
      ({ row, value }: { row?: Row; value?: unknown }) => row?.symbol ?? String(value),
    );
    // One key + Rows + 148 aggregates produces exactly 150 logical columns.
    const columns = Array.from({ length: layout === "grouped" ? 149 : 150 }, (_, index) => {
      const base = {
        columnId: `COL_ID_C${index}` as AstryxTableColumnId,
        headerName: `Column ${index}`,
        width: 120,
      };
      if (layout === "grouped") {
        return index === 0
          ? { ...base, field: "sequence" as const, valueType: "number" as const, groupBy: true }
          : {
              ...base,
              field: "sequence" as const,
              valueType: "number" as const,
              aggFunc: "max" as const,
              ...(index === 10 ? { aggregateCellRenderer: customRenderer } : {}),
            };
      }
      return {
        ...base,
        ...(layout === "filters"
          ? { field: "symbol" as const, valueType: "text" as const }
          : { field: "sequence" as const, valueType: "number" as const }),
        ...(index === (layout === "pinned" || layout === "row-selection" ? 24 : 10)
          ? { cellRenderer: customRenderer }
          : {}),
        ...((layout === "pinned" || layout === "row-selection") && index === 0
          ? { pinned: "start" as const }
          : (layout === "pinned" || layout === "row-selection") && index === 149
            ? { pinned: "end" as const }
            : {}),
      };
    }) satisfies AstryxTableColumns<Row>;
    const tableId = `production-client-${layout}`;
    // Begin beyond the retained header overscan in the narrower pinned centre region.
    const horizontalStart = layout === "pinned" || layout === "row-selection" ? 2400 : 880;
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
              rowSelection={layout === "row-selection" ? true : undefined}
              tableId={tableId}
              columns={columns}
              getRowId={(row: Row) => row.id}
              initialOrderBy={[{ columnId: "COL_ID_C0", direction: "asc" }]}
              initialPersistedState={
                layout === "grouped"
                  ? {
                      version: 1,
                      tableId,
                      filters: [],
                      orderBy: [{ columnId: "COL_ID_C0", direction: "asc" }],
                      groupBy: ["COL_ID_C0"],
                      groupOrderBy: [{ columnId: "COL_ID_C0", direction: "asc" }],
                      columnOrder: columns.map((column) => column.columnId),
                      columnVisibility: {},
                      columnWidths: {},
                      columnPinning: { start: [], end: [] },
                    }
                  : undefined
              }
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
      expect(
        grid.querySelectorAll('[role="columnheader"]').length -
          (layout === "row-selection" ? 1 : 0),
      ).toBeLessThanOrEqual(37);
      if (layout === "row-selection") {
        expect(page.getByRole("checkbox").elements().length).toBeGreaterThan(1);
        expect(page.getByRole("checkbox").elements().length).toBeLessThanOrEqual(33);
      }
      if (layout === "pinned" || layout === "row-selection") {
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

test.for([
  "plain",
  "open-filter",
  "open-list-filter",
  "open-boolean-filter",
  "open-select-filter",
  "open-set-filter",
  "open-active-filters",
  "quick-filter",
  "open-compound-filter",
  "open-column-visibility",
  "open-sort-controls",
  "open-sort-picker",
  "row-counts",
  "command-toolbar",
  "row-selection",
] as const)(
  "keeps 20 Hz publications bounded and isolated with stable row references (%s)",
  { timeout: LIVE_PUBLICATION_TEST_TIMEOUT_MS },
  async (variant, { annotate }) => {
    const tableId = "TABLE_ID_PRODUCTION_20_HZ";
    const reconciliationEvents: AstryxTableClientReconciliationEvent[] = [];
    const selectionRenders = vi.fn();
    const removeSelectionRenders = installAstryxTableRowSelectionRenderListener(
      tableId,
      selectionRenders,
    );
    const sourceRenders = vi.fn();
    const removeSourceRenders = installAstryxTableSourceLifecycleRenderListener(sourceRenders);
    const viewRenders = vi.fn();
    const gridSurfaceRenders = vi.fn();
    const toolbarCommits = vi.fn();
    const cellRenderCounts = new Map<string, number>();
    const commandRenders = vi.fn();
    let activeCountSubscriptions = 0;
    let activeCountNotifications = 0;
    let countSubscriptions = 0;
    let countNotifications = 0;
    const removeCountSubscriptions = installAstryxTableToolbarSubscriptionListener((event) => {
      if (event.tableId !== tableId) return;
      if (event.projection === "active-filter-count" || event.projection === "active-sort-count") {
        if (event.phase === "subscribe") activeCountSubscriptions++;
        if (event.phase === "notify") activeCountNotifications++;
        return;
      }
      if (event.phase === "subscribe") countSubscriptions++;
      if (event.phase === "notify") countNotifications++;
    });
    let facetSubscriptions = 0;
    let facetNotifications = 0;
    const removeFacet = installAstryxTableClientFacetSubscriptionListener((event) => {
      if (event.phase === "subscribe") facetSubscriptions++;
      if (event.phase === "unsubscribe") facetSubscriptions--;
      if (event.phase === "notify") facetNotifications++;
    });
    const sortRenders = { trigger: 0, review: 0 };
    const removeSortRender = installAstryxTableSortControlRenderListener((part) => {
      sortRenders[part]++;
    });
    const columnSettingsRenders = { visibility: 0, reset: 0 };
    const removeColumnSettingsRender = installAstryxTableColumnSettingsRenderListener((part) => {
      columnSettingsRenders[part]++;
    });
    let quickFilterRenders = 0;
    const removeQuickFilterRender = installAstryxTableClientQuickFilterRenderListener(() => {
      quickFilterRenders++;
    });
    let activeFilterRenders = 0;
    const removeActiveFilterRender = installAstryxTableActiveFilterRenderListener(() => {
      activeFilterRenders++;
    });
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
    const selectColumns = [
      AstryxTableSelectColumn({
        enableSetFilter: false,
        columnId: "COL_ID_SELECT",
        headerName: "Column 1",
        field: "symbol",
        width: 120,
        options: [
          "SYMBOL-0",
          ...Array.from({ length: 499 }, (_, index) => `SYMBOL-${String(index + 1)}`),
          ...Array.from(
            { length: LIVE_PUBLICATION_SAMPLE_COUNT },
            (_, index) => `SYMBOL-LIVE-${String(index + 1).padStart(3, "0")}`,
          ),
        ],
      }),
    ] as const satisfies AstryxTableColumns<ProductionWorkloadRow>;
    const instrumentedColumns = columns.map((column, index) =>
      index === 0
        ? {
            ...column,
            cellRenderer: ({ row }: { readonly row: ProductionWorkloadRow }) => {
              cellRenderCounts.set(row.id, (cellRenderCounts.get(row.id) ?? 0) + 1);
              return row.symbol;
            },
          }
        : variant === "open-active-filters" && index > 0 && index <= 70
          ? { ...column, field: "symbol" as const, valueType: "text" as const }
          : variant === "open-select-filter" && index === 1
            ? selectColumns[0]
            : variant === "open-boolean-filter" && index === 1
              ? {
                  ...column,
                  columnId: "COL_ID_BOOLEAN" as const,
                  field: "ready" as const,
                  valueType: "boolean" as const,
                  enableSetFilter: false,
                }
              : variant !== "plain" && index === 1
                ? {
                    ...column,
                    columnId: "COL_ID_FILTER" as const,
                    field: "symbol" as const,
                    valueType: "text" as const,
                    enableSetFilter: variant === "open-set-filter",
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
          rowSelection={variant === "row-selection" ? true : undefined}
          tableId={tableId}
          getRowId={(row: ProductionWorkloadRow) => row.id}
          columns={instrumentedColumns}
          initialOrderBy={
            variant === "open-sort-controls"
              ? [
                  { columnId: "COL_ID_C0", direction: "asc" },
                  ...instrumentedColumns
                    .slice(1)
                    .map((column) => ({ columnId: column.columnId, direction: "asc" as const })),
                ]
              : [{ columnId: "COL_ID_C0", direction: "asc" }]
          }
          quickFilterFields={variant === "quick-filter" ? ["symbol"] : undefined}
          initialFilters={
            variant === "open-compound-filter"
              ? [
                  {
                    type: "OR",
                    conditions: [
                      { columnId: "COL_ID_FILTER", type: "contains", filter: "SYMBOL" },
                      ...Array.from({ length: 69 }, (_, index) => ({
                        columnId: "COL_ID_FILTER" as const,
                        type: "equals" as const,
                        filter: `unused-${String(index)}`,
                      })),
                    ],
                  },
                ]
              : variant === "open-active-filters"
                ? Array.from({ length: 70 }, (_, index) => ({
                    columnId: `COL_ID_C${index + 1}` as `COL_ID_C${Uppercase<`${number}`>}`,
                    type: "contains" as const,
                    filter: "SYMBOL",
                  }))
                : variant === "open-boolean-filter"
                  ? [{ columnId: "COL_ID_BOOLEAN", type: "equals", filter: true }]
                  : variant === "open-list-filter"
                    ? [
                        {
                          columnId: "COL_ID_FILTER",
                          type: "in",
                          filter: [
                            "SYMBOL-0",
                            ...Array.from(
                              { length: 499 },
                              (_, index) => `SYMBOL-${String(index + 1)}`,
                            ),
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
          {variant === "command-toolbar" ? (
            <AstryxTableToolbar>
              <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
                {(commands) => {
                  commandRenders();
                  return (
                    <button type="button" onClick={() => commands.clearAll()}>
                      Clear Grid Filters
                    </button>
                  );
                }}
              </AstryxTableFilterControl>
              <AstryxTableToolbarSpacer />
              <AstryxTableActiveFilterCount />
              <AstryxTableActiveSortCount />
              <AstryxTableResultRowCount />
              <AstryxTableLoadedRowCount />
            </AstryxTableToolbar>
          ) : null}
          {variant === "row-counts" ? (
            <>
              <AstryxTableResultRowCount />
              <AstryxTableLoadedRowCount />
            </>
          ) : null}
          {variant === "quick-filter" ? <AstryxTableQuickFilter /> : null}
          {variant === "open-active-filters" || variant === "quick-filter" ? (
            <AstryxTableActiveFilters />
          ) : null}
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
      if (variant === "open-sort-controls" || variant === "open-sort-picker") {
        await screen
          .getByRole("button", {
            name:
              variant === "open-sort-controls" ? "Sort rows, 150 active" : "Sort rows, 1 active",
            exact: true,
          })
          .click();
        if (variant === "open-sort-controls") {
          expect(
            await screen
              .getByRole("list", { name: "Active sorts", exact: true })
              .getByRole("listitem")
              .all(),
          ).toHaveLength(64);
        } else {
          await screen.getByRole("button", { name: "Add sort column", exact: true }).click();
          await expect
            .element(screen.getByRole("combobox", { name: "Search options", exact: true }))
            .toHaveFocus();
          expect(await screen.getByRole("option").all()).toHaveLength(149);
        }
      } else if (variant === "open-column-visibility") {
        await screen.getByRole("button", { name: "Column preferences", exact: true }).click();
        await screen.getByRole("button", { name: "Visible columns", exact: true }).click();
        await expect
          .element(screen.getByRole("combobox", { name: "Search options", exact: true }))
          .toHaveFocus();
        expect(
          screen.getByRole("listbox").element().querySelectorAll('[role="option"]'),
        ).toHaveLength(150);
      } else if (variant === "quick-filter") {
        await screen.getByRole("searchbox", { name: "Quick Filter", exact: true }).fill("SYMBOL");
        await expect
          .element(screen.getByRole("button", { name: "Active filters (1)", exact: true }))
          .toBeVisible();
        // Toolbar's native keyboard hint dismisses after 3 seconds. Complete
        // that focus interaction through its supported arrow gesture before
        // recording steady-state source publications (no delayed UI work).
        await userEvent.keyboard("{ArrowLeft}");
        await expect
          .element(screen.getByRole("searchbox", { name: "Quick Filter", exact: true }))
          .toHaveFocus();
        expect(quickFilterRenders).toBeGreaterThan(0);
      } else if (variant === "open-active-filters") {
        await screen.getByRole("button", { name: "Active filters (70)", exact: true }).click();
        await expect
          .element(screen.getByRole("button", { name: /^Remove Column 1\b/ }))
          .toHaveFocus();
        expect(
          screen
            .getByRole("dialog", { name: "Active filters", exact: true })
            .getByRole("button", { name: /^Remove / })
            .all(),
        ).toHaveLength(64);
        expect(activeFilterRenders).toBeGreaterThan(0);
      } else if (variant === "open-compound-filter") {
        await screen.getByRole("button", { name: /^Filter Column 1(?: \(active\))?$/ }).click();
        await expect
          .element(
            screen.getByRole("combobox", { name: "Filter expression for Column 1", exact: true }),
          )
          .toHaveFocus();
        expect(
          screen
            .getByRole("dialog", { name: "Filter Column 1", exact: true })
            .element()
            .querySelectorAll('input[type="text"]'),
        ).toHaveLength(64);
        expect(filterRenders).toBeGreaterThan(0);
        expect(filterTriggers).toBeGreaterThan(0);
      } else if (variant === "row-counts" || variant === "command-toolbar") {
        await expect
          .element(screen.getByRole("status", { name: "Result rows", exact: true }))
          .toHaveTextContent("5000 result rows");
        await expect
          .element(screen.getByRole("status", { name: "Loaded rows", exact: true }))
          .toHaveTextContent("5000 loaded rows");
      } else if (variant === "row-selection") {
        await screen.getByRole("checkbox", { name: "Select all rows", exact: true }).click();
        await expect
          .element(screen.getByRole("checkbox", { name: "Select row 2", exact: true }))
          .toBeChecked();
      } else if (variant !== "plain") {
        await screen.getByRole("button", { name: /^Filter Column 1(?: \(active\))?$/ }).click();
        await expect
          .element(
            screen.getByRole(
              variant === "open-set-filter"
                ? "searchbox"
                : variant === "open-boolean-filter" || variant === "open-select-filter"
                  ? "combobox"
                  : "textbox",
              {
                name: variant === "open-set-filter" ? "Search values for Column 1" : "Filter value",
                exact: true,
              },
            ),
          )
          .toHaveFocus();
        if (variant === "open-list-filter")
          expect(screen.getByRole("textbox").all()).toHaveLength(64);
        if (variant === "open-select-filter") {
          await screen.getByRole("combobox", { name: "Filter value", exact: true }).click();
          expect(screen.getByRole("option").all()).toHaveLength(64);
        }
        expect(filterRenders).toBeGreaterThan(0);
        expect(filterTriggers).toBeGreaterThan(0);
      }
      await settleAstryxTableBrowserFrames(2);
      expect(facetSubscriptions).toBe(variant === "open-set-filter" ? 1 : 0);
      expect(countSubscriptions).toBe(
        variant === "row-counts" || variant === "command-toolbar" ? 2 : 0,
      );
      expect(activeCountSubscriptions).toBe(variant === "command-toolbar" ? 2 : 0);
      expect(commandRenders).toHaveBeenCalledTimes(variant === "command-toolbar" ? 1 : 0);
      const initialSelectionRenders = selectionRenders.mock.calls.length;
      if (variant === "row-selection") expect(initialSelectionRenders).toBeGreaterThan(0);
      const initialActiveCountNotifications = activeCountNotifications;
      const initialCountNotifications = countNotifications;
      const initialFacetNotifications = facetNotifications;
      const initialSortRenders = { ...sortRenders };
      expect(initialSortRenders.trigger).toBeGreaterThan(0);
      if (variant === "open-sort-controls" || variant === "open-sort-picker")
        expect(initialSortRenders.review).toBeGreaterThan(0);
      else expect(initialSortRenders.review).toBe(0);
      const initialColumnSettingsRenders = { ...columnSettingsRenders };
      if (variant === "open-column-visibility") {
        expect(initialColumnSettingsRenders.visibility).toBeGreaterThan(0);
        expect(initialColumnSettingsRenders.reset).toBeGreaterThan(0);
      } else {
        expect(initialColumnSettingsRenders).toEqual({ visibility: 0, reset: 0 });
      }
      const initialQuickFilterRenders = quickFilterRenders;
      const initialActiveFilterRenders = activeFilterRenders;
      const initialFilterRenders = filterRenders;
      const initialFilterTriggers = filterTriggers;
      observedCell =
        screen
          .getByRole("grid")
          .element()
          .querySelector(
            `[role="row"][aria-rowindex="3"] [role="gridcell"][aria-colindex="${variant === "row-selection" ? 2 : 1}"]`,
          ) ?? undefined;
      expect(observedCell).toBeDefined();
      const initialSourceRenders = sourceRenders.mock.calls.length;
      expect(initialSourceRenders).toBeGreaterThan(0);
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
            variant === "row-selection"
              ? "client-row-selection-live-publication-5000x150-20hz"
              : variant === "command-toolbar"
                ? "client-command-toolbar-live-publication-5000x150-20hz"
                : variant === "row-counts"
                  ? "client-row-counts-live-publication-5000x150-20hz"
                  : variant === "open-sort-controls"
                    ? "client-open-sort-controls-live-publication-5000x150-20hz"
                    : variant === "open-sort-picker"
                      ? "client-open-sort-picker-live-publication-5000x150-20hz"
                      : variant === "open-column-visibility"
                        ? "client-open-column-visibility-live-publication-5000x150-20hz"
                        : variant === "open-compound-filter"
                          ? "client-open-compound-filter-live-publication-5000x150-20hz"
                          : variant === "quick-filter"
                            ? "client-quick-filter-live-publication-5000x150-20hz"
                            : variant === "open-active-filters"
                              ? "client-open-active-filters-live-publication-5000x150-20hz"
                              : variant === "open-set-filter"
                                ? "client-open-set-filter-live-publication-5000x150-20hz"
                                : variant === "open-select-filter"
                                  ? "client-open-select-filter-live-publication-5000x150-20hz"
                                  : variant === "open-boolean-filter"
                                    ? "client-open-boolean-filter-live-publication-5000x150-20hz"
                                    : variant === "open-list-filter"
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
      expect(selectionRenders).toHaveBeenCalledTimes(initialSelectionRenders);
      expect(sourceRenders).toHaveBeenCalledTimes(initialSourceRenders);
      expect(viewRenders).toHaveBeenCalledTimes(initialViewRenders);
      expect(gridSurfaceRenders).toHaveBeenCalledTimes(initialGridRenders);
      expect(toolbarCommits).toHaveBeenCalledOnce();
      if (variant === "open-set-filter") {
        expect(
          screen
            .getByRole("group", { name: "Filter values", exact: true })
            .getByRole("checkbox")
            .all(),
        ).toHaveLength(64);
        expect(facetNotifications - initialFacetNotifications).toBe(LIVE_PUBLICATION_SAMPLE_COUNT);
        await expect
          .element(screen.getByRole("checkbox", { name: "Select SYMBOL-LIVE-112, 1", exact: true }))
          .toBeChecked();
      }
      if (variant === "open-compound-filter")
        expect(
          screen
            .getByRole("dialog", { name: "Filter Column 1", exact: true })
            .element()
            .querySelectorAll('input[type="text"]'),
        ).toHaveLength(64);
      expect(countNotifications).toBe(initialCountNotifications);
      expect(activeCountNotifications).toBe(initialActiveCountNotifications);
      expect(activeCountSubscriptions).toBe(variant === "command-toolbar" ? 2 : 0);
      expect(commandRenders).toHaveBeenCalledTimes(variant === "command-toolbar" ? 1 : 0);
      expect(countSubscriptions).toBe(
        variant === "row-counts" || variant === "command-toolbar" ? 2 : 0,
      );
      expect(sortRenders).toEqual(initialSortRenders);
      if (variant === "open-sort-controls")
        expect(
          await screen
            .getByRole("list", { name: "Active sorts", exact: true })
            .getByRole("listitem")
            .all(),
        ).toHaveLength(64);
      if (variant === "open-sort-picker")
        expect(await screen.getByRole("option").all()).toHaveLength(149);
      expect(columnSettingsRenders).toEqual(initialColumnSettingsRenders);
      if (variant === "open-column-visibility")
        expect(
          screen.getByRole("listbox").element().querySelectorAll('[role="option"]'),
        ).toHaveLength(150);
      expect(quickFilterRenders).toBe(initialQuickFilterRenders);
      if (variant === "quick-filter")
        await expect
          .element(screen.getByRole("searchbox", { name: "Quick Filter", exact: true }))
          .toHaveValue("SYMBOL");
      expect(activeFilterRenders).toBe(initialActiveFilterRenders);
      if (variant === "open-active-filters")
        expect(
          screen
            .getByRole("dialog", { name: "Active filters", exact: true })
            .getByRole("button", { name: /^Remove / })
            .all(),
        ).toHaveLength(64);
      if (variant === "open-active-filters")
        await expect
          .element(screen.getByRole("dialog", { name: "Active filters", exact: true }))
          .toBeVisible();
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
      removeSelectionRenders();
      removeSourceRenders();
      removeGrid();
      removeView();
      removeReconciliation();
      removeSortRender();
      removeColumnSettingsRender();
      removeQuickFilterRender();
      removeActiveFilterRender();
      removeFilterRender();
      removeFilterTrigger();
      removeFacet();
      removeCountSubscriptions();
    }
  },
);
