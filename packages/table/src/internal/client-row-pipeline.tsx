import { memo, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { NamedExoticComponent, ReactElement } from "react";
import type { CompiledColumn } from "./compile-columns";
import {
  compileClientFilterPlan,
  type AstryxTableClientFilterCollection,
  type ClientFilterPlan,
} from "./grid-query";
import type { AstryxTableColumnLayoutSnapshot } from "./column-management";
import type {
  AstryxTableClientProjectionInvalid,
  AstryxTableInstalledClientProjectionSnapshot,
  AstryxTableInvalidCellValue,
  AstryxTableQuerySnapshot,
  AstryxTableQueryNavigationMode,
  AstryxTableRowPipelinePublication,
  AstryxTableRowPipelineRuntimeView,
} from "./grid-runtime";
import { isAstryxTableInvalidCellValue } from "./grid-runtime";
import type { AstryxTableLogicalRowSpace, AstryxTableRowPipelineProps } from "./astryx-table-view";
import {
  createClientAdmittedQueryProjectionPlan,
  type AstryxTableClientAdmittedRow,
  type AstryxTableClientProjectionInputSnapshot,
  type AstryxTableClientRowOrderChangeDetector,
  type AstryxTableClientRowsStore,
} from "./client-source-adapter";
import { useClientRowIds } from "./client-adapter";
import { ClientSortStability } from "./client-sort-stability";
import { createAstryxTableClientRowComparator } from "./client-row-model";
import { recordAstryxTableClientRowOrderPlanning } from "./render-instrumentation";
import {
  deriveAstryxTableClientGroupedProjection,
  type AstryxTableClientGroupedProjection,
  type AstryxTableClientGroupedRow,
} from "./client-grouping";
import {
  AstryxTableGroupedPresentationCompiler,
  compileAstryxTableGroupRowsColumn,
  type AstryxTableCompiledGroupRowsColumn,
  type AstryxTableGroupedPresentationInput,
} from "./client-grouping-presentation";
import {
  AstryxTableClientProjectionCoordinator,
  createAstryxTableGroupedProjectionCandidate,
  createAstryxTableInvalidProjectionCandidate,
  createAstryxTableRawProjectionCandidate,
  type AstryxTableClientProjectionCandidate,
} from "./client-projection";

export type AstryxTableClientRowPipelineAdapterView = Readonly<{
  readonly resolveRowId: (row: unknown) => string;
  readonly createRowsStore: (
    runtime: AstryxTableRowPipelineRuntimeView,
    createDetector: () => AstryxTableClientRowOrderChangeDetector,
    tableId?: string,
  ) => AstryxTableClientRowsStore;
  readonly acceptRows: (
    rows: readonly AstryxTableClientAdmittedRow[],
  ) => "accepted-changed" | "accepted-unchanged" | "invalid-source" | "stale-snapshot";
  readonly rejectQueryRows: (
    rows: readonly AstryxTableClientAdmittedRow[],
    invalid: AstryxTableClientProjectionInvalid,
  ) => AstryxTableRowPipelinePublication<unknown> | undefined;
  readonly retryQueryRows: () => AstryxTableRowPipelinePublication<unknown> | undefined;
  readonly publishResultRowCount: (count: number) => void;
  readonly projectGroupedRows: (
    rows: readonly AstryxTableClientGroupedRow[],
    changedRowIds: ReadonlySet<string>,
    sourceAuthoritative: boolean,
  ) => AstryxTableRowPipelinePublication<unknown>;
  readonly projectUngroupedRows: () => AstryxTableRowPipelinePublication<unknown>;
  readonly getProjectionInputSnapshot: () => AstryxTableClientProjectionInputSnapshot;
  readonly subscribeProjectionInput: (listener: () => void) => () => void;
}>;

type ClientResolvedRowOrderProps = AstryxTableRowPipelineProps<
  AstryxTableRowPipelineRuntimeView,
  AstryxTableClientRowPipelineAdapterView
> & {
  readonly columnLayout: AstryxTableColumnLayoutSnapshot;
  readonly filters: readonly unknown[];
  readonly filterCollection: AstryxTableClientFilterCollection;
  readonly quickFilter: string;
  readonly quickFilterFields: readonly string[];
  readonly queryGeneration: number;
  readonly queryNavigationMode: AstryxTableQueryNavigationMode;
  readonly orderBy: readonly {
    readonly columnId: string;
    readonly direction: "asc" | "desc";
  }[];
  readonly groupBy: readonly string[];
  readonly groupOrderBy: readonly {
    readonly columnId: string;
    readonly direction: "asc" | "desc";
  }[];
  readonly rowsWidth?: number;
};

export const AstryxTableClientRowPipeline: NamedExoticComponent<
  AstryxTableRowPipelineProps<
    AstryxTableRowPipelineRuntimeView,
    AstryxTableClientRowPipelineAdapterView
  >
> = memo(function AstryxTableClientRowPipeline(
  props: AstryxTableRowPipelineProps<
    AstryxTableRowPipelineRuntimeView,
    AstryxTableClientRowPipelineAdapterView
  >,
): ReactElement {
  const query = useSyncExternalStore(
    props.runtime.subscribeQuery,
    props.runtime.getQuerySnapshot,
    props.runtime.getQuerySnapshot,
  );
  const columnLayout = useSyncExternalStore(
    props.runtime.subscribeColumnStructure,
    props.runtime.getColumnStructureSnapshot,
    props.runtime.getColumnStructureSnapshot,
  );
  const installedProjection = useSyncExternalStore(
    props.runtime.subscribeInstalledClientProjection,
    props.runtime.getInstalledClientProjectionSnapshot,
    props.runtime.getInstalledClientProjectionSnapshot,
  );
  if (installedProjection !== undefined) {
    return props.children(
      installedProjection.kind === "invalid"
        ? Object.freeze({
            kind: "invalid" as const,
            columns: installedProjection.columns,
            invalid: installedProjection.invalid,
          })
        : Object.freeze({
            kind: "rows" as const,
            runtime: props.runtime,
            rowSpace: installedProjection.rowSpace,
            columns: installedProjection.columns,
            queryGeneration: installedProjection.queryGeneration,
            queryNavigationMode: installedProjection.queryNavigationMode,
            loading: false,
          }),
    );
  }
  return (
    <ClientRawResolvedRowOrder
      {...props}
      columnLayout={columnLayout}
      columns={query.columns}
      filters={query.filters}
      filterCollection={query.filterCollection}
      quickFilter={query.quickFilter}
      quickFilterFields={props.runtime.getQuickFilterFieldsSnapshot()}
      orderBy={query.orderBy}
      groupBy={query.groupBy}
      groupOrderBy={query.groupOrderBy}
      {...(query.rowsWidth === undefined ? {} : { rowsWidth: query.rowsWidth })}
      queryGeneration={query.generation}
      queryNavigationMode={query.navigationMode}
    />
  );
});

const ClientRawResolvedRowOrder = memo(function ClientRawResolvedRowOrder({
  runtime,
  tableId,
  columns,
  rowPipelineAdapter,
  rowSelection,
  children,
  filters,
  filterCollection,
  quickFilter,
  quickFilterFields,
  orderBy,
  queryGeneration,
  queryNavigationMode,
  columnLayout,
}: ClientResolvedRowOrderProps) {
  const filterPlan = useMemo(
    () => compileClientFilterPlan(columns, filters, filterCollection),
    [columns, filterCollection, filters],
  );
  const sortStability = useMemo(
    () =>
      new ClientSortStability(
        createAstryxTableClientRowComparator<AstryxTableClientAdmittedRow>(
          columns,
          orderBy,
          (column, row) => {
            const value = row.values.read(row.raw, row.rowId, row.rowIndex, column);
            if (isAstryxTableInvalidCellValue(value)) throw value.invalid;
            return value;
          },
          (row) => row.rowIndex,
        ),
      ),
    [columns, filterPlan, orderBy, queryGeneration],
  );
  const createDetector = useMemo(
    () => () =>
      createRowOrderChangeDetector(
        tableId,
        columns,
        filters,
        quickFilter,
        quickFilterFields,
        orderBy,
        filterPlan,
        sortStability,
      ),
    [columns, filterPlan, filters, orderBy, quickFilter, quickFilterFields, sortStability, tableId],
  );
  const rowsStore = useMemo(
    () => rowPipelineAdapter.createRowsStore(runtime, createDetector, tableId),
    [createDetector, rowPipelineAdapter, runtime, tableId],
  );
  const rows = useSyncExternalStore(
    rowsStore.subscribe,
    rowsStore.getSnapshot,
    rowsStore.getSnapshot,
  );
  const sourceRowIds = rowsStore.getSourceRowIdsSnapshot(rows);
  const rowModel = useClientRowIds(
    rows,
    columns,
    orderBy,
    filters,
    tableId,
    columnLayout,
    quickFilter,
    quickFilterFields,
    filterPlan,
  );
  const invalid = rowModel.kind === "invalid" ? rowModel.invalid : undefined;
  const rawRowIds =
    invalid === undefined && rowModel.kind === "ready" ? rowModel.rowIds : EMPTY_ROW_IDS;
  const [rawOrderStore] = useState(() => new ClientRowOrderStore(rawRowIds, queryGeneration));
  useLayoutEffect(() => {
    rawOrderStore.publish(rawRowIds, queryGeneration);
  }, [queryGeneration, rawOrderStore, rawRowIds]);
  const rawOrderSnapshot = useSyncExternalStore(
    rawOrderStore.subscribe,
    rawOrderStore.getSnapshot,
    rawOrderStore.getSnapshot,
  );
  useLayoutEffect(() => {
    const candidate = rowPipelineAdapter.retryQueryRows();
    if (candidate !== undefined) runtime.publishRowPipeline(candidate);
  }, [queryGeneration, rowPipelineAdapter, runtime]);
  useLayoutEffect(() => {
    if (invalid === undefined) {
      const acceptance = rowPipelineAdapter.acceptRows(rows);
      if (acceptance === "invalid-source" || acceptance === "stale-snapshot") return;
      if (rowModel.kind === "ready") sortStability.commit(rows, rowModel.rowIds);
    } else {
      const fallback = rowPipelineAdapter.rejectQueryRows(rows, invalid);
      if (fallback !== undefined) {
        runtime.publishRowPipeline(fallback);
      }
    }
    rowPipelineAdapter.publishResultRowCount(
      rowModel.kind === "ready" ? rowModel.rowIds.length : 0,
    );
    if (rowModel.kind === "ready" && sourceRowIds.authoritative) {
      rowSelection?.leaveGroupedProjection(sourceRowIds.rowIds);
      rowSelection?.reconcile(sourceRowIds.rowIds, rowModel.rowIds, sourceRowIds.token);
    }
  }, [
    invalid,
    rowModel,
    rowPipelineAdapter,
    rowSelection,
    rows,
    runtime,
    sortStability,
    sourceRowIds,
  ]);
  return children(
    invalid !== undefined
      ? Object.freeze({
          kind: "invalid" as const,
          columns: rowModel.columns,
          invalid,
        })
      : Object.freeze({
          kind: "rows" as const,
          runtime,
          rowSpace: rawOrderSnapshot.rowSpace,
          columns: rowModel.columns,
          queryGeneration: rawOrderSnapshot.queryGeneration,
          queryNavigationMode,
          loading: false,
        }),
  );
});

type ClientProjectionConfiguration = Readonly<{
  readonly columns: readonly CompiledColumn[];
  readonly logicalColumns?: readonly CompiledColumn[];
  readonly columnLayout: AstryxTableColumnLayoutSnapshot;
  readonly filters: readonly unknown[];
  readonly filterCollection: AstryxTableClientFilterCollection;
  readonly quickFilter: string;
  readonly quickFilterFields: readonly string[];
  readonly orderBy: ClientResolvedRowOrderProps["orderBy"];
  readonly groupBy: readonly string[];
  readonly groupOrderBy: ClientResolvedRowOrderProps["groupOrderBy"];
  readonly rowsWidth?: number;
  readonly queryGeneration: number;
  readonly queryNavigationMode: AstryxTableQueryNavigationMode;
}>;

type ClientProjectionRowModel =
  | Readonly<{
      readonly kind: "ready";
      readonly columns: readonly CompiledColumn[];
      readonly visibleColumns: readonly CompiledColumn[];
      readonly rowIds: readonly string[];
      readonly filteredRows: readonly AstryxTableClientAdmittedRow[];
    }>
  | Readonly<{
      readonly kind: "invalid";
      readonly columns: readonly CompiledColumn[];
      readonly visibleColumns: readonly CompiledColumn[];
      readonly invalid: AstryxTableInvalidCellValue["invalid"];
    }>;

export class AstryxTableClientProjectionPlanCompiler {
  private sourceColumns: readonly CompiledColumn[] | undefined;
  private columnLayout: AstryxTableColumnLayoutSnapshot | undefined;
  private logicalColumns: readonly CompiledColumn[] | undefined;
  private readonly presentationCompiler = new AstryxTableGroupedPresentationCompiler();
  private presentationSourceColumns: readonly CompiledColumn[] | undefined;
  private presentationVisibleColumnIds: readonly string[] | undefined;
  private presentationGroupBy: readonly string[] | undefined;
  private presentationRowsColumn: AstryxTableCompiledGroupRowsColumn | undefined;
  private presentationRowsWidth: number | undefined;
  private presentationInput: AstryxTableGroupedPresentationInput | undefined;
  private presentationColumns: readonly CompiledColumn[] | undefined;
  private logicalCompilations = 0;
  private presentationCompilations = 0;
  private presentationDescriptorBuilds = 0;

  public projectLogicalColumns(
    columns: readonly CompiledColumn[],
    layout: AstryxTableColumnLayoutSnapshot,
  ): readonly CompiledColumn[] {
    if (
      this.sourceColumns === columns &&
      this.columnLayout !== undefined &&
      sameLogicalColumnProjection(this.columnLayout, layout)
    ) {
      return this.logicalColumns as readonly CompiledColumn[];
    }
    const logicalColumns = projectCurrentLogicalColumns(columns, layout);
    this.sourceColumns = columns;
    this.columnLayout = layout;
    this.logicalColumns = logicalColumns;
    this.logicalCompilations += 1;
    return logicalColumns;
  }

  public compileGroupedPresentation(
    input: AstryxTableGroupedPresentationInput,
  ): readonly CompiledColumn[] {
    if (
      this.presentationColumns !== undefined &&
      this.presentationSourceColumns === input.columns &&
      this.presentationVisibleColumnIds !== undefined &&
      sameStrings(this.presentationVisibleColumnIds, input.visibleColumnIds) &&
      this.presentationGroupBy !== undefined &&
      sameStrings(this.presentationGroupBy, input.groupBy) &&
      this.presentationRowsColumn === input.rowsColumn &&
      this.presentationRowsWidth === input.persistedRowsWidth
    ) {
      return this.presentationColumns;
    }
    this.presentationSourceColumns = input.columns;
    this.presentationVisibleColumnIds = input.visibleColumnIds;
    this.presentationGroupBy = input.groupBy;
    this.presentationRowsColumn = input.rowsColumn;
    this.presentationRowsWidth = input.persistedRowsWidth;
    const candidate = relevantGroupedPresentationInput(input);
    this.presentationDescriptorBuilds += 1;
    const presentationInput =
      this.presentationInput !== undefined &&
      sameRelevantGroupedPresentationInput(this.presentationInput, candidate)
        ? this.presentationInput
        : candidate;
    this.presentationInput = presentationInput;
    const columns = this.presentationCompiler.compile(presentationInput);
    if (columns !== this.presentationColumns) {
      this.presentationColumns = columns;
      this.presentationCompilations += 1;
    }
    return columns;
  }

  public getCompilationDiagnosticSnapshot(): Readonly<{
    readonly logical: number;
    readonly presentation: number;
    readonly presentationDescriptors: number;
  }> {
    return Object.freeze({
      logical: this.logicalCompilations,
      presentation: this.presentationCompilations,
      presentationDescriptors: this.presentationDescriptorBuilds,
    });
  }
}

export class AstryxTableClientProjectionStore {
  private coordinator: AstryxTableClientProjectionCoordinator | undefined;
  private readonly defaultGroupRowsColumn = compileAstryxTableGroupRowsColumn(undefined);
  private activation = 0;
  private reconciling = false;
  private reconcileRequested = false;
  private rowSelection: ClientResolvedRowOrderProps["rowSelection"];
  private unsubscribeProjectionInput: (() => void) | undefined;
  private unsubscribeQuery: (() => void) | undefined;
  private unsubscribeColumnStructure: (() => void) | undefined;

  public constructor(
    private readonly runtime: AstryxTableRowPipelineRuntimeView,
    private readonly adapter: AstryxTableClientRowPipelineAdapterView,
    rowSelection: ClientResolvedRowOrderProps["rowSelection"],
    private readonly planCompiler: AstryxTableClientProjectionPlanCompiler = new AstryxTableClientProjectionPlanCompiler(),
  ) {
    this.rowSelection = rowSelection;
    this.requestReconcile();
  }

  public activate(): () => void {
    const activation = ++this.activation;
    this.unsubscribeProjectionInput?.();
    this.unsubscribeQuery?.();
    this.unsubscribeColumnStructure?.();
    this.unsubscribeProjectionInput = this.adapter.subscribeProjectionInput(this.requestReconcile);
    this.unsubscribeQuery = this.runtime.subscribeQuery(this.requestReconcile);
    this.unsubscribeColumnStructure = this.runtime.subscribeColumnStructure(this.requestReconcile);
    this.requestReconcile();
    return () => {
      if (this.activation !== activation) return;
      this.unsubscribeProjectionInput?.();
      this.unsubscribeQuery?.();
      this.unsubscribeColumnStructure?.();
      this.unsubscribeProjectionInput = undefined;
      this.unsubscribeQuery = undefined;
      this.unsubscribeColumnStructure = undefined;
    };
  }

  public setRowSelection(rowSelection: ClientResolvedRowOrderProps["rowSelection"]): void {
    this.rowSelection = rowSelection;
  }

  private readonly requestReconcile = (): void => {
    if (this.reconciling) {
      this.reconcileRequested = true;
      return;
    }
    let repeat = true;
    while (repeat) {
      this.reconcileRequested = false;
      this.reconciling = true;
      let expected: ReturnType<AstryxTableClientProjectionStore["reconcileOnce"]>;
      try {
        expected = this.reconcileOnce();
      } finally {
        this.reconciling = false;
      }
      if (!this.reconcileRequested || expected === undefined) return;
      const inputAdvanced =
        this.adapter.getProjectionInputSnapshot().epoch !== expected.projectionInputEpoch;
      const queryAdvanced = !sameProjectionQuery(this.runtime.getQuerySnapshot(), expected.query);
      const structureAdvanced = !sameProjectionColumnStructure(
        this.runtime.getColumnStructureSnapshot(),
        expected.columnStructure,
      );
      repeat = inputAdvanced || queryAdvanced || structureAdvanced;
    }
  };

  private readonly reconcileOnce = ():
    | Readonly<{
        readonly projectionInputEpoch: number;
        readonly query: ReturnType<AstryxTableRowPipelineRuntimeView["getQuerySnapshot"]>;
        readonly columnStructure: ReturnType<
          AstryxTableRowPipelineRuntimeView["getColumnStructureSnapshot"]
        >;
      }>
    | undefined => {
    const projectionInput = this.adapter.getProjectionInputSnapshot();
    const requested = this.runtime.getQuerySnapshot();
    const installedBeforeStage = this.runtime.getInstalledClientProjectionSnapshot();
    if (requested.groupBy.length === 0 && installedBeforeStage === undefined) return undefined;
    const groupRowsWidth =
      projectionInput.groupRowsColumn?.width ?? this.defaultGroupRowsColumn.width;
    const staged = this.runtime.stageClientProjectionConfiguration(
      projectionInput.columns,
      projectionInput.queryConfiguration,
      groupRowsWidth,
    );
    const configuration: ClientProjectionConfiguration = Object.freeze({
      columns: staged.query.columns,
      logicalColumns: this.planCompiler.projectLogicalColumns(
        staged.query.columns,
        staged.columnLayout,
      ),
      columnLayout: staged.columnLayout,
      filters: staged.query.filters,
      filterCollection: staged.query.filterCollection,
      quickFilter: staged.query.quickFilter,
      quickFilterFields: staged.quickFilterFields,
      orderBy: staged.query.orderBy,
      groupBy: staged.query.groupBy,
      groupOrderBy: staged.query.groupOrderBy,
      ...(staged.query.rowsWidth === undefined ? {} : { rowsWidth: staged.query.rowsWidth }),
      queryGeneration: staged.query.generation,
      queryNavigationMode: staged.query.navigationMode,
    });
    const rowModel = deriveClientProjectionRowModel(projectionInput.rows, configuration);
    const installedBeforeCandidate = this.runtime.getInstalledClientProjectionSnapshot();
    const retriedPublication =
      installedBeforeCandidate?.kind === "invalid" &&
      installedBeforeCandidate.queryGeneration === configuration.queryGeneration
        ? undefined
        : this.adapter.retryQueryRows();
    let ungroupedPublication = retriedPublication ?? this.adapter.projectUngroupedRows();
    const previousGroupedProjection = this.coordinator?.getPreviousGroupedProjection();
    let candidate: AstryxTableClientProjectionCandidate;
    if (rowModel.kind === "invalid") {
      ungroupedPublication =
        this.adapter.rejectQueryRows(projectionInput.rows, rowModel.invalid) ??
        ungroupedPublication;
      const groupedColumns =
        configuration.groupBy.length === 0
          ? undefined
          : this.planCompiler.compileGroupedPresentation({
              columns: rowModel.columns,
              visibleColumnIds: configuration.columnLayout.visibleColumnIds,
              groupBy: configuration.groupBy,
              rowsColumn: projectionInput.groupRowsColumn ?? this.defaultGroupRowsColumn,
              ...(configuration.rowsWidth === undefined
                ? {}
                : { persistedRowsWidth: configuration.rowsWidth }),
            });
      const groupedPresentationKey =
        groupedColumns === undefined
          ? undefined
          : clientGroupedProjectionPresentationKey(groupedColumns, configuration.queryGeneration);
      const retained =
        groupedColumns === undefined || groupedPresentationKey === undefined
          ? undefined
          : retainCompatibleGroupedCandidate({
              fallbackPublication: ungroupedPublication,
              previousGroupedProjection,
              installedProjection: installedBeforeCandidate,
              groupBy: configuration.groupBy,
              presentationKey: groupedPresentationKey,
              queryGeneration: configuration.queryGeneration,
              queryNavigationMode: configuration.queryNavigationMode,
              sourceAuthoritative: projectionInput.sourceRowIds.authoritative,
              rowPipelineAdapter: this.adapter,
            });
      candidate =
        retained ??
        createAstryxTableInvalidProjectionCandidate({
          groupBy: configuration.groupBy,
          columns: groupedColumns ?? rowModel.visibleColumns,
          presentationKey:
            groupedPresentationKey ??
            clientProjectionPresentationKey(
              "invalid",
              projectionInput.columns,
              configuration.queryGeneration,
              configuration.columnLayout.version,
              configuration.rowsWidth,
              projectionInput.groupRowsColumn,
            ).concat(":source:", String(ungroupedPublication.version)),
          publication: ungroupedPublication,
          queryGeneration: configuration.queryGeneration,
          queryNavigationMode: configuration.queryNavigationMode,
          invalid: rowModel.invalid,
        });
    } else {
      this.adapter.acceptRows(projectionInput.rows);
      candidate = createClientProjectionCandidate({
        columns: projectionInput.columns,
        columnLayout: configuration.columnLayout,
        groupBy: configuration.groupBy,
        groupOrderBy: configuration.groupOrderBy,
        ...(configuration.rowsWidth === undefined ? {} : { rowsWidth: configuration.rowsWidth }),
        queryGeneration: configuration.queryGeneration,
        queryNavigationMode: configuration.queryNavigationMode,
        rowModel,
        sourceRows: projectionInput.rows,
        rowPipelineAdapter: this.adapter,
        groupRowsColumn: projectionInput.groupRowsColumn,
        presentationRowsColumn: projectionInput.groupRowsColumn ?? this.defaultGroupRowsColumn,
        sourceAuthoritative: projectionInput.sourceRowIds.authoritative,
        ungroupedPublication,
        planCompiler: this.planCompiler,
        ...(installedBeforeCandidate === undefined
          ? {}
          : { installedProjection: installedBeforeCandidate }),
        ...(previousGroupedProjection === undefined ? {} : { previousGroupedProjection }),
      });
    }
    this.coordinator ??= new AstryxTableClientProjectionCoordinator(candidate);
    this.coordinator.commit(candidate, (publication) =>
      this.runtime.reconcileClientProjection(
        publication,
        projectionInput.columns,
        projectionInput.queryConfiguration,
        groupRowsWidth,
      ),
    );
    const installed = this.coordinator.getSnapshot();
    this.adapter.publishResultRowCount(installed.rowIds.length);
    if (installed.kind === "grouped" || installed.groupBy.length > 0) {
      this.rowSelection?.enterGroupedProjection();
    } else if (projectionInput.sourceRowIds.authoritative) {
      this.rowSelection?.leaveGroupedProjection(projectionInput.sourceRowIds.rowIds);
      this.rowSelection?.reconcile(
        projectionInput.sourceRowIds.rowIds,
        installed.rowIds,
        projectionInput.sourceRowIds.token,
      );
    }
    return Object.freeze({
      projectionInputEpoch: projectionInput.epoch,
      query: staged.query,
      columnStructure: staged.columnLayout,
    });
  };
}

function sameProjectionQuery(
  current: AstryxTableQuerySnapshot,
  expected: AstryxTableQuerySnapshot,
): boolean {
  return (
    sameReferences(current.columns, expected.columns) &&
    sameReferences(current.filters, expected.filters) &&
    current.quickFilter === expected.quickFilter &&
    sameOrderBy(current.orderBy, expected.orderBy) &&
    sameStrings(current.groupBy, expected.groupBy) &&
    sameOrderBy(current.groupOrderBy, expected.groupOrderBy) &&
    current.rowsWidth === expected.rowsWidth &&
    current.generation === expected.generation &&
    current.navigationMode === expected.navigationMode
  );
}

function sameProjectionColumnStructure(
  current: AstryxTableColumnLayoutSnapshot,
  expected: AstryxTableColumnLayoutSnapshot,
): boolean {
  return (
    sameProjectionColumns(current.allColumns, expected.allColumns) &&
    sameStrings(current.visibleColumnIds, expected.visibleColumnIds)
  );
}

function sameProjectionColumns(
  current: readonly CompiledColumn[],
  expected: readonly CompiledColumn[],
): boolean {
  return (
    current === expected ||
    (current.length === expected.length &&
      current.every((column, index) => {
        const expectedColumn = expected[index];
        return (
          column.columnId === expectedColumn?.columnId &&
          column.pinned === expectedColumn.pinned &&
          column.semantics.width === expectedColumn.semantics.width
        );
      }))
  );
}

function relevantGroupedPresentationInput(
  input: AstryxTableGroupedPresentationInput,
): AstryxTableGroupedPresentationInput {
  const active = new Set(input.groupBy);
  const visible = new Set(input.visibleColumnIds);
  const columns = Object.freeze(
    input.columns.filter(
      (column) =>
        column.kind === "field" &&
        (active.has(column.columnId) ||
          (column.aggFunc !== undefined && visible.has(column.columnId))),
    ),
  );
  const visibleColumnIds = Object.freeze(
    columns.flatMap((column) =>
      column.kind === "field" &&
      column.aggFunc !== undefined &&
      !active.has(column.columnId) &&
      visible.has(column.columnId)
        ? [column.columnId]
        : [],
    ),
  );
  return Object.freeze({
    columns,
    visibleColumnIds,
    groupBy: input.groupBy,
    rowsColumn: input.rowsColumn,
    ...(input.persistedRowsWidth === undefined
      ? {}
      : { persistedRowsWidth: input.persistedRowsWidth }),
  });
}

function sameRelevantGroupedPresentationInput(
  previous: AstryxTableGroupedPresentationInput,
  next: AstryxTableGroupedPresentationInput,
): boolean {
  return (
    previous.rowsColumn === next.rowsColumn &&
    previous.persistedRowsWidth === next.persistedRowsWidth &&
    sameStrings(previous.visibleColumnIds, next.visibleColumnIds) &&
    sameStrings(previous.groupBy, next.groupBy) &&
    previous.columns.length === next.columns.length &&
    previous.columns.every((column, index) =>
      sameGroupedPresentationColumn(column, next.columns[index]),
    )
  );
}

function sameGroupedPresentationColumn(
  previous: CompiledColumn,
  next: CompiledColumn | undefined,
): boolean {
  if (next === undefined) return false;
  if (previous === next) return true;
  const previousKeys = Reflect.ownKeys(previous).filter((key) => key !== "pinned");
  const nextKeys = Reflect.ownKeys(next).filter((key) => key !== "pinned");
  return (
    previousKeys.length === nextKeys.length &&
    previousKeys.every(
      (key, index) =>
        key === nextKeys[index] && Object.is(Reflect.get(previous, key), Reflect.get(next, key)),
    )
  );
}

function sameOrderBy(
  current: readonly { readonly columnId: string; readonly direction: "asc" | "desc" }[],
  expected: readonly { readonly columnId: string; readonly direction: "asc" | "desc" }[],
): boolean {
  return (
    current === expected ||
    (current.length === expected.length &&
      current.every(
        (entry, index) =>
          entry.columnId === expected[index]?.columnId &&
          entry.direction === expected[index]?.direction,
      ))
  );
}

function sameReferences<T>(current: readonly T[], expected: readonly T[]): boolean {
  return (
    current === expected ||
    (current.length === expected.length &&
      current.every((value, index) => value === expected[index]))
  );
}

function sameStrings(current: readonly string[], expected: readonly string[]): boolean {
  return sameReferences(current, expected);
}

export function deriveClientProjectionRowModel(
  rows: readonly AstryxTableClientAdmittedRow[],
  configuration: ClientProjectionConfiguration,
): ClientProjectionRowModel {
  const logicalColumns =
    configuration.logicalColumns ??
    projectCurrentLogicalColumns(configuration.columns, configuration.columnLayout);
  const visible = new Set(configuration.columnLayout.visibleColumnIds);
  const visibleColumns = Object.freeze(
    logicalColumns.filter((column) => visible.has(column.columnId)),
  );
  const filterPlan = compileClientFilterPlan(
    configuration.columns,
    configuration.filters,
    configuration.filterCollection,
  );
  const { filterPredicate } = createClientAdmittedQueryProjectionPlan(
    configuration.columns,
    configuration.filters,
    configuration.quickFilter,
    configuration.quickFilterFields,
    configuration.orderBy,
    filterPlan,
  );
  const readValue = (column: CompiledColumn, row: AstryxTableClientAdmittedRow): unknown => {
    const value = row.values.read(row.raw, row.rowId, row.rowIndex, column);
    if (isAstryxTableInvalidCellValue(value)) throw new ClientProjectionValueError(value.invalid);
    return value;
  };
  try {
    const filteredRows = Object.freeze(
      rows.filter((row) => filterPredicate === undefined || filterPredicate(row)),
    );
    const orderedRows =
      configuration.groupBy.length === 0
        ? Object.freeze(
            Array.from(filteredRows).sort(
              createAstryxTableClientRowComparator(
                configuration.columns,
                configuration.orderBy,
                readValue,
                (row) => row.rowIndex,
              ),
            ),
          )
        : filteredRows;
    return Object.freeze({
      kind: "ready" as const,
      columns: logicalColumns,
      visibleColumns,
      rowIds: Object.freeze(orderedRows.map((row) => row.rowId)),
      filteredRows,
    });
  } catch (error) {
    const invalid =
      error instanceof ClientProjectionValueError
        ? error.invalid
        : isInvalidValueEvidence(error)
          ? error
          : Object.freeze({
              kind: "invalid-value" as const,
              rowIndex: 0,
              columnId: "COL_ID_ASTRYX_TABLE_ROWS",
              message: error instanceof Error ? error.message : "Client projection is invalid.",
            });
    return Object.freeze({
      kind: "invalid" as const,
      columns: logicalColumns,
      visibleColumns,
      invalid,
    });
  }
}

function projectCurrentLogicalColumns(
  columns: readonly CompiledColumn[],
  layout: AstryxTableColumnLayoutSnapshot,
): readonly CompiledColumn[] {
  const currentById = new Map<string, CompiledColumn>(
    columns.map((column) => [column.columnId, column] as const),
  );
  return Object.freeze(
    layout.allColumns.flatMap((requested) => {
      const columnId = requested.columnId;
      const current = currentById.get(columnId);
      if (current === undefined) return [];
      let projected = current;
      if (current.semantics.width !== requested.semantics.width) {
        projected = Object.freeze({
          ...projected,
          semantics: Object.freeze({ ...projected.semantics, width: requested.semantics.width }),
        });
      }
      if (projected.pinned !== requested.pinned) {
        const withPin = { ...projected };
        if (requested.pinned === undefined) delete withPin.pinned;
        else withPin.pinned = requested.pinned;
        projected = Object.freeze(withPin);
      }
      return [projected];
    }),
  );
}

function sameLogicalColumnProjection(
  previous: AstryxTableColumnLayoutSnapshot,
  next: AstryxTableColumnLayoutSnapshot,
): boolean {
  return (
    previous.allColumns.length === next.allColumns.length &&
    previous.allColumns.every((column, index) => {
      const nextColumn = next.allColumns[index];
      return (
        column.columnId === nextColumn?.columnId &&
        column.pinned === nextColumn.pinned &&
        column.semantics.width === nextColumn.semantics.width
      );
    })
  );
}

class ClientProjectionValueError extends Error {
  public constructor(public readonly invalid: AstryxTableInvalidCellValue["invalid"]) {
    super(invalid.message);
  }
}

function isInvalidValueEvidence(input: unknown): input is AstryxTableInvalidCellValue["invalid"] {
  return (
    typeof input === "object" &&
    input !== null &&
    Reflect.get(input, "kind") === "invalid-value" &&
    typeof Reflect.get(input, "rowIndex") === "number" &&
    typeof Reflect.get(input, "columnId") === "string" &&
    typeof Reflect.get(input, "message") === "string"
  );
}

function createClientProjectionCandidate(
  input: Readonly<{
    readonly columns: readonly CompiledColumn[];
    readonly columnLayout: AstryxTableColumnLayoutSnapshot;
    readonly groupBy: readonly string[];
    readonly groupOrderBy: ClientResolvedRowOrderProps["groupOrderBy"];
    readonly rowsWidth?: number;
    readonly queryGeneration: number;
    readonly queryNavigationMode: AstryxTableQueryNavigationMode;
    readonly rowModel: Extract<ClientProjectionRowModel, { readonly kind: "ready" }>;
    readonly sourceRows: readonly AstryxTableClientAdmittedRow[];
    readonly rowPipelineAdapter: AstryxTableClientRowPipelineAdapterView;
    readonly groupRowsColumn: AstryxTableCompiledGroupRowsColumn | undefined;
    readonly presentationRowsColumn: AstryxTableCompiledGroupRowsColumn;
    readonly sourceAuthoritative: boolean;
    readonly ungroupedPublication: AstryxTableRowPipelinePublication<unknown>;
    readonly planCompiler: AstryxTableClientProjectionPlanCompiler;
    readonly previousGroupedProjection?: AstryxTableClientGroupedProjection;
    readonly installedProjection?: AstryxTableInstalledClientProjectionSnapshot;
  }>,
): AstryxTableClientProjectionCandidate {
  if (input.groupBy.length === 0) {
    return createAstryxTableRawProjectionCandidate({
      columns: input.rowModel.visibleColumns,
      presentationKey: clientProjectionPresentationKey(
        "raw",
        input.columns,
        input.queryGeneration,
        input.columnLayout.version,
        input.rowsWidth,
        input.groupRowsColumn,
      ),
      rowIds: input.rowModel.rowIds,
      publication: input.ungroupedPublication,
      queryGeneration: input.queryGeneration,
      queryNavigationMode: input.queryNavigationMode,
    });
  }
  const groupedColumns = input.planCompiler.compileGroupedPresentation({
    columns: input.rowModel.columns,
    visibleColumnIds: input.columnLayout.visibleColumnIds,
    groupBy: input.groupBy,
    rowsColumn: input.presentationRowsColumn,
    ...(input.rowsWidth === undefined ? {} : { persistedRowsWidth: input.rowsWidth }),
  });
  const groupedPresentationKey = clientGroupedProjectionPresentationKey(
    groupedColumns,
    input.queryGeneration,
  );
  const projection = deriveAstryxTableClientGroupedProjection({
    rows: input.rowModel.filteredRows.map((row) => ({
      raw: row.raw,
      rowId: row.rowId,
      rowIndex: row.rowIndex,
      readValue: (column) => row.values.read(row.raw, row.rowId, row.rowIndex, column),
    })),
    columns: input.columns,
    participatingAggregateColumnIds: new Set(
      input.rowModel.visibleColumns.map((column) => column.columnId),
    ),
    groupBy: input.groupBy,
    groupOrderBy: input.groupOrderBy,
    ...(input.previousGroupedProjection === undefined
      ? {}
      : { previous: input.previousGroupedProjection }),
  });
  if (projection.kind === "invalid") {
    const invalid: AstryxTableClientProjectionInvalid =
      projection.invalid.kind === "source-row"
        ? Object.freeze({
            kind: "invalid-value" as const,
            rowIndex: projection.invalid.rowIndex,
            columnId: projection.invalid.columnId,
            message: projection.invalid.message,
          })
        : Object.freeze({
            kind: "invalid-group" as const,
            columnId: projection.invalid.columnId,
            message: projection.invalid.message,
          });
    const fallbackPublication = input.rowPipelineAdapter.rejectQueryRows(input.sourceRows, invalid);
    const retained = retainCompatibleGroupedCandidate({
      fallbackPublication,
      previousGroupedProjection: input.previousGroupedProjection,
      installedProjection: input.installedProjection,
      groupBy: projection.groupBy,
      presentationKey: groupedPresentationKey,
      queryGeneration: input.queryGeneration,
      queryNavigationMode: input.queryNavigationMode,
      sourceAuthoritative: input.sourceAuthoritative,
      rowPipelineAdapter: input.rowPipelineAdapter,
    });
    if (retained !== undefined) return retained;
    const invalidPublication = fallbackPublication ?? input.ungroupedPublication;
    return createAstryxTableInvalidProjectionCandidate({
      groupBy: projection.groupBy,
      columns: groupedColumns,
      presentationKey: groupedPresentationKey,
      publication: invalidPublication,
      queryGeneration: input.queryGeneration,
      queryNavigationMode: input.queryNavigationMode,
      invalid,
    });
  }
  return createAstryxTableGroupedProjectionCandidate({
    projection,
    columns: groupedColumns,
    presentationKey: groupedPresentationKey,
    publication: input.rowPipelineAdapter.projectGroupedRows(
      projection.rows,
      changedGroupedRowIds(
        input.previousGroupedProjection?.kind === "ready"
          ? input.previousGroupedProjection.rows
          : undefined,
        projection.rows,
      ),
      input.sourceAuthoritative,
    ),
    queryGeneration: input.queryGeneration,
    queryNavigationMode: input.queryNavigationMode,
  });
}

function retainCompatibleGroupedCandidate(
  input: Readonly<{
    readonly fallbackPublication: AstryxTableRowPipelinePublication<unknown> | undefined;
    readonly previousGroupedProjection: AstryxTableClientGroupedProjection | undefined;
    readonly installedProjection: AstryxTableInstalledClientProjectionSnapshot | undefined;
    readonly groupBy: readonly string[];
    readonly presentationKey: string;
    readonly queryGeneration: number;
    readonly queryNavigationMode: AstryxTableQueryNavigationMode;
    readonly sourceAuthoritative: boolean;
    readonly rowPipelineAdapter: AstryxTableClientRowPipelineAdapterView;
  }>,
): AstryxTableClientProjectionCandidate | undefined {
  if (
    input.fallbackPublication?.hasCoherentRows !== true ||
    input.fallbackPublication.rowSpace === undefined ||
    input.previousGroupedProjection?.kind !== "ready" ||
    input.installedProjection?.kind !== "grouped" ||
    input.installedProjection.queryGeneration !== input.queryGeneration ||
    input.installedProjection.presentationKey !== input.presentationKey ||
    !sameStrings(input.previousGroupedProjection.groupBy, input.groupBy)
  ) {
    return undefined;
  }
  return createAstryxTableGroupedProjectionCandidate({
    projection: input.previousGroupedProjection,
    columns: input.installedProjection.columns,
    presentationKey: input.installedProjection.presentationKey,
    publication: input.rowPipelineAdapter.projectGroupedRows(
      input.previousGroupedProjection.rows,
      new Set(),
      input.sourceAuthoritative,
    ),
    queryGeneration: input.queryGeneration,
    queryNavigationMode: input.queryNavigationMode,
  });
}

function changedGroupedRowIds(
  previous: readonly AstryxTableClientGroupedRow[] | undefined,
  next: readonly AstryxTableClientGroupedRow[],
): ReadonlySet<string> {
  if (previous === undefined) return new Set(next.map((row) => row.rowId));
  const previousById = new Map(previous.map((row) => [row.rowId, row]));
  const nextIds = new Set(next.map((row) => row.rowId));
  return new Set([
    ...next.flatMap((row) => (previousById.get(row.rowId) === row ? [] : [row.rowId])),
    ...previous.flatMap((row) => (nextIds.has(row.rowId) ? [] : [row.rowId])),
  ]);
}

function clientProjectionPresentationKey(
  kind: "raw" | "grouped" | "invalid",
  columns: readonly CompiledColumn[],
  queryGeneration: number,
  columnLayoutVersion: number,
  rowsWidth: number | undefined,
  groupRowsColumn: AstryxTableCompiledGroupRowsColumn | undefined,
): string {
  let columnAuthority = CLIENT_PROJECTION_COLUMN_AUTHORITIES.get(columns);
  if (columnAuthority === undefined) {
    columnAuthority = nextClientProjectionColumnAuthority;
    nextClientProjectionColumnAuthority += 1;
    CLIENT_PROJECTION_COLUMN_AUTHORITIES.set(columns, columnAuthority);
  }
  let rowsColumnAuthority: number | null = null;
  if (groupRowsColumn !== undefined) {
    let authority = CLIENT_PROJECTION_ROWS_COLUMN_AUTHORITIES.get(groupRowsColumn);
    if (authority === undefined) {
      authority = nextClientProjectionRowsColumnAuthority;
      nextClientProjectionRowsColumnAuthority += 1;
      CLIENT_PROJECTION_ROWS_COLUMN_AUTHORITIES.set(groupRowsColumn, authority);
    }
    rowsColumnAuthority = authority;
  }
  return JSON.stringify([
    kind,
    columnAuthority,
    queryGeneration,
    columnLayoutVersion,
    rowsWidth ?? null,
    rowsColumnAuthority,
  ]);
}

function clientGroupedProjectionPresentationKey(
  columns: readonly CompiledColumn[],
  queryGeneration: number,
): string {
  return clientProjectionPresentationKey(
    "grouped",
    columns,
    queryGeneration,
    0,
    undefined,
    undefined,
  );
}

const CLIENT_PROJECTION_COLUMN_AUTHORITIES = new WeakMap<readonly CompiledColumn[], number>();
const CLIENT_PROJECTION_ROWS_COLUMN_AUTHORITIES = new WeakMap<
  AstryxTableCompiledGroupRowsColumn,
  number
>();
let nextClientProjectionColumnAuthority = 0;
let nextClientProjectionRowsColumnAuthority = 0;

function createRowOrderChangeDetector(
  tableId: string,
  columns: readonly CompiledColumn[],
  filters: readonly unknown[],
  quickFilter: string,
  quickFilterFields: readonly string[],
  orderBy: ClientResolvedRowOrderProps["orderBy"],
  filterPlan: ClientFilterPlan | undefined,
  sortStability: ClientSortStability<AstryxTableClientAdmittedRow>,
): AstryxTableClientRowOrderChangeDetector {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) {
    recordAstryxTableClientRowOrderPlanning(tableId);
  }
  const { orderedColumns, filterPredicate } = createClientAdmittedQueryProjectionPlan(
    columns,
    filters,
    quickFilter,
    quickFilterFields,
    orderBy,
    filterPlan,
  );
  return (previousRows, nextRows, change) =>
    rowOrderChanged(previousRows, nextRows, change, orderedColumns, filterPredicate, sortStability);
}

function rowOrderChanged(
  previousRows: readonly AstryxTableClientAdmittedRow[],
  nextRows: readonly AstryxTableClientAdmittedRow[],
  change: Readonly<{
    readonly rowIdsChanged: boolean;
    readonly changedIndexes: readonly number[];
  }>,
  orderedColumns: readonly CompiledColumn[],
  filterPredicate: ((row: AstryxTableClientAdmittedRow) => boolean) | undefined,
  sortStability: ClientSortStability<AstryxTableClientAdmittedRow>,
): boolean {
  if (change.rowIdsChanged) return true;
  if (orderedColumns.length === 0 && filterPredicate === undefined) return false;
  for (const index of change.changedIndexes) {
    const previousRow = previousRows[index];
    const nextRow = nextRows[index];
    if (previousRow === undefined || nextRow === undefined) return true;
    if (filterPredicate !== undefined) {
      try {
        const previousIncluded = filterPredicate(previousRow);
        const nextIncluded = filterPredicate(nextRow);
        if (previousIncluded !== nextIncluded) return true;
        if (!nextIncluded) continue;
      } catch {
        return true;
      }
    }
    for (const column of orderedColumns) {
      const previousValue = previousRow.values.read(
        previousRow.raw,
        previousRow.rowId,
        previousRow.rowIndex,
        column,
      );
      const nextValue = nextRow.values.read(nextRow.raw, nextRow.rowId, nextRow.rowIndex, column);
      if (
        isAstryxTableInvalidCellValue(previousValue) ||
        isAstryxTableInvalidCellValue(nextValue)
      ) {
        return true;
      }
    }
    // Prior retained publications may have changed neighbours, even when this row
    // returns to its original value/reference. Validate every changed included row.
    if (orderedColumns.length > 0 && !sortStability.preserves(previousRows, nextRows, index))
      return true;
  }
  return false;
}

export class ClientRowOrderStore {
  private readonly listeners = new Set<() => void>();
  private rowIds: readonly string[];
  private snapshot: Readonly<{
    readonly rowSpace: AstryxTableLogicalRowSpace;
    readonly queryGeneration: number;
  }>;

  public constructor(initialRowIds: readonly string[], queryGeneration: number) {
    const rowIds = Object.freeze(Array.from(initialRowIds));
    this.rowIds = rowIds;
    this.snapshot = Object.freeze({
      rowSpace: createLogicalRowSpace(rowIds),
      queryGeneration,
    });
  }

  public readonly getSnapshot = (): typeof this.snapshot => this.snapshot;

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public readonly publish = (nextRowIds: readonly string[], queryGeneration: number): void => {
    const rowIdsUnchanged = sameRowIds(this.rowIds, nextRowIds);
    if (this.snapshot.queryGeneration === queryGeneration && rowIdsUnchanged) return;
    const rowIds = rowIdsUnchanged ? this.rowIds : Object.freeze(Array.from(nextRowIds));
    this.rowIds = rowIds;
    this.snapshot = Object.freeze({
      rowSpace: rowIdsUnchanged ? this.snapshot.rowSpace : createLogicalRowSpace(rowIds),
      queryGeneration,
    });
    notifyClientRowOrderListeners(this.listeners);
  };
}

function createLogicalRowSpace(rowIds: readonly string[]): AstryxTableLogicalRowSpace {
  const rowIndexById = new Map(rowIds.map((rowId, index) => [rowId, index]));
  const identitySnapshot = Object.freeze({ rowIds, rowIndexById });
  return Object.freeze({
    totalRows: rowIds.length,
    getRowId: (index: number) => rowIds[index],
    findRowIndex: (rowId: string) => rowIndexById.get(rowId),
    setRequiredRange: (_start: number, _end: number) => undefined,
    identitySnapshot,
  });
}

function notifyClientRowOrderListeners(listeners: ReadonlySet<() => void>): void {
  let firstError: unknown;
  let failed = false;
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      if (!failed) {
        firstError = error;
        failed = true;
      }
    }
  }
  if (failed) throw firstError;
}

function sameRowIds(previous: readonly string[], next: readonly string[]): boolean {
  return previous.length === next.length && previous.every((rowId, index) => rowId === next[index]);
}

const EMPTY_ROW_IDS: readonly never[] = Object.freeze([]);
