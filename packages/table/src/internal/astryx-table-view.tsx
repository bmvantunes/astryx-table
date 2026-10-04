import { EmptyState } from "@astryxdesign/core/EmptyState";
import { prepareAstryxTableGroupingRemovalFocus } from "./client-grouping-focus";
import { memo, useCallback, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  AstryxTableViewCommitDiagnosticProbe,
  AstryxTableGridSurfaceCommitDiagnosticProbe,
} from "./commit-diagnostic-probes";
import { TableContext, TableRow, TableCell, TableHeaderCell } from "@astryxdesign/core/Table";
import {
  nativeTableAppearance,
  useNativeTablePresentation,
  cellDomId,
  headerDomId,
  type NativePinnedPresentation,
} from "./native-table-presentation";
import { ColumnFilter } from "./column-filter";
import { Divider } from "@astryxdesign/core/Divider";
import { useAstryxTableHotkeyWorkflowAction } from "./hotkey-adapter";
import { useColumnInteractions } from "./column-interactions";
import { Button } from "@astryxdesign/core/Button";
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
import {
  ASTRYX_TABLE_LIVE_LEFT_PADDING_CSS_VARIABLE,
  ASTRYX_TABLE_LIVE_TOTAL_WIDTH_CSS_VARIABLE,
  ASTRYX_TABLE_LIVE_VIEWPORT_FILL_CSS_VARIABLE,
  astryxTableColumnCssVariable,
  astryxTablePinnedWidthCssVariable,
} from "./column-management";
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
  announcement: {
    position: "absolute",
    top: 0,
    insetInlineStart: 0,
    width: 1,
    height: 1,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
  pinnedContent: {
    maxBlockSize: "100%",
    overflow: "clip",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  resizeHandle: {
    position: "absolute",
    insetInlineEnd: 0,
    top: 0,
    width: 8,
    height: "100%",
    cursor: "col-resize",
    touchAction: "none",
    flexShrink: 0,
    outline: { default: "none", ":focus-visible": "2px solid currentColor" },
    outlineOffset: -2,
  },
  row: {
    display: "flex",
    position: "absolute",
    backgroundColor: colorVars["--color-background-surface"],
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
        projectionKind={snapshot.runtime.getInstalledClientProjectionSnapshot()?.kind ?? "raw"}
        navigation={navigation}
        queryGeneration={snapshot.queryGeneration}
        queryNavigationMode={snapshot.queryNavigationMode}
      >
        {(adapter) => (
          <GridSurface
            tableId={tableId}
            snapshot={snapshot}
            adapter={adapter}
            navigation={navigation}
          />
        )}
      </AstryxTableViewportAdapterBoundary>
    </>
  );
}

type SurfaceProps = {
  readonly tableId: string;
  readonly snapshot: Extract<AstryxTableRowPipelineSnapshot, { kind: "rows" }>;
  readonly adapter: AstryxTableViewportAdapterState;
};
const GridSurface = memo(function GridSurface({
  tableId,
  snapshot,
  adapter,
  navigation,
}: SurfaceProps & { readonly navigation: AstryxTableNavigationRuntime }) {
  const [attachRowLayer] = useState(() => adapter.attachRowLayer);
  const { presentation, attach } = useNativeTablePresentation(adapter);
  const [announcement, setAnnouncement] = useState({ sequence: 0, message: "" });
  const announce = useCallback((message: string) => {
    setAnnouncement((previous) => ({ sequence: previous.sequence + 1, message }));
  }, []);
  const interactions = useColumnInteractions({
    tableId,
    findRowIndex: (rowId) =>
      (snapshot.rowSpace.identitySource?.getSnapshot() ?? snapshot.rowSpace).findRowIndex(rowId),
    queryGeneration: snapshot.queryGeneration,
    totalRows: snapshot.rowSpace.totalRows,
    adapter,
    runtime: snapshot.runtime,
    navigation,
    announce,
  });
  const attachResizeGrid = interactions.attachGrid;
  const attachGrid = useCallback(
    (element: HTMLDivElement | null) => {
      attachResizeGrid(element);
      attach(element);
    },
    [attach, attachResizeGrid],
  );
  return (
    <>
      <div
        {...stylex.props(styles.viewport)}
        ref={attachGrid}
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
        <TableContext value={nativeTableAppearance}>
          <Header
            adapter={adapter}
            runtime={snapshot.runtime}
            presentation={presentation}
            navigation={navigation}
            announce={announce}
            onColumnResize={interactions.startResize}
            onColumnReorder={interactions.startReorder}
          />
          <div
            {...stylex.props(styles.layer)}
            ref={attachRowLayer}
            style={{ width: renderedWidth(adapter) }}
          >
            <Rows adapter={adapter} snapshot={snapshot} tableId={tableId} />
          </div>
          <PinnedRows
            adapter={adapter}
            snapshot={snapshot}
            tableId={tableId}
            presentation={presentation}
          />
        </TableContext>
      </div>
      {snapshot.rowSpace.totalRows === 0 ? (
        <EmptyState
          aria-label={`${tableId} status`}
          title="No rows"
          description="No rows match the current filters."
          isCompact
        />
      ) : null}
      <div
        {...stylex.props(styles.announcement)}
        role="status"
        aria-label={`${tableId} interaction status`}
        aria-live="polite"
      >
        <span key={announcement.sequence}>{announcement.message}</span>
      </div>
    </>
  );
});

type GestureProps = {
  readonly onColumnResize: ReturnType<typeof useColumnInteractions>["startResize"];
  readonly onColumnReorder: ReturnType<typeof useColumnInteractions>["startReorder"];
};
type PresentationProps = { readonly presentation: ReadonlyMap<string, NativePinnedPresentation> };

const Header = memo(function Header({
  adapter,
  runtime,
  presentation,
  navigation,
  announce,
  onColumnResize,
  onColumnReorder,
}: PresentationProps &
  GestureProps & {
    readonly announce: (message: string) => void;
    readonly navigation: AstryxTableNavigationRuntime;
    readonly adapter: AstryxTableViewportAdapterState;
    readonly runtime: AstryxTableRuntimeView;
  }) {
  const [attachHeader] = useState(() => adapter.attachHeader);
  const window = useSyncExternalStore(
    adapter.subscribeHeaderColumnWindow,
    adapter.getHeaderColumnWindowSnapshot,
    adapter.getHeaderColumnWindowSnapshot,
  );
  const layout = adapter.viewportSnapshot.virtualWindow;
  return (
    <table
      role="presentation"
      {...stylex.props(styles.header)}
      style={{ width: renderedWidth(adapter) }}
    >
      <thead role="presentation" style={{ display: "block", width: "100%" }}>
        <TableRow
          isHeaderRow
          ref={attachHeader}
          role="row"
          aria-rowindex={1}
          style={{ display: "flex", height: ASTRYX_TABLE_ROW_HEIGHT, width: "100%" }}
        >
          {[
            ...layout.pinnedStart.map((column, index) => (
              <HeaderCell
                instanceId={adapter.instanceId}
                key={column.columnId}
                runtime={runtime}
                navigation={navigation}
                announce={announce}
                onColumnResize={onColumnResize}
                onColumnReorder={onColumnReorder}
                column={column}
                columnIndex={index}
                presentation={presentation.get(column.columnId)}
              />
            )),
            <th
              key="leading-spacer"
              aria-hidden="true"
              style={{ width: window.leftPadding, padding: 0, flexShrink: 0 }}
            />,
            ...window.center.map((column, index) => (
              <HeaderCell
                instanceId={adapter.instanceId}
                key={column.columnId}
                runtime={runtime}
                navigation={navigation}
                announce={announce}
                onColumnResize={onColumnResize}
                onColumnReorder={onColumnReorder}
                column={column}
                columnIndex={layout.pinnedStart.length + window.centerStartIndex + index}
              />
            )),
            <th
              key="trailing-spacer"
              aria-hidden="true"
              style={{ width: window.rightPadding, padding: 0, flexShrink: 0 }}
            />,
            <th
              key="viewport-fill"
              aria-hidden="true"
              style={{
                width: `var(${ASTRYX_TABLE_LIVE_VIEWPORT_FILL_CSS_VARIABLE}, ${viewportFill(adapter)}px)`,
                padding: 0,
                flexShrink: 0,
              }}
            />,
            ...layout.pinnedEnd.map((column, index) => (
              <HeaderCell
                instanceId={adapter.instanceId}
                key={column.columnId}
                runtime={runtime}
                navigation={navigation}
                announce={announce}
                onColumnResize={onColumnResize}
                onColumnReorder={onColumnReorder}
                column={column}
                columnIndex={adapter.columns.length - layout.pinnedEnd.length + index}
                presentation={presentation.get(column.columnId)}
              />
            )),
          ]}
        </TableRow>
      </thead>
    </table>
  );
});

const Rows = memo(function Rows({ adapter, snapshot, tableId }: SurfaceProps) {
  const range = useSyncExternalStore(
    adapter.subscribeRowRange,
    adapter.getRowRangeSnapshot,
    adapter.getRowRangeSnapshot,
  );
  return (
    <table role="presentation" style={{ display: "block", borderCollapse: "collapse" }}>
      <tbody role="presentation" style={{ display: "block", height: range.totalHeight }}>
        {Array.from({ length: range.rowEnd - range.rowStart }, (_, offset) => {
          const rowIndex = range.rowStart + offset;
          const rowId = snapshot.rowSpace.getRowId(rowIndex);
          return rowId === undefined ? null : (
            <Row
              key={rowId}
              adapter={adapter}
              tableId={tableId}
              runtime={snapshot.runtime}
              rowId={rowId}
              rowIndex={rowIndex}
              top={(range.segmentedRows ? offset : rowIndex) * ASTRYX_TABLE_ROW_HEIGHT}
            />
          );
        })}
      </tbody>
    </table>
  );
});

const Row = memo(function Row({
  adapter,
  runtime,
  rowId,
  rowIndex,
  top,
  tableId,
}: {
  readonly tableId: string;
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
  const layout = adapter.viewportSnapshot.virtualWindow;
  const ownedColumns = [...layout.pinnedStart, ...columns, ...layout.pinnedEnd];
  const startWidth = layout.pinnedStart.reduce((sum, column) => sum + column.semantics.width, 0);
  return (
    <TableRow
      {...stylex.props(styles.row)}
      ref={attachBodyLayer}
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-owns={
        layout.pinnedStart.length + layout.pinnedEnd.length === 0
          ? undefined
          : ownedColumns
              .map((column) => cellDomId(adapter.instanceId, tableId, rowId, column.columnId))
              .join(" ")
      }
      style={{
        top,
        height: ASTRYX_TABLE_ROW_HEIGHT,
        width: renderedWidth(adapter),
      }}
    >
      <td
        aria-hidden="true"
        style={{
          padding: 0,
          width: `calc(var(${astryxTablePinnedWidthCssVariable("start")}, ${startWidth}px) + var(${ASTRYX_TABLE_PREPARED_LEFT_PADDING_CSS_VARIABLE}, var(${ASTRYX_TABLE_LIVE_LEFT_PADDING_CSS_VARIABLE}, ${window.leftPadding}px)))`,
          flexShrink: 0,
        }}
      />
      {columns.map((column, index) => (
        <Cell
          key={column.columnId}
          runtime={runtime}
          rowId={rowId}
          column={column}
          id={cellDomId(adapter.instanceId, tableId, rowId, column.columnId)}
          columnIndex={layout.pinnedStart.length + start + index}
          preparedStage={preparedColumnStage(window, start + index)}
        />
      ))}
    </TableRow>
  );
});

const PinnedRows = memo(function PinnedRows({
  adapter,
  snapshot,
  tableId,
  presentation,
}: SurfaceProps & PresentationProps) {
  const range = useSyncExternalStore(
    adapter.subscribeRowRange,
    adapter.getRowRangeSnapshot,
    adapter.getRowRangeSnapshot,
  );
  const layout = adapter.viewportSnapshot.virtualWindow;
  return (
    <>
      {(["start", "end"] as const).map((side) => {
        const columns = side === "start" ? layout.pinnedStart : layout.pinnedEnd;
        if (columns.length === 0) return null;
        const width = `var(${astryxTablePinnedWidthCssVariable(side)}, ${columns.reduce((sum, column) => sum + column.semantics.width, 0)}px)`;
        return (
          <div
            key={side}
            style={{
              display: "flex",
              position: "absolute",
              insetInlineStart: 0,
              top: ASTRYX_TABLE_ROW_HEIGHT,
              width: renderedWidth(adapter),
              height: range.totalHeight,
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
                width,
                height: range.totalHeight,
                pointerEvents: "auto",
              }}
            >
              <table
                role="presentation"
                style={{ display: "block", borderCollapse: "collapse", width }}
              >
                <tbody
                  role="presentation"
                  style={{ display: "block", position: "relative", height: range.totalHeight }}
                >
                  {Array.from({ length: range.rowEnd - range.rowStart }, (_, offset) => {
                    const rowIndex = range.rowStart + offset;
                    const rowId = snapshot.rowSpace.getRowId(rowIndex);
                    if (rowId === undefined) return null;
                    return (
                      <TableRow
                        ref={adapter.attachBodyLayer}
                        key={rowId}
                        role="presentation"
                        style={{
                          display: "flex",
                          position: "absolute",
                          top: (range.segmentedRows ? offset : rowIndex) * ASTRYX_TABLE_ROW_HEIGHT,
                          height: ASTRYX_TABLE_ROW_HEIGHT,
                          width,
                        }}
                      >
                        {columns.map((column, index) => (
                          <Cell
                            key={column.columnId}
                            id={cellDomId(adapter.instanceId, tableId, rowId, column.columnId)}
                            runtime={snapshot.runtime}
                            rowId={rowId}
                            column={column}
                            columnIndex={
                              side === "start"
                                ? index
                                : adapter.columns.length - columns.length + index
                            }
                            presentation={presentation.get(column.columnId)}
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
    </>
  );
});

const Cell = memo(function Cell({
  runtime,
  rowId,
  column,
  columnIndex,
  preparedStage,
  id,
  presentation,
}: {
  readonly id: string;
  readonly presentation?: NativePinnedPresentation | undefined;
  readonly runtime: AstryxTableRuntimeView;
  readonly rowId: string;
  readonly column: CompiledColumn;
  readonly columnIndex: number;
  readonly preparedStage?: "entering" | "retiring" | undefined;
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
  const customClass = resolveAstryxTableCellClassName(column, row, value);
  const content = resolveAstryxTableCellContent(column, row, value);
  const managedContent =
    column.cellRenderer === undefined ? (
      content
    ) : (
      <span data-astryx-custom-cell="" style={{ display: "contents" }}>
        {content}
      </span>
    );
  return (
    <TableCell
      {...presentation?.body.htmlProps}
      scope={undefined}
      xstyle={presentation?.body.xstyle}
      id={id}
      className={customClass}
      role="gridcell"
      data-astryx-row-id={rowId}
      data-astryx-column-id={column.columnId}
      aria-colindex={columnIndex + 1}
      style={{
        ...presentation?.body.htmlProps.style,
        // Cross-package StyleX property keys differ; native classes must not win
        // over the virtual centre's no-scroll-container clipping requirement.
        overflow: presentation === undefined ? "clip" : undefined,
        height: ASTRYX_TABLE_ROW_HEIGHT,
        flexShrink: 0,
        maxWidth: "none",
        width: `var(${astryxTableColumnCssVariable("width", column.columnId)}, ${column.semantics.width}px)`,
        transform: `var(${astryxTableColumnCssVariable("transform", column.columnId)}, none)`,
        textAlign: column.semantics.cellAlign,
        display:
          preparedStage === undefined
            ? undefined
            : (`var(${preparedStage === "entering" ? ASTRYX_TABLE_PREPARED_ENTERING_DISPLAY_CSS_VARIABLE : ASTRYX_TABLE_PREPARED_RETIRING_DISPLAY_CSS_VARIABLE}, ${preparedStage === "entering" ? "none" : "block"})` as CSSProperties["display"]),
      }}
    >
      {presentation === undefined ? (
        managedContent
      ) : (
        <div {...stylex.props(styles.pinnedContent)}>{managedContent}</div>
      )}
    </TableCell>
  );
});

function columnMoveTarget(
  runtime: AstryxTableRuntimeView,
  columnId: string,
  direction: -1 | 1,
): number | undefined {
  const { columns } = runtime.getColumnLayoutSnapshot();
  const index = columns.findIndex((candidate) => candidate.columnId === columnId);
  const source = columns[index];
  const target = columns[index + direction];
  return source !== undefined && target !== undefined && source.pinned === target.pinned
    ? index + direction
    : undefined;
}

const HeaderCell = memo(function HeaderCell({
  instanceId,
  announce,
  navigation,
  runtime,
  column,
  columnIndex,
  presentation,
  onColumnResize,
  onColumnReorder,
}: GestureProps & {
  readonly instanceId: string;
  readonly presentation?: NativePinnedPresentation | undefined;
  readonly announce: (message: string) => void;
  readonly navigation: AstryxTableNavigationRuntime;
  readonly runtime: AstryxTableRuntimeView;
  readonly column: CompiledColumn;
  readonly columnIndex: number;
}) {
  const groupBy = useSyncExternalStore(
    runtime.subscribeGroupBy,
    runtime.getGroupBySnapshot,
    runtime.getGroupBySnapshot,
  );
  const grouped = groupBy.length > 0;
  const activeGroup = groupBy.includes(column.columnId);
  const groupable = column.kind === "field" && column.groupBy;
  const isRows = column.columnId === "COL_ID_ASTRYX_TABLE_ROWS";
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const getFilterColumn = useCallback(
    () =>
      runtime
        .getQuerySnapshot()
        .columns.find((candidate) => candidate.columnId === column.columnId),
    [runtime, column.columnId],
  );
  const filterColumn = useSyncExternalStore(
    runtime.subscribeQuery,
    getFilterColumn,
    getFilterColumn,
  );
  const filterable =
    filterColumn !== undefined &&
    filterColumn.enableFilter &&
    (filterColumn.enableSetFilter ||
      filterColumn.semantics.filterFamily === "text" ||
      filterColumn.valueType === "boolean" ||
      filterColumn.selectOptions !== undefined);
  const menuRef = useAstryxTableHotkeyWorkflowAction(() => setMenuOpen(true));
  const subscribe = useCallback(
    (listener: () => void) => runtime.subscribeColumnCommands(column.columnId, listener),
    [runtime, column.columnId],
  );
  const getSnapshot = useCallback(
    () => runtime.getColumnCommandSnapshot(column.columnId),
    [runtime, column.columnId],
  );
  const command = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const getMoveAvailability = useCallback(
    () =>
      (columnMoveTarget(runtime, column.columnId, -1) !== undefined ? 1 : 0) |
      (columnMoveTarget(runtime, column.columnId, 1) !== undefined ? 2 : 0),
    [runtime, column.columnId],
  );
  const moveAvailability = useSyncExternalStore(
    runtime.subscribeColumnLayout,
    getMoveAvailability,
    getMoveAvailability,
  );
  const move = (direction: -1 | 1) => {
    const targetIndex = columnMoveTarget(runtime, column.columnId, direction);
    if (targetIndex === undefined) return;
    if (
      runtime.dispatchGridCommand({
        type: "column.reorder.commit",
        columnId: column.columnId,
        targetIndex,
        pinned: runtime.getColumnCommandSnapshot(column.columnId).pinned,
      })
    ) {
      const { visibleColumnIds } = runtime.getColumnLayoutSnapshot();
      announce(`${column.headerName} position ${targetIndex + 1} of ${visibleColumnIds.length}`);
    }
  };
  const pin = (pinned: "start" | "end" | undefined) => {
    const accepted = runtime.dispatchGridCommand({
      type: "column.pin.commit",
      columnId: column.columnId,
      pinned,
    });
    if (accepted && runtime.getColumnCommandSnapshot(column.columnId).pinned === pinned) {
      announce(
        pinned === undefined
          ? `${column.headerName} unpinned`
          : `${column.headerName} pinned to logical ${pinned}`,
      );
    }
  };
  const direction =
    command.sortDirection === "asc"
      ? "ascending"
      : command.sortDirection === "desc"
        ? "descending"
        : undefined;
  return (
    <TableHeaderCell
      {...presentation?.header.htmlProps}
      xstyle={presentation?.header.xstyle}
      scope="col"
      id={headerDomId(instanceId, column.columnId)}
      role="columnheader"
      aria-label={column.headerName}
      data-astryx-column-id={column.columnId}
      aria-colindex={columnIndex + 1}
      aria-sort={command.sortPriority === 1 ? direction : undefined}
      onContextMenu={(event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        event.currentTarget
          .querySelector<HTMLElement>("[data-astryx-column-menu-trigger]")
          ?.focus({ preventScroll: true });
        setMenuOpen(true);
      }}
      style={{
        ...presentation?.header.htmlProps.style,
        position: presentation === undefined ? "relative" : "sticky",
        flexShrink: 0,
        maxWidth: "none",
        width: `var(${astryxTableColumnCssVariable("width", column.columnId)}, ${column.semantics.width}px)`,
        transform: `var(${astryxTableColumnCssVariable("transform", column.columnId)}, none)`,
        height: ASTRYX_TABLE_ROW_HEIGHT,
        paddingBlock: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {grouped ? null : (
        <Button
          label={`Reorder ${column.headerName}`}
          data-astryx-reorder-column={column.columnId}
          isIconOnly
          size="sm"
          variant="ghost"
          icon={<span aria-hidden="true">⠿</span>}
          tabIndex={-1}
          style={{ cursor: "grab", touchAction: "none" }}
          onFocus={() => navigation.activateHeader(column.columnId)}
          onPointerDown={(event) => onColumnReorder(event, column.columnId)}
        />
      )}
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
        {column.headerName}
      </span>
      <DropdownMenu
        isMenuOpen={menuOpen}
        onOpenChange={setMenuOpen}
        presentation="popover"
        hasChevron={false}
        button={{
          label: `${column.headerName} column menu`,
          ref: menuRef,
          "data-astryx-column-menu-trigger": "",
          tabIndex: -1,
          onFocus: () => navigation.activateHeader(column.columnId),
          icon: <span aria-hidden="true">⋮</span>,
          isIconOnly: true,
          size: "sm",
        }}
        items={[
          ...(groupable
            ? [
                {
                  id: "grouping",
                  label: activeGroup ? "Remove from Group By" : "Add to Group By",
                  onClick: () => {
                    const cancelFocus = activeGroup
                      ? prepareAstryxTableGroupingRemovalFocus(runtime, column.columnId)
                      : () => undefined;
                    if (
                      runtime.dispatchGridCommand({
                        type: activeGroup ? "grouping.remove" : "grouping.add",
                        columnId: column.columnId,
                      })
                    )
                      announce(
                        `${column.headerName} ${activeGroup ? "removed from" : "added to"} Group By`,
                      );
                    else cancelFocus();
                  },
                },
              ]
            : []),
          ...(command.sortable
            ? [
                {
                  id: "sort",
                  label: command.sortDirection === "asc" ? "Sort descending" : "Sort ascending",
                  onClick: () => runtime.toggleColumnSort(column.columnId, false),
                },
              ]
            : []),
          ...(filterable
            ? [{ id: "filter", label: "Filter column", onClick: () => setFilterOpen(true) }]
            : []),
          ...(command.filterActive
            ? [
                {
                  id: "clear-filter",
                  label: "Clear column filter",
                  onClick: () => {
                    if (
                      runtime.dispatchGridCommand({
                        type: "column.filter.clear",
                        columnId: column.columnId,
                      })
                    )
                      announce(`${column.headerName} filter cleared`);
                  },
                },
              ]
            : []),
          ...(command.filterBaselineAvailable
            ? [
                {
                  id: "reset-filter",
                  label: "Restore initial column filter",
                  onClick: () => {
                    if (
                      runtime.dispatchGridCommand({
                        type: "column.filter.reset",
                        columnId: column.columnId,
                      })
                    )
                      announce(`${column.headerName} filter reset`);
                  },
                },
              ]
            : []),
          ...(!isRows && command.pinned !== "start"
            ? [
                {
                  id: "pin-start",
                  label: "Pin to start",
                  onClick: () => pin("start"),
                },
              ]
            : []),
          ...(!isRows && command.pinned !== "end"
            ? [
                {
                  id: "pin-end",
                  label: "Pin to end",
                  onClick: () => pin("end"),
                },
              ]
            : []),
          ...(!isRows && command.pinned !== undefined
            ? [
                {
                  id: "unpin",
                  label: "Unpin column",
                  onClick: () => pin(undefined),
                },
              ]
            : []),
          ...(grouped
            ? []
            : [
                {
                  id: "move-start",
                  label: "Move toward logical start",
                  isDisabled: (moveAvailability & 1) === 0,
                  onClick: () => move(-1),
                },
                {
                  id: "move-end",
                  label: "Move toward logical end",
                  isDisabled: (moveAvailability & 2) === 0,
                  onClick: () => move(1),
                },
              ]),
        ]}
      />
      {filterable && filterColumn !== undefined ? (
        <ColumnFilter
          column={filterColumn}
          runtime={runtime}
          active={command.filterActive}
          open={filterOpen}
          onOpenChange={setFilterOpen}
          activate={() => navigation.activateHeader(column.columnId)}
        />
      ) : null}
      <Divider
        orientation="vertical"
        aria-label={`Resize ${column.headerName}`}
        aria-valuenow={command.width}
        aria-valuemin={command.minWidth}
        aria-valuemax={command.maxWidth}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        data-astryx-resize-column={column.columnId}
        tabIndex={-1}
        onFocus={() => navigation.activateHeader(column.columnId)}
        onPointerDown={(event) => onColumnResize(event, column.columnId)}
        xstyle={styles.resizeHandle}
      />
    </TableHeaderCell>
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

// End-pinned regions fill unused viewport space while column widths remain authoritative.
function viewportFill(adapter: AstryxTableViewportAdapterState): number {
  const { width, virtualWindow } = adapter.viewportSnapshot;
  return virtualWindow.pinnedEnd.length === 0 ? 0 : Math.max(0, width - virtualWindow.totalWidth);
}

function renderedWidth(adapter: AstryxTableViewportAdapterState): string {
  return `var(${ASTRYX_TABLE_LIVE_TOTAL_WIDTH_CSS_VARIABLE}, ${adapter.viewportSnapshot.virtualWindow.totalWidth + viewportFill(adapter)}px)`;
}
