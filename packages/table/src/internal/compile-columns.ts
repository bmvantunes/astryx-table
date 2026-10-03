import type { AstryxTableAggFunc, AstryxTableColumnId } from "../public-types";
import { getAstryxTableColumnHelperProvenanceMismatch } from "./column-helper-provenance";
import {
  compileColumnValueSemantics,
  ValueSemanticsConfigurationError,
  type CompiledColumnValueSemantics,
} from "./value-semantics";

const columnIdPrefix = "COL_ID_";
const ASTRYX_TABLE_ROWS_COLUMN_ID = "COL_ID_ASTRYX_TABLE_ROWS";
const ASTRYX_TABLE_ROW_SELECTION_COLUMN_ID = "COL_ID_ASTRYX_TABLE_ROW_SELECTION";
const ASTRYX_TABLE_MAX_SELECT_OPTIONS = 16_384;
const columnIdSuffixStartPattern = /^[A-Z0-9_]/u;
const columnIdWhitespacePattern = /\s/u;
type RuntimeColumnDefinition = Readonly<Record<PropertyKey, unknown>>;
type RuntimeCallback = (...parameters: never[]) => unknown;

type CompiledColumnBase = {
  readonly columnId: AstryxTableColumnId;
  readonly headerName: string;
  readonly pinned?: "start" | "end";
  readonly valueType: unknown;
  readonly semantics: ReturnType<typeof compileColumnValueSemantics>;
  readonly selectOptions?: readonly unknown[];
  /** Exact and canonical Select lookup indexes compiled once with the column semantics. */
  readonly selectOptionIndexes?: ReadonlyMap<unknown, number>;
  readonly selectOptionCanonicalIndexes?: ReadonlyMap<string, number>;
  readonly enableFilter: boolean;
  readonly enableSetFilter: boolean;
  readonly enableSorting: boolean;
  readonly valueFormatter?: RuntimeCallback;
  readonly cellClassName?: string | RuntimeCallback;
  readonly cellRenderer?: RuntimeCallback;
};

export type CompiledFieldColumn = CompiledColumnBase & {
  readonly kind: "field";
  readonly field: string;
  readonly groupBy: boolean;
  readonly aggFunc?: AstryxTableAggFunc;
  readonly isEditable?: boolean | RuntimeCallback;
  readonly blankValue?: Readonly<{ readonly value: null | undefined }>;
  readonly validate?: RuntimeCallback;
  readonly groupKeyValueFormatter?: RuntimeCallback;
  readonly groupKeyCellClassName?: string | RuntimeCallback;
  readonly groupKeyCellRenderer?: RuntimeCallback;
  readonly aggregateValueFormatter?: RuntimeCallback;
  readonly aggregateCellClassName?: string | RuntimeCallback;
  readonly aggregateCellRenderer?: RuntimeCallback;
};

export type CompiledComputedColumn = CompiledColumnBase & {
  readonly kind: "computed";
  readonly fields: readonly [string, ...string[]];
  readonly valueGetter: RuntimeCallback;
};

export type CompiledColumn = CompiledFieldColumn | CompiledComputedColumn;

export class ColumnConfigurationError extends TypeError {}

export function compileColumns(columns: readonly unknown[]): readonly CompiledColumn[] {
  const seen = new Set<string>();
  const compiled = Array.from(columns, (column, index) => compileColumn(column, index, seen));

  return Object.freeze(compiled);
}

function compileColumn(candidate: unknown, index: number, seen: Set<string>): CompiledColumn {
  if (!isRuntimeColumnDefinition(candidate)) {
    throw new ColumnConfigurationError(`AstryxTable column at index ${index} must be an object.`);
  }

  const provenanceMismatch = getAstryxTableColumnHelperProvenanceMismatch(candidate);
  if (provenanceMismatch !== undefined) {
    const columnIdDescriptor = Object.getOwnPropertyDescriptor(candidate, "columnId");
    const diagnosticColumnId =
      columnIdDescriptor !== undefined &&
      "value" in columnIdDescriptor &&
      typeof columnIdDescriptor.value === "string"
        ? columnIdDescriptor.value
        : `at index ${String(index)}`;
    throw new ColumnConfigurationError(
      `AstryxTable Column Helper structural evidence does not match ${provenanceMismatch}: ${diagnosticColumnId}`,
    );
  }

  const hasField = Object.hasOwn(candidate, "field");
  const hasFields = Object.hasOwn(candidate, "fields");
  const hasValueGetter = Object.hasOwn(candidate, "valueGetter");
  const hasEnableFilter = Object.hasOwn(candidate, "enableFilter");
  const hasEnableSetFilter = Object.hasOwn(candidate, "enableSetFilter");
  const hasEnableSorting = Object.hasOwn(candidate, "enableSorting");
  const hasIsEditable = Object.hasOwn(candidate, "isEditable");
  const hasValidate = Object.hasOwn(candidate, "validate");
  const hasBlankValue = Object.hasOwn(candidate, "blankValue");
  const hasValueFormatter = Object.hasOwn(candidate, "valueFormatter");
  const hasCellClassName = Object.hasOwn(candidate, "cellClassName");
  const hasCellRenderer = Object.hasOwn(candidate, "cellRenderer");
  const hasCellAlign = Object.hasOwn(candidate, "cellAlign");
  const hasEditorLayout = Object.hasOwn(candidate, "editorLayout");
  const hasWidth = Object.hasOwn(candidate, "width");
  const hasFormat = Object.hasOwn(candidate, "format");
  const hasPinned = Object.hasOwn(candidate, "pinned");
  const hasGroupBy = Object.hasOwn(candidate, "groupBy");
  const hasAggFunc = Object.hasOwn(candidate, "aggFunc");
  const columnId = candidate["columnId"];
  const groupPresentation = compilePresentationCallbacks(candidate, columnId, "groupKey");
  const aggregatePresentation = compilePresentationCallbacks(candidate, columnId, "aggregate");

  if (columnId === ASTRYX_TABLE_ROWS_COLUMN_ID) {
    throw new ColumnConfigurationError(
      `AstryxTable columnId is reserved for the Rows System Column: ${columnId}`,
    );
  }

  if (columnId === ASTRYX_TABLE_ROW_SELECTION_COLUMN_ID) {
    throw new ColumnConfigurationError(
      `AstryxTable columnId is reserved for the Row Selection Column: ${columnId}`,
    );
  }

  if (!isColumnId(columnId)) {
    throw new ColumnConfigurationError(
      "AstryxTable columnId must start with COL_ID_, begin its suffix with A-Z, 0-9, or _, and have an uppercase suffix.",
    );
  }

  if (seen.has(columnId)) {
    throw new ColumnConfigurationError(`AstryxTable columnId must be unique: ${columnId}`);
  }
  seen.add(columnId);

  const headerName = candidate["headerName"];
  if (typeof headerName !== "string" || headerName.trim().length === 0) {
    throw new ColumnConfigurationError(
      `AstryxTable headerName must be a non-empty string for column: ${columnId}`,
    );
  }

  const valueType = candidate["valueType"];
  const cellAlign = hasCellAlign ? candidate["cellAlign"] : undefined;
  const editorLayout = hasEditorLayout ? candidate["editorLayout"] : undefined;
  const width = hasWidth ? candidate["width"] : undefined;
  const format = hasFormat ? candidate["format"] : undefined;
  const pinned = hasPinned ? candidate["pinned"] : undefined;
  if (pinned !== undefined && pinned !== "start" && pinned !== "end") {
    throw new ColumnConfigurationError(
      `AstryxTable pinned must be start or end when provided: ${columnId}`,
    );
  }
  let semantics: ReturnType<typeof compileColumnValueSemantics>;
  try {
    semantics = compileColumnValueSemantics(valueType, { cellAlign, editorLayout, width, format });
  } catch (error) {
    if (!(error instanceof ValueSemanticsConfigurationError)) throw error;
    throw new ColumnConfigurationError(`${error.message} Column: ${columnId}`);
  }
  semantics = nullableSafeSemantics(semantics);
  let selectOptions: readonly unknown[] | undefined;
  let selectOptionIndexes: ReadonlyMap<unknown, number> | undefined;
  let selectOptionCanonicalIndexes: ReadonlyMap<string, number> | undefined;
  if (semantics.filterFamily === "select" && hasField && Object.hasOwn(candidate, "options")) {
    const options = candidate["options"];
    if (!Array.isArray(options)) {
      throw new ColumnConfigurationError(
        `AstryxTable Select column options must be a non-empty array: ${columnId}`,
      );
    }
    const optionCount = options.length;
    if (optionCount === 0) {
      throw new ColumnConfigurationError(
        `AstryxTable Select column options must be a non-empty array: ${columnId}`,
      );
    }
    if (optionCount > ASTRYX_TABLE_MAX_SELECT_OPTIONS) {
      throw new ColumnConfigurationError(
        `AstryxTable Select column options must contain at most ${String(ASTRYX_TABLE_MAX_SELECT_OPTIONS)} values: ${columnId}`,
      );
    }
    const decodedOptions: unknown[] = [];
    const exactIndexes = new Map<unknown, number>();
    const canonicalIndexes = new Map<string, number>();
    for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
      if (!Object.hasOwn(options, optionIndex)) {
        throw new ColumnConfigurationError(
          `AstryxTable Select column options must be dense: ${columnId}`,
        );
      }
      const option = options[optionIndex];
      let decoded: ReturnType<typeof semantics.decodeRuntime>;
      try {
        decoded = semantics.decodeRuntime(option);
      } catch {
        throw new ColumnConfigurationError(
          `AstryxTable Select column option at index ${String(optionIndex)} is invalid for ${columnId}: decoding failed.`,
        );
      }
      if (decoded._tag === "Failure") {
        throw new ColumnConfigurationError(
          `AstryxTable Select column option at index ${String(optionIndex)} is invalid for ${columnId}: ${decoded.message}`,
        );
      }
      decodedOptions.push(decoded.value);
      if (!exactIndexes.has(decoded.value)) exactIndexes.set(decoded.value, optionIndex);
      try {
        const canonical = semantics.formatCanonicalText(decoded.value);
        if (!canonicalIndexes.has(canonical)) canonicalIndexes.set(canonical, optionIndex);
      } catch {
        // Exact identity remains available when a custom canonical formatter rejects an option.
      }
    }
    selectOptions = Object.freeze(decodedOptions);
    selectOptionIndexes = exactIndexes;
    selectOptionCanonicalIndexes = canonicalIndexes;
  }

  const valueFormatter = hasValueFormatter ? candidate["valueFormatter"] : undefined;
  if (hasValueFormatter && typeof valueFormatter !== "function") {
    throw new ColumnConfigurationError(
      `AstryxTable valueFormatter must be a function when provided: ${columnId}`,
    );
  }

  const cellClassName = hasCellClassName ? candidate["cellClassName"] : undefined;
  if (
    hasCellClassName &&
    typeof cellClassName !== "string" &&
    typeof cellClassName !== "function"
  ) {
    throw new ColumnConfigurationError(
      `AstryxTable cellClassName must be a string or function when provided: ${columnId}`,
    );
  }

  const cellRenderer = hasCellRenderer ? candidate["cellRenderer"] : undefined;
  if (hasCellRenderer && typeof cellRenderer !== "function") {
    throw new ColumnConfigurationError(
      `AstryxTable cellRenderer must be a function when provided: ${columnId}`,
    );
  }

  if (hasField) {
    const blankValue = candidate["blankValue"];
    if (hasBlankValue && blankValue !== null && blankValue !== undefined) {
      throw new ColumnConfigurationError(
        `AstryxTable blankValue must be null or undefined: ${columnId}`,
      );
    }
    if (hasFields || hasValueGetter) {
      throw new ColumnConfigurationError(
        `AstryxTable column cannot combine field with fields or valueGetter: ${columnId}`,
      );
    }

    const field = candidate["field"];
    if (typeof field !== "string" || field.trim().length === 0) {
      throw new ColumnConfigurationError(
        `AstryxTable field must be a non-empty string for column: ${columnId}`,
      );
    }

    const isEditable = hasIsEditable ? candidate["isEditable"] : undefined;
    if (hasIsEditable && typeof isEditable !== "boolean" && typeof isEditable !== "function") {
      throw new ColumnConfigurationError(
        `AstryxTable isEditable must be a boolean or function when provided: ${columnId}`,
      );
    }
    if (hasBlankValue && (isEditable === undefined || isEditable === false)) {
      throw new ColumnConfigurationError(
        `AstryxTable blankValue requires a potentially editable field column: ${columnId}`,
      );
    }
    const validate = hasValidate ? candidate["validate"] : undefined;
    if (validate !== undefined && typeof validate !== "function") {
      throw new ColumnConfigurationError(
        `AstryxTable validate must be a function when provided: ${columnId}`,
      );
    }
    if (typeof validate === "function" && (isEditable === undefined || isEditable === false)) {
      throw new ColumnConfigurationError(
        `AstryxTable validate requires a potentially editable field column: ${columnId}`,
      );
    }
    if (
      isEditable !== undefined &&
      isEditable !== false &&
      semantics.editorFamily === "select" &&
      semantics.selectEditAuthority === undefined
    ) {
      throw new ColumnConfigurationError(
        `AstryxTable custom Value Types cannot use the Select editor family for editing; use AstryxTableSelectColumn. Column: ${columnId}`,
      );
    }

    const enableFilter = hasEnableFilter ? candidate["enableFilter"] : true;
    if (typeof enableFilter !== "boolean") {
      throw new ColumnConfigurationError(
        `AstryxTable enableFilter must be a boolean when provided: ${columnId}`,
      );
    }

    const enableSetFilter = hasEnableSetFilter
      ? candidate["enableSetFilter"]
      : enableFilter &&
        (semantics.filterFamily === "boolean" || semantics.filterFamily === "select");
    if (typeof enableSetFilter !== "boolean") {
      throw new ColumnConfigurationError(
        `AstryxTable enableSetFilter must be a boolean when provided: ${columnId}`,
      );
    }
    if (!enableFilter && enableSetFilter) {
      throw new ColumnConfigurationError(
        `AstryxTable enableSetFilter requires enableFilter: ${columnId}`,
      );
    }

    const enableSorting = hasEnableSorting ? candidate["enableSorting"] : true;
    if (typeof enableSorting !== "boolean") {
      throw new ColumnConfigurationError(
        `AstryxTable enableSorting must be a boolean when provided: ${columnId}`,
      );
    }

    const groupBy = hasGroupBy ? candidate["groupBy"] : false;
    if (typeof groupBy !== "boolean") {
      throw new ColumnConfigurationError(
        `AstryxTable groupBy must be a boolean when provided: ${columnId}`,
      );
    }
    if (groupPresentation.hasPresentation && !groupBy) {
      throw new ColumnConfigurationError(
        `AstryxTable group-key presentation requires groupBy: true: ${columnId}`,
      );
    }

    const aggFunc = hasAggFunc ? candidate["aggFunc"] : undefined;
    if (aggFunc !== undefined && !isAggFunc(aggFunc)) {
      throw new ColumnConfigurationError(
        `AstryxTable aggFunc is unsupported for column: ${columnId}`,
      );
    }
    if (aggregatePresentation.hasPresentation && aggFunc === undefined) {
      throw new ColumnConfigurationError(
        `AstryxTable aggregate presentation requires aggFunc: ${columnId}`,
      );
    }
    if (aggFunc !== undefined && !Object.hasOwn(semantics.aggregateResults, aggFunc)) {
      throw new ColumnConfigurationError(
        `AstryxTable Value Type does not support ${aggFunc} aggregation: ${columnId}`,
      );
    }

    return Object.freeze({
      kind: "field",
      columnId,
      headerName,
      ...(pinned === undefined ? {} : { pinned }),
      valueType,
      semantics,
      ...(selectOptions === undefined ? {} : { selectOptions }),
      ...(selectOptionIndexes === undefined ? {} : { selectOptionIndexes }),
      ...(selectOptionCanonicalIndexes === undefined ? {} : { selectOptionCanonicalIndexes }),
      field,
      groupBy,
      enableFilter,
      enableSetFilter,
      enableSorting,
      ...(typeof isEditable === "boolean" || typeof isEditable === "function"
        ? { isEditable: isEditable as boolean | RuntimeCallback }
        : {}),
      ...(hasBlankValue
        ? { blankValue: Object.freeze({ value: blankValue as null | undefined }) }
        : {}),
      ...(typeof validate === "function" ? { validate: validate as RuntimeCallback } : {}),
      ...(aggFunc === undefined ? {} : { aggFunc }),
      ...groupPresentation.compiled,
      ...aggregatePresentation.compiled,
      ...(typeof valueFormatter === "function"
        ? { valueFormatter: valueFormatter as RuntimeCallback }
        : {}),
      ...(typeof cellClassName === "string" || typeof cellClassName === "function"
        ? { cellClassName: cellClassName as string | RuntimeCallback }
        : {}),
      ...(typeof cellRenderer === "function"
        ? { cellRenderer: cellRenderer as RuntimeCallback }
        : {}),
    });
  }

  if (!hasFields || !hasValueGetter) {
    throw new ColumnConfigurationError(
      `AstryxTable column must define either field or both fields and valueGetter: ${columnId}`,
    );
  }

  if (hasEnableSetFilter) {
    throw new ColumnConfigurationError(
      `AstryxTable computed columns cannot configure enableSetFilter: ${columnId}`,
    );
  }
  if (hasBlankValue) {
    throw new ColumnConfigurationError(
      `AstryxTable computed columns cannot declare blankValue: ${columnId}`,
    );
  }

  const fieldsCandidate = candidate["fields"];
  if (!Array.isArray(fieldsCandidate)) {
    throw new ColumnConfigurationError(
      `AstryxTable computed fields must be a non-empty tuple of field names: ${columnId}`,
    );
  }

  const candidateFields = Array.from(fieldsCandidate);
  if (
    candidateFields.length === 0 ||
    !candidateFields.every((field) => typeof field === "string" && field.trim().length > 0)
  ) {
    throw new ColumnConfigurationError(
      `AstryxTable computed fields must be a non-empty tuple of field names: ${columnId}`,
    );
  }

  const valueGetter = candidate["valueGetter"];
  if (typeof valueGetter !== "function") {
    throw new ColumnConfigurationError(
      `AstryxTable computed valueGetter must be a function: ${columnId}`,
    );
  }

  if (hasIsEditable) {
    throw new ColumnConfigurationError(
      `AstryxTable computed columns cannot declare isEditable: ${columnId}`,
    );
  }
  if (hasValidate) {
    throw new ColumnConfigurationError(
      `AstryxTable computed columns cannot declare validate: ${columnId}`,
    );
  }

  if (
    hasGroupBy ||
    hasAggFunc ||
    groupPresentation.hasPresentation ||
    aggregatePresentation.hasPresentation
  ) {
    throw new ColumnConfigurationError(
      `AstryxTable computed columns cannot declare grouping or aggregation: ${columnId}`,
    );
  }

  if (hasEnableFilter || hasEnableSorting) {
    throw new ColumnConfigurationError(
      `AstryxTable computed columns cannot declare enableFilter or enableSorting: ${columnId}`,
    );
  }

  const fields = Object.freeze(candidateFields) as readonly [string, ...string[]];

  return Object.freeze({
    kind: "computed",
    columnId,
    headerName,
    ...(pinned === undefined ? {} : { pinned }),
    valueType,
    semantics,
    ...(selectOptions === undefined ? {} : { selectOptions }),
    ...(selectOptionIndexes === undefined ? {} : { selectOptionIndexes }),
    ...(selectOptionCanonicalIndexes === undefined ? {} : { selectOptionCanonicalIndexes }),
    enableFilter: false,
    enableSetFilter: false,
    enableSorting: false,
    fields,
    valueGetter: valueGetter as RuntimeCallback,
    ...(typeof valueFormatter === "function"
      ? { valueFormatter: valueFormatter as RuntimeCallback }
      : {}),
    ...(typeof cellClassName === "string" || typeof cellClassName === "function"
      ? { cellClassName: cellClassName as string | RuntimeCallback }
      : {}),
    ...(typeof cellRenderer === "function"
      ? { cellRenderer: cellRenderer as RuntimeCallback }
      : {}),
  });
}

function nullableSafeSemantics(
  semantics: CompiledColumnValueSemantics,
): CompiledColumnValueSemantics {
  return Object.freeze({
    ...semantics,
    equivalent: (left, right) =>
      left == null || right == null
        ? left == null && right == null
        : semantics.equivalent(left, right),
    compare: (left, right) =>
      left == null || right == null
        ? left == null
          ? right == null
            ? 0
            : -1
          : 1
        : semantics.compare(left, right),
    formatCanonicalText: (value) => (value == null ? "" : semantics.formatCanonicalText(value)),
    formatDisplay: (value) => (value == null ? "" : semantics.formatDisplay(value)),
  });
}

function isRuntimeColumnDefinition(value: unknown): value is RuntimeColumnDefinition {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compilePresentationCallbacks(
  candidate: RuntimeColumnDefinition,
  columnId: unknown,
  family: "groupKey" | "aggregate",
): {
  readonly hasPresentation: boolean;
  readonly compiled: Readonly<Record<string, string | RuntimeCallback>>;
} {
  const valueFormatterKey = `${family}ValueFormatter`;
  const cellClassNameKey = `${family}CellClassName`;
  const cellRendererKey = `${family}CellRenderer`;
  const hasValueFormatter = Object.hasOwn(candidate, valueFormatterKey);
  const hasCellClassName = Object.hasOwn(candidate, cellClassNameKey);
  const hasCellRenderer = Object.hasOwn(candidate, cellRendererKey);
  const valueFormatter = candidate[valueFormatterKey];
  const cellClassName = candidate[cellClassNameKey];
  const cellRenderer = candidate[cellRendererKey];

  if (hasValueFormatter && typeof valueFormatter !== "function") {
    throw new ColumnConfigurationError(
      `AstryxTable ${valueFormatterKey} must be a function when provided: ${String(columnId)}`,
    );
  }
  if (
    hasCellClassName &&
    typeof cellClassName !== "string" &&
    typeof cellClassName !== "function"
  ) {
    throw new ColumnConfigurationError(
      `AstryxTable ${cellClassNameKey} must be a string or function when provided: ${String(columnId)}`,
    );
  }
  if (hasCellRenderer && typeof cellRenderer !== "function") {
    throw new ColumnConfigurationError(
      `AstryxTable ${cellRendererKey} must be a function when provided: ${String(columnId)}`,
    );
  }

  return {
    hasPresentation: hasValueFormatter || hasCellClassName || hasCellRenderer,
    compiled: {
      ...(typeof valueFormatter === "function"
        ? { [valueFormatterKey]: valueFormatter as RuntimeCallback }
        : {}),
      ...(typeof cellClassName === "string" || typeof cellClassName === "function"
        ? { [cellClassNameKey]: cellClassName as string | RuntimeCallback }
        : {}),
      ...(typeof cellRenderer === "function"
        ? { [cellRendererKey]: cellRenderer as RuntimeCallback }
        : {}),
    },
  };
}

function isAggFunc(value: unknown): value is AstryxTableAggFunc {
  return (
    value === "countDistinct" ||
    value === "sum" ||
    value === "min" ||
    value === "max" ||
    value === "avg"
  );
}

function isColumnId(columnId: unknown): columnId is AstryxTableColumnId {
  if (typeof columnId !== "string") {
    return false;
  }

  const suffix = columnId.slice(columnIdPrefix.length);

  return (
    columnId.startsWith(columnIdPrefix) &&
    columnIdSuffixStartPattern.test(suffix) &&
    !columnIdWhitespacePattern.test(suffix) &&
    suffix === suffix.toUpperCase()
  );
}
