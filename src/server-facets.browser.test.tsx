import { afterEach, expect, test } from "vite-plus/test";
import { cleanup, render } from "vitest-browser-react";
import { StrictMode, useLayoutEffect, useSyncExternalStore } from "react";
import { userEvent } from "vitest/browser";
import { Effect, Schema } from "effect";
import { defineViewServerConfig, ViewServerId } from "effect-view-server/config";
import { createViewServerReact } from "effect-view-server/react";
import { createInMemoryViewServerReact } from "effect-view-server/react/testing";
import {
  AstryxTableServer,
  AstryxTableFilterControl,
  type AstryxTableGridFilterCommandCapability,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; team: string };
const binding = createViewServerReact(
  defineViewServerConfig({
    topics: {
      orders: {
        schema: Schema.Struct({ id: ViewServerId, name: Schema.String, team: Schema.String }),
      },
    },
  }),
);
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  {
    columnId: "COL_ID_TEAM",
    headerName: "Team",
    field: "team",
    valueType: "text",
    enableSetFilter: true,
  },
] as const satisfies AstryxTableColumns<Row>;

test("Server values include offscreen source rows and preserve alternatives after Match None", async () => {
  const source = createInMemoryViewServerReact(binding);
  function Table() {
    const viewportSource = binding.useLiveQueryViewport("orders");
    return (
      <AstryxTableServer
        tableId="server-facets"
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
          <Table />
        </source.ViewServerInMemoryProvider>
      </StrictMode>,
    );
    await Effect.runPromise(
      Effect.forEach(
        Array.from({ length: 80 }, (_, index) => ({
          id: String(index),
          name: `Row ${String(index).padStart(3, "0")}`,
          team: index === 79 ? "Zulu" : "Alpha",
        })),
        (row) => source.client.publish("orders", row),
      ),
    );
    await expect
      .element(screen.getByRole("gridcell", { name: "Row 000", exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("gridcell", { name: "Zulu", exact: true }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Filter Team", exact: true }).click();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Alpha, 79", exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Zulu, 1", exact: true }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Clear All", exact: true }).click();
    await expect
      .element(screen.getByRole("gridcell", { name: "Row 000", exact: true }))
      .not.toBeInTheDocument();
    await screen.getByRole("checkbox", { name: "Select Zulu, 1", exact: true }).click();
    await expect
      .element(screen.getByRole("gridcell", { name: "Row 079", exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Alpha, 79", exact: true }))
      .toBeVisible();
    await screen.unmount();
  } finally {
    await cleanup();
    await Effect.runPromise(source.close);
  }
});

test("an open Server value filter follows external query changes and live counts", async () => {
  const source = createInMemoryViewServerReact(binding);
  function Table({ name }: { readonly name: string }) {
    const viewportSource = binding.useLiveQueryViewport("orders");
    return (
      <AstryxTableServer
        tableId="server-facets-live"
        columns={columns}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        externalFilters={[{ field: "name", type: "equals", filter: name }]}
        viewportSource={viewportSource}
      />
    );
  }
  const tree = (name: string) => (
    <source.ViewServerInMemoryProvider>
      <Table name={name} />
    </source.ViewServerInMemoryProvider>
  );
  try {
    const screen = await render(tree("Ada"));
    await Effect.runPromise(
      Effect.forEach(
        [
          { id: "a", name: "Ada", team: "Alpha" },
          { id: "b", name: "Grace", team: "Beta" },
        ],
        (row) => source.client.publish("orders", row),
      ),
    );
    await expect.element(screen.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    await screen.getByRole("button", { name: "Filter Team", exact: true }).click();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Alpha, 1", exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Beta, 1", exact: true }))
      .not.toBeInTheDocument();
    await screen.rerender(tree("Grace"));
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Beta, 1", exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Alpha, 1", exact: true }))
      .not.toBeInTheDocument();
    await Effect.runPromise(
      source.client.publish("orders", { id: "c", name: "Grace", team: "Beta" }),
    );
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Beta, 2", exact: true }))
      .toBeVisible();
    await screen.unmount();
  } finally {
    await cleanup();
    await Effect.runPromise(source.close);
  }
});

test("Server facet subscriptions are lazy and lifecycle changes retain only coherent options", async () => {
  type Source = ReturnType<typeof binding.useLiveQueryViewport>;
  type Status = "loading" | "ready" | "stale" | "closed" | "error";
  let snapshot: { status: Status; values: readonly string[]; message?: string } = {
    status: "ready",
    values: ["Alpha"],
  };
  const listeners = new Set<() => void>();
  const getSnapshot = () => snapshot;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const publish = (status: Status, values = snapshot.values, message?: string) => {
    snapshot = { status, values, ...(message === undefined ? {} : { message }) };
    for (const listener of listeners) listener();
  };
  const viewport = {
    semanticKey: (query: unknown) => JSON.stringify(query),
    replace(request: {
      sink: {
        setRowCount: (count: number) => void;
        setRowData: (rows: Record<number, Row>, keys: Record<number, string>) => void;
      };
    }) {
      request.sink.setRowCount(1);
      request.sink.setRowData({ 0: { id: "a", name: "Ada", team: "Alpha" } }, { 0: "source-a" });
      return { setWindow() {}, release() {} };
    },
  } as unknown as Omit<Source["viewport"], "destroy">;
  const viewportSource = {
    viewport,
    completeRawSelect: ["id", "name", "team"] as unknown as Source["completeRawSelect"],
    totalRows: 1,
    version: 1,
    status: "ready" as const,
    useWholeResult(query: { aggregates: Readonly<Record<string, unknown>> }) {
      const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      const countAlias = Object.keys(query.aggregates)[0]!;
      return {
        rows: current.values.map((team) => ({ team, [countAlias]: 1n })),
        totalRows: current.values.length,
        version: 1,
        status: current.status,
        message: current.message,
      };
    },
  };
  const screen = await render(
    <StrictMode>
      <AstryxTableServer
        tableId="facet-lifecycle"
        columns={columns}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        viewportSource={viewportSource}
      />
    </StrictMode>,
  );
  expect(listeners.size).toBe(0);
  await screen.getByRole("button", { name: "Filter Team", exact: true }).click();
  await expect
    .element(screen.getByRole("checkbox", { name: "Select Alpha, 1", exact: true }))
    .toBeVisible();
  expect(listeners.size).toBe(1);
  publish("loading");
  await expect
    .element(screen.getByRole("status").filter({ hasText: "Loading filter values." }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("checkbox", { name: "Select Alpha, 1", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("status").filter({ hasText: "No values found" }))
    .not.toBeInTheDocument();
  publish("ready", ["Beta"]);
  await expect
    .element(screen.getByRole("checkbox", { name: "Select Beta, 1", exact: true }))
    .toBeVisible();
  for (const [status, label] of [
    ["stale", "Filter values may be delayed."],
    ["closed", "Live filter values stopped."],
    ["error", "Live filter values unavailable."],
  ] as const) {
    publish(status, ["Beta"], "Source detail");
    await expect
      .element(screen.getByRole("status").filter({ hasText: `${label} Source detail` }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Beta, 1", exact: true }))
      .toBeVisible();
  }
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => listeners.size).toBe(0);
  publish("ready", ["Gamma"]);
  await screen.getByRole("button", { name: "Filter Team", exact: true }).click();
  await expect
    .element(screen.getByRole("checkbox", { name: "Select Gamma, 1", exact: true }))
    .toBeVisible();
  expect(listeners.size).toBe(1);
  await screen.unmount();
  expect(listeners.size).toBe(0);
});

test("Server value gestures preserve filter intent changed earlier in the same event", async () => {
  const source = createInMemoryViewServerReact(binding);
  let capture = false;
  let excludeAlpha: () => void = () => {
    throw new Error("Missing filter command");
  };
  let beta: HTMLElement;
  function CaptureCommands({
    commands,
  }: {
    readonly commands: AstryxTableGridFilterCommandCapability<Row, typeof columns>;
  }) {
    useLayoutEffect(() => {
      excludeAlpha = () => {
        commands.replace({
          type: "NOT",
          condition: {
            columnId: "COL_ID_TEAM",
            type: "in",
            filter: ["Alpha"],
            caseSensitive: true,
            accentSensitive: true,
          },
        });
      };
    }, [commands]);
    return null;
  }
  function Table() {
    const viewportSource = binding.useLiveQueryViewport("orders");
    return (
      <div
        onChangeCapture={(event) => {
          if (!capture || !(event.target instanceof Node) || !beta.contains(event.target)) return;
          capture = false;
          excludeAlpha();
        }}
      >
        <AstryxTableServer
          tableId="server-facet-gesture"
          columns={columns}
          initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
          viewportSource={viewportSource}
        >
          <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
            {(commands) => <CaptureCommands commands={commands} />}
          </AstryxTableFilterControl>
        </AstryxTableServer>
      </div>
    );
  }
  try {
    const screen = await render(
      <source.ViewServerInMemoryProvider>
        <Table />
      </source.ViewServerInMemoryProvider>,
    );
    await Effect.runPromise(
      Effect.forEach(
        [
          { id: "a", name: "Ada", team: "Alpha" },
          { id: "b", name: "Bea", team: "Beta" },
          { id: "c", name: "Cora", team: "Gamma" },
        ],
        (row) => source.client.publish("orders", row),
      ),
    );
    await expect.element(screen.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    await screen.getByRole("button", { name: "Filter Team", exact: true }).click();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Alpha, 1", exact: true }))
      .toBeChecked();
    beta = screen
      .getByRole("checkbox", { name: "Select Beta, 1", exact: true })
      .element() as HTMLElement;
    capture = true;
    await screen.getByRole("checkbox", { name: "Select Beta, 1", exact: true }).click();
    expect(capture).toBe(false);
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Alpha, 1", exact: true }))
      .not.toBeChecked();
    await expect
      .element(screen.getByRole("checkbox", { name: "Select Beta, 1", exact: true }))
      .not.toBeChecked();
    await expect
      .element(screen.getByRole("gridcell", { name: "Ada", exact: true }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("gridcell", { name: "Bea", exact: true }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByRole("gridcell", { name: "Cora", exact: true })).toBeVisible();
    await screen.unmount();
  } finally {
    await cleanup();
    await Effect.runPromise(source.close);
  }
});
