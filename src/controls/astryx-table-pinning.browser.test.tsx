import { useMemo, useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render, cleanup } from "vitest-browser-react";
import { Table, useTableStickyColumns, pixel, type TableColumn } from "@astryxdesign/core/Table";
import "../styles.css";
type Row = { id: string; value: number };
const rows = Array.from({ length: 8 }, (_, value) => ({ id: `row-${value}`, value }));
const columns: TableColumn<Row>[] = Array.from({ length: 12 }, (_, index) => ({
  key: `c${index}`,
  header: `Column ${index}`,
  width: pixel(120),
  renderCell: (row) => String(row.value),
}));
afterEach(cleanup);
function DynamicTable({ direction, stable }: { direction: "ltr" | "rtl"; stable: boolean }) {
  const [pinned, setPinned] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const sticky = useTableStickyColumns<Row>({
    startKeys: pinned ? [expanded ? "c1" : "c0"] : [],
    endKeys: pinned ? [expanded ? "c10" : "c11"] : [],
  });
  const plugins = useMemo(() => ({ sticky }), [sticky]);
  return (
    <div dir={direction} style={{ width: 640 }}>
      <button onClick={() => setPinned((value) => !value)}>{pinned ? "Unpin" : "Pin"}</button>
      <button onClick={() => setExpanded((value) => !value)}>Expand pinned edges</button>
      <Table
        aria-label="Dynamic table"
        data={rows}
        columns={columns}
        idKey="id"
        plugins={stable ? plugins : { sticky }}
      />
    </div>
  );
}
test.each([
  { direction: "ltr", stable: true },
  { direction: "rtl", stable: true },
  { direction: "ltr", stable: false },
  { direction: "rtl", stable: false },
] as const)("dynamic pinning $direction stable=$stable", async ({ direction, stable }) => {
  await render(<DynamicTable direction={direction} stable={stable} />);
  const table = page.getByRole("table", { name: "Dynamic table" }).element();
  const positions = () =>
    [
      "thead th:first-child",
      "tbody tr:first-child td:first-child",
      "thead th:last-child",
      "tbody tr:first-child td:last-child",
    ].map((selector) => getComputedStyle(table.querySelector(selector)!).position);
  expect(positions()).toEqual(["sticky", "sticky", "sticky", "sticky"]);
  await page.getByRole("button", { name: "Expand pinned edges" }).click();
  for (const section of ["thead", "tbody"]) {
    const tag = section === "thead" ? "th" : "td";
    const start = table.querySelector(`${section} tr:first-child ${tag}:nth-child(2)`)!;
    const end = table.querySelector(`${section} tr:first-child ${tag}:nth-child(11)`)!;
    expect(getComputedStyle(start).position).toBe("sticky");
    expect(getComputedStyle(start).insetInlineStart).toBe("120px");
    expect(getComputedStyle(end).position).toBe("sticky");
    expect(getComputedStyle(end).insetInlineEnd).toBe("120px");
  }
  await page.getByRole("button", { name: "Unpin", exact: true }).click();
  await expect.element(page.getByRole("button", { name: "Pin", exact: true })).toBeVisible();
  await expect
    .poll(() => positions().map((position) => position === "sticky"))
    .toEqual([false, false, false, false]);
  await page.getByRole("button", { name: "Pin", exact: true }).click();
  expect(positions()).toEqual(["sticky", "sticky", "sticky", "sticky"]);
});

const countCellRender = vi.fn((row: Row) => String(row.value));
const countedColumns = columns.map((column) => ({ ...column, renderCell: countCellRender }));
function EquivalentConfiguration() {
  const [counter, setCounter] = useState(0);
  const sticky = useTableStickyColumns<Row>({ startKeys: ["c0"], endKeys: ["c11"] });
  return (
    <>
      <button onClick={() => setCounter((value) => value + 1)}>Refresh unrelated state</button>
      <output aria-label="Refresh count">{counter}</output>
      <Table data={rows} columns={countedColumns} idKey="id" plugins={{ sticky }} />
    </>
  );
}
test("equivalent fresh pin arrays do not rerender unchanged rows", async () => {
  await render(<EquivalentConfiguration />);
  expect(countCellRender.mock.calls.length).toBeGreaterThan(0);
  countCellRender.mockClear();
  await page.getByRole("button", { name: "Refresh unrelated state" }).click();
  await expect.element(page.getByRole("status", { name: "Refresh count" })).toHaveTextContent("1");
  expect(countCellRender).not.toHaveBeenCalled();
});
