export const ASTRYX_TABLE_ROWS_COLUMN_ID = "COL_ID_ASTRYX_TABLE_ROWS" as const;

type AstryxTableServerGroupedPresence =
  | Readonly<{ readonly _tag: "Missing" }>
  | Readonly<{ readonly _tag: "Present"; readonly value: unknown }>;

export type AstryxTableServerGroupedRowSnapshot = Readonly<{
  readonly rowId: string;
  readonly rowCount: bigint;
  readonly groupKeys: readonly AstryxTableServerGroupedPresence[];
  readonly values: ReadonlyMap<string, unknown>;
  readonly presences: ReadonlyMap<string, AstryxTableServerGroupedPresence>;
}>;

const astryxTableServerGroupedRows = new WeakSet<object>();

export function markAstryxTableServerGroupedRow(row: AstryxTableServerGroupedRowSnapshot): void {
  astryxTableServerGroupedRows.add(row);
}

export function isAstryxTableServerGroupedRow(
  row: unknown,
): row is AstryxTableServerGroupedRowSnapshot {
  return typeof row === "object" && row !== null && astryxTableServerGroupedRows.has(row);
}
