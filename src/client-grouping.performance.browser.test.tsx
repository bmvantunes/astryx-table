import { Profiler, createElement, useEffect, useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";
import {
  captureAstryxTableReactCommitWork,
  finalizeAstryxTableBenchmarkEvidence,
} from "../packages/table/src/internal/benchmark-budget";
import { getAstryxTableBenchmarkEnvironment } from "../packages/table/src/internal/benchmark-profile";
import {
  installAstryxTableClientReconciliationListener,
  type AstryxTableClientReconciliationEvent,
} from "../packages/table/src/internal/client-source-adapter";
import { installAstryxTableClientGridSurfaceRenderListenerForTable } from "../packages/table/src/internal/render-instrumentation";
import { installAstryxTableSortControlRenderListener } from "../packages/table/src/internal/sort-control-instrumentation";
import { measureMutationObserverWork } from "./performance-observers";
import "./styles.css";

type Row = {
  id: string;
  region: string;
  active: boolean;
  desk: string;
  amount: bigint;
  price: number;
};
// Same resident workload as the retained grouping benchmark: two keys, four aggregates.
const rows: readonly Row[] = Array.from({ length: 2000 }, (_, index) => ({
  id: `row-${index}`,
  region: `region-${index % 25}`,
  active: index % 2 === 0,
  desk: `desk-${index % 80}`,
  amount: BigInt(index + 1),
  price: (index % 1000) / 10,
}));
const nativeFrame = window.requestAnimationFrame.bind(window);
const nextFrame = () => new Promise<number>((resolve) => nativeFrame(resolve));
afterEach(cleanup);

test(
  "grouped 20 Hz publications account for complete two-key four-aggregate work over 2,000 rows",
  { timeout: 20_000 },
  async ({ annotate }) => {
    expect(import.meta.env.MODE).toBe("production");
    expect(__ASTRYX_TABLE_DEVELOPMENT__).toBe(false);
    expect(__ASTRYX_TABLE_TEST_DIAGNOSTICS__).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(createElement("div"), "_store")).toBe(false);
    const tableId = "production-grouped-live";
    const aggregateRenderer = vi.fn(
      ({ value }: { readonly value: bigint }) => `sum ${String(value)}`,
    );
    const columns = [
      {
        columnId: "COL_ID_REGION",
        field: "region",
        headerName: "Region",
        valueType: "text",
        groupBy: true,
      },
      {
        columnId: "COL_ID_ACTIVE",
        field: "active",
        headerName: "Active",
        valueType: "boolean",
        groupBy: true,
      },
      {
        columnId: "COL_ID_SUM",
        field: "amount",
        headerName: "Amount sum",
        valueType: "bigint",
        aggFunc: "sum",
        aggregateCellRenderer: aggregateRenderer,
      },
      {
        columnId: "COL_ID_MAX",
        field: "amount",
        headerName: "Amount maximum",
        valueType: "bigint",
        aggFunc: "max",
      },
      {
        columnId: "COL_ID_PRICE",
        field: "price",
        headerName: "Price maximum",
        valueType: "number",
        aggFunc: "max",
      },
      {
        columnId: "COL_ID_DESKS",
        field: "desk",
        headerName: "Distinct desks",
        valueType: "text",
        aggFunc: "countDistinct",
      },
    ] as const satisfies AstryxTableColumns<Row>;
    const preferences = {
      version: 1 as const,
      tableId,
      filters: [],
      orderBy: [{ columnId: "COL_ID_SUM", direction: "asc" }] as const,
      groupBy: ["COL_ID_REGION", "COL_ID_ACTIVE"] as const,
      groupOrderBy: [
        { columnId: "COL_ID_REGION", direction: "asc" },
        { columnId: "COL_ID_ACTIVE", direction: "asc" },
      ] as const,
      columnOrder: columns.map((column) => column.columnId),
      columnVisibility: {},
      columnWidths: {},
      columnPinning: { start: [], end: [] },
    };
    type Phase = { callbacks: number; react: number };
    type Sample = {
      index: number;
      admission: number;
      phases: Phase[];
      phase: number;
      observers: number;
      commits: number;
      text?: string | null;
      complete: boolean;
    };
    const samples: Sample[] = [];
    let active: Sample | undefined;
    let recording = false;
    let start: (() => void) | undefined;
    let observed: Element | undefined;
    let overlaps = 0;
    let unowned = 0;
    let referenceViolations = 0;
    const events: AstryxTableClientReconciliationEvent[] = [];
    const removeReconciliation = installAstryxTableClientReconciliationListener((event) => {
      if (recording) events.push(event);
    });
    let surfaces = 0;
    let sortRenders = 0;
    const removeSurface = installAstryxTableClientGridSurfaceRenderListenerForTable(
      tableId,
      () => surfaces++,
    );
    const removeSort = installAstryxTableSortControlRenderListener(() => sortRenders++);
    const observers = measureMutationObserverWork((duration) => {
      if (!recording) return;
      if (active) active.observers += duration;
      else unowned++;
    });
    const queued = new Set<number>();
    let restoreFrames: (() => void) | undefined;
    function Harness() {
      const [source, setSource] = useState({ rows, version: 1 });
      useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        start = () => {
          recording = true;
          timer = setInterval(() => {
            if (active && !active.complete) overlaps += 1;
            const sample: Sample = {
              index: samples.length + 1,
              admission: 0,
              phases: Array.from({ length: 3 }, () => ({ callbacks: 0, react: 0 })),
              phase: 0,
              observers: 0,
              commits: 0,
              complete: false,
            };
            samples.push(sample);
            active = sample;
            const started = performance.now();
            setSource((current) => {
              const next = current.rows.with(0, {
                ...current.rows[0]!,
                amount: BigInt(sample.index + 1),
              });
              if (current.rows[1] !== rows[1] || next[1] !== rows[1]) referenceViolations += 1;
              return { rows: next, version: current.version + 1 };
            });
            sample.admission = performance.now() - started;
            // Presentation completes after two frames, matching the retained 20 Hz
            // protocol. Keep any following deferred/idle work owned by this sample
            // until the next publication (including the final post-run drain).
            nativeFrame(() => {
              sample.phase = 1;
              nativeFrame(() => {
                sample.text = observed?.textContent;
                sample.complete = true;
                sample.phase = 2;
              });
            });
            if (samples.length === 112) clearInterval(timer);
          }, 50);
        };
        return () => {
          clearInterval(timer);
          start = undefined;
        };
      }, []);
      return (
        <AstryxTableClient
          tableId={tableId}
          columns={columns}
          initialOrderBy={preferences.orderBy}
          initialPersistedState={preferences}
          getRowId={(row: Row) => row.id}
          clientSource={{ ...source, totalRows: source.rows.length, status: "ready" }}
        />
      );
    }
    try {
      await render(
        <Profiler
          id={tableId}
          onRender={(_id, _phase, actualDuration, _baseDuration, startTime, commitTime) => {
            if (!recording) return;
            if (!active) {
              unowned++;
              return;
            }
            active.commits++;
            active.phases[active.phase]!.react += captureAstryxTableReactCommitWork({
              actualDurationMs: actualDuration,
              commitTimeMs: commitTime,
              observedAtMs: performance.now(),
              startTimeMs: startTime,
            }).durationMs;
          }}
        >
          <div style={{ width: 1200 }}>
            <Harness />
          </div>
        </Profiler>,
      );
      await expect
        .element(page.getByRole("gridcell", { name: "sum 39040", exact: true }))
        .toBeVisible();
      const grid = page.getByRole("grid").element();
      expect(grid).toHaveAttribute("aria-rowcount", "51");
      expect(grid).toHaveAttribute("aria-colcount", "7");
      observed = page.getByRole("gridcell", { name: "sum 39040", exact: true }).element();
      await nextFrame();
      await nextFrame();
      await nextFrame();
      const initialSurfaces = surfaces;
      const initialSort = sortRenders;
      const initialRenders = aggregateRenderer.mock.calls.length;
      expect(initialRenders).toBeGreaterThan(0);
      const nativeCancel = window.cancelAnimationFrame.bind(window);
      const frameProbe = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((callback) => {
          const id = nativeFrame((timestamp) => {
            queued.delete(id);
            const sample = active;
            const phase = sample?.phases[sample.phase];
            const started = performance.now();
            try {
              callback(timestamp);
            } finally {
              if (recording && !sample) unowned++;
              if (phase) phase.callbacks += performance.now() - started;
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
        frameProbe.mockRestore();
        cancelProbe.mockRestore();
      };
      expect(start).toBeDefined();
      start!();
      await vi.waitFor(
        () => {
          expect(samples).toHaveLength(112);
          expect(samples.every((sample) => sample.complete)).toBe(true);
        },
        { timeout: 11_000 },
      );
      await nextFrame();
      await nextFrame();
      expect(queued.size).toBe(0);
      expect(overlaps).toBe(0);
      expect(unowned).toBe(0);
      expect(referenceViolations).toBe(0);
      expect(events).toHaveLength(112);
      for (const event of events)
        expect(event).toMatchObject({
          changedRows: 1,
          identityPatches: 1,
          rebuiltIdentityIndex: false,
          rebuiltSourceSequence: false,
          residentRows: 2000,
          resolvedRowIds: 1,
        });
      for (const sample of samples) {
        expect(sample.commits).toBeGreaterThan(0);
        expect(sample.text).toBe(`sum ${39040 + sample.index}`);
      }
      expect(surfaces).toBe(initialSurfaces);
      expect(sortRenders).toBe(initialSort);
      expect(aggregateRenderer.mock.calls.length).toBe(initialRenders + 112);
      expect(grid.querySelectorAll('[role="row"]').length).toBeLessThanOrEqual(33);
      const evidence = finalizeAstryxTableBenchmarkEvidence(
        samples.map(
          (sample) =>
            sample.admission +
            sample.phases.reduce(
              (total, phase) => total + Math.max(phase.callbacks, phase.react),
              0,
            ) +
            sample.observers,
        ),
        {
          environment: getAstryxTableBenchmarkEnvironment(),
          scenario: "client-grouped-live-publication-2000x2keysx4aggregates-20hz",
          profile: "chromium-capable-hardware-v1",
          warmupSampleCount: 12,
          measuredSampleCount: 100,
          budgetMs: 8.33,
          droppedFrameThresholdMs: 16.66,
          maxDroppedFrameCount: 2,
        },
      );
      await annotate(
        JSON.stringify({ benchmark: "AstryxTable grouped live production evidence", evidence }),
        "benchmark",
      );
    } finally {
      recording = false;
      restoreFrames?.();
      observers.restore();
      removeSurface();
      removeSort();
      removeReconciliation();
    }
  },
);
