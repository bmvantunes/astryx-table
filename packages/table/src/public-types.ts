import type {
  LiveQueryViewportBaseRow,
  LiveQueryViewportCompleteRawSelect,
  LiveQueryViewportQueryAuthority,
  LiveQueryViewportRouteBy,
  LiveQueryViewportWhere,
} from "effect-view-server/react/viewport-base-row";
import type { ReactNode } from "react";

import type { AstryxTableColumnHelperProvenanceCarrier } from "./internal/column-helper-provenance";

type ColumnIdFirstCharacter =
  | "_"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

type ColumnIdWhitespace =
  | "\t"
  | "\n"
  | "\v"
  | "\f"
  | "\r"
  | " "
  | "\u00a0"
  | "\u1680"
  | "\u2000"
  | "\u2001"
  | "\u2002"
  | "\u2003"
  | "\u2004"
  | "\u2005"
  | "\u2006"
  | "\u2007"
  | "\u2008"
  | "\u2009"
  | "\u200a"
  | "\u2028"
  | "\u2029"
  | "\u202f"
  | "\u205f"
  | "\u3000"
  | "\ufeff";
type ColumnIdPattern = `COL_ID_${ColumnIdFirstCharacter}${Uppercase<string>}`;
type AstryxTableRowsSystemColumnId = "COL_ID_ASTRYX_TABLE_ROWS";
type AstryxTableReservedColumnId = AstryxTableRowsSystemColumnId | "COL_ID_ASTRYX_TABLE_ROW_SELECTION";

export type AstryxTableColumnId<TColumnId extends ColumnIdPattern = ColumnIdPattern> =
  TColumnId extends AstryxTableReservedColumnId
    ? never
    : TColumnId extends `${string}${ColumnIdWhitespace}${string}`
      ? never
      : TColumnId;

/** @internal Applies literal Column Identity validation at inference boundaries. */
export type AstryxTableColumnIdentityInput<TOptions> = TOptions extends {
  readonly columnId: infer TColumnId extends ColumnIdPattern;
}
  ? { readonly columnId: AstryxTableColumnId<TColumnId> }
  : unknown;

export type AstryxTableRowId = string;

export type AstryxTableBuiltInValueType = "text" | "number" | "bigint" | "boolean";

export type AstryxTableOrdering = -1 | 0 | 1;

export type AstryxTableAggFunc = "countDistinct" | "sum" | "min" | "max" | "avg";

export type AstryxTableAggregateResultKind = "self" | "bigint";

export type AstryxTableAggregateResults = Readonly<{
  readonly countDistinct?: "bigint";
  readonly sum?: "self";
  readonly min?: "self";
  readonly max?: "self";
  readonly avg?: "self";
}>;

const astryxTableAggregateAlgebraBrand: unique symbol = Symbol("AstryxTableAggregateAlgebra");

const astryxTableServerBigDecimalValueTypes = new WeakSet<object>();

/** @internal Nominal authority installed only by the optional Effect entry point. */
export declare class AstryxTableServerBigDecimalValueTypeAuthority {
  private readonly astryxTableServerBigDecimalValueTypeAuthority;
}

/** @internal Brands the one source-compatible Effect BigDecimal descriptor. */
export function AstryxTableServerBigDecimalValueType<TValueType extends object>(
  valueType: TValueType,
): TValueType & AstryxTableServerBigDecimalValueTypeAuthority {
  astryxTableServerBigDecimalValueTypes.add(valueType);
  return Object.freeze(valueType) as TValueType & AstryxTableServerBigDecimalValueTypeAuthority;
}

/** @internal Tests runtime source-compatible aggregate authority without trusting public data. */
export function isAstryxTableServerBigDecimalValueType(
  valueType: unknown,
): valueType is AstryxTableServerBigDecimalValueTypeAuthority {
  return (
    typeof valueType === "object" &&
    valueType !== null &&
    astryxTableServerBigDecimalValueTypes.has(valueType)
  );
}

/** Exact arithmetic owned by a custom Value Type rather than a Column Definition. */
export type AstryxTableAggregateAlgebra<TValue> = Readonly<{
  readonly [astryxTableAggregateAlgebraBrand]: true;
  readonly add: (this: void, left: TValue, right: TValue) => TValue;
  readonly divideByCount?: (this: void, total: TValue, count: bigint) => TValue;
}>;

type AstryxTableAggregateAlgebraInput<TValue> = Readonly<{
  readonly add: (this: void, left: TValue, right: TValue) => TValue;
  readonly divideByCount?: (this: void, total: TValue, count: bigint) => TValue;
}>;

/** Brands and snapshots one exact Value-Type aggregate algebra. */
export function AstryxTableAggregateAlgebra<TValue>(
  algebra: AstryxTableAggregateAlgebraInput<TValue> &
    Required<Pick<AstryxTableAggregateAlgebraInput<TValue>, "divideByCount">>,
): AstryxTableAggregateAlgebra<TValue> &
  Required<Pick<AstryxTableAggregateAlgebra<TValue>, "divideByCount">>;
export function AstryxTableAggregateAlgebra<TValue>(
  algebra: AstryxTableAggregateAlgebraInput<TValue>,
): AstryxTableAggregateAlgebra<TValue>;
export function AstryxTableAggregateAlgebra<TValue>(
  algebra: AstryxTableAggregateAlgebraInput<TValue>,
): AstryxTableAggregateAlgebra<TValue> {
  if (typeof algebra !== "object" || algebra === null || Array.isArray(algebra)) {
    throw new TypeError("AstryxTable Aggregate Algebra must be an object.");
  }
  const add = ownDataFunction(algebra, "add");
  const divideByCount = ownOptionalDataFunction(algebra, "divideByCount");
  if (add === undefined) {
    throw new TypeError("AstryxTable Aggregate Algebra requires an exact add operation.");
  }
  const snapshot = { add, ...(divideByCount === undefined ? {} : { divideByCount }) };
  Object.defineProperty(snapshot, astryxTableAggregateAlgebraBrand, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return Object.freeze(snapshot) as AstryxTableAggregateAlgebra<TValue>;
}

function ownDataFunction(
  value: object,
  key: "add",
): ((this: void, ...parameters: never[]) => unknown) | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "function"
    ? descriptor.value
    : undefined;
}

function ownOptionalDataFunction(
  value: object,
  key: "divideByCount",
): ((this: void, ...parameters: never[]) => unknown) | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return undefined;
  return "value" in descriptor && typeof descriptor.value === "function"
    ? descriptor.value
    : undefined;
}

export type AstryxTableDecodeResult<TValue> =
  | { readonly _tag: "Success"; readonly value: TValue }
  | { readonly _tag: "Failure"; readonly message: string };

export type AstryxTableJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AstryxTableJsonValue[]
  | { readonly [key: string]: AstryxTableJsonValue };

export type AstryxTableFilterFamily = "boolean" | "equality" | "numeric" | "select" | "text";

export type AstryxTableEditorFamily =
  | "bigdecimal"
  | "bigint"
  | "boolean"
  | "number"
  | "select"
  | "text";

export type AstryxTableCellAlign = "start" | "center" | "end";

export type AstryxTableEditorLayout = "inline" | "center" | "fullWidth";

export type AstryxTableNumberFormat = Intl.NumberFormatOptions;

/**
 * One explicit runtime value domain. AstryxTable snapshots this descriptor into a private compiled
 * plan during column normalization; mounted cells never discover or dispatch value kinds.
 */
type AstryxTableEditorCapability<
  TValue,
  TEditorFamily extends Exclude<AstryxTableEditorFamily, "select">,
> = TEditorFamily extends "boolean"
  ? {
      readonly editorFamily: "boolean";
      /** Exact false-state and true-state values used by the native Boolean editor. */
      readonly booleanEditorValues: readonly [falseValue: TValue, trueValue: TValue];
    }
  : {
      readonly editorFamily: TEditorFamily;
      readonly booleanEditorValues?: never;
    };

export type AstryxTableValueType<
  TValue,
  TFilterFamily extends AstryxTableFilterFamily = AstryxTableFilterFamily,
  TEditorFamily extends Exclude<AstryxTableEditorFamily, "select"> = Exclude<
    AstryxTableEditorFamily,
    "select"
  >,
  TAggregateResults extends AstryxTableAggregateResults = never,
> = {
  readonly codecId: string;
  readonly codecVersion: number;
  readonly filterFamily: TFilterFamily;
  readonly cellAlign: AstryxTableCellAlign;
  readonly editorLayout: AstryxTableEditorLayout;
  readonly defaultWidth: number;
  readonly decodeRuntime: (this: void, input: unknown) => AstryxTableDecodeResult<TValue>;
  /** Must agree exactly with both zero ordering and canonical-text identity. */
  readonly equivalent: (this: void, left: TValue, right: TValue) => boolean;
  /** Must return zero exactly when `equivalent(left, right)` is true. */
  readonly compare: (this: void, left: TValue, right: TValue) => AstryxTableOrdering;
  /** Must return equal text exactly when two values are semantically equivalent. */
  readonly formatCanonicalText: (this: void, value: TValue) => string;
  readonly parseCanonicalText: (this: void, text: string) => AstryxTableDecodeResult<TValue>;
  readonly formatDisplay: (this: void, value: TValue) => string;
  readonly encodePersisted: (this: void, value: TValue) => AstryxTableJsonValue;
  readonly decodePersisted: (this: void, input: unknown) => AstryxTableDecodeResult<TValue>;
} & AstryxTableEditorCapability<TValue, TEditorFamily> &
  ([TAggregateResults] extends [never]
    ? InferredAggregateCapability<TValue>
    : AggregateAlgebraRequirement<TValue, TAggregateResults> &
        ([keyof TAggregateResults] extends [never]
          ? { readonly aggregateResults?: TAggregateResults }
          : { readonly aggregateResults: TAggregateResults }));

type NonArithmeticAggregateResults = Readonly<{
  readonly countDistinct?: "bigint";
  readonly min?: "self";
  readonly max?: "self";
  readonly sum?: never;
  readonly avg?: never;
}>;

type SumAggregateResults = Readonly<{
  readonly countDistinct?: "bigint";
  readonly sum: "self";
  readonly min?: "self";
  readonly max?: "self";
  readonly avg?: never;
}>;

type AverageAggregateResults = Readonly<{
  readonly countDistinct?: "bigint";
  readonly sum?: "self";
  readonly min?: "self";
  readonly max?: "self";
  readonly avg: "self";
}>;

type InferredAggregateCapability<TValue> =
  | {
      readonly aggregateResults?: never;
      readonly aggregateAlgebra?: AstryxTableAggregateAlgebra<TValue>;
    }
  | {
      readonly aggregateResults: NonArithmeticAggregateResults;
      readonly aggregateAlgebra?: AstryxTableAggregateAlgebra<TValue>;
    }
  | {
      readonly aggregateResults: SumAggregateResults;
      readonly aggregateAlgebra: AstryxTableAggregateAlgebra<TValue>;
    }
  | {
      readonly aggregateResults: AverageAggregateResults;
      readonly aggregateAlgebra: AstryxTableAggregateAlgebra<TValue> &
        Required<Pick<AstryxTableAggregateAlgebra<TValue>, "divideByCount">>;
    };

type AggregateAlgebraRequirement<
  TValue,
  TAggregateResults extends AstryxTableAggregateResults,
> = "avg" extends keyof TAggregateResults
  ? {
      readonly aggregateAlgebra: AstryxTableAggregateAlgebra<TValue> &
        Required<Pick<AstryxTableAggregateAlgebra<TValue>, "divideByCount">>;
    }
  : "sum" extends keyof TAggregateResults
    ? { readonly aggregateAlgebra: AstryxTableAggregateAlgebra<TValue> }
    : {};

export type AstryxTableValueTypeValue<TValueType> = TValueType extends {
  readonly decodeRuntime: (this: void, input: unknown) => AstryxTableDecodeResult<infer TValue>;
}
  ? TValue
  : never;

export type AstryxTableSourceStatus = "loading" | "ready" | "stale" | "closed" | "error";

export type AstryxTableSourceRetry = {
  readonly run: (this: void) => void;
  readonly pending: boolean;
};

export type AstryxTableSourceChrome = {
  readonly totalRows: number;
  readonly version: number;
  readonly status: AstryxTableSourceStatus;
  readonly statusCode?: string | undefined;
  readonly message?: string | undefined;
  readonly retry?: AstryxTableSourceRetry | undefined;
};

export type AstryxTableClientSource<TRow> = AstryxTableSourceChrome & {
  readonly rows: readonly TRow[];
};

/**
 * The lifecycle envelope returned by a long-lived server viewport hook.
 *
 * `TViewport` stays opaque at the public interface. The private server adapter is responsible for
 * narrowing it to the transport it supports; consumers never depend on rendering-engine state or
 * types.
 */
export type AstryxTableServerSource<TViewport = unknown> = AstryxTableSourceChrome & {
  readonly viewport: TViewport;
  /** Source-owned whole-result hook used only while a Server Set Filter overlay is open. */
  readonly useWholeResult: (...arguments_: never[]) => unknown;
  readonly completeRawSelect: LiveQueryViewportCompleteRawSelect<TViewport>;
};

type FieldKey<TRow> = Extract<keyof TRow, string>;

type NonNullish<TValue> = Exclude<TValue, null | undefined>;

type NonEmptyFields<TRow> = readonly [FieldKey<TRow>, ...FieldKey<TRow>[]];

type ValueForBuiltInType<TValueType extends AstryxTableBuiltInValueType> = TValueType extends "text"
  ? string
  : TValueType extends "number"
    ? number
    : TValueType extends "bigint"
      ? bigint
      : boolean;

type ValueParams<TRow, TValue> = {
  readonly row: TRow;
  readonly value: TValue;
};

type GroupKeyCallback<
  TValue,
  TColumnId extends AstryxTableColumnId,
  TField extends string,
  TResult,
> = (parameters: AstryxTableGroupKeyCellParams<TValue, TColumnId, TField>) => TResult;

type AggregateCallback<
  TValue,
  TColumnId extends AstryxTableColumnId,
  TField extends string,
  TAggFunc extends AstryxTableAggFunc,
  TResult,
> = (parameters: AstryxTableAggregateCellParams<TAggFunc, TValue, TColumnId, TField>) => TResult;

export type AstryxTableGroupKeyPresence<TValue> =
  | Readonly<{ readonly _tag: "Missing" }>
  | Readonly<{ readonly _tag: "Present"; readonly value: TValue }>;

type RowGroupKeyValue<TRow> = {
  readonly [TField in FieldKey<TRow>]: [NonNullish<TRow[TField]>] extends [never]
    ? never
    : {
        readonly columnId: AstryxTableColumnId;
        readonly field: TField;
      } & AstryxTableGroupKeyPresence<TRow[TField]>;
}[FieldKey<TRow>];

type DefinedGroupKeyValue<
  TRow,
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = TColumns[number] extends infer TColumn
  ? TColumn extends {
      readonly columnId: infer TColumnId extends AstryxTableColumnId;
      readonly field: infer TField extends FieldKey<TRow>;
      readonly groupBy: true;
    }
    ? {
        readonly columnId: TColumnId;
        readonly field: TField;
      } & AstryxTableGroupKeyPresence<TRow[TField]>
    : never
  : never;

export type AstryxTableGroupKeyValue<
  TRow,
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[] | undefined = undefined,
> = TColumns extends readonly { readonly columnId: AstryxTableColumnId }[]
  ? DefinedGroupKeyValue<TRow, TColumns>
  : RowGroupKeyValue<TRow>;

export type AstryxTableGroupKeyValues<
  TRow,
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = readonly AstryxTableGroupKeyValue<TRow, TColumns>[];

export type AstryxTableRowsCellParams<
  TRow,
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = {
  readonly columnId: AstryxTableRowsColumnId;
  readonly value: bigint;
  readonly groupKeys: AstryxTableGroupKeyValues<TRow, TColumns>;
};

export type AstryxTableGroupRowsColumnOptions<
  TRow,
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = {
  readonly headerName?: string;
  readonly width?: number;
  readonly valueFormatter?: (parameters: AstryxTableRowsCellParams<TRow, TColumns>) => string;
  readonly cellClassName?:
    | string
    | ((parameters: AstryxTableRowsCellParams<TRow, TColumns>) => string | undefined);
  readonly cellRenderer?: (parameters: AstryxTableRowsCellParams<TRow, TColumns>) => ReactNode;
};

export type AstryxTableGroupKeyCellParams<
  TValue,
  TColumnId extends AstryxTableColumnId,
  TField extends string = string,
> = {
  readonly columnId: TColumnId;
  readonly field: TField;
  readonly value: TValue;
  readonly rowCount: bigint;
};

export type AstryxTableAggregateCellParams<
  TAggFunc extends AstryxTableAggFunc,
  TValue,
  TColumnId extends AstryxTableColumnId,
  TField extends string = string,
> = {
  readonly columnId: TColumnId;
  readonly field: TField;
  readonly aggFunc: TAggFunc;
  readonly value: TValue;
  readonly rowCount: bigint;
};

type GroupKeyPresentation<TValue, TColumnId extends AstryxTableColumnId, TField extends string> =
  | {
      readonly groupBy?: false | undefined;
      readonly groupKeyValueFormatter?: never;
      readonly groupKeyCellClassName?: never;
      readonly groupKeyCellRenderer?: never;
    }
  | {
      readonly groupBy: true;
      readonly groupKeyValueFormatter?: GroupKeyCallback<TValue, TColumnId, TField, string>;
      readonly groupKeyCellClassName?:
        | string
        | GroupKeyCallback<TValue, TColumnId, TField, string | undefined>;
      readonly groupKeyCellRenderer?: GroupKeyCallback<TValue, TColumnId, TField, ReactNode>;
    };

type BuiltInAggregateResults<TValueType extends AstryxTableBuiltInValueType> =
  TValueType extends "bigint"
    ? {
        readonly countDistinct: "bigint";
        readonly sum: "self";
        readonly min: "self";
        readonly max: "self";
      }
    : {
        readonly countDistinct: "bigint";
        readonly min: "self";
        readonly max: "self";
      };

type AggregateResultsFor<TValue, TValueType> = Omit<
  TValueType extends AstryxTableBuiltInValueType
    ? BuiltInAggregateResults<TValueType>
    : TValueType extends {
          readonly aggregateResults?: infer TAggregateResults extends AstryxTableAggregateResults;
        }
      ? TAggregateResults
      : {},
  [TValue] extends [NonNullish<TValue>] ? never : "sum" | "avg"
>;

type AggregateResultValue<TValue, TResultKind> = TResultKind extends "self"
  ? TValue
  : TResultKind extends "bigint"
    ? bigint
    : never;

type AggregatePresentationBranch<
  TValue,
  TColumnId extends AstryxTableColumnId,
  TField extends string,
  TAggFunc extends AstryxTableAggFunc,
  TResultKind extends AstryxTableAggregateResultKind,
> = {
  readonly aggFunc: TAggFunc;
  readonly aggregateValueFormatter?: AggregateCallback<
    AggregateResultValue<TValue, TResultKind>,
    TColumnId,
    TField,
    TAggFunc,
    string
  >;
  readonly aggregateCellClassName?:
    | string
    | AggregateCallback<
        AggregateResultValue<TValue, TResultKind>,
        TColumnId,
        TField,
        TAggFunc,
        string | undefined
      >;
  readonly aggregateCellRenderer?: AggregateCallback<
    AggregateResultValue<TValue, TResultKind>,
    TColumnId,
    TField,
    TAggFunc,
    ReactNode
  >;
};

type AggregatePresentation<
  TValue,
  TValueType,
  TColumnId extends AstryxTableColumnId,
  TField extends string,
> =
  | {
      readonly aggFunc?: never;
      readonly aggregateValueFormatter?: never;
      readonly aggregateCellClassName?: never;
      readonly aggregateCellRenderer?: never;
    }
  | {
      readonly [TAggFunc in Extract<
        keyof AggregateResultsFor<TValue, TValueType>,
        AstryxTableAggFunc
      >]: AggregatePresentationBranch<
        TValue,
        TColumnId,
        TField,
        TAggFunc,
        Extract<AggregateResultsFor<TValue, TValueType>[TAggFunc], AstryxTableAggregateResultKind>
      >;
    }[Extract<keyof AggregateResultsFor<TValue, TValueType>, AstryxTableAggFunc>];

type ColumnPresentation<TRow, TValue> = {
  readonly valueFormatter?: (parameters: ValueParams<TRow, TValue>) => string;
  readonly cellClassName?: string | ((parameters: ValueParams<TRow, TValue>) => string | undefined);
  readonly cellRenderer?: (parameters: ValueParams<TRow, TValue>) => ReactNode;
};

type ColumnLayout = {
  readonly width?: number;
  readonly cellAlign?: AstryxTableCellAlign;
  readonly editorLayout?: AstryxTableEditorLayout;
  readonly pinned?: "start" | "end";
};

type FieldColumnFilteringCapability =
  | {
      readonly enableFilter: false;
      readonly enableSetFilter?: never;
    }
  | {
      readonly enableFilter?: true;
      /** Enables the live Set Filter. Boolean and Select Field Columns default this to true. */
      readonly enableSetFilter?: boolean;
    };

type ValueGetterParams<TRow, TFields extends NonEmptyFields<TRow>> = {
  readonly row: Pick<TRow, TFields[number]>;
};

type EditableBlankRepresentation<TValue> = null extends TValue
  ? undefined extends TValue
    ? {
        /** Exact nullish value produced when an editor commits an empty candidate. */
        readonly blankValue: null | undefined;
      }
    : {
        /** Exact nullish value produced when an editor commits an empty candidate. */
        readonly blankValue: null;
      }
  : undefined extends TValue
    ? {
        /** Exact nullish value produced when an editor commits an empty candidate. */
        readonly blankValue: undefined;
      }
    : { readonly blankValue?: never };

/**
 * Plain structural arrays cannot admit a widened nullable boolean together with `blankValue`
 * without also admitting literal `false`. Nullable editability is therefore statically explicit.
 */
type NonPotentialFieldEditingCapability<TValue> = null extends TValue
  ? {
      readonly isEditable?: false;
      readonly blankValue?: never;
      readonly validate?: never;
    }
  : undefined extends TValue
    ? {
        readonly isEditable?: false;
        readonly blankValue?: never;
        readonly validate?: never;
      }
    : {
        /** A widened boolean remains runtime-defended but cannot prove Table edit capability. */
        readonly isEditable?: boolean;
        readonly blankValue?: never;
        readonly validate?: never;
      };

type FieldEditingCapability<TRow, TValue> =
  | NonPotentialFieldEditingCapability<TValue>
  | ({
      readonly isEditable: true | ((parameters: ValueParams<TRow, TValue>) => boolean);
      readonly validate?: (parameters: ValueParams<TRow, TValue>) => string | undefined;
    } & EditableBlankRepresentation<TValue>);

type FieldColumn<
  TRow,
  TField extends FieldKey<TRow>,
  TValueType extends AstryxTableBuiltInValueType | ErasedValueType,
  TColumnId extends AstryxTableColumnId = AstryxTableColumnId,
> = ColumnPresentation<TRow, TRow[TField]> &
  ColumnLayout & {
    readonly columnId: TColumnId;
    readonly field: TField;
    readonly headerName: string;
    readonly valueType: TValueType;
    readonly enableSorting?: boolean;
    readonly format?: TValueType extends "number" ? AstryxTableNumberFormat : never;
    readonly fields?: never;
    readonly valueGetter?: never;
  } & FieldEditingCapability<TRow, TRow[TField]> &
  FieldColumnFilteringCapability &
  GroupKeyPresentation<TRow[TField], TColumnId, TField> &
  AggregatePresentation<TRow[TField], TValueType, TColumnId, TField>;

type RawCustomFieldValueType<
  TValue,
  TAggregateResults extends AstryxTableAggregateResults = {},
> = AstryxTableValueType<
  NonNullish<TValue>,
  AstryxTableFilterFamily,
  Exclude<AstryxTableEditorFamily, "select">,
  TAggregateResults
>;

type RawCustomFieldColumnWithoutAggregate<TRow, TField extends FieldKey<TRow>> = Extract<
  FieldColumn<TRow, TField, RawCustomFieldValueType<TRow[TField]>>,
  { readonly aggFunc?: never }
>;

type RawCustomAggregatedFieldColumn<TRow, TField extends FieldKey<TRow>> = {
  readonly [TAggFunc in AstryxTableAggFunc]: {
    readonly [TResultKind in AstryxTableAggregateResultKind]: Extract<
      FieldColumn<
        TRow,
        TField,
        RawCustomFieldValueType<TRow[TField], Readonly<Record<TAggFunc, TResultKind>>>
      >,
      { readonly aggFunc: TAggFunc }
    >;
  }[AstryxTableAggregateResultKind];
}[AstryxTableAggFunc];

type FieldColumns<TRow> = {
  readonly [TField in FieldKey<TRow>]:
    | ([NonNullish<TRow[TField]>] extends [never]
        ? never
        : NonNullish<TRow[TField]> extends string
          ? FieldColumn<TRow, TField, "text">
          : never)
    | (NonNullish<TRow[TField]> extends number ? FieldColumn<TRow, TField, "number"> : never)
    | (NonNullish<TRow[TField]> extends bigint ? FieldColumn<TRow, TField, "bigint"> : never)
    | (NonNullish<TRow[TField]> extends boolean ? FieldColumn<TRow, TField, "boolean"> : never)
    | ([NonNullish<TRow[TField]>] extends [never]
        ? never
        :
            | RawCustomFieldColumnWithoutAggregate<TRow, TField>
            | RawCustomAggregatedFieldColumn<TRow, TField>);
}[FieldKey<TRow>];

const computedColumnMarker: unique symbol = Symbol("AstryxTableComputedColumn");

type ComputedColumn<
  TRow,
  TFields extends NonEmptyFields<TRow>,
  TValue,
  TValueType extends AstryxTableBuiltInValueType | ErasedValueType,
> = ColumnPresentation<TRow, TValue> &
  ColumnLayout & {
    readonly [computedColumnMarker]: true;
    readonly columnId: AstryxTableColumnId;
    readonly headerName: string;
    readonly fields: TFields;
    readonly valueGetter: (params: ValueGetterParams<TRow, TFields>) => TValue;
    readonly valueType: TValueType;
    readonly field?: never;
    readonly enableFilter?: never;
    readonly enableSorting?: never;
    readonly isEditable?: never;
    readonly blankValue?: never;
    readonly validate?: never;
    readonly format?: TValueType extends "number" ? AstryxTableNumberFormat : never;
  };

type ErasedEditorCapability =
  | {
      readonly editorFamily: "boolean";
      readonly booleanEditorValues: readonly [unknown, unknown];
    }
  | {
      readonly editorFamily: Exclude<AstryxTableEditorFamily, "boolean">;
      readonly booleanEditorValues?: never;
    };

type ErasedValueType = {
  readonly codecId: string;
  readonly codecVersion: number;
  readonly filterFamily: AstryxTableFilterFamily;
  readonly cellAlign: AstryxTableCellAlign;
  readonly editorLayout: AstryxTableEditorLayout;
  readonly defaultWidth: number;
  readonly aggregateResults?: AstryxTableAggregateResults;
  readonly decodeRuntime: (input: unknown) => unknown;
  readonly equivalent: (...parameters: never[]) => unknown;
  readonly compare: (...parameters: never[]) => unknown;
  readonly formatCanonicalText: (...parameters: never[]) => unknown;
  readonly parseCanonicalText: (text: string) => unknown;
  readonly formatDisplay: (...parameters: never[]) => unknown;
  readonly encodePersisted: (...parameters: never[]) => unknown;
  readonly decodePersisted: (input: unknown) => unknown;
} & ErasedEditorCapability;

type ErasedCustomComputedColumn<TRow> = ColumnPresentation<TRow, never> &
  ColumnLayout & {
    readonly [computedColumnMarker]: true;
    readonly columnId: AstryxTableColumnId;
    readonly headerName: string;
    readonly fields: NonEmptyFields<TRow>;
    readonly valueGetter: (...parameters: never[]) => unknown;
    readonly valueType: ErasedValueType;
    readonly field?: never;
    readonly enableFilter?: never;
    readonly enableSorting?: never;
    readonly isEditable?: never;
    readonly blankValue?: never;
    readonly validate?: never;
    readonly format?: never;
  };

type AnyComputedColumn<TRow> =
  | {
      readonly [TValueType in AstryxTableBuiltInValueType]: ComputedColumn<
        TRow,
        NonEmptyFields<TRow>,
        ValueForBuiltInType<TValueType>,
        TValueType
      >;
    }[AstryxTableBuiltInValueType]
  | ErasedCustomComputedColumn<TRow>;

type ComputedColumnDependencies<TRow, TFields extends NonEmptyFields<TRow>, TValue> = {
  readonly fields: TFields;
  readonly valueGetter: (params: ValueGetterParams<TRow, TFields>) => TValue;
};

type ComputedColumnOptions<
  TRow,
  TFields extends NonEmptyFields<TRow>,
  TValue,
  TValueType extends AstryxTableBuiltInValueType | ErasedValueType,
> = Omit<
  ComputedColumn<TRow, TFields, TValue, TValueType>,
  typeof computedColumnMarker | "fields" | "valueGetter"
>;

/** A string key of the consumer's Row type. */
export type AstryxTableFieldKey<TRow> = FieldKey<TRow>;

/** @internal Shared only with AstryxTable's first-party Column Helper implementation. */
export type AstryxTableNonNullish<TValue> = NonNullish<TValue>;

/** @internal Shared only with AstryxTable's first-party Column Helper implementation. */
export type AstryxTableNonEmptyFields<TRow> = NonEmptyFields<TRow>;

type StringQueryField<TRow> = {
  [TField in FieldKey<TRow>]: [NonNullish<TRow[TField]>] extends [never]
    ? never
    : [NonNullish<TRow[TField]>] extends [string]
      ? TField
      : never;
}[FieldKey<TRow>];

/** A string-valued source field eligible for the Client Quick Filter. */
export type AstryxTableQuickFilterField<TRow> = StringQueryField<TRow>;

/**
 * Explicit, non-empty source-field configuration for the Client Quick Filter.
 * TypeScript enforces the field shape and non-empty tuple; the runtime applies a defensive
 * maximum of 256 entries when snapshotting untrusted configuration.
 */
export type AstryxTableQuickFilterFields<TRow> = readonly [
  AstryxTableQuickFilterField<TRow>,
  ...AstryxTableQuickFilterField<TRow>[],
];

/** @internal Shared only with AstryxTable's first-party Column Helper implementation. */
type SelectFieldColumnCapabilities<TColumn, TOptions> = [TOptions] extends [void]
  ? TColumn
  : TOptions extends {
        readonly groupBy: true;
      }
    ? TOptions extends { readonly aggFunc: infer TAggFunc }
      ? Extract<TColumn, { readonly groupBy: true; readonly aggFunc: TAggFunc }>
      : Extract<TColumn, { readonly groupBy: true; readonly aggFunc?: never }>
    : TOptions extends { readonly aggFunc: infer TAggFunc }
      ? Extract<TColumn, { readonly groupBy?: false | undefined; readonly aggFunc: TAggFunc }>
      : Extract<TColumn, { readonly groupBy?: false | undefined; readonly aggFunc?: never }>;

/** Exact structural Field Column definition for advanced raw configuration. */
declare const astryxTableColumnHelperFieldDomainWitness: unique symbol;
declare const astryxTableColumnHelperRowWitness: unique symbol;

type AstryxTableColumnHelperRowWitness<TRow> = Readonly<{
  [astryxTableColumnHelperRowWitness]?: (row: TRow) => TRow;
}>;

type AstryxTableColumnHelperFieldDomainWitness<TField extends string, TValue> = Readonly<{
  [astryxTableColumnHelperFieldDomainWitness]?: Readonly<{
    readonly field: TField;
    readonly value: TValue;
  }>;
}>;

type AstryxTableColumnHelperFieldDomainFor<TRow, TField extends FieldKey<TRow>> =
  TField extends FieldKey<TRow>
    ? AstryxTableColumnHelperFieldDomainWitness<TField, TRow[TField]>
    : never;

export type AstryxTableFieldColumnDefinition<
  TRow,
  TField extends FieldKey<TRow>,
  TValueType extends AstryxTableBuiltInValueType | ErasedValueType,
  TOptions = void,
  TColumnId extends AstryxTableColumnId = AstryxTableColumnId,
> = AstryxTableFieldColumnInput<TRow, TField, TValueType, TOptions, TColumnId> &
  AstryxTableColumnHelperFieldDomainFor<TRow, TField> &
  AstryxTableColumnHelperRowWitness<TRow>;

/** @internal Capability-selecting input shape for first-party Column Helpers. */
export type AstryxTableFieldColumnInput<
  TRow,
  TField extends FieldKey<TRow>,
  TValueType extends AstryxTableBuiltInValueType | ErasedValueType,
  TOptions = void,
  TColumnId extends AstryxTableColumnId = AstryxTableColumnId,
> = SelectFieldColumnCapabilities<FieldColumn<TRow, TField, TValueType, TColumnId>, TOptions>;

/** @internal Shared only with AstryxTable's first-party Column Helper implementation. */
export type AstryxTableComputedColumnDefinition<
  TRow,
  TFields extends NonEmptyFields<TRow>,
  TValue,
  TValueType extends AstryxTableBuiltInValueType | AstryxTableValueType<TValue> | ErasedValueType,
> = ComputedColumn<TRow, TFields, TValue, TValueType>;

/** @internal Shared only with AstryxTable's first-party Column Helper implementation. */
export type AstryxTableComputedColumnDependencies<
  TRow,
  TFields extends NonEmptyFields<TRow>,
  TValue,
> = ComputedColumnDependencies<TRow, TFields, TValue>;

/** @internal Shared only with AstryxTable's first-party Column Helper implementation. */
export type AstryxTableComputedColumnInput<
  TRow,
  TFields extends NonEmptyFields<TRow>,
  TValue,
  TValueType extends AstryxTableBuiltInValueType | AstryxTableValueType<TValue> | ErasedValueType,
> = ComputedColumnOptions<TRow, TFields, TValue, TValueType> &
  ComputedColumnDependencies<TRow, TFields, TValue>;

/**
 * Captures a Computed Column's exact dependency tuple before contextually typing its getter.
 * Built-in Value Type helpers will delegate to this strict construction seam.
 */
export function AstryxTableComputedColumn<
  TRow,
  const TFields extends NonEmptyFields<TRow>,
  const TOptions extends ComputedColumnOptions<TRow, TFields, string, "text">,
>(
  options: TOptions &
    AstryxTableColumnIdentityInput<TOptions> &
    ComputedColumnDependencies<TRow, TFields, string>,
): TOptions &
  ComputedColumnDependencies<TRow, TFields, string> &
  ComputedColumn<TRow, TFields, string, "text">;
export function AstryxTableComputedColumn<
  TRow,
  const TFields extends NonEmptyFields<TRow>,
  const TOptions extends ComputedColumnOptions<TRow, TFields, number, "number">,
>(
  options: TOptions &
    AstryxTableColumnIdentityInput<TOptions> &
    ComputedColumnDependencies<TRow, TFields, number>,
): TOptions &
  ComputedColumnDependencies<TRow, TFields, number> &
  ComputedColumn<TRow, TFields, number, "number">;
export function AstryxTableComputedColumn<
  TRow,
  const TFields extends NonEmptyFields<TRow>,
  const TOptions extends ComputedColumnOptions<TRow, TFields, bigint, "bigint">,
>(
  options: TOptions &
    AstryxTableColumnIdentityInput<TOptions> &
    ComputedColumnDependencies<TRow, TFields, bigint>,
): TOptions &
  ComputedColumnDependencies<TRow, TFields, bigint> &
  ComputedColumn<TRow, TFields, bigint, "bigint">;
export function AstryxTableComputedColumn<
  TRow,
  const TFields extends NonEmptyFields<TRow>,
  const TOptions extends ComputedColumnOptions<TRow, TFields, boolean, "boolean">,
>(
  options: TOptions &
    AstryxTableColumnIdentityInput<TOptions> &
    ComputedColumnDependencies<TRow, TFields, boolean>,
): TOptions &
  ComputedColumnDependencies<TRow, TFields, boolean> &
  ComputedColumn<TRow, TFields, boolean, "boolean">;
export function AstryxTableComputedColumn<
  TRow,
  const TFields extends NonEmptyFields<TRow>,
  const TValueType extends ErasedValueType,
  const TOptions extends ComputedColumnOptions<
    TRow,
    TFields,
    AstryxTableValueTypeValue<TValueType>,
    TValueType
  >,
>(
  options: TOptions &
    AstryxTableColumnIdentityInput<TOptions> & {
      readonly valueType: TValueType;
    } & ComputedColumnDependencies<TRow, TFields, AstryxTableValueTypeValue<TValueType>>,
): TOptions &
  ComputedColumnDependencies<TRow, TFields, AstryxTableValueTypeValue<TValueType>> &
  ComputedColumn<TRow, TFields, AstryxTableValueTypeValue<TValueType>, TValueType>;
export function AstryxTableComputedColumn(options: Readonly<Record<string, unknown>>) {
  return { ...options, [computedColumnMarker]: true };
}

type HelperGroupedPresentationCallbacks = Readonly<{
  groupKeyValueFormatter?: unknown;
  groupKeyCellClassName?: unknown;
  groupKeyCellRenderer?: unknown;
  aggregateValueFormatter?: unknown;
  aggregateCellClassName?: unknown;
  aggregateCellRenderer?: unknown;
}>;

/** @internal Exact helper output recognized by the plain AstryxTable column-array interface. */
export type AstryxTableColumnHelperOutput<TColumn> = TColumn &
  AstryxTableColumnHelperProvenanceCarrier<
    TColumn extends { readonly field: infer TField }
      ? Readonly<{ readonly field: TField }>
      : TColumn extends { readonly fields: infer TFields }
        ? Readonly<{ readonly fields: TFields }>
        : never
  >;

type HelperFieldDomainForRow<TRow> = AstryxTableColumnHelperFieldDomainFor<TRow, FieldKey<TRow>>;

type Column<TRow> =
  | FieldColumns<TRow>
  | AnyComputedColumn<TRow>
  | ({ readonly columnId: AstryxTableColumnId } & HelperGroupedPresentationCallbacks &
      AstryxTableColumnHelperProvenanceCarrier<Readonly<{ readonly field: FieldKey<TRow> }>> &
      HelperFieldDomainForRow<TRow> &
      AstryxTableColumnHelperRowWitness<TRow>);

/**
 * A plain column array intended to be used with `satisfies`.
 *
 * Ordinary raw Field Columns require no helper. Inline grouped callbacks receive the honest broad
 * Column Identity context; exact grouped callbacks use one of AstryxTable's global typed Column
 * Helpers so their owning literal identity remains exact.
 */
export type AstryxTableColumns<TRow> = readonly Column<TRow>[];

type InvalidColumnIdentity<TColumn> = TColumn extends {
  readonly columnId: infer TColumnId extends ColumnIdPattern;
}
  ? TColumnId extends AstryxTableColumnId<TColumnId>
    ? never
    : TColumnId
  : never;

/** @internal Validates exact identities after a consumer tuple has been inferred. */
export type AstryxTableColumnIdentityGuard<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = [InvalidColumnIdentity<TColumns[number]>] extends [never] ? unknown : never;

type InvalidServerAggregateColumn<TColumns extends readonly unknown[]> =
  TColumns[number] extends infer TColumn
    ? TColumn extends { readonly aggFunc: infer TAggFunc; readonly valueType: infer TValueType }
      ? TAggFunc extends "sum"
        ? TValueType extends "bigint" | AstryxTableServerBigDecimalValueTypeAuthority
          ? never
          : TColumn
        : TAggFunc extends "avg"
          ? TValueType extends AstryxTableServerBigDecimalValueTypeAuthority
            ? never
            : TColumn
          : never
      : never
    : never;

/** @internal Restricts Server arithmetic to effect-view-server's exact result domains. */
export type AstryxTableServerAggregateGuard<TColumns extends readonly unknown[]> =
  ColumnIdPattern extends (
    TColumns[number] extends { readonly columnId: infer TColumnId } ? TColumnId : never
  )
    ? unknown
    : [InvalidServerAggregateColumn<TColumns>] extends [never]
      ? unknown
      : never;

export type AstryxTableColumnIdOf<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = TColumns[number]["columnId"];

type ColumnForId<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TColumnId extends AstryxTableColumnIdOf<TColumns>,
> = Extract<TColumns[number], { readonly columnId: TColumnId }>;

export type AstryxTableColumnField<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TColumnId extends AstryxTableColumnIdOf<TColumns>,
> =
  ColumnForId<TColumns, TColumnId> extends { readonly field: infer TField extends string }
    ? TField
    : never;

export type AstryxTableColumnValue<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TColumnId extends AstryxTableColumnIdOf<TColumns>,
> =
  ColumnForId<TColumns, TColumnId> extends {
    readonly valueGetter: (...parameters: never[]) => infer TValue;
  }
    ? TValue
    : ColumnForId<TColumns, TColumnId> extends { readonly field: infer TField }
      ? TField extends keyof TRow
        ? TRow[TField]
        : never
      : never;

type EnabledFieldColumnId<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TCapability extends "enableFilter" | "enableSorting",
> = TColumns[number] extends infer TColumn
  ? TColumn extends { readonly columnId: infer TColumnId extends AstryxTableColumnId }
    ? TColumn extends { readonly field: string }
      ? TColumn extends { readonly [TKey in TCapability]: false }
        ? never
        : TColumnId
      : never
    : never
  : never;

export type AstryxTableFilterableColumnId<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = EnabledFieldColumnId<TColumns, "enableFilter">;

export type AstryxTableSortableColumnId<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = EnabledFieldColumnId<TColumns, "enableSorting">;

type ExactEditableFieldColumn<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = TColumns[number] extends infer TColumn
  ? TColumn extends {
      readonly field: string;
      readonly isEditable: infer TEditable;
    }
    ? TEditable extends false | undefined
      ? never
      : TColumn
    : never
  : never;

type PotentiallyEditableFieldColumn<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> =
  AstryxTableColumnId extends AstryxTableColumnIdOf<TColumns>
    ? Extract<TColumns[number], { readonly field: string }>
    : ExactEditableFieldColumn<TColumns>;

export type AstryxTableEditableColumnId<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> =
  PotentiallyEditableFieldColumn<TColumns> extends infer TColumn
    ? TColumn extends { readonly columnId: infer TColumnId extends AstryxTableColumnId }
      ? TColumnId
      : never
    : never;

type ScalarFilterValue<TValue> = Exclude<TValue, null | undefined>;
type NonEmptyScalarFilterValues<TValue> = readonly [
  ScalarFilterValue<TValue>,
  ...ScalarFilterValue<TValue>[],
];

type FilterFamilyForValueType<TValueType> = TValueType extends "text"
  ? "text"
  : TValueType extends "number" | "bigint"
    ? "numeric"
    : TValueType extends "boolean"
      ? "boolean"
      : TValueType extends { readonly filterFamily: infer TFamily extends AstryxTableFilterFamily }
        ? TFamily
        : never;

type ColumnFilterFamily<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TColumnId extends AstryxTableColumnIdOf<TColumns>,
> =
  ColumnForId<TColumns, TColumnId> extends { readonly valueType: infer TValueType }
    ? FilterFamilyForValueType<TValueType>
    : never;

type TextSensitivity<TFilterFamily> = TFilterFamily extends "text"
  ? {
      readonly caseSensitive?: boolean;
      readonly accentSensitive?: boolean;
    }
  : {
      readonly caseSensitive?: never;
      readonly accentSensitive?: never;
    };

type EqualityFilter<
  TColumnId extends AstryxTableColumnId,
  TValue,
  TFilterFamily,
  TSetFilterEnabled extends boolean,
> =
  | ({
      readonly columnId: TColumnId;
      readonly type: "equals" | "notEqual";
      readonly filter: ScalarFilterValue<TValue>;
    } & TextSensitivity<TFilterFamily>)
  | (TSetFilterEnabled extends true
      ? {
          readonly columnId: TColumnId;
          readonly type: "in";
          readonly filter: NonEmptyScalarFilterValues<TValue>;
        } & TextSensitivity<TFilterFamily>
      : never);

type ColumnSetFilterEnabled<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TColumnId extends AstryxTableColumnIdOf<TColumns>,
> =
  ColumnForId<TColumns, TColumnId> extends { readonly enableFilter: false }
    ? false
    : ColumnForId<TColumns, TColumnId> extends { readonly enableSetFilter: infer TEnabled }
      ? TEnabled extends true
        ? true
        : false
      : ColumnFilterFamily<TColumns, TColumnId> extends "boolean" | "select"
        ? true
        : false;

type ColumnInFilterEnabled<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TColumnId extends AstryxTableColumnIdOf<TColumns>,
> =
  ColumnFilterFamily<TColumns, TColumnId> extends "text" | "numeric" | "boolean" | "select"
    ? true
    : ColumnSetFilterEnabled<TColumns, TColumnId>;

type MatchNoneFilter<
  TColumnId extends AstryxTableColumnId,
  TSetFilterEnabled extends boolean,
> = TSetFilterEnabled extends true
  ? { readonly columnId: TColumnId; readonly type: "matchNone" }
  : never;

type TextFilter<TColumnId extends AstryxTableColumnId, TFilterFamily> = TFilterFamily extends "text"
  ? {
      readonly columnId: TColumnId;
      readonly type: "contains" | "notContains" | "startsWith" | "endsWith";
      readonly filter: string;
      readonly caseSensitive?: boolean;
      readonly accentSensitive?: boolean;
    }
  : never;

type NumericFilter<
  TColumnId extends AstryxTableColumnId,
  TValue,
  TFilterFamily,
> = TFilterFamily extends "numeric"
  ?
      | {
          readonly columnId: TColumnId;
          readonly type: "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual";
          readonly filter: ScalarFilterValue<TValue>;
        }
      | {
          readonly columnId: TColumnId;
          /** Matches the half-open interval `filter <= value < filterTo`. */
          readonly type: "inRange";
          readonly filter: ScalarFilterValue<TValue>;
          readonly filterTo: ScalarFilterValue<TValue>;
        }
  : never;

type BlankFilter<TColumnId extends AstryxTableColumnId> = {
  readonly columnId: TColumnId;
  readonly type: "blank" | "notBlank";
};

type FilterLeaf<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TColumnId extends AstryxTableFilterableColumnId<TColumns>,
> =
  | EqualityFilter<
      TColumnId,
      AstryxTableColumnValue<TRow, TColumns, TColumnId>,
      ColumnFilterFamily<TColumns, TColumnId>,
      ColumnInFilterEnabled<TColumns, TColumnId>
    >
  | TextFilter<TColumnId, ColumnFilterFamily<TColumns, TColumnId>>
  | NumericFilter<
      TColumnId,
      AstryxTableColumnValue<TRow, TColumns, TColumnId>,
      ColumnFilterFamily<TColumns, TColumnId>
    >
  | BlankFilter<TColumnId>
  | MatchNoneFilter<TColumnId, ColumnSetFilterEnabled<TColumns, TColumnId>>;

type FilterExpressionForColumn<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TColumnId extends AstryxTableFilterableColumnId<TColumns>,
> =
  | FilterLeaf<TRow, TColumns, TColumnId>
  | {
      readonly type: "AND" | "OR";
      readonly conditions: readonly [
        FilterExpressionForColumn<TRow, TColumns, TColumnId>,
        ...FilterExpressionForColumn<TRow, TColumns, TColumnId>[],
      ];
    }
  | {
      readonly type: "NOT";
      readonly condition: FilterExpressionForColumn<TRow, TColumns, TColumnId>;
    };

export type AstryxTableFilterExpression<TRow, TColumns extends AstryxTableColumns<TRow>> = {
  readonly [TColumnId in AstryxTableFilterableColumnId<TColumns>]: FilterExpressionForColumn<
    TRow,
    TColumns,
    TColumnId
  >;
}[AstryxTableFilterableColumnId<TColumns>];

export type AstryxTableFilterExpressions<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = readonly AstryxTableFilterExpression<TRow, TColumns>[];

export type AstryxTableSortBy<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = readonly [
  {
    readonly [TColumnId in AstryxTableSortableColumnId<TColumns>]: {
      readonly columnId: TColumnId;
      readonly direction: "asc" | "desc";
    };
  }[AstryxTableSortableColumnId<TColumns>],
  ...{
    readonly [TColumnId in AstryxTableSortableColumnId<TColumns>]: {
      readonly columnId: TColumnId;
      readonly direction: "asc" | "desc";
    };
  }[AstryxTableSortableColumnId<TColumns>][],
];

export type AstryxTableRowsColumnId = AstryxTableRowsSystemColumnId;

export type AstryxTableGroupableColumnId<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = TColumns[number] extends infer TColumn
  ? TColumn extends {
      readonly columnId: infer TColumnId extends AstryxTableColumnId;
      readonly field: string;
      readonly groupBy: true;
    }
    ? TColumnId
    : never
  : never;

export type AstryxTableGroupedSortableColumnId<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> =
  | AstryxTableGroupableColumnId<TColumns>
  | (TColumns[number] extends infer TColumn
      ? TColumn extends {
          readonly columnId: infer TColumnId extends AstryxTableColumnId;
          readonly field: string;
          readonly aggFunc: AstryxTableAggFunc;
        }
        ? TColumnId
        : never
      : never)
  | AstryxTableRowsColumnId;

export type AstryxTableGroupSortBy<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = readonly [
  {
    readonly columnId: AstryxTableGroupedSortableColumnId<TColumns>;
    readonly direction: "asc" | "desc";
  },
  ...{
    readonly columnId: AstryxTableGroupedSortableColumnId<TColumns>;
    readonly direction: "asc" | "desc";
  }[],
];

type PersistedCodecOperand = {
  readonly codecId: string;
  readonly codecVersion: number;
  readonly filter: AstryxTableJsonValue;
};

type PersistedTextSensitivity<TFilterFamily> = TFilterFamily extends "text"
  ? {
      readonly caseSensitive?: boolean;
      readonly accentSensitive?: boolean;
    }
  : {
      readonly caseSensitive?: never;
      readonly accentSensitive?: never;
    };

type PersistedFilterLeaf<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TColumnId extends AstryxTableFilterableColumnId<TColumns>,
> =
  | {
      readonly columnId: TColumnId;
      readonly type: "blank" | "notBlank";
    }
  | (ColumnSetFilterEnabled<TColumns, TColumnId> extends true
      ? { readonly columnId: TColumnId; readonly type: "matchNone" }
      : never)
  | ({
      readonly columnId: TColumnId;
      readonly type: "equals" | "notEqual";
    } & PersistedCodecOperand &
      PersistedTextSensitivity<ColumnFilterFamily<TColumns, TColumnId>>)
  | (ColumnInFilterEnabled<TColumns, TColumnId> extends true
      ? {
          readonly columnId: TColumnId;
          readonly type: "in";
          readonly codecId: string;
          readonly codecVersion: number;
          readonly filter: readonly [AstryxTableJsonValue, ...AstryxTableJsonValue[]];
        } & PersistedTextSensitivity<ColumnFilterFamily<TColumns, TColumnId>>
      : never)
  | (ColumnFilterFamily<TColumns, TColumnId> extends "text"
      ? {
          readonly columnId: TColumnId;
          readonly type: "contains" | "notContains" | "startsWith" | "endsWith";
          readonly codecId: string;
          readonly codecVersion: number;
          readonly filter: string;
        } & PersistedTextSensitivity<"text">
      : never)
  | (ColumnFilterFamily<TColumns, TColumnId> extends "numeric"
      ? {
          readonly columnId: TColumnId;
          readonly type: "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual";
        } & PersistedCodecOperand
      : never)
  | (ColumnFilterFamily<TColumns, TColumnId> extends "numeric"
      ? {
          readonly columnId: TColumnId;
          readonly type: "inRange";
          readonly codecId: string;
          readonly codecVersion: number;
          readonly filter: AstryxTableJsonValue;
          readonly filterTo: AstryxTableJsonValue;
        }
      : never);

type PersistedFilterExpressionForColumn<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
  TColumnId extends AstryxTableFilterableColumnId<TColumns>,
> =
  | PersistedFilterLeaf<TColumns, TColumnId>
  | {
      readonly type: "AND" | "OR";
      readonly conditions: readonly [
        PersistedFilterExpressionForColumn<TColumns, TColumnId>,
        ...PersistedFilterExpressionForColumn<TColumns, TColumnId>[],
      ];
    }
  | {
      readonly type: "NOT";
      readonly condition: PersistedFilterExpressionForColumn<TColumns, TColumnId>;
    };

export type AstryxTablePersistedFilterExpression<TRow, TColumns extends AstryxTableColumns<TRow>> = {
  readonly [TColumnId in AstryxTableFilterableColumnId<TColumns>]: PersistedFilterExpressionForColumn<
    TColumns,
    TColumnId
  >;
}[AstryxTableFilterableColumnId<TColumns>];

export type AstryxTablePersistedFilterExpressions<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = readonly AstryxTablePersistedFilterExpression<TRow, TColumns>[];

export type AstryxTablePersistedColumnPinning<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> = Readonly<{
  readonly start: readonly AstryxTableColumnIdOf<TColumns>[];
  readonly end: readonly AstryxTableColumnIdOf<TColumns>[];
}>;

export type AstryxTablePersistedState<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TGrouping extends boolean = boolean,
> = TGrouping extends boolean
  ? Readonly<{
      readonly version: 1;
      readonly tableId: string;
      readonly filters: AstryxTablePersistedFilterExpressions<TRow, TColumns>;
      readonly orderBy: AstryxTableSortBy<TColumns>;
      readonly groupBy: TGrouping extends true
        ? readonly AstryxTableGroupableColumnId<TColumns>[]
        : readonly [];
      readonly groupOrderBy: TGrouping extends true ? AstryxTableGroupSortBy<TColumns> : readonly [];
      readonly columnOrder: readonly AstryxTableColumnIdOf<TColumns>[];
      readonly columnVisibility: Readonly<Partial<Record<AstryxTableColumnIdOf<TColumns>, boolean>>>;
      readonly columnWidths: Readonly<
        Partial<
          Record<
            | AstryxTableColumnIdOf<TColumns>
            | (TGrouping extends true ? AstryxTableRowsColumnId : never),
            number
          >
        >
      >;
      readonly columnPinning: AstryxTablePersistedColumnPinning<TColumns>;
    }>
  : never;

type SaveCellChangeForColumn<TRow, TColumn> = TColumn extends {
  readonly columnId: infer TColumnId extends AstryxTableColumnId;
  readonly field: infer TField extends keyof TRow & string;
}
  ? {
      readonly columnId: TColumnId;
      readonly field: TField;
      readonly before: TRow[TField];
      readonly after: TRow[TField];
    }
  : never;

export type AstryxTableSaveCellChange<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = SaveCellChangeForColumn<TRow, PotentiallyEditableFieldColumn<TColumns>>;

type PotentiallyEditableField<TRow, TColumns extends AstryxTableColumns<TRow>> =
  PotentiallyEditableFieldColumn<TColumns> extends infer TColumn
    ? TColumn extends { readonly field: infer TField extends keyof TRow & string }
      ? TField
      : never
    : never;

/** Exact sparse field values used to project one editable source Row for presentation. */
export type AstryxTableEditRowPatch<TRow, TColumns extends AstryxTableColumns<TRow>> = Readonly<
  Partial<Pick<TRow, PotentiallyEditableField<TRow, TColumns>>>
>;

/** Input to an Editable Client Table's trusted Row projection seam. */
export type AstryxTableEditRowProjectorInput<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion = unknown,
> = Readonly<{
  readonly row: TRow;
  readonly patch: AstryxTableEditRowPatch<TRow, TColumns>;
  readonly rowVersion: TRowVersion;
}>;

/**
 * Reconstructs the consumer's authentic Row shape for row-aware edit-review presentation.
 *
 * The returned Row is presentation evidence only. It does not replace the source Row, Row Version,
 * or Save Change Set authority. A memoized projection remains valid while the source Row reference,
 * opaque Row Version, projector configuration, and exact patch are identical, including after a
 * review closes and reopens. Changed source, Row Version, or patch evidence requires a fresh
 * immutable Row replacement. The opaque Row Version is cache-key evidence only.
 *
 * Missing required configuration is an explicit configuration error. Before this Row has published
 * one valid projection, a projector failure, null or non-object result, source-Row result for a
 * non-empty patch, Row Identity read failure, changed Row Identity, or reused historical result is
 * also explicit. After a valid projection has been published, the same failure classes on changed
 * inputs instead withdraw row-aware Yours as unavailable. Exact Mine, Base, and Server evidence
 * remains available; AstryxTable never substitutes stale or Server evidence for Yours.
 */
export type AstryxTableEditRowProjector<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion = unknown,
> = (input: AstryxTableEditRowProjectorInput<TRow, TColumns, TRowVersion>) => TRow;

export type AstryxTableSaveCellChangeSet<TRow, TColumns extends AstryxTableColumns<TRow>> = readonly [
  AstryxTableSaveCellChange<TRow, TColumns>,
  ...AstryxTableSaveCellChange<TRow, TColumns>[],
];

export type AstryxTableSaveRowChange<TRow, TColumns extends AstryxTableColumns<TRow>, TRowVersion> = {
  readonly rowId: AstryxTableRowId;
  readonly baseRow: TRow;
  readonly expectedVersion: TRowVersion;
  readonly changes: AstryxTableSaveCellChangeSet<TRow, TColumns>;
};

export type AstryxTableSaveChangeSet<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion,
> = readonly [
  AstryxTableSaveRowChange<TRow, TColumns, TRowVersion>,
  ...AstryxTableSaveRowChange<TRow, TColumns, TRowVersion>[],
];

/**
 * Persist a non-empty Save Change Set.
 *
 * The returned operation must eventually settle. While it is pending, AstryxTable keeps the
 * submitted cells locked and the save counted as active. Rejection releases that save work;
 * resolution keeps it active until authoritative live-source evidence reconciles the submission.
 */
export type AstryxTableSaveEditsHandler<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion,
> = (changes: AstryxTableSaveChangeSet<TRow, TColumns, TRowVersion>) => PromiseLike<void>;

export type AstryxTableReadOnlyCapability = {
  readonly editable?: false;
  readonly getRowVersion?: never;
  readonly onSaveEdits?: never;
  readonly projectEditRow?: never;
};

export type AstryxTableNoGroupingCapability = {
  readonly groupRowsColumn?: never;
};

export type AstryxTableGroupingCapability<TRow, TColumns extends AstryxTableColumns<TRow>> = {
  readonly groupRowsColumn?: AstryxTableGroupRowsColumnOptions<TRow, TColumns>;
};

type PotentiallyEditableRowAwarePresentationColumn<
  TColumns extends readonly { readonly columnId: AstryxTableColumnId }[],
> =
  PotentiallyEditableFieldColumn<TColumns> extends infer TColumn
    ? TColumn extends unknown
      ? TColumn extends { readonly valueFormatter: (...parameters: never[]) => unknown }
        ? TColumn
        : TColumn extends { readonly cellClassName: (...parameters: never[]) => unknown }
          ? TColumn
          : TColumn extends { readonly cellRenderer: (...parameters: never[]) => unknown }
            ? TColumn
            : never
      : never
    : never;

type AstryxTableEditRowProjectionCapability<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion,
> = number extends TColumns["length"]
  ? { readonly projectEditRow?: AstryxTableEditRowProjector<TRow, TColumns, TRowVersion> }
  : [PotentiallyEditableRowAwarePresentationColumn<TColumns>] extends [never]
    ? { readonly projectEditRow?: AstryxTableEditRowProjector<TRow, TColumns, TRowVersion> }
    : { readonly projectEditRow: AstryxTableEditRowProjector<TRow, TColumns, TRowVersion> };

export type AstryxTableEditableCapability<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion,
> =
  AstryxTableEditableColumnId<TColumns> extends never
    ? never
    : {
        readonly editable: true;
        readonly getRowVersion: (row: TRow) => TRowVersion;
        readonly onSaveEdits: AstryxTableSaveEditsHandler<TRow, TColumns, NoInfer<TRowVersion>>;
      } & AstryxTableEditRowProjectionCapability<TRow, TColumns, TRowVersion> &
        AstryxTableNoGroupingCapability;

export type AstryxTableEditingCapability<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion,
> = AstryxTableReadOnlyCapability | AstryxTableEditableCapability<TRow, TColumns, TRowVersion>;

type CommonPropsWithoutInitialOrderBy<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TGrouping extends boolean = boolean,
> = {
  readonly tableId: string;
  readonly columns: TColumns & AstryxTableColumnIdentityGuard<NoInfer<TColumns>>;
  readonly initialFilters?: AstryxTableFilterExpressions<TRow, TColumns>;
  readonly initialPersistedState?: AstryxTablePersistedState<TRow, TColumns, TGrouping>;
  readonly onPersistChange?: (state: AstryxTablePersistedState<TRow, TColumns, TGrouping>) => void;
  /** Optional page-specific content rendered in AstryxTable's toolbar region. */
  readonly children?: ReactNode;
};

export type AstryxTableCommonProps<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = CommonPropsWithoutInitialOrderBy<TRow, TColumns> & {
  readonly initialOrderBy: AstryxTableSortBy<TColumns>;
};

// This private conditional preserves focused diagnostics for invalid component calls. Both public
// variants remove its property and replace it with the same mandatory non-empty tuple.
type ComponentCommonProps<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TGrouping extends boolean,
> = CommonPropsWithoutInitialOrderBy<TRow, TColumns, TGrouping> &
  ([AstryxTableSortableColumnId<TColumns>] extends [never]
    ? { readonly initialOrderBy?: never }
    : { readonly initialOrderBy: AstryxTableSortBy<TColumns> });

type AstryxTableClientSourceProps<TRow, TColumns extends AstryxTableColumns<TRow>> = {
  readonly initialOrderBy: AstryxTableSortBy<TColumns>;
  readonly getRowId: (row: TRow) => AstryxTableRowId;
  readonly clientSource: AstryxTableClientSource<TRow>;
  readonly quickFilterFields?: AstryxTableQuickFilterFields<TRow>;
  /** Enables session-only Row Selection for ordinary Client source rows. */
  readonly rowSelection?: true;
  readonly externalFilters?: never;
  readonly viewportSource?: never;
};

type AstryxTablePotentiallyEditableColumnRequirement<TColumns extends readonly unknown[]> =
  number extends TColumns["length"]
    ? unknown
    : Extract<
          TColumns[number],
          { readonly isEditable: true | ((...parameters: never[]) => boolean) }
        > extends never
      ? { readonly columns: never }
      : unknown;

export type AstryxTableReadOnlyClientProps<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = AstryxTableClientSourceProps<TRow, TColumns> &
  Omit<ComponentCommonProps<TRow, TColumns, true>, "initialOrderBy"> &
  AstryxTableReadOnlyCapability &
  AstryxTableGroupingCapability<TRow, TColumns>;

type EditableClientComposition<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = AstryxTableClientSourceProps<TRow, TColumns> &
  Omit<ComponentCommonProps<TRow, TColumns, false>, "initialOrderBy"> &
  AstryxTablePotentiallyEditableColumnRequirement<TColumns>;

export type AstryxTableEditableClientProps<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TGetRowVersion extends (row: TRow) => unknown,
> = EditableClientComposition<TRow, TColumns> &
  Omit<
    AstryxTableEditableCapability<TRow, TColumns, ReturnType<TGetRowVersion>>,
    "getRowVersion" | "onSaveEdits"
  > & {
    readonly getRowVersion: TGetRowVersion;
    readonly onSaveEdits: AstryxTableSaveEditsHandler<
      TRow,
      TColumns,
      NoInfer<ReturnType<TGetRowVersion>>
    >;
  };

export type AstryxTableClientProps<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion = never,
> =
  | AstryxTableReadOnlyClientProps<TRow, TColumns>
  | (EditableClientComposition<TRow, TColumns> &
      AstryxTableEditableCapability<TRow, TColumns, TRowVersion>);

export type AstryxTableServerProps<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TViewport = unknown,
> = Omit<ComponentCommonProps<TRow, TColumns, true>, "initialOrderBy"> &
  AstryxTableReadOnlyCapability &
  AstryxTableGroupingCapability<TRow, TColumns> & {
    readonly columns: TColumns & AstryxTableServerAggregateGuard<NoInfer<TColumns>>;
    readonly initialOrderBy: AstryxTableSortBy<TColumns>;
    /** Server row identity is supplied authoritatively by the Viewport Source. */
    readonly getRowId?: never;
    readonly viewportSource: AstryxTableServerSource<
      [LiveQueryViewportBaseRow<TViewport>] extends [never]
        ? never
        : [TRow] extends [LiveQueryViewportBaseRow<TViewport>]
          ? [LiveQueryViewportBaseRow<TViewport>] extends [TRow]
            ? TViewport
            : never
          : never
    >;
    readonly externalFilters?: LiveQueryViewportWhere<NoInfer<TViewport>>;
    readonly quickFilterFields?: AstryxTableQuickFilterFields<TRow>;
    readonly clientSource?: never;
    readonly editable?: never;
    readonly rowSelection?: never;
    readonly rangeSelection?: never;
    readonly onPaste?: never;
    readonly onFill?: never;
    readonly onUndo?: never;
    readonly onRedo?: never;
  } & AstryxTableServerRouteCapability<LiveQueryViewportRouteBy<NoInfer<TViewport>>> &
  AstryxTableServerQueryAuthority<
    NoInfer<TViewport>,
    LiveQueryViewportRouteBy<NoInfer<TViewport>>,
    LiveQueryViewportWhere<NoInfer<TViewport>>
  >;

type AstryxTableServerRouteCapability<TRouteBy> = [TRouteBy] extends [never]
  ? { readonly routeBy?: never }
  : { readonly routeBy: TRouteBy };

type AstryxTableServerQueryAuthority<
  TViewport,
  TRouteBy,
  TExternalFilters extends readonly unknown[],
> = TViewport extends {
  readonly semanticKey: (
    query: {
      readonly select: LiveQueryViewportCompleteRawSelect<TViewport>;
      readonly where: TExternalFilters;
      readonly orderBy: readonly [];
    } & ([TRouteBy] extends [never]
      ? { readonly routeBy?: never }
      : { readonly routeBy: TRouteBy }),
  ) => unknown;
}
  ? [LiveQueryViewportQueryAuthority<TViewport>] extends [never]
    ? { readonly __astryxTableInvalidServerGroupedQueryAuthority: never }
    : unknown
  : { readonly __astryxTableInvalidServerQueryAuthority: never };
