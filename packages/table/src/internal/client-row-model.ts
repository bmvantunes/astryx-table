export {
  collectClientFilterColumnIds,
  createClientFilterPredicate,
  filterClientRows,
  filterReferencesColumn,
  reconcileClientOrderBy,
  sanitizeClientInitialFilters,
  sanitizeClientInitialOrderBy,
  sanitizeClientOrderBy,
} from "./grid-query";

import type { AstryxTableInvalidCellValue } from "./grid-runtime";

import type { CompiledColumn } from "./compile-columns";
import type { ClientOrderBy } from "./grid-query";

export function createAstryxTableClientRowComparator<TRow>(
  columns: readonly CompiledColumn[],
  orderBy: ClientOrderBy,
  readValue: (column: CompiledColumn, row: TRow) => unknown,
  readSourceIndex: (row: TRow) => number,
): (left: TRow, right: TRow) => number {
  const columnsById = new Map<string, CompiledColumn>(
    columns.map((column) => [column.columnId, column]),
  );
  return (left, right) => {
    for (const sort of orderBy) {
      const column = columnsById.get(sort.columnId);
      if (column === undefined || column.enableSorting === false) continue;
      const leftValue = readValue(column, left);
      const rightValue = readValue(column, right);
      let comparison: number;
      try {
        comparison = column.semantics.compare(leftValue, rightValue);
      } catch {
        throw new ClientQueryValueError(
          Object.freeze({
            kind: "invalid-value",
            rowIndex: readSourceIndex(left),
            columnId: column.columnId,
            message: "Unable to compare source values.",
          }),
        );
      }
      if (comparison !== 0) return sort.direction === "desc" ? -comparison : comparison;
    }
    return readSourceIndex(left) - readSourceIndex(right);
  };
}

export type { AstryxTableOrderBy, ClientOrderBy } from "./grid-query";

// Both raw TanStack models and grouped projection planning consume this evidence.
export class ClientQueryValueError extends Error {
  public constructor(public readonly invalid: AstryxTableInvalidCellValue["invalid"]) {
    super(invalid.message);
  }
}
