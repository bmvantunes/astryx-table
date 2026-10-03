import { describe, expect, it } from "vitest";

import { compileColumns } from "./compile-columns";
import {
  astryxTableSetValueKey,
  createAstryxTableSetValueIndex,
  hasAstryxTableSetValue,
} from "./set-value-identity";

describe("AstryxTable Set value identity", () => {
  it("shares one nullish bucket while keeping an exact empty string distinct", () => {
    const column = compileColumns([
      {
        columnId: "COL_ID_VALUE",
        field: "value",
        headerName: "Value",
        valueType: "text",
      },
    ])[0]!;

    const keys = [null, undefined, ""].map((value) => astryxTableSetValueKey(column, value));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toBe(keys[2]);
    const index = createAstryxTableSetValueIndex(column, [null, undefined, ""]);
    expect(index.size).toBe(2);
    expect(
      hasAstryxTableSetValue(column, createAstryxTableSetValueIndex(column, [null]), undefined),
    ).toBe(true);
    expect(
      hasAstryxTableSetValue(column, createAstryxTableSetValueIndex(column, [undefined]), null),
    ).toBe(true);
    expect(hasAstryxTableSetValue(column, createAstryxTableSetValueIndex(column, [null]), "")).toBe(
      false,
    );
  });
});
