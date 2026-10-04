/** Proves that a value-only publication leaves the last committed TanStack order intact. */
export class ClientSortStability<TRow extends { readonly rowId: string }> {
  private source: readonly TRow[] | undefined;
  private order: readonly string[] | undefined;
  private sourceIndexes: readonly number[] = [];
  private positions = new Map<number, number>();

  public constructor(private readonly compare: (left: TRow, right: TRow) => number) {}

  public commit(rows: readonly TRow[], rowIds: readonly string[]): void {
    if (this.source === rows && this.order === rowIds) return;
    const indexes = new Map(rows.map((row, index) => [row.rowId, index]));
    this.source = rows;
    this.order = rowIds;
    this.sourceIndexes = rowIds.map((id) => indexes.get(id) ?? -1);
    this.positions = new Map(this.sourceIndexes.map((index, position) => [index, position]));
  }

  public preserves(
    previousRows: readonly TRow[],
    nextRows: readonly TRow[],
    index: number,
  ): boolean {
    if (this.source !== previousRows || previousRows.length !== nextRows.length) return false;
    const position = this.positions.get(index);
    const row = nextRows[index];
    if (position === undefined || row === undefined || row.rowId !== this.order?.[position])
      return false;
    // Every changed row is checked against the next publication, not stale neighbour values.
    // If every affected edge is still ordered, the entire committed order remains valid.
    try {
      for (const offset of [-1, 1]) {
        const neighbourPosition = position + offset;
        if (neighbourPosition < 0 || neighbourPosition >= this.sourceIndexes.length) continue;
        const neighbour = nextRows[this.sourceIndexes[neighbourPosition]!];
        if (neighbour === undefined || neighbour.rowId !== this.order?.[neighbourPosition])
          return false;
        const comparison = offset < 0 ? this.compare(neighbour, row) : this.compare(row, neighbour);
        if (!Number.isFinite(comparison) || comparison > 0) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
