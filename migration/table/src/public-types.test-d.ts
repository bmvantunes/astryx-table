import { describe, expectTypeOf, it } from "vitest";

import { Schema } from "effect";
import { ViewServerId, defineViewServerConfig } from "effect-view-server/config";
import { createViewServerReact } from "effect-view-server/react";
import { SourceAdapter } from "effect-view-server/source-adapter";
import type {
  LiveQueryViewportBaseRow,
  LiveQueryViewportCompleteRawSelect,
  LiveQueryViewportWhere,
} from "effect-view-server/react/viewport-base-row";
import type { ReactElement, ReactNode } from "react";
import type { LiveQueryResult } from "effect-view-server/config/query";

import {
  AstryxTableBigIntColumn,
  AstryxTableBooleanColumn,
  AstryxTableClient,
  AstryxTableComputedColumn,
  AstryxTableQuickFilter,
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableAggregateAlgebra,
  AstryxTableFilterControl,
  AstryxTableLoadedRowCount,
  AstryxTableResultRowCount,
  AstryxTableNumberColumn,
  AstryxTableSelectColumn,
  AstryxTableServer,
  AstryxTableTextColumn,
  AstryxTableToolbar,
} from "./index";
import * as AstryxTablePublic from "./index";

import type {
  AstryxTableAggregateAlgebra as AstryxTableAggregateAlgebraType,
  AstryxTableAggregateResults,
  AstryxTableClientProps,
  AstryxTableClientSource,
  AstryxTableCommonProps,
  AstryxTableColumnField,
  AstryxTableColumnId,
  AstryxTableColumnIdOf,
  AstryxTableColumns,
  AstryxTableColumnValue,
  AstryxTableDecodeResult,
  AstryxTableEditableColumnId,
  AstryxTableEditRowPatch,
  AstryxTableEditRowProjector,
  AstryxTableEditRowProjectorInput,
  AstryxTableEditingCapability,
  AstryxTableFilterableColumnId,
  AstryxTableFilterExpression,
  AstryxTableFilterExpressions,
  AstryxTableQuickFilterField,
  AstryxTableQuickFilterFields,
  AstryxTableGroupKeyCellParams,
  AstryxTableGroupKeyPresence,
  AstryxTableGroupRowsColumnOptions,
  AstryxTablePersistedState,
  AstryxTableSaveCellChange,
  AstryxTableSaveChangeSet,
  AstryxTableServerProps,
  AstryxTableSortableColumnId,
  AstryxTableSortBy,
  AstryxTableValueType,
} from "./index";

type ExactMoney = Readonly<{ readonly minorUnits: bigint }>;

const exactMoneyAlgebra = AstryxTableAggregateAlgebra<ExactMoney>({
  add: (left, right) => ({ minorUnits: left.minorUnits + right.minorUnits }),
  divideByCount: (total, count) => ({ minorUnits: total.minorUnits / count }),
});
expectTypeOf(exactMoneyAlgebra).toMatchTypeOf<AstryxTableAggregateAlgebraType<ExactMoney>>();

const exactMoneyValueType = {
  codecId: "example/exact-money",
  codecVersion: 1,
  filterFamily: "numeric",
  editorFamily: "text",
  cellAlign: "end",
  editorLayout: "inline",
  defaultWidth: 120,
  aggregateResults: { countDistinct: "bigint", sum: "self", avg: "self" },
  aggregateAlgebra: exactMoneyAlgebra,
  decodeRuntime: (input: unknown) =>
    typeof input === "object" && input !== null && "minorUnits" in input
      ? { _tag: "Success" as const, value: input as ExactMoney }
      : { _tag: "Failure" as const, message: "Expected exact money." },
  equivalent: (left: ExactMoney, right: ExactMoney) => left.minorUnits === right.minorUnits,
  compare: (left: ExactMoney, right: ExactMoney) =>
    left.minorUnits === right.minorUnits ? 0 : left.minorUnits < right.minorUnits ? -1 : 1,
  formatCanonicalText: (value: ExactMoney) => value.minorUnits.toString(),
  parseCanonicalText: (text: string) => ({
    _tag: "Success" as const,
    value: { minorUnits: BigInt(text) },
  }),
  formatDisplay: (value: ExactMoney) => value.minorUnits.toString(),
  encodePersisted: (value: ExactMoney) => value.minorUnits.toString(),
  decodePersisted: (input: unknown) =>
    typeof input === "string"
      ? { _tag: "Success" as const, value: { minorUnits: BigInt(input) } }
      : { _tag: "Failure" as const, message: "Expected persisted exact money." },
} satisfies AstryxTableValueType<
  ExactMoney,
  "numeric",
  "text",
  { readonly countDistinct: "bigint"; readonly sum: "self"; readonly avg: "self" }
>;
void exactMoneyValueType;

const sumWithoutAlgebra = {
  ...exactMoneyValueType,
  aggregateResults: { sum: "self" as const },
  aggregateAlgebra: undefined,
};
// @ts-expect-error Advertising sum requires an exact add operation.
const invalidSumWithoutAlgebra: AstryxTableValueType<
  ExactMoney,
  "numeric",
  "text",
  { readonly sum: "self" }
> = sumWithoutAlgebra;
void invalidSumWithoutAlgebra;

const invalidAggregateResultPair = {
  // @ts-expect-error countDistinct always produces bigint.
  countDistinct: "self",
} satisfies AstryxTableAggregateResults;
void invalidAggregateResultPair;

const exactMoneyValueTypeBase = {
  codecId: "example/single-generic-exact-money",
  codecVersion: 1,
  filterFamily: "numeric" as const,
  editorFamily: "text" as const,
  cellAlign: "end" as const,
  editorLayout: "inline" as const,
  defaultWidth: 120,
  decodeRuntime: exactMoneyValueType.decodeRuntime,
  equivalent: exactMoneyValueType.equivalent,
  compare: exactMoneyValueType.compare,
  formatCanonicalText: exactMoneyValueType.formatCanonicalText,
  parseCanonicalText: exactMoneyValueType.parseCanonicalText,
  formatDisplay: exactMoneyValueType.formatDisplay,
  encodePersisted: exactMoneyValueType.encodePersisted,
  decodePersisted: exactMoneyValueType.decodePersisted,
};

const exactMoneyNonArithmeticAggregates = {
  ...exactMoneyValueTypeBase,
  aggregateResults: { countDistinct: "bigint", min: "self", max: "self" },
} satisfies AstryxTableValueType<ExactMoney>;
void exactMoneyNonArithmeticAggregates;

const exactMoneySingleGenericArithmetic = {
  ...exactMoneyValueTypeBase,
  aggregateResults: { sum: "self", avg: "self" },
  aggregateAlgebra: exactMoneyAlgebra,
} satisfies AstryxTableValueType<ExactMoney>;
void exactMoneySingleGenericArithmetic;

const exactMoneySingleGenericSumWithoutAlgebra = {
  ...exactMoneyValueTypeBase,
  aggregateResults: { sum: "self" as const },
};
// @ts-expect-error The single-generic form still requires exact addition for sum.
const invalidSingleGenericSumWithoutAlgebra: AstryxTableValueType<ExactMoney> =
  exactMoneySingleGenericSumWithoutAlgebra;
void invalidSingleGenericSumWithoutAlgebra;

const exactMoneySingleGenericAverageWithoutDivision = {
  ...exactMoneyValueTypeBase,
  aggregateResults: { avg: "self" as const },
  aggregateAlgebra: AstryxTableAggregateAlgebra<ExactMoney>({
    add: (left, right) => ({ minorUnits: left.minorUnits + right.minorUnits }),
  }),
};
// @ts-expect-error The single-generic form requires exact division for avg.
const invalidSingleGenericAverageWithoutDivision: AstryxTableValueType<ExactMoney> =
  exactMoneySingleGenericAverageWithoutDivision;
void invalidSingleGenericAverageWithoutDivision;

type Order = {
  readonly id: string;
  readonly symbol: string;
  readonly price: number;
  readonly quantity: bigint;
  readonly status: "open" | "closed";
  readonly revision: bigint;
  readonly hiddenLabel: string;
};

type OptionalGroupRow = Readonly<{ readonly optional?: string | null }>;
expectTypeOf<AstryxTableGroupKeyPresence<string | null | undefined>>().toEqualTypeOf<
  | Readonly<{ readonly _tag: "Missing" }>
  | Readonly<{
      readonly _tag: "Present";
      readonly value: string | null | undefined;
    }>
>();
const optionalGroupColumns = [
  {
    columnId: "COL_ID_OPTIONAL",
    field: "optional",
    headerName: "Optional",
    valueType: "text",
    groupBy: true,
  },
] as const satisfies AstryxTableColumns<OptionalGroupRow>;
const exactRowsPresenceCallbacks = {
  valueFormatter: ({ groupKeys }) => {
    const key = groupKeys[0];
    if (key?._tag === "Present") {
      expectTypeOf(key.columnId).toEqualTypeOf<"COL_ID_OPTIONAL">();
      expectTypeOf(key.field).toEqualTypeOf<"optional">();
      expectTypeOf(key.value).toEqualTypeOf<string | null | undefined>();
      return String(key.value);
    }
    if (key?._tag === "Missing") {
      // @ts-expect-error Missing evidence owns no fabricated value.
      void key.value;
    }
    return "Missing";
  },
} satisfies AstryxTableGroupRowsColumnOptions<OptionalGroupRow, typeof optionalGroupColumns>;
void exactRowsPresenceCallbacks;

type AggregateMatrixRow = Readonly<{
  text: string;
  boolean: boolean;
  number: number;
  bigint: bigint;
}>;

const builtInAggregateMatrix = [
  {
    columnId: "COL_ID_TEXT_DISTINCT",
    field: "text",
    headerName: "Text distinct",
    valueType: "text",
    aggFunc: "countDistinct",
  },
  {
    columnId: "COL_ID_TEXT_MIN",
    field: "text",
    headerName: "Text min",
    valueType: "text",
    aggFunc: "min",
  },
  {
    columnId: "COL_ID_TEXT_MAX",
    field: "text",
    headerName: "Text max",
    valueType: "text",
    aggFunc: "max",
  },
  {
    columnId: "COL_ID_BOOLEAN_DISTINCT",
    field: "boolean",
    headerName: "Boolean distinct",
    valueType: "boolean",
    aggFunc: "countDistinct",
  },
  {
    columnId: "COL_ID_BOOLEAN_MIN",
    field: "boolean",
    headerName: "Boolean min",
    valueType: "boolean",
    aggFunc: "min",
  },
  {
    columnId: "COL_ID_BOOLEAN_MAX",
    field: "boolean",
    headerName: "Boolean max",
    valueType: "boolean",
    aggFunc: "max",
  },
  {
    columnId: "COL_ID_NUMBER_DISTINCT",
    field: "number",
    headerName: "Number distinct",
    valueType: "number",
    aggFunc: "countDistinct",
  },
  {
    columnId: "COL_ID_NUMBER_MIN",
    field: "number",
    headerName: "Number min",
    valueType: "number",
    aggFunc: "min",
  },
  {
    columnId: "COL_ID_NUMBER_MAX",
    field: "number",
    headerName: "Number max",
    valueType: "number",
    aggFunc: "max",
  },
  {
    columnId: "COL_ID_BIGINT_DISTINCT",
    field: "bigint",
    headerName: "Bigint distinct",
    valueType: "bigint",
    aggFunc: "countDistinct",
  },
  {
    columnId: "COL_ID_BIGINT_SUM",
    field: "bigint",
    headerName: "Bigint sum",
    valueType: "bigint",
    aggFunc: "sum",
  },
  {
    columnId: "COL_ID_BIGINT_MIN",
    field: "bigint",
    headerName: "Bigint min",
    valueType: "bigint",
    aggFunc: "min",
  },
  {
    columnId: "COL_ID_BIGINT_MAX",
    field: "bigint",
    headerName: "Bigint max",
    valueType: "bigint",
    aggFunc: "max",
  },
] as const satisfies AstryxTableColumns<AggregateMatrixRow>;
void builtInAggregateMatrix;

const forbiddenBuiltInAggregates = [
  // @ts-expect-error Number sum is Server-owned BigDecimal semantics, not a Client number result.
  {
    columnId: "COL_ID_NUMBER_SUM",
    field: "number",
    headerName: "Number sum",
    valueType: "number",
    aggFunc: "sum",
  },
  // @ts-expect-error Number average is Server-owned BigDecimal semantics.
  {
    columnId: "COL_ID_NUMBER_AVG",
    field: "number",
    headerName: "Number average",
    valueType: "number",
    aggFunc: "avg",
  },
  // @ts-expect-error Bigint average is Server-owned BigDecimal semantics.
  {
    columnId: "COL_ID_BIGINT_AVG",
    field: "bigint",
    headerName: "Bigint average",
    valueType: "bigint",
    aggFunc: "avg",
  },
] as const satisfies AstryxTableColumns<AggregateMatrixRow>;
void forbiddenBuiltInAggregates;

const columns = [
  {
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
    isEditable: true,
  },
  {
    columnId: "COL_ID_PRICE",
    field: "price",
    headerName: "Price",
    valueType: "number",
    isEditable: ({ row, value }) => row.status === "open" && value > 0,
    valueFormatter: ({ value }) => value.toFixed(2),
  },
  AstryxTableComputedColumn({
    columnId: "COL_ID_DOUBLE_QUANTITY",
    fields: ["quantity"],
    headerName: "Double quantity",
    valueType: "bigint",
    valueGetter: ({ row }) => row.quantity * 2n,
  }),
] as const satisfies AstryxTableColumns<Order>;

type Columns = typeof columns;

const rowAwareEditableColumns = [
  {
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
    isEditable: true,
    valueFormatter: ({ row, value }) => `${row.hiddenLabel}:${value}`,
  },
  {
    columnId: "COL_ID_PRICE",
    field: "price",
    headerName: "Price",
    valueType: "number",
    isEditable: true,
    cellClassName: ({ row }) => (row.status === "open" ? "open" : undefined),
  },
  {
    columnId: "COL_ID_QUANTITY",
    field: "quantity",
    headerName: "Quantity",
    valueType: "bigint",
    isEditable: true,
    cellRenderer: ({ row, value }) => `${row.symbol}:${value}`,
  },
  {
    columnId: "COL_ID_REVISION",
    field: "revision",
    headerName: "Revision",
    valueType: "bigint",
    valueFormatter: ({ row, value }) => `${row.id}:${value}`,
  },
] as const satisfies AstryxTableColumns<Order>;

const serverWitnessConfig = defineViewServerConfig({
  topics: {
    orders: {
      schema: Schema.Struct({
        id: ViewServerId,
        symbol: Schema.String,
        price: Schema.Number,
        quantity: Schema.BigInt,
        status: Schema.Literals(["open", "closed"]),
        revision: Schema.BigInt,
        hiddenLabel: Schema.String,
      }),
    },
    positions: {
      schema: Schema.Struct({
        id: ViewServerId,
        symbol: Schema.String,
        price: Schema.Number,
        quantity: Schema.BigInt,
        status: Schema.Literals(["open", "closed"]),
        revision: Schema.BigInt,
        hiddenLabel: Schema.String,
        account: Schema.String,
      }),
    },
  },
});
const serverWitnessReact = createViewServerReact(serverWitnessConfig);
const orderViewportSource = serverWitnessReact.useLiveQueryViewport("orders");
const positionViewportSource = serverWitnessReact.useLiveQueryViewport("positions");
const leasedTypeSourceAdapter = SourceAdapter.make({
  identity: { name: "astryx-table-route-type-tests" },
  failure: Schema.Never,
  materialized: undefined,
  leased: {
    metrics: Schema.Struct({ observed: Schema.BigInt }),
    rejectionLocation: Schema.Struct({ offset: Schema.BigInt }),
    definitionOptions: SourceAdapter.definitionOptions<undefined>(),
  },
});
const leasedServerWitnessConfig = defineViewServerConfig({
  topics: {
    orders: {
      schema: serverWitnessConfig.topics.orders.schema,
      source: leasedTypeSourceAdapter.leasedSource(["status", "revision"], undefined),
    },
  },
});
const leasedServerWitnessReact = createViewServerReact(leasedServerWitnessConfig);
const leasedOrderViewportSource = leasedServerWitnessReact.useLiveQueryViewport("orders");
declare const unsafeAnyViewport: any;
declare const unsafeUnknownViewport: unknown;
declare const unsafeUnwitnessedViewport: Readonly<{ readonly destroy: () => void }>;
declare const unsafeBroadViewport: Readonly<Record<string, (_row: Order) => Order>>;

describe("AstryxTableServer viewport row witness", () => {
  it("derives the exact base row and rejects mismatched or erased sources", () => {
    expectTypeOf<
      LiveQueryViewportBaseRow<typeof orderViewportSource.viewport>
    >().toEqualTypeOf<Order>();
    expectTypeOf(orderViewportSource.completeRawSelect).toEqualTypeOf<
      LiveQueryViewportCompleteRawSelect<typeof orderViewportSource.viewport>
    >();

    const matchingProps = {
      tableId: "TABLE_ID_WITNESSED_SERVER",
      columns,
      initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
      viewportSource: orderViewportSource,
      onPersistChange: (state) =>
        expectTypeOf(state).toEqualTypeOf<AstryxTablePersistedState<Order, Columns, true>>(),
    } as const satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;
    void AstryxTableServer(matchingProps);

    const mismatchedProps: AstryxTableServerProps<
      Order,
      Columns,
      typeof positionViewportSource.viewport
    > = {
      ...matchingProps,
      // @ts-expect-error the Props row must exactly match the viewport base row for extensions.
      viewportSource: positionViewportSource,
    };
    void mismatchedProps;

    const anySource = { ...orderViewportSource, viewport: unsafeAnyViewport };
    // @ts-expect-error any erases the authoritative viewport base-row witness.
    void AstryxTableServer({ ...matchingProps, viewportSource: anySource });

    const unknownSource = { ...orderViewportSource, viewport: unsafeUnknownViewport };
    // @ts-expect-error unknown erases the authoritative viewport base-row witness.
    void AstryxTableServer({ ...matchingProps, viewportSource: unknownSource });

    const unwitnessedSource = { ...orderViewportSource, viewport: unsafeUnwitnessedViewport };
    // @ts-expect-error an unwitnessed viewport cannot establish the Server base row.
    void AstryxTableServer({ ...matchingProps, viewportSource: unwitnessedSource });

    const broadSource = { ...orderViewportSource, viewport: unsafeBroadViewport };
    // @ts-expect-error broad dictionaries cannot impersonate the source-owned viewport witness.
    void AstryxTableServer({ ...matchingProps, viewportSource: broadSource });

    type RawOnlyViewport = Omit<typeof orderViewportSource.viewport, "semanticKey"> & {
      readonly semanticKey: (query: {
        readonly select: typeof orderViewportSource.completeRawSelect;
        readonly where: LiveQueryViewportWhere<typeof orderViewportSource.viewport>;
        readonly orderBy: readonly [];
      }) => unknown;
    };
    const rawOnlySource = {
      ...orderViewportSource,
      viewport: null as unknown as RawOnlyViewport,
    };
    // @ts-expect-error Server grouping requires the source-owned grouped-query authority.
    void AstryxTableServer({ ...matchingProps, viewportSource: rawOnlySource });

    type RawQuery = {
      readonly select: typeof orderViewportSource.completeRawSelect;
      readonly where: LiveQueryViewportWhere<typeof orderViewportSource.viewport>;
      readonly orderBy: readonly [];
    };
    type RawOnlyReplaceViewport = Omit<typeof orderViewportSource.viewport, "replace"> & {
      readonly replace: (
        request: Omit<Parameters<typeof orderViewportSource.viewport.replace>[0], "query"> & {
          readonly query: RawQuery;
        },
      ) => ReturnType<typeof orderViewportSource.viewport.replace>;
    };
    const rawOnlyReplaceSource = {
      ...orderViewportSource,
      viewport: null as unknown as RawOnlyReplaceViewport,
    };
    // @ts-expect-error Server grouping requires source-owned grouped replacement authority.
    void AstryxTableServer({ ...matchingProps, viewportSource: rawOnlyReplaceSource });

    const { completeRawSelect: omittedCompleteRawSelect, ...sourceWithoutCompleteRawSelect } =
      orderViewportSource;
    void omittedCompleteRawSelect;
    // @ts-expect-error Server Sources must carry their source-owned complete raw projection.
    void AstryxTableServer({ ...matchingProps, viewportSource: sourceWithoutCompleteRawSelect });

    const { useWholeResult: omittedUseWholeResult, ...sourceWithoutWholeResult } =
      orderViewportSource;
    void omittedUseWholeResult;
    // @ts-expect-error Server Sources must carry their source-owned whole-result facet hook.
    void AstryxTableServer({ ...matchingProps, viewportSource: sourceWithoutWholeResult });

    void orderViewportSource.viewport.replace({
      window: { firstRow: 0, lastRow: 9 },
      query: {
        select: orderViewportSource.completeRawSelect,
        where: [],
        orderBy: [{ field: "symbol", direction: "asc" }],
      },
      sink: {
        setRowCount: () => undefined,
        setRowData: (rows) => {
          expectTypeOf(rows[0]).toEqualTypeOf<Order | undefined>();
        },
      },
    });

    void orderViewportSource.viewport.replace({
      window: { firstRow: 0, lastRow: 9 },
      query: {
        select: ["symbol"],
        where: [],
        orderBy: [{ field: "symbol", direction: "asc" }],
      },
      sink: { setRowCount: () => undefined, setRowData: () => undefined },
    });
    void orderViewportSource.viewport.replace({
      window: { firstRow: 0, lastRow: 9 },
      query: {
        groupBy: ["status"],
        aggregates: { rowCount: { aggFunc: "count" } },
        where: [],
        orderBy: [{ aggregate: "rowCount", direction: "desc" }],
      },
      sink: { setRowCount: () => undefined, setRowData: () => undefined },
    });
    expectTypeOf<
      LiveQueryViewportBaseRow<typeof orderViewportSource.viewport>
    >().toEqualTypeOf<Order>();
  });
});

const persistedPreferences = {
  version: 1,
  tableId: "TABLE_ID_ORDERS",
  filters: [
    {
      columnId: "COL_ID_PRICE",
      type: "greaterThan",
      codecId: "@bruno/table/number",
      codecVersion: 1,
      filter: { $astryxTableValue: "number", version: 1, value: "10" },
    },
  ],
  orderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  groupBy: [],
  groupOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
  columnOrder: ["COL_ID_SYMBOL", "COL_ID_PRICE", "COL_ID_DOUBLE_QUANTITY"],
  columnVisibility: { COL_ID_SYMBOL: true },
  columnWidths: { COL_ID_PRICE: 144 },
  columnPinning: { start: ["COL_ID_SYMBOL"], end: [] },
} as const satisfies AstryxTablePersistedState<Order, Columns>;

const invalidPersistedSelectionWidth = {
  ...persistedPreferences,
  columnWidths: {
    // @ts-expect-error The private Row Selection width is implementation-owned.
    COL_ID_ASTRYX_TABLE_ROW_SELECTION: 40,
  },
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedSelectionWidth;

const invalidPersistedSelectionGroupOrder = {
  ...persistedPreferences,
  groupOrderBy: [
    // @ts-expect-error The private Row Selection identity is never grouped-sortable.
    { columnId: "COL_ID_ASTRYX_TABLE_ROW_SELECTION", direction: "asc" },
  ],
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedSelectionGroupOrder;

expectTypeOf(persistedPreferences.filters[0]!.columnId).toEqualTypeOf<"COL_ID_PRICE">();

const persistedTextSearch = {
  ...persistedPreferences,
  filters: [
    {
      columnId: "COL_ID_SYMBOL",
      type: "contains",
      codecId: "@bruno/table/text",
      codecVersion: 1,
      filter: "AAPL",
    },
  ],
} as const satisfies AstryxTablePersistedState<Order, Columns>;
void persistedTextSearch;

const invalidPersistedTextSearch = {
  ...persistedTextSearch,
  filters: [
    {
      columnId: "COL_ID_SYMBOL",
      type: "contains",
      codecId: "@bruno/table/text",
      codecVersion: 1,
      // @ts-expect-error Persisted Text search operands are raw strings, not codec payloads.
      filter: { value: "AAPL" },
    },
  ],
} as const satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedTextSearch;

const invalidPersistedNumericOperator = {
  ...persistedPreferences,
  filters: [
    // @ts-expect-error Numeric persisted filters reject Text operators.
    {
      columnId: "COL_ID_PRICE",
      type: "contains",
      codecId: "@bruno/table/number",
      codecVersion: 1,
      filter: { value: "10" },
    },
  ],
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedNumericOperator;

const invalidPersistedInOperand = {
  ...persistedPreferences,
  filters: [
    {
      columnId: "COL_ID_PRICE",
      type: "in",
      codecId: "@bruno/table/number",
      codecVersion: 1,
      // @ts-expect-error Persisted in operands are a non-empty JSON tuple.
      filter: { value: "10" },
    },
  ],
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedInOperand;

const invalidPersistedCompound = {
  ...persistedPreferences,
  filters: [
    {
      type: "AND",
      // @ts-expect-error Persisted compound leaves retain one Column Identity.
      conditions: [
        {
          columnId: "COL_ID_PRICE",
          type: "equals",
          codecId: "@bruno/table/number",
          codecVersion: 1,
          filter: { value: "10" },
        },
        {
          columnId: "COL_ID_SYMBOL",
          type: "equals",
          codecId: "@bruno/table/text",
          codecVersion: 1,
          filter: { value: "Ada" },
        },
      ],
    },
  ],
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedCompound;

const invalidPersistedSetCapability = {
  ...persistedPreferences,
  filters: [
    // @ts-expect-error Match None requires an enabled Set Filter capability.
    { columnId: "COL_ID_PRICE", type: "matchNone" },
  ],
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedSetCapability;

const invalidPersistedSensitivity = {
  ...persistedPreferences,
  filters: [
    {
      columnId: "COL_ID_PRICE",
      type: "equals",
      codecId: "@bruno/table/number",
      codecVersion: 1,
      filter: { value: "10" },
      // @ts-expect-error Numeric persisted filters reject Text sensitivity flags.
      caseSensitive: true,
    },
  ],
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedSensitivity;

const invalidPersistedColumn = {
  ...persistedPreferences,
  // @ts-expect-error Persisted layout identities autocomplete from the exact columns tuple.
  columnOrder: ["COL_ID_UNKNOWN"],
} satisfies AstryxTablePersistedState<Order, Columns>;
void invalidPersistedColumn;

const persistedClientProps = {
  tableId: "TABLE_ID_PERSISTED_PROPS",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  clientSource: { rows: [], totalRows: 0, version: 1, status: "ready" as const },
  initialPersistedState: persistedPreferences,
  onPersistChange: (state) =>
    expectTypeOf(state).toEqualTypeOf<AstryxTablePersistedState<Order, Columns, true>>(),
} satisfies AstryxTableClientProps<Order, Columns>;
void persistedClientProps;

const nonGroupingPersistedPreferences = {
  ...persistedPreferences,
  groupOrderBy: [],
} as const satisfies AstryxTablePersistedState<Order, Columns, false>;
void nonGroupingPersistedPreferences;
const invalidNonGroupingPersistedGroupBy = {
  ...nonGroupingPersistedPreferences,
  // @ts-expect-error Non-grouping persistence rejects active Group By intent.
  groupBy: ["COL_ID_SYMBOL"],
} satisfies AstryxTablePersistedState<Order, Columns, false>;
void invalidNonGroupingPersistedGroupBy;
const invalidNonGroupingPersistedRowsWidth = {
  ...nonGroupingPersistedPreferences,
  columnWidths: {
    // @ts-expect-error Non-grouping persistence rejects the dormant Rows width.
    COL_ID_ASTRYX_TABLE_ROWS: 144,
  },
} satisfies AstryxTablePersistedState<Order, Columns, false>;
void invalidNonGroupingPersistedRowsWidth;
const invalidGroupingPersistedPreferences = {
  ...persistedPreferences,
  // @ts-expect-error Grouping-capable Client persistence always retains one grouped sort.
  groupOrderBy: [],
} as const satisfies AstryxTablePersistedState<Order, Columns, true>;
void invalidGroupingPersistedPreferences;

const directViewServerResult = null as unknown as LiveQueryResult<Order>;
const directClientSource: AstryxTableClientSource<Order> = directViewServerResult;
const directViewServerClient = AstryxTableClient({
  tableId: "view-server-orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});
void directClientSource;
void directViewServerClient;

const rawGroupedColumns = [
  AstryxTableTextColumn({
    columnId: "COL_ID_GROUP_SYMBOL",
    field: "symbol",
    headerName: "Symbol group",
    groupBy: true,
    groupKeyValueFormatter: ({ columnId, field, value }) => {
      expectTypeOf(columnId).toEqualTypeOf<"COL_ID_GROUP_SYMBOL">();
      expectTypeOf(field).toEqualTypeOf<"symbol">();
      expectTypeOf(value).toEqualTypeOf<string>();
      return value;
    },
  }),
  AstryxTableNumberColumn({
    columnId: "COL_ID_MAX_PRICE",
    field: "price",
    headerName: "Maximum price",
    aggFunc: "max",
    aggregateValueFormatter: ({ columnId, field, value }) => {
      expectTypeOf(columnId).toEqualTypeOf<"COL_ID_MAX_PRICE">();
      expectTypeOf(field).toEqualTypeOf<"price">();
      expectTypeOf(value).toEqualTypeOf<number>();
      return value.toFixed(2);
    },
  }),
  {
    columnId: "COL_ID_RAW_STATUS",
    field: "status",
    headerName: "Raw status",
    valueType: "text",
  },
] satisfies AstryxTableColumns<Order>;
void rawGroupedColumns;

type HostileSymbolGroupParams = AstryxTableGroupKeyCellParams<
  string,
  "COL_ID_HOSTILE_SYMBOL",
  "symbol"
> & {
  readonly groupKeys: readonly [{ readonly columnId: "COL_ID_GROUP_SYMBOL" }];
};
const hostileSymbolGroupFormatter = (_parameters: HostileSymbolGroupParams) => "hostile";
const hostileHelperGroupedOptions = {
  columnId: "COL_ID_HOSTILE_SYMBOL",
  field: "symbol",
  headerName: "Hostile symbol",
  groupBy: true,
  groupKeyValueFormatter: hostileSymbolGroupFormatter,
} as const;
// @ts-expect-error Column-level helper callbacks cannot require sibling Group Key evidence.
const hostileHelperGroupedColumn = AstryxTableTextColumn(hostileHelperGroupedOptions);
void hostileHelperGroupedColumn;

const spreadHelperGroupedSource = [
  AstryxTableTextColumn({
    columnId: "COL_ID_GROUP_SYMBOL",
    field: "symbol",
    headerName: "Group symbol",
    groupBy: true,
    groupKeyValueFormatter: ({ value }) => value,
    valueFormatter: ({ row, value }) => `${row.hiddenLabel}:${value}`,
  }),
] satisfies AstryxTableColumns<Order>;
const validSpreadHelperGroupedColumns = [
  { ...spreadHelperGroupedSource[0]! },
] satisfies AstryxTableColumns<Order>;
void validSpreadHelperGroupedColumns;
type IncompatibleHelperRow = Readonly<{ readonly unrelated: string }>;
const crossRowHelperColumns = [spreadHelperGroupedSource[0]!];
// @ts-expect-error A helper column remains tied to the row type inferred by that helper call.
const invalidCrossRowHelperColumns: AstryxTableColumns<IncompatibleHelperRow> =
  crossRowHelperColumns;
void invalidCrossRowHelperColumns;
type IncompatibleHelperValueRow = Readonly<{ readonly symbol: number }>;
// @ts-expect-error A same-name field with a different value domain is not helper-compatible.
const invalidCrossValueHelperColumns: AstryxTableColumns<IncompatibleHelperValueRow> =
  crossRowHelperColumns;
void invalidCrossValueHelperColumns;
type IncompatibleHelperSiblingRow = Readonly<{ readonly symbol: string }>;
// @ts-expect-error Helper raw callbacks remain tied to sibling evidence from the inferred row.
const invalidCrossSiblingHelperColumns: AstryxTableColumns<IncompatibleHelperSiblingRow> =
  crossRowHelperColumns;
void invalidCrossSiblingHelperColumns;
type IncompatibleHelperWidenedRow = Omit<Order, "symbol"> &
  Readonly<{ readonly symbol: string | number }>;
// @ts-expect-error Helper provenance is invariant in the complete inferred row value domain.
const invalidWidenedHelperColumns: AstryxTableColumns<IncompatibleHelperWidenedRow> =
  crossRowHelperColumns;
void invalidWidenedHelperColumns;
const computedHelperForOrder = AstryxTableTextColumn({
  columnId: "COL_ID_COMPUTED_HELPER_SYMBOL",
  fields: ["symbol"] as const,
  headerName: "Computed symbol",
  valueGetter: ({ row }: { readonly row: Pick<Order, "symbol"> }) => row.symbol,
});
const invalidComputedHelperDependencies: AstryxTableColumns<IncompatibleHelperValueRow> = [
  // @ts-expect-error Computed helper dependencies retain their exact source value domains.
  computedHelperForOrder,
];
void invalidComputedHelperDependencies;
const replacedSpreadHelperGroupedColumns = [
  {
    ...spreadHelperGroupedSource[0]!,
    groupKeyValueFormatter: ({
      columnId,
      value,
    }: AstryxTableGroupKeyCellParams<string, "COL_ID_GROUP_SYMBOL", "symbol">) => {
      expectTypeOf(columnId).toEqualTypeOf<"COL_ID_GROUP_SYMBOL">();
      expectTypeOf(value).toEqualTypeOf<string>();
      return value;
    },
  },
] satisfies AstryxTableColumns<Order>;
void replacedSpreadHelperGroupedColumns;

const hostileSpreadHelperGroupedColumns = [
  {
    ...spreadHelperGroupedSource[0]!,
    groupKeyValueFormatter: hostileSymbolGroupFormatter,
  },
];
// TypeScript preserves the helper's column-level provenance through object spread, but cannot
// re-contextualize a separately declared replacement callback against its sibling properties.
const unsupportedHostileSpreadHelperColumns: AstryxTableColumns<Order> =
  hostileSpreadHelperGroupedColumns;
void unsupportedHostileSpreadHelperColumns;

const changedIdentitySpreadHelperGroupedColumns = [
  {
    ...spreadHelperGroupedSource[0]!,
    columnId: "COL_ID_CHANGED_HELPER_SYMBOL",
    groupKeyValueFormatter: ({ value }: { readonly value: string }) => value,
  } as const,
] as const satisfies AstryxTableColumns<Order>;
void changedIdentitySpreadHelperGroupedColumns;

const changedDomainSpreadHelperGroupedColumns = [
  {
    ...spreadHelperGroupedSource[0]!,
    field: "status",
    valueType: "text",
    groupKeyValueFormatter: ({ value }: { readonly value: string }) => value,
  } as const,
] as const satisfies AstryxTableColumns<Order>;
void changedDomainSpreadHelperGroupedColumns;

const unsupportedInlineGroupFormatter = (
  parameters: AstryxTableGroupKeyCellParams<string, "COL_ID_INLINE_GROUP", "symbol">,
) => parameters.value;
const rawInlineGroupedPresentation = [
  {
    columnId: "COL_ID_INLINE_GROUP",
    field: "symbol",
    headerName: "Inline group",
    valueType: "text",
    groupBy: true,
    groupKeyValueFormatter: unsupportedInlineGroupFormatter,
  },
] as const;
// @ts-expect-error Exact grouped callbacks cross a global Column Helper, not a raw inline definition.
const invalidRawInlineGroupedPresentation: AstryxTableColumns<Order> = rawInlineGroupedPresentation;
void invalidRawInlineGroupedPresentation;

const honestRawInlineGroupedPresentation = [
  {
    columnId: "COL_ID_INLINE_BROAD_GROUP",
    field: "symbol",
    headerName: "Inline broad group",
    valueType: "text",
    groupBy: true,
    groupKeyValueFormatter: ({ columnId, value }) => {
      expectTypeOf(columnId).toEqualTypeOf<AstryxTableColumnId>();
      expectTypeOf(value).toEqualTypeOf<string>();
      // @ts-expect-error A raw inline callback cannot claim its sibling Column Identity literal.
      const exactColumnId: "COL_ID_INLINE_BROAD_GROUP" = columnId;
      void exactColumnId;
      return value;
    },
  },
] satisfies AstryxTableColumns<Order>;
void honestRawInlineGroupedPresentation;
const groupRowsColumn = {
  headerName: "Orders",
  width: 112,
  valueFormatter: ({ columnId, value, groupKeys }) => {
    expectTypeOf(columnId).toEqualTypeOf<"COL_ID_ASTRYX_TABLE_ROWS">();
    expectTypeOf(value).toEqualTypeOf<bigint>();
    expectTypeOf<(typeof groupKeys)[number]>().toMatchTypeOf<{
      readonly columnId: "COL_ID_GROUP_SYMBOL";
      readonly field: "symbol";
      readonly _tag: "Missing" | "Present";
    }>();
    return value.toString();
  },
} satisfies AstryxTableGroupRowsColumnOptions<Order, typeof rawGroupedColumns>;

const groupedClientProps = {
  tableId: "TABLE_ID_GROUPED_CLIENT",
  columns: rawGroupedColumns,
  initialOrderBy: [{ columnId: "COL_ID_GROUP_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  clientSource: { rows: [], totalRows: 0, version: 1, status: "ready" as const },
  groupRowsColumn,
} satisfies AstryxTableClientProps<Order, typeof rawGroupedColumns>;
void groupedClientProps;

const serverWithGroupingConfiguration = {
  tableId: "TABLE_ID_SERVER_GROUPING",
  columns: rawGroupedColumns,
  initialOrderBy: [{ columnId: "COL_ID_GROUP_SYMBOL", direction: "asc" }],
  viewportSource: orderViewportSource,
  groupRowsColumn,
} as const;
const validServerGroupingConfiguration: AstryxTableServerProps<
  Order,
  typeof rawGroupedColumns,
  typeof orderViewportSource.viewport
> = serverWithGroupingConfiguration;
void validServerGroupingConfiguration;
const clientOnlyNumberArithmetic = exactMoneyValueType as unknown as AstryxTableValueType<
  number,
  "numeric",
  "bigdecimal",
  { readonly sum: "self" }
>;
const spoofedBigDecimalCodec = {
  ...clientOnlyNumberArithmetic,
  codecId: "@bruno/table/effect/bigdecimal" as const,
  aggregateResults: { sum: "self" as const },
};
const spoofedBigDecimalServerAggregateColumns = [
  {
    columnId: "COL_ID_SPOOFED_GROUP",
    field: "symbol",
    headerName: "Group",
    valueType: "text",
    groupBy: true,
  },
  {
    columnId: "COL_ID_SPOOFED_SUM",
    field: "price",
    headerName: "Spoofed sum",
    valueType: spoofedBigDecimalCodec,
    aggFunc: "sum",
  },
] as const satisfies AstryxTableColumns<Order>;
const rejectedSpoofedBigDecimalServerProps: AstryxTableServerProps<
  Order,
  typeof spoofedBigDecimalServerAggregateColumns,
  typeof orderViewportSource.viewport
> = {
  tableId: "TABLE_ID_SPOOFED_SERVER_ARITHMETIC",
  // @ts-expect-error A public codecId literal is not Effect BigDecimal Server authority.
  columns: spoofedBigDecimalServerAggregateColumns,
  initialOrderBy: [{ columnId: "COL_ID_SPOOFED_GROUP", direction: "asc" }],
  viewportSource: orderViewportSource,
};
void rejectedSpoofedBigDecimalServerProps;
const clientOnlyServerAggregateColumns = [
  {
    columnId: "COL_ID_CLIENT_ONLY_GROUP",
    field: "symbol",
    headerName: "Group",
    valueType: "text",
    groupBy: true,
  },
  {
    columnId: "COL_ID_CLIENT_ONLY_PRICE_SUM",
    field: "price",
    headerName: "Client-only price sum",
    valueType: clientOnlyNumberArithmetic,
    aggFunc: "sum",
  },
] as const satisfies AstryxTableColumns<Order>;
const invalidClientArithmeticServerProps = {
  tableId: "TABLE_ID_INVALID_SERVER_ARITHMETIC",
  columns: clientOnlyServerAggregateColumns,
  initialOrderBy: [{ columnId: "COL_ID_CLIENT_ONLY_GROUP", direction: "asc" }],
  viewportSource: orderViewportSource,
} as const;
// @ts-expect-error Server arithmetic must use effect-view-server's exact result Value Types.
const rejectedClientArithmeticServerProps: AstryxTableServerProps<
  Order,
  typeof clientOnlyServerAggregateColumns,
  typeof orderViewportSource.viewport
> = invalidClientArithmeticServerProps;
void rejectedClientArithmeticServerProps;
const widenedClientOnlyServerAggregateColumns: readonly (typeof clientOnlyServerAggregateColumns)[number][] =
  clientOnlyServerAggregateColumns;
const widenedClientOnlyServerProps = {
  ...invalidClientArithmeticServerProps,
  columns: widenedClientOnlyServerAggregateColumns,
} as const;
// @ts-expect-error Widening an unsupported arithmetic column must not bypass Server admission.
const rejectedWidenedClientArithmeticServerProps: AstryxTableServerProps<
  Order,
  typeof widenedClientOnlyServerAggregateColumns,
  typeof orderViewportSource.viewport
> = widenedClientOnlyServerProps;
void rejectedWidenedClientArithmeticServerProps;
const groupedPersistedPreferences = {
  version: 1,
  tableId: "TABLE_ID_GROUPED_PREFERENCES",
  filters: [],
  orderBy: [{ columnId: "COL_ID_GROUP_SYMBOL", direction: "asc" }],
  groupBy: ["COL_ID_GROUP_SYMBOL"],
  groupOrderBy: [
    { columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "desc" },
    { columnId: "COL_ID_MAX_PRICE", direction: "asc" },
  ],
  columnOrder: ["COL_ID_GROUP_SYMBOL", "COL_ID_MAX_PRICE"],
  columnVisibility: {},
  columnWidths: { COL_ID_ASTRYX_TABLE_ROWS: 144 },
  columnPinning: { start: [], end: [] },
} as const satisfies AstryxTablePersistedState<Order, typeof rawGroupedColumns>;
void groupedPersistedPreferences;
const invalidGroupedPersistedPreferences = {
  ...groupedPersistedPreferences,
  // @ts-expect-error Group By intent rejects columns without groupBy: true.
  groupBy: ["COL_ID_MAX_PRICE"],
} satisfies AstryxTablePersistedState<Order, typeof rawGroupedColumns>;
void invalidGroupedPersistedPreferences;

type OnlySymbolGroupEvidence = readonly [
  {
    readonly columnId: "COL_ID_GROUP_SYMBOL";
    readonly field: "symbol";
    readonly groupBy: true;
  },
];

type UnsafelyNarrowGroupedCallbackParams = AstryxTableGroupKeyCellParams<
  string,
  "COL_ID_GROUP_SYMBOL"
> & { readonly groupKeys: OnlySymbolGroupEvidence };

const unsafelyNarrowGroupedCallback = (_params: UnsafelyNarrowGroupedCallbackParams) => "symbol";

const rawColumnWithUnsafelyNarrowGroupedCallback = [
  {
    columnId: "COL_ID_GROUP_SYMBOL",
    field: "symbol",
    headerName: "Unsafe raw symbol group",
    valueType: "text",
    groupBy: true,
    groupKeyValueFormatter: unsafelyNarrowGroupedCallback,
  },
] as const;

// @ts-expect-error Raw columns cannot require sibling Group Key evidence.
const invalidRawNarrowGroupedCallback: AstryxTableColumns<Order> =
  rawColumnWithUnsafelyNarrowGroupedCallback;
void invalidRawNarrowGroupedCallback;

AstryxTableTextColumn({
  columnId: "COL_ID_UNSAFE_GROUP_SYMBOL",
  // @ts-expect-error Narrow sibling evidence makes the grouped callback overload invalid.
  field: "symbol",
  headerName: "Unsafe symbol group",
  groupBy: true,
  groupKeyValueFormatter: unsafelyNarrowGroupedCallback,
});

const capabilityColumns = [
  {
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
    enableSorting: false,
  },
  {
    columnId: "COL_ID_PRICE",
    field: "price",
    headerName: "Price",
    valueType: "number",
    enableFilter: false,
  },
] satisfies AstryxTableColumns<Order>;

type CapabilityColumns = typeof capabilityColumns;

void AstryxTableClient({
  tableId: "invalid-unknown-sort",
  columns,
  initialOrderBy: [
    // @ts-expect-error Client component preserves exact Column Identity inference.
    { columnId: "COL_ID_UNKNOWN", direction: "asc" },
  ],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});
void AstryxTableClient({
  tableId: "invalid-misspelled-sort",
  columns,
  initialOrderBy: [
    // @ts-expect-error Client component rejects misspelled Column Identities.
    { columnId: "COL_ID_SYMBOOL", direction: "asc" },
  ],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});
void AstryxTableClient({
  tableId: "invalid-sort-direction",
  columns,
  initialOrderBy: [
    {
      columnId: "COL_ID_SYMBOL",
      // @ts-expect-error Client component admits only asc and desc directions.
      direction: "ascending",
    },
  ],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});
void AstryxTableClient({
  tableId: "invalid-computed-sort",
  columns,
  initialOrderBy: [
    // @ts-expect-error Computed columns have no automatic Client sort mapping.
    { columnId: "COL_ID_DOUBLE_QUANTITY", direction: "asc" },
  ],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});
void AstryxTableClient({
  tableId: "invalid-nonsortable-sort",
  columns: capabilityColumns,
  initialOrderBy: [
    // @ts-expect-error Client component excludes explicitly nonsortable identities.
    { columnId: "COL_ID_SYMBOL", direction: "asc" },
  ],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});

const sortingTypeTestViewportSource = orderViewportSource;

const invalidServerUnknownSort = {
  tableId: "invalid-server-unknown-sort",
  columns,
  initialOrderBy: [
    // @ts-expect-error Server props preserve exact Column Identity inference.
    { columnId: "COL_ID_UNKNOWN", direction: "asc" },
  ],
  viewportSource: sortingTypeTestViewportSource,
} satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;
void invalidServerUnknownSort;

const invalidServerMisspelledSort = {
  tableId: "invalid-server-misspelled-sort",
  columns,
  initialOrderBy: [
    // @ts-expect-error Server props reject misspelled Column Identities.
    { columnId: "COL_ID_SYMBOOL", direction: "asc" },
  ],
  viewportSource: sortingTypeTestViewportSource,
} satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;
void invalidServerMisspelledSort;

const invalidServerComputedSort = {
  tableId: "invalid-server-computed-sort",
  columns,
  initialOrderBy: [
    // @ts-expect-error Computed columns have no automatic Server sort mapping.
    { columnId: "COL_ID_DOUBLE_QUANTITY", direction: "asc" },
  ],
  viewportSource: sortingTypeTestViewportSource,
} satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;
void invalidServerComputedSort;

const invalidServerNonsortableSort = {
  tableId: "invalid-server-nonsortable-sort",
  columns: capabilityColumns,
  initialOrderBy: [
    // @ts-expect-error Server props exclude explicitly nonsortable identities.
    { columnId: "COL_ID_SYMBOL", direction: "asc" },
  ],
  viewportSource: sortingTypeTestViewportSource,
} satisfies AstryxTableServerProps<Order, CapabilityColumns, typeof orderViewportSource.viewport>;
void invalidServerNonsortableSort;

const noSortingColumns = [
  {
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
    enableSorting: false,
  },
] satisfies AstryxTableColumns<Order>;

type NoSortingColumns = typeof noSortingColumns;

const validColumnId: AstryxTableColumnId = "COL_ID_PRICE";
void validColumnId;

const validUnicodeColumnId: AstryxTableColumnId = "COL_ID_AÉTAT";
void validUnicodeColumnId;

expectTypeOf<AstryxTableColumnId<"COL_ID_A B">>().toEqualTypeOf<never>();
expectTypeOf<AstryxTableColumnId<"COL_ID_A\tB">>().toEqualTypeOf<never>();
expectTypeOf<AstryxTableColumnId<"COL_ID_A\u3000B">>().toEqualTypeOf<never>();
expectTypeOf<AstryxTableColumnId<"COL_ID_ASTRYX_TABLE_ROWS">>().toEqualTypeOf<never>();
expectTypeOf<AstryxTableColumnId<"COL_ID_ASTRYX_TABLE_ROW_SELECTION">>().toEqualTypeOf<never>();

const rawWhitespaceIdentityColumns = [
  {
    columnId: "COL_ID_UNIT PRICE",
    field: "price",
    headerName: "Unit price",
    valueType: "number",
  },
] satisfies AstryxTableColumns<Order>;
void AstryxTableClient({
  tableId: "invalid-raw-whitespace-identity",
  // @ts-expect-error Raw Column Identity literals are validated after tuple inference.
  columns: rawWhitespaceIdentityColumns,
  initialOrderBy: [{ columnId: "COL_ID_UNIT PRICE", direction: "asc" }],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});

const invalidWhitespaceHelperOptions = {
  columnId: "COL_ID_UNIT PRICE",
  field: "price",
  headerName: "Unit price",
} as const;
const invalidWhitespaceHelperColumn = [
  // @ts-expect-error Column Helper inputs reject whitespace in literal identities.
  AstryxTableNumberColumn(invalidWhitespaceHelperOptions),
] satisfies AstryxTableColumns<Order>;
void invalidWhitespaceHelperColumn;

const invalidWhitespaceComputedOptions = {
  columnId: "COL_ID_UNIT\u3000PRICE",
  fields: ["price"],
  headerName: "Unit price",
  valueType: "number",
  valueGetter: ({ row }: { readonly row: Pick<Order, "price"> }) => row.price,
} as const;
const invalidWhitespaceComputedColumn = [
  // @ts-expect-error Computed Column inputs reject Unicode whitespace in literal identities.
  AstryxTableComputedColumn(invalidWhitespaceComputedOptions),
] satisfies AstryxTableColumns<Order>;
void invalidWhitespaceComputedColumn;

const rawReservedIdentityColumns = [
  {
    columnId: "COL_ID_ASTRYX_TABLE_ROWS",
    field: "price",
    headerName: "Rows",
    valueType: "number",
  },
] as const satisfies AstryxTableColumns<Order>;
void AstryxTableClient({
  tableId: "invalid-raw-reserved-identity",
  // @ts-expect-error Consumers cannot claim the Rows System Column identity.
  columns: rawReservedIdentityColumns,
  initialOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROWS", direction: "asc" }],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});

const rawSelectionReservedIdentityColumns = [
  {
    columnId: "COL_ID_ASTRYX_TABLE_ROW_SELECTION",
    field: "price",
    headerName: "Selection",
    valueType: "number",
  },
] as const satisfies AstryxTableColumns<Order>;
void AstryxTableClient({
  tableId: "invalid-raw-selection-reserved-identity",
  // @ts-expect-error Consumers cannot claim the private Row Selection identity.
  columns: rawSelectionReservedIdentityColumns,
  initialOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROW_SELECTION", direction: "asc" }],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});
void AstryxTableClient({
  tableId: "invalid-selection-reserved-initial-order",
  columns,
  // @ts-expect-error The private Row Selection identity is never sortable.
  initialOrderBy: [{ columnId: "COL_ID_ASTRYX_TABLE_ROW_SELECTION", direction: "asc" }],
  getRowId: (row) => row.id,
  clientSource: directViewServerResult,
});

const invalidReservedHelperOptions = {
  columnId: "COL_ID_ASTRYX_TABLE_ROWS",
  field: "price",
  headerName: "Rows",
} as const;
const invalidReservedHelperColumn = [
  // @ts-expect-error Column Helper inputs reject the reserved Rows identity.
  AstryxTableNumberColumn(invalidReservedHelperOptions),
] satisfies AstryxTableColumns<Order>;
void invalidReservedHelperColumn;

const invalidSelectionReservedHelperOptions = {
  columnId: "COL_ID_ASTRYX_TABLE_ROW_SELECTION",
  field: "price",
  headerName: "Selection",
} as const;
const invalidSelectionReservedHelperColumn = [
  // @ts-expect-error Column Helper inputs reject the private Row Selection identity.
  AstryxTableNumberColumn(invalidSelectionReservedHelperOptions),
] satisfies AstryxTableColumns<Order>;
void invalidSelectionReservedHelperColumn;

// @ts-expect-error A stable column identity must have a non-empty suffix.
const emptyColumnId: AstryxTableColumnId = "COL_ID_";
void emptyColumnId;

// @ts-expect-error The suffix must begin with an ASCII uppercase letter, digit, or underscore.
const invalidUnicodeStartColumnId: AstryxTableColumnId = "COL_ID_ÉTAT";
void invalidUnicodeStartColumnId;

// @ts-expect-error Every character after the prefix must already be uppercase.
const invalidMixedCaseColumnId: AstryxTableColumnId = "COL_ID_Price";
void invalidMixedCaseColumnId;

describe("AstryxTable public types", () => {
  it("infers the strict live Client component surface without exposing a table object", () => {
    expectTypeOf<
      "AstryxTableSelectedRowCount" extends keyof typeof AstryxTablePublic ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "AstryxTableDirtyCellCount" extends keyof typeof AstryxTablePublic ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "AstryxTableValidationCount" extends keyof typeof AstryxTablePublic ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "AstryxTableConflictCount" extends keyof typeof AstryxTablePublic ? true : false
    >().toEqualTypeOf<false>();
    const props = {
      tableId: "orders",
      columns,
      initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
      getRowId: (row: Order) => row.id,
      clientSource: {
        rows: [] as readonly Order[],
        totalRows: 0,
        version: 1,
        status: "ready",
      },
    } satisfies AstryxTableClientProps<Order, Columns>;
    const callableProps: Parameters<typeof AstryxTableClient<Order, Columns>>[0] = props;
    const namedProps: AstryxTableClientProps<Order, Columns> = callableProps;
    const rendered = AstryxTableClient(namedProps);

    expectTypeOf(rendered).toEqualTypeOf<ReactNode>();
    expectTypeOf(callableProps).toMatchTypeOf<AstryxTableClientProps<Order, Columns>>();
    expectTypeOf(AstryxTableToolbar({ children: "Filters" })).toEqualTypeOf<ReactNode>();
    expectTypeOf(AstryxTableQuickFilter).toExtend<() => ReactNode>();
    expectTypeOf(AstryxTableQuickFilter).toEqualTypeOf<() => ReactElement | null>();
    expectTypeOf(AstryxTableResultRowCount({})).toEqualTypeOf<ReactNode>();
    expectTypeOf(AstryxTableLoadedRowCount({})).toEqualTypeOf<ReactNode>();
    expectTypeOf(AstryxTableActiveFilterCount({})).toEqualTypeOf<ReactNode>();
    expectTypeOf(AstryxTableActiveSortCount({})).toEqualTypeOf<ReactNode>();

    void AstryxTableFilterControl<Order, Columns>({
      ownership: "grid",
      children: (commands) => {
        expectTypeOf(commands.clearAll).toEqualTypeOf<() => boolean>();
        expectTypeOf(commands.clear)
          .parameter(0)
          .toEqualTypeOf<AstryxTableFilterableColumnId<Columns>>();
        expectTypeOf(commands.reset)
          .parameter(0)
          .toEqualTypeOf<AstryxTableFilterableColumnId<Columns>>();
        expectTypeOf(commands.reset).returns.toEqualTypeOf<boolean>();
        expectTypeOf(commands.replace)
          .parameter(0)
          .toEqualTypeOf<AstryxTableFilterExpression<Order, Columns>>();
        return null;
      },
    });
    void AstryxTableFilterControl({
      ownership: "external",
      children: "Application-owned filter",
    });

    const validQuickFilterFields = [
      "symbol",
      "status",
      "hiddenLabel",
    ] as const satisfies AstryxTableQuickFilterFields<Order>;
    expectTypeOf(validQuickFilterFields).toEqualTypeOf<
      readonly ["symbol", "status", "hiddenLabel"]
    >();
    expectTypeOf<AstryxTableQuickFilterField<Order>>().toEqualTypeOf<
      "id" | "symbol" | "status" | "hiddenLabel"
    >();
    void AstryxTableClient({
      ...props,
      quickFilterFields: validQuickFilterFields,
    });
    void AstryxTableClient({
      ...props,
      // @ts-expect-error External Filters are Server-only application state.
      externalFilters: [],
    });
    void AstryxTableClient({
      ...props,
      // @ts-expect-error Quick Filter fields must be a non-empty tuple.
      quickFilterFields: [],
    });
    void AstryxTableClient({
      ...props,
      // @ts-expect-error Numeric row fields are not Quick Filter fields.
      quickFilterFields: ["price"],
    });
    void AstryxTableClient({
      ...props,
      // @ts-expect-error Misspelled source fields are rejected.
      quickFilterFields: ["descrption"],
    });
    void AstryxTableClient({
      ...props,
      // @ts-expect-error Column Identities are not source fields.
      quickFilterFields: ["COL_ID_SYMBOL"],
    });

    const missingTableId = {
      columns,
      initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
      getRowId: (row: Order) => row.id,
      clientSource: {
        rows: [] as readonly Order[],
        totalRows: 0,
        version: 1,
        status: "ready",
      },
    };
    // @ts-expect-error tableId is mandatory for every public Client Table.
    const invalidMissingTableId: AstryxTableClientProps<Order, Columns> = missingTableId;
    void invalidMissingTableId;

    const missingRowIdentity = {
      tableId: "orders",
      columns,
      initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }] as const,
      clientSource: {
        rows: [] as readonly Order[],
        totalRows: 0,
        version: 1,
        status: "ready",
      },
    };
    // @ts-expect-error Client identity is mandatory and cannot be replaced by a row index.
    const invalidMissingRowIdentity: AstryxTableClientProps<Order, Columns> = missingRowIdentity;
    void invalidMissingRowIdentity;

    // @ts-expect-error the first Client renderer requires a non-empty typed order baseline.
    void AstryxTableClient({
      tableId: "orders",
      columns,
      getRowId: (row: Order) => row.id,
      clientSource: {
        rows: [] as readonly Order[],
        totalRows: 0,
        version: 1,
        status: "ready",
      },
    });

    void AstryxTableClient({
      ...props,
      // @ts-expect-error AstryxTable owns the table runtime and exposes no controller prop.
      table: {},
    });
    void AstryxTableClient({
      ...props,
      // @ts-expect-error AstryxTable exposes no row-model option.
      rowModel: {},
    });
  });

  it("preserves exact identities and values", () => {
    expectTypeOf<"COL_ID_Price" extends AstryxTableColumnId ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<AstryxTableColumnIdOf<Columns>>().toEqualTypeOf<
      "COL_ID_SYMBOL" | "COL_ID_PRICE" | "COL_ID_DOUBLE_QUANTITY"
    >();
    expectTypeOf<AstryxTableColumnValue<Order, Columns, "COL_ID_SYMBOL">>().toEqualTypeOf<string>();
    expectTypeOf<AstryxTableColumnValue<Order, Columns, "COL_ID_PRICE">>().toEqualTypeOf<number>();
    expectTypeOf<
      AstryxTableColumnValue<Order, Columns, "COL_ID_DOUBLE_QUANTITY">
    >().toEqualTypeOf<bigint>();
  });

  it("derives capabilities instead of guessing computed server semantics", () => {
    expectTypeOf<AstryxTableFilterableColumnId<Columns>>().toEqualTypeOf<
      "COL_ID_SYMBOL" | "COL_ID_PRICE"
    >();
    expectTypeOf<AstryxTableSortableColumnId<Columns>>().toEqualTypeOf<
      "COL_ID_SYMBOL" | "COL_ID_PRICE"
    >();
    expectTypeOf<AstryxTableEditableColumnId<Columns>>().toEqualTypeOf<
      "COL_ID_SYMBOL" | "COL_ID_PRICE"
    >();
    expectTypeOf<
      AstryxTableFilterableColumnId<CapabilityColumns>
    >().toEqualTypeOf<"COL_ID_SYMBOL">();
    expectTypeOf<AstryxTableSortableColumnId<CapabilityColumns>>().toEqualTypeOf<"COL_ID_PRICE">();
    expectTypeOf<AstryxTableSortableColumnId<NoSortingColumns>>().toBeNever();
  });

  it("rejects a Client renderer when no column can supply its required order", () => {
    const props = {
      tableId: "unsortable-orders",
      columns: noSortingColumns,
      getRowId: (row: Order) => row.id,
      clientSource: {
        rows: [] as readonly Order[],
        totalRows: 0,
        version: 1,
        status: "ready",
      },
    } as const;

    // @ts-expect-error AstryxTableClient always requires a typed non-empty Initial Order By.
    const invalidProps: AstryxTableClientProps<Order, NoSortingColumns> = props;

    expectTypeOf(invalidProps).toEqualTypeOf<AstryxTableClientProps<Order, NoSortingColumns>>();
  });

  it("keeps widened runtime columns conservatively editable", () => {
    const widenedColumns: AstryxTableColumns<Order> = columns;

    expectTypeOf<
      AstryxTableEditableColumnId<typeof widenedColumns>
    >().toEqualTypeOf<AstryxTableColumnId>();

    const widenedEditableCapability = {
      editable: true,
      getRowVersion: (row: Order) => row.revision,
      onSaveEdits: (changes) => {
        expectTypeOf(changes[0].changes[0]).not.toBeNever();
        return Promise.resolve();
      },
    } satisfies AstryxTableEditingCapability<Order, typeof widenedColumns, bigint>;

    expectTypeOf(widenedEditableCapability.getRowVersion).returns.toEqualTypeOf<bigint>();
  });

  it("types the edit-row projector from exact potentially editable fields", () => {
    expectTypeOf<AstryxTableEditRowPatch<Order, typeof rowAwareEditableColumns>>().toEqualTypeOf<
      Readonly<Partial<Pick<Order, "symbol" | "price" | "quantity">>>
    >();

    const input: AstryxTableEditRowProjectorInput<Order, typeof rowAwareEditableColumns, bigint> = {
      row: {} as Order,
      patch: { symbol: "AMD", price: 128, quantity: 4n },
      rowVersion: 1n,
    };
    const projector: AstryxTableEditRowProjector<Order, typeof rowAwareEditableColumns, bigint> = ({
      row,
      patch,
    }) => ({ ...row, ...patch });

    expectTypeOf(input.row).toEqualTypeOf<Order>();
    expectTypeOf(input.patch).toEqualTypeOf<
      AstryxTableEditRowPatch<Order, typeof rowAwareEditableColumns>
    >();
    expectTypeOf(input.rowVersion).toEqualTypeOf<bigint>();
    expectTypeOf(projector).returns.toEqualTypeOf<Order>();

    const invalidPatch: AstryxTableEditRowPatch<Order, typeof rowAwareEditableColumns> = {
      // @ts-expect-error Non-editable fields are not part of the exact edit projection patch.
      revision: 2n,
    };
    void invalidPatch;
    const invalidValuePatch: AstryxTableEditRowPatch<Order, typeof rowAwareEditableColumns> = {
      // @ts-expect-error Edit projection values retain their exact source field types.
      quantity: 4,
    };
    void invalidValuePatch;
  });

  it("requires a projector when an exact editable tuple declares row-aware presentation", () => {
    const missingProjector = {
      editable: true,
      getRowVersion: (row: Order) => row.revision,
      onSaveEdits: () => Promise.resolve(),
    } as const;

    // @ts-expect-error Row-aware editable presentation requires a trusted projected Row seam.
    const invalidCapability: AstryxTableEditingCapability<
      Order,
      typeof rowAwareEditableColumns,
      bigint
    > = missingProjector;
    void invalidCapability;

    const validCapability = {
      ...missingProjector,
      projectEditRow: ({
        row,
        patch,
      }: AstryxTableEditRowProjectorInput<Order, typeof rowAwareEditableColumns, bigint>) => ({
        ...row,
        ...patch,
      }),
    } satisfies AstryxTableEditingCapability<Order, typeof rowAwareEditableColumns, bigint>;
    expectTypeOf(validCapability.projectEditRow).toMatchTypeOf<
      AstryxTableEditRowProjector<Order, typeof rowAwareEditableColumns, bigint>
    >();

    const widened: AstryxTableColumns<Order> = rowAwareEditableColumns;
    const widenedCapabilityWithoutStaticProof = {
      editable: true,
      getRowVersion: (row: Order) => row.revision,
      onSaveEdits: () => Promise.resolve(),
    } satisfies AstryxTableEditingCapability<Order, typeof widened, bigint>;
    void widenedCapabilityWithoutStaticProof;

    const directClientProps = {
      tableId: "row-aware-editable-client",
      columns: rowAwareEditableColumns,
      initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
      getRowId: (row: Order) => row.id,
      clientSource: directViewServerResult,
      editable: true,
      getRowVersion: (row: Order) => row.revision,
      onSaveEdits: () => Promise.resolve(),
    } as const;

    // @ts-expect-error Direct Editable Client calls require the trusted projection seam.
    void AstryxTableClient(directClientProps);
    void AstryxTableClient({
      ...directClientProps,
      projectEditRow: ({ row, patch }) => ({ ...row, ...patch }),
    });
  });

  it("detects each row-aware callback without widening value-only edit capabilities", () => {
    const formatterColumns = [
      {
        columnId: "COL_ID_SYMBOL",
        field: "symbol",
        headerName: "Symbol",
        valueType: "text",
        isEditable: true,
        valueFormatter: ({ value }) => value,
      },
    ] as const satisfies AstryxTableColumns<Order>;
    const classColumns = [
      {
        columnId: "COL_ID_PRICE",
        field: "price",
        headerName: "Price",
        valueType: "number",
        isEditable: true,
        cellClassName: ({ value }) => (value > 0 ? "positive" : undefined),
      },
    ] as const satisfies AstryxTableColumns<Order>;
    const rendererColumns = [
      {
        columnId: "COL_ID_QUANTITY",
        field: "quantity",
        headerName: "Quantity",
        valueType: "bigint",
        isEditable: true,
        cellRenderer: ({ value }) => value.toString(10),
      },
    ] as const satisfies AstryxTableColumns<Order>;
    const capabilityWithoutProjector = {
      editable: true,
      getRowVersion: (row: Order) => row.revision,
      onSaveEdits: () => Promise.resolve(),
    } as const;

    // @ts-expect-error An editable value formatter can consume the projected Row.
    const invalidFormatter: AstryxTableEditingCapability<Order, typeof formatterColumns, bigint> =
      capabilityWithoutProjector;
    // @ts-expect-error An editable Cell Class callback can consume the projected Row.
    const invalidClass: AstryxTableEditingCapability<Order, typeof classColumns, bigint> =
      capabilityWithoutProjector;
    // @ts-expect-error An editable Cell Renderer can consume the projected Row.
    const invalidRenderer: AstryxTableEditingCapability<Order, typeof rendererColumns, bigint> =
      capabilityWithoutProjector;
    void invalidFormatter;
    void invalidClass;
    void invalidRenderer;

    const valueOnlyColumns = [
      {
        columnId: "COL_ID_SYMBOL",
        field: "symbol",
        headerName: "Symbol",
        valueType: "text",
        isEditable: true,
        cellClassName: "tabular-nums",
      },
      {
        columnId: "COL_ID_REVISION",
        field: "revision",
        headerName: "Revision",
        valueType: "bigint",
        valueFormatter: ({ row, value }) => `${row.id}:${value}`,
      },
    ] as const satisfies AstryxTableColumns<Order>;
    const valueOnlyCapability = {
      ...capabilityWithoutProjector,
    } satisfies AstryxTableEditingCapability<Order, typeof valueOnlyColumns, bigint>;
    void valueOnlyCapability;

    const readOnlyWithProjector = {
      editable: false,
      projectEditRow: ({ row }: AstryxTableEditRowProjectorInput<Order, typeof valueOnlyColumns>) =>
        row,
    } as const;
    // @ts-expect-error Read-only Tables reject the edit-only Row projection seam.
    const invalidReadOnly: AstryxTableEditingCapability<Order, typeof valueOnlyColumns, bigint> =
      readOnlyWithProjector;
    void invalidReadOnly;
  });

  it("correlates row-grouped saves with source fields and exact row versions", () => {
    expectTypeOf<AstryxTableColumnField<Columns, "COL_ID_PRICE">>().toEqualTypeOf<"price">();
    expectTypeOf<AstryxTableSaveCellChange<Order, Columns>>().toEqualTypeOf<
      | {
          readonly columnId: "COL_ID_SYMBOL";
          readonly field: "symbol";
          readonly before: string;
          readonly after: string;
        }
      | {
          readonly columnId: "COL_ID_PRICE";
          readonly field: "price";
          readonly before: number;
          readonly after: number;
        }
    >();
    expectTypeOf<AstryxTableSaveChangeSet<Order, Columns, bigint>[number]>().toEqualTypeOf<{
      readonly rowId: string;
      readonly baseRow: Order;
      readonly expectedVersion: bigint;
      readonly changes: readonly [
        AstryxTableSaveCellChange<Order, Columns>,
        ...AstryxTableSaveCellChange<Order, Columns>[],
      ];
    }>();
  });

  it("requires explicit editable component generics to name the Row Version authority", () => {
    const editableProps = {
      tableId: "explicit-editable-version",
      columns,
      initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
      getRowId: (row: Order) => row.id,
      clientSource: directViewServerResult,
      editable: true,
      getRowVersion: (row: Order) => row.revision,
      onSaveEdits: (changes: AstryxTableSaveChangeSet<Order, Columns, bigint>) => {
        expectTypeOf(changes[0].expectedVersion).toEqualTypeOf<bigint>();
        return Promise.resolve();
      },
      projectEditRow: ({
        row,
        patch,
      }: AstryxTableEditRowProjectorInput<Order, Columns, bigint>) => ({
        ...row,
        ...patch,
      }),
    } as const;

    // @ts-expect-error Explicit editable calls require the third Row Version authority generic.
    void AstryxTableClient<Order, Columns>(editableProps);
    void AstryxTableClient<Order, Columns, (row: Order) => bigint>(editableProps);
    void AstryxTableClient(editableProps);

    // @ts-expect-error Editable named props require the third Row Version authority generic.
    const erasedNamedProps: AstryxTableClientProps<Order, Columns> = editableProps;
    void erasedNamedProps;
    const exactNamedProps: AstryxTableClientProps<Order, Columns, bigint> = editableProps;
    expectTypeOf(exactNamedProps.getRowVersion).returns.toEqualTypeOf<bigint>();
  });

  it("types recursive filters and ordered sorts", () => {
    const filters = [
      { columnId: "COL_ID_PRICE", type: "greaterThanOrEqual", filter: 100 },
      {
        columnId: "COL_ID_SYMBOL",
        type: "equals",
        filter: "AAPL",
        caseSensitive: true,
      },
      {
        type: "OR",
        conditions: [
          { columnId: "COL_ID_SYMBOL", type: "startsWith", filter: "A" },
          { type: "NOT", condition: { columnId: "COL_ID_SYMBOL", type: "blank" } },
        ],
      },
    ] satisfies AstryxTableFilterExpressions<Order, Columns>;

    const sorting = [
      { columnId: "COL_ID_PRICE", direction: "desc" },
      { columnId: "COL_ID_SYMBOL", direction: "asc" },
    ] satisfies AstryxTableSortBy<Columns>;

    expectTypeOf(filters).toBeArray();
    expectTypeOf(sorting).toBeArray();

    const emptyCompound = [
      {
        type: "OR",
        // @ts-expect-error Compound filter conditions are non-empty.
        conditions: [],
      },
    ] satisfies AstryxTableFilterExpressions<Order, Columns>;
    void emptyCompound;
  });

  it("accepts direct client and witnessed server viewport source envelopes", () => {
    const common = {
      tableId: "orders",
      columns,
      initialFilters: [
        { columnId: "COL_ID_SYMBOL", type: "startsWith", filter: "A" },
      ] satisfies AstryxTableFilterExpressions<Order, Columns>,
      initialOrderBy: [
        { columnId: "COL_ID_PRICE", direction: "desc" },
      ] satisfies AstryxTableSortBy<Columns>,
    } as const;

    const clientProps = {
      ...common,
      getRowId: (row: Order) => row.id,
      children: "Page-specific toolbar content",
      clientSource: {
        rows: [] as readonly Order[],
        totalRows: 0,
        version: 1,
        status: "ready",
      },
    } satisfies AstryxTableClientProps<Order, Columns>;

    const serverProps = {
      ...common,
      children: AstryxTableFilterControl({
        ownership: "external",
        children: "Application-controlled working set",
      }),
      viewportSource: { ...orderViewportSource, status: "loading" },
    } satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;

    expectTypeOf(clientProps.clientSource.rows).toEqualTypeOf<readonly Order[]>();
    expectTypeOf(clientProps.initialFilters[0]!.columnId).toEqualTypeOf<"COL_ID_SYMBOL">();
    expectTypeOf(clientProps.children).toEqualTypeOf<string>();
    expectTypeOf(serverProps.viewportSource.viewport).toEqualTypeOf<
      typeof orderViewportSource.viewport
    >();
    expectTypeOf(serverProps.children).toEqualTypeOf<ReactNode>();

    const annotatedLeasedProps: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = {
      ...common,
      viewportSource: leasedOrderViewportSource,
      routeBy: { status: "open", revision: 1n },
      externalFilters: [{ field: "quantity", type: "inRange", filter: 1n, filterTo: 10n }],
    };
    void annotatedLeasedProps;

    // @ts-expect-error Server Props derive Route and External Filter authority from the viewport.
    type InvalidServerRouteOverride = AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport,
      never
    >;
    expectTypeOf<InvalidServerRouteOverride>();
    void AstryxTableServer<
      // @ts-expect-error the Server component exposes no caller-selectable Route/Where generics.
      typeof leasedOrderViewportSource.viewport,
      Columns,
      typeof annotatedLeasedProps,
      never
    >;

    // @ts-expect-error the direct three-generic leased Props alias requires Feed Route.
    const annotatedMissingRoute: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = { ...common, viewportSource: leasedOrderViewportSource };
    void annotatedMissingRoute;
    const annotatedMissingRouteField: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = {
      ...common,
      viewportSource: leasedOrderViewportSource,
      // @ts-expect-error the direct alias requires every source-owned Route field.
      routeBy: { status: "open" },
    };
    void annotatedMissingRouteField;
    const annotatedExtraRouteField: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = {
      ...common,
      viewportSource: leasedOrderViewportSource,
      // @ts-expect-error the direct alias rejects fields outside the source-owned Route tuple.
      routeBy: { status: "open", revision: 1n, desk: "rates" },
    };
    void annotatedExtraRouteField;
    const annotatedWrongRouteValue: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = {
      ...common,
      viewportSource: leasedOrderViewportSource,
      // @ts-expect-error the direct alias preserves exact Route scalar domains.
      routeBy: { status: "open", revision: 1 },
    };
    void annotatedWrongRouteValue;
    const annotatedWrongExternalField: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = {
      ...common,
      viewportSource: leasedOrderViewportSource,
      routeBy: { status: "open", revision: 1n },
      // @ts-expect-error the direct alias rejects unknown External Filter fields.
      externalFilters: [{ field: "missing", type: "equals", filter: "open" }],
    };
    void annotatedWrongExternalField;
    const annotatedWrongExternalOperand: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = {
      ...common,
      viewportSource: leasedOrderViewportSource,
      routeBy: { status: "open", revision: 1n },
      // @ts-expect-error the direct alias preserves exact known-field operand domains.
      externalFilters: [{ field: "quantity", type: "equals", filter: 1 }],
    };
    void annotatedWrongExternalOperand;
    const annotatedMixedExternalRange: AstryxTableServerProps<
      Order,
      Columns,
      typeof leasedOrderViewportSource.viewport
    > = {
      ...common,
      viewportSource: leasedOrderViewportSource,
      routeBy: { status: "open", revision: 1n },
      // @ts-expect-error the direct alias keeps both bigint range bounds in one exact domain.
      externalFilters: [{ field: "quantity", type: "inRange", filter: 1n, filterTo: 10 }],
    };
    void annotatedMixedExternalRange;
    const annotatedMaterializedRoute: AstryxTableServerProps<
      Order,
      Columns,
      typeof orderViewportSource.viewport
    > = {
      ...common,
      viewportSource: orderViewportSource,
      // @ts-expect-error the direct source-free alias forbids Feed Route.
      routeBy: { status: "open" },
    };
    void annotatedMaterializedRoute;

    void AstryxTableServer({
      ...serverProps,
      externalFilters: [{ field: "status", type: "equals", filter: "open" }],
    });
    void AstryxTableServer({
      ...common,
      viewportSource: leasedOrderViewportSource,
      routeBy: { status: "open", revision: 1n },
      externalFilters: [{ field: "quantity", type: "inRange", filter: 1n, filterTo: 10n }],
    });
    // @ts-expect-error leased sources require their complete exact Route tuple.
    void AstryxTableServer({ ...common, viewportSource: leasedOrderViewportSource });
    void AstryxTableServer({
      ...common,
      viewportSource: leasedOrderViewportSource,
      // @ts-expect-error leased sources reject missing Route fields.
      routeBy: { status: "open" },
    });
    void AstryxTableServer({
      ...common,
      viewportSource: leasedOrderViewportSource,
      // @ts-expect-error leased sources reject extra Route fields.
      routeBy: { status: "open", revision: 1n, desk: "rates" },
    });
    void AstryxTableServer({
      ...common,
      viewportSource: leasedOrderViewportSource,
      // @ts-expect-error exact Route values reject the wrong scalar domain.
      routeBy: { status: "open", revision: 1 },
    });
    // @ts-expect-error source-free topics forbid Feed Route.
    void AstryxTableServer({ ...serverProps, routeBy: { status: "open" } });
    void AstryxTableServer({
      ...serverProps,
      // @ts-expect-error External Filters reject unknown fields.
      externalFilters: [{ field: "missing", type: "equals", filter: "open" }],
    });
    void AstryxTableServer({
      ...serverProps,
      // @ts-expect-error External Filters preserve exact field operand domains.
      externalFilters: [{ field: "quantity", type: "equals", filter: 1 }],
    });
    void AstryxTableServer({
      ...serverProps,
      // @ts-expect-error inRange bounds preserve one exact bigint operand domain.
      externalFilters: [{ field: "quantity", type: "inRange", filter: 1n, filterTo: 10 }],
    });

    void AstryxTableClient({
      ...clientProps,
      initialOrderBy: [{ columnId: "COL_ID_PRICE", direction: "asc" }],
    });
    const missingColumns = {
      tableId: "orders",
      getRowId: (row: Order) => row.id,
      initialOrderBy: [{ columnId: "COL_ID_PRICE", direction: "asc" }] as const,
      clientSource: clientProps.clientSource,
    };
    // @ts-expect-error A Client Table cannot omit its column definitions.
    const invalidMissingColumns: AstryxTableClientProps<Order, Columns> = missingColumns;
    void invalidMissingColumns;

    const missingClientSource = {
      tableId: "orders",
      columns,
      getRowId: (row: Order) => row.id,
      initialOrderBy: [{ columnId: "COL_ID_PRICE", direction: "asc" }] as const,
    };
    // @ts-expect-error A Client Table cannot omit its live Client Source.
    const invalidMissingClientSource: AstryxTableClientProps<Order, Columns> = missingClientSource;
    void invalidMissingClientSource;
    void AstryxTableClient({
      ...clientProps,
      // @ts-expect-error initialOrderBy is a non-empty typed tuple.
      initialOrderBy: [],
    });

    const noSortColumns = [
      {
        columnId: "COL_ID_SYMBOL",
        field: "symbol",
        headerName: "Symbol",
        valueType: "text",
        isEditable: true,
        enableSorting: false,
      },
    ] as const satisfies AstryxTableColumns<Order>;
    // @ts-expect-error AstryxTableClient cannot omit its required non-empty Initial Order By.
    void AstryxTableClient<Order, typeof noSortColumns>({
      tableId: "orders-no-sort",
      columns: noSortColumns,
      getRowId: (row: Order) => row.id,
      clientSource: clientProps.clientSource,
    });
    void AstryxTableClient<Order, typeof noSortColumns>({
      tableId: "orders-no-sort",
      columns: noSortColumns,
      // @ts-expect-error a Client definition without a sortable Column Identity is invalid.
      initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
      getRowId: (row: Order) => row.id,
      clientSource: clientProps.clientSource,
    });
  });
});

type HelperRow = {
  readonly symbol: string;
  readonly price: number;
  readonly quantity: bigint;
  readonly active: boolean;
  readonly status: "open" | "closed";
  readonly multiplier: number;
};

const priceColumn = AstryxTableNumberColumn.withDefaults({
  headerName: "Price",
  width: 112,
  format: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
});

const statusColumn = AstryxTableSelectColumn.withDefaults({
  headerName: "Status",
  options: ["open", "closed"],
});

type PresetEditRow = Readonly<{
  readonly nullable: number | null;
  readonly optional: number | undefined;
  readonly required: number;
  readonly nullableStatus: "open" | "closed" | null;
  readonly requiredStatus: "open" | "closed";
}>;
const invalidRawValidationColumns = [
  // @ts-expect-error validation is edit-only and requires statically potential editability.
  {
    columnId: "COL_ID_READ_ONLY_VALIDATE",
    field: "required",
    headerName: "Read-only validate",
    valueType: "number",
    validate: () => undefined,
  },
] satisfies AstryxTableColumns<PresetEditRow>;
void invalidRawValidationColumns;
// @ts-expect-error preset validation requires literal true or predicate editability.
AstryxTableNumberColumn.withDefaults({
  validate: () => undefined,
});
const nullableNumberPreset = AstryxTableNumberColumn.withDefaults({
  isEditable: true,
  blankValue: null,
  validate: ({ value }) => (value === undefined ? "Unexpected undefined" : undefined),
});
const presetEditColumns = [
  nullableNumberPreset({
    columnId: "COL_ID_NULLABLE_PRESET",
    field: "nullable",
    headerName: "Nullable preset",
  }),
] satisfies AstryxTableColumns<PresetEditRow>;
void presetEditColumns;
const optionalPresetEditColumns = [
  nullableNumberPreset({
    columnId: "COL_ID_OPTIONAL_PRESET",
    field: "optional",
    headerName: "Optional preset",
    blankValue: undefined,
  }),
] satisfies AstryxTableColumns<PresetEditRow>;
void optionalPresetEditColumns;
const predicateNumberPreset = AstryxTableNumberColumn.withDefaults({
  isEditable: ({ row, value }) => {
    expectTypeOf(row).toEqualTypeOf<unknown>();
    expectTypeOf(value).toEqualTypeOf<number | null | undefined>();
    return value !== undefined;
  },
  blankValue: null,
});
const predicateNumberPresetColumns = [
  predicateNumberPreset({
    columnId: "COL_ID_PREDICATE_NULLABLE_PRESET",
    field: "nullable",
    headerName: "Predicate nullable preset",
  }),
] satisfies AstryxTableColumns<PresetEditRow>;
void predicateNumberPresetColumns;
const predicateSelectPreset = AstryxTableSelectColumn.withDefaults({
  options: ["open", "closed"],
  isEditable: ({ row, value }) => {
    expectTypeOf(row).toEqualTypeOf<unknown>();
    expectTypeOf(value).toEqualTypeOf<"open" | "closed" | null | undefined>();
    return value !== undefined;
  },
  blankValue: null,
});
const predicateSelectPresetColumns = [
  predicateSelectPreset({
    columnId: "COL_ID_PREDICATE_SELECT_PRESET",
    field: "nullableStatus",
    headerName: "Predicate Select preset",
  }),
] satisfies AstryxTableColumns<PresetEditRow>;
void predicateSelectPresetColumns;
const invalidRequiredSelectPreset = predicateSelectPreset({
  columnId: "COL_ID_INVALID_REQUIRED_SELECT_PRESET",
  // @ts-expect-error an inherited null blank policy cannot target a required Select field.
  field: "requiredStatus",
  headerName: "Invalid required Select preset",
});
void invalidRequiredSelectPreset;
const widenedEditableDefaults: { readonly isEditable?: boolean } = { isEditable: true };
const widenedEditableNumberPreset = AstryxTableNumberColumn.withDefaults(widenedEditableDefaults);
const invalidWidenedNullablePreset = widenedEditableNumberPreset({
  columnId: "COL_ID_WIDENED_NULLABLE_PRESET",
  // @ts-expect-error widened editability may be true, so nullable fields require a blank policy.
  field: "nullable",
  headerName: "Widened nullable preset",
});
void invalidWidenedNullablePreset;
const invalidWidenedNullablePresetWithBlank = widenedEditableNumberPreset({
  columnId: "COL_ID_WIDENED_NULLABLE_PRESET_WITH_BLANK",
  // @ts-expect-error widened editability cannot prove the nullable field capability.
  field: "nullable",
  headerName: "Widened nullable preset with blank",
  // @ts-expect-error a blank policy still requires exact true or predicate editability.
  blankValue: null,
});
void invalidWidenedNullablePresetWithBlank;
const validWidenedRequiredPreset = [
  widenedEditableNumberPreset({
    columnId: "COL_ID_WIDENED_REQUIRED_PRESET",
    field: "required",
    headerName: "Widened required preset",
  }),
] satisfies AstryxTableColumns<PresetEditRow>;
void validWidenedRequiredPreset;
const computedFromEditPresetColumns = [
  nullableNumberPreset({
    columnId: "COL_ID_COMPUTED_PRESET",
    fields: ["required"],
    headerName: "Computed preset",
    valueGetter: ({ row }) => row.required,
  }),
] satisfies AstryxTableColumns<PresetEditRow>;
const computedFromEditPreset = computedFromEditPresetColumns[0]!;
expectTypeOf(computedFromEditPreset["isEditable"]).toEqualTypeOf<undefined>();
expectTypeOf(computedFromEditPreset["blankValue"]).toEqualTypeOf<undefined>();
expectTypeOf(computedFromEditPreset["validate"]).toEqualTypeOf<undefined>();
const invalidPresetField = nullableNumberPreset({
  columnId: "COL_ID_REQUIRED_PRESET",
  // @ts-expect-error a null blank preset can target only a field whose domain contains null.
  field: "required",
  headerName: "Required preset",
});
void invalidPresetField;
const invalidDisabledPresetField = nullableNumberPreset({
  columnId: "COL_ID_DISABLED_PRESET",
  // @ts-expect-error an inherited blank cannot be combined with an isEditable false override.
  field: "nullable",
  headerName: "Disabled preset",
  // @ts-expect-error the effective false-plus-blank shape is rejected.
  isEditable: false,
});
void invalidDisabledPresetField;
const editableWithoutBlankPreset = AstryxTableNumberColumn.withDefaults({ isEditable: true });
const validRequiredEditableWithoutBlank = [
  editableWithoutBlankPreset({
    columnId: "COL_ID_REQUIRED_EDITABLE_PRESET",
    field: "required",
    headerName: "Required editable preset",
  }),
] satisfies AstryxTableColumns<PresetEditRow>;
void validRequiredEditableWithoutBlank;
const validatedNumberPreset = AstryxTableNumberColumn.withDefaults({
  isEditable: true,
  validate: () => undefined,
});
const invalidDisabledValidatedPreset = validatedNumberPreset({
  columnId: "COL_ID_DISABLED_VALIDATED_PRESET",
  // @ts-expect-error inherited validation cannot combine with a false editability override.
  field: "required",
  headerName: "Disabled validated preset",
  // @ts-expect-error the effective false-plus-validation shape is rejected.
  isEditable: false,
});
void invalidDisabledValidatedPreset;
const invalidNullableEditableWithoutBlank = editableWithoutBlankPreset({
  columnId: "COL_ID_NULLABLE_EDITABLE_PRESET",
  // @ts-expect-error nullable editable preset applications require an exact blank policy.
  field: "nullable",
  headerName: "Nullable editable preset",
});
void invalidNullableEditableWithoutBlank;
// @ts-expect-error a blank preset requires literal isEditable true.
AstryxTableNumberColumn.withDefaults({
  isEditable: false,
  blankValue: null,
});

const computedPriceColumn = AstryxTableNumberColumn.withDefaults({
  headerName: "Calculated price",
  enableFilter: true,
  enableSorting: true,
  isEditable: true,
});

const computedPresetColumns = [
  computedPriceColumn({
    columnId: "COL_ID_COMPUTED_PRICE",
    fields: ["price", "multiplier"],
    valueGetter: ({ row }) => row.price * row.multiplier,
  }),
] satisfies AstryxTableColumns<HelperRow>;

expectTypeOf<(typeof computedPresetColumns)[0]["enableFilter"]>().toEqualTypeOf<undefined>();
expectTypeOf<(typeof computedPresetColumns)[0]["enableSorting"]>().toEqualTypeOf<undefined>();
expectTypeOf<(typeof computedPresetColumns)[0]["isEditable"]>().toEqualTypeOf<undefined>();

const helperColumns = [
  AstryxTableTextColumn({
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    headerName: "Symbol",
  }),
  priceColumn({
    columnId: "COL_ID_PRICE",
    field: "price",
    width: 144,
    format: { maximumFractionDigits: 4 },
    isEditable: ({ row, value }) => {
      expectTypeOf(row).toEqualTypeOf<HelperRow>();
      expectTypeOf(value).toEqualTypeOf<number>();
      return row.status === "open" && value >= 0;
    },
    valueFormatter: ({ row, value }) => `${row.symbol} ${value.toFixed(2)}`,
    cellClassName: ({ value }) => (value < 0 ? "text-destructive" : undefined),
    cellRenderer: ({ row, value }) => `${row.symbol}:${value}`,
  }),
  AstryxTableBigIntColumn({
    columnId: "COL_ID_QUANTITY",
    field: "quantity",
    headerName: "Quantity",
  }),
  AstryxTableBooleanColumn({
    columnId: "COL_ID_ACTIVE",
    field: "active",
    headerName: "Active",
  }),
  statusColumn({
    columnId: "COL_ID_STATUS",
    field: "status",
  }),
  AstryxTableNumberColumn({
    columnId: "COL_ID_WEIGHTED_PRICE",
    fields: ["price", "multiplier"],
    headerName: "Weighted price",
    valueGetter: ({ row }) => {
      expectTypeOf(row).toEqualTypeOf<Pick<HelperRow, "price" | "multiplier">>();
      return row.price * row.multiplier;
    },
    valueFormatter: ({ value }) => value.toFixed(2),
  }),
] satisfies AstryxTableColumns<HelperRow>;

type HelperColumns = typeof helperColumns;
type PriceHelperColumn = Extract<HelperColumns[number], { readonly columnId: "COL_ID_PRICE" }>;
type QuantityHelperColumn = Extract<
  HelperColumns[number],
  { readonly columnId: "COL_ID_QUANTITY" }
>;
type ActiveHelperColumn = Extract<HelperColumns[number], { readonly columnId: "COL_ID_ACTIVE" }>;
type StatusHelperColumn = Extract<HelperColumns[number], { readonly columnId: "COL_ID_STATUS" }>;

describe("AstryxTable Column Helpers", () => {
  it("preserves identities, values, defaults, presets, and individual overrides", () => {
    expectTypeOf<AstryxTableColumnIdOf<HelperColumns>>().toEqualTypeOf<
      | "COL_ID_SYMBOL"
      | "COL_ID_PRICE"
      | "COL_ID_QUANTITY"
      | "COL_ID_ACTIVE"
      | "COL_ID_STATUS"
      | "COL_ID_WEIGHTED_PRICE"
    >();
    expectTypeOf<
      AstryxTableColumnValue<HelperRow, HelperColumns, "COL_ID_PRICE">
    >().toEqualTypeOf<number>();
    expectTypeOf<
      AstryxTableColumnValue<HelperRow, HelperColumns, "COL_ID_QUANTITY">
    >().toEqualTypeOf<bigint>();
    expectTypeOf<AstryxTableColumnValue<HelperRow, HelperColumns, "COL_ID_STATUS">>().toEqualTypeOf<
      "open" | "closed"
    >();
    expectTypeOf<
      AstryxTableColumnValue<HelperRow, HelperColumns, "COL_ID_WEIGHTED_PRICE">
    >().toEqualTypeOf<number>();

    expectTypeOf<PriceHelperColumn["width"]>().toEqualTypeOf<144>();
    expectTypeOf<PriceHelperColumn["cellAlign"]>().toEqualTypeOf<"end">();
    expectTypeOf<QuantityHelperColumn["cellAlign"]>().toEqualTypeOf<"end">();
    expectTypeOf<ActiveHelperColumn["cellAlign"]>().toEqualTypeOf<"center">();
    expectTypeOf<StatusHelperColumn["editorLayout"]>().toEqualTypeOf<"fullWidth">();
  });
});

type ExactAmount = { readonly minor: bigint };
type AmountRow = { readonly amount: ExactAmount };

const exactAmountValueType = {
  codecId: "test/exact-amount",
  codecVersion: 1,
  filterFamily: "numeric",
  editorFamily: "text",
  cellAlign: "end",
  editorLayout: "inline",
  defaultWidth: 120,
  decodeRuntime: (input): AstryxTableDecodeResult<ExactAmount> =>
    typeof input === "object" &&
    input !== null &&
    "minor" in input &&
    typeof input.minor === "bigint"
      ? { _tag: "Success", value: { minor: input.minor } }
      : { _tag: "Failure", message: "Expected an exact amount." },
  equivalent: (left, right) => left.minor === right.minor,
  compare: (left, right) => (left.minor === right.minor ? 0 : left.minor < right.minor ? -1 : 1),
  formatCanonicalText: (value) => value.minor.toString(10),
  parseCanonicalText: (text) =>
    /^-?\d+$/u.test(text)
      ? { _tag: "Success", value: { minor: BigInt(text) } }
      : { _tag: "Failure", message: "Expected integer minor units." },
  formatDisplay: (value) => value.minor.toString(10),
  encodePersisted: (value) => ({ minor: value.minor.toString(10) }),
  decodePersisted: () => ({ _tag: "Failure", message: "Not used in this type proof." }),
} satisfies AstryxTableValueType<ExactAmount, "numeric", "text">;

const customValueColumns = [
  {
    columnId: "COL_ID_AMOUNT",
    field: "amount",
    headerName: "Amount",
    valueType: exactAmountValueType,
  },
] satisfies AstryxTableColumns<AmountRow>;

const exactEqualityValueType = {
  ...exactAmountValueType,
  filterFamily: "equality",
} satisfies AstryxTableValueType<ExactAmount, "equality", "text">;

// @ts-expect-error Select editor option provenance is supplied only by AstryxTableSelectColumn.
type UnsupportedCustomSelect = AstryxTableValueType<string, "select", "select">;
void (0 as unknown as UnsupportedCustomSelect);

const optedInEqualitySetColumns = [
  {
    columnId: "COL_ID_AMOUNT",
    enableSetFilter: true,
    field: "amount",
    headerName: "Amount",
    valueType: exactEqualityValueType,
  },
] satisfies AstryxTableColumns<AmountRow>;

const acceptedEqualitySetFilters = [
  { columnId: "COL_ID_AMOUNT", type: "in", filter: [{ minor: 1n }] },
  { columnId: "COL_ID_AMOUNT", type: "matchNone" },
] satisfies AstryxTableFilterExpressions<AmountRow, typeof optedInEqualitySetColumns>;

void acceptedEqualitySetFilters;

const customComputedValueColumns = [
  AstryxTableComputedColumn({
    columnId: "COL_ID_AMOUNT_COPY",
    fields: ["amount"],
    headerName: "Amount copy",
    valueType: exactAmountValueType,
    valueGetter: ({ row }) => {
      expectTypeOf(row).toEqualTypeOf<Pick<AmountRow, "amount">>();
      return row.amount;
    },
    valueFormatter: ({ value }) => value.minor.toString(10),
  }),
] satisfies AstryxTableColumns<AmountRow>;
const computedWithErasedEditOptions = {
  ...customComputedValueColumns[0],
  blankValue: null,
  validate: () => undefined,
};
const invalidErasedComputedEditOptions = [
  // @ts-expect-error computed columns reject edit-only options after intermediate widening.
  computedWithErasedEditOptions,
] satisfies AstryxTableColumns<AmountRow>;

expectTypeOf<
  AstryxTableColumnValue<AmountRow, typeof customComputedValueColumns, "COL_ID_AMOUNT_COPY">
>().toEqualTypeOf<ExactAmount>();

const customNumericFilter = [
  { columnId: "COL_ID_AMOUNT", type: "greaterThan", filter: { minor: 10n } },
] satisfies AstryxTableFilterExpressions<AmountRow, typeof customValueColumns>;

void customNumericFilter;
void customComputedValueColumns;
void invalidErasedComputedEditOptions;

const invalidColumnIds = [
  {
    // @ts-expect-error column identities are namespaced and uppercase.
    columnId: "price",
    field: "price",
    headerName: "Price",
    valueType: "number",
  },
  {
    // @ts-expect-error lowercase suffixes are rejected.
    columnId: "COL_ID_price",
    field: "price",
    headerName: "Price",
    valueType: "number",
  },
] satisfies AstryxTableColumns<Order>;

const invalidField = [
  // @ts-expect-error field must be a real row key.
  {
    columnId: "COL_ID_PRICES",
    field: "prices",
    headerName: "Price",
    valueType: "number",
  },
] satisfies AstryxTableColumns<Order>;

const ambiguousColumn = [
  // @ts-expect-error field and valueGetter are mutually exclusive.
  {
    columnId: "COL_ID_PRICE",
    field: "price",
    headerName: "Price",
    valueType: "number",
    valueGetter: ({ row }: { readonly row: Order }) => row.price,
  },
] satisfies AstryxTableColumns<Order>;

const missingHeaderName = [
  // @ts-expect-error every leaf column requires an explicit header name.
  {
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    valueType: "text",
  },
] satisfies AstryxTableColumns<Order>;

const invalidValueType = [
  // @ts-expect-error a number field requires number Value Semantics.
  {
    columnId: "COL_ID_PRICE",
    field: "price",
    headerName: "Price",
    valueType: "text",
  },
] satisfies AstryxTableColumns<Order>;

const invalidCapabilityFlags = [
  // @ts-expect-error filtering capability accepts only a boolean opt-out.
  {
    columnId: "COL_ID_PRICE",
    field: "price",
    headerName: "Price",
    valueType: "number",
    enableFilter: "no",
  },
  // @ts-expect-error sorting capability accepts only a boolean opt-out.
  {
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
    enableSorting: 0,
  },
] satisfies AstryxTableColumns<Order>;

const invalidComputedDependency = [
  AstryxTableComputedColumn({
    columnId: "COL_ID_DOUBLE_QUANTITY",
    fields: ["quantity"],
    headerName: "Double quantity",
    valueType: "bigint",
    valueGetter: ({ row }) => {
      // @ts-expect-error undeclared fields are absent from the Computed Column getter row.
      void row.price;
      return row.quantity * 2n;
    },
  }),
] satisfies AstryxTableColumns<Order>;

const invalidEmptyComputedDependencies = [
  AstryxTableComputedColumn({
    columnId: "COL_ID_DOUBLE_QUANTITY",
    // @ts-expect-error a Computed Column requires a non-empty dependency tuple.
    fields: [],
    headerName: "Double quantity",
    // @ts-expect-error no Value Type overload accepts an empty dependency tuple.
    valueType: "bigint",
    // @ts-expect-error no getter overload accepts an empty dependency tuple.
    valueGetter: () => 0n,
  }),
] satisfies AstryxTableColumns<Order>;

const invalidNumericFilter = [
  // @ts-expect-error contains is not a numeric operator.
  { columnId: "COL_ID_PRICE", type: "contains", filter: "10" },
] satisfies AstryxTableFilterExpressions<Order, Columns>;

const invalidNumericSensitivity = [
  {
    columnId: "COL_ID_PRICE",
    type: "equals",
    filter: 10,
    // @ts-expect-error case sensitivity belongs only to text filters.
    caseSensitive: true,
  },
] satisfies AstryxTableFilterExpressions<Order, Columns>;

const exactBuiltInFilters = [
  { columnId: "COL_ID_QUANTITY", type: "greaterThanOrEqual", filter: 10n },
  { columnId: "COL_ID_ACTIVE", type: "equals", filter: true },
  { columnId: "COL_ID_STATUS", type: "equals", filter: "open" },
] satisfies AstryxTableFilterExpressions<HelperRow, HelperColumns>;

const invalidBigIntFilterOperand = [
  // @ts-expect-error BigInt filters preserve bigint operands instead of accepting number values.
  { columnId: "COL_ID_QUANTITY", type: "greaterThan", filter: 10 },
] satisfies AstryxTableFilterExpressions<HelperRow, HelperColumns>;

const invalidBooleanFilterOperand = [
  // @ts-expect-error Boolean filters preserve boolean operands instead of accepting text labels.
  { columnId: "COL_ID_ACTIVE", type: "equals", filter: "true" },
] satisfies AstryxTableFilterExpressions<HelperRow, HelperColumns>;

const invalidSelectFilterOperand = [
  // @ts-expect-error Select filters admit only the exact configured value union.
  { columnId: "COL_ID_STATUS", type: "equals", filter: "pending" },
] satisfies AstryxTableFilterExpressions<HelperRow, HelperColumns>;

void exactBuiltInFilters;
void invalidBigIntFilterOperand;
void invalidBooleanFilterOperand;
void invalidSelectFilterOperand;

type FeatureFlag = { readonly enabled: boolean };

const featureFlagColumns = [
  {
    columnId: "COL_ID_ENABLED",
    field: "enabled",
    headerName: "Enabled",
    valueType: "boolean",
  },
] satisfies AstryxTableColumns<FeatureFlag>;

const invalidBooleanSensitivity = [
  {
    columnId: "COL_ID_ENABLED",
    type: "equals",
    filter: true,
    // @ts-expect-error accent sensitivity belongs only to text filters.
    accentSensitive: true,
  },
] satisfies AstryxTableFilterExpressions<FeatureFlag, typeof featureFlagColumns>;

const acceptedBooleanSetFilter = [
  { columnId: "COL_ID_ENABLED", type: "in", filter: [true] },
  { columnId: "COL_ID_ENABLED", type: "matchNone" },
] satisfies AstryxTableFilterExpressions<FeatureFlag, typeof featureFlagColumns>;

const optedOutBooleanSetFilterColumns = [
  {
    columnId: "COL_ID_ENABLED",
    enableSetFilter: false,
    field: "enabled",
    headerName: "Enabled",
    valueType: "boolean",
  },
] satisfies AstryxTableColumns<FeatureFlag>;

const acceptedOptedOutBooleanInFilter = [
  { columnId: "COL_ID_ENABLED", type: "in", filter: [true] },
] satisfies AstryxTableFilterExpressions<FeatureFlag, typeof optedOutBooleanSetFilterColumns>;

const invalidOptedOutBooleanMatchNone = [
  // @ts-expect-error Match None belongs to the explicitly disabled Set Filter surface.
  { columnId: "COL_ID_ENABLED", type: "matchNone" },
] satisfies AstryxTableFilterExpressions<FeatureFlag, typeof optedOutBooleanSetFilterColumns>;

void acceptedOptedOutBooleanInFilter;
void invalidOptedOutBooleanMatchNone;

const setFilterColumns = [
  {
    columnId: "COL_ID_SYMBOL",
    enableSetFilter: true,
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
  },
  {
    columnId: "COL_ID_PRICE",
    enableSetFilter: true,
    field: "price",
    headerName: "Price",
    valueType: "number",
  },
] as const satisfies AstryxTableColumns<Order>;

const invalidEmptyInFilter = [
  // @ts-expect-error `in` operands must be a non-empty tuple.
  { columnId: "COL_ID_SYMBOL", type: "in", filter: [] },
] satisfies AstryxTableFilterExpressions<Order, typeof setFilterColumns>;

const acceptedTextInFilter = [
  { columnId: "COL_ID_SYMBOL", type: "in", filter: ["AAPL"] },
] satisfies AstryxTableFilterExpressions<Order, typeof setFilterColumns>;

const acceptedNumericInFilter = [
  { columnId: "COL_ID_PRICE", type: "in", filter: [10] },
] satisfies AstryxTableFilterExpressions<Order, typeof setFilterColumns>;

const invalidDefaultTextSetFilter = [
  // @ts-expect-error Text Set Filter requires explicit opt-in.
  { columnId: "COL_ID_SYMBOL", type: "matchNone" },
] satisfies AstryxTableFilterExpressions<Order, Columns>;

const invalidDefaultNumberSetFilter = [
  // @ts-expect-error Number Set Filter requires explicit opt-in.
  { columnId: "COL_ID_PRICE", type: "matchNone" },
] satisfies AstryxTableFilterExpressions<Order, Columns>;

const invalidSetFilterCapability = [
  // @ts-expect-error Set Filter cannot be enabled when filtering is disabled.
  {
    columnId: "COL_ID_SYMBOL",
    enableFilter: false,
    enableSetFilter: true,
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
  },
] satisfies AstryxTableColumns<Order>;

const acceptedSelectSetFilter = [
  { columnId: "COL_ID_STATUS", type: "in", filter: ["open"] },
  { columnId: "COL_ID_STATUS", type: "matchNone" },
] satisfies AstryxTableFilterExpressions<HelperRow, HelperColumns>;

const invalidComputedFilter = [
  // @ts-expect-error computed columns have no automatic filter mapping.
  { columnId: "COL_ID_DOUBLE_QUANTITY", type: "greaterThan", filter: 10n },
] satisfies AstryxTableFilterExpressions<Order, Columns>;

const invalidOptedOutFilter = [
  // @ts-expect-error an explicitly non-filterable Field Column is absent from filter identities.
  { columnId: "COL_ID_PRICE", type: "greaterThan", filter: 10 },
] satisfies AstryxTableFilterExpressions<Order, CapabilityColumns>;

const invalidMixedColumnCompoundFilter = [
  {
    type: "OR",
    // @ts-expect-error compound filters may combine leaves from only one Column Identity.
    conditions: [
      { columnId: "COL_ID_PRICE", type: "greaterThan", filter: 10 },
      { columnId: "COL_ID_SYMBOL", type: "startsWith", filter: "A" },
    ],
  },
] satisfies AstryxTableFilterExpressions<Order, Columns>;

const invalidSort = [
  // @ts-expect-error computed columns have no automatic sort mapping.
  { columnId: "COL_ID_DOUBLE_QUANTITY", direction: "asc" },
] satisfies AstryxTableSortBy<Columns>;

const invalidOptedOutSort = [
  // @ts-expect-error an explicitly nonsortable Field Column is absent from sort identities.
  { columnId: "COL_ID_SYMBOL", direction: "asc" },
] satisfies AstryxTableSortBy<CapabilityColumns>;

const invalidNoCapabilitySort = [
  // @ts-expect-error no sortable Column Identity exists for this table.
  { columnId: "COL_ID_SYMBOL", direction: "asc" },
] satisfies AstryxTableSortBy<NoSortingColumns>;

// @ts-expect-error a table can never have an empty normal sort order.
const invalidEmptySort = [] satisfies AstryxTableSortBy<Columns>;

const invalidPaginatedClient = {
  tableId: "orders",
  getRowId: (row: Order) => row.id,
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
  // @ts-expect-error Client Tables expose one continuous row space, not page size.
  pageSize: 100,
} satisfies AstryxTableClientProps<Order, Columns>;

const invalidPaginatedServer = {
  tableId: "orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  viewportSource: orderViewportSource,
  // @ts-expect-error Server Tables expose one continuous row space, not page index.
  pageIndex: 0,
} satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;

const clientWithoutRowId = {
  tableId: "orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} as const;

// @ts-expect-error Client identity must be derived from the complete resident rows.
const invalidClientWithoutRowId: AstryxTableClientProps<Order, Columns> = clientWithoutRowId;

const invalidServerWithRowId = {
  tableId: "orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  // @ts-expect-error Server identity is supplied by the Viewport Source, not the consumer.
  getRowId: (row: Order) => row.id,
  viewportSource: orderViewportSource,
} satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;

const validClientRowSelection = {
  tableId: "orders-selection",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  rowSelection: true,
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} as const satisfies AstryxTableClientProps<Order, Columns>;
void validClientRowSelection;

const invalidClientRowSelectionValue = {
  ...validClientRowSelection,
  rowSelection: false,
} as const;
// @ts-expect-error Row Selection is an exact opt-in capability, not controlled state.
const invalidClientRowSelectionValueAssignment: AstryxTableClientProps<Order, Columns> =
  invalidClientRowSelectionValue;
void invalidClientRowSelectionValueAssignment;

const invalidServerEditing = {
  tableId: "orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  viewportSource: orderViewportSource,
  // @ts-expect-error Server Tables cannot enable editing.
  editable: true,
} satisfies AstryxTableServerProps<Order, Columns, typeof orderViewportSource.viewport>;

const editableClientWithoutSave = {
  tableId: "orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  editable: true,
  getRowVersion: (row: Order) => row.revision,
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} as const;

// @ts-expect-error editable Client Tables require an onSaveEdits operation.
const invalidEditableClientWithoutSave: AstryxTableEditingCapability<Order, Columns, bigint> =
  editableClientWithoutSave;

const readOnlyClientWithSave = {
  tableId: "orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  editable: false,
  getRowVersion: (row: Order) => row.revision,
  onSaveEdits: () => Promise.resolve(),
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} as const;

// @ts-expect-error read-only Client Tables reject edit-only operations.
const invalidReadOnlyClientWithSave: AstryxTableClientProps<Order, Columns> = readOnlyClientWithSave;

const nonEditableColumns = [
  {
    columnId: "COL_ID_SYMBOL",
    field: "symbol",
    headerName: "Symbol",
    valueType: "text",
  },
] satisfies AstryxTableColumns<Order>;

const invalidClientWithoutEditableColumns = {
  tableId: "orders",
  columns: nonEditableColumns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  editable: true,
  getRowVersion: (row: Order) => row.revision,
  onSaveEdits: () => Promise.resolve(),
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} as const;

// @ts-expect-error no column exposes editable capability.
const invalidClientWithoutEditableColumnsAssignment: AstryxTableEditingCapability<
  Order,
  typeof nonEditableColumns,
  bigint
> = invalidClientWithoutEditableColumns;
void invalidClientWithoutEditableColumnsAssignment;

// @ts-expect-error the named Client props alias preserves the exact potentially-editable tuple proof.
const invalidNamedClientWithoutEditableColumns: AstryxTableClientProps<
  Order,
  typeof nonEditableColumns,
  bigint
> = invalidClientWithoutEditableColumns;
void invalidNamedClientWithoutEditableColumns;

const editableClientWithGrouping = {
  tableId: "orders",
  columns,
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  editable: true,
  getRowVersion: (row: Order) => row.revision,
  onSaveEdits: () => Promise.resolve(),
  groupRowsColumn: { headerName: "Rows" },
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} as const;

// @ts-expect-error editable Client Tables reject grouping even for non-fresh props objects.
const invalidEditableClientWithGrouping: AstryxTableEditingCapability<Order, Columns, bigint> =
  editableClientWithGrouping;

const invalidCrossedSaveCell = {
  columnId: "COL_ID_PRICE",
  field: "symbol",
  before: 1,
  after: 2,
} as const;

// @ts-expect-error a Column Identity is correlated with its exact source field.
const invalidCrossedSaveCellAssignment: AstryxTableSaveCellChange<Order, Columns> =
  invalidCrossedSaveCell;

const widenedColumns: AstryxTableColumns<Order> = columns;
const invalidWidenedSaveCell = {
  columnId: "COL_ID_PRICE",
  field: "price",
  before: "not a number",
  after: "still not a number",
} as const;

// @ts-expect-error widened columns retain field/value correlation for runtime validation.
const invalidWidenedSaveCellAssignment: AstryxTableSaveCellChange<Order, typeof widenedColumns> =
  invalidWidenedSaveCell;

// @ts-expect-error a Save Change Set is never empty.
const invalidEmptySaveChangeSet = [] satisfies AstryxTableSaveChangeSet<Order, Columns, bigint>;

// @ts-expect-error a row Save Cell Change Set is never empty.
const invalidEmptySaveCellChangeSet = [] satisfies AstryxTableSaveChangeSet<
  Order,
  Columns,
  bigint
>[number]["changes"];

const clientWithoutInitialOrderBy = {
  tableId: "orders",
  columns,
  getRowId: (row: Order) => row.id,
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} as const;

// @ts-expect-error every table requires a non-empty Initial Order By baseline.
const invalidClientWithoutInitialOrderBy: AstryxTableClientProps<Order, Columns> =
  clientWithoutInitialOrderBy;

const serverWithoutInitialOrderBy = {
  tableId: "orders",
  columns,
  viewportSource: orderViewportSource,
} as const;

// @ts-expect-error every Server Table requires a non-empty Initial Order By baseline.
const invalidServerWithoutInitialOrderBy: AstryxTableServerProps<
  Order,
  Columns,
  typeof orderViewportSource.viewport
> = serverWithoutInitialOrderBy;
void invalidServerWithoutInitialOrderBy;

// @ts-expect-error exported Common props also require a non-empty Initial Order By baseline.
const invalidCommonWithoutInitialOrderBy: AstryxTableCommonProps<Order, Columns> = {
  tableId: "orders",
  columns,
};
void invalidCommonWithoutInitialOrderBy;

const invalidInitialOrderByWithoutSortingCapability = {
  tableId: "unsortable-orders",
  columns: noSortingColumns,
  // @ts-expect-error every table requires a sortable Column Identity for Initial Order By.
  initialOrderBy: [{ columnId: "COL_ID_SYMBOL", direction: "asc" }],
  getRowId: (row: Order) => row.id,
  clientSource: {
    rows: [] as readonly Order[],
    totalRows: 0,
    version: 1,
    status: "ready",
  },
} satisfies AstryxTableClientProps<Order, NoSortingColumns>;

const invalidServerWithoutSortingCapability = {
  tableId: "unsortable-orders",
  columns: noSortingColumns,
  initialOrderBy: [
    // @ts-expect-error every Server Table requires a sortable Column Identity.
    { columnId: "COL_ID_SYMBOL", direction: "asc" },
  ],
  viewportSource: orderViewportSource,
} satisfies AstryxTableServerProps<Order, NoSortingColumns, typeof orderViewportSource.viewport>;
void invalidServerWithoutSortingCapability;

const invalidCommonWithoutSortingCapability = {
  tableId: "unsortable-orders",
  columns: noSortingColumns,
  initialOrderBy: [
    // @ts-expect-error public Common props reject definitions without a sortable Column Identity.
    { columnId: "COL_ID_SYMBOL", direction: "asc" },
  ],
} satisfies AstryxTableCommonProps<Order, NoSortingColumns>;
void invalidCommonWithoutSortingCapability;

const invalidNumberHelperField = [
  AstryxTableNumberColumn({
    columnId: "COL_ID_SYMBOL",
    // @ts-expect-error the Number helper cannot target a string field.
    field: "symbol",
    headerName: "Symbol",
  }),
] satisfies AstryxTableColumns<HelperRow>;

const invalidHelperWithoutColumnId = [
  // @ts-expect-error every helper invocation still requires an explicit Column Identity.
  AstryxTableTextColumn({ field: "symbol", headerName: "Symbol" }),
] satisfies AstryxTableColumns<HelperRow>;

const invalidIdentityPreset = AstryxTableNumberColumn.withDefaults({
  headerName: "Price",
  // @ts-expect-error a reusable preset can never own Column Identity.
  columnId: "COL_ID_PRICE",
});

const invalidFieldPreset = AstryxTableNumberColumn.withDefaults({
  headerName: "Price",
  // @ts-expect-error a reusable preset can never own server field mapping.
  field: "price",
});

const invalidValueTypePreset = AstryxTableNumberColumn.withDefaults({
  headerName: "Price",
  // @ts-expect-error a reusable preset cannot replace a helper's exact Value Type.
  valueType: "text",
});

const invalidUnknownPresetOption = AstryxTableNumberColumn.withDefaults({
  headerName: "Price",
  // @ts-expect-error presets reject configuration outside their explicit surface.
  mysteryOption: true,
});

const strictPricePreset = AstryxTableNumberColumn.withDefaults({ headerName: "Price" });
const invalidPresetInvocationWithoutColumnId = strictPricePreset({
  // @ts-expect-error the final preset invocation still requires Column Identity.
  field: "price",
});

const invalidNumberHelperValueType = AstryxTableNumberColumn({
  columnId: "COL_ID_PRICE",
  // @ts-expect-error a Number helper cannot be changed into another Value Type.
  field: "price",
  headerName: "Price",
  valueType: "text",
});

const narrowPriceFormatter = ({
  row,
  value,
}: {
  readonly row: HelperRow & { readonly secret: string };
  readonly value: number;
}) => `${row.secret}:${value}`;

const invalidNarrowPresentationCallback = [
  // @ts-expect-error AstryxTable may pass any HelperRow, not a narrower row subtype.
  {
    columnId: "COL_ID_PRICE",
    field: "price",
    headerName: "Price",
    valueType: "number",
    valueFormatter: narrowPriceFormatter,
  },
] satisfies AstryxTableColumns<HelperRow>;

type MixedAmountRow = { readonly amount: ExactAmount | { readonly major: number } };
const invalidNarrowCustomValueType = [
  // @ts-expect-error a custom Value Type must accept the field's complete exact value domain.
  {
    columnId: "COL_ID_AMOUNT",
    field: "amount",
    headerName: "Amount",
    valueType: exactAmountValueType,
  },
] satisfies AstryxTableColumns<MixedAmountRow>;

const invalidHelperComputedDependency = [
  AstryxTableNumberColumn({
    columnId: "COL_ID_WEIGHTED_PRICE",
    fields: ["price", "multiplier"],
    headerName: "Weighted price",
    valueGetter: ({ row }) => {
      // @ts-expect-error only declared dependencies exist in a Computed getter row.
      void row.status;
      return row.price * row.multiplier;
    },
  }),
] satisfies AstryxTableColumns<HelperRow>;

const invalidCustomComputedDependency = [
  AstryxTableComputedColumn({
    columnId: "COL_ID_AMOUNT_COPY",
    fields: ["amount"],
    headerName: "Amount copy",
    valueType: exactAmountValueType,
    valueGetter: ({ row }) => {
      // @ts-expect-error custom Computed Columns expose only declared dependencies.
      void row.otherAmount;
      return row.amount;
    },
  }),
] satisfies AstryxTableColumns<AmountRow>;

const invalidIncompleteSelectDomain = [
  AstryxTableSelectColumn({
    columnId: "COL_ID_STATUS",
    // @ts-expect-error Select options must cover the field's exact non-nullish value domain.
    field: "status",
    headerName: "Status",
    options: ["open"],
  }),
] satisfies AstryxTableColumns<HelperRow>;

const invalidCustomNumericOperand = [
  // @ts-expect-error a custom numeric Value Type retains its exact operand domain.
  { columnId: "COL_ID_AMOUNT", type: "greaterThan", filter: 10 },
] satisfies AstryxTableFilterExpressions<AmountRow, typeof customValueColumns>;

type NullableEditRow = Readonly<{
  readonly id: string;
  readonly nullable: number | null;
  readonly optional: number | undefined;
  readonly ambiguous: number | null | undefined;
  readonly required: number;
}>;
const nullableEditColumns = [
  {
    columnId: "COL_ID_NULLABLE",
    field: "nullable",
    headerName: "Nullable",
    valueType: "number",
    isEditable: true,
    blankValue: null,
  },
  {
    columnId: "COL_ID_OPTIONAL",
    field: "optional",
    headerName: "Optional",
    valueType: "number",
    isEditable: true,
    blankValue: undefined,
  },
  {
    columnId: "COL_ID_AMBIGUOUS",
    field: "ambiguous",
    headerName: "Ambiguous",
    valueType: "number",
    isEditable: true,
    blankValue: undefined,
  },
  {
    columnId: "COL_ID_REQUIRED",
    field: "required",
    headerName: "Required",
    valueType: "number",
    isEditable: true,
  },
] satisfies AstryxTableColumns<NullableEditRow>;

type NullableChoiceEditRow = Readonly<{
  readonly id: string;
  readonly flag: boolean | null;
  readonly nullableChoice: "" | "ready" | null;
  readonly requiredChoice: "" | "ready";
}>;
const nullableChoiceEditColumns = [
  {
    columnId: "COL_ID_FLAG",
    field: "flag",
    headerName: "Flag",
    valueType: "boolean",
    isEditable: true,
    blankValue: null,
  },
  AstryxTableSelectColumn({
    columnId: "COL_ID_NULLABLE_CHOICE",
    field: "nullableChoice",
    headerName: "Nullable choice",
    options: ["", "ready"],
    isEditable: true,
    blankValue: null,
  }),
  AstryxTableSelectColumn({
    columnId: "COL_ID_REQUIRED_CHOICE",
    field: "requiredChoice",
    headerName: "Required choice",
    options: ["", "ready"],
    isEditable: true,
  }),
] satisfies AstryxTableColumns<NullableChoiceEditRow>;
void nullableChoiceEditColumns;
const invalidNullableEditColumns = [
  // @ts-expect-error editable nullable fields require their exact blank representation.
  {
    columnId: "COL_ID_NULLABLE",
    field: "nullable",
    headerName: "Nullable",
    valueType: "number",
    isEditable: true,
    blankValue: undefined,
  },
  // @ts-expect-error non-nullish fields cannot declare a blank representation.
  {
    columnId: "COL_ID_REQUIRED",
    field: "required",
    headerName: "Required",
    valueType: "number",
    isEditable: true,
    blankValue: null,
  },
] satisfies AstryxTableColumns<NullableEditRow>;
const invalidMissingNullableBlankColumns = [
  // @ts-expect-error editable null fields require an explicit blank representation.
  {
    columnId: "COL_ID_NULLABLE",
    field: "nullable",
    headerName: "Nullable",
    valueType: "number",
    isEditable: true,
  },
  // @ts-expect-error editable undefined fields require an explicit blank representation.
  {
    columnId: "COL_ID_OPTIONAL",
    field: "optional",
    headerName: "Optional",
    valueType: "number",
    isEditable: true,
  },
  // @ts-expect-error ambiguous nullish fields require an explicit consumer choice.
  {
    columnId: "COL_ID_AMBIGUOUS",
    field: "ambiguous",
    headerName: "Ambiguous",
    valueType: "number",
    isEditable: true,
  },
] satisfies AstryxTableColumns<NullableEditRow>;
const invalidMissingNullableBlankHelperColumns = [
  AstryxTableNumberColumn({
    columnId: "COL_ID_NULLABLE",
    // @ts-expect-error Number Helper cannot infer a nullable editable field without blankValue.
    field: "nullable",
    headerName: "Nullable",
    // @ts-expect-error Number Helper rejects nullable editability without blankValue.
    isEditable: true,
  }),
  AstryxTableNumberColumn({
    columnId: "COL_ID_OPTIONAL",
    // @ts-expect-error Number Helper cannot infer an optional editable field without blankValue.
    field: "optional",
    headerName: "Optional",
    // @ts-expect-error Number Helper rejects optional editability without blankValue.
    isEditable: true,
  }),
  AstryxTableNumberColumn({
    columnId: "COL_ID_AMBIGUOUS",
    // @ts-expect-error Number Helper cannot infer an ambiguous editable field without blankValue.
    field: "ambiguous",
    headerName: "Ambiguous",
    // @ts-expect-error Number Helper rejects ambiguous editability without blankValue.
    isEditable: true,
  }),
] satisfies AstryxTableColumns<NullableEditRow>;
const invalidStaticFalseBlankColumns = [
  // @ts-expect-error literal static-false editability cannot declare an edit blank policy.
  {
    columnId: "COL_ID_NULLABLE",
    field: "nullable",
    headerName: "Nullable",
    valueType: "number",
    isEditable: false,
    blankValue: null,
  },
] satisfies AstryxTableColumns<NullableEditRow>;
const invalidStaticFalseBlankHelperColumns = [
  AstryxTableNumberColumn({
    columnId: "COL_ID_NULLABLE",
    // @ts-expect-error Column Helpers cannot infer a compatible field for this invalid capability.
    field: "nullable",
    headerName: "Nullable",
    // @ts-expect-error Column Helpers reject literal static-false editability with blank policy.
    isEditable: false,
    // @ts-expect-error Column Helpers reject a blank policy without potential editability.
    blankValue: null,
  }),
] satisfies AstryxTableColumns<NullableEditRow>;
const widenedEditablePolicy: boolean = Math.random() > 0.5;
const widenedRequiredEditColumns = [
  {
    columnId: "COL_ID_REQUIRED",
    field: "required",
    headerName: "Required",
    valueType: "number",
    isEditable: widenedEditablePolicy,
  },
] as const satisfies AstryxTableColumns<NullableEditRow>;
const widenedOnlyEditableClientProps = {
  tableId: "widened-only-editability",
  columns: widenedRequiredEditColumns,
  initialOrderBy: [{ columnId: "COL_ID_REQUIRED", direction: "asc" }],
  getRowId: (row: NullableEditRow) => row.id,
  editable: true,
  getRowVersion: () => 1n,
  onSaveEdits: () => Promise.resolve(),
  clientSource: { rows: [], totalRows: 0, version: 1, status: "ready" },
} as const;
// @ts-expect-error widened boolean alone cannot prove the Table-level editable capability.
const invalidWidenedOnlyEditableClient: AstryxTableClientProps<
  NullableEditRow,
  typeof widenedRequiredEditColumns,
  bigint
> = widenedOnlyEditableClientProps;
const invalidWidenedNullableEditColumns = [
  // @ts-expect-error nullable widened booleans cannot choose an exact blank representation.
  {
    columnId: "COL_ID_NULLABLE",
    field: "nullable",
    headerName: "Nullable",
    valueType: "number",
    isEditable: widenedEditablePolicy,
  },
  // @ts-expect-error nullable widened booleans cannot safely pair with blankValue in plain arrays.
  {
    columnId: "COL_ID_OPTIONAL",
    field: "optional",
    headerName: "Optional",
    valueType: "number",
    isEditable: widenedEditablePolicy,
    blankValue: undefined,
  },
] satisfies AstryxTableColumns<NullableEditRow>;

type ExactToggle = "N" | "Y";
const exactToggleValueType = {
  codecId: "example/toggle",
  codecVersion: 1,
  filterFamily: "equality",
  editorFamily: "boolean",
  booleanEditorValues: ["N", "Y"],
  cellAlign: "center",
  editorLayout: "center",
  defaultWidth: 88,
  decodeRuntime: (input: unknown) =>
    input === "N" || input === "Y"
      ? { _tag: "Success" as const, value: input }
      : { _tag: "Failure" as const, message: "Expected N or Y." },
  equivalent: (left: ExactToggle, right: ExactToggle) => left === right,
  compare: (left: ExactToggle, right: ExactToggle) => (left === right ? 0 : left === "N" ? -1 : 1),
  formatCanonicalText: (value: ExactToggle) => value,
  parseCanonicalText: (text: string) =>
    text === "N" || text === "Y"
      ? { _tag: "Success" as const, value: text }
      : { _tag: "Failure" as const, message: "Expected N or Y." },
  formatDisplay: (value: ExactToggle) => value,
  encodePersisted: (value: ExactToggle) => value,
  decodePersisted: (input: unknown) =>
    input === "N" || input === "Y"
      ? { _tag: "Success" as const, value: input }
      : { _tag: "Failure" as const, message: "Expected N or Y." },
} satisfies AstryxTableValueType<ExactToggle, "equality", "boolean">;
const { booleanEditorValues: omittedToggleEditorValues, ...toggleWithoutEditorValues } =
  exactToggleValueType;
void omittedToggleEditorValues;
// @ts-expect-error custom Boolean editors require an exact false/true domain mapping.
const invalidToggleValueType: AstryxTableValueType<ExactToggle, "equality", "boolean"> =
  toggleWithoutEditorValues;

void invalidColumnIds;
void invalidField;
void ambiguousColumn;
void missingHeaderName;
void invalidValueType;
void invalidCapabilityFlags;
void invalidComputedDependency;
void invalidEmptyComputedDependencies;
void invalidNumericFilter;
void invalidNumericSensitivity;
void invalidBooleanSensitivity;
void acceptedBooleanSetFilter;
void acceptedSelectSetFilter;
void invalidDefaultTextSetFilter;
void invalidDefaultNumberSetFilter;
void invalidSetFilterCapability;
void invalidEmptyInFilter;
void acceptedTextInFilter;
void acceptedNumericInFilter;
void invalidComputedFilter;
void invalidOptedOutFilter;
void invalidMixedColumnCompoundFilter;
void invalidSort;
void invalidOptedOutSort;
void invalidNoCapabilitySort;
void invalidEmptySort;
void invalidPaginatedClient;
void invalidPaginatedServer;
void invalidClientWithoutRowId;
void invalidServerWithRowId;
void invalidServerEditing;
void invalidEditableClientWithoutSave;
void invalidReadOnlyClientWithSave;
void invalidClientWithoutEditableColumns;
void invalidEditableClientWithGrouping;
void invalidCrossedSaveCell;
void invalidCrossedSaveCellAssignment;
void invalidWidenedSaveCell;
void invalidWidenedSaveCellAssignment;
void invalidEmptySaveChangeSet;
void invalidEmptySaveCellChangeSet;
void invalidClientWithoutInitialOrderBy;
void invalidInitialOrderByWithoutSortingCapability;
void invalidNumberHelperField;
void invalidHelperWithoutColumnId;
void invalidIdentityPreset;
void invalidFieldPreset;
void invalidValueTypePreset;
void invalidUnknownPresetOption;
void invalidPresetInvocationWithoutColumnId;
void invalidNumberHelperValueType;
void invalidNarrowPresentationCallback;
void invalidNarrowCustomValueType;
void invalidHelperComputedDependency;
void invalidCustomComputedDependency;
void invalidIncompleteSelectDomain;
void invalidCustomNumericOperand;
void nullableEditColumns;
void invalidNullableEditColumns;
void invalidStaticFalseBlankColumns;
void invalidStaticFalseBlankHelperColumns;
void widenedRequiredEditColumns;
void invalidWidenedOnlyEditableClient;
void invalidWidenedNullableEditColumns;
void invalidMissingNullableBlankColumns;
void invalidMissingNullableBlankHelperColumns;
void exactToggleValueType;
void invalidToggleValueType;
