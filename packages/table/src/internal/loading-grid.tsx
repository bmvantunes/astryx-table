import { Skeleton } from "@astryxdesign/core/Skeleton";
import { TableContext, TableRow, TableCell } from "@astryxdesign/core/Table";
import { memo, useState } from "react";
import type { CompiledColumn } from "./compile-columns";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import {
  AstryxTableLoadingViewportAdapterBoundary,
  type AstryxTableLoadingViewportAdapterState,
} from "./react-compiler-adapters";
import { nativeTableAppearance, cellDomId } from "./native-table-presentation";
import { ASTRYX_TABLE_DEFAULT_VIEWPORT_HEIGHT, ASTRYX_TABLE_ROW_HEIGHT } from "./virtual-viewport";
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
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly columns: readonly CompiledColumn[];
  readonly structuralColumns: readonly CompiledColumn[] | undefined;
  readonly totalRows: number;
  readonly ariaRowCount: number;
  readonly tableId: string;
}) {
  return (
    <AstryxTableLoadingViewportAdapterBoundary
      runtime={runtime}
      compiledColumns={columns}
      structuralColumns={structuralColumns}
      totalRows={totalRows}
      defaultLoadingRowCount={5}
      focusFallback={noFocusFallback}
      focusHandoff={noFocusTransfer}
    >
      {(adapter) => (
        <LoadingSurface adapter={adapter} tableId={tableId} ariaRowCount={ariaRowCount} />
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
}: {
  readonly adapter: AstryxTableLoadingViewportAdapterState;
  readonly tableId: string;
  readonly ariaRowCount: number;
}) {
  const [attachGrid] = useState(() => adapter.attachGrid);
  const [attachRowLayer] = useState(() => adapter.attachRowLayer);
  const [attachBodyLayer] = useState(() => adapter.attachBodyLayer);
  const layout = adapter.viewportSnapshot.virtualWindow;
  const fill =
    layout.pinnedEnd.length === 0
      ? 0
      : Math.max(0, adapter.viewportSnapshot.width - layout.totalWidth);
  const width = layout.totalWidth + fill;
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
      aria-colcount={adapter.columns.length}
      tabIndex={0}
      style={{
        overflow: "auto",
        position: "relative",
        maxHeight: ASTRYX_TABLE_DEFAULT_VIEWPORT_HEIGHT,
      }}
    >
      <TableContext value={nativeTableAppearance}>
        <div ref={attachRowLayer} style={{ position: "relative", width }}>
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
                      layout.pinnedStart.length + layout.pinnedEnd.length === 0
                        ? undefined
                        : ownedColumns
                            .map((column) =>
                              loadingCellId(adapter, tableId, rowIndex, column.columnId),
                            )
                            .join(" ")
                    }
                    style={{
                      display: "flex",
                      position: "absolute",
                      top: top(offset),
                      height: ASTRYX_TABLE_ROW_HEIGHT,
                      width,
                      boxSizing: "border-box",
                      paddingInlineStart: startWidth + layout.leftPadding,
                    }}
                  >
                    {layout.center.map((column, index) => (
                      <LoadingCell
                        key={column.columnId}
                        column={column}
                        columnIndex={layout.pinnedStart.length + layout.centerStartIndex + index}
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
            if (columns.length === 0) return null;
            const pinnedWidth = columns.reduce((sum, column) => sum + column.semantics.width, 0);
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
                            {columns.map((column, index) => (
                              <LoadingCell
                                key={column.columnId}
                                column={column}
                                columnIndex={
                                  side === "start"
                                    ? index
                                    : adapter.columns.length - columns.length + index
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

function LoadingCell({
  column,
  columnIndex,
  id,
}: {
  readonly column: CompiledColumn;
  readonly columnIndex: number;
  readonly id: string;
}) {
  return (
    <TableCell
      id={id}
      scope={undefined}
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-label={`Loading ${column.headerName}`}
      style={{
        height: ASTRYX_TABLE_ROW_HEIGHT,
        width: `var(${astryxTableColumnCssVariable("width", column.columnId)}, ${column.semantics.width}px)`,
        flexShrink: 0,
        overflow: "clip",
        maxWidth: "none",
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
