import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; desk: string; region: string; quantity: bigint };
const columns = [
  {
    columnId: "COL_ID_DESK",
    headerName: "Desk",
    field: "desk",
    valueType: "text",
    groupBy: true,
    valueFormatter: ({ row, value }) => {
      if (typeof row.id !== "string") throw new Error("Raw formatter received a grouped row");
      return value;
    },
    groupKeyValueFormatter: ({ value, rowCount }) => `${value} (${String(rowCount)})`,
  },
  {
    columnId: "COL_ID_REGION",
    headerName: "Region",
    field: "region",
    valueType: "text",
    groupBy: true,
  },
  {
    columnId: "COL_ID_QUANTITY",
    headerName: "Quantity",
    field: "quantity",
    valueType: "bigint",
    aggFunc: "sum",
    aggregateValueFormatter: ({ value }) => `${String(value)} units`,
  },
] as const satisfies AstryxTableColumns<Row>;
const rows: readonly Row[] = [
  { id: "a", desk: "Alpha", region: "East", quantity: 9007199254740993n },
  { id: "b", desk: "Alpha", region: "West", quantity: 2n },
  { id: "c", desk: "Beta", region: "East", quantity: 5n },
];
const props = {
  tableId: "grouped-client",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_QUANTITY", direction: "desc" }] as const,
  clientSource: { rows, totalRows: 3, version: 1, status: "ready" as const },
};
const preferences = {
  version: 1 as const,
  tableId: props.tableId,
  filters: [],
  orderBy: props.initialOrderBy,
  groupBy: ["COL_ID_DESK"] as const,
  groupOrderBy: [{ columnId: "COL_ID_DESK", direction: "asc" }] as const,
  columnOrder: ["COL_ID_DESK", "COL_ID_REGION", "COL_ID_QUANTITY"] as const,
  columnVisibility: {},
  columnWidths: {},
  columnPinning: { start: [], end: [] },
};

test("restored grouping renders flat exact summaries without calling raw callbacks on groups", async () => {
  const getRowId = vi.fn(props.getRowId);
  const onPersistChange = vi.fn();
  await render(
    <AstryxTableClient
      {...props}
      getRowId={getRowId}
      initialPersistedState={preferences}
      onPersistChange={onPersistChange}
    >
      <AstryxTableResultRowCount />
      <AstryxTableLoadedRowCount />
    </AstryxTableClient>,
  );
  await expect.element(page.getByRole("columnheader", { name: "Rows", exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "Alpha (2)", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "9007199254740995 units", exact: true }))
    .toBeVisible();
  await expect.element(page.getByRole("gridcell", { name: "Beta (1)", exact: true })).toBeVisible();
  expect(page.getByRole("columnheader", { name: "Region", exact: true }).elements()).toHaveLength(
    0,
  );
  expect(page.getByRole("gridcell").elements()).toHaveLength(6);
  await expect
    .element(page.getByRole("status", { name: "Result rows", exact: true }))
    .toHaveTextContent("2 result rows");
  await expect
    .element(page.getByRole("status", { name: "Loaded rows", exact: true }))
    .toHaveTextContent("2 loaded rows");
  expect(getRowId.mock.calls.every(([row]) => rows.includes(row))).toBe(true);
  expect(onPersistChange).not.toHaveBeenCalled();
});

test("users add and remove groups through the native picker while normal sorting survives", async () => {
  const persist = vi.fn();
  await render(<AstryxTableClient {...props} onPersistChange={persist} />);
  const picker = page.getByRole("button", { name: "Add Group", exact: true });
  await picker.click();
  await page.getByRole("option", { name: "Desk", exact: true }).click();
  await expect
    .element(page.getByRole("gridcell", { name: "Alpha (2)", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("status", { name: "Grouping status", exact: true }))
    .toHaveTextContent("Desk added at position 1");
  expect(persist).toHaveBeenCalledTimes(1);
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    groupBy: ["COL_ID_DESK"],
    orderBy: props.initialOrderBy,
  });
  await page.getByRole("button", { name: "Remove Desk from Group By", exact: true }).click();
  await expect
    .element(page.getByRole("columnheader", { name: "Region", exact: true }))
    .toBeVisible();
  await expect.element(picker).toHaveFocus();
  expect(persist).toHaveBeenCalledTimes(2);
  expect(persist.mock.lastCall?.[0]).toMatchObject({ groupBy: [], orderBy: props.initialOrderBy });
});

test("group chips reorder with scoped Alt arrows and keep focus and ordered persistence", async () => {
  const persist = vi.fn();
  await render(
    <AstryxTableClient {...props} initialPersistedState={preferences} onPersistChange={persist} />,
  );
  await page.getByRole("button", { name: "Add Group", exact: true }).click();
  await page.getByRole("option", { name: "Region", exact: true }).click();
  const chip = page.getByRole("button", { name: "Region, position 2 of 2", exact: true });
  chip.element().focus();
  await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
  await expect
    .element(page.getByRole("button", { name: "Region, position 1 of 2", exact: true }))
    .toHaveFocus();
  await expect
    .element(page.getByRole("status", { name: "Grouping status", exact: true }))
    .toHaveTextContent("Region moved to position 1 of 2");
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    groupBy: ["COL_ID_REGION", "COL_ID_DESK"],
    orderBy: props.initialOrderBy,
  });
  expect(
    page
      .getByRole("columnheader")
      .elements()
      .map((node) => node.getAttribute("aria-label")),
  ).toEqual(["Region", "Desk", "Rows", "Quantity"]);
  await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
  expect(persist).toHaveBeenCalledTimes(2);
  await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
  await expect
    .element(page.getByRole("button", { name: "Region, position 2 of 2", exact: true }))
    .toHaveFocus();
  await page.getByRole("button", { name: "Remove Region from Group By", exact: true }).click();
  await expect
    .element(page.getByRole("button", { name: "Desk, position 1 of 1", exact: true }))
    .toHaveFocus();
});

test("Rows presentation keeps its fixed identity and persisted width ahead of the configured baseline", async () => {
  const persist = vi.fn();
  const view = await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={{ ...preferences, columnWidths: { COL_ID_ASTRYX_TABLE_ROWS: 240 } }}
      onPersistChange={persist}
      groupRowsColumn={{
        headerName: "Records",
        width: 180,
        valueFormatter: ({ value, columnId }) => `${String(value)} records (${columnId})`,
      }}
    />,
  );
  const header = page.getByRole("columnheader", { name: "Records", exact: true });
  await expect.element(header).toBeVisible();
  await expect.poll(() => header.element().getBoundingClientRect().width).toBe(240);
  await expect
    .element(
      page.getByRole("gridcell", { name: "2 records (COL_ID_ASTRYX_TABLE_ROWS)", exact: true }),
    )
    .toBeVisible();
  await view.rerender(
    <AstryxTableClient
      {...props}
      initialPersistedState={preferences}
      onPersistChange={persist}
      groupRowsColumn={{
        headerName: "Members",
        width: 300,
        valueFormatter: ({ value }) => `${String(value)} members`,
      }}
    />,
  );
  await expect
    .element(page.getByRole("columnheader", { name: "Members", exact: true }))
    .toBeVisible();
  await expect
    .poll(
      () =>
        page
          .getByRole("columnheader", { name: "Members", exact: true })
          .element()
          .getBoundingClientRect().width,
    )
    .toBe(240);
  await expect
    .element(page.getByRole("gridcell", { name: "2 members", exact: true }))
    .toBeVisible();
  expect(persist).not.toHaveBeenCalled();
});

function activeCell() {
  const grid = page.getByRole("grid").element();
  const id = grid.getAttribute("aria-activedescendant");
  return id === null ? null : grid.ownerDocument.getElementById(id);
}

test("live grouped updates preserve Active identity through moves and fall back only after removal", async () => {
  const initialPersistedState = {
    ...preferences,
    groupOrderBy: [{ columnId: "COL_ID_QUANTITY", direction: "asc" }] as const,
  };
  const view = await render(
    <AstryxTableClient {...props} initialPersistedState={initialPersistedState} />,
  );
  const beta = page.getByRole("gridcell", { name: "5 units", exact: true });
  await beta.click();
  const identity = beta.element().id;
  await expect.poll(() => activeCell()?.id).toBe(identity);
  const changed = rows.map((row) =>
    row.id === "c" ? { ...row, quantity: 9007199254740999n } : row,
  );
  await view.rerender(
    <AstryxTableClient
      {...props}
      initialPersistedState={initialPersistedState}
      clientSource={{ ...props.clientSource, rows: changed, version: 2 }}
    />,
  );
  await expect.poll(() => activeCell()?.id).toBe(identity);
  await expect.poll(() => activeCell()?.textContent).toBe("9007199254740999 units");
  const remaining = changed.filter((row) => row.id !== "c");
  await view.rerender(
    <AstryxTableClient
      {...props}
      initialPersistedState={initialPersistedState}
      clientSource={{ ...props.clientSource, rows: remaining, totalRows: 2, version: 3 }}
    />,
  );
  await expect.poll(() => activeCell()?.textContent).toBe("9007199254740995 units");
});

test("Group By shape changes reset the logical cell without stealing focus from the picker", async () => {
  await render(<AstryxTableClient {...props} />);
  await page.getByRole("gridcell", { name: "West", exact: true }).click();
  const picker = page.getByRole("button", { name: "Add Group", exact: true });
  await picker.click();
  await page.getByRole("option", { name: "Desk", exact: true }).click();
  await expect.element(picker).toHaveFocus();
  await expect.poll(() => activeCell()?.textContent).toBe("Alpha (2)");
  await page.getByRole("button", { name: "Remove Desk from Group By", exact: true }).click();
  await expect.element(picker).toHaveFocus();
  await expect.poll(() => activeCell()?.textContent).toBe("Alpha");
});

test("column menus add and remove group keys and never offer ordinary reorder while grouped", async () => {
  await render(<AstryxTableClient {...props} />);
  await page.getByRole("button", { name: "Desk column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add to Group By", exact: true }).click();
  await expect
    .element(page.getByRole("gridcell", { name: "Alpha (2)", exact: true }))
    .toBeVisible();
  expect(page.getByRole("button", { name: "Reorder Desk", exact: true }).elements()).toHaveLength(
    0,
  );
  await page.getByRole("button", { name: "Rows column menu", exact: true }).click();
  expect(page.getByRole("menuitem", { name: "Pin to start", exact: true }).elements()).toHaveLength(
    0,
  );
  expect(
    page.getByRole("menuitem", { name: "Move toward logical start", exact: true }).elements(),
  ).toHaveLength(0);
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Desk column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Remove from Group By", exact: true }).click();
  await expect
    .element(page.getByRole("columnheader", { name: "Region", exact: true }))
    .toBeVisible();
  await expect.element(page.getByRole("button", { name: "Add Group", exact: true })).toHaveFocus();
});

test("grouped sort choices contain Rows and participating aggregates while normal sorting stays dormant", async () => {
  const persist = vi.fn();
  await render(
    <AstryxTableClient {...props} initialPersistedState={preferences} onPersistChange={persist} />,
  );
  await page.getByRole("button", { name: "Sort rows, 1 active", exact: true }).click();
  await page.getByRole("button", { name: "Add sort column", exact: true }).click();
  await expect.element(page.getByRole("option", { name: "Rows", exact: true })).toBeVisible();
  await expect.element(page.getByRole("option", { name: "Quantity", exact: true })).toBeVisible();
  expect(page.getByRole("option", { name: "Region", exact: true }).elements()).toHaveLength(0);
  await page.getByRole("option", { name: "Rows", exact: true }).click();
  await expect
    .element(page.getByRole("status", { name: "Sorting status", exact: true }))
    .toHaveTextContent("Added Rows sort");
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    orderBy: props.initialOrderBy,
    groupOrderBy: [
      { columnId: "COL_ID_DESK", direction: "asc" },
      { columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" },
    ],
  });
});

test("grouped visibility protects a forced key while retaining dormant ordinary columns and hidden intent", async () => {
  const persist = vi.fn();
  await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={{ ...preferences, columnVisibility: { COL_ID_DESK: false } }}
      onPersistChange={persist}
    />,
  );
  await page.getByRole("button", { name: "Column preferences", exact: true }).click();
  await page.getByRole("button", { name: "Visible columns", exact: true }).click();
  const key = page.getByRole("option", { name: "Desk", exact: true });
  await expect.element(key).toHaveAttribute("aria-selected", "true");
  await expect.element(key).toHaveAttribute("aria-disabled", "true");
  await expect.element(page.getByRole("option", { name: "Region", exact: true })).toBeVisible();
  expect(page.getByRole("option", { name: "Rows", exact: true }).elements()).toHaveLength(0);
  await page.getByRole("option", { name: "Quantity", exact: true }).click();
  await expect
    .element(page.getByRole("columnheader", { name: "Quantity", exact: true }))
    .not.toBeInTheDocument();
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    columnVisibility: { COL_ID_DESK: false, COL_ID_QUANTITY: false },
  });
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Reset columns", exact: true }).click();
  expect(
    page.getByRole("menuitem", { name: "Reset column order", exact: true }).elements(),
  ).toHaveLength(0);
  expect(
    page.getByRole("menuitem", { name: "Reset entire column layout", exact: true }).elements(),
  ).toHaveLength(0);
  await userEvent.keyboard("{Escape}{Escape}");
  await page.getByRole("button", { name: "Remove Desk from Group By", exact: true }).click();
  await expect
    .element(page.getByRole("columnheader", { name: "Desk", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("columnheader", { name: "Region", exact: true }))
    .toBeVisible();
});

test.for(["Desk, position 1 of 2", "Remove Desk from Group By", "Outside"])(
  "schema replacement recovers only owned focus from %s",
  async (focused) => {
    const initialPersistedState = {
      ...preferences,
      groupBy: ["COL_ID_DESK", "COL_ID_REGION"] as const,
    };
    const view = await render(
      <>
        <button>Outside</button>
        <AstryxTableClient {...props} initialPersistedState={initialPersistedState} />
      </>,
    );
    page.getByRole("button", { name: focused, exact: true }).element().focus();
    const { groupKeyValueFormatter: _formatter, ...desk } = columns[0];
    const replacement = [
      { ...desk, groupBy: false },
      columns[1],
      columns[2],
    ] as const satisfies AstryxTableColumns<Row>;
    await view.rerender(
      <>
        <button>Outside</button>
        <AstryxTableClient {...props} columns={replacement} />
      </>,
    );
    await expect
      .element(
        page.getByRole("button", {
          name: focused === "Outside" ? "Outside" : "Region, position 1 of 1",
          exact: true,
        }),
      )
      .toHaveFocus();
    expect(
      page.getByRole("button", { name: "Remove Desk from Group By", exact: true }).elements(),
    ).toHaveLength(0);
  },
);

test("revoking every grouping capability returns owned focus to the surviving grid", async () => {
  const view = await render(<AstryxTableClient {...props} initialPersistedState={preferences} />);
  page.getByRole("button", { name: "Remove Desk from Group By", exact: true }).element().focus();
  const { groupKeyValueFormatter: _formatter, ...desk } = columns[0];
  const replacement = [
    { ...desk, groupBy: false },
    { ...columns[1], groupBy: false },
    columns[2],
  ] as const satisfies AstryxTableColumns<Row>;
  await view.rerender(<AstryxTableClient {...props} columns={replacement} />);
  await expect.element(page.getByRole("grid")).toHaveFocus();
  expect(page.getByRole("region", { name: "Group By", exact: true }).elements()).toHaveLength(0);
  await expect
    .element(page.getByRole("columnheader", { name: "Region", exact: true }))
    .toBeVisible();
});

test.for(["Add Group", "Outside", "Open Add Group", "Open then Outside"])(
  "revoking ungrouped capabilities preserves focus owned by %s",
  async (focused) => {
    const view = await render(
      <>
        <button>Outside</button>
        <AstryxTableClient {...props} />
      </>,
    );
    if (focused.startsWith("Open")) {
      await page.getByRole("button", { name: "Add Group", exact: true }).click();
      await expect.element(page.getByRole("combobox")).toHaveFocus();
      if (focused === "Open then Outside")
        page.getByRole("button", { name: "Outside", exact: true }).element().focus();
    } else page.getByRole("button", { name: focused, exact: true }).element().focus();
    const { groupKeyValueFormatter: _formatter, ...desk } = columns[0];
    const replacement = [
      { ...desk, groupBy: false },
      { ...columns[1], groupBy: false },
      columns[2],
    ] as const satisfies AstryxTableColumns<Row>;
    await view.rerender(
      <>
        <button>Outside</button>
        <AstryxTableClient {...props} columns={replacement} />
      </>,
    );
    await expect
      .element(
        focused === "Outside" || focused === "Open then Outside"
          ? page.getByRole("button", { name: "Outside", exact: true })
          : page.getByRole("grid"),
      )
      .toHaveFocus();
    expect(page.getByRole("region", { name: "Group By", exact: true }).elements()).toHaveLength(0);
  },
);

test("a forced visible key remains keyboard resizable without changing its hidden preference", async () => {
  const persist = vi.fn();
  await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={{ ...preferences, columnVisibility: { COL_ID_DESK: false } }}
      onPersistChange={persist}
    />,
  );
  const handle = page.getByRole("separator", { name: "Resize Desk", exact: true });
  const initial = Number(handle.element().getAttribute("aria-valuenow"));
  handle.element().focus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(handle).toHaveAttribute("aria-valuenow", String(initial + 10));
  expect(persist).toHaveBeenCalledTimes(1);
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    columnVisibility: { COL_ID_DESK: false },
    columnWidths: { COL_ID_DESK: initial + 10 },
  });
});

test("aggregate filters keep source field semantics when countDistinct changes the displayed value type", async () => {
  const definition = [
    columns[0],
    {
      ...columns[1],
      groupBy: false,
      aggFunc: "countDistinct",
      aggregateValueFormatter: ({ value }: { readonly value: bigint }) =>
        `${String(value)} regions`,
    },
    columns[2],
  ] as const satisfies AstryxTableColumns<Row>;
  const persist = vi.fn();
  await render(
    <AstryxTableClient
      {...props}
      columns={definition}
      initialPersistedState={preferences}
      onPersistChange={persist}
    />,
  );
  await expect
    .element(page.getByRole("gridcell", { name: "2 regions", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "Filter Region", exact: true }).click();
  await page.getByRole("textbox", { name: "Filter value", exact: true }).fill("East");
  await expect
    .element(page.getByRole("gridcell", { name: "Alpha (1)", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "2 regions", exact: true }))
    .not.toBeInTheDocument();
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    filters: [{ columnId: "COL_ID_REGION", type: "contains", filter: "East" }],
  });
});

test("Rows resizes with bounded commits and preserves its width through ungrouping and capability removal", async () => {
  const persist = vi.fn();
  const view = await render(
    <AstryxTableClient {...props} initialPersistedState={preferences} onPersistChange={persist} />,
  );
  const handle = page.getByRole("separator", { name: "Resize Rows", exact: true });
  await expect.element(handle).toBeVisible();
  handle.element().focus();
  await userEvent.keyboard("{End}");
  await expect.element(handle).toHaveAttribute("aria-valuenow", "1000");
  await userEvent.keyboard("{ArrowRight}");
  expect(persist).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Home}");
  await expect.element(handle).toHaveAttribute("aria-valuenow", "32");
  const x = handle.element().getBoundingClientRect().left;
  handle
    .element()
    .dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 73, button: 0, clientX: x }),
    );
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 73, clientX: x + 60 }));
  await expect.element(handle).toHaveAttribute("aria-valuenow", "92");
  expect(persist).toHaveBeenCalledTimes(2);
  window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 73 }));
  await expect.element(handle).toHaveAttribute("aria-valuenow", "32");
  expect(persist).toHaveBeenCalledTimes(2);
  await page.getByRole("button", { name: "Remove Desk from Group By", exact: true }).click();
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    groupBy: [],
    columnWidths: { COL_ID_ASTRYX_TABLE_ROWS: 32 },
  });
  const { groupKeyValueFormatter: _formatter, ...desk } = columns[0];
  const noGroups = [
    { ...desk, groupBy: false },
    { ...columns[1], groupBy: false },
    columns[2],
  ] as const satisfies AstryxTableColumns<Row>;
  await view.rerender(
    <AstryxTableClient {...props} columns={noGroups} onPersistChange={persist} />,
  );
  await view.rerender(
    <AstryxTableClient {...props} groupRowsColumn={{ width: 180 }} onPersistChange={persist} />,
  );
  await page.getByRole("button", { name: "Add Group", exact: true }).click();
  await page.getByRole("option", { name: "Desk", exact: true }).click();
  await expect.element(handle).toHaveAttribute("aria-valuenow", "32");
  expect(persist.mock.lastCall?.[0]).toMatchObject({
    columnWidths: { COL_ID_ASTRYX_TABLE_ROWS: 32 },
    columnOrder: preferences.columnOrder,
    columnVisibility: {},
    columnPinning: preferences.columnPinning,
  });
});

test("keyboard menu removal hands focus to the surviving group chip", async () => {
  await render(
    <AstryxTableClient
      {...props}
      initialPersistedState={{ ...preferences, groupBy: ["COL_ID_DESK", "COL_ID_REGION"] }}
    />,
  );
  page.getByRole("button", { name: "Desk column menu", exact: true }).element().focus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("menuitem", { name: "Remove from Group By", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("button", { name: "Region, position 1 of 1", exact: true }))
    .toHaveFocus();
});

test("replacing aggregate semantics and presentation installs one coherent epoch for the same column identity", async () => {
  const view = await render(<AstryxTableClient {...props} initialPersistedState={preferences} />);
  const replacement = [
    columns[0],
    columns[1],
    {
      ...columns[2],
      aggFunc: "max",
      aggregateValueFormatter: ({ value }: { readonly value: bigint }) => {
        if (value !== BigInt("9007199254740993") && value !== BigInt(5))
          throw new Error("New formatter received an old sum");
        return `${String(value)} maximum`;
      },
    },
  ] as const satisfies AstryxTableColumns<Row>;
  const grid = page.getByRole("grid").element();
  await view.rerender(<AstryxTableClient {...props} columns={replacement} />);
  await expect
    .element(page.getByRole("gridcell", { name: "9007199254740993 maximum", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("gridcell", { name: "5 maximum", exact: true }))
    .toBeVisible();
  expect(page.getByRole("grid").element()).toBe(grid);
  expect(
    page.getByRole("gridcell", { name: "9007199254740995 units", exact: true }).elements(),
  ).toHaveLength(0);
});

test("grouped source filters follow live capability metadata with unchanged column identities", async () => {
  const definition = [
    columns[0],
    { ...columns[1], aggFunc: "countDistinct" },
    columns[2],
  ] as const satisfies AstryxTableColumns<Row>;
  const view = await render(
    <AstryxTableClient {...props} columns={definition} initialPersistedState={preferences} />,
  );
  await expect
    .element(page.getByRole("button", { name: "Filter Region", exact: true }))
    .toBeVisible();
  const replacement = [
    definition[0],
    { ...definition[1], enableFilter: false },
    definition[2],
  ] as const satisfies AstryxTableColumns<Row>;
  await view.rerender(<AstryxTableClient {...props} columns={replacement} />);
  await expect
    .element(page.getByRole("button", { name: "Filter Region", exact: true }))
    .not.toBeInTheDocument();
  await view.rerender(<AstryxTableClient {...props} columns={definition} />);
  await expect
    .element(page.getByRole("button", { name: "Filter Region", exact: true }))
    .toBeVisible();
});

test.for([false, true])(
  "iframe grouping capability removal preserves owned focus (outside: %s)",
  async (outsideFocus) => {
    const outside = await render(<button type="button">Parent outside</button>);
    const frame = document.createElement("iframe");
    frame.title = "Grouping focus document";
    document.body.append(frame);
    let view: Awaited<ReturnType<typeof render>> | undefined;
    try {
      const owner = frame.contentDocument;
      if (owner === null) throw new Error("Expected a same-origin grouping document");
      const container = owner.createElement("div");
      owner.body.append(container);
      view = await render(<AstryxTableClient {...props} />, {
        container,
        baseElement: owner.body,
      });
      // Browser locators resolve in the test document; scope iframe reads to roles.
      const picker = owner.querySelector<HTMLButtonElement>(
        '[role="region"][aria-label="Group By"] button',
      );
      const grid = owner.querySelector<HTMLElement>('[role="grid"]');
      expect(picker).not.toBeNull();
      expect(picker?.textContent).toContain("Add Group");
      expect(grid).not.toBeNull();
      expect(picker instanceof HTMLButtonElement).toBe(false);
      picker!.focus();
      expect(owner.activeElement).toBe(picker);
      const parentButton = outside.getByRole("button", { name: "Parent outside", exact: true });
      if (outsideFocus) {
        parentButton.element().focus();
        expect(owner.hasFocus()).toBe(false);
      }
      const { groupKeyValueFormatter: _formatter, ...desk } = columns[0];
      const replacement = [
        { ...desk, groupBy: false },
        { ...columns[1], groupBy: false },
        columns[2],
      ] as const satisfies AstryxTableColumns<Row>;
      await view.rerender(<AstryxTableClient {...props} columns={replacement} />);
      expect(owner.querySelector('[role="region"][aria-label="Group By"]')).toBeNull();
      if (outsideFocus) {
        await expect.element(parentButton).toHaveFocus();
        expect(owner.hasFocus()).toBe(false);
      } else {
        await expect.poll(() => owner.activeElement).toBe(grid);
        expect(document.activeElement).toBe(frame);
      }
    } finally {
      await view?.unmount();
      frame.remove();
    }
  },
);
