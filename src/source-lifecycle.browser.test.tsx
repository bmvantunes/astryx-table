import { afterEach, expect, test, vi } from "vite-plus/test";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableFilterControl,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
] as const satisfies AstryxTableColumns<Row>;
const rows: readonly Row[] = [{ id: "a", name: "Ada" }];
const ready = { rows, totalRows: 1, version: 1, status: "ready" as const };
const props = {
  tableId: "source-lifecycle",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
};

test("terminal source chrome retains coherent rows and invokes only the current source-owned Retry", async () => {
  const run = vi.fn();
  const nextRun = vi.fn();
  const screen = await render(
    <AstryxTableClient
      {...props}
      clientSource={{
        ...ready,
        status: "error",
        message: "Connection lost",
        statusCode: "OFFLINE",
        retry: { run, pending: false },
      }}
    />,
  );
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Live data error");
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Connection lost · OFFLINE");
  await expect.element(screen.getByRole("gridcell", { name: "Ada" })).toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "Retry", exact: true });
  expect(run).not.toHaveBeenCalled();
  await retry.click();
  expect(run).toHaveBeenCalledOnce();
  await screen.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{ ...ready, status: "closed", retry: { run: nextRun, pending: false } }}
    />,
  );
  await retry.click();
  expect(nextRun).toHaveBeenCalledOnce();
  expect(run).toHaveBeenCalledOnce();
  await screen.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{
        ...ready,
        status: "stale",
        message: "Delayed",
        retry: { run, pending: false },
      }}
    />,
  );
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Live data delayed");
  await expect.element(retry).not.toBeInTheDocument();
  await expect.element(screen.getByRole("gridcell", { name: "Ada" })).toBeInTheDocument();
  expect(run).toHaveBeenCalledOnce();
});

test("loading hides candidate rows and stale recovers only earlier coherent rows", async () => {
  const screen = await render(<AstryxTableClient {...props} clientSource={ready} />);
  await expect.element(screen.getByRole("gridcell", { name: "Ada" })).toBeInTheDocument();
  const candidate = [{ id: "a", name: "Unconfirmed" }];
  await screen.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{ rows: candidate, totalRows: 1, version: 2, status: "loading" }}
    />,
  );
  const loading = screen.getByRole("grid", { name: "Loading table rows" });
  await expect.element(loading).toHaveAttribute("aria-busy", "true");
  await expect.element(loading).toHaveAttribute("aria-rowcount", "1");
  await expect.element(screen.getByRole("gridcell", { name: "Loading Name" })).toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "Unconfirmed" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("gridcell", { name: "Ada" })).not.toBeInTheDocument();
  await screen.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{ rows: [], totalRows: 1, version: 3, status: "stale", message: "Delayed" }}
    />,
  );
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Live data delayed");
  await expect.element(screen.getByRole("gridcell", { name: "Ada" })).toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "Unconfirmed" }))
    .not.toBeInTheDocument();
});

test("empty error owns its message and Retry keeps focus while pending then recovers safely", async () => {
  const run = vi.fn();
  const source = {
    rows: [],
    totalRows: 0,
    version: 1,
    status: "error" as const,
    message: "No connection",
    retry: { run, pending: false },
  };
  const screen = await render(<AstryxTableClient {...props} clientSource={source} />);
  await expect.element(screen.getByRole("alert")).toHaveTextContent("No connection");
  await expect
    .element(screen.getByRole("status", { name: `${props.tableId} status`, exact: true }))
    .not.toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "Retry", exact: true });
  await retry.click();
  await screen.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{ ...source, version: 2, retry: { run, pending: true } }}
    />,
  );
  await expect.element(retry).toHaveAttribute("aria-disabled", "true");
  expect(document.activeElement).toBe(retry.element());
  (retry.element() as HTMLButtonElement).click();
  expect(run).toHaveBeenCalledOnce();
  await screen.rerender(<AstryxTableClient {...props} clientSource={ready} />);
  await expect.element(retry).not.toBeInTheDocument();
  await vi.waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: props.tableId, exact: true }).element(),
    ),
  );
  await expect.element(screen.getByRole("gridcell", { name: "Ada" })).toBeInTheDocument();
});

test("grid focus follows ready/loading transitions without stealing outside focus", async () => {
  const screen = await render(
    <>
      <button type="button">Outside</button>
      <AstryxTableClient {...props} clientSource={ready} />
    </>,
  );
  const grid = screen.getByRole("grid", { name: props.tableId, exact: true });
  (grid.element() as HTMLElement).focus();
  const loadingSource = { rows: [], totalRows: 10, version: 2, status: "loading" as const };
  await screen.rerender(
    <>
      <button type="button">Outside</button>
      <AstryxTableClient {...props} clientSource={loadingSource} />
    </>,
  );
  const loading = screen.getByRole("grid", { name: "Loading table rows" });
  await vi.waitFor(() => expect(document.activeElement).toBe(loading.element()));
  await screen.rerender(
    <>
      <button type="button">Outside</button>
      <AstryxTableClient {...props} clientSource={ready} />
    </>,
  );
  await vi.waitFor(() => expect(document.activeElement).toBe(grid.element()));
  await screen.getByRole("button", { name: "Outside", exact: true }).click();
  await screen.rerender(
    <>
      <button type="button">Outside</button>
      <AstryxTableClient {...props} clientSource={loadingSource} />
    </>,
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Outside", exact: true }).element(),
  );
});

test("loading virtualizes both axes and keeps native skeleton cells fixed-height and pinned", async () => {
  const wideColumns = Array.from({ length: 150 }, (_, i) => ({
    columnId: `COL_ID_C${i}` as Uppercase<`COL_ID_C${number}`>,
    headerName: `Column ${i}`,
    field: "name",
    valueType: "text",
    width: 120,
    ...(i === 0 ? { pinned: "start" as const } : i === 149 ? { pinned: "end" as const } : {}),
  })) satisfies AstryxTableColumns<Row>;
  const wide = {
    ...props,
    columns: wideColumns,
    initialOrderBy: [{ columnId: "COL_ID_C0", direction: "asc" }] as const,
    clientSource: { rows: [], totalRows: 5000, version: 1, status: "loading" as const },
  };
  const screen = await render(
    <div style={{ width: 850 }}>
      <AstryxTableClient {...wide} />
    </div>,
  );
  const grid = screen.getByRole("grid", { name: "Loading table rows" });
  await expect.element(grid).toHaveAttribute("aria-rowcount", "5000");
  await expect.element(grid).toHaveAttribute("aria-colcount", "150");
  await vi.waitFor(() => {
    const first = screen
      .getByRole("gridcell", { name: "Loading Column 0", exact: true })
      .nth(0)
      .element();
    const last = screen
      .getByRole("gridcell", { name: "Loading Column 149", exact: true })
      .nth(0)
      .element();
    expect(first.getBoundingClientRect().height).toBe(36);
    expect(first.getBoundingClientRect().width).toBe(120);
    expect(first.getBoundingClientRect().left).toBeCloseTo(
      grid.element().getBoundingClientRect().left,
      0,
    );
    expect(last.getBoundingClientRect().right).toBeCloseTo(
      grid.element().getBoundingClientRect().right,
      0,
    );
  });
  expect(screen.getByRole("row").elements().length).toBeLessThan(100);
  expect(screen.getByRole("gridcell").elements().length).toBeLessThan(1000);
  for (const row of screen.getByRole("row").elements()) {
    const owned = row.getAttribute("aria-owns")?.split(" ") ?? [];
    expect(owned.length).toBeGreaterThan(0);
    for (const id of owned) expect(grid.element().querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
  }
  (grid.element() as HTMLElement).scrollTo({ left: 4000, top: 1200 });
  await vi.waitFor(() =>
    expect(
      Number(screen.getByRole("row").nth(0).element().getAttribute("aria-rowindex")),
    ).toBeGreaterThan(1),
  );
  await expect
    .element(screen.getByRole("gridcell", { name: "Loading Column 149", exact: true }).nth(0))
    .toBeInTheDocument();
  expect(screen.getByRole("gridcell").elements().length).toBeLessThan(1000);
});

test.for(["stale", "closed", "error"] as const)(
  "%s keeps earlier coherent rows through an empty lifecycle publication",
  async (status) => {
    const screen = await render(<AstryxTableClient {...props} clientSource={ready} />);
    await screen.rerender(
      <AstryxTableClient
        {...props}
        clientSource={{
          rows: [],
          totalRows: status === "stale" ? 1 : 0,
          version: 2,
          status,
          message: "Live source unavailable",
        }}
      />,
    );
    await expect.element(screen.getByRole("gridcell", { name: "Ada" })).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Retry", exact: true }))
      .not.toBeInTheDocument();
  },
);

test("ready empty is distinct from a persistent stale empty warning", async () => {
  const empty = { rows: [], totalRows: 0, version: 1, status: "ready" as const };
  const screen = await render(<AstryxTableClient {...props} clientSource={empty} />);
  await expect
    .element(screen.getByRole("status", { name: `${props.tableId} status`, exact: true }))
    .toHaveTextContent("No rows");
  await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
  await screen.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{ ...empty, status: "stale", message: "Delayed" }}
    />,
  );
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Live data delayed");
  await expect
    .element(screen.getByRole("status", { name: `${props.tableId} status`, exact: true }))
    .toHaveTextContent("No rows");
  await expect
    .element(screen.getByRole("button", { name: /dismiss|close/i }))
    .not.toBeInTheDocument();
});

test("zero-row loading has five fixed placeholders and ignores unreadable optional Retry", async () => {
  const source = { rows: [], totalRows: 0, version: 1, status: "loading" as const };
  Object.defineProperty(source, "retry", {
    get() {
      throw new Error("Unreadable optional capability");
    },
  });
  const screen = await render(<AstryxTableClient {...props} clientSource={source} />);
  await expect
    .element(screen.getByRole("grid", { name: "Loading table rows" }))
    .toHaveAttribute("aria-rowcount", "0");
  expect(screen.getByRole("row").all()).toHaveLength(5);
  for (const row of screen.getByRole("row").all())
    expect(row.element().getBoundingClientRect().height).toBe(36);
  await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();
});

test("removing Retry preserves intentional outside focus", async () => {
  const source = { ...ready, status: "error" as const, retry: { run: vi.fn(), pending: false } };
  const screen = await render(
    <>
      <button type="button">Outside</button>
      <AstryxTableClient {...props} clientSource={source} />
    </>,
  );
  await screen.getByRole("button", { name: "Retry", exact: true }).click();
  await screen.getByRole("button", { name: "Outside", exact: true }).click();
  await screen.rerender(
    <>
      <button type="button">Outside</button>
      <AstryxTableClient {...props} clientSource={ready} />
    </>,
  );
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Outside", exact: true }).element(),
  );
});

test("source messages stay bounded plain text and incomplete rows cannot appear as ready data", async () => {
  const screen = await render(
    <AstryxTableClient
      {...props}
      clientSource={{
        ...ready,
        status: "error",
        message: "<b>Offline</b>" + "m".repeat(600),
        statusCode: "c".repeat(200),
      }}
    />,
  );
  const alert = screen.getByRole("alert");
  await expect.element(alert).toHaveTextContent("<b>Offline</b>");
  expect(alert.element().querySelector("b")).toBeNull();
  expect(alert.element().textContent).toContain("c".repeat(128));
  expect(alert.element().textContent).not.toContain("c".repeat(129));
  expect(alert.element().textContent).not.toContain("m".repeat(512));
  await screen.rerender(
    <AstryxTableClient {...props} clientSource={{ ...ready, totalRows: 2, version: 2 }} />,
  );
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("Expected 2 rows but received 1");
});

test.for(["ltr", "rtl"] as const)(
  "%s loading suspends pinning when narrow and restores it after resize",
  async (direction) => {
    const pinColumns = Array.from({ length: 40 }, (_, i) => ({
      columnId: `COL_ID_C${i}` as Uppercase<`COL_ID_C${number}`>,
      headerName: `Column ${i}`,
      field: "name",
      valueType: "text",
      width: 120,
      ...(i === 0 ? { pinned: "start" as const } : i === 39 ? { pinned: "end" as const } : {}),
    })) satisfies AstryxTableColumns<Row>;
    const pinProps = {
      ...props,
      columns: pinColumns,
      initialOrderBy: [{ columnId: "COL_ID_C0", direction: "asc" }] as const,
      clientSource: { rows: [], totalRows: 2_000_000_000, version: 1, status: "loading" as const },
    };
    const screen = await render(
      <div dir={direction} style={{ width: 640 }}>
        <AstryxTableClient {...pinProps} />
      </div>,
    );
    const grid = screen.getByRole("grid", { name: "Loading table rows" });
    const first = screen.getByRole("gridcell", { name: "Loading Column 0", exact: true });
    const last = screen.getByRole("gridcell", { name: "Loading Column 39", exact: true });
    await expect.element(last.nth(0)).toBeInTheDocument();
    await screen.rerender(
      <div dir={direction} style={{ width: 100 }}>
        <AstryxTableClient {...pinProps} />
      </div>,
    );
    await vi.waitFor(() =>
      expect(screen.getByRole("row").nth(0).element().getAttribute("aria-owns")).toBeNull(),
    );
    await expect.element(last.nth(0)).not.toBeInTheDocument();
    await screen.rerender(
      <div dir={direction} style={{ width: 640 }}>
        <AstryxTableClient {...pinProps} />
      </div>,
    );
    await vi.waitFor(() => {
      const startRect = first.nth(0).element().getBoundingClientRect();
      const endRect = last.nth(0).element().getBoundingClientRect();
      const bounds = grid.element().getBoundingClientRect();
      expect(direction === "ltr" ? startRect.left : startRect.right).toBeCloseTo(
        direction === "ltr" ? bounds.left : bounds.right,
        0,
      );
      expect(direction === "ltr" ? endRect.right : endRect.left).toBeCloseTo(
        direction === "ltr" ? bounds.right : bounds.left,
        0,
      );
    });
    expect(screen.getByRole("row").all().length).toBeLessThan(100);
    expect(grid.element().scrollHeight).toBeLessThan(20_000_000);
    (grid.element() as HTMLElement).scrollTo({
      top: 100_000,
      left: direction === "rtl" ? -2000 : 2000,
    });
    await vi.waitFor(() =>
      expect(
        Number(screen.getByRole("row").nth(0).element().getAttribute("aria-rowindex")),
      ).toBeGreaterThan(1),
    );
    await expect.element(last.nth(0)).toBeInTheDocument();
  },
);

test("grouped lifecycle keeps summary columns and recovers exact groups after loading", async () => {
  const groupedColumns = [
    { ...columns[0], groupBy: true },
  ] as const satisfies AstryxTableColumns<Row>;
  const initialPersistedState = {
    version: 1 as const,
    tableId: props.tableId,
    filters: [],
    orderBy: props.initialOrderBy,
    groupBy: ["COL_ID_NAME"] as const,
    groupOrderBy: props.initialOrderBy,
    columnOrder: ["COL_ID_NAME"] as const,
    columnVisibility: {},
    columnWidths: {},
    columnPinning: { start: [], end: [] },
  };
  const groupedProps = { ...props, columns: groupedColumns, initialPersistedState };
  const screen = await render(<AstryxTableClient {...groupedProps} clientSource={ready} />);
  await expect
    .element(screen.getByRole("columnheader", { name: "Rows", exact: true }))
    .toBeVisible();
  await screen.rerender(
    <AstryxTableClient
      {...groupedProps}
      clientSource={{
        rows: [{ id: "b", name: "Unconfirmed" }],
        totalRows: 1,
        status: "loading",
        version: 2,
      }}
    />,
  );
  await expect
    .element(screen.getByRole("grid", { name: "Loading table rows" }))
    .toHaveAttribute("aria-colcount", "2");
  await expect
    .element(screen.getByRole("gridcell", { name: "Loading Rows", exact: true }).nth(0))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole("gridcell", { name: "Unconfirmed", exact: true }))
    .not.toBeInTheDocument();
  await screen.rerender(
    <AstryxTableClient
      {...groupedProps}
      clientSource={{
        rows: [
          { id: "b", name: "Grace" },
          { id: "c", name: "Grace" },
        ],
        totalRows: 2,
        status: "ready",
        version: 3,
      }}
    />,
  );
  await expect.element(screen.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  await expect.element(screen.getByRole("gridcell", { name: "2", exact: true })).toBeVisible();
  await expect
    .element(screen.getByRole("gridcell", { name: "Ada", exact: true }))
    .not.toBeInTheDocument();
  await screen.rerender(
    <AstryxTableClient
      {...groupedProps}
      clientSource={{ rows: [], totalRows: 0, status: "ready", version: 4 }}
    />,
  );
  await expect
    .element(screen.getByRole("columnheader", { name: "Rows", exact: true }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("status", { name: `${props.tableId} status`, exact: true }))
    .toHaveTextContent("No rows");
});

test.for(["stale", "error", "closed"] as const)(
  "%s recovers rejected query rows by changing the filter without a new source publication",
  async (status) => {
    type RecoveryRow = Row & { score: number };
    const recoveryColumns = [
      columns[0],
      {
        columnId: "COL_ID_SCORE",
        headerName: "Score",
        field: "score",
        valueType: "number",
        enableFilter: true,
      },
    ] as const satisfies AstryxTableColumns<RecoveryRow>;
    const clientSource = {
      rows: [
        { id: "a", name: "Ada", score: 1 },
        { id: "b", name: "Grace", score: Number.NaN },
      ],
      totalRows: 2,
      version: 1,
      status,
    };
    const screen = await render(
      <AstryxTableClient<RecoveryRow, typeof recoveryColumns>
        {...props}
        columns={recoveryColumns}
        clientSource={clientSource}
        initialPersistedState={{
          version: 1,
          tableId: props.tableId,
          filters: [],
          orderBy: props.initialOrderBy,
          groupBy: [],
          groupOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
          columnOrder: ["COL_ID_NAME", "COL_ID_SCORE"],
          columnVisibility: { COL_ID_SCORE: false },
          columnWidths: {},
          columnPinning: { start: [], end: [] },
        }}
      >
        <AstryxTableFilterControl<RecoveryRow, typeof recoveryColumns> ownership="grid">
          {(commands) => (
            <>
              <button
                type="button"
                onClick={() =>
                  commands.replace({ columnId: "COL_ID_SCORE", type: "greaterThan", filter: 0 })
                }
              >
                Filter score
              </button>
              <button type="button" onClick={() => commands.clear("COL_ID_SCORE")}>
                Clear score
              </button>
            </>
          )}
        </AstryxTableFilterControl>
      </AstryxTableClient>,
    );
    await expect.element(screen.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    await screen.getByRole("button", { name: "Filter score", exact: true }).click();
    await expect
      .element(screen.getByRole("gridcell", { name: "Ada", exact: true }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Clear score", exact: true }).click();
    await expect.element(screen.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    await expect
      .element(screen.getByRole("gridcell", { name: "Grace", exact: true }))
      .toBeVisible();
  },
);

test("empty-grid focus survives terminal chrome replacing the grid", async () => {
  const source = { rows: [], totalRows: 0, version: 1, status: "ready" as const };
  const screen = await render(<AstryxTableClient {...props} clientSource={source} />);
  (screen.getByRole("grid", { name: props.tableId, exact: true }).element() as HTMLElement).focus();
  await screen.rerender(
    <AstryxTableClient {...props} clientSource={{ ...source, status: "error", version: 2 }} />,
  );
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Live data error");
  await expect
    .element(screen.getByRole("region", { name: props.tableId, exact: true }))
    .toHaveFocus();
});

test("iframe lifecycle focus stays in its owning document and preserves parent focus", async () => {
  const outside = await render(<button type="button">Parent outside</button>);
  const frame = document.createElement("iframe");
  document.body.append(frame);
  let screen: Awaited<ReturnType<typeof render>> | undefined;
  try {
    const owner = frame.contentDocument;
    if (owner === null) throw new Error("Missing same-origin frame document");
    const container = owner.createElement("div");
    owner.body.append(container);
    screen = await render(<AstryxTableClient {...props} clientSource={ready} />, {
      container,
      baseElement: owner.body,
    });
    // Vitest's browser locators resolve against the test document, not child frames.
    // Keep frame reads scoped to accessible roles, as in the retained iframe tests.
    const grid = () =>
      owner.querySelector<HTMLElement>(`[role="grid"][aria-label="${props.tableId}"]`);
    expect(grid()).not.toBeNull();
    grid()!.focus();
    expect(owner.activeElement).toBe(grid());
    const loadingSource = { rows: [], totalRows: 2, version: 2, status: "loading" as const };
    await screen.rerender(<AstryxTableClient {...props} clientSource={loadingSource} />);
    const loading = () =>
      owner.querySelector<HTMLElement>('[role="grid"][aria-label="Loading table rows"]');
    await vi.waitFor(() => {
      expect(loading()).not.toBeNull();
      expect(owner.activeElement).toBe(loading());
    });
    await screen.rerender(<AstryxTableClient {...props} clientSource={ready} />);
    await vi.waitFor(() => expect(owner.activeElement).toBe(grid()));
    (
      outside.getByRole("button", { name: "Parent outside", exact: true }).element() as HTMLElement
    ).focus();
    await screen.rerender(<AstryxTableClient {...props} clientSource={loadingSource} />);
    expect(document.activeElement).toBe(
      outside.getByRole("button", { name: "Parent outside", exact: true }).element(),
    );
    expect(owner.hasFocus()).toBe(false);
    const emptyError = {
      rows: [],
      totalRows: 0,
      version: 1,
      status: "error" as const,
      retry: { run: vi.fn(), pending: false },
    };
    await screen.rerender(
      <AstryxTableClient {...props} tableId="iframe-retry" clientSource={emptyError} />,
    );
    const retry = owner.querySelector<HTMLButtonElement>('[role="alert"] button');
    expect(retry).not.toBeNull();
    expect(retry?.textContent).toContain("Retry");
    retry!.focus();
    expect(owner.activeElement).toBe(retry);
    (
      outside.getByRole("button", { name: "Parent outside", exact: true }).element() as HTMLElement
    ).focus();
    expect(owner.hasFocus()).toBe(false);
    await screen.rerender(
      <AstryxTableClient {...props} tableId="iframe-retry" clientSource={ready} />,
    );
    expect(document.activeElement).toBe(
      outside.getByRole("button", { name: "Parent outside", exact: true }).element(),
    );
    expect(owner.hasFocus()).toBe(false);
  } finally {
    await screen?.unmount();
    frame.remove();
  }
});
