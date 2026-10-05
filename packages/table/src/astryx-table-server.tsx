import type { LiveQueryViewportBaseRow } from "effect-view-server/react/viewport-base-row";
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import type {
  AstryxTableColumns,
  AstryxTablePersistedState,
  AstryxTableServerProps,
} from "./public-types";
import { hasToolbarContent } from "./toolbar";
import { SourceBody } from "./internal/source-body";
import { SourceLifecycle } from "./internal/source-lifecycle-view";
import { SortControls } from "./internal/sort-controls";
import { ColumnManagement } from "./internal/column-settings";
import { GroupingControls } from "./internal/grouping-controls";
import { ClientContext } from "./internal/client-context";
import { createGridFilterCommands } from "./internal/filter-commands";
import { AstryxTableView, type AstryxTableRowPipelineSnapshot } from "./internal/astryx-table-view";
import { compileColumns, type CompiledColumn } from "./internal/compile-columns";
import { AstryxTableGridRuntime, type AstryxTableRuntimeView } from "./internal/grid-runtime";
import { AstryxTableServerRowPipeline } from "./internal/server-row-pipeline";
import {
  AstryxTableServerRowPipelineAdapter,
  type AstryxTableServerQueryInputs,
} from "./internal/server-source-adapter";
import { registerAstryxTableIdentity } from "./internal/table-identity-registry";
import { compileAstryxTableGroupRowsColumn } from "./internal/client-grouping-presentation";

const styles = stylex.create({
  root: { position: "relative" },
  body: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 36px", alignItems: "start" },
  rail: { gridColumn: 2, gridRow: 1, display: "flex", flexDirection: "column", gap: 4 },
  grid: { gridColumn: 1, gridRow: 1, minWidth: 0 },
});

/** The viewport source owns row identity, query generations and complete facet evidence. */
export function AstryxTableServer<
  TViewport,
  const TColumns extends AstryxTableColumns<LiveQueryViewportBaseRow<TViewport>>,
>(props: AstryxTableServerProps<LiveQueryViewportBaseRow<TViewport>, TColumns, TViewport>) {
  if (typeof props.tableId !== "string" || props.tableId.trim().length === 0)
    throw new TypeError("AstryxTable tableId must be a non-empty string.");
  return <ServerInstance key={props.tableId} props={props} />;
}

function ServerInstance<TRow, const TColumns extends AstryxTableColumns<TRow>, TViewport>({
  props,
}: {
  readonly props: AstryxTableServerProps<TRow, TColumns, TViewport>;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => compileColumns(props.columns), [props.columns]);
  const groupRowsColumn = useMemo(
    () => compileAstryxTableGroupRowsColumn(props.groupRowsColumn),
    [props.groupRowsColumn],
  );
  const [presentation] = useState(() => new PresentationColumnsInstaller());
  const [adapter] = useState(
    () =>
      new AstryxTableServerRowPipelineAdapter<TRow>(
        columns,
        props.quickFilterFields,
        props.initialFilters,
        props.initialOrderBy,
        props.viewportSource.completeRawSelect,
        groupRowsColumn,
      ),
  );
  const [runtime] = useState(() => {
    adapter.reconcileSource(props.viewportSource);
    const created = new AstryxTableGridRuntime(
      adapter.getPublication(),
      columns,
      adapter.getQueryConfiguration(),
      props.tableId,
      {
        initialPersistedState: props.initialPersistedState,
        grouping: true,
        groupRowsWidth: groupRowsColumn.width,
      },
    );
    const view = created.getView();
    const structure = view.getColumnStructureSnapshot();
    adapter.stageProjection(view.getQuerySnapshot(), {
      routeBy: props.routeBy,
      externalFilters: props.externalFilters,
      visibleColumnIds: structure.visibleColumnIds,
      presentationColumns: presentation.install(columns, structure.allColumns),
    });
    view.publishRowPipeline(adapter.getPublication());
    return created;
  });
  const [view] = useState(() => runtime.getView());
  const columnsRef = useRef(columns);
  const inputs = useRef<AstryxTableServerQueryInputs>({
    routeBy: props.routeBy,
    externalFilters: props.externalFilters,
    visibleColumnIds: view.getColumnStructureSnapshot().visibleColumnIds,
    presentationColumns: presentation.install(
      columns,
      view.getColumnStructureSnapshot().allColumns,
    ),
  });
  const staging = useRef(false);
  const context = useMemo(
    () => ({
      tableId: props.tableId,
      rows: undefined,
      resultRows: adapter,
      runtime: view,
      filterCommands: createGridFilterCommands(view),
    }),
    [props.tableId, adapter, view],
  );

  // Stage before synchronous reconciliation can notify query/column listeners.
  useLayoutEffect(() => {
    staging.current = true;
  }, [
    columns,
    groupRowsColumn,
    props.externalFilters,
    props.quickFilterFields,
    props.routeBy,
    props.viewportSource.completeRawSelect,
    props.viewportSource.viewport,
  ]);
  useLayoutEffect(
    () => adapter.subscribePublication(() => view.publishRowPipeline(adapter.getPublication())),
    [adapter, view],
  );
  useLayoutEffect(() => {
    adapter.reconcileSource(props.viewportSource);
  }, [adapter, props.viewportSource]);
  useLayoutEffect(() => {
    columnsRef.current = columns;
    stageSemanticQuery(staging, () => {
      const query = adapter.reconcileColumns(columns, props.quickFilterFields, groupRowsColumn);
      runtime.reconcile(adapter.getPublication(), columns, query, groupRowsColumn.width);
    });
    const structure = view.getColumnStructureSnapshot();
    inputs.current = Object.freeze({
      routeBy: props.routeBy,
      externalFilters: props.externalFilters,
      visibleColumnIds: structure.visibleColumnIds,
      presentationColumns: presentation.install(columns, structure.allColumns),
    });
    adapter.replace(props.viewportSource.viewport, view.getQuerySnapshot(), inputs.current, true);
  }, [
    columns,
    groupRowsColumn,
    props.externalFilters,
    props.quickFilterFields,
    props.routeBy,
    props.viewportSource.completeRawSelect,
    props.viewportSource.viewport,
    adapter,
    presentation,
    runtime,
    view,
  ]);
  useLayoutEffect(() => {
    const replace = (reset: boolean) => {
      if (staging.current) return;
      const structure = view.getColumnStructureSnapshot();
      inputs.current = Object.freeze({
        ...inputs.current,
        visibleColumnIds: structure.visibleColumnIds,
        presentationColumns: presentation.install(columnsRef.current, structure.allColumns),
      });
      adapter.replace(
        props.viewportSource.viewport,
        view.getQuerySnapshot(),
        inputs.current,
        reset,
      );
    };
    const query = view.subscribeQuery(() => replace(false));
    const structure = view.subscribeColumnStructure(() => replace(true));
    return () => {
      query();
      structure();
      adapter.release();
    };
  }, [props.viewportSource.viewport, adapter, presentation, view]);
  useLayoutEffect(() => {
    const notify = props.onPersistChange;
    runtime.setOnPersistChange(
      notify === undefined
        ? undefined
        : (state) => notify(state as AstryxTablePersistedState<TRow, TColumns, true>),
    );
  }, [props.onPersistChange, runtime]);
  useLayoutEffect(
    () =>
      __ASTRYX_TABLE_DEVELOPMENT__
        ? registerAstryxTableIdentity(props.tableId, columns)
        : undefined,
    [props.tableId, columns],
  );

  return (
    <ClientContext value={context}>
      <div
        ref={scope}
        {...stylex.props(styles.root)}
        data-astryx-table={props.tableId}
        role="region"
        aria-label={props.tableId}
        tabIndex={-1}
      >
        {!hasToolbarContent(props.children) ? null : (
          <Toolbar label={`${props.tableId} controls`} size="sm" startContent={props.children} />
        )}
        <GroupingControls runtime={view} scope={scope} />
        <SourceLifecycle runtime={view} scope={scope} />
        <div {...stylex.props(styles.body)}>
          <aside {...stylex.props(styles.rail)} aria-label={`${props.tableId} column management`}>
            <ColumnManagement runtime={view} columns={columns} />
            <SortControls runtime={view} columns={columns} />
          </aside>
          <div {...stylex.props(styles.grid)}>
            <SourceBody
              runtime={view}
              columns={columns}
              scope={scope}
              tableId={props.tableId}
              setRequiredRange={adapter.setRequiredRange}
            >
              {(showRows) => (
                <AstryxTableServerRowPipeline
                  runtime={view}
                  tableId={props.tableId}
                  columns={columns}
                  rowPipelineAdapter={adapter}
                >
                  {(snapshot) =>
                    showRows ? (
                      <ServerView runtime={view} tableId={props.tableId} snapshot={snapshot} />
                    ) : (
                      <></>
                    )
                  }
                </AstryxTableServerRowPipeline>
              )}
            </SourceBody>
          </div>
        </div>
      </div>
    </ClientContext>
  );
}

function ServerView({
  runtime,
  tableId,
  snapshot,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly tableId: string;
  readonly snapshot: AstryxTableRowPipelineSnapshot;
}) {
  const grouping = useSyncExternalStore(
    runtime.subscribeInstalledGroupingStructure,
    runtime.getInstalledGroupingStructureSnapshot,
    runtime.getInstalledGroupingStructureSnapshot,
  );
  const body = useSyncExternalStore(
    runtime.subscribeBody,
    runtime.getBodySnapshot,
    runtime.getBodySnapshot,
  );
  const rowSpace = snapshot.kind === "rows" ? snapshot.rowSpace : undefined;
  const grouped = grouping.groupBy.length > 0;
  const installedRowSpace = useMemo(
    () =>
      rowSpace === undefined || !grouped
        ? rowSpace
        : Object.freeze({
            ...rowSpace,
            missingRowIdentityBehavior: "fallback-to-display-index" as const,
          }),
    [rowSpace, grouped],
  );
  const installed =
    snapshot.kind === "rows" && installedRowSpace !== undefined
      ? {
          ...snapshot,
          columns: grouping.columns ?? snapshot.columns,
          rowSpace: installedRowSpace,
          ariaRowCount: body.kind === "rows" ? body.ariaRowCount : undefined,
        }
      : snapshot;
  return <AstryxTableView tableId={tableId} snapshot={installed} />;
}

// Preserve reference-source width installation without recompiling value semantics.
class PresentationColumnsInstaller {
  private sourceColumns: readonly CompiledColumn[] | undefined;
  private widths: readonly (number | undefined)[] | undefined;
  private installed: readonly CompiledColumn[] | undefined;
  public install(
    columns: readonly CompiledColumn[],
    layout: readonly CompiledColumn[],
  ): readonly CompiledColumn[] {
    const byId = new Map(layout.map((column) => [column.columnId, column]));
    const widths = columns.map((column) => byId.get(column.columnId)?.semantics.width);
    if (
      this.sourceColumns === columns &&
      this.widths?.length === widths.length &&
      widths.every((width, index) => Object.is(width, this.widths?.[index]))
    )
      return this.installed!;
    let changed = false;
    const installed = columns.map((column, index) => {
      const width = widths[index];
      if (width === undefined || width === column.semantics.width) return column;
      changed = true;
      return Object.freeze({ ...column, semantics: Object.freeze({ ...column.semantics, width }) });
    });
    this.sourceColumns = columns;
    this.widths = Object.freeze(widths);
    this.installed = changed ? Object.freeze(installed) : columns;
    return this.installed;
  }
}

function stageSemanticQuery(staging: { current: boolean }, reconcile: () => void): void {
  staging.current = true;
  try {
    reconcile();
  } finally {
    staging.current = false;
  }
}
