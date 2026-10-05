import { act } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableQuickFilter,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; category: string };
const rows: Row[] = [
  { id: "ada", name: "Ada", category: "A" },
  { id: "alan", name: "Alan", category: "A" },
  { id: "grace", name: "Grace", category: "B" },
];
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text", width: 120 },
  {
    columnId: "COL_ID_CATEGORY",
    headerName: "Category",
    field: "category",
    valueType: "text",
    groupBy: true,
    width: 120,
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "selection",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: { rows, totalRows: rows.length, version: 1, status: "ready" as const },
};

test("native row checkboxes expose mixed state and select the complete result", async () => {
  await render(<AstryxTableClient {...props} rowSelection />);
  const all = page.getByRole("checkbox", { name: "Select all rows", exact: true });
  const first = page.getByRole("checkbox", { name: "Select row 1", exact: true });
  await expect.element(first).not.toBeChecked();
  await first.click();
  await expect.element(first).toBeChecked();
  await expect.poll(() => (all.element() as HTMLInputElement).indeterminate).toBe(true);
  await all.click();
  await expect.element(all).toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 3", exact: true }))
    .toBeChecked();
  await all.click();
  await expect.element(first).not.toBeChecked();
  await expect.element(all).not.toBeChecked();
});

test("Space selects the Active Row, Shift extends it and Mod+A selects the filtered result", async () => {
  await render(<AstryxTableClient {...props} rowSelection />);
  const grid = page.getByRole("grid", { name: "selection" });
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard(" ");
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 1", exact: true }))
    .toBeChecked();
  await userEvent.keyboard("{ArrowDown}{ArrowDown}{Shift>} {/Shift}");
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 2", exact: true }))
    .toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 3", exact: true }))
    .toBeChecked();
  await expect.element(grid).toHaveFocus();
  await userEvent.keyboard(" ");
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 3", exact: true }))
    .not.toBeChecked();
  await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");
  await expect
    .element(page.getByRole("checkbox", { name: "Select all rows", exact: true }))
    .toBeChecked();
});

test("Shift-click uses the last row anchor while checkboxes stay outside Active Cell navigation", async () => {
  await render(<AstryxTableClient {...props} rowSelection />);
  await page.getByRole("checkbox", { name: "Select row 1", exact: true }).click();
  await userEvent.keyboard("{Shift>}");
  await page.getByRole("checkbox", { name: "Select row 3", exact: true }).click();
  await userEvent.keyboard("{/Shift}");
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 2", exact: true }))
    .toBeChecked();
  const grid = page.getByRole("grid", { name: "selection" });
  await userEvent.keyboard("{Escape}");
  await expect.element(grid).toHaveFocus();
  const active = grid.element().getAttribute("aria-activedescendant");
  expect(document.getElementById(active!)?.getAttribute("data-astryx-column-id")).toBe(
    "COL_ID_NAME",
  );
});

test("filters retain hidden selected identities and live inserts are not selected", async () => {
  const ui = (data: typeof props.clientSource) => (
    <AstryxTableClient {...props} clientSource={data} rowSelection quickFilterFields={["name"]}>
      <AstryxTableQuickFilter />
    </AstryxTableClient>
  );
  const view = await render(ui(props.clientSource));
  const all = page.getByRole("checkbox", { name: "Select all rows", exact: true });
  await all.click();
  const input = page.getByRole("searchbox", { name: "Quick Filter", exact: true });
  await input.fill("Ada");
  await expect.poll(() => page.getByRole("checkbox").elements().length).toBe(2);
  await all.click();
  await input.fill("");
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 1", exact: true }))
    .not.toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 2", exact: true }))
    .toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 3", exact: true }))
    .toBeChecked();
  await view.rerender(
    ui({
      ...props.clientSource,
      rows: [...rows, { id: "zoe", name: "Zoe", category: "B" }],
      totalRows: 4,
      version: 2,
    }),
  );
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 4", exact: true }))
    .not.toBeChecked();
  await view.rerender(
    ui({
      ...props.clientSource,
      rows: rows.filter((row) => row.id !== "alan"),
      totalRows: 2,
      version: 3,
    }),
  );
  await view.rerender(ui({ ...props.clientSource, version: 4 }));
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 2", exact: true }))
    .not.toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 3", exact: true }))
    .toBeChecked();
});

test("grouping discards raw selection and its Shift anchor without persisting the utility column", async () => {
  const saved: unknown[] = [];
  await render(
    <AstryxTableClient {...props} rowSelection onPersistChange={(state) => saved.push(state)} />,
  );
  await page.getByRole("checkbox", { name: "Select row 1", exact: true }).click();
  expect(saved).toHaveLength(0);
  await page.getByRole("button", { name: "Add Group", exact: true }).click();
  await page.getByRole("option", { name: "Category", exact: true }).click();
  await expect.poll(() => page.getByRole("checkbox").elements().length).toBe(0);
  expect(saved).toHaveLength(1);
  expect(JSON.stringify(saved)).not.toContain("COL_ID_ASTRYX_TABLE_ROW_SELECTION");
  await page.getByRole("button", { name: "Remove Category from Group By", exact: true }).click();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 1", exact: true }))
    .not.toBeChecked();
  await userEvent.keyboard("{Shift>}");
  await page.getByRole("checkbox", { name: "Select row 3", exact: true }).click();
  await userEvent.keyboard("{/Shift}");
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 1", exact: true }))
    .not.toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 2", exact: true }))
    .not.toBeChecked();
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 3", exact: true }))
    .toBeChecked();
});

test.each([
  ["ltr", 640],
  ["rtl", 640],
  ["ltr", 180],
  ["rtl", 180],
] as const)(
  "%s keeps the utility gutter visible at width %s with coherent row ownership",
  async (direction, width) => {
    const pinnedColumns = [
      { ...columns[0], pinned: "start" as const },
      columns[1],
      { ...columns[0], columnId: "COL_ID_END" as const, headerName: "End", pinned: "end" as const },
    ];
    const source = Array.from({ length: 2000 }, (_, i) => ({
      id: `row-${i}`,
      name: String(i).padStart(4, "0"),
      category: "A",
    }));
    await render(
      <div dir={direction} style={{ width }}>
        <AstryxTableClient
          {...props}
          rowSelection
          columns={pinnedColumns}
          clientSource={{ rows: source, totalRows: source.length, version: 1, status: "ready" }}
        />
      </div>,
    );
    const grid = page.getByRole("grid", { name: "selection" }).element() as HTMLElement;
    const header = page
      .getByRole("checkbox", { name: "Select all rows", exact: true })
      .element()
      .closest("th")!;
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    await frame();
    await expect.poll(() => header.getBoundingClientRect().width).toBe(40);
    const leading = () =>
      direction === "ltr"
        ? header.getBoundingClientRect().left
        : header.getBoundingClientRect().right;
    await expect
      .poll(() =>
        Math.abs(
          leading() -
            (direction === "ltr"
              ? grid.getBoundingClientRect().left + 1
              : grid.getBoundingClientRect().right - 1),
        ),
      )
      .toBeLessThan(2);
    await page.getByRole("checkbox", { name: "Select all rows", exact: true }).click();
    const initial = leading();
    grid.scrollTop = 3600;
    grid.scrollLeft = direction === "rtl" ? -250 : 250;
    grid.dispatchEvent(new Event("scroll"));
    await expect
      .element(page.getByRole("checkbox", { name: "Select row 101", exact: true }))
      .toBeChecked();
    expect(Math.abs(leading() - initial)).toBeLessThan(1);
    const checkbox = page.getByRole("checkbox", { name: "Select row 101", exact: true }).element();
    const cell = checkbox.closest("td")!;
    expect(
      Math.abs(cell.getBoundingClientRect().left - header.getBoundingClientRect().left),
    ).toBeLessThan(1);
    const semanticRow = [...grid.querySelectorAll('[role="row"][aria-rowindex="102"]')];
    expect(semanticRow).toHaveLength(1);
    expect(semanticRow[0]!.getAttribute("aria-owns")!.split(" ")[0]).toBe(cell.id);
    expect(grid.getAttribute("aria-colcount")).toBe("4");
    expect(grid.querySelectorAll('[role="row"]').length).toBeLessThan(40);
    expect(page.getByRole("checkbox").elements().length).toBeLessThan(40);
    const name = page.getByRole("columnheader", { name: "Name", exact: true }).element();
    expect(getComputedStyle(name).position === "sticky").toBe(width === 640);
    if (width === 640) {
      const gap =
        direction === "ltr"
          ? name.getBoundingClientRect().left - header.getBoundingClientRect().right
          : header.getBoundingClientRect().left - name.getBoundingClientRect().right;
      expect(Math.abs(gap)).toBeLessThan(1);
    }
  },
);

test("disabling and re-enabling Row Selection restores an empty capability", async () => {
  const view = await render(<AstryxTableClient {...props} rowSelection />);
  await page.getByRole("checkbox", { name: "Select row 1", exact: true }).click();
  await view.rerender(<AstryxTableClient {...props} />);
  expect(page.getByRole("checkbox").elements()).toHaveLength(0);
  await view.rerender(<AstryxTableClient {...props} rowSelection />);
  await expect
    .element(page.getByRole("checkbox", { name: "Select row 1", exact: true }))
    .not.toBeChecked();
});

test("a disabled Select All returns its owned focus to the grid", async () => {
  const view = await render(<AstryxTableClient {...props} rowSelection />);
  const all = page.getByRole("checkbox", { name: "Select all rows", exact: true });
  (all.element() as HTMLElement).focus();
  await view.rerender(
    <AstryxTableClient
      {...props}
      rowSelection
      clientSource={{ ...props.clientSource, rows: [], totalRows: 0, version: 2 }}
    />,
  );
  await expect.element(all).toBeDisabled();
  await expect.element(page.getByRole("grid", { name: "selection" })).toHaveFocus();
});

test("empty results never steal focus from another control", async () => {
  const ui = (empty: boolean) => (
    <>
      <button>Outside</button>
      <AstryxTableClient
        {...props}
        rowSelection
        clientSource={
          empty ? { ...props.clientSource, rows: [], totalRows: 0, version: 2 } : props.clientSource
        }
      />
    </>
  );
  const view = await render(ui(false));
  await page.getByRole("checkbox", { name: "Select all rows", exact: true }).click();
  await page.getByRole("button", { name: "Outside", exact: true }).click();
  await view.rerender(ui(true));
  await expect.element(page.getByRole("button", { name: "Outside", exact: true })).toHaveFocus();
});

test.each(["ltr", "rtl"] as const)(
  "%s navigation reveals data columns after the selection gutter and pin insets",
  async (direction) => {
    const pinnedColumns = [
      { ...columns[0], pinned: "start" as const },
      columns[1],
      { ...columns[1], columnId: "COL_ID_MIDDLE" as const, headerName: "Middle" },
      { ...columns[0], columnId: "COL_ID_END" as const, headerName: "End", pinned: "end" as const },
    ];
    await render(
      <div dir={direction} style={{ width: 500 }}>
        <AstryxTableClient {...props} rowSelection columns={pinnedColumns} />
      </div>,
    );
    const grid = page.getByRole("grid", { name: "selection" }).element() as HTMLElement;
    await expect
      .poll(
        () =>
          getComputedStyle(page.getByRole("columnheader", { name: "Name", exact: true }).element())
            .position,
      )
      .toBe("sticky");
    grid.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect
      .poll(() => Math.abs(grid.scrollLeft))
      .toBe(Math.max(480 + 40 - grid.clientWidth, 0));
    const active = document.getElementById(grid.getAttribute("aria-activedescendant")!)!;
    expect(active.getAttribute("data-astryx-column-id")).toBe("COL_ID_MIDDLE");
    expect(active.getAttribute("aria-colindex")).toBe("4");
  },
);

test.each([
  { detail: 1, extras: false },
  { detail: 1, extras: true },
  { detail: 0, extras: false },
])("iframe Shift-click uses owning pointer modifiers (%j)", async ({ detail, extras }) => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  let view: Awaited<ReturnType<typeof render>> | undefined;
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  try {
    const owner = frame.contentDocument!;
    const realm = owner.defaultView!;
    const container = owner.createElement("div");
    owner.body.append(container);
    view = await render(<AstryxTableClient {...props} rowSelection />, {
      container,
      baseElement: owner.body,
    });
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    const boxes = Array.from(owner.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(boxes).toHaveLength(4);
    await act(async () =>
      boxes[1]!.dispatchEvent(new realm.MouseEvent("click", { bubbles: true, detail: 1 })),
    );
    await act(async () => {
      boxes[3]!.dispatchEvent(
        new realm.KeyboardEvent("keydown", {
          key: "Shift",
          code: "ShiftLeft",
          shiftKey: true,
          bubbles: true,
        }),
      );
      boxes[3]!.dispatchEvent(
        new realm.MouseEvent("click", {
          bubbles: true,
          detail,
          shiftKey: true,
          ctrlKey: extras,
          altKey: extras,
          metaKey: extras,
        }),
      );
      boxes[3]!.dispatchEvent(
        new realm.KeyboardEvent("keyup", { key: "Shift", code: "ShiftLeft", bubbles: true }),
      );
    });
    expect(boxes.map((box) => box.checked)).toEqual(
      detail > 0 ? [true, true, true, true] : [false, true, false, true],
    );
  } finally {
    await view?.unmount();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
    frame.remove();
  }
});

test.each([640, 180])("loading preserves selection geometry at width %s", async (width) => {
  const pinnedColumns = [{ ...columns[0], pinned: "start" as const }, columns[1]];
  const ui = (loading: boolean, enabled = true) => (
    <div style={{ width }}>
      <AstryxTableClient
        {...props}
        columns={pinnedColumns}
        rowSelection={enabled ? true : undefined}
        clientSource={{ ...props.clientSource, status: loading ? "loading" : "ready" }}
      />
    </div>
  );
  const view = await render(ui(true));
  const loading = page.getByRole("grid", { name: "Loading table rows" });
  await expect.element(loading).toHaveAttribute("aria-colcount", "3");
  const first = () =>
    loading.element().querySelector<HTMLElement>('[role="gridcell"][aria-colindex="1"]')!;
  await expect.poll(() => first()?.getBoundingClientRect().width).toBe(40);
  await expect
    .element(page.getByRole("gridcell", { name: "Loading Name", exact: true }).first())
    .toHaveAttribute("aria-colindex", "2");
  const name = page.getByRole("gridcell", { name: "Loading Name", exact: true }).first().element();
  await expect
    .poll(() =>
      Math.round(name.getBoundingClientRect().left - first().getBoundingClientRect().right),
    )
    .toBe(0);
  const before = name.getBoundingClientRect().left - loading.element().getBoundingClientRect().left;
  await view.rerender(ui(false));
  const ready = page.getByRole("grid", { name: "selection" });
  await expect.element(ready).toHaveAttribute("aria-colcount", "3");
  const data = page.getByRole("gridcell", { name: "Ada", exact: true });
  await expect.element(data).toHaveAttribute("aria-colindex", "2");
  // Loaded chrome has a one-pixel border; both projections preserve the 40px gutter.
  expect(
    Math.abs(
      data.element().getBoundingClientRect().left -
        ready.element().getBoundingClientRect().left -
        before,
    ),
  ).toBeLessThanOrEqual(1);
  await view.rerender(ui(true, false));
  await expect.element(loading).toHaveAttribute("aria-colcount", "2");
  await expect
    .element(page.getByRole("gridcell", { name: "Loading Name", exact: true }).first())
    .toHaveAttribute("aria-colindex", "1");
});

test.each([
  { enabled: true, outside: false },
  { enabled: false, outside: false },
  { enabled: true, outside: true },
  { enabled: false, outside: true },
])("loading capability changes preserve owned focus (%j)", async ({ enabled, outside }) => {
  const loadingSource = { ...props.clientSource, status: "loading" as const };
  const ui = (selection: boolean) => (
    <>
      <button>Outside selection</button>
      <AstryxTableClient
        {...props}
        rowSelection={selection ? true : undefined}
        clientSource={loadingSource}
      />
    </>
  );
  const view = await render(ui(enabled));
  const grid = page.getByRole("grid", { name: "Loading table rows" });
  (grid.element() as HTMLElement).focus();
  if (outside) await page.getByRole("button", { name: "Outside selection", exact: true }).click();
  await view.rerender(ui(!enabled));
  await expect
    .element(outside ? page.getByRole("button", { name: "Outside selection", exact: true }) : grid)
    .toHaveFocus();
});
