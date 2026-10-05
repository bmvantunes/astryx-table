import { LoadingSelectionCell, ROW_SELECTION_WIDTH } from "./row-selection-view";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { TableContext, TableRow, TableCell } from "@astryxdesign/core/Table";
import { memo, useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CompiledColumn } from "./compile-columns";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import {
  AstryxTableLoadingViewportAdapterBoundary,
  type AstryxTableLoadingViewportAdapterState,
} from "./react-compiler-adapters";
import { nativeTableAppearance, cellDomId } from "./native-table-presentation";
import {
  ASTRYX_TABLE_DEFAULT_VIEWPORT_HEIGHT,
  ASTRYX_TABLE_ROW_HEIGHT,
  ASTRYX_TABLE_PREPARED_ENTERING_DISPLAY_CSS_VARIABLE,
  ASTRYX_TABLE_PREPARED_RETIRING_DISPLAY_CSS_VARIABLE,
} from "./virtual-viewport";
import { astryxTableColumnCssVariable } from "./column-management";

// SourceBody owns focus transfer across both loaded and loading renderers.
const noFocusTransfer = { release: () => undefined, claim: () => false };
const noFocusFallback = () => undefined;

export const LoadingGrid = memo(function LoadingGrid({
  runtime,
  columns,
  structuralColumns,
  totalRows,
  ariaRowCount,
  tableId,
  setRequiredRange,
  rowSelection = false,
}: {
  readonly rowSelection?: boolean;
  readonly setRequiredRange?: ((start: number, end: number) => void) | undefined;
  readonly runtime: AstryxTableRuntimeView;
  readonly columns: readonly CompiledColumn[];
  readonly structuralColumns: readonly CompiledColumn[] | undefined;
  readonly totalRows: number;
  readonly ariaRowCount: number;
  readonly tableId: string;
}) {
  return (
    <AstryxTableLoadingViewportAdapterBoundary
      key={rowSelection ? "selection" : "ordinary"}
      leadingUtilityWidth={rowSelection ? ROW_SELECTION_WIDTH : 0}
      runtime={runtime}
      compiledColumns={columns}
      structuralColumns={structuralColumns}
      totalRows={totalRows}
      defaultLoadingRowCount={5}
      focusFallback={noFocusFallback}
      focusHandoff={noFocusTransfer}
    >
      {(adapter) => (
        <LoadingSurface
          rowSelection={rowSelection}
          adapter={adapter}
          tableId={tableId}
          ariaRowCount={ariaRowCount}
          setRequiredRange={setRequiredRange}
        />
      )}
    </AstryxTableLoadingViewportAdapterBoundary>
  );
});

function loadingCellId(
  adapter: AstryxTableLoadingViewportAdapterState,
  tableId: string,
  rowIndex: number,
  columnId: string,
) {
  return `loading-${cellDomId(adapter.instanceId, tableId, String(rowIndex), columnId)}`;
}

function LoadingSurface({
  adapter,
  tableId,
  ariaRowCount,
  setRequiredRange,
  rowSelection,
}: {
  readonly rowSelection: boolean;
  readonly setRequiredRange?: ((start: number, end: number) => void) | undefined;
  readonly adapter: AstryxTableLoadingViewportAdapterState;
  readonly tableId: string;
  readonly ariaRowCount: number;
}) {
  const [attachGrid] = useState(() => adapter.attachGrid);
  const [attachRowLayer] = useState(() => adapter.attachRowLayer);
  const [attachBodyLayer] = useState(() => adapter.attachBodyLayer);
  const layout = adapter.viewportSnapshot.virtualWindow;
  useLayoutEffect(() => {
    setRequiredRange?.(layout.rowStart, layout.rowEnd);
  }, [setRequiredRange, layout.rowStart, layout.rowEnd]);
  const utilityWidth = rowSelection ? ROW_SELECTION_WIDTH : 0;
  const utilityColumns = rowSelection ? 1 : 0;
  const selectionId = (rowIndex: number) => `loading-selection-${adapter.instanceId}-${rowIndex}`;
  const fill =
    layout.pinnedEnd.length === 0
      ? 0
      : Math.max(0, adapter.viewportSnapshot.width - layout.totalWidth - utilityWidth);
  const width = layout.totalWidth + fill + utilityWidth;
  const startWidth = layout.pinnedStart.reduce((sum, column) => sum + column.semantics.width, 0);
  const ownedColumns = [...layout.pinnedStart, ...layout.center, ...layout.pinnedEnd];
  const offsets = Array.from({ length: layout.rowEnd - layout.rowStart }, (_, offset) => offset);
  const top = (offset: number) =>
    (layout.segmentedRows ? offset : layout.rowStart + offset) * ASTRYX_TABLE_ROW_HEIGHT;
  return (
    <div
      ref={attachGrid}
      role="grid"
      aria-label="Loading table rows"
      aria-busy="true"
      aria-rowcount={ariaRowCount}
      aria-colcount={adapter.columns.length + utilityColumns}
      tabIndex={0}
      style={{
        overflow: "auto",
        position: "relative",
        maxHeight: ASTRYX_TABLE_DEFAULT_VIEWPORT_HEIGHT,
      }}
    >
      <TableContext value={nativeTableAppearance}>
        <div
          ref={attachRowLayer}
          aria-hidden={ariaRowCount === 0}
          style={{ position: "relative", width }}
        >
          <table role="presentation" style={{ display: "block", borderCollapse: "collapse" }}>
            <tbody
              role="presentation"
              style={{ display: "block", position: "relative", height: layout.totalHeight }}
            >
              {offsets.map((offset) => {
                const rowIndex = layout.rowStart + offset;
                return (
                  <TableRow
                    key={rowIndex}
                    ref={attachBodyLayer}
                    role="row"
                    aria-rowindex={rowIndex + 1}
                    aria-owns={
                      !rowSelection && layout.pinnedStart.length + layout.pinnedEnd.length === 0
                        ? undefined
                        : [
                            ...(rowSelection ? [selectionId(rowIndex)] : []),
                            ...ownedColumns.map((column) =>
                              loadingCellId(adapter, tableId, rowIndex, column.columnId),
                            ),
                          ].join(" ")
                    }
                    style={{
                      display: "flex",
                      position: "absolute",
                      top: top(offset),
                      height: ASTRYX_TABLE_ROW_HEIGHT,
                      width,
                      boxSizing: "border-box",
                      paddingInlineStart: utilityWidth + startWidth + layout.leftPadding,
                    }}
                  >
                    {layout.center.map((column, index) => (
                      <LoadingCell
                        key={column.columnId}
                        column={column}
                        columnIndex={
                          utilityColumns +
                          layout.pinnedStart.length +
                          layout.centerStartIndex +
                          index
                        }
                        id={loadingCellId(adapter, tableId, rowIndex, column.columnId)}
                      />
                    ))}
                  </TableRow>
                );
              })}
            </tbody>
          </table>
          {(["start", "end"] as const).map((side) => {
            const columns = side === "start" ? layout.pinnedStart : layout.pinnedEnd;
            if (columns.length === 0 && !(side === "start" && rowSelection)) return null;
            const pinnedWidth =
              (side === "start" ? utilityWidth : 0) +
              columns.reduce((sum, column) => sum + column.semantics.width, 0);
            return (
              <div
                key={side}
                style={{
                  display: "flex",
                  position: "absolute",
                  insetInlineStart: 0,
                  top: 0,
                  width,
                  height: layout.totalHeight,
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    insetInlineStart: side === "start" ? 0 : undefined,
                    insetInlineEnd: side === "end" ? 0 : undefined,
                    marginInlineStart: side === "end" ? "auto" : undefined,
                    width: pinnedWidth,
                    height: layout.totalHeight,
                    pointerEvents: "auto",
                  }}
                >
                  <table
                    role="presentation"
                    style={{ display: "block", borderCollapse: "collapse", width: pinnedWidth }}
                  >
                    <tbody
                      role="presentation"
                      style={{ display: "block", position: "relative", height: layout.totalHeight }}
                    >
                      {offsets.map((offset) => {
                        const rowIndex = layout.rowStart + offset;
                        return (
                          <TableRow
                            key={rowIndex}
                            ref={attachBodyLayer}
                            role="presentation"
                            style={{
                              display: "flex",
                              position: "absolute",
                              top: top(offset),
                              height: ASTRYX_TABLE_ROW_HEIGHT,
                              width: pinnedWidth,
                            }}
                          >
                            {side === "start" && rowSelection ? (
                              <LoadingSelectionCell id={selectionId(rowIndex)} />
                            ) : null}
                            {columns.map((column, index) => (
                              <LoadingCell
                                key={column.columnId}
                                column={column}
                                columnIndex={
                                  side === "start"
                                    ? utilityColumns + index
                                    : utilityColumns +
                                      adapter.columns.length -
                                      columns.length +
                                      index
                                }
                                id={loadingCellId(adapter, tableId, rowIndex, column.columnId)}
                              />
                            ))}
                          </TableRow>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </TableContext>
    </div>
  );
}

export function LoadingCell({
  column,
  columnIndex,
  id,
  preparedStage,
  rowIndex,
}: {
  readonly column: CompiledColumn;
  readonly columnIndex: number;
  readonly id: string;
  readonly preparedStage?: "entering" | "retiring" | undefined;
  readonly rowIndex?: number | undefined;
}) {
  return (
    <TableCell
      id={id}
      scope={undefined}
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-label={`Loading ${column.headerName}`}
      data-astryx-column-id={column.columnId}
      data-astryx-loading-row-index={rowIndex}
      style={{
        height: ASTRYX_TABLE_ROW_HEIGHT,
        width: `var(${astryxTableColumnCssVariable("width", column.columnId)}, ${column.semantics.width}px)`,
        flexShrink: 0,
        overflow: "clip",
        maxWidth: "none",
        transform: `var(${astryxTableColumnCssVariable("transform", column.columnId)}, none)`,
        display:
          preparedStage === undefined
            ? undefined
            : (`var(${preparedStage === "entering" ? ASTRYX_TABLE_PREPARED_ENTERING_DISPLAY_CSS_VARIABLE : ASTRYX_TABLE_PREPARED_RETIRING_DISPLAY_CSS_VARIABLE}, ${preparedStage === "entering" ? "none" : "block"})` as CSSProperties["display"]),
      }}
    >
      <Skeleton
        width="60%"
        height={14}
        style={{
          marginInlineStart:
            column.semantics.cellAlign === "end" || column.semantics.cellAlign === "center"
              ? "auto"
              : 0,
          marginInlineEnd:
            column.semantics.cellAlign === "start" || column.semantics.cellAlign === "center"
              ? "auto"
              : 0,
        }}
      />
    </TableCell>
  );
}
