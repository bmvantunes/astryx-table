import { useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render, cleanup } from "vitest-browser-react";
import {
  Table,
  TableSelectionToolbar,
  useTableSortable,
  pixel,
  type TableColumn,
  type TableSortState,
} from "@astryxdesign/core/Table";
import "../styles.css";
type Row = { id: string; amount: bigint };
const rows: Row[] = [
  { id: "a", amount: 9007199254740993n },
  { id: "b", amount: 9007199254740992n },
];
const columns: TableColumn<Row>[] = [
  {
    key: "amount",
    header: "Amount",
    sortable: true,
    width: pixel(240),
    renderCell: (row) => String(row.amount),
  },
];
afterEach(cleanup);
function SelectionExample() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(["a", "outside-window"]),
  );
  return (
    <TableSelectionToolbar
      label="Selected rows"
      startContent={<button>Export selected</button>}
      clearLabel="Clear selected"
      renderSelectionLabel={(count) => `${count} selected`}
      selection={{
        selectedKeys: selected,
        selectedCount: selected.size,
        hasSelection: selected.size > 0,
        clearSelection: () => setSelected(new Set()),
      }}
    />
  );
}
test("selection toolbar accepts consumer-owned projection including offscreen selection", async () => {
  await render(<SelectionExample />);
  await expect.element(page.getByRole("toolbar", { name: "Selected rows" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Export selected" })).toBeVisible();
  await expect
    .element(page.getByRole("toolbar", { name: "Selected rows" }))
    .toHaveTextContent("2 selected");
  await page.getByRole("button", { name: "Clear selected" }).click();
  await expect
    .element(page.getByRole("toolbar", { name: "Selected rows" }))
    .not.toBeInTheDocument();
});
function SortExample() {
  const [sort, setSort] = useState<TableSortState>([{ sortKey: "amount", direction: "ascending" }]);
  const plugin = useTableSortable<Row>({ sort, onSortChange: setSort, allowUnsortedState: false });
  return (
    <>
      <output aria-label="Sort state">{JSON.stringify(sort)}</output>
      <Table
        aria-label="Exact controlled"
        data={rows}
        columns={columns}
        idKey="id"
        plugins={{ sort: plugin }}
      />
    </>
  );
}
test("sorting plugin sends controlled commands without coercing exact cell values", async () => {
  await render(<SortExample />);
  const header = page.getByRole("columnheader");
  const button = page.getByRole("button").filter({ hasText: "Amount" });
  await expect.element(header).toHaveAttribute("aria-sort", "ascending");
  await expect
    .element(page.getByRole("cell", { name: "9007199254740993", exact: true }))
    .toBeVisible();
  await button.click();
  await expect
    .element(page.getByRole("status", { name: "Sort state" }))
    .toHaveTextContent("descending");
  await expect.element(header).toHaveAttribute("aria-sort", "descending");
  await button.click();
  await expect
    .element(page.getByRole("status", { name: "Sort state" }))
    .toHaveTextContent("ascending");
  await expect.element(header).toHaveAttribute("aria-sort", "ascending");
});
