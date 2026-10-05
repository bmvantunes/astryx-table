import { afterEach, expect, test, vi } from "vite-plus/test";
import { cleanup, render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { act, StrictMode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Effect, Schema } from "effect";
import { defineViewServerConfig, ViewServerId } from "effect-view-server/config";
import { createViewServerReact } from "effect-view-server/react";
import { createInMemoryViewServerReact } from "effect-view-server/react/testing";
import {
  AstryxTableServer,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; amount: number };
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
type Sink = {
  setRowCount: (count: number, retain?: boolean) => void;
  setRowData: (
    rows: Readonly<Record<number, Partial<Row>>>,
    keys: Readonly<Record<number, string>>,
  ) => void;
};
const columns = [
  {
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    valueType: "text",
    pinned: "start",
    width: 180,
  },
  {
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    valueType: "number",
    width: 180,
  },
] as const satisfies AstryxTableColumns<Row>;
const completeRawSelect = Object.freeze([
  "id",
  "name",
  "amount",
]) as unknown as Source["completeRawSelect"];
function fixture(totalRows = 100, publishCount = true) {
  const requests: { query: unknown; sink: Sink; window: { firstRow: number; lastRow: number } }[] =
    [];
  const windows: { firstRow: number; lastRow: number }[] = [];
  const release = vi.fn();
  const viewport = {
    semanticKey: (query: unknown) => JSON.stringify(query),
    replace(request: {
      query: unknown;
      sink: Sink;
      window: { firstRow: number; lastRow: number };
    }) {
      requests.push(request);
      if (publishCount) request.sink.setRowCount(totalRows, true);
      return {
        setWindow: (window: { firstRow: number; lastRow: number }) => windows.push(window),
        release,
      };
    },
  } as unknown as Omit<Source["viewport"], "destroy">;
  const props = {
    tableId: "server-viewport",
    columns,
    initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
    viewportSource: {
      viewport,
      completeRawSelect,
      useWholeResult: () => ({ rows: [], totalRows: 0, version: 1, status: "ready" as const }),
      totalRows,
      version: 1,
      status: "ready" as const,
    },
  };
  return { requests, windows, release, props };
}

function groupedProps(f: ReturnType<typeof fixture>) {
  return {
    ...f.props,
    columns: [
      { ...columns[0], groupBy: true },
      { ...columns[1], aggFunc: "max" },
    ] as const satisfies AstryxTableColumns<Row>,
    initialPersistedState: {
      version: 1 as const,
      tableId: f.props.tableId,
      filters: [],
      orderBy: f.props.initialOrderBy,
      groupBy: ["COL_ID_NAME"] as const,
      groupOrderBy: f.props.initialOrderBy,
      columnOrder: ["COL_ID_NAME", "COL_ID_AMOUNT"] as const,
      columnVisibility: {},
      columnWidths: {},
      columnPinning: { start: [], end: [] },
    },
  };
}

test.each(["replacement", "shrink", "move"] as const)(
  "grouped Server reconciles active identity and column after %s",
  async (change) => {
    const f = fixture(3);
    const screen = await render(<AstryxTableServer {...groupedProps(f)} />);
    const request = f.requests[0]!;
    const query = request.query as { aggregates: Record<string, { aggFunc: string }> };
    const count = Object.entries(query.aggregates).find(([, v]) => v.aggFunc === "count")![0];
    const max = Object.entries(query.aggregates).find(([, v]) => v.aggFunc === "max")![0];
    const row = (name: string, amount: number) => ({ name, [count]: 2n, [max]: amount });
    request.sink.setRowData(
      { 0: row("First", 42), 1: row("Second", 43), 2: row("Third", 44) },
      { 0: "first-group", 1: "second-group", 2: "third-group" },
    );
    await screen.getByRole("gridcell", { name: "44", exact: true }).click();
    const grid = screen.getByRole("grid");
    if (change === "replacement")
      request.sink.setRowData({ 2: row("Fourth", 45) }, { 2: "fourth-group" });
    else if (change === "shrink") request.sink.setRowCount(2, true);
    else
      request.sink.setRowData(
        { 0: row("Third", 44), 2: row("First", 42) },
        { 0: "third-group", 2: "first-group" },
      );
    const expected = change === "replacement" ? "45" : change === "shrink" ? "43" : "44";
    await expect
      .element(screen.getByRole("gridcell", { name: expected, exact: true }))
      .toBeInTheDocument();
    await expect
      .poll(() => grid.element().getAttribute("aria-activedescendant"))
      .toBe(screen.getByRole("gridcell", { name: expected, exact: true }).element().id);
    await expect.element(grid).toHaveFocus();
    expect(grid.element().scrollTop).toBe(0);
    expect(f.requests).toHaveLength(1);
  },
);

test("grouped provisional count remains unknown and busy until authoritative delivery", async () => {
  const f = fixture(100, false);
  const screen = await render(<AstryxTableServer {...groupedProps(f)} />);
  const grid = screen.getByRole("grid");
  await expect.element(grid).toHaveAttribute("aria-rowcount", "-1");
  await expect.element(grid).toHaveAttribute("aria-busy", "true");
  f.requests[0]!.sink.setRowCount(2, true);
  await expect.element(grid).toHaveAttribute("aria-rowcount", "3");
  const query = f.requests[0]!.query as { aggregates: Record<string, { aggFunc: string }> };
  const count = Object.entries(query.aggregates).find(([, v]) => v.aggFunc === "count")![0];
  const max = Object.entries(query.aggregates).find(([, v]) => v.aggFunc === "max")![0];
  f.requests[0]!.sink.setRowData(
    { 0: { name: "Ready group", [count]: 2n, [max]: 42 } },
    { 0: "ready-group" },
  );
  await expect.element(grid).not.toHaveAttribute("aria-busy", "true");
  expect(f.requests).toHaveLength(1);
});

test("masked source rows keep a loading Active Descendant and recover the source cell", async () => {
  const f = fixture();
  const screen = await render(<AstryxTableServer {...f.props} />);
  f.requests[0]!.sink.setRowData({ 0: { id: "raw", name: "Retained", amount: 42 } }, { 0: "key" });
  await screen.getByRole("gridcell", { name: "Retained", exact: true }).click();
  const grid = screen.getByRole("grid");
  await screen.rerender(
    <AstryxTableServer
      {...f.props}
      viewportSource={{ ...f.props.viewportSource, status: "loading" }}
    />,
  );
  await expect.element(grid).toHaveAttribute("aria-busy", "true");
  await expect
    .poll(() => {
      const id = grid.element().getAttribute("aria-activedescendant");
      return id === null ? null : document.getElementById(id)?.getAttribute("aria-label");
    })
    .toBe("Loading Name");
  await screen.rerender(<AstryxTableServer {...f.props} />);
  await expect
    .poll(() => grid.element().getAttribute("aria-activedescendant"))
    .toBe(screen.getByRole("gridcell", { name: "Retained", exact: true }).element().id);
  await expect.element(grid).not.toHaveAttribute("aria-busy", "true");
  expect(f.requests).toHaveLength(1);
});

test("evicted active identity has a bounded loading proxy and follows later authoritative movement", async () => {
  const f = fixture(1000);
  const screen = await render(<AstryxTableServer {...f.props} />);
  const sink = f.requests[0]!.sink;
  sink.setRowData({ 1: { id: "raw", name: "Retained", amount: 42 } }, { 1: "key" });
  await screen.getByRole("gridcell", { name: "Retained", exact: true }).click();
  const grid = screen.getByRole("grid");
  grid.element().scrollTop = 3600;
  grid.element().dispatchEvent(new Event("scroll"));
  await expect.poll(() => f.windows.at(-1)?.firstRow ?? 0).toBeGreaterThan(1);
  await expect
    .poll(() => {
      const id = grid.element().getAttribute("aria-activedescendant");
      return id === null ? null : document.getElementById(id)?.getAttribute("aria-label");
    })
    .toBe("Loading Name");
  const proxy = document.getElementById(grid.element().getAttribute("aria-activedescendant")!)!;
  expect(proxy.textContent).not.toContain("Retained");
  expect(proxy.closest('[role="row"]')).toHaveAttribute("aria-rowindex", "3");
  expect(grid.element().scrollTop).toBe(3600);
  await userEvent.keyboard("{ArrowRight}");
  await expect.poll(() => f.windows.at(-1)?.firstRow).toBeLessThanOrEqual(1);
  sink.setRowData(
    {
      1: { id: "other", name: "Replacement", amount: 1 },
      2: { id: "raw", name: "Retained", amount: 42 },
    },
    { 1: "replacement", 2: "key" },
  );
  await expect
    .element(screen.getByRole("gridcell", { name: "42", exact: true }))
    .toBeInTheDocument();
  await expect
    .poll(() => grid.element().getAttribute("aria-activedescendant"))
    .toBe(screen.getByRole("gridcell", { name: "42", exact: true }).element().id);
  expect(proxy.isConnected).toBe(false);
  expect(f.requests).toHaveLength(1);
});

test.each(["pinned", "unpinned", "suspended"] as const)(
  "a horizontally virtualized loading Active Cell belongs to its single ordered semantic row (%s)",
  async (pinning) => {
    const f = fixture(1000);
    const { pinned, ...firstColumn } = columns[0];
    const wide = [
      { ...firstColumn, ...(pinning === "unpinned" ? {} : { pinned }) },
      ...Array.from({ length: 24 }, (_, index) => ({
        ...columns[1],
        columnId: `COL_ID_AMOUNT_${index}` as Uppercase<`COL_ID_AMOUNT_${number}`>,
        headerName: `Amount ${index}`,
        ...(pinning === "suspended" && index === 23 ? { pinned: "end" as const } : {}),
      })),
    ] as const satisfies AstryxTableColumns<Row>;
    const screen = await render(
      <div style={{ width: pinning === "suspended" ? 430 : 1000 }}>
        <AstryxTableServer {...f.props} columns={wide} />
      </div>,
    );
    const grid = screen.getByRole("grid");
    const cell = screen.getByRole("gridcell", { name: "Loading Amount 0", exact: true }).first();
    await cell.click();
    const original = cell.element();
    grid.element().scrollLeft = 2500;
    grid.element().dispatchEvent(new Event("scroll"));
    await expect.poll(() => original.isConnected).toBe(false);
    const active = () =>
      document.getElementById(grid.element().getAttribute("aria-activedescendant") ?? "missing");
    await expect.poll(() => active()?.getAttribute("aria-label")).toBe("Loading Amount 0");
    const owners = () =>
      grid.element().querySelectorAll<HTMLElement>('[role="row"][aria-rowindex="2"]');
    await expect.poll(() => owners().length).toBe(1);
    expect(owners()[0]!.getAttribute("aria-owns")?.split(" ")).toContain(active()!.id);
    const owned = owners()[0]!.getAttribute("aria-owns")!.split(" ");
    const dom = [...owners()[0]!.querySelectorAll<HTMLElement>('[role="gridcell"]')];
    const accessible = [
      ...dom.filter((cell) => !owned.includes(cell.id)),
      ...owned.map((id) => document.getElementById(id)!),
    ];
    const order = accessible.map((cell) => Number(cell.getAttribute("aria-colindex")));
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(new Set(accessible).size).toBe(accessible.length);
    const proxy = active()!;
    grid.element().scrollTop = 3600;
    grid.element().dispatchEvent(new Event("scroll"));
    await expect.poll(() => f.windows.at(-1)?.firstRow ?? 0).toBeGreaterThan(0);
    await expect.poll(() => owners().length).toBe(1);
    expect(proxy.closest('[role="row"]')).toBe(owners()[0]);
    grid.element().scrollTop = 0;
    grid.element().dispatchEvent(new Event("scroll"));
    await expect.poll(() => f.windows.at(-1)?.firstRow).toBe(0);
    await expect.poll(() => owners().length).toBe(1);
    await expect.poll(() => owners()[0]!.getAttribute("aria-owns")?.split(" ")).toContain(proxy.id);
    grid.element().scrollLeft = 0;
    grid.element().dispatchEvent(new Event("scroll"));
    await expect.poll(() => proxy.isConnected).toBe(false);
    expect(owners()[0]!.getAttribute("aria-owns")?.split(" ")).not.toContain(proxy.id);
    await expect.element(grid).toHaveFocus();
  },
);

test("an outer loading Active Cell never adopts a nested grid's semantic row", async () => {
  const f = fixture(1000);
  const nestedColumns = [
    columns[0],
    {
      ...columns[1],
      cellRenderer: () => (
        <div role="grid" aria-label="Nested grid">
          <div role="row" aria-rowindex={2}>
            <div role="gridcell">Nested cell</div>
          </div>
        </div>
      ),
    },
  ] as const satisfies AstryxTableColumns<Row>;
  const screen = await render(<AstryxTableServer {...f.props} columns={nestedColumns} />);
  const sink = f.requests[0]!.sink;
  sink.setRowData({ 0: { id: "raw", name: "Retained", amount: 42 } }, { 0: "key" });
  await screen.getByRole("gridcell", { name: "Retained", exact: true }).click();
  const grid = screen.getByRole("grid", { name: f.props.tableId, exact: true });
  grid.element().scrollTop = 3600;
  grid.element().dispatchEvent(new Event("scroll"));
  await expect.poll(() => f.windows.at(-1)?.firstRow ?? 0).toBeGreaterThan(0);
  sink.setRowData({ 100: { id: "host", name: "Visible host", amount: 100 } }, { 100: "host-key" });
  const nested = screen.getByRole("grid", { name: "Nested grid", exact: true });
  await expect.element(nested).toBeInTheDocument();
  const ownRows = () =>
    [...grid.element().querySelectorAll<HTMLElement>('[role="row"][aria-rowindex="2"]')].filter(
      (row) => row.closest('[role="grid"]') === grid.element(),
    );
  await expect.poll(() => ownRows().length).toBe(1);
  const active = document.getElementById(grid.element().getAttribute("aria-activedescendant")!)!;
  expect(active.closest('[role="row"]')).toBe(ownRows()[0]);
  expect(nested.element().querySelector('[role="row"]')).not.toHaveAttribute("aria-owns");
  await expect.element(grid).toHaveFocus();
});

test("pointer activation of an unloaded pinned cell preserves the coordinate through delivery", async () => {
  const f = fixture();
  const screen = await render(<AstryxTableServer {...f.props} />);
  const target = screen.getByRole("gridcell", { name: "Loading Name", exact: true }).nth(3);
  await target.click();
  const grid = screen.getByRole("grid");
  await expect.element(grid).toHaveFocus();
  await expect
    .poll(() => grid.element().getAttribute("aria-activedescendant"))
    .toBe(target.element().id);
  f.requests[0]!.sink.setRowData(
    { 3: { id: "raw", name: "Pointer row", amount: 3 } },
    { 3: "pointer-key" },
  );
  await expect
    .element(screen.getByRole("gridcell", { name: "Pointer row", exact: true }))
    .toBeInTheDocument();
  await expect
    .poll(() => grid.element().getAttribute("aria-activedescendant"))
    .toBe(screen.getByRole("gridcell", { name: "Pointer row", exact: true }).element().id);
});

test("window movement preserves overlapping row shells and evicts departed slots inside one generation", async () => {
  const f = fixture(1000);
  const screen = await render(<AstryxTableServer {...f.props} />);
  const first = f.windows.at(-1) ?? f.requests[0]!.window;
  const rows: Record<number, Row> = {};
  const keys: Record<number, string> = {};
  for (let index = first.firstRow; index <= first.lastRow; index++) {
    rows[index] = { id: `raw-${index}`, name: `Record ${index}`, amount: index };
    keys[index] = `source-${index}`;
  }
  f.requests[0]!.sink.setRowData(rows, keys);
  const retained = screen.getByRole("gridcell", { name: "Record 12", exact: true });
  await expect.element(retained).toBeInTheDocument();
  const element = retained.element();
  const grid = screen.getByRole("grid").element();
  grid.scrollTop = 360;
  grid.dispatchEvent(new Event("scroll"));
  await expect.poll(() => f.windows.at(-1)?.firstRow ?? 0).toBeGreaterThan(0);
  const next = f.windows.at(-1)!;
  expect(next.firstRow).toBeLessThanOrEqual(12);
  expect(next.lastRow).toBeGreaterThan(first.lastRow);
  expect(retained.element()).toBe(element);
  const missing: Record<number, Row> = {};
  const missingKeys: Record<number, string> = {};
  for (let index = first.lastRow + 1; index <= next.lastRow; index++) {
    missing[index] = { id: `raw-${index}`, name: `Record ${index}`, amount: index };
    missingKeys[index] = `source-${index}`;
  }
  f.requests[0]!.sink.setRowData(missing, missingKeys);
  await expect
    .element(screen.getByRole("gridcell", { name: `Record ${next.lastRow}`, exact: true }))
    .toBeInTheDocument();
  expect(retained.element()).toBe(element);
  grid.scrollTop = 0;
  grid.dispatchEvent(new Event("scroll"));
  await expect.poll(() => f.windows.at(-1)?.firstRow).toBe(0);
  await expect
    .element(screen.getByRole("gridcell", { name: "Record 0", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "Loading Name", exact: true }).first())
    .toBeInTheDocument();
  expect(f.requests).toHaveLength(1);
  expect(f.release).not.toHaveBeenCalled();
});

test.each(["ltr", "rtl"] as const)(
  "%s narrow Server reaches a segmented sparse window without fabricating identities",
  async (direction) => {
    const f = fixture(20_000_000);
    const screen = await render(
      <div dir={direction} style={{ width: 180 }}>
        <AstryxTableServer {...f.props} />
      </div>,
    );
    const grid = screen.getByRole("grid").element();
    expect(grid.scrollHeight).toBeLessThan(20_000_000);
    grid.scrollTop = grid.scrollHeight - grid.clientHeight;
    grid.dispatchEvent(new Event("scroll"));
    await expect.poll(() => f.windows.at(-1)?.lastRow ?? 0).toBe(19_999_999);
    f.requests[0]!.sink.setRowData(
      { 19_999_999: { id: "raw-last", name: "Last sparse record", amount: 7 } },
      { 19_999_999: "authoritative-last" },
    );
    await expect
      .element(screen.getByRole("gridcell", { name: "Last sparse record", exact: true }))
      .toHaveAttribute("data-astryx-row-id", "authoritative-last");
    expect(grid.querySelectorAll('[role="row"]').length).toBeLessThan(40);
    expect(f.requests).toHaveLength(1);
  },
);

test("hydrates provisional loading and admits the first source count without replacing its generation", async () => {
  const f = fixture(100, false);
  const table = (
    <AstryxTableServer
      {...f.props}
      viewportSource={{ ...f.props.viewportSource, status: "loading" }}
    />
  );
  const host = document.createElement("div");
  host.innerHTML = renderToString(table);
  document.body.append(host);
  expect(f.requests).toHaveLength(0);
  const recoverable = vi.fn();
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(host, table, { onRecoverableError: recoverable });
    });
    expect(f.requests).toHaveLength(1);
    expect(recoverable).not.toHaveBeenCalled();
    await act(async () => {
      f.requests[0]!.sink.setRowCount(100, true);
      root!.render(<AstryxTableServer {...f.props} />);
      f.requests[0]!.sink.setRowData(
        { 0: { id: "raw", name: "Hydrated", amount: 42 } },
        { 0: "hydrated-key" },
      );
    });
    const cells = [...host.querySelectorAll('[role="gridcell"]')];
    expect(cells.some((cell) => cell.textContent === "Hydrated")).toBe(true);
    expect(f.requests).toHaveLength(1);
    expect(recoverable).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount());
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
    host.remove();
  }
});

test("stationary sparse deliveries replace loading cells using source keys, including pinned cells", async () => {
  const f = fixture();
  const screen = await render(<AstryxTableServer {...f.props} />);
  await expect
    .element(screen.getByRole("gridcell", { name: "Loading Name" }).first())
    .toBeInTheDocument();
  expect(f.requests).toHaveLength(1);
  f.requests[0]!.sink.setRowData(
    { 0: { id: "raw-id", name: "Ada", amount: 42 } },
    { 0: "source-key" },
  );
  await expect
    .element(screen.getByRole("gridcell", { name: "Ada", exact: true }))
    .toHaveAttribute("data-astryx-row-id", "source-key");
  await expect
    .element(screen.getByRole("gridcell", { name: "42", exact: true }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "Loading Amount" }).first())
    .toBeInTheDocument();
  expect(f.requests).toHaveLength(1);
  const owned = document
    .querySelector('[role="row"][aria-rowindex="2"]')!
    .getAttribute("aria-owns")!
    .split(" ");
  expect(owned).toHaveLength(2);
  expect(owned.every((id) => document.getElementById(id) !== null)).toBe(true);
});

test("loading scroll continues to publish source windows without replacing the query", async () => {
  const f = fixture(1000);
  const screen = await render(
    <AstryxTableServer
      {...f.props}
      viewportSource={{ ...f.props.viewportSource, status: "loading" }}
    />,
  );
  const grid = screen.getByRole("grid");
  await expect.element(grid).toBeInTheDocument();
  grid.element().scrollTop = 1800;
  grid.element().dispatchEvent(new Event("scroll"));
  await expect.poll(() => f.windows.some((window) => window.firstRow > 0)).toBe(true);
  expect(f.requests).toHaveLength(1);
});

test("new query rejects old deliveries and installs only its authoritative identities", async () => {
  const f = fixture();
  const screen = await render(<AstryxTableServer {...f.props} />);
  f.requests[0]!.sink.setRowData({ 0: { id: "a", name: "Old", amount: 1 } }, { 0: "old-key" });
  await expect
    .element(screen.getByRole("gridcell", { name: "Old", exact: true }))
    .toBeInTheDocument();
  const old = f.requests[0]!.sink;
  await screen.rerender(
    <AstryxTableServer
      {...f.props}
      externalFilters={[{ field: "name", type: "equals", filter: "New" }]}
    />,
  );
  await expect.poll(() => f.requests.length).toBe(2);
  old.setRowData({ 0: { id: "a", name: "Late", amount: 2 } }, { 0: "late-key" });
  await expect
    .element(screen.getByRole("gridcell", { name: "Old", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "Late", exact: true }))
    .not.toBeInTheDocument();
  f.requests[1]!.sink.setRowData({ 0: { id: "b", name: "New", amount: 3 } }, { 0: "new-key" });
  await expect
    .element(screen.getByRole("gridcell", { name: "New", exact: true }))
    .toHaveAttribute("data-astryx-row-id", "new-key");
  expect(f.release).toHaveBeenCalledOnce();
});

test.each(["stale", "closed", "error"] as const)(
  "%s retains same-generation rows and source-owned counts",
  async (status) => {
    const f = fixture(1000);
    const content = (
      <>
        <AstryxTableResultRowCount />
        <AstryxTableLoadedRowCount />
      </>
    );
    const screen = await render(<AstryxTableServer {...f.props}>{content}</AstryxTableServer>);
    f.requests[0]!.sink.setRowData(
      { 0: { id: "a", name: "Retained", amount: 1 } },
      { 0: "retained-key" },
    );
    const run = vi.fn();
    await screen.rerender(
      <AstryxTableServer
        {...f.props}
        viewportSource={{ ...f.props.viewportSource, status, retry: { run, pending: false } }}
      >
        {content}
      </AstryxTableServer>,
    );
    await expect
      .element(screen.getByRole("gridcell", { name: "Retained", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByRole(status === "closed" ? "status" : "alert").filter({
          hasText:
            status === "closed"
              ? "Live updates stopped"
              : status === "stale"
                ? "Live data delayed"
                : "Live data error",
        }),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("status", { name: "Result rows" }))
      .toHaveTextContent("1000 result rows");
    await expect
      .element(screen.getByRole("status", { name: "Loaded rows" }))
      .toHaveTextContent("1 loaded row");
    expect(f.requests).toHaveLength(1);
    if (status !== "stale") {
      await screen.getByRole("button", { name: "Retry", exact: true }).click();
      expect(run).toHaveBeenCalledOnce();
    }
  },
);

test("keyboard navigation exposes the unresolved cell and adopts the delivered source identity", async () => {
  const f = fixture();
  const screen = await render(<AstryxTableServer {...f.props} />);
  const grid = screen.getByRole("grid");
  grid.element().focus();
  await userEvent.keyboard("{ArrowDown}");
  await expect
    .poll(() => {
      const id = grid.element().getAttribute("aria-activedescendant");
      return id === null ? null : document.getElementById(id)?.getAttribute("aria-label");
    })
    .toBe("Loading Name");
  f.requests[0]!.sink.setRowData(
    { 1: { id: "a", name: "Arrived", amount: 1 } },
    { 1: "arrived-key" },
  );
  await expect
    .element(screen.getByRole("gridcell", { name: "Arrived", exact: true }))
    .toBeInTheDocument();
  await expect
    .poll(() => grid.element().getAttribute("aria-activedescendant"))
    .toBe(screen.getByRole("gridcell", { name: "Arrived", exact: true }).element().id);
});

test("a conflicting source key clears the active cell and later publications do not reactivate it", async () => {
  const f = fixture();
  const screen = await render(<AstryxTableServer {...f.props} />);
  const sink = f.requests[0]!.sink;
  sink.setRowData({ 0: { id: "a", name: "Original", amount: 1 } }, { 0: "original-key" });
  await expect
    .element(screen.getByRole("gridcell", { name: "Original", exact: true }))
    .toBeInTheDocument();
  const grid = screen.getByRole("grid");
  grid.element().focus();
  await expect
    .poll(() => grid.element().getAttribute("aria-activedescendant"))
    .toBe(screen.getByRole("gridcell", { name: "Original", exact: true }).element().id);
  sink.setRowData({ 0: { id: "b", name: "Replacement", amount: 2 } }, { 0: "replacement-key" });
  await expect
    .element(screen.getByRole("gridcell", { name: "Replacement", exact: true }))
    .toBeInTheDocument();
  await expect.poll(() => grid.element().getAttribute("aria-activedescendant")).toBeNull();
  sink.setRowData({ 0: { id: "b", name: "Changed again", amount: 3 } }, { 0: "replacement-key" });
  await expect
    .element(screen.getByRole("gridcell", { name: "Changed again", exact: true }))
    .toBeInTheDocument();
  expect(grid.element().getAttribute("aria-activedescendant")).toBeNull();
  await expect.element(grid).toHaveFocus();
});

test("restored Server grouping renders its compiled projection without calling raw formatters", async () => {
  const f = fixture(1);
  const rawFormatter = vi.fn(() => "Wrong raw callback");
  const grouped = [
    { ...columns[0], groupBy: true, valueFormatter: rawFormatter },
    { ...columns[1], aggFunc: "max" },
  ] as const satisfies AstryxTableColumns<Row>;
  const screen = await render(
    <AstryxTableServer
      {...f.props}
      columns={grouped}
      initialPersistedState={{
        version: 1,
        tableId: f.props.tableId,
        filters: [],
        orderBy: f.props.initialOrderBy,
        groupBy: ["COL_ID_NAME"],
        groupOrderBy: f.props.initialOrderBy,
        columnOrder: ["COL_ID_NAME", "COL_ID_AMOUNT"],
        columnVisibility: {},
        columnWidths: {},
        columnPinning: { start: [], end: [] },
      }}
    />,
  );
  const query = f.requests[0]!.query as { aggregates: Record<string, { aggFunc: string }> };
  const count = Object.entries(query.aggregates).find(([, value]) => value.aggFunc === "count")![0];
  const max = Object.entries(query.aggregates).find(([, value]) => value.aggFunc === "max")![0];
  f.requests[0]!.sink.setRowData(
    { 0: { name: "Grouped", [count]: 2n, [max]: 42 } },
    { 0: "group-source-key" },
  );
  await expect
    .element(screen.getByRole("gridcell", { name: "Grouped", exact: true }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole("columnheader", { name: "Rows", exact: true }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "2", exact: true }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "42", exact: true }))
    .toBeInTheDocument();
  expect(rawFormatter).not.toHaveBeenCalled();
});

test("published View Server hook delivers real rows and releases cleanly in Strict Mode", async () => {
  const source = createInMemoryViewServerReact(binding);
  function ActualTable() {
    const viewportSource = binding.useLiveQueryViewport("orders");
    return (
      <AstryxTableServer
        tableId="real-server"
        columns={columns}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        viewportSource={viewportSource}
      />
    );
  }
  try {
    const screen = await render(
      <StrictMode>
        <source.ViewServerInMemoryProvider>
          <ActualTable />
        </source.ViewServerInMemoryProvider>
      </StrictMode>,
    );
    await Effect.runPromise(
      source.client.publish("orders", { id: "real-row", name: "Real source", amount: 42 }),
    );
    await expect
      .element(screen.getByRole("gridcell", { name: "Real source", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("gridcell", { name: "42", exact: true }))
      .toBeInTheDocument();
    await screen.unmount();
  } finally {
    await cleanup();
    await Effect.runPromise(source.close);
  }
});
