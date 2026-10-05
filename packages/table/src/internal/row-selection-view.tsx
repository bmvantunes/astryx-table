import { Skeleton } from "@astryxdesign/core/Skeleton";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { TableCell, TableHeaderCell } from "@astryxdesign/core/Table";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import {
  memo,
  useCallback,
  useSyncExternalStore,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from "react";
import { isAstryxTableShiftPointerActivation } from "./hotkey-adapter";
import { AstryxTableRowSelectionCommitDiagnosticProbe } from "./commit-diagnostic-probes";
import type { AstryxTableRowSelectionRuntime } from "./row-selection";
import { isAstryxTableDocumentFocusChainActive } from "./focus-ownership";
import { ASTRYX_TABLE_ROW_HEIGHT } from "./virtual-viewport";

export const ROW_SELECTION_WIDTH = 40;
const style: CSSProperties = {
  position: "sticky",
  insetInlineStart: 0,
  zIndex: 3,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  width: ROW_SELECTION_WIDTH,
  maxWidth: "none",
  height: ASTRYX_TABLE_ROW_HEIGHT,
  backgroundColor: colorVars["--color-background-surface"],
};
type Props = { readonly selection: AstryxTableRowSelectionRuntime; readonly tableId: string };
export const SelectionHeader = memo(function SelectionHeader({ selection, tableId }: Props) {
  const checkbox = useRef<HTMLInputElement>(null);
  const ownedFocus = useRef(false);
  const snapshot = useSyncExternalStore(
    selection.subscribeHeader,
    selection.getHeaderSnapshot,
    selection.getHeaderSnapshot,
  );
  useLayoutEffect(() => {
    const input = checkbox.current;
    if (!snapshot.disabled || !ownedFocus.current || input === null) return;
    ownedFocus.current = false;
    const document = input.ownerDocument;
    if (
      (document.activeElement === input || document.activeElement === document.body) &&
      isAstryxTableDocumentFocusChainActive(document)
    )
      input.closest<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });
  }, [snapshot.disabled]);
  return (
    <TableHeaderCell role="columnheader" aria-colindex={1} scope="col" style={style}>
      {__ASTRYX_TABLE_TEST_DIAGNOSTICS__ ? (
        <AstryxTableRowSelectionCommitDiagnosticProbe tableId={tableId} commitEvidence={snapshot} />
      ) : null}
      <CheckboxInput
        ref={checkbox}
        onFocus={() => {
          ownedFocus.current = true;
        }}
        onBlur={(event) => {
          if (!event.currentTarget.disabled) ownedFocus.current = false;
        }}
        label="Select all rows"
        isLabelHidden
        size="sm"
        tabIndex={-1}
        aria-keyshortcuts="Control+A Meta+A"
        data-astryx-row-selection-checkbox=""
        value={snapshot.mixed ? "indeterminate" : snapshot.checked}
        isDisabled={snapshot.disabled}
        onChange={(checked) => selection.toggleAll(checked)}
      />
    </TableHeaderCell>
  );
});
export const SelectionCell = memo(function SelectionCell({
  selection,
  tableId,
  rowId,
  rowIndex,
  id,
}: Props & {
  readonly rowId: string | undefined;
  readonly rowIndex: number;
  readonly id: string;
}) {
  const subscribe = useCallback(
    (listener: () => void) =>
      rowId === undefined ? () => undefined : selection.subscribeRow(rowId, listener),
    [selection, rowId],
  );
  const getSnapshot = useCallback(
    () => rowId !== undefined && selection.getRowSnapshot(rowId),
    [selection, rowId],
  );
  const checked = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <TableCell id={id} role="gridcell" aria-colindex={1} style={style}>
      {__ASTRYX_TABLE_TEST_DIAGNOSTICS__ ? (
        <AstryxTableRowSelectionCommitDiagnosticProbe
          tableId={tableId}
          rowId={rowId}
          commitEvidence={checked}
        />
      ) : null}
      <CheckboxInput
        label={`Select row ${rowIndex + 1}`}
        isLabelHidden
        size="sm"
        tabIndex={-1}
        data-astryx-row-selection-checkbox=""
        value={checked}
        isDisabled={rowId === undefined}
        onChange={(next, event) => {
          if (rowId !== undefined)
            selection.toggleRow(
              rowId,
              next,
              isAstryxTableShiftPointerActivation(
                event.nativeEvent,
                event.currentTarget.ownerDocument,
              ),
            );
        }}
      />
    </TableCell>
  );
});

export function LoadingSelectionCell({ id }: { readonly id: string }) {
  return (
    <TableCell
      id={id}
      role="gridcell"
      aria-colindex={1}
      aria-label="Loading row selection"
      style={style}
    >
      <Skeleton width={16} height={16} />
    </TableCell>
  );
}
