import * as BigDecimal from "effect/BigDecimal";
import { compareTrustedWireSafeBigDecimal } from "effect-view-server/value-semantics";
import { describe, expect, it, vi } from "vitest";

import { AstryxTableBigDecimalColumn, AstryxTableBigDecimalValueType } from "./effect";
import type { AstryxTableColumns } from "./public-types";
import { createAstryxTableClientFacetSnapshot } from "./internal/client-facet";
import {
  deriveAstryxTableClientGroupedProjection,
  type AstryxTableClientGroupingInputRow,
} from "./internal/client-grouping";
import { ColumnConfigurationError, compileColumns } from "./internal/compile-columns";
import { AstryxTableClientRowPipelineAdapter } from "./internal/client-source-adapter";
import { compileClientFilterCollection } from "./internal/grid-query";
import { AstryxTableGridRuntime } from "./internal/grid-runtime";
import {
  createAstryxTableGridPreferences,
  createAstryxTablePersistedState,
} from "./internal/grid-preferences";

const decimal = BigDecimal.fromStringUnsafe;

describe("Effect BigDecimal Value Type", () => {
  it("rejects a spread-mutated helper Value Type before compiling the optional adapter column", () => {
    const [helperColumn] = [
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_EXACT_AMOUNT",
        field: "amount",
        headerName: "Exact amount",
        aggFunc: "sum",
      }),
    ] satisfies AstryxTableColumns<{ readonly amount: BigDecimal.BigDecimal }>;

    expect(() => compileColumns([{ ...helperColumn, valueType: "number" }])).toThrowError(
      new ColumnConfigurationError(
        "AstryxTable Column Helper structural evidence does not match valueType: COL_ID_EXACT_AMOUNT",
      ),
    );
  });

  it("executes exact grouped sum and default-precision average through the optional adapter", () => {
    type DecimalRow = Readonly<{
      readonly id: string;
      readonly group: string;
      readonly amount: BigDecimal.BigDecimal;
    }>;
    const columns = compileColumns([
      {
        columnId: "COL_ID_GROUP",
        field: "group",
        headerName: "Group",
        valueType: "text",
        groupBy: true,
      },
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_AMOUNT_SUM",
        field: "amount",
        headerName: "Amount sum",
        aggFunc: "sum",
      }),
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_AMOUNT_AVG",
        field: "amount",
        headerName: "Amount average",
        aggFunc: "avg",
      }),
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_AMOUNT_MIN",
        field: "amount",
        headerName: "Amount minimum",
        aggFunc: "min",
      }),
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_AMOUNT_MAX",
        field: "amount",
        headerName: "Amount maximum",
        aggFunc: "max",
      }),
    ] satisfies AstryxTableColumns<DecimalRow>);
    const rawRows: readonly DecimalRow[] = Object.freeze([
      { id: "a", group: "fraction", amount: decimal("0.1") },
      { id: "b", group: "fraction", amount: decimal("0.2") },
      { id: "c", group: "third", amount: decimal("1") },
      { id: "d", group: "third", amount: decimal("0") },
      { id: "e", group: "third", amount: decimal("0") },
    ]);
    const rows: readonly AstryxTableClientGroupingInputRow[] = rawRows.map((raw, rowIndex) => ({
      raw,
      rowId: raw.id,
      rowIndex,
      readValue: (column) => (column.kind === "field" ? Reflect.get(raw, column.field) : undefined),
    }));
    const projection = deriveAstryxTableClientGroupedProjection({
      rows,
      columns,
      groupBy: ["COL_ID_GROUP"],
      groupOrderBy: [{ columnId: "COL_ID_GROUP", direction: "asc" }],
    });
    expect(projection.kind).toBe("ready");
    if (projection.kind !== "ready") return;
    const fraction = projection.rows[0]!;
    const third = projection.rows[1]!;
    expect(
      BigDecimal.format(fraction.values.get("COL_ID_AMOUNT_SUM") as BigDecimal.BigDecimal),
    ).toBe("0.3");
    expect(
      BigDecimal.format(fraction.values.get("COL_ID_AMOUNT_MIN") as BigDecimal.BigDecimal),
    ).toBe("0.1");
    expect(
      BigDecimal.format(fraction.values.get("COL_ID_AMOUNT_MAX") as BigDecimal.BigDecimal),
    ).toBe("0.2");
    const expectedThird = BigDecimal.divideUnsafe(decimal("1"), BigDecimal.fromBigInt(3n));
    expect(
      AstryxTableBigDecimalValueType.equivalent(
        third.values.get("COL_ID_AMOUNT_AVG") as BigDecimal.BigDecimal,
        expectedThird,
      ),
    ).toBe(true);
    expect(BigDecimal.format(expectedThird)).toBe(`3.${"3".repeat(99)}e-1`);
  });

  it("rejects over-budget canonical text at the admission boundary", () => {
    const coefficient = BigInt(`1${"3".repeat(4_999)}`);
    const overBudget = BigDecimal.make(coefficient, 0);
    const equivalentScaleVariant = BigDecimal.make(coefficient * 10n, 1);
    const greater = BigDecimal.make(coefficient + 1n, 0);
    const persistenceOnly = BigDecimal.make(coefficient + 2n, 0);

    expect(AstryxTableBigDecimalValueType.decodeRuntime(overBudget)).toEqual({
      _tag: "Failure",
      message: "Expected a wire-safe Effect BigDecimal value.",
    });
    expect(AstryxTableBigDecimalValueType.decodeRuntime(equivalentScaleVariant)._tag).toBe(
      "Failure",
    );
    expect(AstryxTableBigDecimalValueType.decodeRuntime(greater)._tag).toBe("Failure");
    expect(() => AstryxTableBigDecimalValueType.encodePersisted(persistenceOnly)).toThrow(
      "AstryxTable BigDecimal Value Type received an invalid value.",
    );
  });

  it("rejects an unpersistable filter command before publishing state or a preference", () => {
    type PriceRow = Readonly<{ readonly id: string; readonly price: BigDecimal.BigDecimal }>;
    const columns = compileColumns([
      {
        columnId: "COL_ID_COMMAND_PRICE",
        field: "price",
        headerName: "Price",
        valueType: AstryxTableBigDecimalValueType,
      },
    ]);
    const adapter = new AstryxTableClientRowPipelineAdapter<PriceRow>(
      { rows: [], totalRows: 0, version: 1, status: "ready" },
      (row) => row.id,
      columns,
      [],
      [{ columnId: "COL_ID_COMMAND_PRICE", direction: "asc" }],
    );
    const onPersistChange = vi.fn();
    const runtime = new AstryxTableGridRuntime(
      adapter.getPublication(),
      columns,
      adapter.getQueryConfiguration(columns),
      "TABLE_ID_BIGDECIMAL_COMMAND",
      { getOnPersistChange: () => onPersistChange },
    );
    const view = runtime.getView();
    const filterListener = vi.fn();
    const queryListener = vi.fn();
    const activeFilterCountListener = vi.fn();
    const columnFilterListener = vi.fn();
    view.subscribeFilter(filterListener);
    view.subscribeQuery(queryListener);
    view.subscribeActiveFilterCount(activeFilterCountListener);
    view.subscribeColumnFilter("COL_ID_COMMAND_PRICE", columnFilterListener);
    const previousQuery = view.getQuerySnapshot();
    const previousFilters = view.getFilterSnapshot();
    const previousColumnFilter = view.getColumnFilterSnapshot("COL_ID_COMMAND_PRICE");

    const accepted = view.dispatchGridCommand({
      type: "column.filter.replace",
      columnId: "COL_ID_COMMAND_PRICE",
      filter: {
        columnId: "COL_ID_COMMAND_PRICE",
        type: "equals",
        filter: BigDecimal.make(BigInt(`1${"3".repeat(4_999)}`), 0),
      },
    });

    expect(accepted).toBe(false);
    expect(view.getQuerySnapshot()).toBe(previousQuery);
    expect(view.getQuerySnapshot().generation).toBe(previousQuery.generation);
    expect(view.getFilterSnapshot()).toBe(previousFilters);
    expect(view.getFilterSnapshot().filters).toEqual([]);
    expect(view.getColumnFilterSnapshot("COL_ID_COMMAND_PRICE")).toBe(previousColumnFilter);
    expect(queryListener).not.toHaveBeenCalled();
    expect(filterListener).not.toHaveBeenCalled();
    expect(activeFilterCountListener).not.toHaveBeenCalled();
    expect(columnFilterListener).not.toHaveBeenCalled();
    expect(onPersistChange).not.toHaveBeenCalled();
  });

  it("rejects a runtime-admitted filter when persistence encoding throws", () => {
    type PriceRow = Readonly<{ readonly id: string; readonly price: BigDecimal.BigDecimal }>;
    const persistenceFailureValueType = {
      // This authority is a class instance; copy its public semantics explicitly.
      codecId: "effect-bigdecimal-test-persistence-failure",
      codecVersion: AstryxTableBigDecimalValueType.codecVersion,
      filterFamily: AstryxTableBigDecimalValueType.filterFamily,
      editorFamily: AstryxTableBigDecimalValueType.editorFamily,
      cellAlign: AstryxTableBigDecimalValueType.cellAlign,
      editorLayout: AstryxTableBigDecimalValueType.editorLayout,
      defaultWidth: AstryxTableBigDecimalValueType.defaultWidth,
      aggregateResults: AstryxTableBigDecimalValueType.aggregateResults,
      aggregateAlgebra: AstryxTableBigDecimalValueType.aggregateAlgebra,
      decodeRuntime: AstryxTableBigDecimalValueType.decodeRuntime,
      equivalent: AstryxTableBigDecimalValueType.equivalent,
      compare: AstryxTableBigDecimalValueType.compare,
      formatCanonicalText: AstryxTableBigDecimalValueType.formatCanonicalText,
      parseCanonicalText: AstryxTableBigDecimalValueType.parseCanonicalText,
      formatDisplay: AstryxTableBigDecimalValueType.formatDisplay,
      decodePersisted: AstryxTableBigDecimalValueType.decodePersisted,
      encodePersisted: (_value: BigDecimal.BigDecimal): never => {
        throw new TypeError("test persistence failure");
      },
    };
    const columns = compileColumns([
      {
        columnId: "COL_ID_COMMAND_PRICE",
        field: "price",
        headerName: "Price",
        valueType: persistenceFailureValueType,
      },
    ]);
    const adapter = new AstryxTableClientRowPipelineAdapter<PriceRow>(
      { rows: [], totalRows: 0, version: 1, status: "ready" },
      (row) => row.id,
      columns,
      [],
      [{ columnId: "COL_ID_COMMAND_PRICE", direction: "asc" }],
    );
    const onPersistChange = vi.fn();
    const runtime = new AstryxTableGridRuntime(
      adapter.getPublication(),
      columns,
      adapter.getQueryConfiguration(columns),
      "TABLE_ID_BIGDECIMAL_PERSISTENCE_FAILURE",
      { getOnPersistChange: () => onPersistChange },
    );
    const view = runtime.getView();
    const queryListener = vi.fn();
    const filterListener = vi.fn();
    view.subscribeQuery(queryListener);
    view.subscribeFilter(filterListener);
    const previousQuery = view.getQuerySnapshot();
    const previousFilters = view.getFilterSnapshot();
    const admitted = decimal("1.25");

    expect(AstryxTableBigDecimalValueType.decodeRuntime(admitted)._tag).toBe("Success");
    expect(() =>
      view.dispatchGridCommand({
        type: "column.filter.replace",
        columnId: "COL_ID_COMMAND_PRICE",
        filter: {
          columnId: "COL_ID_COMMAND_PRICE",
          type: "equals",
          filter: admitted,
        },
      }),
    ).toThrow("test persistence failure");
    expect(view.getQuerySnapshot()).toBe(previousQuery);
    expect(view.getFilterSnapshot()).toBe(previousFilters);
    expect(queryListener).not.toHaveBeenCalled();
    expect(filterListener).not.toHaveBeenCalled();
    expect(onPersistChange).not.toHaveBeenCalled();
  });

  it("round-trips exact canonical text and tagged persistence without number coercion", () => {
    const exact = decimal("-9007199254740993123456789.0000000000000000001");

    expect(AstryxTableBigDecimalValueType.formatCanonicalText(exact)).toBe(
      "-9.0071992547409931234567890000000000000000001e+24",
    );
    const parsed = AstryxTableBigDecimalValueType.parseCanonicalText(
      "-9.0071992547409931234567890000000000000000001e+24",
    );
    expect(parsed._tag).toBe("Success");
    if (parsed._tag === "Success") {
      expect(AstryxTableBigDecimalValueType.equivalent(parsed.value, exact)).toBe(true);
    }

    const persisted = AstryxTableBigDecimalValueType.encodePersisted(exact);
    expect(persisted).toEqual({
      $astryxTableValue: "effect-bigdecimal",
      version: 1,
      value: "-9.0071992547409931234567890000000000000000001e+24",
    });
    const restored = AstryxTableBigDecimalValueType.decodePersisted(persisted);
    expect(restored._tag).toBe("Success");
    if (restored._tag === "Success") {
      expect(AstryxTableBigDecimalValueType.equivalent(restored.value, exact)).toBe(true);
    }
  });

  it("round-trips a high-precision filter through the shipping Grid Preferences path", () => {
    const exact = decimal("123456789012345678901234567890.00000000000000000000000000000012345");
    const columns = compileColumns([
      {
        columnId: "COL_ID_EXACT_PRICE",
        field: "price",
        headerName: "Price",
        valueType: AstryxTableBigDecimalValueType,
      },
    ]);
    const preferences = createAstryxTableGridPreferences({
      tableId: "TABLE_ID_EXACT_PREFERENCES",
      columns,
      initialFilters: [{ columnId: "COL_ID_EXACT_PRICE", type: "equals", filter: exact }],
      initialOrderBy: [{ columnId: "COL_ID_EXACT_PRICE", direction: "asc" }],
    });
    const json = JSON.stringify(createAstryxTablePersistedState(preferences));
    expect(json).not.toContain('"_id":"BigDecimal"');
    const restored = createAstryxTableGridPreferences({
      tableId: "TABLE_ID_EXACT_PREFERENCES",
      columns,
      initialFilters: [],
      initialOrderBy: [{ columnId: "COL_ID_EXACT_PRICE", direction: "asc" }],
      initialPersistedState: JSON.parse(json),
    });
    const filter = restored.filters[0];
    if (typeof filter !== "object" || filter === null || !("filter" in filter)) {
      throw new TypeError("Expected the restored high-precision BigDecimal filter operand.");
    }
    const decoded = AstryxTableBigDecimalValueType.decodeRuntime(filter.filter);
    expect(decoded._tag).toBe("Success");
    if (decoded._tag === "Success") {
      expect(AstryxTableBigDecimalValueType.equivalent(decoded.value, exact)).toBe(true);
    }
  });

  it("round-trips the exact 4,096-unit boundary through Grid Preferences", () => {
    const exact = BigDecimal.make(BigInt("1".repeat(4_096)), 0);
    const columns = compileColumns([
      {
        columnId: "COL_ID_BOUNDARY_PRICE",
        field: "price",
        headerName: "Price",
        valueType: AstryxTableBigDecimalValueType,
      },
    ]);
    const snapshot = createAstryxTablePersistedState(
      createAstryxTableGridPreferences({
        tableId: "TABLE_ID_BOUNDARY_PREFERENCES",
        columns,
        initialFilters: [{ columnId: "COL_ID_BOUNDARY_PRICE", type: "equals", filter: exact }],
        initialOrderBy: [{ columnId: "COL_ID_BOUNDARY_PRICE", direction: "asc" }],
      }),
    );
    const restored = createAstryxTableGridPreferences({
      tableId: "TABLE_ID_BOUNDARY_PREFERENCES",
      columns,
      initialFilters: [],
      initialOrderBy: [{ columnId: "COL_ID_BOUNDARY_PRICE", direction: "asc" }],
      initialPersistedState: JSON.parse(JSON.stringify(snapshot)),
    });
    expect(restored.filters).toHaveLength(1);
    const filter = restored.filters[0];
    if (typeof filter !== "object" || filter === null || !("filter" in filter)) {
      throw new TypeError("Expected the restored BigDecimal filter operand.");
    }
    const decoded = AstryxTableBigDecimalValueType.decodeRuntime(filter.filter);
    expect(decoded._tag).toBe("Success");
    if (decoded._tag === "Success") {
      expect(AstryxTableBigDecimalValueType.equivalent(decoded.value, exact)).toBe(true);
    }
  });

  it("uses allocation-safe semantic equality and order for scale variants and extreme scales", () => {
    const onePointFive = decimal("1.5");
    const onePointFiveScaled = BigDecimal.make(1500n, 3);
    const tiny = BigDecimal.make(1n, Number.MAX_SAFE_INTEGER);
    const lessTiny = BigDecimal.make(1n, Number.MAX_SAFE_INTEGER - 1);
    const huge = BigDecimal.make(1n, Number.MIN_SAFE_INTEGER);

    expect(AstryxTableBigDecimalValueType.equivalent(onePointFive, onePointFiveScaled)).toBe(true);
    expect(AstryxTableBigDecimalValueType.compare(onePointFive, onePointFiveScaled)).toBe(0);
    expect(AstryxTableBigDecimalValueType.compare(tiny, lessTiny)).toBe(-1);
    expect(AstryxTableBigDecimalValueType.compare(huge, lessTiny)).toBe(1);
    expect(
      AstryxTableBigDecimalValueType.compare(BigDecimal.make(-1n, Number.MIN_SAFE_INTEGER), huge),
    ).toBe(-1);

    const parityValues = [
      decimal("-999999999999999999999.5"),
      BigDecimal.make(-1n, Number.MAX_SAFE_INTEGER),
      decimal("0"),
      BigDecimal.make(1n, Number.MAX_SAFE_INTEGER),
      decimal("1.5"),
      decimal("999999999999999999999.5"),
      BigDecimal.make(1n, Number.MIN_SAFE_INTEGER),
    ];
    for (const left of parityValues) {
      for (const right of parityValues) {
        expect(AstryxTableBigDecimalValueType.compare(left, right)).toBe(
          compareTrustedWireSafeBigDecimal(left, right),
        );
      }
    }
  });

  it("rejects blank, invalid, lookalike, and non-injective BigDecimal inputs", () => {
    for (const invalid of ["", " ", "NaN", "Infinity", "0x10", "1_000"]) {
      expect(AstryxTableBigDecimalValueType.parseCanonicalText(invalid)._tag).toBe("Failure");
    }

    expect(AstryxTableBigDecimalValueType.decodeRuntime({ value: 15n, scale: 1 })).toMatchObject({
      _tag: "Failure",
    });
    expect(() =>
      AstryxTableBigDecimalValueType.compare(
        { value: 15n, scale: 1 } as BigDecimal.BigDecimal,
        decimal("1.5"),
      ),
    ).toThrow("invalid value");
    expect(
      AstryxTableBigDecimalValueType.decodeRuntime(BigDecimal.make(10n, Number.MIN_SAFE_INTEGER)),
    ).toMatchObject({ _tag: "Failure" });
    expect(
      AstryxTableBigDecimalValueType.decodePersisted({
        $astryxTableValue: "effect-bigdecimal",
        version: 1,
        value: "10e9007199254740991",
      }),
    ).toMatchObject({ _tag: "Failure" });
    expect(
      AstryxTableBigDecimalValueType.decodePersisted({
        $astryxTableValue: "effect-bigdecimal",
        version: 2,
        value: "1.5",
      }),
    ).toMatchObject({ _tag: "Failure" });
  });

  it("bounds canonical and persisted BigDecimal text before parsing", () => {
    const maximumLengthText = "1".repeat(4_096);
    const overBudgetText = `${maximumLengthText}1`;

    expect(AstryxTableBigDecimalValueType.parseCanonicalText(maximumLengthText)._tag).toBe(
      "Success",
    );
    expect(AstryxTableBigDecimalValueType.parseCanonicalText(overBudgetText)).toEqual({
      _tag: "Failure",
      message: "BigDecimal text must not exceed 4096 UTF-16 code units.",
    });
    expect(
      AstryxTableBigDecimalValueType.decodePersisted({
        $astryxTableValue: "effect-bigdecimal",
        version: 1,
        value: overBudgetText,
      }),
    ).toEqual({
      _tag: "Failure",
      message: "BigDecimal text must not exceed 4096 UTF-16 code units.",
    });
  });

  it("turns admitted cross-bundle wire values into owned local BigDecimals", () => {
    const foreignPrototype = Object.create(null, {
      "~effect/BigDecimal": { value: "~effect/BigDecimal" },
    });
    const foreignValue = Object.create(foreignPrototype, {
      value: { value: 150n, enumerable: true },
      scale: { value: 2, enumerable: true },
    });

    const decoded = AstryxTableBigDecimalValueType.decodeRuntime(foreignValue);

    expect(decoded._tag).toBe("Success");
    if (decoded._tag === "Success") {
      expect(decoded.value).not.toBe(foreignValue);
      expect(BigDecimal.isBigDecimal(decoded.value)).toBe(true);
      expect(BigDecimal.format(decoded.value)).toBe("1.5");
    }
  });

  it("freezes admitted values so later mutation cannot bypass exact validation", () => {
    const mutable = BigDecimal.make(15n, 1);
    const decoded = AstryxTableBigDecimalValueType.decodeRuntime(mutable);
    const decodedAgain = AstryxTableBigDecimalValueType.decodeRuntime(mutable);

    expect(decoded._tag).toBe("Success");
    if (decoded._tag === "Success") {
      expect(decoded.value).not.toBe(mutable);
      expect(decodedAgain._tag).toBe("Success");
      if (decodedAgain._tag === "Success") {
        expect(decodedAgain.value).toBe(decoded.value);
      }
      expect(Object.isFrozen(decoded.value)).toBe(true);
      expect(Reflect.set(decoded.value, "scale", Number.NaN)).toBe(false);
      Reflect.set(mutable, "scale", Number.NaN);
      expect(AstryxTableBigDecimalValueType.formatCanonicalText(decoded.value)).toBe("1.5");
    }
  });

  it("decodes persisted descriptors once without invoking hostile property access", () => {
    const target = {
      $astryxTableValue: "effect-bigdecimal",
      version: 1,
      value: "1.5",
    };
    const hostile = new Proxy(target, {
      get() {
        throw new Error("persisted property access escaped");
      },
    });

    expect(AstryxTableBigDecimalValueType.decodePersisted(hostile)).toMatchObject({
      _tag: "Success",
    });

    const throwingDescriptor = new Proxy(target, {
      getOwnPropertyDescriptor(_target, key) {
        if (key === "value") throw new Error("descriptor trap escaped");
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(AstryxTableBigDecimalValueType.decodePersisted(throwingDescriptor)).toMatchObject({
      _tag: "Failure",
    });

    const accessor = Object.defineProperties(
      {},
      {
        $astryxTableValue: { enumerable: true, value: "effect-bigdecimal" },
        version: { enumerable: true, value: 1 },
        value: {
          enumerable: true,
          get(): never {
            throw new Error("accessor escaped");
          },
        },
      },
    );
    expect(AstryxTableBigDecimalValueType.decodePersisted(accessor)).toMatchObject({
      _tag: "Failure",
    });
  });
});

describe("AstryxTableBigDecimalColumn", () => {
  it("keeps live facet values and counts in the exact BigDecimal domain", () => {
    type PriceRow = { readonly price: BigDecimal.BigDecimal };
    const definitions = [
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_PRICE",
        enableSetFilter: true,
        field: "price",
        headerName: "Price",
      }),
    ] satisfies AstryxTableColumns<PriceRow>;
    const columns = compileColumns(definitions);
    const column = columns[0]!;
    const one = decimal("1.0000000000000000000000000001");
    const two = decimal("2.0000000000000000000000000002");
    const snapshot = createAstryxTableClientFacetSnapshot({
      column,
      columns,
      filterCollection: compileClientFilterCollection(
        [{ columnId: "COL_ID_PRICE", type: "in", filter: [two] }],
        columns,
      ),
      quickFilter: "",
      quickFilterFields: [],
      rows: [{ price: one }, { price: one }],
      readColumnValue: (compiled, row) =>
        compiled.kind === "field" ? row[compiled.field as keyof PriceRow] : undefined,
      readQuickFilterField: () => undefined,
    });

    expect(snapshot.options).toHaveLength(2);
    expect(snapshot.options[0]).toMatchObject({ count: 2 });
    expect(AstryxTableBigDecimalValueType.equivalent(snapshot.options[0]!.value as never, one)).toBe(
      true,
    );
    expect(snapshot.options[1]).toMatchObject({ count: 0 });
    expect(AstryxTableBigDecimalValueType.equivalent(snapshot.options[1]!.value as never, two)).toBe(
      true,
    );
  });

  it("applies exact numeric defaults and preset then column override precedence", () => {
    const priceColumn = AstryxTableBigDecimalColumn.withDefaults({
      headerName: "Price",
      width: 112,
      cellClassName: "tabular-nums",
    });

    type PriceRow = { readonly price: BigDecimal.BigDecimal };
    const [column] = [
      priceColumn({
        columnId: "COL_ID_PRICE",
        field: "price",
        pinned: "end",
        width: 144,
        valueFormatter: ({ value }) => `GBP ${BigDecimal.format(value)}`,
      }),
    ] satisfies AstryxTableColumns<PriceRow>;

    expect(column).toMatchObject({
      columnId: "COL_ID_PRICE",
      field: "price",
      headerName: "Price",
      valueType: AstryxTableBigDecimalValueType,
      cellAlign: "end",
      editorLayout: "inline",
      width: 144,
      pinned: "end",
      cellClassName: "tabular-nums",
    });
    expect(
      column!.valueFormatter?.({ row: { price: decimal("1.25") }, value: decimal("1.25") }),
    ).toBe("GBP 1.25");
  });

  it("preserves BigDecimal field edit policies through helper and preset precedence", () => {
    const presetValidate = vi.fn(() => "preset invalid");
    const individualValidate = vi.fn(() => undefined);
    const preset = AstryxTableBigDecimalColumn.withDefaults({
      isEditable: true,
      blankValue: null,
      validate: presetValidate,
    });
    const direct = AstryxTableBigDecimalColumn({
      columnId: "COL_ID_DIRECT_NULLABLE",
      field: "nullable",
      headerName: "Direct nullable",
      isEditable: true,
      blankValue: null,
      validate: individualValidate,
    } as never) as Readonly<Record<string, unknown>>;
    const inherited = Reflect.apply(preset, undefined, [
      { columnId: "COL_ID_NULLABLE", field: "nullable", headerName: "Nullable" },
    ]) as Readonly<Record<string, unknown>>;
    const overridden = Reflect.apply(preset, undefined, [
      {
        columnId: "COL_ID_OPTIONAL",
        field: "optional",
        headerName: "Optional",
        blankValue: undefined,
        validate: individualValidate,
      },
    ]) as Readonly<Record<string, unknown>>;
    const computed = Reflect.apply(preset, undefined, [
      {
        columnId: "COL_ID_COMPUTED",
        fields: ["price"],
        valueGetter: ({ row }: { readonly row: { readonly price: BigDecimal.BigDecimal } }) =>
          row.price,
      },
    ]) as Readonly<Record<string, unknown>>;

    expect(direct).toMatchObject({ isEditable: true, blankValue: null });
    expect(direct["validate"]).toBe(individualValidate);
    expect(inherited).toMatchObject({ isEditable: true, blankValue: null });
    expect(inherited["validate"]).toBe(presetValidate);
    expect(overridden).toHaveProperty("blankValue", undefined);
    expect(overridden["validate"]).toBe(individualValidate);
    expect(computed).not.toHaveProperty("isEditable");
    expect(computed).not.toHaveProperty("blankValue");
    expect(computed).not.toHaveProperty("validate");
    expect(() =>
      Reflect.apply(preset, undefined, [
        {
          columnId: "COL_ID_DISABLED",
          field: "nullable",
          headerName: "Disabled",
          isEditable: false,
        },
      ]),
    ).toThrow("blankValue requires potential field editability");
    expect(() =>
      Reflect.apply(preset, undefined, [
        {
          columnId: "COL_ID_INVALID_VALIDATE",
          field: "nullable",
          headerName: "Invalid validate",
          validate: "not-a-function",
        },
      ]),
    ).toThrow("validate must be a function");
    const undefinedValidate = Reflect.apply(preset, undefined, [
      {
        columnId: "COL_ID_UNDEFINED_VALIDATE",
        field: "nullable",
        headerName: "Undefined validate",
        validate: undefined,
      },
    ]);
    expect(() => compileColumns([undefinedValidate])).not.toThrow();

    const validate = () => undefined;
    expect(() =>
      Reflect.apply(AstryxTableBigDecimalColumn, undefined, [
        {
          columnId: "COL_ID_READ_ONLY_VALIDATE",
          field: "price",
          headerName: "Read-only validate",
          validate,
        },
      ]),
    ).toThrow("validate requires potential field editability");
    expect(() =>
      Reflect.apply(AstryxTableBigDecimalColumn.withDefaults, undefined, [{ validate }]),
    ).toThrow("validate requires potential field editability");
    const validatedPreset = Reflect.apply(AstryxTableBigDecimalColumn.withDefaults, undefined, [
      { isEditable: true, validate },
    ]) as (...arguments_: unknown[]) => unknown;
    expect(() =>
      Reflect.apply(validatedPreset, undefined, [
        {
          columnId: "COL_ID_DISABLED_VALIDATE",
          field: "price",
          headerName: "Disabled validate",
          isEditable: false,
        },
      ]),
    ).toThrow("validate requires potential field editability");

    const predicate = vi.fn(() => true);
    const predicatePreset = AstryxTableBigDecimalColumn.withDefaults({
      isEditable: predicate,
      blankValue: null,
    });
    const predicateColumn = Reflect.apply(predicatePreset, undefined, [
      {
        columnId: "COL_ID_PREDICATE_NULLABLE",
        field: "nullable",
        headerName: "Predicate nullable",
      },
    ]) as Readonly<Record<string, unknown>>;
    expect(predicateColumn).toMatchObject({ isEditable: predicate, blankValue: null });
  });

  it("preserves capability-valid grouped presentation through presets", () => {
    const totalPriceColumn = AstryxTableBigDecimalColumn.withDefaults({
      headerName: "Total price",
      aggFunc: "sum",
      aggregateCellClassName: ({ value }) => (value.value < 0n ? "text-destructive" : undefined),
      aggregateValueFormatter: ({ value }) => `GBP ${BigDecimal.format(value)}`,
    });
    type PriceRow = { readonly price: BigDecimal.BigDecimal };
    const [column] = [
      totalPriceColumn({
        columnId: "COL_ID_TOTAL_PRICE",
        field: "price",
      }),
    ] satisfies AstryxTableColumns<PriceRow>;

    expect(column).toMatchObject({
      columnId: "COL_ID_TOTAL_PRICE",
      field: "price",
      aggFunc: "sum",
    });
    if (column === undefined) throw new Error("Expected the aggregate column.");
    expect(
      column.aggregateValueFormatter?.({
        columnId: "COL_ID_TOTAL_PRICE",
        field: "price",
        aggFunc: "sum",
        value: decimal("12.5"),
        rowCount: 2n,
      }),
    ).toBe("GBP 12.5");
  });

  it("drops incompatible preset presentation when a capability is overridden", () => {
    const aggregatePreset = AstryxTableBigDecimalColumn.withDefaults({
      headerName: "Total price",
      aggFunc: "sum",
      aggregateValueFormatter: ({ value }) => BigDecimal.format(value),
    });
    type PriceRow = { readonly price: BigDecimal.BigDecimal };
    const [distinctColumn] = [
      aggregatePreset({
        columnId: "COL_ID_DISTINCT_PRICE",
        field: "price",
        aggFunc: "countDistinct",
      }),
    ] satisfies AstryxTableColumns<PriceRow>;

    expect(distinctColumn).toMatchObject({ aggFunc: "countDistinct" });
    expect(Object.hasOwn(distinctColumn!, "aggregateValueFormatter")).toBe(false);
  });

  it("rejects grouped presentation without its capability at runtime", () => {
    expect(() =>
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_PRICE",
        field: "price",
        headerName: "Price",
        aggregateValueFormatter: () => "invalid",
      } as never),
    ).toThrow("requires aggFunc");
    expect(() =>
      AstryxTableBigDecimalColumn({
        columnId: "COL_ID_PRICE",
        field: "price",
        headerName: "Price",
        groupKeyValueFormatter: () => "invalid",
      } as never),
    ).toThrow("requires groupBy: true");
  });
});
