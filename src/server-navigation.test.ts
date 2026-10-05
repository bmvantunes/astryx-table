import { expect, test } from "vite-plus/test";
import { AstryxTableNavigationRuntime } from "../packages/table/src/internal/navigation";
import { compileColumns } from "../packages/table/src/internal/compile-columns";

test("pointer coordinates never replace authoritative row keys or admit invalid positions", () => {
  const navigation = new AstryxTableNavigationRuntime();
  const columns = compileColumns([
    { columnId: "COL_ID_NAME", field: "name", headerName: "Name", valueType: "text" },
  ]);
  navigation.setShape([undefined, "source-key"], columns);
  navigation.activateHeader("COL_ID_NAME");
  expect(navigation.activateBody(0, undefined, "COL_ID_NAME")).toBe(true);
  expect(navigation.getSnapshot()).toMatchObject({ region: "body", rowIndex: 0, rowId: undefined });
  for (const index of [NaN, Infinity, -1, 0.5, 2])
    expect(navigation.activateBody(index, undefined, "COL_ID_NAME")).toBe(false);
  expect(navigation.activateBody(1, undefined, "COL_ID_NAME")).toBe(false);
  expect(navigation.activateBody(1, "raw-record-id", "COL_ID_NAME")).toBe(false);
  expect(navigation.activateBody(0, undefined, "COL_ID_MISSING")).toBe(false);
  navigation.setShape(["delivered-key", "source-key"], columns);
  expect(navigation.getSnapshot()).toMatchObject({ rowIndex: 0, rowId: "delivered-key" });
  expect(navigation.activateBody(0, undefined, "COL_ID_NAME")).toBe(false);
  expect(navigation.activateBody(1, "source-key", "COL_ID_NAME")).toBe(true);
});
