import type { AstryxTableRowId } from "../public-types";

export function reconcileAstryxTableClientEditSourcePublication(
  authority: Readonly<{ readonly hasAuthoritativeEditSource: () => boolean }>,
  editMemory:
    | Readonly<{
        readonly setSavePreflightAvailable: (available: boolean) => void;
      }>
    | undefined,
  cellEdit:
    | Readonly<{
        readonly reconcileSourceRows: (changedRowIds?: ReadonlySet<AstryxTableRowId>) => void;
        readonly reconcileActiveRow: (changedRowIds?: ReadonlySet<AstryxTableRowId>) => void;
      }>
    | undefined,
  changedRowIds: ReadonlySet<AstryxTableRowId> | undefined,
): void {
  const authoritative = authority.hasAuthoritativeEditSource();
  editMemory?.setSavePreflightAvailable(authoritative);
  if (!authoritative) return;
  cellEdit?.reconcileSourceRows(changedRowIds);
  cellEdit?.reconcileActiveRow(changedRowIds);
}
