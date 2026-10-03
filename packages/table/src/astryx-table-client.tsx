import { useLayoutEffect, useMemo, useState } from "react";
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
import { recordAstryxTableClientViewRender } from "./internal/render-instrumentation";
import { AstryxTableView } from "./internal/astryx-table-view";

/** Current private read-only slice. Selection and grouping configuration arrive in #13/#7. */
export type AstryxTableClientProps<TRow, TColumns extends AstryxTableColumns<TRow>> = Omit<
  AstryxTableReadOnlyClientProps<TRow, TColumns>,
  "rowSelection" | "groupRowsColumn"
> & {
  readonly rowSelection?: never;
  readonly groupRowsColumn?: never;
};

export function AstryxTableClient<TRow, const TColumns extends AstryxTableColumns<TRow>>(
  props: AstryxTableClientProps<TRow, TColumns>,
) {
  if (typeof props.tableId !== "string" || props.tableId.trim().length === 0) {
    throw new TypeError("AstryxTable tableId must be a non-empty string.");
  }
  if (props.rowSelection !== undefined) {
    throw new TypeError("Row Selection is not available in this Client slice (issue #13).");
  }
  if (props.groupRowsColumn !== undefined) {
    throw new TypeError("Grouping is not available in this Client slice (issue #7).");
  }
  if (props.editable) {
    throw new TypeError("Editing is not available in this Client slice (issues #11–#12).");
  }
  if (
    props.columns.some(
      (column) => "pinned" in column && (column.pinned === "start" || column.pinned === "end"),
    )
  ) {
    throw new TypeError("Column pinning is not available in this Client slice (issue #4).");
  }
  return <AstryxTableClientInstance key={props.tableId} {...props} />;
}

function AstryxTableClientInstance<TRow, const TColumns extends AstryxTableColumns<TRow>>(
  props: AstryxTableClientProps<TRow, TColumns>,
) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableClientViewRender(props.tableId);
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
      },
    );
    // Inspect the core's sanitized preferences rather than duplicating its version/identity policy.
    if (
      instance.getColumnLayoutSnapshot().allColumns.some((column) => column.pinned !== undefined)
    ) {
      throw new TypeError("Column pinning is not available in this Client slice (issue #4).");
    }
    if (instance.getQuerySnapshot().groupBy.length > 0) {
      throw new TypeError("Grouping is not available in this Client slice (issue #7).");
    }
    return instance;
  });
  const [view] = useState(() => runtime.getView());
  const [projection] = useState(
    () => new AstryxTableClientProjectionStore(view, adapter, undefined),
  );
  useLayoutEffect(() => projection.activate(), [projection]);
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
    <>
      {props.children}
      <AstryxTableClientRowPipeline
        runtime={view}
        tableId={props.tableId}
        columns={columns}
        rowPipelineAdapter={adapter}
      >
        {(snapshot) => <AstryxTableView tableId={props.tableId} snapshot={snapshot} />}
      </AstryxTableClientRowPipeline>
    </>
  );
}
