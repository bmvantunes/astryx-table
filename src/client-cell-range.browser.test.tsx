import { act } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";
import "./styles.css";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
type Row = { id: string; name: string; amount: bigint };
const rows: Row[] = [
  { id: "a", name: "Ada", amount: 9007199254740993n },
  { id: "b", name: "Alan", amount: 9007199254740995n },
  { id: "c", name: "Grace", amount: 9007199254740997n },
];
const columns = [
  {
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    valueType: "text",
    width: 120,
    groupBy: true,
  },
  {
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    valueType: "bigint",
    width: 120,
    valueFormatter: () => "Formatted amount",
    aggFunc: "sum",
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "range",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: { rows, totalRows: rows.length, version: 1, status: "ready" as const },
};
const copy = async () => userEvent.keyboard("{ControlOrMeta>}c{/ControlOrMeta}");

test("Shift arrows select one exact vertical span and copy canonical values", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await render(<AstryxTableClient {...props} />);
  const grid = page.getByRole("grid", { name: "range", exact: true });
  await expect.element(grid).toHaveAttribute("aria-multiselectable", "true");
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
  await expect
    .poll(() => grid.element().querySelectorAll('[role="gridcell"][aria-selected="true"]').length)
    .toBe(3);
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada\nAlan\nGrace");
  await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada\nAlan\nGrace");
  await userEvent.keyboard("{Escape}{ArrowRight}");
  await copy();
  expect(write).toHaveBeenLastCalledWith("9007199254740997");
});

test("horizontal selection copies exact canonical bigint rather than display text", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await render(<AstryxTableClient {...props} />);
  const grid = page.getByRole("grid", { name: "range", exact: true });
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada\t9007199254740993");
});

test("value updates and changes outside a span preserve it; changed covered identities clear before Copy", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const ui = (nextRows: readonly Row[], version: number) => (
    <AstryxTableClient
      {...props}
      clientSource={{ rows: nextRows, totalRows: nextRows.length, version, status: "ready" }}
    />
  );
  const view = await render(ui(rows, 1));
  const grid = page.getByRole("grid", { name: "range", exact: true });
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard("{ArrowRight}{Shift>}{ArrowDown}{/Shift}");
  const updated = rows.map((row) => ({ ...row, amount: row.amount + 10n }));
  await view.rerender(ui(updated, 2));
  await copy();
  expect(write).toHaveBeenLastCalledWith("9007199254741003\n9007199254741005");
  await view.rerender(ui([...updated, { id: "z", name: "Zoe", amount: 1n }], 3));
  await copy();
  expect(write).toHaveBeenLastCalledWith("9007199254741003\n9007199254741005");
  write.mockClear();
  await view.rerender(ui([...updated, { id: "middle", name: "Adam", amount: 2n }], 4));
  await copy();
  expect(write).not.toHaveBeenCalled();
  await expect
    .element(page.getByRole("status", { name: "range interaction status", exact: true }))
    .toHaveTextContent("selected cells are no longer available");
  await expect.poll(() => grid.element().querySelectorAll('[aria-selected="true"]').length).toBe(0);
});

test("replacing a column inside a horizontal span clears it before Copy", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const expanded = [
    ...columns,
    { ...columns[0], columnId: "COL_ID_LAST", headerName: "Last" },
  ] as const satisfies AstryxTableColumns<Row>;
  const view = await render(<AstryxTableClient {...props} columns={expanded} />);
  const grid = page.getByRole("grid", { name: "range", exact: true });
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada\t9007199254740993\tAda");
  write.mockClear();
  await view.rerender(
    <AstryxTableClient
      {...props}
      columns={[expanded[0], { ...expanded[1], columnId: "COL_ID_REPLACED" }, expanded[2]]}
    />,
  );
  await copy();
  expect(write).not.toHaveBeenCalled();
});

test("Copy captures one payload before live publications and ignores an older write's announcement", async () => {
  let finishFirst: (() => void) | undefined;
  const write = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockResolvedValue();
  const view = await render(<AstryxTableClient {...props} />);
  const grid = page.getByRole("grid", { name: "range", exact: true });
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
  await copy();
  expect(write).toHaveBeenNthCalledWith(1, "Ada\nAlan");
  await view.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{
        ...props.clientSource,
        version: 2,
        rows: rows.map((row) => ({ ...row, amount: 0n })),
      }}
    />,
  );
  await userEvent.keyboard("{Escape}{ArrowRight}");
  await copy();
  expect(write).toHaveBeenNthCalledWith(2, "0");
  await expect
    .element(page.getByRole("status", { name: "range interaction status", exact: true }))
    .toHaveTextContent("1 cell copied");
  await act(async () => finishFirst?.());
  await expect
    .element(page.getByRole("status", { name: "range interaction status", exact: true }))
    .toHaveTextContent("1 cell copied");
});

test.each(["throw", "reject"] as const)(
  "clipboard %s gives an accessible failure",
  async (failure) => {
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() => {
      if (failure === "throw") throw new Error("Denied");
      return Promise.reject(new Error("Denied"));
    });
    await render(<AstryxTableClient {...props} />);
    (page.getByRole("grid", { name: "range", exact: true }).element() as HTMLElement).focus();
    await copy();
    await expect
      .element(page.getByRole("status", { name: "range interaction status", exact: true }))
      .toHaveTextContent("browser rejected the clipboard write");
  },
);

test("grouping clears the raw span and fresh grouped Copy preserves exact aggregate and Rows domains", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await render(<AstryxTableClient {...props} />);
  const grid = page.getByRole("grid", { name: "range", exact: true });
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
  await page.getByRole("button", { name: "Name column menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add to Group By", exact: true }).click();
  await expect.element(page.getByRole("columnheader", { name: "Rows", exact: true })).toBeVisible();
  await expect.poll(() => grid.element().querySelectorAll('[aria-selected="true"]').length).toBe(0);
  (grid.element() as HTMLElement).focus();
  await userEvent.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
  await copy();
  expect(write).toHaveBeenLastCalledWith("Ada\t1\t9007199254740993");
});
