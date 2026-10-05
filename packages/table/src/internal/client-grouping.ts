import type { AstryxTableRowId } from "../public-types";
import {
  hasNativeColumnSemantics,
  type CompiledColumn,
  type CompiledFieldColumn,
} from "./compile-columns";
import { isAstryxTableInvalidCellValue } from "./grid-runtime";
import { ASTRYX_TABLE_ROWS_COLUMN_ID } from "./grouped-row";
import { compileColumnValueSemantics, type CompiledColumnValueSemantics } from "./value-semantics";

export { ASTRYX_TABLE_ROWS_COLUMN_ID } from "./grouped-row";

export type AstryxTableGroupedPresence =
  | Readonly<{ readonly _tag: "Missing" }>
  | Readonly<{ readonly _tag: "Present"; readonly value: unknown }>;

export type AstryxTableClientGroupingInputRow = Readonly<{
  /** Adapter-owned immutable admission identity; absent for standalone derivations. */
  readonly preparationIdentity?: object;
  readonly raw: unknown;
  readonly rowId: AstryxTableRowId;
  readonly rowIndex: number;
  readonly readValue: (column: CompiledColumn) => unknown;
}>;

export type AstryxTableClientGroupedRow = Readonly<{
  readonly rowId: AstryxTableRowId;
  readonly rowCount: bigint;
  readonly groupKeys: readonly AstryxTableGroupedPresence[];
  readonly values: ReadonlyMap<string, unknown>;
  readonly presences: ReadonlyMap<string, AstryxTableGroupedPresence>;
}>;

type GroupOrderBy = readonly Readonly<{
  readonly columnId: string;
  readonly direction: "asc" | "desc";
}>[];

export type AstryxTableClientGroupedProjection =
  | Readonly<{
      readonly kind: "ready";
      readonly groupBy: readonly string[];
      readonly rows: readonly AstryxTableClientGroupedRow[];
      readonly rowIds: readonly AstryxTableRowId[];
    }>
  | Readonly<{
      readonly kind: "invalid";
      readonly groupBy: readonly string[];
      readonly invalid:
        | Readonly<{
            readonly kind: "source-row";
            readonly rowIndex: number;
            readonly columnId: string;
            readonly message: string;
          }>
        | Readonly<{
            readonly kind: "group";
            readonly columnId: string;
            readonly message: string;
          }>;
    }>;

type AggregateState =
  | Readonly<{
      readonly kind: "countDistinct";
      readonly column: CompiledFieldColumn;
      readonly values: Set<unknown>;
      readonly nativeIdentity: boolean;
    }>
  | {
      readonly kind: "sum";
      readonly column: CompiledFieldColumn;
      count: bigint;
      total: AstryxTableGroupedPresence;
    }
  | {
      readonly kind: "avg";
      readonly column: CompiledFieldColumn;
      count: bigint;
      total: AstryxTableGroupedPresence;
    }
  | {
      readonly kind: "min";
      readonly column: CompiledFieldColumn;
      selected: AstryxTableGroupedPresence | undefined;
    }
  | {
      readonly kind: "max";
      readonly column: CompiledFieldColumn;
      selected: AstryxTableGroupedPresence | undefined;
    };

type MutableGroup = {
  readonly rowId: AstryxTableRowId;
  readonly insertionIndex: number;
  readonly groupKeys: readonly AstryxTableGroupedPresence[];
  readonly aggregates: Map<string, AggregateState>;
  rowCount: bigint;
  readonly reused?: AstryxTableClientGroupedRow;
};

type PreparedGroupRow = Readonly<{
  readonly rowId: AstryxTableRowId;
  readonly groupKeys: readonly AstryxTableGroupedPresence[];
  readonly aggregates: readonly (AstryxTableGroupedPresence | undefined)[];
}>;
type CachedGroupResult = Readonly<{
  members: readonly object[];
  row: AstryxTableClientGroupedRow;
}>;
const PREPARED_GROUP_VALUE_SLOT_LIMIT = 16_384;
// Membership identities plus retained key, aggregate and Rows result slots.
const GROUP_RESULT_SLOT_LIMIT = 16_384;

/** Bounded latest-successful-projection evidence; custom codecs and aggregate operations always execute. */
export class AstryxTableClientGroupingInputCache {
  private columns: readonly CompiledFieldColumn[] = [];
  private keyCount = 0;
  private rows = new Map<object, PreparedGroupRow>();
  private results = new Map<string, CachedGroupResult>();

  public clear(): void {
    this.columns = [];
    this.keyCount = 0;
    this.rows.clear();
    this.results.clear();
  }

  public begin(keys: readonly CompiledFieldColumn[], aggregates: readonly CompiledFieldColumn[]) {
    const columns = [...keys, ...aggregates];
    if (columns.length === 0 || columns.length > PREPARED_GROUP_VALUE_SLOT_LIMIT) {
      this.clear();
      return undefined;
    }
    if (!keys.every(hasNativeColumnSemantics)) {
      this.clear();
      return undefined;
    }
    const previous =
      keys.length === this.keyCount &&
      columns.length === this.columns.length &&
      columns.every((column, index) => column === this.columns[index])
        ? this.rows
        : undefined;
    const next = new Map<object, PreparedGroupRow>();
    const capacity = Math.floor(PREPARED_GROUP_VALUE_SLOT_LIMIT / columns.length);
    return {
      results: previous === undefined ? undefined : this.results,
      get: (identity: object | undefined) =>
        identity === undefined ? undefined : previous?.get(identity),
      retain: (
        identity: object | undefined,
        rowId: AstryxTableRowId,
        groupKeys: readonly AstryxTableGroupedPresence[],
        aggregates: readonly (AstryxTableGroupedPresence | undefined)[],
      ) => {
        if (identity === undefined || next.size >= capacity) return;
        next.set(
          identity,
          previous?.get(identity) ??
            Object.freeze({
              rowId,
              groupKeys: Object.freeze(groupKeys.map((presence) => Object.freeze(presence))),
              aggregates: Object.freeze(
                aggregates.map((presence) =>
                  presence === undefined ? undefined : Object.freeze(presence),
                ),
              ),
            }),
        );
      },
      commit: (results = new Map<string, CachedGroupResult>()) => {
        this.columns = columns;
        this.keyCount = keys.length;
        this.rows = next;
        this.results = results;
      },
    };
  }
}

const MISSING: AstryxTableGroupedPresence = Object.freeze({ _tag: "Missing" });
const COUNT_DISTINCT_RESULT_SEMANTICS = compileColumnValueSemantics("bigint", {});

type GroupingRow = Pick<AstryxTableClientGroupingInputRow, "raw" | "rowId" | "rowIndex">;
type GroupingOptions = Readonly<{
  readonly columns: readonly CompiledColumn[];
  readonly participatingAggregateColumnIds?: ReadonlySet<string>;
  readonly groupBy: readonly string[];
  readonly groupOrderBy: GroupOrderBy;
  readonly previous?: AstryxTableClientGroupedProjection;
  readonly inputCache?: AstryxTableClientGroupingInputCache;
  /** Private Client Adapter opt-in: reader and tokens describe immutable canonical admissions. */
  readonly reuseNativeResults?: true;
}>;

export function deriveAstryxTableClientGroupedProjection(
  input: GroupingOptions & Readonly<{ rows: readonly AstryxTableClientGroupingInputRow[] }>,
): AstryxTableClientGroupedProjection {
  return deriveAstryxTableClientGroupedProjectionFromRows({
    ...input,
    readValue: (row, column) => row.readValue(column),
    preparationIdentity: (row) => row.preparationIdentity,
  });
}

/** A shared reader avoids allocating a row wrapper and closure per resident input. */
export function deriveAstryxTableClientGroupedProjectionFromRows<TRow extends GroupingRow>(
  input: GroupingOptions &
    Readonly<{
      readonly rows: readonly TRow[];
      readonly readValue: (row: TRow, column: CompiledColumn) => unknown;
      readonly preparationIdentity: (row: TRow) => object | undefined;
    }>,
): AstryxTableClientGroupedProjection {
  const groupBy = Object.freeze(Array.from(input.groupBy));
  try {
    const columnsById = new Map<string, CompiledColumn>(
      input.columns.map((column) => [column.columnId, column]),
    );
    const groupColumns: CompiledFieldColumn[] = [];
    for (const columnId of input.groupBy) {
      const column = columnsById.get(columnId);
      if (column?.kind !== "field" || !column.groupBy) {
        return invalidGroup(groupBy, columnId, "Grouping requires an eligible Field Column.");
      }
      groupColumns.push(column);
    }
    if (groupColumns.length === 0) {
      return invalidGroup(
        groupBy,
        ASTRYX_TABLE_ROWS_COLUMN_ID,
        "Grouping requires at least one Group Key.",
      );
    }
    const activeGroupIds = new Set(input.groupBy);
    const aggregateColumns = input.columns.filter(
      (column): column is CompiledFieldColumn =>
        column.kind === "field" &&
        column.aggFunc !== undefined &&
        !activeGroupIds.has(column.columnId) &&
        (input.participatingAggregateColumnIds === undefined ||
          input.participatingAggregateColumnIds.has(column.columnId)),
    );
    const identityColumns = groupColumns.map((column) => ({
      column,
      prefix: frame(column.columnId) + frame(column.semantics.codecId),
      // Repeated built-in text/boolean keys have canonical primitive identity.
      // Custom Value Types keep their own exact encoding on every read.
      keys:
        hasNativeColumnSemantics(column) &&
        (column.valueType === "text" || column.valueType === "boolean")
          ? new Map<unknown, string>()
          : undefined,
    }));
    const preparation = input.inputCache?.begin(groupColumns, aggregateColumns);
    // Speculative keys are safe only at the canonical Client Adapter seam.
    // On failure use the original source-ordered executor so its first error wins.
    const membership =
      input.reuseNativeResults &&
      preparation !== undefined &&
      input.rows.length * (groupColumns.length + aggregateColumns.length) <=
        PREPARED_GROUP_VALUE_SLOT_LIMIT &&
      [...groupColumns, ...aggregateColumns].every(hasNativeColumnSemantics)
        ? prepareGroupMembership(
            input.rows,
            input.preparationIdentity,
            (row, identity) => {
              const prepared = preparation.get(identity);
              if (prepared !== undefined) return prepared;
              const groupKeys = groupColumns.map((column) =>
                readPresence(row, column, input.readValue),
              );
              return { groupKeys, rowId: groupIdentity(identityColumns, groupKeys) };
            },
            groupColumns.length + aggregateColumns.length + 1,
            preparation.results,
          )
        : undefined;
    const groups = new Map<string, MutableGroup>();
    for (const row of input.rows) {
      const preparationIdentity = input.preparationIdentity(row);
      const prepared = preparation?.get(preparationIdentity);
      const proof =
        preparationIdentity === undefined ? undefined : membership?.keys.get(preparationIdentity);
      const groupKeys =
        prepared?.groupKeys ??
        proof?.groupKeys ??
        groupColumns.map((column) => readPresence(row, column, input.readValue));
      const rowId = prepared?.rowId ?? proof?.rowId ?? groupIdentity(identityColumns, groupKeys);
      let group = groups.get(rowId);
      if (group === undefined) {
        const reused = membership?.reusable.get(rowId);
        group = {
          rowId,
          insertionIndex: groups.size,
          groupKeys: Object.freeze(groupKeys.map((presence) => Object.freeze(presence))),
          aggregates: new Map(
            reused === undefined
              ? aggregateColumns.map((column) => [column.columnId, createAggregateState(column)])
              : [],
          ),
          ...(reused === undefined ? {} : { reused }),
          rowCount: 0n,
        };
        groups.set(rowId, group);
      }
      group.rowCount += 1n;
      const aggregateValues: (AstryxTableGroupedPresence | undefined)[] | undefined =
        preparation !== undefined && prepared === undefined ? [] : undefined;
      let aggregateIndex = 0;
      for (const state of group.aggregates.values()) {
        const presence =
          prepared?.aggregates[aggregateIndex] ?? readPresence(row, state.column, input.readValue);
        aggregateIndex += 1;
        if (aggregateValues !== undefined) {
          const kind = state.column.valueType;
          aggregateValues.push(
            kind === "text" || kind === "boolean" || kind === "number" || kind === "bigint"
              ? presence
              : undefined,
          );
        }
        const failure = updateAggregate(state, presence);
        if (failure !== undefined) {
          return invalidSourceRow(groupBy, row.rowIndex, state.column.columnId, failure);
        }
      }
      preparation?.retain(
        preparationIdentity,
        rowId,
        groupKeys,
        prepared?.aggregates ?? aggregateValues ?? [],
      );
    }
    const materialized = Array.from(groups.values(), (group) =>
      materializeGroup(group, groupColumns),
    );
    const sorted = materialized.toSorted((left, right) =>
      compareGroups(left, right, input.groupOrderBy, columnsById, activeGroupIds),
    );
    const previousProjection = input.previous?.kind === "ready" ? input.previous : undefined;
    const previousRows =
      previousProjection === undefined
        ? undefined
        : new Map(previousProjection.rows.map((row) => [row.rowId, row]));
    const candidateRows = sorted.map((entry) => {
      const previous = previousRows?.get(entry.row.rowId);
      return previous !== undefined &&
        sameGroupedRow(previous, entry.row, columnsById, activeGroupIds)
        ? previous
        : entry.row;
    });
    const rows =
      previousProjection !== undefined &&
      candidateRows.length === previousProjection.rows.length &&
      candidateRows.every((row, index) => row === previousProjection.rows[index])
        ? previousProjection.rows
        : Object.freeze(candidateRows);
    const nextResults = new Map<string, CachedGroupResult>();
    if (membership !== undefined) {
      for (const row of rows) {
        nextResults.set(row.rowId, {
          members: Object.freeze(membership.members.get(row.rowId)!),
          row,
        });
      }
    }
    preparation?.commit(nextResults);
    return Object.freeze({
      kind: "ready",
      groupBy,
      rows,
      rowIds: Object.freeze(rows.map((row) => row.rowId)),
    });
  } catch (error) {
    if (error instanceof GroupingAggregateError) {
      return error.rowIndex === undefined
        ? invalidGroup(groupBy, error.columnId, error.message)
        : invalidSourceRow(groupBy, error.rowIndex, error.columnId, error.message);
    }
    return invalidGroup(
      groupBy,
      ASTRYX_TABLE_ROWS_COLUMN_ID,
      error instanceof Error ? error.message : "Grouped projection derivation failed.",
    );
  }
}

function prepareGroupMembership<TRow>(
  rows: readonly TRow[],
  identityOf: (row: TRow) => object | undefined,
  keyOf: (row: TRow, identity: object) => Pick<PreparedGroupRow, "rowId" | "groupKeys">,
  resultSlots: number,
  previous: ReadonlyMap<string, CachedGroupResult> | undefined,
) {
  if (rows.length > GROUP_RESULT_SLOT_LIMIT) return undefined;
  const members = new Map<string, object[]>();
  const keys = new Map<object, Pick<PreparedGroupRow, "rowId" | "groupKeys">>();
  try {
    for (const row of rows) {
      const identity = identityOf(row);
      if (identity === undefined) return undefined;
      const key = keyOf(row, identity);
      keys.set(identity, key);
      let group = members.get(key.rowId);
      if (group === undefined) {
        group = [];
        members.set(key.rowId, group);
        if (rows.length + members.size * resultSlots > GROUP_RESULT_SLOT_LIMIT) return undefined;
      }
      group.push(identity);
    }
  } catch {
    return undefined;
  }
  const reusable = new Map<string, AstryxTableClientGroupedRow>();
  for (const [rowId, group] of members) {
    const cached = previous?.get(rowId);
    if (
      cached !== undefined &&
      cached.members.length === group.length &&
      group.every((identity, index) => identity === cached.members[index])
    ) {
      reusable.set(rowId, cached.row);
    }
  }
  return { members, keys, reusable };
}

function readPresence<TRow extends GroupingRow>(
  row: TRow,
  column: CompiledFieldColumn,
  readValue: (row: TRow, column: CompiledColumn) => unknown,
): AstryxTableGroupedPresence {
  if (
    typeof row.raw !== "object" ||
    row.raw === null ||
    !Object.prototype.propertyIsEnumerable.call(row.raw, column.field)
  )
    return MISSING;
  const value = readValue(row, column);
  if (isAstryxTableInvalidCellValue(value)) {
    throw new GroupingAggregateError(column.columnId, value.invalid.message, row.rowIndex);
  }
  const normalizedValue = column.valueType === "number" && Object.is(value, -0) ? 0 : value;
  return { _tag: "Present", value: normalizedValue };
}

function groupIdentity(
  columns: readonly {
    readonly column: CompiledFieldColumn;
    readonly prefix: string;
    readonly keys: Map<unknown, string> | undefined;
  }[],
  values: readonly AstryxTableGroupedPresence[],
): AstryxTableRowId {
  let identity = "ASTRYX_TABLE_GROUP:";
  for (let index = 0; index < columns.length; index += 1) {
    const { column, prefix, keys } = columns[index]!;
    const presence = values[index]!;
    let valueKey: string;
    if (presence._tag === "Missing") valueKey = "0";
    else {
      const cached = keys?.get(presence.value);
      valueKey = cached ?? canonicalPresenceKey(presence, column);
      if (cached === undefined) keys?.set(presence.value, valueKey);
    }
    identity += prefix + frame(valueKey);
  }
  return identity;
}

function frame(value: string): string {
  return `${String(value.length)}:${value}`;
}

function canonicalPresenceKey(
  presence: AstryxTableGroupedPresence,
  column: CompiledFieldColumn,
): string {
  if (presence._tag === "Missing") return "0";
  if (presence.value === null) return "1";
  if (presence.value === undefined) return "2";
  return `3${frame(column.semantics.formatCanonicalText(presence.value))}`;
}

function createAggregateState(column: CompiledFieldColumn): AggregateState {
  switch (column.aggFunc) {
    case "countDistinct":
      return {
        kind: "countDistinct",
        column,
        values: new Set(),
        // Built-in canonical scalar encoding is injective; Set preserves exact
        // primitive identity without allocating a framed string per input.
        nativeIdentity: hasNativeColumnSemantics(column),
      };
    case "sum":
    case "avg":
      return { kind: column.aggFunc, column, count: 0n, total: MISSING };
    case "min":
    case "max":
      return { kind: column.aggFunc, column, selected: undefined };
    case undefined:
      throw new TypeError("Aggregate state requires an aggregate function.");
  }
  throw new TypeError("Aggregate state received an unsupported aggregate function.");
}

function updateAggregate(
  state: AggregateState,
  presence: AstryxTableGroupedPresence,
): string | undefined {
  if (state.kind === "countDistinct") {
    state.values.add(
      state.nativeIdentity
        ? presence._tag === "Missing"
          ? MISSING
          : presence.value
        : canonicalPresenceKey(presence, state.column),
    );
    return undefined;
  }
  if (state.kind === "min" || state.kind === "max") {
    if (
      state.selected === undefined ||
      comparePresence(presence, state.selected, state.column) * (state.kind === "min" ? 1 : -1) < 0
    ) {
      state.selected = presence;
    }
    return undefined;
  }
  if (presence._tag === "Missing") return undefined;
  if (state.total._tag === "Missing") {
    state.total = presence;
    state.count = 1n;
    return undefined;
  }
  const result = state.column.semantics.aggregateAlgebra?.add(state.total.value, presence.value);
  if (result === undefined) return "Aggregate Algebra add operation is unavailable.";
  if (result._tag === "Failure") return result.message;
  state.total = { _tag: "Present", value: result.value };
  state.count += 1n;
  return undefined;
}

function comparePresence(
  left: AstryxTableGroupedPresence,
  right: AstryxTableGroupedPresence,
  column: CompiledFieldColumn,
): number {
  if (left._tag === "Missing") return right._tag === "Missing" ? 0 : -1;
  if (right._tag === "Missing") return 1;
  const leftNullishRank = nullishRank(left.value);
  const rightNullishRank = nullishRank(right.value);
  if (leftNullishRank !== rightNullishRank) return leftNullishRank - rightNullishRank;
  if (leftNullishRank < 2) return 0;
  return column.semantics.compare(left.value, right.value);
}

function nullishRank(value: unknown): 0 | 1 | 2 {
  return value === null ? 0 : value === undefined ? 1 : 2;
}

type MaterializedGroup = Readonly<{
  readonly insertionIndex: number;
  readonly presences: ReadonlyMap<string, AstryxTableGroupedPresence>;
  readonly row: AstryxTableClientGroupedRow;
}>;

function materializeGroup(
  group: MutableGroup,
  groupColumns: readonly CompiledFieldColumn[],
): MaterializedGroup {
  if (group.reused !== undefined) {
    return {
      insertionIndex: group.insertionIndex,
      presences: group.reused.presences,
      row: group.reused,
    };
  }
  const values = new Map<string, unknown>();
  const presences = new Map<string, AstryxTableGroupedPresence>();
  groupColumns.forEach((column, index) => {
    const presence = group.groupKeys[index]!;
    presences.set(column.columnId, presence);
    values.set(column.columnId, presence._tag === "Present" ? presence.value : undefined);
  });
  const rowsPresence: AstryxTableGroupedPresence = Object.freeze({
    _tag: "Present",
    value: group.rowCount,
  });
  presences.set(ASTRYX_TABLE_ROWS_COLUMN_ID, rowsPresence);
  values.set(ASTRYX_TABLE_ROWS_COLUMN_ID, group.rowCount);
  for (const [columnId, state] of group.aggregates) {
    const presence = Object.freeze(aggregateResult(state));
    presences.set(columnId, presence);
    values.set(columnId, presence._tag === "Present" ? presence.value : undefined);
  }
  return Object.freeze({
    insertionIndex: group.insertionIndex,
    presences,
    row: Object.freeze({
      rowId: group.rowId,
      rowCount: group.rowCount,
      groupKeys: group.groupKeys,
      values,
      presences,
    }),
  });
}

function sameGroupedRow(
  previous: AstryxTableClientGroupedRow,
  next: AstryxTableClientGroupedRow,
  columnsById: ReadonlyMap<string, CompiledColumn>,
  activeGroupIds: ReadonlySet<string>,
): boolean {
  if (previous.rowCount !== next.rowCount || previous.presences.size !== next.presences.size) {
    return false;
  }
  for (const [columnId, nextPresence] of next.presences) {
    const previousPresence = previous.presences.get(columnId);
    if (previousPresence === undefined || previousPresence._tag !== nextPresence._tag) return false;
    if (nextPresence._tag === "Missing" || previousPresence._tag === "Missing") continue;
    if (columnId === ASTRYX_TABLE_ROWS_COLUMN_ID) {
      if (previousPresence.value !== nextPresence.value) return false;
      continue;
    }
    const column = columnsById.get(columnId);
    if (column === undefined) return false;
    try {
      if (
        previousPresence.value === null ||
        previousPresence.value === undefined ||
        nextPresence.value === null ||
        nextPresence.value === undefined
      ) {
        if (previousPresence.value !== nextPresence.value) return false;
        continue;
      }
      const semantics = activeGroupIds.has(columnId) ? column.semantics : resultSemantics(column);
      if (!semantics.equivalent(previousPresence.value, nextPresence.value)) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

function aggregateResult(state: AggregateState): AstryxTableGroupedPresence {
  if (state.kind === "countDistinct") {
    return Object.freeze({ _tag: "Present", value: BigInt(state.values.size) });
  }
  if (state.kind === "min" || state.kind === "max" || state.kind === "sum") {
    return state.kind === "sum" && state.total._tag === "Missing"
      ? MISSING
      : state.kind === "sum"
        ? state.total
        : (state.selected ?? MISSING);
  }
  if (state.total._tag === "Missing") return MISSING;
  const result = state.column.semantics.aggregateAlgebra?.divideByCount?.(
    state.total.value,
    state.count,
  );
  if (result === undefined || result._tag === "Failure") {
    throw new GroupingAggregateError(
      state.column.columnId,
      result?._tag === "Failure" ? result.message : "Aggregate Algebra division is unavailable.",
    );
  }
  return Object.freeze({ _tag: "Present", value: result.value });
}

function compareGroups(
  left: MaterializedGroup,
  right: MaterializedGroup,
  orderBy: GroupOrderBy,
  columnsById: ReadonlyMap<string, CompiledColumn>,
  activeGroupIds: ReadonlySet<string>,
): number {
  for (const order of orderBy) {
    const leftValue = left.presences.get(order.columnId) ?? MISSING;
    const rightValue = right.presences.get(order.columnId) ?? MISSING;
    let comparison: number;
    if (order.columnId === ASTRYX_TABLE_ROWS_COLUMN_ID) {
      comparison = compareBigIntPresence(leftValue, rightValue);
    } else {
      const column = columnsById.get(order.columnId);
      if (column?.kind !== "field") continue;
      comparison = comparePresenceWithSemantics(
        leftValue,
        rightValue,
        activeGroupIds.has(column.columnId) ? column.semantics : resultSemantics(column),
      );
    }
    if (comparison !== 0) return order.direction === "asc" ? comparison : -comparison;
  }
  return left.insertionIndex - right.insertionIndex;
}

function resultSemantics(column: CompiledColumn): CompiledColumnValueSemantics {
  return column.kind === "field" && column.aggFunc === "countDistinct"
    ? COUNT_DISTINCT_RESULT_SEMANTICS
    : column.semantics;
}

function comparePresenceWithSemantics(
  left: AstryxTableGroupedPresence,
  right: AstryxTableGroupedPresence,
  semantics: CompiledColumnValueSemantics,
): number {
  if (left._tag === "Missing") return right._tag === "Missing" ? 0 : -1;
  if (right._tag === "Missing") return 1;
  const leftNullishRank = nullishRank(left.value);
  const rightNullishRank = nullishRank(right.value);
  if (leftNullishRank !== rightNullishRank) return leftNullishRank - rightNullishRank;
  if (leftNullishRank < 2) return 0;
  return semantics.compare(left.value, right.value);
}

function compareBigIntPresence(
  left: AstryxTableGroupedPresence,
  right: AstryxTableGroupedPresence,
): number {
  if (left._tag === "Missing") return right._tag === "Missing" ? 0 : -1;
  if (right._tag === "Missing") return 1;
  const leftValue = left.value as bigint;
  const rightValue = right.value as bigint;
  return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
}

class GroupingAggregateError extends Error {
  public constructor(
    public readonly columnId: string,
    message: string,
    public readonly rowIndex?: number,
  ) {
    super(message);
  }
}

function invalidGroup(
  groupBy: readonly string[],
  columnId: string,
  message: string,
): AstryxTableClientGroupedProjection {
  return Object.freeze({
    kind: "invalid",
    groupBy,
    invalid: Object.freeze({ kind: "group", columnId, message }),
  });
}

function invalidSourceRow(
  groupBy: readonly string[],
  rowIndex: number,
  columnId: string,
  message: string,
): AstryxTableClientGroupedProjection {
  return Object.freeze({
    kind: "invalid",
    groupBy,
    invalid: Object.freeze({ kind: "source-row", rowIndex, columnId, message }),
  });
}
