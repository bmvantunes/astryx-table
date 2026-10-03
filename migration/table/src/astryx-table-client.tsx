import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { ReactNode } from "react";

import type {
  AstryxTableClientProps,
  AstryxTableColumns,
  AstryxTableEditableClientProps,
  AstryxTableEditRowPatch,
  AstryxTableEditRowProjector,
  AstryxTableJsonValue,
  AstryxTableReadOnlyClientProps,
  AstryxTableSortBy,
} from "./public-types";
import {
  AstryxTableToolbar,
  AstryxTableToolbarStore,
  AstryxTableView,
} from "./internal/astryx-table-view";
import {
  AstryxTableClientProjectionStore,
  AstryxTableClientRowPipeline,
} from "./internal/client-row-pipeline";
import {
  AstryxTableClientFilterProvider,
  AstryxTableActiveFilters,
  AstryxTableQuickFilter,
  renderAstryxTableClientColumnFilter,
} from "./internal/client-filter-controls";
import { AstryxTableClientRowPipelineAdapter } from "./internal/client-source-adapter";
import { compileColumns } from "./internal/compile-columns";
import { AstryxTableGridRuntime, isAstryxTableInvalidCellValue } from "./internal/grid-runtime";
import { registerAstryxTableIdentity } from "./internal/table-identity-registry";
import {
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableFilterControl,
  AstryxTableLoadedRowCount,
  AstryxTableResultRowCount,
  AstryxTableToolbarProvider,
  AstryxTableToolbarSpacer,
} from "./internal/toolbar-capabilities";
import { recordAstryxTableToolbarLifetime } from "./internal/toolbar-instrumentation";
import { recordAstryxTableReviewCellSubscription } from "./internal/grid-subscription-instrumentation";
import { AstryxTableRowSelectionRuntime } from "./internal/row-selection";
import { AstryxTableCellRangeRuntime } from "./internal/cell-range-clipboard";
import {
  AstryxTableCellEditRuntime,
  type AstryxTableCellEditDraftReviewSourceRow,
  type AstryxTableCellEditRowProjector,
} from "./internal/cell-edit";
import { astryxTableCellPresentationUsesRawRow } from "./internal/cell-presentation";
import {
  AstryxTableConflictReviewResolution,
  AstryxTableEditModeControl,
} from "./internal/edit-chrome";
import { AstryxTableEditMemoryRuntime } from "./internal/edit-memory";
import {
  adaptAstryxTableSaveHandler,
  AstryxTableSaveOperationRuntime,
} from "./internal/save-operations";
import { compileAstryxTableGroupRowsColumn } from "./internal/client-grouping-presentation";
import { AstryxTableClientGroupBy } from "./internal/client-grouping-controls";
import { reconcileAstryxTableClientEditSourcePublication } from "./internal/client-edit-source";

function adaptAstryxTableRowVersionExtractor<TRow>(
  extractor: ((row: TRow) => unknown) | undefined,
): ((row: object) => unknown) | undefined {
  return extractor === undefined ? undefined : (row) => extractor(row as TRow);
}

function adaptAstryxTableEditRowProjector<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
  TRowVersion,
>(
  projector: AstryxTableEditRowProjector<TRow, TColumns, TRowVersion> | undefined,
): AstryxTableCellEditRowProjector | undefined {
  return projector === undefined
    ? undefined
    : ({ row, patch, rowVersion }) =>
        projector({
          row: row as TRow,
          patch: patch as AstryxTableEditRowPatch<TRow, TColumns>,
          rowVersion: rowVersion as TRowVersion,
        });
}

export {
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableFilterControl,
  AstryxTableLoadedRowCount,
  AstryxTableQuickFilter,
  AstryxTableResultRowCount,
  AstryxTableToolbar,
  AstryxTableToolbarSpacer,
};
export type {
  AstryxTableFilterControlProps,
  AstryxTableGridFilterCommandCapability,
} from "./internal/toolbar-capabilities";

export function AstryxTableClient<
  TRow,
  const TColumns extends AstryxTableColumns<TRow>,
  TGetRowVersion extends (row: TRow) => unknown,
>(props: AstryxTableEditableClientProps<TRow, TColumns, TGetRowVersion>): ReactNode;
export function AstryxTableClient<TRow, const TColumns extends AstryxTableColumns<TRow>, TRowVersion>(
  props: AstryxTableClientProps<TRow, TColumns, TRowVersion>,
): ReactNode;
export function AstryxTableClient<TRow, const TColumns extends AstryxTableColumns<TRow>>(
  props: AstryxTableReadOnlyClientProps<TRow, TColumns>,
): ReactNode;
export function AstryxTableClient<TRow, const TColumns extends AstryxTableColumns<TRow>, TRowVersion>(
  props: AstryxTableClientProps<TRow, TColumns, TRowVersion>,
): ReactNode {
  const tableId = requireAstryxTableId(props.tableId);
  return (
    <AstryxTableClientInstance
      key={`${tableId}:${props.editable === true ? "editable" : "readonly"}`}
      props={props}
      tableId={tableId}
    />
  );
}

function AstryxTableClientInstance<
  TRow,
  const TColumns extends AstryxTableColumns<TRow>,
  TRowVersion,
>({
  gridAriaLabel,
  props,
  registerIdentity = true,
  reviewRowSelection,
  tableId,
}: Readonly<{
  readonly gridAriaLabel?: string;
  readonly props: AstryxTableClientProps<TRow, TColumns, TRowVersion>;
  readonly registerIdentity?: boolean;
  readonly reviewRowSelection?: AstryxTableRowSelectionRuntime;
  readonly tableId: string;
}>): ReactNode {
  const compiledColumns = useMemo(() => compileColumns(props.columns), [props.columns]);
  const editable = props.editable === true;
  const getRowId = props.getRowId;
  const onSaveEdits = props.onSaveEdits;
  const projectEditRow = props.projectEditRow;
  if (editable && typeof props.getRowVersion !== "function") {
    throw new TypeError("AstryxTable editable Client Tables require getRowVersion.");
  }
  if (editable && typeof onSaveEdits !== "function") {
    throw new TypeError("AstryxTable editable Client Tables require onSaveEdits.");
  }
  if (
    editable &&
    !compiledColumns.some(
      (column) =>
        column.kind === "field" && column.isEditable !== undefined && column.isEditable !== false,
    )
  ) {
    throw new TypeError(
      "AstryxTable editable Client Tables require at least one potentially editable column.",
    );
  }
  if (
    editable &&
    typeof projectEditRow !== "function" &&
    compiledColumns.some(
      (column) =>
        column.kind === "field" &&
        column.isEditable !== undefined &&
        column.isEditable !== false &&
        astryxTableCellPresentationUsesRawRow(column),
    )
  ) {
    throw new TypeError(
      "AstryxTable editable Client Tables with row-aware presentation require projectEditRow.",
    );
  }
  const editRowProjector = useMemo(
    () => adaptAstryxTableEditRowProjector(projectEditRow),
    [projectEditRow],
  );
  const projectedRowId = useMemo(
    () => (editRowProjector === undefined ? undefined : (row: object) => getRowId(row as TRow)),
    [editRowProjector, getRowId],
  );
  const normalizedGroupRowsColumn = useMemo(
    () => compileAstryxTableGroupRowsColumn(editable ? undefined : props.groupRowsColumn),
    [editable, props.groupRowsColumn],
  );
  const {
    cellClassName: groupRowsCellClassName,
    cellRenderer: groupRowsCellRenderer,
    headerName: groupRowsHeaderName,
    valueFormatter: groupRowsValueFormatter,
    width: groupRowsWidth,
  } = normalizedGroupRowsColumn;
  const groupRowsColumn = useMemo(
    () =>
      Object.freeze({
        headerName: groupRowsHeaderName,
        width: groupRowsWidth,
        ...(groupRowsValueFormatter === undefined
          ? {}
          : { valueFormatter: groupRowsValueFormatter }),
        ...(groupRowsCellRenderer === undefined ? {} : { cellRenderer: groupRowsCellRenderer }),
        ...(groupRowsCellClassName === undefined ? {} : { cellClassName: groupRowsCellClassName }),
      }),
    [
      groupRowsCellClassName,
      groupRowsCellRenderer,
      groupRowsHeaderName,
      groupRowsValueFormatter,
      groupRowsWidth,
    ],
  );
  const [ownedRowSelectionRuntime] = useState(() => new AstryxTableRowSelectionRuntime([]));
  const rowSelectionRuntime = reviewRowSelection ?? ownedRowSelectionRuntime;
  const rowSelectionEnabled = props.rowSelection === true;
  const rowSelection = rowSelectionEnabled ? rowSelectionRuntime : undefined;
  const previousRowSelectionEnabled = useRef(rowSelectionEnabled);
  const [cellRange] = useState(() => new AstryxTableCellRangeRuntime(tableId));
  const [rowPipelineAdapter] = useState(
    () =>
      new AstryxTableClientRowPipelineAdapter(
        props.clientSource,
        props.getRowId,
        compiledColumns,
        props.initialFilters,
        props.initialOrderBy,
        props.quickFilterFields,
        groupRowsColumn,
      ),
  );
  const [runtime] = useState(() => {
    const created = new AstryxTableGridRuntime(
      rowPipelineAdapter.getPublication(),
      compiledColumns,
      rowPipelineAdapter.getQueryConfiguration(compiledColumns),
      tableId,
      {
        initialPersistedState: props.initialPersistedState,
        grouping: !editable,
        groupRowsWidth: groupRowsColumn.width,
        beforeGroupingChange: (entering) => {
          cellRange.clear();
          if (entering) rowSelectionRuntime.enterGroupedProjection();
        },
      },
    );
    if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) {
      recordAstryxTableToolbarLifetime({
        tableId,
        kind: "runtime-create",
        identity: created,
      });
    }
    return created;
  });
  const [editMemory] = useState(() => (editable ? new AstryxTableEditMemoryRuntime() : undefined));
  const [cellEdit] = useState(() =>
    editable
      ? new AstryxTableCellEditRuntime({
          columns: compiledColumns,
          getRow: rowPipelineAdapter.getAuthoritativeEditRowSnapshot,
          getCanonicalValue: (rowId, columnId) => {
            const snapshot = rowPipelineAdapter.getAuthoritativeEditCellSnapshot(rowId, columnId);
            return snapshot.found && !isAstryxTableInvalidCellValue(snapshot.value)
              ? Object.freeze({ _tag: "Success" as const, value: snapshot.value })
              : Object.freeze({ _tag: "Failure" as const });
          },
          ...(props.getRowVersion === undefined
            ? {}
            : { getRowVersion: adaptAstryxTableRowVersionExtractor(props.getRowVersion)! }),
          ...(editRowProjector === undefined || projectedRowId === undefined
            ? {}
            : { projectEditRow: editRowProjector, getRowId: projectedRowId }),
          isSourceAuthoritative: rowPipelineAdapter.hasAuthoritativeEditSource,
          ...(editMemory === undefined
            ? {}
            : {
                onCommit: (change) => editMemory.requestImmediateSave([change]),
                onCommitGesture: (changes) => editMemory.requestImmediateSave(changes),
              }),
          incrementalTraversal: true,
        })
      : undefined,
  );
  const [saveOperations] = useState(() =>
    cellEdit === undefined || editMemory === undefined
      ? undefined
      : new AstryxTableSaveOperationRuntime(cellEdit, editMemory),
  );
  const renderResetReview = useCallback(
    (reviewRows: readonly AstryxTableCellEditDraftReviewSourceRow[]) => (
      <AstryxTableResetReviewTable reviewRows={reviewRows} />
    ),
    [],
  );
  const renderConflictReview = useMemo(() => {
    if (editMemory === undefined) return undefined;
    return (
      reviewRows: readonly AstryxTableCellEditDraftReviewSourceRow[],
      selection: AstryxTableRowSelectionRuntime,
      resolve: (id: string, resolution: "mine" | "server") => void,
    ) => (
      <AstryxTableConflictReviewTable
        rows={reviewRows}
        selection={selection}
        runtime={editMemory}
        resolve={resolve}
      />
    );
  }, [editMemory]);
  const renderBlockedReview = useMemo(() => {
    if (editMemory === undefined) return undefined;
    return (
      reviewRows: readonly AstryxTableCellEditDraftReviewSourceRow[],
      selection: AstryxTableRowSelectionRuntime,
    ) => <AstryxTableBlockedReviewTable rows={reviewRows} selection={selection} />;
  }, [editMemory]);
  const [toolbar] = useState(() => new AstryxTableToolbarStore(props.children));
  const runtimeView = runtime.getView();
  const [projectionStore] = useState(
    () => new AstryxTableClientProjectionStore(runtimeView, rowPipelineAdapter, rowSelection),
  );

  useLayoutEffect(() => {
    projectionStore.setRowSelection(rowSelection);
  }, [projectionStore, rowSelection]);
  useLayoutEffect(() => {
    cellEdit?.setRowVersionExtractor(adaptAstryxTableRowVersionExtractor(props.getRowVersion));
  }, [cellEdit, props.getRowVersion]);
  useLayoutEffect(() => {
    cellEdit?.setEditRowProjector(editRowProjector, projectedRowId);
  }, [cellEdit, editRowProjector, projectedRowId]);
  useLayoutEffect(() => projectionStore.activate(), [projectionStore]);
  useLayoutEffect(() => {
    editMemory?.activate();
    return () => editMemory?.dispose();
  }, [editMemory]);
  useLayoutEffect(() => {
    if (editMemory === undefined || cellEdit === undefined) return;
    return editMemory.connectCellEdit(cellEdit);
  }, [cellEdit, editMemory]);
  useLayoutEffect(() => {
    if (saveOperations === undefined || onSaveEdits === undefined) return;
    return saveOperations.setHandler(adaptAstryxTableSaveHandler(onSaveEdits));
  }, [onSaveEdits, saveOperations]);
  useLayoutEffect(() => {
    if (saveOperations === undefined) return;
    return saveOperations.activate();
  }, [saveOperations]);
  useLayoutEffect(() => {
    if (editMemory === undefined) return;
    return runtime.registerEditCommandHandler((command) => {
      switch (command.type) {
        case "edits.reset":
          return editMemory.openResetReview();
        case "edits.undo":
          return editMemory.undo();
        case "edits.redo":
          return editMemory.redo();
      }
    });
  }, [editMemory, runtime]);
  useLayoutEffect(() => {
    const previouslyEnabled = previousRowSelectionEnabled.current;
    previousRowSelectionEnabled.current = rowSelectionEnabled;
    if (previouslyEnabled && !rowSelectionEnabled) {
      rowSelectionRuntime.enterGroupedProjection();
      return;
    }
    if (!previouslyEnabled && rowSelectionEnabled) {
      const projectionInput = rowPipelineAdapter.getProjectionInputSnapshot();
      if (runtime.getGroupBySnapshot().length === 0) {
        rowSelectionRuntime.leaveGroupedProjection(
          projectionInput.sourceRowIds.authoritative ? projectionInput.sourceRowIds.rowIds : [],
        );
      }
    }
  }, [rowPipelineAdapter, rowSelectionEnabled, rowSelectionRuntime, runtime]);
  const gridOwnedControls = useMemo(
    () => (
      <>
        {editable ? (
          editMemory === undefined ? null : (
            <AstryxTableEditModeControl runtime={editMemory} />
          )
        ) : (
          <AstryxTableClientGroupBy columns={compiledColumns} runtime={runtimeView} />
        )}
        <AstryxTableActiveFilters />
      </>
    ),
    [compiledColumns, editable, editMemory, runtimeView],
  );

  const reconcilePublishedEditSource = useCallback(
    (changedRowIds: ReadonlySet<string> | undefined): void => {
      if (rowPipelineAdapter.hasAuthoritativeEditSource()) {
        cellEdit?.reconcileColumns(compiledColumns, (rowId) =>
          rowPipelineAdapter.getAuthoritativeEditRowSnapshot(rowId),
        );
        cellEdit?.reconcileTraversalRows(changedRowIds);
      }
      reconcileAstryxTableClientEditSourcePublication(
        rowPipelineAdapter,
        editMemory,
        cellEdit,
        changedRowIds,
      );
    },
    [cellEdit, compiledColumns, editMemory, rowPipelineAdapter],
  );

  useLayoutEffect(() => {
    const unsubscribe = rowPipelineAdapter.subscribeEditSource(reconcilePublishedEditSource);
    if (rowPipelineAdapter.isEditSourceConfiguredFor(compiledColumns)) {
      reconcilePublishedEditSource(rowPipelineAdapter.getEditSourceChangedRowIds());
    }
    return unsubscribe;
  }, [compiledColumns, reconcilePublishedEditSource, rowPipelineAdapter]);

  useLayoutEffect(() => {
    const publication = rowPipelineAdapter.reconcile(
      props.clientSource,
      props.getRowId,
      compiledColumns,
      groupRowsColumn,
    );
    const queryConfiguration = rowPipelineAdapter.getQueryConfiguration(compiledColumns);
    const installedProjection = runtime.getInstalledClientProjectionSnapshot();
    const groupingProjectionActive =
      runtime.getQuerySnapshot().groupBy.length > 0 ||
      installedProjection?.kind === "grouped" ||
      installedProjection?.kind === "invalid";
    rowPipelineAdapter.publishProjectionInput(
      compiledColumns,
      queryConfiguration,
      groupingProjectionActive,
    );
    editMemory?.setSavePreflightAvailable(rowPipelineAdapter.hasAuthoritativeEditSource());
    if (!groupingProjectionActive) {
      runtime.reconcile(publication, compiledColumns, queryConfiguration, groupRowsColumn.width);
    }
  }, [
    cellEdit,
    compiledColumns,
    editMemory,
    groupRowsColumn,
    props.clientSource,
    props.getRowId,
    rowPipelineAdapter,
    runtime,
  ]);

  useLayoutEffect(() => {
    runtime.setOnPersistChange(
      props.onPersistChange as
        | ((state: Readonly<Record<string, AstryxTableJsonValue>>) => void)
        | undefined,
    );
  }, [props.onPersistChange, runtime]);

  useLayoutEffect(() => {
    toolbar.publish(props.children);
  }, [props.children, toolbar]);

  useLayoutEffect(
    () =>
      __ASTRYX_TABLE_DEVELOPMENT__ && registerIdentity
        ? registerAstryxTableIdentity(tableId, compiledColumns)
        : undefined,
    [compiledColumns, registerIdentity, tableId],
  );

  useLayoutEffect(() => () => cellRange.dispose(), [cellRange]);
  useLayoutEffect(() => {
    cellEdit?.activate();
    return () => cellEdit?.dispose();
  }, [cellEdit]);
  return (
    <AstryxTableClientFilterProvider facetRows={rowPipelineAdapter} runtime={runtimeView}>
      <AstryxTableToolbarProvider
        columns={compiledColumns}
        resultRows={rowPipelineAdapter}
        runtime={runtimeView}
        tableId={tableId}
      >
        <AstryxTableView
          runtime={runtimeView}
          tableId={tableId}
          {...(gridAriaLabel === undefined ? {} : { gridAriaLabel })}
          compiledColumns={compiledColumns}
          toolbar={toolbar}
          rowPipeline={AstryxTableClientRowPipeline}
          rowPipelineAdapter={rowPipelineAdapter}
          rowSelection={rowSelection}
          cellRange={reviewRowSelection === undefined ? cellRange : undefined}
          cellEdit={cellEdit}
          editMemory={editMemory}
          renderResetReview={renderResetReview}
          {...(renderConflictReview === undefined ? {} : { renderConflictReview })}
          {...(renderBlockedReview === undefined ? {} : { renderBlockedReview })}
          renderColumnFilter={renderAstryxTableClientColumnFilter}
          gridOwnedControls={gridOwnedControls}
        />
      </AstryxTableToolbarProvider>
    </AstryxTableClientFilterProvider>
  );
}

type AstryxTableEditReviewDisplayRow = AstryxTableCellEditDraftReviewSourceRow;

const AstryxTableEditReviewStatus = memo(function AstryxTableEditReviewStatus({
  row,
  tableId,
  columnId,
}: Readonly<{
  readonly row: AstryxTableEditReviewDisplayRow;
  readonly tableId?: string;
  readonly columnId?: string;
}>): ReactNode {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__ && tableId !== undefined && columnId !== undefined) {
        recordAstryxTableReviewCellSubscription({
          tableId,
          rowId: row.id,
          columnId,
          source: "review-status",
          phase: "subscribe",
        });
      }
      const unsubscribe = row.subscribe(listener);
      return () => {
        unsubscribe();
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__ && tableId !== undefined && columnId !== undefined) {
          recordAstryxTableReviewCellSubscription({
            tableId,
            rowId: row.id,
            columnId,
            source: "review-status",
            phase: "unsubscribe",
          });
        }
      };
    },
    [columnId, row, tableId],
  );
  const getSnapshot = useCallback(() => row.getSnapshot().status, [row]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
});

function createAstryxTableResetReviewColumns(tableId: string) {
  return [
    {
      columnId: "COL_ID_ROW",
      field: "rowId",
      headerName: "Row",
      valueType: "text",
      pinned: "start",
    },
    {
      columnId: "COL_ID_COLUMN",
      field: "columnLabel",
      headerName: "Column",
      valueType: "text",
      pinned: "start",
    },
    {
      columnId: "COL_ID_SERVER_NOW",
      field: "serverText",
      headerName: "Server now",
      valueType: "text",
      enableSorting: false,
      enableFilter: false,
    },
    {
      columnId: "COL_ID_YOURS",
      field: "mineText",
      headerName: "Yours",
      valueType: "text",
      enableSorting: false,
      enableFilter: false,
    },
    {
      columnId: "COL_ID_STATUS",
      field: "statusText",
      headerName: "Status",
      valueType: "text",
      enableSorting: false,
      enableFilter: false,
      cellRenderer: ({ row }: { readonly row: AstryxTableEditReviewDisplayRow }) => (
        <AstryxTableEditReviewStatus row={row} tableId={tableId} columnId="COL_ID_STATUS" />
      ),
    },
  ] satisfies AstryxTableColumns<AstryxTableEditReviewDisplayRow>;
}
const ASTRYX_TABLE_RESET_REVIEW_INITIAL_ORDER_BY = [
  { columnId: "COL_ID_ROW", direction: "asc" },
] as const satisfies AstryxTableSortBy<ReturnType<typeof createAstryxTableResetReviewColumns>>;
const getAstryxTableEditReviewRowId = (row: AstryxTableEditReviewDisplayRow): string => row.id;

function AstryxTableResetReviewTable({
  reviewRows,
}: Readonly<{
  readonly reviewRows: readonly AstryxTableCellEditDraftReviewSourceRow[];
}>): ReactNode {
  const instanceId = useId();
  const tableId = `ASTRYX_TABLE_INTERNAL_RESET_REVIEW_${instanceId}`;
  const columns = useMemo(() => createAstryxTableResetReviewColumns(tableId), [tableId]);
  const rows = reviewRows;
  if (rows.length === 0) {
    return <p role="status">All changes now match the server.</p>;
  }
  return (
    <AstryxTableClientInstance
      gridAriaLabel="Reset Review changes"
      tableId={tableId}
      registerIdentity={false}
      props={{
        tableId,
        columns,
        initialOrderBy: ASTRYX_TABLE_RESET_REVIEW_INITIAL_ORDER_BY,
        clientSource: {
          rows,
          totalRows: rows.length,
          version: rows.length,
          status: "ready",
        },
        getRowId: getAstryxTableEditReviewRowId,
      }}
    />
  );
}

function AstryxTableConflictReviewTable({
  rows,
  runtime,
  selection,
  resolve,
}: Readonly<{
  readonly rows: readonly AstryxTableCellEditDraftReviewSourceRow[];
  readonly runtime: AstryxTableEditMemoryRuntime;
  readonly selection: AstryxTableRowSelectionRuntime;
  readonly resolve: (id: string, resolution: "mine" | "server") => void;
}>): ReactNode {
  const instanceId = useId();
  const tableId = `ASTRYX_TABLE_INTERNAL_CONFLICT_REVIEW_${instanceId}`;
  const columns = useMemo(
    () =>
      [
        {
          columnId: "COL_ID_ROW",
          field: "rowId",
          headerName: "Row",
          valueType: "text",
          pinned: "start",
        },
        {
          columnId: "COL_ID_COLUMN",
          field: "columnLabel",
          headerName: "Column",
          valueType: "text",
          pinned: "start",
        },
        {
          columnId: "COL_ID_BASE",
          field: "baseText",
          headerName: "Base",
          valueType: "text",
          enableSorting: false,
          enableFilter: false,
        },
        {
          columnId: "COL_ID_SERVER_NOW",
          field: "serverText",
          headerName: "Server now",
          valueType: "text",
          enableSorting: false,
          enableFilter: false,
        },
        {
          columnId: "COL_ID_YOURS",
          field: "mineText",
          headerName: "Yours",
          valueType: "text",
          enableSorting: false,
          enableFilter: false,
        },
        {
          columnId: "COL_ID_RESOLUTION",
          field: "resolutionText",
          headerName: "Resolution",
          valueType: "text",
          pinned: "end",
          enableSorting: false,
          enableFilter: false,
          cellRenderer: ({ row }: { readonly row: AstryxTableCellEditDraftReviewSourceRow }) => (
            <AstryxTableConflictReviewResolution
              row={row}
              runtime={runtime}
              resolve={resolve}
              tableId={tableId}
              columnId="COL_ID_RESOLUTION"
            />
          ),
        },
      ] satisfies AstryxTableColumns<AstryxTableCellEditDraftReviewSourceRow>,
    [resolve, runtime, tableId],
  );
  const initialOrderBy = useMemo(() => [{ columnId: "COL_ID_ROW", direction: "asc" }] as const, []);
  if (rows.length === 0) return <p role="status">All conflicts are current.</p>;
  return (
    <AstryxTableClientInstance
      gridAriaLabel="Conflict Review changes"
      tableId={tableId}
      registerIdentity={false}
      reviewRowSelection={selection}
      props={{
        tableId,
        columns,
        initialOrderBy,
        clientSource: {
          rows,
          totalRows: rows.length,
          version: rows.reduce((version, row) => version + row.getSnapshot().reviewVersion, 0),
          status: "ready",
        },
        getRowId: getAstryxTableEditReviewRowId,
        rowSelection: true,
      }}
    />
  );
}

function AstryxTableBlockedReviewTable({
  rows,
  selection,
}: Readonly<{
  readonly rows: readonly AstryxTableCellEditDraftReviewSourceRow[];
  readonly selection: AstryxTableRowSelectionRuntime;
}>): ReactNode {
  const instanceId = useId();
  const tableId = `ASTRYX_TABLE_INTERNAL_BLOCKED_REVIEW_${instanceId}`;
  const columns = useMemo(
    () =>
      [
        {
          columnId: "COL_ID_ROW",
          field: "rowId",
          headerName: "Row",
          valueType: "text",
          pinned: "start",
        },
        {
          columnId: "COL_ID_COLUMN",
          field: "columnLabel",
          headerName: "Column",
          valueType: "text",
          pinned: "start",
        },
        {
          columnId: "COL_ID_SERVER_NOW",
          field: "serverText",
          headerName: "Server now",
          valueType: "text",
          enableSorting: false,
          enableFilter: false,
        },
        {
          columnId: "COL_ID_MINE",
          field: "mineText",
          headerName: "Mine",
          valueType: "text",
          enableSorting: false,
          enableFilter: false,
        },
        {
          columnId: "COL_ID_REASON",
          field: "statusText",
          headerName: "Reason",
          valueType: "text",
          enableSorting: false,
          enableFilter: false,
          cellRenderer: ({ row }: { readonly row: AstryxTableCellEditDraftReviewSourceRow }) => (
            <AstryxTableEditReviewStatus row={row} tableId={tableId} columnId="COL_ID_REASON" />
          ),
        },
      ] satisfies AstryxTableColumns<AstryxTableCellEditDraftReviewSourceRow>,
    [tableId],
  );
  const initialOrderBy = useMemo(() => [{ columnId: "COL_ID_ROW", direction: "asc" }] as const, []);
  if (rows.length === 0) return null;
  return (
    <AstryxTableClientInstance
      gridAriaLabel="Blocked Changes Review changes"
      tableId={tableId}
      registerIdentity={false}
      reviewRowSelection={selection}
      props={{
        tableId,
        columns,
        initialOrderBy,
        clientSource: {
          rows,
          totalRows: rows.length,
          version: rows.reduce((version, row) => version + row.getSnapshot().reviewVersion, 0),
          status: "ready",
        },
        getRowId: getAstryxTableEditReviewRowId,
        rowSelection: true,
      }}
    />
  );
}

function requireAstryxTableId(tableId: unknown): string {
  if (typeof tableId !== "string" || tableId.trim().length === 0) {
    throw new TypeError("AstryxTable tableId must be a non-empty string.");
  }
  return tableId;
}
