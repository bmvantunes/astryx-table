import type { LiveQueryViewportBaseRow } from "effect-view-server/react/viewport-base-row";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ReactNode } from "react";
import type {
  AstryxTableColumns,
  AstryxTablePersistedState,
  AstryxTableServerProps,
} from "./public-types";
import {
  AstryxTableToolbar,
  AstryxTableToolbarStore,
  AstryxTableView,
} from "./internal/astryx-table-view";
import {
  AstryxTableActiveFilters,
  AstryxTableClientFilterProvider,
  AstryxTableQuickFilter,
  renderAstryxTableServerColumnFilter,
} from "./internal/client-filter-controls";
import { compileColumns, type CompiledColumn } from "./internal/compile-columns";
import { AstryxTableGridRuntime } from "./internal/grid-runtime";
import { AstryxTableServerRowPipeline } from "./internal/server-row-pipeline";
import {
  AstryxTableServerFacetProvider,
  AstryxTableServerFacetRuntime,
} from "./internal/server-facet";
import {
  AstryxTableServerRowPipelineAdapter,
  type AstryxTableServerQueryInputs,
} from "./internal/server-source-adapter";
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
import { snapshotAstryxTableQuickFilterFields } from "./internal/quick-filter";
import { useAstryxTableServerFacetHookSource } from "./internal/react-compiler-adapters";
import { compileAstryxTableGroupRowsColumn } from "./internal/client-grouping-presentation";
import { AstryxTableClientGroupBy } from "./internal/client-grouping-controls";

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

export function AstryxTableServer<
  TViewport,
  const TColumns extends AstryxTableColumns<LiveQueryViewportBaseRow<TViewport>>,
>(
  props: AstryxTableServerProps<LiveQueryViewportBaseRow<TViewport>, TColumns, TViewport>,
): ReactNode {
  const tableId = requireAstryxTableId(props.tableId);
  return <AstryxTableServerInstance key={tableId} props={props} tableId={tableId} />;
}

function AstryxTableServerInstance<TRow, const TColumns extends AstryxTableColumns<TRow>, TViewport>({
  props,
  tableId,
}: Readonly<{
  readonly props: AstryxTableServerProps<TRow, TColumns, TViewport>;
  readonly tableId: string;
}>): ReactNode {
  const compiledColumns = useMemo(() => compileColumns(props.columns), [props.columns]);
  const groupRowsColumn = useMemo(
    () => compileAstryxTableGroupRowsColumn(props.groupRowsColumn),
    [props.groupRowsColumn],
  );
  const [presentationColumnsInstaller] = useState(
    () => new AstryxTableServerPresentationColumnsInstaller(),
  );
  const [rowPipelineAdapter] = useState(
    () =>
      new AstryxTableServerRowPipelineAdapter<TRow>(
        compiledColumns,
        props.quickFilterFields,
        props.initialFilters,
        props.initialOrderBy,
        props.viewportSource.completeRawSelect,
        groupRowsColumn,
      ),
  );
  const [runtime] = useState(() => {
    rowPipelineAdapter.reconcileSource(props.viewportSource);
    const created = new AstryxTableGridRuntime(
      rowPipelineAdapter.getPublication(),
      compiledColumns,
      rowPipelineAdapter.getQueryConfiguration(),
      tableId,
      {
        initialPersistedState: props.initialPersistedState,
        grouping: true,
        groupRowsWidth: groupRowsColumn.width,
      },
    );
    const createdView = created.getView();
    const initialColumnStructure = createdView.getColumnStructureSnapshot();
    rowPipelineAdapter.stageProjection(createdView.getQuerySnapshot(), {
      routeBy: props.routeBy,
      externalFilters: props.externalFilters,
      visibleColumnIds: initialColumnStructure.visibleColumnIds,
      presentationColumns: presentationColumnsInstaller.install(
        compiledColumns,
        initialColumnStructure.allColumns,
      ),
    });
    createdView.publishRowPipeline(rowPipelineAdapter.getPublication());
    if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) {
      recordAstryxTableToolbarLifetime({ tableId, kind: "runtime-create", identity: created });
    }
    return created;
  });
  const [toolbar] = useState(() => new AstryxTableToolbarStore(props.children));
  const runtimeView = runtime.getView();
  const compiledColumnsRef = useRef(compiledColumns);
  const queryInputsRef = useRef<AstryxTableServerQueryInputs>({
    routeBy: props.routeBy,
    externalFilters: props.externalFilters,
    visibleColumnIds: runtimeView.getColumnStructureSnapshot().visibleColumnIds,
    presentationColumns: presentationColumnsInstaller.install(
      compiledColumns,
      runtimeView.getColumnStructureSnapshot().allColumns,
    ),
  });
  const stagingSemanticQueryRef = useRef(false);
  const gridOwnedControls = useMemo(
    () => (
      <>
        <AstryxTableClientGroupBy columns={compiledColumns} runtime={runtimeView} />
        <AstryxTableActiveFilters />
      </>
    ),
    [compiledColumns, runtimeView],
  );
  const quickFilterFields = useMemo(
    () => snapshotAstryxTableQuickFilterFields(props.quickFilterFields),
    [props.quickFilterFields],
  );
  const facetSource = useAstryxTableServerFacetHookSource(props.viewportSource);
  const facetInputsRef = useRef({
    externalFilters: props.externalFilters,
    quickFilterFields,
    routeBy: props.routeBy,
    source: facetSource,
  });
  const [facetRuntime] = useState(
    () =>
      new AstryxTableServerFacetRuntime({
        externalFilters: props.externalFilters,
        quickFilterFields,
        querySnapshot: runtimeView.getQuerySnapshot(),
        routeBy: props.routeBy,
        runtime: runtimeView,
        source: facetSource,
        transportIdentity: props.viewportSource.viewport,
      }),
  );

  // This declaration must precede the reconciliation effect with the same semantic dependency
  // superset so React stages the query before synchronous column/runtime publications can fire.
  useLayoutEffect(() => {
    stagingSemanticQueryRef.current = true;
  }, [
    compiledColumns,
    props.externalFilters,
    props.quickFilterFields,
    props.routeBy,
    props.viewportSource.completeRawSelect,
    props.viewportSource.viewport,
    facetSource,
  ]);

  useLayoutEffect(() => {
    const unsubscribe = rowPipelineAdapter.subscribePublication(() => {
      runtimeView.publishRowPipeline(rowPipelineAdapter.getPublication());
    });
    return unsubscribe;
  }, [rowPipelineAdapter, runtimeView]);

  useLayoutEffect(() => {
    rowPipelineAdapter.reconcileSource(props.viewportSource);
  }, [props.viewportSource, rowPipelineAdapter]);

  useLayoutEffect(() => {
    compiledColumnsRef.current = compiledColumns;
    stageAstryxTableServerSemanticQuery(stagingSemanticQueryRef, () => {
      const queryConfiguration = rowPipelineAdapter.reconcileColumns(
        compiledColumns,
        props.quickFilterFields,
        groupRowsColumn,
      );
      runtime.reconcile(
        rowPipelineAdapter.getPublication(),
        compiledColumns,
        queryConfiguration,
        groupRowsColumn.width,
      );
    });
    const queryInputs = Object.freeze({
      routeBy: props.routeBy,
      externalFilters: props.externalFilters,
      visibleColumnIds: runtimeView.getColumnStructureSnapshot().visibleColumnIds,
      presentationColumns: presentationColumnsInstaller.install(
        compiledColumns,
        runtimeView.getColumnStructureSnapshot().allColumns,
      ),
    });
    queryInputsRef.current = queryInputs;
    facetInputsRef.current = {
      externalFilters: props.externalFilters,
      quickFilterFields,
      routeBy: props.routeBy,
      source: facetSource,
    };
    rowPipelineAdapter.replace(
      props.viewportSource.viewport,
      runtimeView.getQuerySnapshot(),
      queryInputs,
      true,
    );
    facetRuntime.reconcile({
      ...facetInputsRef.current,
      querySnapshot: runtimeView.getQuerySnapshot(),
      runtime: runtimeView,
      transportIdentity: props.viewportSource.viewport,
    });
  }, [
    compiledColumns,
    groupRowsColumn,
    facetSource,
    facetRuntime,
    props.externalFilters,
    props.quickFilterFields,
    props.routeBy,
    props.viewportSource.completeRawSelect,
    props.viewportSource.viewport,
    quickFilterFields,
    rowPipelineAdapter,
    presentationColumnsInstaller,
    runtime,
    runtimeView,
  ]);

  useLayoutEffect(() => {
    const replace = (resetWhenInputsChange: boolean) => {
      if (stagingSemanticQueryRef.current) return;
      const query = runtimeView.getQuerySnapshot();
      const queryInputs = Object.freeze({
        ...queryInputsRef.current,
        visibleColumnIds: runtimeView.getColumnStructureSnapshot().visibleColumnIds,
        presentationColumns: presentationColumnsInstaller.install(
          compiledColumnsRef.current,
          runtimeView.getColumnStructureSnapshot().allColumns,
        ),
      });
      queryInputsRef.current = queryInputs;
      rowPipelineAdapter.replace(
        props.viewportSource.viewport,
        query,
        queryInputs,
        resetWhenInputsChange,
      );
      facetRuntime.reconcile({
        ...facetInputsRef.current,
        querySnapshot: query,
        runtime: runtimeView,
        transportIdentity: props.viewportSource.viewport,
      });
    };
    const unsubscribeQuery = runtimeView.subscribeQuery(() => replace(false));
    const unsubscribeColumnStructure = runtimeView.subscribeColumnStructure(() => replace(true));
    return () => {
      unsubscribeQuery();
      unsubscribeColumnStructure();
      rowPipelineAdapter.release();
    };
  }, [
    facetRuntime,
    presentationColumnsInstaller,
    props.viewportSource.viewport,
    rowPipelineAdapter,
    runtimeView,
  ]);

  useLayoutEffect(() => {
    const notify = props.onPersistChange;
    runtime.setOnPersistChange(
      notify === undefined
        ? undefined
        : (state) => notify(state as AstryxTablePersistedState<TRow, TColumns, true>),
    );
  }, [props.onPersistChange, runtime]);

  useLayoutEffect(() => toolbar.publish(props.children), [props.children, toolbar]);

  useLayoutEffect(
    () =>
      __ASTRYX_TABLE_DEVELOPMENT__
        ? registerAstryxTableIdentity(tableId, compiledColumns)
        : undefined,
    [compiledColumns, tableId],
  );

  return (
    <AstryxTableServerFacetProvider runtime={facetRuntime}>
      <AstryxTableClientFilterProvider runtime={runtimeView}>
        <AstryxTableToolbarProvider
          columns={compiledColumns}
          resultRows={rowPipelineAdapter}
          runtime={runtimeView}
          tableId={tableId}
        >
          <AstryxTableView
            runtime={runtimeView}
            tableId={tableId}
            compiledColumns={compiledColumns}
            toolbar={toolbar}
            rowPipeline={AstryxTableServerRowPipeline}
            rowPipelineAdapter={rowPipelineAdapter}
            renderColumnFilter={renderAstryxTableServerColumnFilter}
            enableActiveCellCopy
            gridOwnedControls={gridOwnedControls}
          />
        </AstryxTableToolbarProvider>
      </AstryxTableClientFilterProvider>
    </AstryxTableServerFacetProvider>
  );
}

function stageAstryxTableServerSemanticQuery(
  staging: { current: boolean },
  reconcile: () => void,
): void {
  staging.current = true;
  try {
    reconcile();
  } finally {
    staging.current = false;
  }
}

export class AstryxTableServerPresentationColumnsInstaller {
  private sourceColumns: readonly CompiledColumn[] | undefined;
  private widths: readonly (number | undefined)[] | undefined;
  private installed: readonly CompiledColumn[] | undefined;

  public install(
    columns: readonly CompiledColumn[],
    layoutColumns: readonly CompiledColumn[],
  ): readonly CompiledColumn[] {
    const layoutById = new Map(layoutColumns.map((column) => [column.columnId, column]));
    const widths = columns.map((column) => layoutById.get(column.columnId)?.semantics.width);
    if (
      this.sourceColumns === columns &&
      this.widths?.length === widths.length &&
      widths.every((width, index) => Object.is(width, this.widths?.[index]))
    ) {
      return this.installed!;
    }
    let changed = false;
    const installed = columns.map((column, index) => {
      const width = widths[index];
      if (width === undefined || width === column.semantics.width) return column;
      changed = true;
      return Object.freeze({
        ...column,
        semantics: Object.freeze({ ...column.semantics, width }),
      });
    });
    this.sourceColumns = columns;
    this.widths = Object.freeze(widths);
    this.installed = changed ? Object.freeze(installed) : columns;
    return this.installed;
  }
}

function requireAstryxTableId(tableId: unknown): string {
  if (typeof tableId !== "string" || tableId.trim().length === 0) {
    throw new TypeError("AstryxTable tableId must be a non-empty string.");
  }
  return tableId;
}
