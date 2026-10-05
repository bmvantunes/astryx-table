import { AstryxTableRowSelectionRuntime } from "./internal/row-selection";
import { SourceBody } from "./internal/source-body";
import { SourceLifecycle } from "./internal/source-lifecycle-view";
import { GroupingControls } from "./internal/grouping-controls";
import { hasToolbarContent } from "./toolbar";
import { createGridFilterCommands } from "./internal/filter-commands";
import * as stylex from "@stylexjs/stylex";
import { SortControls } from "./internal/sort-controls";
import { ColumnManagement } from "./internal/column-settings";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  AstryxTableColumns,
  AstryxTableReadOnlyClientProps,
  AstryxTableJsonValue,
} from "./public-types";
import { compileColumns } from "./internal/compile-columns";
import { AstryxTableClientRowPipelineAdapter } from "./internal/client-source-adapter";
import { AstryxTableGridRuntime } from "./internal/grid-runtime";
import {
  AstryxTableClientProjectionStore,
  AstryxTableClientRowPipeline,
} from "./internal/client-row-pipeline";
import { compileAstryxTableGroupRowsColumn } from "./internal/client-grouping-presentation";
import { registerAstryxTableIdentity } from "./internal/table-identity-registry";
import { ClientContext } from "./internal/client-context";
import { AstryxTableView } from "./internal/astryx-table-view";

const styles = stylex.create({
  root: { position: "relative" },
  body: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 36px", alignItems: "start" },
  rail: { gridColumn: 2, gridRow: 1, display: "flex", flexDirection: "column", gap: 4 },
  grid: { gridColumn: 1, gridRow: 1, minWidth: 0 },
});

/** Read-only Client with optional identity-owned Row Selection. */
export type AstryxTableClientProps<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = AstryxTableReadOnlyClientProps<TRow, TColumns>;

export function AstryxTableClient<TRow, const TColumns extends AstryxTableColumns<TRow>>(
  props: AstryxTableClientProps<TRow, TColumns>,
) {
  if (typeof props.tableId !== "string" || props.tableId.trim().length === 0) {
    throw new TypeError("AstryxTable tableId must be a non-empty string.");
  }
  if (props.rowSelection !== undefined && props.rowSelection !== true) {
    throw new TypeError("AstryxTable rowSelection must be true or omitted.");
  }
  if (props.editable) {
    throw new TypeError("Editing is not available in this Client slice (issues #11–#12).");
  }
  return <AstryxTableClientInstance key={props.tableId} {...props} />;
}

function AstryxTableClientInstance<TRow, const TColumns extends AstryxTableColumns<TRow>>(
  props: AstryxTableClientProps<TRow, TColumns>,
) {
  const scope = useRef<HTMLDivElement>(null);
  const [selectionRuntime] = useState(() => new AstryxTableRowSelectionRuntime([]));
  const rowSelection = props.rowSelection === true ? selectionRuntime : undefined;
  const previouslyEnabled = useRef(props.rowSelection === true);
  const columns = useMemo(() => compileColumns(props.columns), [props.columns]);
  const groupRowsColumn = useMemo(
    () => compileAstryxTableGroupRowsColumn(props.groupRowsColumn),
    [props.groupRowsColumn],
  );
  const [adapter] = useState(
    () =>
      new AstryxTableClientRowPipelineAdapter(
        props.clientSource,
        props.getRowId,
        columns,
        props.initialFilters,
        props.initialOrderBy,
        props.quickFilterFields,
        groupRowsColumn,
      ),
  );
  const [runtime] = useState(() => {
    const instance = new AstryxTableGridRuntime(
      adapter.getPublication(),
      columns,
      adapter.getQueryConfiguration(columns),
      props.tableId,
      {
        initialPersistedState: props.initialPersistedState,
        grouping: true,
        groupRowsWidth: groupRowsColumn.width,
        beforeGroupingChange: (entering) => {
          if (entering) selectionRuntime.enterGroupedProjection();
        },
      },
    );
    return instance;
  });
  const [view] = useState(() => runtime.getView());
  const clientContext = useMemo(
    () => ({
      tableId: props.tableId,
      rows: adapter,
      resultRows: adapter,
      runtime: view,
      filterCommands: createGridFilterCommands(view),
    }),
    [adapter, view, props.tableId],
  );
  const [projection] = useState(
    () => new AstryxTableClientProjectionStore(view, adapter, rowSelection),
  );
  useLayoutEffect(() => projection.setRowSelection(rowSelection), [projection, rowSelection]);
  useLayoutEffect(() => projection.activate(), [projection]);
  useLayoutEffect(() => {
    const enabled = rowSelection !== undefined;
    if (previouslyEnabled.current && !enabled) selectionRuntime.enterGroupedProjection();
    else if (!previouslyEnabled.current && enabled && runtime.getGroupBySnapshot().length === 0) {
      const source = adapter.getProjectionInputSnapshot().sourceRowIds;
      selectionRuntime.leaveGroupedProjection(source.authoritative ? source.rowIds : []);
    }
    previouslyEnabled.current = enabled;
  }, [adapter, rowSelection, runtime, selectionRuntime]);
  useLayoutEffect(() => {
    const publication = adapter.reconcile(
      props.clientSource,
      props.getRowId,
      columns,
      groupRowsColumn,
    );
    const query = adapter.getQueryConfiguration(columns);
    const installed = runtime.getInstalledClientProjectionSnapshot();
    const grouped =
      runtime.getQuerySnapshot().groupBy.length > 0 ||
      installed?.kind === "grouped" ||
      installed?.kind === "invalid";
    adapter.publishProjectionInput(columns, query, grouped);
    if (!grouped) runtime.reconcile(publication, columns, query, groupRowsColumn.width);
  }, [adapter, columns, groupRowsColumn, props.clientSource, props.getRowId, runtime]);
  useLayoutEffect(() => {
    runtime.setOnPersistChange(
      props.onPersistChange as
        | ((state: Readonly<Record<string, AstryxTableJsonValue>>) => void)
        | undefined,
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
    <ClientContext value={clientContext}>
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
              rowSelection={rowSelection !== undefined}
              runtime={view}
              columns={columns}
              scope={scope}
              tableId={props.tableId}
            >
              {(showRows) => (
                <AstryxTableClientRowPipeline
                  runtime={view}
                  tableId={props.tableId}
                  columns={columns}
                  rowPipelineAdapter={adapter}
                  rowSelection={rowSelection}
                >
                  {(snapshot) =>
                    showRows ? (
                      <AstryxTableView
                        tableId={props.tableId}
                        snapshot={snapshot}
                        rowSelection={rowSelection}
                      />
                    ) : (
                      <></>
                    )
                  }
                </AstryxTableClientRowPipeline>
              )}
            </SourceBody>
          </div>
        </div>
      </div>
    </ClientContext>
  );
}
