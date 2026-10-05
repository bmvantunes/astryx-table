import {
  createContext,
  useCallback,
  memo,
  useContext,
  useMemo,
  useSyncExternalStore,
  type NamedExoticComponent,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  createAstryxTableServerFacetSnapshot,
  applyAstryxTableSetFilterCommand,
  readAstryxTableSetFilterIntent,
  type AstryxTableSetFilterCommand,
} from "./client-facet";
import { SetFilterView } from "./set-filter-view";
import type { CompiledColumn } from "./compile-columns";
import type { AstryxTableQuerySnapshot, AstryxTableRowPipelineRuntimeView } from "./grid-runtime";
import {
  compileAstryxTableServerFacetQuery,
  selectAstryxTableServerFacetGridFilters,
  type AstryxTableCompiledServerFacetQuery,
  type AstryxTableCompiledServerFacetQueryPlan,
} from "./server-query";
import { snapshotAstryxTableSourceMessage } from "./source-lifecycle";

type AstryxTableSetFilterFacetProps = Readonly<{ readonly column: CompiledColumn }>;

type AstryxTableServerWholeResult = Readonly<{
  readonly rows: readonly unknown[];
  readonly status: "loading" | "ready" | "stale" | "closed" | "error";
  readonly message?: string | undefined;
}>;

type AstryxTableServerFacetContextValue = Readonly<{
  readonly getFacetPlan: (
    snapshot: AstryxTableServerFacetSemanticSnapshot,
    columnId: string,
  ) => AstryxTableCompiledServerFacetQueryPlan;
  readonly getSnapshot: () => AstryxTableServerFacetSemanticSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
}>;

export type AstryxTableServerFacetSemanticSnapshot = Readonly<{
  readonly externalFilters: readonly unknown[] | undefined;
  readonly quickFilterFields: readonly string[];
  readonly querySnapshot: AstryxTableQuerySnapshot;
  readonly routeBy: Readonly<Record<string, unknown>> | undefined;
  readonly runtime: AstryxTableRowPipelineRuntimeView;
  readonly source: unknown;
  readonly transportIdentity: unknown;
}>;

export class AstryxTableServerFacetRuntime {
  readonly #listeners = new Set<() => void>();
  readonly #plans = new Map<string, StableFacetPlan>();
  #snapshot: AstryxTableServerFacetSemanticSnapshot;

  public constructor(snapshot: AstryxTableServerFacetSemanticSnapshot) {
    this.#snapshot = Object.freeze(snapshot);
  }

  public readonly getSnapshot = (): AstryxTableServerFacetSemanticSnapshot => this.#snapshot;

  public readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  public readonly getFacetPlan = (
    snapshot: AstryxTableServerFacetSemanticSnapshot,
    columnId: string,
  ): AstryxTableCompiledServerFacetQueryPlan => {
    const filters = selectAstryxTableServerFacetGridFilters(
      snapshot.querySnapshot.filters,
      columnId,
    );
    const cached = this.#plans.get(columnId);
    if (
      cached !== undefined &&
      Object.is(cached.columns, snapshot.querySnapshot.columns) &&
      Object.is(cached.routeBy, snapshot.routeBy) &&
      Object.is(cached.externalFilters, snapshot.externalFilters) &&
      Object.is(cached.transportIdentity, snapshot.transportIdentity) &&
      cached.quickFilter === snapshot.querySnapshot.quickFilter &&
      Object.is(cached.quickFilterFields, snapshot.quickFilterFields) &&
      sameReferenceArray(cached.filters, filters)
    ) {
      return cached.plan;
    }
    const plan = compileAstryxTableServerFacetQuery(snapshot.querySnapshot.columns, columnId, {
      ...(snapshot.routeBy === undefined ? {} : { routeBy: snapshot.routeBy }),
      ...(snapshot.externalFilters === undefined
        ? {}
        : { externalFilters: snapshot.externalFilters }),
      filters,
      quickFilter: snapshot.querySnapshot.quickFilter,
      quickFilterFields: snapshot.quickFilterFields,
      orderBy: [],
    });
    this.#plans.set(
      columnId,
      Object.freeze({
        columns: snapshot.querySnapshot.columns,
        externalFilters: snapshot.externalFilters,
        filters,
        plan,
        quickFilter: snapshot.querySnapshot.quickFilter,
        quickFilterFields: snapshot.quickFilterFields,
        routeBy: snapshot.routeBy,
        transportIdentity: snapshot.transportIdentity,
      }),
    );
    return plan;
  };

  public reconcile(snapshot: AstryxTableServerFacetSemanticSnapshot): void {
    if (!Object.is(this.#snapshot.querySnapshot.columns, snapshot.querySnapshot.columns)) {
      this.#plans.clear();
    }
    if (
      sameServerFacetQuerySnapshot(this.#snapshot.querySnapshot, snapshot.querySnapshot) &&
      sameServerFacetSource(this.#snapshot.source, snapshot.source) &&
      Object.is(this.#snapshot.routeBy, snapshot.routeBy) &&
      Object.is(this.#snapshot.externalFilters, snapshot.externalFilters) &&
      Object.is(this.#snapshot.quickFilterFields, snapshot.quickFilterFields)
    ) {
      return;
    }
    this.#snapshot = Object.freeze(snapshot);
    for (const listener of this.#listeners) listener();
  }
}

function sameServerFacetSource(previous: unknown, next: unknown): boolean {
  if (Object.is(previous, next)) return true;
  if (
    typeof previous !== "object" ||
    previous === null ||
    typeof next !== "object" ||
    next === null
  ) {
    return false;
  }
  return (
    Object.is(Reflect.get(previous, "viewport"), Reflect.get(next, "viewport")) &&
    Object.is(Reflect.get(previous, "useWholeResult"), Reflect.get(next, "useWholeResult"))
  );
}

function sameServerFacetQuerySnapshot(
  previous: AstryxTableQuerySnapshot,
  next: AstryxTableQuerySnapshot,
): boolean {
  return (
    Object.is(previous.columns, next.columns) &&
    Object.is(previous.filters, next.filters) &&
    Object.is(previous.filterCollection, next.filterCollection) &&
    previous.quickFilter === next.quickFilter
  );
}

const AstryxTableServerFacetContext = createContext<AstryxTableServerFacetContextValue | null>(
  null,
);
const emptyAstryxTableServerFacetRows: readonly unknown[] = Object.freeze([]);

export function AstryxTableServerFacetProvider({
  children,
  runtime,
}: Readonly<{
  readonly children: ReactNode;
  readonly runtime: AstryxTableServerFacetRuntime;
}>): ReactElement {
  const value = useMemo(
    () => ({
      getFacetPlan: runtime.getFacetPlan,
      getSnapshot: runtime.getSnapshot,
      subscribe: runtime.subscribe,
    }),
    [runtime],
  );
  return (
    <AstryxTableServerFacetContext.Provider value={value}>
      {children}
    </AstryxTableServerFacetContext.Provider>
  );
}

export const AstryxTableServerSetFilterFacet: NamedExoticComponent<AstryxTableSetFilterFacetProps> =
  memo(function AstryxTableServerSetFilterFacet({
    column,
  }: AstryxTableSetFilterFacetProps): ReactElement | null {
    const context = useContext(AstryxTableServerFacetContext);
    if (context === null) {
      throw new TypeError("AstryxTable Server Set Filter is missing its source Adapter context.");
    }
    const semanticSnapshot = useSyncExternalStore(
      context.subscribe,
      context.getSnapshot,
      context.getSnapshot,
    );
    const { querySnapshot } = semanticSnapshot;
    const coherentColumn = querySnapshot.columns.find(
      (candidate) => candidate.columnId === column.columnId,
    );
    if (
      coherentColumn === undefined ||
      !coherentColumn.enableFilter ||
      !coherentColumn.enableSetFilter
    ) {
      return null;
    }
    return (
      <AstryxTableResolvedServerSetFilterFacet
        column={coherentColumn}
        plan={context.getFacetPlan(semanticSnapshot, coherentColumn.columnId)}
        semanticSnapshot={semanticSnapshot}
        querySnapshot={querySnapshot}
      />
    );
  });

function AstryxTableResolvedServerSetFilterFacet({
  column,
  plan,
  semanticSnapshot,
  querySnapshot,
}: Readonly<{
  readonly column: CompiledColumn;
  readonly plan: AstryxTableCompiledServerFacetQueryPlan;
  readonly semanticSnapshot: AstryxTableServerFacetSemanticSnapshot;
  readonly querySnapshot: AstryxTableQuerySnapshot;
}>): ReactElement {
  const result = useAstryxTableServerWholeResult(semanticSnapshot.source, plan.query);
  const expression = querySnapshot.filterCollection.filtersByColumn.get(column.columnId);
  const coherentRows = result.status === "loading" ? emptyAstryxTableServerFacetRows : result.rows;
  const snapshot = useMemo(
    () =>
      createAstryxTableServerFacetSnapshot({
        column,
        countAlias: plan.countAlias,
        rows: coherentRows,
        expression,
      }),
    [coherentRows, column, expression, plan.countAlias],
  );
  const lifecycle = useMemo(
    () => ({ status: result.status, message: result.message }),
    [result.message, result.status],
  );
  const publish = useCallback(
    (command: AstryxTableSetFilterCommand) => {
      // Another command may have changed intent earlier in this same event.
      const current = semanticSnapshot.runtime.getQuerySnapshot();
      if (!current.columns.includes(column)) return;
      const intent = readAstryxTableSetFilterIntent(
        column,
        current.filterCollection.filtersByColumn.get(column.columnId),
      );
      const filter = applyAstryxTableSetFilterCommand(
        column,
        intent,
        snapshot.options.filter((option) => option.count > 0).map((option) => option.value),
        command,
      );
      semanticSnapshot.runtime.dispatchGridCommand(
        filter === undefined
          ? { type: "column.filter.clear", columnId: column.columnId }
          : { type: "column.filter.replace", columnId: column.columnId, filter },
      );
    },
    [column, snapshot, semanticSnapshot.runtime],
  );
  return (
    <SetFilterView column={column} lifecycle={lifecycle} publish={publish} snapshot={snapshot} />
  );
}

type StableFacetPlan = Readonly<{
  readonly columns: readonly CompiledColumn[];
  readonly externalFilters: readonly unknown[] | undefined;
  readonly filters: readonly unknown[];
  readonly plan: AstryxTableCompiledServerFacetQueryPlan;
  readonly quickFilter: string;
  readonly quickFilterFields: readonly string[];
  readonly routeBy: Readonly<Record<string, unknown>> | undefined;
  readonly transportIdentity: unknown;
}>;

function sameReferenceArray(previous: readonly unknown[], next: readonly unknown[]): boolean {
  return (
    previous.length === next.length &&
    previous.every((value, index) => Object.is(value, next[index]))
  );
}

function useAstryxTableServerWholeResult(
  source: unknown,
  query: AstryxTableCompiledServerFacetQuery,
): AstryxTableServerWholeResult {
  "use no memo";
  if (typeof source !== "object" || source === null) {
    throw new TypeError("AstryxTable Server viewportSource must be an object.");
  }
  const hook = Reflect.get(source, "useWholeResult");
  if (typeof hook !== "function") {
    throw new TypeError("AstryxTable Server viewportSource must expose useWholeResult().");
  }
  return requireWholeResult(Reflect.apply(hook, source, [query]));
}

function requireWholeResult(candidate: unknown): AstryxTableServerWholeResult {
  if (typeof candidate !== "object" || candidate === null) {
    throw new TypeError("AstryxTable Server useWholeResult() returned no source result.");
  }
  const rows = Reflect.get(candidate, "rows");
  const status = Reflect.get(candidate, "status");
  const message = Reflect.get(candidate, "message");
  if (!Array.isArray(rows) || !isServerFacetStatus(status)) {
    throw new TypeError("AstryxTable Server useWholeResult() returned an invalid source result.");
  }
  if (message !== undefined && typeof message !== "string") {
    throw new TypeError("AstryxTable Server useWholeResult() returned an invalid message.");
  }
  return Object.freeze({
    rows,
    status,
    ...(message === undefined ? {} : { message: snapshotAstryxTableSourceMessage(message) }),
  });
}

function isServerFacetStatus(value: unknown): value is AstryxTableServerWholeResult["status"] {
  return (
    value === "loading" ||
    value === "ready" ||
    value === "stale" ||
    value === "closed" ||
    value === "error"
  );
}
