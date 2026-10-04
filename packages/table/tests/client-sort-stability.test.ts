import { expect, test } from "vite-plus/test";
import { ClientSortStability } from "../src/internal/client-sort-stability";

type Row = { rowId: string; value: number };
const compare = (a: Row, b: Row) => a.value - b.value || a.rowId.localeCompare(b.rowId);

test("a committed order proves local changes using current neighbours, including simultaneous changes", () => {
  const guard = new ClientSortStability<Row>(compare);
  const rows = [
    { rowId: "c", value: 30 },
    { rowId: "a", value: 10 },
    { rowId: "b", value: 20 },
  ];
  expect(guard.preserves(rows, rows, 2)).toBe(false);
  guard.commit(rows, ["a", "b", "c"]);
  expect(guard.preserves(rows, rows.with(2, { rowId: "b", value: 25 }), 2)).toBe(true);
  expect(guard.preserves(rows, rows.with(2, { rowId: "b", value: 35 }), 2)).toBe(false);
  expect(guard.preserves(rows, rows.with(1, { rowId: "a", value: 0 }), 1)).toBe(true);
  expect(guard.preserves(rows, rows.with(0, { rowId: "c", value: 40 }), 0)).toBe(true);
  const swapped = rows.with(2, { rowId: "b", value: 35 }).with(0, { rowId: "c", value: 25 });
  expect(guard.preserves(rows, swapped, 2)).toBe(false);
  expect(guard.preserves(rows, swapped, 0)).toBe(false);
  expect(guard.preserves([...rows], rows, 2)).toBe(false);
  expect(guard.preserves(rows, rows.with(2, { rowId: "new", value: 20 }), 2)).toBe(false);
});

test("filtered gaps, empty projections and failed comparisons conservatively require projection", () => {
  const guard = new ClientSortStability<Row>((a, b) => {
    if (!Number.isFinite(a.value) || !Number.isFinite(b.value)) throw new Error("Invalid value");
    return compare(a, b);
  });
  const rows = [
    { rowId: "a", value: 10 },
    { rowId: "b", value: 20 },
    { rowId: "c", value: 30 },
  ];
  guard.commit(rows, ["a", "c"]);
  expect(guard.preserves(rows, rows.with(1, { rowId: "b", value: 35 }), 1)).toBe(false);
  expect(guard.preserves(rows, rows.with(0, { rowId: "a", value: 25 }), 0)).toBe(true);
  expect(guard.preserves(rows, rows.with(2, { rowId: "c", value: NaN }), 0)).toBe(false);
  guard.commit(rows, []);
  expect(guard.preserves(rows, rows, 0)).toBe(false);
});

test("neighbour proofs agree with a complete stable sort across repeated batches and directions", () => {
  for (const direction of [1, -1]) {
    const comparator = (a: Row, b: Row) =>
      direction * (a.value - b.value) || a.rowId.localeCompare(b.rowId);
    const guard = new ClientSortStability<Row>(comparator);
    let rows = Array.from({ length: 80 }, (_, index) => ({
      rowId: String(index).padStart(3, "0"),
      value: index % 13,
    }));
    let committedRows = rows;
    let order = rows.toSorted(comparator).map((row) => row.rowId);
    guard.commit(committedRows, order);
    for (let batch = 0; batch < 200; batch++) {
      const indexes = [...new Set([batch % 80, (batch * 17 + 9) % 80])];
      const next = [...rows];
      for (const index of indexes)
        next[index] = { rowId: rows[index]!.rowId, value: (batch * 7 + index) % 35 };
      const expected = next.toSorted(comparator).map((row) => row.rowId);
      const preserved = indexes.every((index) => guard.preserves(committedRows, next, index));
      expect(preserved).toBe(order.every((id, index) => id === expected[index]));
      if (!preserved) {
        committedRows = next;
        order = expected;
        guard.commit(committedRows, order);
      }
      rows = next;
    }
  }
});
