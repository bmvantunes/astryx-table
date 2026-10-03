import {
  createContext,
  memo,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { NamedExoticComponent, ReactElement, ReactNode } from "react";
import type {
  AstryxTableColumns,
  AstryxTableFilterExpression,
  AstryxTableFilterableColumnId,
} from "../public-types";
import type { CompiledColumn } from "./compile-columns";
import type {
  AstryxTableQuerySnapshot,
  AstryxTableRowPipelineRuntimeView,
  AstryxTableRowSpaceSnapshot,
  AstryxTableRuntimeView,
} from "./grid-runtime";
import { compileClientFilterCollection } from "./grid-query";
import {
  recordAstryxTableToolbarLifetime,
  recordAstryxTableToolbarSubscription,
  type AstryxTableToolbarProjection,
} from "./toolbar-instrumentation";

type AstryxTableResultRowCountSource = Readonly<{
  readonly getResultRowCountSnapshot: () => number;
  readonly subscribeResultRowCount: (listener: () => void) => () => void;
}>;

type AstryxTableInitializableResultRowCountSource = AstryxTableResultRowCountSource &
  Readonly<{
    readonly initializeResultRowCount: (
      query: AstryxTableQuerySnapshot,
      rowSpace: AstryxTableRowSpaceSnapshot<unknown> | undefined,
    ) => boolean;
  }>;

type AstryxTableToolbarGridFilterCommands = Readonly<{
  readonly replace: (filter: unknown) => boolean;
  readonly clear: (columnId: string) => boolean;
  readonly reset: (columnId: string) => boolean;
  readonly clearAll: () => boolean;
}>;

type AstryxTableToolbarCapabilityContextValue = Readonly<{
  readonly runtime: AstryxTableRuntimeView;
  readonly resultRows: AstryxTableResultRowCountSource;
  readonly commands: AstryxTableToolbarGridFilterCommands;
  readonly subscribe: (
    projection: AstryxTableToolbarProjection,
    source: (listener: () => void) => () => void,
    listener: () => void,
  ) => () => void;
}>;

const AstryxTableToolbarCapabilityContext = createContext<
  AstryxTableToolbarCapabilityContextValue | undefined
>(undefined);

export type AstryxTableGridFilterCommandCapability<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = Readonly<{
  readonly replace: (filter: AstryxTableFilterExpression<TRow, TColumns>) => boolean;
  readonly clear: (columnId: AstryxTableFilterableColumnId<TColumns>) => boolean;
  readonly reset: (columnId: AstryxTableFilterableColumnId<TColumns>) => boolean;
  readonly clearAll: () => boolean;
}>;

export type AstryxTableFilterControlProps<TRow, TColumns extends AstryxTableColumns<TRow>> =
  | Readonly<{
      readonly ownership: "grid";
      readonly children: (
        commands: AstryxTableGridFilterCommandCapability<TRow, TColumns>,
      ) => ReactNode;
    }>
  | Readonly<{
      readonly ownership: "external";
      readonly children: ReactNode;
    }>;

export function AstryxTableToolbarProvider({
  columns,
  runtime,
  resultRows,
  tableId,
  children,
}: Readonly<{
  readonly columns: readonly CompiledColumn[];
  readonly runtime: AstryxTableRowPipelineRuntimeView;
  readonly resultRows: AstryxTableInitializableResultRowCountSource;
  readonly tableId: string;
  readonly children: ReactNode;
}>): ReactElement {
  const [filterCommands] = useState(() => createToolbarGridFilterCommands(runtime, columns));
  useLayoutEffect(() => filterCommands.reconcile(columns), [columns, filterCommands]);
  const value = useMemo<AstryxTableToolbarCapabilityContextValue>(() => {
    const subscribe: AstryxTableToolbarCapabilityContextValue["subscribe"] = (
      projection,
      source,
      listener,
    ) => {
      if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) {
        recordAstryxTableToolbarSubscription({ tableId, projection, phase: "subscribe" });
      }
      const unsubscribe = source(() => {
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) {
          recordAstryxTableToolbarSubscription({ tableId, projection, phase: "notify" });
        }
        listener();
      });
      return () => {
        unsubscribe();
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) {
          recordAstryxTableToolbarSubscription({ tableId, projection, phase: "unsubscribe" });
        }
      };
    };
    const projectedResultRows = Object.freeze({
      getResultRowCountSnapshot: () => {
        if (
          resultRows.initializeResultRowCount(
            runtime.getQuerySnapshot(),
            runtime.getRowSpaceSnapshot(),
          )
        ) {
          if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) {
            recordAstryxTableToolbarLifetime({
              tableId,
              kind: "result-row-count-initialize",
              identity: resultRows,
            });
          }
        }
        return resultRows.getResultRowCountSnapshot();
      },
      subscribeResultRowCount: resultRows.subscribeResultRowCount,
    });
    return Object.freeze({
      runtime,
      resultRows: projectedResultRows,
      commands: filterCommands.commands,
      subscribe,
    });
  }, [filterCommands, resultRows, runtime, tableId]);
  return (
    <AstryxTableToolbarCapabilityContext.Provider value={value}>
      {children}
    </AstryxTableToolbarCapabilityContext.Provider>
  );
}

function createToolbarGridFilterCommands(
  runtime: AstryxTableRowPipelineRuntimeView,
  initialColumns: readonly CompiledColumn[],
): Readonly<{
  readonly commands: AstryxTableToolbarGridFilterCommands;
  readonly reconcile: (columns: readonly CompiledColumn[]) => void;
}> {
  let columns = initialColumns;
  let filterableColumnIds = compileFilterableColumnIds(columns);
  const commands = Object.freeze({
    replace: (filter: unknown) => {
      let admitted: ReturnType<typeof compileClientFilterCollection>;
      try {
        admitted = compileClientFilterCollection([filter], columns);
      } catch {
        return false;
      }
      if (admitted.columnIds.size !== 1 || admitted.filters.length !== 1) return false;
      const columnId = admitted.columnIds.values().next().value;
      const admittedFilter = admitted.filters[0];
      return (
        columnId !== undefined &&
        admittedFilter !== undefined &&
        runtime.dispatchGridCommand({
          type: "column.filter.replace",
          columnId,
          filter: admittedFilter,
        })
      );
    },
    clear: (columnId: string) =>
      filterableColumnIds.has(columnId) &&
      runtime.dispatchGridCommand({ type: "column.filter.clear", columnId }),
    reset: (columnId: string) =>
      filterableColumnIds.has(columnId) &&
      runtime.dispatchGridCommand({ type: "column.filter.reset", columnId }),
    clearAll: () => runtime.dispatchGridCommand({ type: "column.filters.clear" }),
  });
  return Object.freeze({
    commands,
    reconcile: (nextColumns: readonly CompiledColumn[]) => {
      if (columns === nextColumns) return;
      columns = nextColumns;
      filterableColumnIds = compileFilterableColumnIds(nextColumns);
    },
  });
}

function compileFilterableColumnIds(columns: readonly CompiledColumn[]): ReadonlySet<string> {
  return new Set(columns.filter((column) => column.enableFilter).map((column) => column.columnId));
}

export function AstryxTableFilterControl<TRow, const TColumns extends AstryxTableColumns<TRow>>(
  props: AstryxTableFilterControlProps<TRow, TColumns>,
): ReactNode {
  return props.ownership === "external" ? (
    props.children
  ) : (
    <AstryxTableGridFilterControl>{props.children}</AstryxTableGridFilterControl>
  );
}

function AstryxTableGridFilterControl<TRow, TColumns extends AstryxTableColumns<TRow>>({
  children,
}: Readonly<{
  readonly children: (commands: AstryxTableGridFilterCommandCapability<TRow, TColumns>) => ReactNode;
}>): ReactNode {
  const { commands } = useAstryxTableToolbarCapabilities();
  return children(commands as AstryxTableGridFilterCommandCapability<TRow, TColumns>);
}

type AstryxTableCountProps = Readonly<{
  readonly children?: ((count: number) => ReactNode) | undefined;
}>;

export const AstryxTableResultRowCount: NamedExoticComponent<AstryxTableCountProps> = memo(
  function AstryxTableResultRowCount({ children }: AstryxTableCountProps): ReactElement {
    const { resultRows, subscribe } = useAstryxTableToolbarCapabilities();
    const subscribeResultRows = useMemo(
      () => (listener: () => void) =>
        subscribe("result-row-count", resultRows.subscribeResultRowCount, listener),
      [resultRows, subscribe],
    );
    const count = useSyncExternalStore(
      subscribeResultRows,
      resultRows.getResultRowCountSnapshot,
      resultRows.getResultRowCountSnapshot,
    );
    return renderCount("Result rows", "result row", count, children);
  },
);

export const AstryxTableLoadedRowCount: NamedExoticComponent<AstryxTableCountProps> = memo(
  function AstryxTableLoadedRowCount({ children }: AstryxTableCountProps): ReactElement {
    const { runtime, subscribe } = useAstryxTableToolbarCapabilities();
    const subscribeLoadedRows = useMemo(
      () => (listener: () => void) =>
        subscribe("loaded-row-count", runtime.subscribeLoadedRowCount, listener),
      [runtime, subscribe],
    );
    const count = useSyncExternalStore(
      subscribeLoadedRows,
      runtime.getLoadedRowCountSnapshot,
      runtime.getLoadedRowCountSnapshot,
    );
    return renderCount("Loaded rows", "loaded row", count, children);
  },
);

export const AstryxTableActiveFilterCount: NamedExoticComponent<AstryxTableCountProps> = memo(
  function AstryxTableActiveFilterCount({ children }: AstryxTableCountProps): ReactElement {
    const { runtime, subscribe } = useAstryxTableToolbarCapabilities();
    const subscribeActiveFilters = useMemo(
      () => (listener: () => void) =>
        subscribe("active-filter-count", runtime.subscribeActiveFilterCount, listener),
      [runtime, subscribe],
    );
    const count = useSyncExternalStore(
      subscribeActiveFilters,
      runtime.getActiveFilterCountSnapshot,
      runtime.getActiveFilterCountSnapshot,
    );
    return renderCount("Active filters", "active filter", count, children);
  },
);

export const AstryxTableActiveSortCount: NamedExoticComponent<AstryxTableCountProps> = memo(
  function AstryxTableActiveSortCount({ children }: AstryxTableCountProps): ReactElement {
    const { runtime, subscribe } = useAstryxTableToolbarCapabilities();
    const subscribeActiveSorts = useMemo(
      () => (listener: () => void) =>
        subscribe("active-sort-count", runtime.subscribeActiveSortCount, listener),
      [runtime, subscribe],
    );
    const count = useSyncExternalStore(
      subscribeActiveSorts,
      runtime.getActiveSortCountSnapshot,
      runtime.getActiveSortCountSnapshot,
    );
    return renderCount("Active sorts", "active sort", count, children);
  },
);

export function AstryxTableToolbarSpacer(): ReactElement {
  return <span aria-hidden="true" className="min-w-2 flex-1" />;
}

function renderCount(
  label: string,
  singularLabel: string,
  count: number,
  children: ((count: number) => ReactNode) | undefined,
): ReactElement {
  return (
    <output aria-label={label} className="text-muted-foreground text-sm tabular-nums" role="status">
      {children === undefined
        ? `${String(count)} ${count === 1 ? singularLabel : label.toLowerCase()}`
        : children(count)}
    </output>
  );
}

function useAstryxTableToolbarCapabilities(): AstryxTableToolbarCapabilityContextValue {
  const context = useContext(AstryxTableToolbarCapabilityContext);
  if (context === undefined) {
    throw new TypeError(
      "AstryxTable toolbar controls must be composed inside a AstryxTable variant.",
    );
  }
  return context;
}
