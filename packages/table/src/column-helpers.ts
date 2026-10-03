import { AstryxTableComputedColumn } from "./public-types";
import { attachAstryxTableColumnHelperProvenance } from "./internal/column-helper-provenance";
import {
  attachAstryxTableSelectValueTypeProvenance,
  getAstryxTableSelectValueTypeFingerprint,
} from "./internal/select-value-type-provenance";

import type {
  AstryxTableBuiltInValueType,
  AstryxTableCellAlign,
  AstryxTableColumnId,
  AstryxTableColumnHelperOutput,
  AstryxTableColumnIdentityInput,
  AstryxTableComputedColumnDependencies,
  AstryxTableComputedColumnDefinition,
  AstryxTableComputedColumnInput,
  AstryxTableEditorLayout,
  AstryxTableFieldColumnDefinition,
  AstryxTableFieldColumnInput,
  AstryxTableFieldKey,
  AstryxTableJsonValue,
  AstryxTableNonEmptyFields,
  AstryxTableNonNullish,
  AstryxTableNumberFormat,
  AstryxTableOrdering,
  AstryxTableValueType,
} from "./public-types";
import type {
  EffectiveFieldPresetCapability,
  PresetEditingDefaults,
} from "./internal/preset-capability";

export type AstryxTableSelectValue = string | number | bigint | boolean;

export { getAstryxTableSelectValueTypeFingerprint };

// Select's configured option order is not an aggregate result contract.
// Keep its capability empty unless the descriptor implements explicit result semantics.
type InternalSelectValueType<TValue> = Omit<
  AstryxTableValueType<TValue, "select", "text", {}>,
  "editorFamily"
> & {
  readonly editorFamily: "select";
};

type FieldOfKind<TRow, TValueKind> = {
  readonly [TField in AstryxTableFieldKey<TRow>]: [AstryxTableNonNullish<TRow[TField]>] extends [
    never,
  ]
    ? never
    : [AstryxTableNonNullish<TRow[TField]>] extends [TValueKind]
      ? TField
      : never;
}[AstryxTableFieldKey<TRow>];

type Merge<TDefaults, TOptions> = Omit<TDefaults, keyof TOptions> & TOptions;

type ApplyDefaults<TOptions, TDefaults> = TOptions extends unknown
  ? Omit<TOptions, Extract<keyof TDefaults, keyof TOptions>> &
      Partial<Pick<TOptions, Extract<keyof TDefaults, keyof TOptions>>>
  : never;

type DistributiveOmit<TValue, TKey extends PropertyKey> = TValue extends unknown
  ? Omit<TValue, TKey>
  : never;

type OnlyKnownKeys<TActual, TAllowed> = {
  readonly [TKey in Exclude<keyof TActual, keyof TAllowed>]: never;
};

type FieldIdentity<TField extends PropertyKey, TColumnId extends AstryxTableColumnId> = {
  readonly columnId: AstryxTableColumnId<TColumnId>;
  readonly field: TField;
};

type NarrowFieldCapabilities<TColumn, TOptions> = TColumn extends { readonly field: string }
  ? TOptions extends { readonly groupBy: true }
    ? TOptions extends { readonly aggFunc: infer TAggFunc }
      ? TColumn extends { readonly groupBy: true; readonly aggFunc: TAggFunc }
        ? TColumn
        : never
      : TColumn extends { readonly groupBy: true; readonly aggFunc?: never }
        ? TColumn
        : never
    : TOptions extends { readonly aggFunc: infer TAggFunc }
      ? TColumn extends {
          readonly groupBy?: false | undefined;
          readonly aggFunc: TAggFunc;
        }
        ? TColumn
        : never
      : TColumn extends {
            readonly groupBy?: false | undefined;
            readonly aggFunc?: never;
          }
        ? TColumn
        : never
  : TColumn;

type HelperResult<TBuiltIn, TOptions, TColumn> = AstryxTableColumnHelperOutput<
  Merge<TBuiltIn, TOptions> & NarrowFieldCapabilities<TColumn, TOptions>
>;

type PresetResult<TBuiltIn, TDefaults, TOptions, TColumn> = AstryxTableColumnHelperOutput<
  Merge<Merge<TBuiltIn, TDefaults>, TOptions> &
    NarrowFieldCapabilities<TColumn, Merge<TDefaults, TOptions>>
>;

type FieldInput<
  TRow,
  TField extends AstryxTableFieldKey<TRow>,
  TValueType extends
    | AstryxTableBuiltInValueType
    | AstryxTableValueType<AstryxTableNonNullish<TRow[TField]>>
    | InternalSelectValueType<AstryxTableNonNullish<TRow[TField]>>,
  TColumnId extends AstryxTableColumnId = AstryxTableColumnId,
> = DistributiveOmit<
  AstryxTableFieldColumnInput<TRow, TField, TValueType, void, TColumnId>,
  "valueType"
>;

type ComputedOptions<
  TRow,
  TFields extends AstryxTableNonEmptyFields<TRow>,
  TValue,
  TValueType extends
    | AstryxTableBuiltInValueType
    | AstryxTableValueType<TValue>
    | InternalSelectValueType<TValue>,
> = Omit<
  AstryxTableComputedColumnInput<TRow, TFields, TValue, TValueType>,
  "fields" | "valueGetter" | "valueType"
>;

type BuiltInDefaults<
  TValueType extends AstryxTableBuiltInValueType,
  TCellAlign extends AstryxTableCellAlign,
  TEditorLayout extends AstryxTableEditorLayout,
  TWidth extends number,
> = {
  readonly valueType: TValueType;
  readonly cellAlign: TCellAlign;
  readonly editorLayout: TEditorLayout;
  readonly width: TWidth;
};

type TextBuiltIn = BuiltInDefaults<"text", "start", "inline", 160>;
type NumberBuiltIn = BuiltInDefaults<"number", "end", "inline", 120>;
type BigIntBuiltIn = BuiltInDefaults<"bigint", "end", "inline", 140>;
type BooleanBuiltIn = BuiltInDefaults<"boolean", "center", "center", 88>;

type PresetDefaults<TValue> = {
  readonly headerName?: string;
  readonly width?: number;
  readonly cellAlign?: AstryxTableCellAlign;
  readonly editorLayout?: AstryxTableEditorLayout;
  readonly enableFilter?: boolean;
  readonly enableSetFilter?: boolean;
  readonly enableSorting?: boolean;
  readonly cellClassName?: string;
} & PresetEditingDefaults<TValue>;

type NumberPresetDefaults = PresetDefaults<number> & {
  readonly format?: AstryxTableNumberFormat;
};

type FieldOnlyPresetKey =
  | "enableFilter"
  | "enableSetFilter"
  | "enableSorting"
  | "isEditable"
  | "blankValue"
  | "validate";

const fieldOnlyPresetKeyEvidence = {
  enableFilter: true,
  enableSetFilter: true,
  enableSorting: true,
  isEditable: true,
  blankValue: true,
  validate: true,
} as const satisfies Readonly<Record<FieldOnlyPresetKey, true>>;

const fieldOnlyPresetKeys = new Set<PropertyKey>(Reflect.ownKeys(fieldOnlyPresetKeyEvidence));

type ComputedPresetDefaults<TDefaults> = Omit<TDefaults, FieldOnlyPresetKey>;

type BuiltInColumnPreset<
  TValue,
  TValueType extends AstryxTableBuiltInValueType,
  TBuiltIn,
  TDefaults extends PresetDefaults<TValue>,
> = {
  <
    TRow,
    const TField extends FieldOfKind<TRow, TValue>,
    const TColumnId extends AstryxTableColumnId,
    const TOptions extends ApplyDefaults<
      FieldInput<TRow, TField, TValueType, TColumnId>,
      TDefaults
    >,
  >(
    options: TOptions &
      FieldIdentity<TField, TColumnId> &
      EffectiveFieldPresetCapability<TRow, TField, TDefaults, TOptions> &
      OnlyKnownKeys<TOptions, FieldInput<TRow, TField, TValueType, TColumnId>>,
  ): PresetResult<
    TBuiltIn,
    TDefaults,
    TOptions,
    AstryxTableFieldColumnDefinition<TRow, TField, TValueType, void, TColumnId>
  >;
  <
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ApplyDefaults<
      ComputedOptions<TRow, TFields, TValue, TValueType>,
      ComputedPresetDefaults<TDefaults>
    >,
  >(
    options: TOptions &
      AstryxTableColumnIdentityInput<TOptions> &
      AstryxTableComputedColumnDependencies<TRow, TFields, TValue> &
      OnlyKnownKeys<
        TOptions,
        ComputedOptions<TRow, TFields, TValue, TValueType> &
          AstryxTableComputedColumnDependencies<TRow, TFields, TValue>
      >,
  ): PresetResult<
    TBuiltIn,
    ComputedPresetDefaults<TDefaults>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, TValue>,
    AstryxTableComputedColumnDefinition<TRow, TFields, TValue, TValueType>
  >;
};

type BuiltInColumnHelper<
  TValue,
  TValueType extends AstryxTableBuiltInValueType,
  TBuiltIn,
  TPresetDefaults extends PresetDefaults<TValue>,
> = {
  <
    TRow,
    const TField extends FieldOfKind<TRow, TValue>,
    const TColumnId extends AstryxTableColumnId,
    const TOptions extends FieldInput<TRow, TField, TValueType, TColumnId>,
  >(
    options: TOptions &
      FieldIdentity<TField, TColumnId> &
      OnlyKnownKeys<TOptions, FieldInput<TRow, TField, TValueType, TColumnId>>,
  ): HelperResult<
    TBuiltIn,
    TOptions,
    AstryxTableFieldColumnDefinition<TRow, TField, TValueType, void, TColumnId>
  >;
  <
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ComputedOptions<TRow, TFields, TValue, TValueType>,
  >(
    options: TOptions &
      AstryxTableColumnIdentityInput<TOptions> &
      AstryxTableComputedColumnDependencies<TRow, TFields, TValue> &
      OnlyKnownKeys<
        TOptions,
        ComputedOptions<TRow, TFields, TValue, TValueType> &
          AstryxTableComputedColumnDependencies<TRow, TFields, TValue>
      >,
  ): HelperResult<
    TBuiltIn,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, TValue>,
    AstryxTableComputedColumnDefinition<TRow, TFields, TValue, TValueType>
  >;
  readonly withDefaults: <const TDefaults extends TPresetDefaults>(
    defaults: TDefaults & OnlyKnownKeys<TDefaults, TPresetDefaults>,
  ) => BuiltInColumnPreset<TValue, TValueType, TBuiltIn, TDefaults>;
};

type RuntimeColumnOptions = Readonly<Record<PropertyKey, unknown>>;

const presetDefaultKeys = new Set<PropertyKey>([
  "headerName",
  "width",
  "cellAlign",
  "editorLayout",
  "enableFilter",
  "enableSetFilter",
  "enableSorting",
  "isEditable",
  "blankValue",
  "validate",
  "cellClassName",
]);
const numberPresetDefaultKeys = new Set<PropertyKey>([...presetDefaultKeys, "format"]);
const selectPresetDefaultKeys = new Set<PropertyKey>([...presetDefaultKeys, "options"]);
const commonColumnOptionKeys = new Set<PropertyKey>([
  "columnId",
  "headerName",
  "width",
  "pinned",
  "cellAlign",
  "editorLayout",
  "valueFormatter",
  "cellClassName",
  "cellRenderer",
]);
const fieldColumnOptionKeys = new Set<PropertyKey>([
  "field",
  "enableFilter",
  "enableSetFilter",
  "enableSorting",
  "isEditable",
  "blankValue",
  "validate",
  "groupBy",
  "groupKeyValueFormatter",
  "groupKeyCellClassName",
  "groupKeyCellRenderer",
  "aggFunc",
  "aggregateValueFormatter",
  "aggregateCellClassName",
  "aggregateCellRenderer",
]);
const computedColumnOptionKeys = new Set<PropertyKey>(["fields", "valueGetter"]);

const textBuiltInDefaults: TextBuiltIn = {
  valueType: "text",
  cellAlign: "start",
  editorLayout: "inline",
  width: 160,
};

const numberBuiltInDefaults: NumberBuiltIn = {
  valueType: "number",
  cellAlign: "end",
  editorLayout: "inline",
  width: 120,
};

const bigIntBuiltInDefaults: BigIntBuiltIn = {
  valueType: "bigint",
  cellAlign: "end",
  editorLayout: "inline",
  width: 140,
};

const booleanBuiltInDefaults: BooleanBuiltIn = {
  valueType: "boolean",
  cellAlign: "center",
  editorLayout: "center",
  width: 88,
};

function mergeRuntimeColumn(
  builtIn: RuntimeColumnOptions,
  defaults: RuntimeColumnOptions,
  options: RuntimeColumnOptions,
): RuntimeColumnOptions {
  if (Object.hasOwn(defaults, "valueType") || Object.hasOwn(options, "valueType")) {
    throw new TypeError("AstryxTable Column Helpers do not accept a valueType override.");
  }
  validateRuntimeColumnOptions(builtIn, options);
  const isComputed = isComputedColumnOptions(options);
  const effectiveDefaults = isComputed ? omitFieldOnlyPresetDefaults(defaults) : defaults;

  const builtInFormat = builtIn["format"];
  const defaultFormat = effectiveDefaults["format"];
  const optionFormat = options["format"];
  const builtInFormatRecord = validateRuntimeFormat(builtInFormat);
  const defaultFormatRecord = validateRuntimeFormat(defaultFormat);
  const optionFormatRecord = validateRuntimeFormat(optionFormat);
  const hasFormat =
    builtInFormat !== undefined || defaultFormat !== undefined || optionFormat !== undefined;
  const merged = {
    ...builtIn,
    ...effectiveDefaults,
    ...options,
    ...(hasFormat
      ? {
          format: {
            ...builtInFormatRecord,
            ...defaultFormatRecord,
            ...optionFormatRecord,
          },
        }
      : {}),
  };
  if (!isComputed) {
    validateRuntimeFieldCapabilities(merged);
  }

  const column = isComputed
    ? (AstryxTableComputedColumn(merged as never) as unknown as RuntimeColumnOptions)
    : merged;
  return attachAstryxTableColumnHelperProvenance(column);
}

function validateRuntimeFieldCapabilities(options: RuntimeColumnOptions): void {
  if (
    Object.hasOwn(options, "blankValue") &&
    options["isEditable"] !== true &&
    typeof options["isEditable"] !== "function"
  ) {
    throw new TypeError("AstryxTable blankValue requires potential field editability.");
  }
  if (
    Object.hasOwn(options, "validate") &&
    options["validate"] !== undefined &&
    typeof options["validate"] !== "function"
  ) {
    throw new TypeError("AstryxTable validate must be a function.");
  }
  if (
    typeof options["validate"] === "function" &&
    options["isEditable"] !== true &&
    typeof options["isEditable"] !== "function"
  ) {
    throw new TypeError("AstryxTable validate requires potential field editability.");
  }
  const hasGroupPresentation =
    Object.hasOwn(options, "groupKeyValueFormatter") ||
    Object.hasOwn(options, "groupKeyCellClassName") ||
    Object.hasOwn(options, "groupKeyCellRenderer");
  if (hasGroupPresentation && options["groupBy"] !== true) {
    throw new TypeError("AstryxTable group-key presentation requires groupBy: true.");
  }

  const hasAggregatePresentation =
    Object.hasOwn(options, "aggregateValueFormatter") ||
    Object.hasOwn(options, "aggregateCellClassName") ||
    Object.hasOwn(options, "aggregateCellRenderer");
  if (hasAggregatePresentation && typeof options["aggFunc"] !== "string") {
    throw new TypeError("AstryxTable aggregate presentation requires aggFunc.");
  }

  const aggFunc = options["aggFunc"];
  if (aggFunc === undefined) return;
  if (typeof aggFunc !== "string") {
    throw new TypeError("AstryxTable Column received an unsupported aggFunc.");
  }
  const valueType = options["valueType"];
  const supported = isRecord(valueType)
    ? isRecord(valueType["aggregateResults"]) &&
      Object.hasOwn(valueType["aggregateResults"], aggFunc)
    : valueType === "bigint"
      ? new Set(["countDistinct", "sum", "min", "max"]).has(aggFunc)
      : new Set(["countDistinct", "min", "max"]).has(aggFunc);
  if (!supported) {
    throw new TypeError(`AstryxTable ${String(valueType)} Column received an unsupported aggFunc.`);
  }
}

function isComputedColumnOptions(options: RuntimeColumnOptions): boolean {
  return Object.hasOwn(options, "fields") || Object.hasOwn(options, "valueGetter");
}

function omitFieldOnlyPresetDefaults(defaults: RuntimeColumnOptions): RuntimeColumnOptions {
  return Object.fromEntries(
    Reflect.ownKeys(defaults)
      .filter(
        (key) =>
          !fieldOnlyPresetKeys.has(key) &&
          key !== "groupBy" &&
          key !== "groupKeyValueFormatter" &&
          key !== "groupKeyCellClassName" &&
          key !== "groupKeyCellRenderer" &&
          key !== "aggFunc" &&
          key !== "aggregateValueFormatter" &&
          key !== "aggregateCellClassName" &&
          key !== "aggregateCellRenderer",
      )
      .map((key) => [key, defaults[key]]),
  );
}

function isRecord(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function AstryxTableTextColumnBase<
  TRow,
  TField extends FieldOfKind<TRow, string>,
  const TOptions extends FieldInput<TRow, TField, "text">,
>(
  options: TOptions,
): HelperResult<TextBuiltIn, TOptions, AstryxTableFieldColumnDefinition<TRow, TField, "text">>;
function AstryxTableTextColumnBase<
  TRow,
  const TFields extends AstryxTableNonEmptyFields<TRow>,
  const TOptions extends ComputedOptions<TRow, TFields, string, "text">,
>(
  options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, string>,
): HelperResult<
  TextBuiltIn,
  TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, string>,
  AstryxTableComputedColumnDefinition<TRow, TFields, string, "text">
>;
function AstryxTableTextColumnBase(options: RuntimeColumnOptions) {
  return mergeRuntimeColumn(textBuiltInDefaults, {}, options);
}

function AstryxTableTextColumnWithDefaults<const TDefaults extends PresetDefaults<string>>(
  defaults: TDefaults,
): BuiltInColumnPreset<string, "text", TextBuiltIn, TDefaults> {
  const defaultsSnapshot = snapshotPresetDefaults(defaults, presetDefaultKeys);
  function AstryxTableTextColumnPreset<
    TRow,
    TField extends FieldOfKind<TRow, string>,
    const TOptions extends ApplyDefaults<FieldInput<TRow, TField, "text">, TDefaults>,
  >(
    options: TOptions & EffectiveFieldPresetCapability<TRow, TField, TDefaults, TOptions>,
  ): PresetResult<
    TextBuiltIn,
    TDefaults,
    TOptions,
    AstryxTableFieldColumnDefinition<TRow, TField, "text">
  >;
  function AstryxTableTextColumnPreset<
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ApplyDefaults<
      ComputedOptions<TRow, TFields, string, "text">,
      ComputedPresetDefaults<TDefaults>
    >,
  >(
    options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, string>,
  ): PresetResult<
    TextBuiltIn,
    ComputedPresetDefaults<TDefaults>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, string>,
    AstryxTableComputedColumnDefinition<TRow, TFields, string, "text">
  >;
  function AstryxTableTextColumnPreset(options: RuntimeColumnOptions) {
    return mergeRuntimeColumn(textBuiltInDefaults, defaultsSnapshot, options);
  }

  return AstryxTableTextColumnPreset;
}

export const AstryxTableTextColumn: BuiltInColumnHelper<
  string,
  "text",
  TextBuiltIn,
  PresetDefaults<string>
> = Object.assign(AstryxTableTextColumnBase, {
  withDefaults: AstryxTableTextColumnWithDefaults,
});

function AstryxTableNumberColumnBase<
  TRow,
  TField extends FieldOfKind<TRow, number>,
  const TOptions extends FieldInput<TRow, TField, "number">,
>(
  options: TOptions,
): HelperResult<NumberBuiltIn, TOptions, AstryxTableFieldColumnDefinition<TRow, TField, "number">>;
function AstryxTableNumberColumnBase<
  TRow,
  const TFields extends AstryxTableNonEmptyFields<TRow>,
  const TOptions extends ComputedOptions<TRow, TFields, number, "number">,
>(
  options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, number>,
): HelperResult<
  NumberBuiltIn,
  TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, number>,
  AstryxTableComputedColumnDefinition<TRow, TFields, number, "number">
>;
function AstryxTableNumberColumnBase(options: RuntimeColumnOptions) {
  return mergeRuntimeColumn(numberBuiltInDefaults, {}, options);
}

function AstryxTableNumberColumnWithDefaults<const TDefaults extends NumberPresetDefaults>(
  defaults: TDefaults,
): BuiltInColumnPreset<number, "number", NumberBuiltIn, TDefaults> {
  const defaultsSnapshot = snapshotPresetDefaults(defaults, numberPresetDefaultKeys);
  function AstryxTableNumberColumnPreset<
    TRow,
    TField extends FieldOfKind<TRow, number>,
    const TOptions extends ApplyDefaults<FieldInput<TRow, TField, "number">, TDefaults>,
  >(
    options: TOptions & EffectiveFieldPresetCapability<TRow, TField, TDefaults, TOptions>,
  ): PresetResult<
    NumberBuiltIn,
    TDefaults,
    TOptions,
    AstryxTableFieldColumnDefinition<TRow, TField, "number">
  >;
  function AstryxTableNumberColumnPreset<
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ApplyDefaults<
      ComputedOptions<TRow, TFields, number, "number">,
      ComputedPresetDefaults<TDefaults>
    >,
  >(
    options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, number>,
  ): PresetResult<
    NumberBuiltIn,
    ComputedPresetDefaults<TDefaults>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, number>,
    AstryxTableComputedColumnDefinition<TRow, TFields, number, "number">
  >;
  function AstryxTableNumberColumnPreset(options: RuntimeColumnOptions) {
    return mergeRuntimeColumn(numberBuiltInDefaults, defaultsSnapshot, options);
  }

  return AstryxTableNumberColumnPreset;
}

export const AstryxTableNumberColumn: BuiltInColumnHelper<
  number,
  "number",
  NumberBuiltIn,
  NumberPresetDefaults
> = Object.assign(AstryxTableNumberColumnBase, {
  withDefaults: AstryxTableNumberColumnWithDefaults,
});

function AstryxTableBigIntColumnBase<
  TRow,
  TField extends FieldOfKind<TRow, bigint>,
  const TOptions extends FieldInput<TRow, TField, "bigint">,
>(
  options: TOptions,
): HelperResult<BigIntBuiltIn, TOptions, AstryxTableFieldColumnDefinition<TRow, TField, "bigint">>;
function AstryxTableBigIntColumnBase<
  TRow,
  const TFields extends AstryxTableNonEmptyFields<TRow>,
  const TOptions extends ComputedOptions<TRow, TFields, bigint, "bigint">,
>(
  options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, bigint>,
): HelperResult<
  BigIntBuiltIn,
  TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, bigint>,
  AstryxTableComputedColumnDefinition<TRow, TFields, bigint, "bigint">
>;
function AstryxTableBigIntColumnBase(options: RuntimeColumnOptions) {
  return mergeRuntimeColumn(bigIntBuiltInDefaults, {}, options);
}

function AstryxTableBigIntColumnWithDefaults<const TDefaults extends PresetDefaults<bigint>>(
  defaults: TDefaults,
): BuiltInColumnPreset<bigint, "bigint", BigIntBuiltIn, TDefaults> {
  const defaultsSnapshot = snapshotPresetDefaults(defaults, presetDefaultKeys);
  function AstryxTableBigIntColumnPreset<
    TRow,
    TField extends FieldOfKind<TRow, bigint>,
    const TOptions extends ApplyDefaults<FieldInput<TRow, TField, "bigint">, TDefaults>,
  >(
    options: TOptions & EffectiveFieldPresetCapability<TRow, TField, TDefaults, TOptions>,
  ): PresetResult<
    BigIntBuiltIn,
    TDefaults,
    TOptions,
    AstryxTableFieldColumnDefinition<TRow, TField, "bigint">
  >;
  function AstryxTableBigIntColumnPreset<
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ApplyDefaults<
      ComputedOptions<TRow, TFields, bigint, "bigint">,
      ComputedPresetDefaults<TDefaults>
    >,
  >(
    options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, bigint>,
  ): PresetResult<
    BigIntBuiltIn,
    ComputedPresetDefaults<TDefaults>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, bigint>,
    AstryxTableComputedColumnDefinition<TRow, TFields, bigint, "bigint">
  >;
  function AstryxTableBigIntColumnPreset(options: RuntimeColumnOptions) {
    return mergeRuntimeColumn(bigIntBuiltInDefaults, defaultsSnapshot, options);
  }

  return AstryxTableBigIntColumnPreset;
}

export const AstryxTableBigIntColumn: BuiltInColumnHelper<
  bigint,
  "bigint",
  BigIntBuiltIn,
  PresetDefaults<bigint>
> = Object.assign(AstryxTableBigIntColumnBase, {
  withDefaults: AstryxTableBigIntColumnWithDefaults,
});

function AstryxTableBooleanColumnBase<
  TRow,
  TField extends FieldOfKind<TRow, boolean>,
  const TOptions extends FieldInput<TRow, TField, "boolean">,
>(
  options: TOptions,
): HelperResult<BooleanBuiltIn, TOptions, AstryxTableFieldColumnDefinition<TRow, TField, "boolean">>;
function AstryxTableBooleanColumnBase<
  TRow,
  const TFields extends AstryxTableNonEmptyFields<TRow>,
  const TOptions extends ComputedOptions<TRow, TFields, boolean, "boolean">,
>(
  options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, boolean>,
): HelperResult<
  BooleanBuiltIn,
  TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, boolean>,
  AstryxTableComputedColumnDefinition<TRow, TFields, boolean, "boolean">
>;
function AstryxTableBooleanColumnBase(options: RuntimeColumnOptions) {
  return mergeRuntimeColumn(booleanBuiltInDefaults, {}, options);
}

function AstryxTableBooleanColumnWithDefaults<const TDefaults extends PresetDefaults<boolean>>(
  defaults: TDefaults,
): BuiltInColumnPreset<boolean, "boolean", BooleanBuiltIn, TDefaults> {
  const defaultsSnapshot = snapshotPresetDefaults(defaults, presetDefaultKeys);
  function AstryxTableBooleanColumnPreset<
    TRow,
    TField extends FieldOfKind<TRow, boolean>,
    const TOptions extends ApplyDefaults<FieldInput<TRow, TField, "boolean">, TDefaults>,
  >(
    options: TOptions & EffectiveFieldPresetCapability<TRow, TField, TDefaults, TOptions>,
  ): PresetResult<
    BooleanBuiltIn,
    TDefaults,
    TOptions,
    AstryxTableFieldColumnDefinition<TRow, TField, "boolean">
  >;
  function AstryxTableBooleanColumnPreset<
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ApplyDefaults<
      ComputedOptions<TRow, TFields, boolean, "boolean">,
      ComputedPresetDefaults<TDefaults>
    >,
  >(
    options: TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, boolean>,
  ): PresetResult<
    BooleanBuiltIn,
    ComputedPresetDefaults<TDefaults>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, boolean>,
    AstryxTableComputedColumnDefinition<TRow, TFields, boolean, "boolean">
  >;
  function AstryxTableBooleanColumnPreset(options: RuntimeColumnOptions) {
    return mergeRuntimeColumn(booleanBuiltInDefaults, defaultsSnapshot, options);
  }

  return AstryxTableBooleanColumnPreset;
}

export const AstryxTableBooleanColumn: BuiltInColumnHelper<
  boolean,
  "boolean",
  BooleanBuiltIn,
  PresetDefaults<boolean>
> = Object.assign(AstryxTableBooleanColumnBase, {
  withDefaults: AstryxTableBooleanColumnWithDefaults,
});

type NonEmptySelectOptions<TValue extends AstryxTableSelectValue = AstryxTableSelectValue> =
  readonly [TValue, ...TValue[]];

type SelectValueType<TValue> = InternalSelectValueType<TValue>;

type SelectBuiltIn<TValue> = {
  readonly valueType: SelectValueType<TValue>;
  readonly cellAlign: "start";
  readonly editorLayout: "fullWidth";
  readonly width: 160;
};

type ExactSelectDomain<TLeft, TRight> = [TLeft] extends [TRight]
  ? [TRight] extends [TLeft]
    ? unknown
    : never
  : never;

type SelectFieldInput<
  TRow,
  TField extends AstryxTableFieldKey<TRow>,
  TOptions extends NonEmptySelectOptions,
  TColumnId extends AstryxTableColumnId = AstryxTableColumnId,
> = DistributiveOmit<
  FieldInput<TRow, TField, SelectValueType<AstryxTableNonNullish<TRow[TField]>>, TColumnId>,
  "options"
> & {
  readonly options: TOptions;
};

type SelectComputedInput<
  TRow,
  TFields extends AstryxTableNonEmptyFields<TRow>,
  TOptions extends NonEmptySelectOptions,
> = ComputedOptions<TRow, TFields, TOptions[number], SelectValueType<TOptions[number]>> & {
  readonly options: TOptions;
};

type SelectPresetDefaults<TOptions extends NonEmptySelectOptions> = PresetDefaults<
  TOptions[number]
> & {
  readonly options: TOptions;
};

type SelectColumnPreset<
  TDefaultOptions extends NonEmptySelectOptions,
  TDefaults extends SelectPresetDefaults<TDefaultOptions>,
> = {
  <
    TRow,
    const TField extends FieldOfKind<TRow, TDefaultOptions[number]>,
    const TColumnId extends AstryxTableColumnId,
    const TOptions extends ApplyDefaults<
      SelectFieldInput<TRow, TField, TDefaultOptions, TColumnId>,
      TDefaults
    > & { readonly options?: never },
  >(
    options: TOptions &
      FieldIdentity<TField, TColumnId> &
      EffectiveFieldPresetCapability<TRow, TField, TDefaults, TOptions> &
      ExactSelectDomain<TDefaultOptions[number], AstryxTableNonNullish<TRow[TField]>> &
      OnlyKnownKeys<
        TOptions,
        ApplyDefaults<SelectFieldInput<TRow, TField, TDefaultOptions, TColumnId>, TDefaults>
      >,
  ): PresetResult<
    SelectBuiltIn<AstryxTableNonNullish<TRow[TField]>>,
    TDefaults,
    TOptions,
    AstryxTableFieldColumnDefinition<
      TRow,
      TField,
      SelectValueType<AstryxTableNonNullish<TRow[TField]>>,
      void,
      TColumnId
    >
  >;
  <
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ApplyDefaults<
      ComputedOptions<
        TRow,
        TFields,
        TDefaultOptions[number],
        SelectValueType<TDefaultOptions[number]>
      >,
      ComputedPresetDefaults<TDefaults>
    > & { readonly options?: never },
  >(
    options: TOptions &
      AstryxTableColumnIdentityInput<TOptions> &
      AstryxTableComputedColumnDependencies<TRow, TFields, TDefaultOptions[number]> &
      OnlyKnownKeys<
        TOptions,
        ComputedOptions<
          TRow,
          TFields,
          TDefaultOptions[number],
          SelectValueType<TDefaultOptions[number]>
        > &
          AstryxTableComputedColumnDependencies<TRow, TFields, TDefaultOptions[number]>
      >,
  ): PresetResult<
    SelectBuiltIn<TDefaultOptions[number]>,
    ComputedPresetDefaults<TDefaults>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, TDefaultOptions[number]>,
    AstryxTableComputedColumnDefinition<
      TRow,
      TFields,
      TDefaultOptions[number],
      SelectValueType<TDefaultOptions[number]>
    >
  >;
};

type SelectColumnHelper = {
  <
    TRow,
    const TSelectOptions extends NonEmptySelectOptions,
    const TField extends FieldOfKind<TRow, TSelectOptions[number]>,
    const TColumnId extends AstryxTableColumnId,
    const TOptions extends SelectFieldInput<TRow, TField, TSelectOptions, TColumnId>,
  >(
    options: TOptions &
      FieldIdentity<TField, TColumnId> & { readonly options: TSelectOptions } & ExactSelectDomain<
        TSelectOptions[number],
        AstryxTableNonNullish<TRow[TField]>
      > &
      OnlyKnownKeys<TOptions, SelectFieldInput<TRow, TField, TSelectOptions, TColumnId>>,
  ): HelperResult<
    SelectBuiltIn<AstryxTableNonNullish<TRow[TField]>>,
    TOptions,
    AstryxTableFieldColumnDefinition<
      TRow,
      TField,
      SelectValueType<AstryxTableNonNullish<TRow[TField]>>,
      void,
      TColumnId
    >
  >;
  <
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TSelectOptions extends NonEmptySelectOptions,
    const TOptions extends SelectComputedInput<TRow, TFields, TSelectOptions>,
  >(
    options: TOptions & { readonly options: TSelectOptions } & AstryxTableComputedColumnDependencies<
        TRow,
        TFields,
        TSelectOptions[number]
      > &
      AstryxTableColumnIdentityInput<TOptions> &
      OnlyKnownKeys<
        TOptions,
        SelectComputedInput<TRow, TFields, TSelectOptions> &
          AstryxTableComputedColumnDependencies<TRow, TFields, TSelectOptions[number]>
      >,
  ): HelperResult<
    SelectBuiltIn<TSelectOptions[number]>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, TSelectOptions[number]>,
    AstryxTableComputedColumnDefinition<
      TRow,
      TFields,
      TSelectOptions[number],
      SelectValueType<TSelectOptions[number]>
    >
  >;
  readonly withDefaults: <
    const TDefaultOptions extends NonEmptySelectOptions,
    const TDefaults extends SelectPresetDefaults<TDefaultOptions>,
  >(
    defaults: TDefaults & { readonly options: TDefaultOptions } & OnlyKnownKeys<
        TDefaults,
        SelectPresetDefaults<TDefaultOptions>
      >,
  ) => SelectColumnPreset<TDefaultOptions, TDefaults>;
};

function AstryxTableSelectColumnBase<
  TRow,
  const TSelectOptions extends NonEmptySelectOptions,
  TField extends FieldOfKind<TRow, TSelectOptions[number]>,
  const TOptions extends SelectFieldInput<TRow, TField, TSelectOptions>,
>(
  options: TOptions & { readonly options: TSelectOptions } & ExactSelectDomain<
      TSelectOptions[number],
      AstryxTableNonNullish<TRow[TField]>
    >,
): HelperResult<
  SelectBuiltIn<AstryxTableNonNullish<TRow[TField]>>,
  TOptions,
  AstryxTableFieldColumnDefinition<TRow, TField, SelectValueType<AstryxTableNonNullish<TRow[TField]>>>
>;
function AstryxTableSelectColumnBase<
  TRow,
  const TFields extends AstryxTableNonEmptyFields<TRow>,
  const TSelectOptions extends NonEmptySelectOptions,
  const TOptions extends SelectComputedInput<TRow, TFields, TSelectOptions>,
>(
  options: TOptions & { readonly options: TSelectOptions } & AstryxTableComputedColumnDependencies<
      TRow,
      TFields,
      TSelectOptions[number]
    >,
): HelperResult<
  SelectBuiltIn<TSelectOptions[number]>,
  TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, TSelectOptions[number]>,
  AstryxTableComputedColumnDefinition<
    TRow,
    TFields,
    TSelectOptions[number],
    SelectValueType<TSelectOptions[number]>
  >
>;
function AstryxTableSelectColumnBase(options: RuntimeColumnOptions) {
  return mergeSelectRuntimeColumn({}, options);
}

function AstryxTableSelectColumnWithDefaults<
  const TDefaultOptions extends NonEmptySelectOptions,
  const TDefaults extends SelectPresetDefaults<TDefaultOptions>,
>(
  defaults: TDefaults & { readonly options: TDefaultOptions },
): SelectColumnPreset<TDefaultOptions, TDefaults> {
  const defaultsSnapshot = snapshotPresetDefaults(defaults, selectPresetDefaultKeys);
  function AstryxTableSelectColumnPreset<
    TRow,
    TField extends FieldOfKind<TRow, TDefaultOptions[number]>,
    const TOptions extends ApplyDefaults<
      SelectFieldInput<TRow, TField, TDefaultOptions>,
      TDefaults
    > & { readonly options?: never },
  >(
    options: TOptions &
      EffectiveFieldPresetCapability<TRow, TField, TDefaults, TOptions> &
      ExactSelectDomain<TDefaultOptions[number], AstryxTableNonNullish<TRow[TField]>>,
  ): PresetResult<
    SelectBuiltIn<AstryxTableNonNullish<TRow[TField]>>,
    TDefaults,
    TOptions,
    AstryxTableFieldColumnDefinition<
      TRow,
      TField,
      SelectValueType<AstryxTableNonNullish<TRow[TField]>>
    >
  >;
  function AstryxTableSelectColumnPreset<
    TRow,
    const TFields extends AstryxTableNonEmptyFields<TRow>,
    const TOptions extends ApplyDefaults<
      ComputedOptions<
        TRow,
        TFields,
        TDefaultOptions[number],
        SelectValueType<TDefaultOptions[number]>
      >,
      ComputedPresetDefaults<TDefaults>
    > & { readonly options?: never },
  >(
    options: TOptions &
      AstryxTableComputedColumnDependencies<TRow, TFields, TDefaultOptions[number]>,
  ): PresetResult<
    SelectBuiltIn<TDefaultOptions[number]>,
    ComputedPresetDefaults<TDefaults>,
    TOptions & AstryxTableComputedColumnDependencies<TRow, TFields, TDefaultOptions[number]>,
    AstryxTableComputedColumnDefinition<
      TRow,
      TFields,
      TDefaultOptions[number],
      SelectValueType<TDefaultOptions[number]>
    >
  >;
  function AstryxTableSelectColumnPreset(options: RuntimeColumnOptions) {
    return mergeSelectRuntimeColumn(defaultsSnapshot, options);
  }

  return AstryxTableSelectColumnPreset;
}

export const AstryxTableSelectColumn: SelectColumnHelper = Object.assign(
  AstryxTableSelectColumnBase,
  {
    withDefaults: AstryxTableSelectColumnWithDefaults,
  },
);

function mergeSelectRuntimeColumn(
  defaults: RuntimeColumnOptions,
  options: RuntimeColumnOptions,
): RuntimeColumnOptions {
  if (Object.hasOwn(defaults, "options") && Object.hasOwn(options, "options")) {
    throw new TypeError(
      "AstryxTable Select Column preset options cannot be overridden at the column invocation.",
    );
  }
  const merged = { ...defaults, ...options };
  const selectOptions = merged["options"];

  if (!Array.isArray(selectOptions) || selectOptions.length === 0) {
    throw new TypeError("AstryxTable Select Column options must be a non-empty array.");
  }

  const optionsSnapshot = Object.freeze(Array.from(selectOptions));
  const valueType = createSelectValueType(optionsSnapshot);

  const column = mergeRuntimeColumn(
    {
      valueType,
      cellAlign: "start",
      editorLayout: "fullWidth",
      width: 160,
    },
    defaults,
    { ...options, options: optionsSnapshot },
  );
  return column;
}

function snapshotPresetDefaults(
  defaults: RuntimeColumnOptions,
  allowedKeys: ReadonlySet<PropertyKey>,
): RuntimeColumnOptions {
  for (const key of Reflect.ownKeys(defaults)) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`AstryxTable Column Helper preset does not accept ${String(key)}.`);
    }
  }

  if (
    Object.hasOwn(defaults, "blankValue") &&
    defaults["isEditable"] !== true &&
    typeof defaults["isEditable"] !== "function"
  ) {
    throw new TypeError(
      "AstryxTable Column Helper preset blankValue requires potential editability.",
    );
  }
  if (
    Object.hasOwn(defaults, "validate") &&
    defaults["validate"] !== undefined &&
    typeof defaults["validate"] !== "function"
  ) {
    throw new TypeError("AstryxTable Column Helper preset validate must be a function.");
  }
  if (
    typeof defaults["validate"] === "function" &&
    defaults["isEditable"] !== true &&
    typeof defaults["isEditable"] !== "function"
  ) {
    throw new TypeError("AstryxTable Column Helper preset validate requires potential editability.");
  }

  const format = defaults["format"];
  const options = defaults["options"];
  validateRuntimeFormat(format);
  return Object.freeze({
    ...defaults,
    ...(isRecord(format) ? { format: Object.freeze({ ...format }) } : {}),
    ...(Array.isArray(options) ? { options: Object.freeze(Array.from(options)) } : {}),
  });
}

function validateRuntimeFormat(value: unknown): Readonly<Record<PropertyKey, unknown>> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new TypeError("AstryxTable Number Column format must be an object when provided.");
  }
  return value;
}

function validateRuntimeColumnOptions(
  builtIn: RuntimeColumnOptions,
  options: RuntimeColumnOptions,
): void {
  const isComputed = isComputedColumnOptions(options);
  const shapeKeys = isComputed ? computedColumnOptionKeys : fieldColumnOptionKeys;
  const valueType = builtIn["valueType"];
  const acceptsFormat = valueType === "number";
  const acceptsSelectOptions = isRecord(valueType) && valueType["filterFamily"] === "select";

  for (const key of Reflect.ownKeys(options)) {
    if (
      !commonColumnOptionKeys.has(key) &&
      !shapeKeys.has(key) &&
      !(key === "format" && acceptsFormat) &&
      !(key === "options" && acceptsSelectOptions)
    ) {
      throw new TypeError(`AstryxTable Column Helper does not accept ${String(key)}.`);
    }
  }
}

function createSelectValueType(options: readonly unknown[]): SelectValueType<unknown> {
  const kind = typeof options[0];
  if (!isSelectPrimitiveKind(kind) || options.some((option) => typeof option !== kind)) {
    throw new TypeError(
      "AstryxTable Select Column options must use one homogeneous string, number, bigint, or boolean domain.",
    );
  }

  if (
    kind === "number" &&
    options.some((option) => typeof option !== "number" || !Number.isFinite(option))
  ) {
    throw new TypeError("AstryxTable Select Column number options must be finite.");
  }

  const canonicalOptions = options.map(formatSelectCanonicalText);
  if (new Set(canonicalOptions).size !== canonicalOptions.length) {
    throw new TypeError("AstryxTable Select Column options must be semantically unique.");
  }

  type SelectOptionAdmission = Readonly<{
    readonly value: unknown;
    readonly index: number;
    readonly canonicalText: string;
  }>;
  const admissions = options.map(
    (value, index): SelectOptionAdmission =>
      Object.freeze({ value, index, canonicalText: canonicalOptions[index]! }),
  );
  const admissionByValue = new Map(admissions.map((admission) => [admission.value, admission]));
  const admissionByCanonicalText = new Map(
    admissions.map((admission) => [admission.canonicalText, admission]),
  );
  const requireAdmission = (input: unknown): SelectOptionAdmission => {
    const admission = admissionByValue.get(input);
    if (admission === undefined) {
      throw new TypeError("Value is not one of the configured Select options.");
    }
    return admission;
  };
  const decodeOption = (input: unknown) => {
    const admission = admissionByValue.get(input);
    return admission === undefined
      ? ({
          _tag: "Failure",
          message: "Value is not one of the configured Select options.",
        } as const)
      : ({ _tag: "Success", value: admission.value } as const);
  };

  const descriptor: SelectValueType<unknown> = {
    codecId: "@bruno/table/select",
    codecVersion: 1,
    filterFamily: "select",
    editorFamily: "select",
    cellAlign: "start",
    editorLayout: "fullWidth",
    defaultWidth: 160,
    decodeRuntime: decodeOption,
    equivalent: (left, right) => requireAdmission(left) === requireAdmission(right),
    compare: (left, right) =>
      compareIndexes(requireAdmission(left).index, requireAdmission(right).index),
    formatCanonicalText: (value) => requireAdmission(value).canonicalText,
    parseCanonicalText: (text) => {
      const admission = admissionByCanonicalText.get(text);
      return admission === undefined
        ? { _tag: "Failure", message: "Text is not one of the configured Select options." }
        : { _tag: "Success", value: admission.value };
    },
    formatDisplay: (value) => requireAdmission(value).canonicalText,
    encodePersisted: (value) => ({
      $astryxTableValue: "select",
      version: 1,
      value: encodeSelectPrimitive(requireAdmission(value).value),
    }),
    decodePersisted: (input) => {
      if (!isRecord(input) || input["$astryxTableValue"] !== "select" || input["version"] !== 1) {
        return { _tag: "Failure", message: "Persisted Select value has an invalid tag." };
      }
      return decodeOption(decodeSelectPrimitive(input["value"]));
    },
  };
  attachAstryxTableSelectValueTypeProvenance(descriptor, kind, canonicalOptions);
  return Object.freeze(descriptor);
}

function isSelectPrimitiveKind(kind: string): kind is "string" | "number" | "bigint" | "boolean" {
  return kind === "string" || kind === "number" || kind === "bigint" || kind === "boolean";
}

function formatSelectCanonicalText(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof value === "bigint"
      ? value.toString(10)
      : String(value);
}

function compareIndexes(left: number, right: number): AstryxTableOrdering {
  return left === right ? 0 : left < right ? -1 : 1;
}

function encodeSelectPrimitive(value: unknown): AstryxTableJsonValue {
  switch (typeof value) {
    case "string":
      return { type: "string", value };
    case "number":
      return { type: "number", value: String(value) };
    case "bigint":
      return { type: "bigint", value: value.toString(10) };
    case "boolean":
      return { type: "boolean", value };
    default:
      throw new TypeError("AstryxTable Select Column cannot encode an unsupported value.");
  }
}

function decodeSelectPrimitive(input: unknown): unknown {
  if (!isRecord(input) || typeof input["type"] !== "string") {
    return undefined;
  }

  const value = input["value"];
  switch (input["type"]) {
    case "string":
      return typeof value === "string" ? value : undefined;
    case "number": {
      if (typeof value !== "string" || value.trim().length === 0) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "bigint":
      return typeof value === "string" && /^-?\d+$/u.test(value) ? BigInt(value) : undefined;
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    default:
      return undefined;
  }
}
