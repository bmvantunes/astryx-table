import { memo, useCallback, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  AstryxTableViewCommitDiagnosticProbe,
  AstryxTableGridSurfaceCommitDiagnosticProbe,
} from "./commit-diagnostic-probes";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { AstryxTableNavigationRuntime } from "./navigation";
import {
  AstryxTableViewportAdapterBoundary,
  type AstryxTableViewportAdapterState,
} from "./react-compiler-adapters";
import {
  ASTRYX_TABLE_ROW_HEIGHT,
  ASTRYX_TABLE_DEFAULT_VIEWPORT_HEIGHT,
  ASTRYX_TABLE_PREPARED_ENTERING_DISPLAY_CSS_VARIABLE,
  ASTRYX_TABLE_PREPARED_RETIRING_DISPLAY_CSS_VARIABLE,
  ASTRYX_TABLE_PREPARED_LEFT_PADDING_CSS_VARIABLE,
  type AstryxTableBodyColumnWindowSnapshot,
} from "./virtual-viewport";
import { ASTRYX_TABLE_LIVE_LEFT_PADDING_CSS_VARIABLE } from "./column-management";
import {
  astryxTableCellPresentationUsesRawRow,
  resolveAstryxTableCellContent,
  resolveAstryxTableCellClassName,
} from "./cell-presentation";

import type { CSSProperties, ReactElement } from "react";
import type { CompiledColumn } from "./compile-columns";
import type {
  AstryxTableRuntimeView,
  AstryxTableQueryNavigationMode,
  AstryxTableChromeSnapshot,
} from "./grid-runtime";
import type { AstryxTableRowSelectionRuntime } from "./row-selection";
import type { AstryxTableCellRangeRuntime } from "./cell-range-clipboard";
export type AstryxTableRowPipelineProps<
  TRuntime extends AstryxTableRuntimeView = AstryxTableRuntimeView,
  TAdapter = unknown,
> = {
  readonly runtime: TRuntime;
  readonly tableId: string;
  readonly columns: readonly CompiledColumn[];
  readonly rowPipelineAdapter: TAdapter;
  readonly rowSelection?: AstryxTableRowSelectionRuntime | undefined;
  readonly cellRange?: AstryxTableCellRangeRuntime | undefined;
  readonly children: (snapshot: AstryxTableRowPipelineSnapshot) => ReactElement;
};

export type AstryxTableRowPipelineSnapshot =
  | Readonly<{
      readonly kind: "rows";
      readonly runtime: AstryxTableRuntimeView;
      readonly columns: readonly CompiledColumn[];
      readonly rowSpace: AstryxTableLogicalRowSpace;
      readonly queryGeneration: number;
      readonly queryNavigationMode: AstryxTableQueryNavigationMode;
      readonly loading: boolean;
    }>
  | Readonly<{
      readonly kind: "invalid";
      readonly columns: readonly CompiledColumn[];
      readonly invalid: Extract<
        AstryxTableChromeSnapshot["invalid"],
        { readonly kind: "invalid-value" | "invalid-group" }
      >;
    }>;

export type AstryxTableLogicalRowSpace = Readonly<{
  readonly totalRows: number;
  readonly getRowId: (index: number) => string | undefined;
  readonly findRowIndex: (rowId: string) => number | undefined;
  readonly setRequiredRange: (start: number, end: number) => void;
  readonly identitySource?: Readonly<{
    readonly getSnapshot: () => Readonly<{
      readonly getRowId: (index: number) => string | undefined;
      readonly findRowIndex: (rowId: string) => number | undefined;
    }>;
    readonly subscribe: (listener: () => void) => () => void;
  }>;
  readonly identitySnapshot?:
    | Readonly<{
        readonly rowIds: readonly string[];
        readonly rowIndexById: ReadonlyMap<string, number>;
      }>
    | undefined;
  readonly missingRowIdentityBehavior?:
    | "clear-conflicting-active-cell"
    | "fallback-to-display-index";
}>;

const styles = stylex.create({
  viewport: {
    position: "relative",
    overflow: "auto",
    backgroundColor: colorVars["--color-background-surface"],
    color: colorVars["--color-text-primary"],
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colorVars["--color-border"],
    fontSize: 14,
  },
  header: {
    display: "flex",
    position: "sticky",
    top: 0,
    zIndex: 2,
    backgroundColor: colorVars["--color-background-muted"],
  },
  layer: { position: "relative" },
  row: {
    display: "flex",
    position: "absolute",
    backgroundColor: colorVars["--color-background-surface"],
  },
  cell: {
    boxSizing: "border-box",
    flexShrink: 0,
    paddingInline: 10,
    paddingBlock: 8,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colorVars["--color-border"],
  },
});

export function AstryxTableView({
  tableId,
  snapshot,
}: {
  readonly tableId: string;
  readonly snapshot: AstryxTableRowPipelineSnapshot;
}) {
  const [navigation] = useState(() => new AstryxTableNavigationRuntime());
  if (snapshot.kind === "invalid") return <div role="alert">Unable to display table values.</div>;
  return (
    <>
      {__ASTRYX_TABLE_TEST_DIAGNOSTICS__ ? (
        <AstryxTableViewCommitDiagnosticProbe commitEvidence={snapshot} tableId={tableId} />
      ) : null}
      <AstryxTableViewportAdapterBoundary
        runtime={snapshot.runtime}
        columns={snapshot.columns}
        rowSpace={snapshot.rowSpace}
        projectionKind="raw"
        navigation={navigation}
        queryGeneration={snapshot.queryGeneration}
        queryNavigationMode={snapshot.queryNavigationMode}
      >
        {(adapter) => <GridSurface tableId={tableId} snapshot={snapshot} adapter={adapter} />}
      </AstryxTableViewportAdapterBoundary>
    </>
  );
}

type SurfaceProps = {
  readonly tableId: string;
  readonly snapshot: Extract<AstryxTableRowPipelineSnapshot, { kind: "rows" }>;
  readonly adapter: AstryxTableViewportAdapterState;
};
const GridSurface = memo(function GridSurface({ tableId, snapshot, adapter }: SurfaceProps) {
  const [{ attach, attachRowLayer }] = useState(() => ({
    attach: adapter.attach,
    attachRowLayer: adapter.attachRowLayer,
  }));
  const window = adapter.viewportSnapshot.virtualWindow;
  return (
    <div
      {...stylex.props(styles.viewport)}
      ref={attach}
      role="grid"
      aria-label={tableId}
      style={{ maxHeight: ASTRYX_TABLE_DEFAULT_VIEWPORT_HEIGHT }}
      aria-colcount={adapter.columns.length}
      aria-rowcount={snapshot.rowSpace.totalRows + 1}
      tabIndex={0}
    >
      {__ASTRYX_TABLE_TEST_DIAGNOSTICS__ ? (
        <AstryxTableGridSurfaceCommitDiagnosticProbe
          commitEvidence={{ tableId, snapshot, adapter }}
          tableId={tableId}
        />
      ) : null}
      <Header adapter={adapter} runtime={snapshot.runtime} />
      {snapshot.rowSpace.totalRows === 0 ? (
        <div role="status" aria-label={`${tableId} status`}>
          No rows
        </div>
      ) : null}
      <div
        {...stylex.props(styles.layer)}
        ref={attachRowLayer}
        style={{ width: window.totalWidth }}
      >
        <Rows adapter={adapter} snapshot={snapshot} tableId={tableId} />
      </div>
    </div>
  );
});

const Header = memo(function Header({
  adapter,
  runtime,
}: {
  readonly adapter: AstryxTableViewportAdapterState;
  readonly runtime: AstryxTableRuntimeView;
}) {
  const [attachHeader] = useState(() => adapter.attachHeader);
  const window = useSyncExternalStore(
    adapter.subscribeHeaderColumnWindow,
    adapter.getHeaderColumnWindowSnapshot,
    adapter.getHeaderColumnWindowSnapshot,
  );
  return (
    <div
      {...stylex.props(styles.header)}
      ref={attachHeader}
      role="row"
      aria-rowindex={1}
      style={{
        width: adapter.viewportSnapshot.virtualWindow.totalWidth,
        height: ASTRYX_TABLE_ROW_HEIGHT,
      }}
    >
      <div aria-hidden="true" style={{ width: window.leftPadding, flexShrink: 0 }} />
      {window.center.map((column, index) => (
        <HeaderCell
          key={column.columnId}
          runtime={runtime}
          column={column}
          columnIndex={window.centerStartIndex + index}
        />
      ))}
    </div>
  );
});

const Rows = memo(function Rows({ adapter, snapshot }: SurfaceProps) {
  const range = useSyncExternalStore(
    adapter.subscribeRowRange,
    adapter.getRowRangeSnapshot,
    adapter.getRowRangeSnapshot,
  );
  return (
    <div style={{ height: range.totalHeight }}>
      {Array.from({ length: range.rowEnd - range.rowStart }, (_, offset) => {
        const rowIndex = range.rowStart + offset;
        const rowId = snapshot.rowSpace.getRowId(rowIndex);
        return rowId === undefined ? null : (
          <Row
            key={rowId}
            adapter={adapter}
            runtime={snapshot.runtime}
            rowId={rowId}
            rowIndex={rowIndex}
            top={(range.segmentedRows ? offset : rowIndex) * ASTRYX_TABLE_ROW_HEIGHT}
          />
        );
      })}
    </div>
  );
});

const Row = memo(function Row({
  adapter,
  runtime,
  rowId,
  rowIndex,
  top,
}: {
  readonly adapter: AstryxTableViewportAdapterState;
  readonly runtime: AstryxTableRuntimeView;
  readonly rowId: string;
  readonly rowIndex: number;
  readonly top: number;
}) {
  const [attachBodyLayer] = useState(() => adapter.attachBodyLayer);
  const subscribe = useCallback(
    (listener: () => void) => adapter.subscribeBodyRowColumnWindow(rowIndex, listener),
    [adapter, rowIndex],
  );
  const getSnapshot = useCallback(
    () => adapter.getBodyRowColumnWindowSnapshot(rowIndex),
    [adapter, rowIndex],
  );
  const window = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const columns = window.preparedCenter ?? window.center;
  const start = window.preparedCenterStartIndex ?? window.centerStartIndex;
  return (
    <div
      {...stylex.props(styles.row)}
      ref={attachBodyLayer}
      role="row"
      aria-rowindex={rowIndex + 2}
      style={{
        top,
        height: ASTRYX_TABLE_ROW_HEIGHT,
        width: adapter.viewportSnapshot.virtualWindow.totalWidth,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: `var(${ASTRYX_TABLE_PREPARED_LEFT_PADDING_CSS_VARIABLE}, var(${ASTRYX_TABLE_LIVE_LEFT_PADDING_CSS_VARIABLE}, ${window.leftPadding}px))`,
          flexShrink: 0,
        }}
      />
      {columns.map((column, index) => (
        <Cell
          key={column.columnId}
          runtime={runtime}
          rowId={rowId}
          column={column}
          columnIndex={start + index}
          preparedStage={preparedColumnStage(window, start + index)}
        />
      ))}
    </div>
  );
});

const Cell = memo(function Cell({
  runtime,
  rowId,
  column,
  columnIndex,
  preparedStage,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly rowId: string;
  readonly column: CompiledColumn;
  readonly columnIndex: number;
  readonly preparedStage: "entering" | "retiring" | undefined;
}) {
  const rowAware = astryxTableCellPresentationUsesRawRow(column);
  const subscribe = useCallback(
    (listener: () => void) =>
      rowAware
        ? runtime.subscribeRowCell(rowId, column.columnId, listener)
        : runtime.subscribeCell(rowId, column.columnId, listener),
    [column.columnId, rowAware, rowId, runtime],
  );
  const getSnapshot = useCallback(
    () =>
      rowAware
        ? runtime.getRowCellSnapshot(rowId, column.columnId)
        : runtime.getCellSnapshot(rowId, column.columnId),
    [column.columnId, rowAware, rowId, runtime],
  );
  const cell = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const row = "row" in cell ? cell.row : undefined;
  const value = cell.kind === "available" ? cell.value : undefined;
  const cellProps = stylex.props(styles.cell);
  const customClass = resolveAstryxTableCellClassName(column, row, value);
  return (
    <div
      {...cellProps}
      className={[cellProps.className, customClass].filter(Boolean).join(" ")}
      role="gridcell"
      aria-colindex={columnIndex + 1}
      style={{
        height: ASTRYX_TABLE_ROW_HEIGHT,
        width: column.semantics.width,
        textAlign: column.semantics.cellAlign,
        display:
          preparedStage === undefined
            ? undefined
            : (`var(${preparedStage === "entering" ? ASTRYX_TABLE_PREPARED_ENTERING_DISPLAY_CSS_VARIABLE : ASTRYX_TABLE_PREPARED_RETIRING_DISPLAY_CSS_VARIABLE}, ${preparedStage === "entering" ? "none" : "block"})` as CSSProperties["display"]),
      }}
    >
      {resolveAstryxTableCellContent(column, row, value)}
    </div>
  );
});

const HeaderCell = memo(function HeaderCell({
  runtime,
  column,
  columnIndex,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly column: CompiledColumn;
  readonly columnIndex: number;
}) {
  const subscribe = useCallback(
    (listener: () => void) => runtime.subscribeColumnCommands(column.columnId, listener),
    [runtime, column.columnId],
  );
  const getSnapshot = useCallback(
    () => runtime.getColumnCommandSnapshot(column.columnId),
    [runtime, column.columnId],
  );
  const command = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const direction =
    command.sortDirection === "asc"
      ? "ascending"
      : command.sortDirection === "desc"
        ? "descending"
        : undefined;
  return (
    <div
      {...stylex.props(styles.cell)}
      role="columnheader"
      aria-label={column.headerName}
      aria-colindex={columnIndex + 1}
      aria-sort={command.sortPriority === 1 ? direction : undefined}
      style={{
        width: column.semantics.width,
        height: ASTRYX_TABLE_ROW_HEIGHT,
        paddingBlock: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
        {column.headerName}
      </span>
      {command.sortable ? (
        <DropdownMenu
          presentation="popover"
          hasChevron={false}
          button={{
            label: `${column.headerName} column menu`,
            icon: <span aria-hidden="true">⋮</span>,
            isIconOnly: true,
            size: "sm",
          }}
          items={[
            {
              id: "sort",
              label: command.sortDirection === "asc" ? "Sort descending" : "Sort ascending",
              onClick: () => runtime.toggleColumnSort(column.columnId, false),
            },
          ]}
        />
      ) : null}
    </div>
  );
});

// The viewport prepares a bounded union, then promotes all rows with inherited CSS variables.
function preparedColumnStage(
  window: AstryxTableBodyColumnWindowSnapshot,
  index: number,
): "entering" | "retiring" | undefined {
  const sourceStart = window.preparedSourceCenterStartIndex ?? window.centerStartIndex;
  const sourceEnd =
    window.preparedSourceCenterEndIndex ?? window.centerStartIndex + window.center.length;
  if (index < sourceStart || index >= sourceEnd) return "entering";
  return window.preparedTargetCenterStartIndex !== undefined &&
    window.preparedTargetCenterEndIndex !== undefined &&
    (index < window.preparedTargetCenterStartIndex || index >= window.preparedTargetCenterEndIndex)
    ? "retiring"
    : undefined;
}
