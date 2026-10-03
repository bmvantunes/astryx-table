import type { AstryxTableSourceChrome, AstryxTableSourceStatus } from "../public-types";
import { readCompiledColumnValue } from "./cell-value";
import type { CompiledColumn, CompiledFieldColumn } from "./compile-columns";
import {
  AstryxTableGroupedPresentationCompiler,
  compileAstryxTableGroupRowsColumn,
  type AstryxTableCompiledGroupRowsColumn,
} from "./client-grouping-presentation";
import type { AstryxTableGroupedPresence } from "./client-grouping";
import {
  ASTRYX_TABLE_ROWS_COLUMN_ID,
  isAstryxTableServerGroupedRow,
  markAstryxTableServerGroupedRow,
  type AstryxTableServerGroupedRowSnapshot,
} from "./grouped-row";
import type {
  AstryxTableQueryConfiguration,
  AstryxTableQueryNavigationMode,
  AstryxTableQuerySnapshot,
  AstryxTableRowPipelinePublication,
  AstryxTableRowSpaceSnapshot,
} from "./grid-runtime";
import {
  compileClientFilterCollection,
  reconcileAstryxTableOrderBy,
  sanitizeClientInitialOrderBy,
} from "./grid-query";
import {
  assertAstryxTableServerAggregateAuthorities,
  columnUsesRawRowPresentation,
  compileAstryxTableServerProjectionFields,
  compileAstryxTableServerQueryPlan,
  type AstryxTableCompiledServerGroupedProjection,
} from "./server-query";
import { snapshotAstryxTableQuickFilterFields } from "./quick-filter";
import {
  AstryxTableServerViewportStore,
  sanitizeAstryxTableServerViewportWindow,
  snapshotAstryxTableServerViewportDelivery,
  type AstryxTableServerViewportDeliverySnapshot,
  type AstryxTableServerViewportWindow,
} from "./server-viewport-store";
import {
  snapshotAstryxTableSourceMessage,
  snapshotAstryxTableSourceStatusCode,
} from "./source-lifecycle";

type Listener = () => void;

type AstryxTableServerSourceSnapshot = AstryxTableSourceChrome & {
  readonly viewport: unknown;
};

type AstryxTableServerSourceInput = AstryxTableServerSourceSnapshot & {
  readonly completeRawSelect: unknown;
};

type AstryxTableServerStructureSnapshot = Readonly<{
  readonly totalRows: number;
  readonly getRowId: (index: number) => string | undefined;
  readonly findRowIndex: (rowId: string) => number | undefined;
  readonly generation: number;
  readonly navigationMode: AstryxTableQueryNavigationMode;
  readonly loading: boolean;
}>;

type AstryxTableServerViewportSink<TRow> = Readonly<{
  readonly setRowCount: (count: number, keepRenderedRows?: boolean) => void;
  readonly setRowData: (
    rowsByIndex: Readonly<Record<number, TRow>>,
    rowKeysByIndex: Readonly<Record<number, string>>,
  ) => void;
}>;

type AstryxTableServerViewportRequest<TRow> = Readonly<{
  readonly window: AstryxTableServerViewportWindow;
  readonly query: unknown;
  readonly sink: AstryxTableServerViewportSink<TRow>;
}>;

type AstryxTableServerViewportGeneration = Readonly<{
  readonly setWindow: (window: AstryxTableServerViewportWindow) => void;
  readonly release: () => void;
}>;

export type AstryxTableServerViewportTransport<TRow> = Readonly<{
  readonly semanticKey: (query: unknown) => unknown;
  readonly replace: (
    request: AstryxTableServerViewportRequest<TRow>,
  ) => AstryxTableServerViewportGeneration;
}>;

type ActiveGeneration = Readonly<{
  readonly token: number;
  readonly controller: AstryxTableServerViewportGeneration;
  readonly inputs: AstryxTableServerQueryInputs;
  readonly semanticKey: Readonly<{
    readonly viewport: unknown;
    readonly query: unknown;
  }>;
  readonly grouped?: AstryxTableCompiledServerGroupedProjection;
  readonly groupedAdmissionIdentity?: AstryxTableServerGroupedAdmissionIdentity;
  readonly groupedSortIdentity?: AstryxTableServerGroupedSortIdentity;
  readonly rowsWidth?: number;
}>;

type AstryxTableServerProjectionIntent = Readonly<{
  readonly inputs: AstryxTableServerQueryInputs;
  readonly grouped?: AstryxTableCompiledServerGroupedProjection;
  readonly rowsWidth?: number;
  readonly navigationMode?: AstryxTableQueryNavigationMode;
}>;

type AstryxTableServerGroupedAdmissionIdentity = readonly Readonly<{
  readonly role: "groupKey" | "aggregate";
  readonly columnId: string;
  readonly source: string;
  readonly decoderAuthority: unknown;
  readonly retentionAuthority: CompiledColumn["semantics"]["groupedRetentionAuthority"] | "bigint";
  readonly presentationObservesValue: boolean;
}>[];

type AstryxTableServerGroupedSortIdentity = readonly Readonly<{
  readonly columnId: string;
  readonly direction: "asc" | "desc";
}>[];

export type AstryxTableServerQueryInputs = Readonly<{
  readonly routeBy: Readonly<Record<string, unknown>> | undefined;
  readonly externalFilters: readonly unknown[] | undefined;
  readonly visibleColumnIds: readonly string[] | undefined;
  readonly presentationColumns?: readonly CompiledColumn[];
}>;

const EMPTY_SERVER_QUERY_INPUTS: AstryxTableServerQueryInputs = Object.freeze({
  routeBy: undefined,
  externalFilters: undefined,
  visibleColumnIds: undefined,
});

type RowEquivalencePlan = Readonly<{
  readonly fieldColumns: ReadonlyMap<string, readonly CompiledColumn[]>;
  readonly computedColumns: readonly CompiledColumn[];
  readonly usesRawRowPresentation: boolean;
}>;

type AstryxTableServerRuntimeQuery = Readonly<{
  readonly generation: number;
  readonly navigationMode: AstryxTableQueryNavigationMode;
  readonly filters: readonly unknown[];
  readonly quickFilter: string;
  readonly orderBy: readonly Readonly<{
    readonly columnId: string;
    readonly direction: "asc" | "desc";
  }>[];
  readonly groupBy?: readonly string[];
  readonly groupOrderBy?: readonly Readonly<{
    readonly columnId: string;
    readonly direction: "asc" | "desc";
  }>[];
  readonly rowsWidth?: number;
}>;

const INITIAL_WINDOW: AstryxTableServerViewportWindow = Object.freeze({
  firstRow: 0,
  lastRow: 17,
});

type AstryxTableGroupedInvalidValue = Extract<
  AstryxTableRowPipelinePublication<unknown>["invalid"],
  { readonly kind: "invalid-value" }
>;

type AstryxTableGroupedRejectedBatch = {
  readonly invalid: AstryxTableGroupedInvalidValue;
  readonly pendingRowIndexes: Set<number>;
};

class AstryxTableGroupedDeliveryError extends TypeError {
  public constructor(public readonly invalid: AstryxTableGroupedInvalidValue) {
    super(invalid.message);
    this.name = "AstryxTableGroupedDeliveryError";
  }
}

export class AstryxTableServerRowPipelineAdapter<TRow> {
  private readonly store: AstryxTableServerViewportStore<TRow>;
  private readonly listeners = new Set<Listener>();
  private readonly resultRowCountListeners = new Set<Listener>();
  private readonly structureListeners = new Set<Listener>();
  private readonly metadataListeners = new Set<Listener>();
  private quickFilterFields: readonly string[];
  private projectionFields: readonly string[];
  private completeRawSelect: readonly [string, ...string[]] | undefined;
  private columns: readonly CompiledColumn[];
  private columnsById: ReadonlyMap<string, CompiledColumn>;
  private rowEquivalencePlan: RowEquivalencePlan;
  private readonly initialFilters: readonly unknown[];
  private readonly initialOrderBy: AstryxTableServerRuntimeQuery["orderBy"];
  private queryConfiguration: AstryxTableQueryConfiguration;
  private resultRowCount = 0;
  private active: ActiveGeneration | undefined;
  private projectionIntent: AstryxTableServerProjectionIntent = Object.freeze({
    inputs: EMPTY_SERVER_QUERY_INPUTS,
  });
  private lastReplacedViewport: unknown;
  private replacementRevision = 0;
  private queryGeneration = 0;
  private stagedInitialNavigationMode: AstryxTableQueryNavigationMode | undefined;
  private forceNextNavigationReset = false;
  private readonly groupedRejectedBatchesByRowIndex = new Map<
    number,
    AstryxTableGroupedRejectedBatch
  >();
  private generationNavigationMode: AstryxTableQueryNavigationMode = "reset";
  private maskedRowSpace:
    | Readonly<{
        readonly totalRows: number;
        readonly snapshot: AstryxTableRowSpaceSnapshot<TRow>;
      }>
    | undefined;
  private dispatchedWindow: AstryxTableServerViewportWindow | undefined;
  private generationReleased = true;
  private suppressStorePublication = false;
  private forceFullStorePublication = false;
  private observedRowSpace: AstryxTableRowSpaceSnapshot<TRow>;
  private observedAuthoritativeTotalRows: boolean;
  private observedStructureVersion: number;
  private source: AstryxTableServerSourceSnapshot = Object.freeze({
    viewport: undefined,
    totalRows: 0,
    version: 0,
    status: "loading",
  });
  private publication: AstryxTableRowPipelinePublication<TRow>;
  private structureSnapshot: AstryxTableServerStructureSnapshot;
  private metadataSnapshot: Readonly<
    Pick<
      AstryxTableServerStructureSnapshot,
      "totalRows" | "generation" | "navigationMode" | "loading"
    >
  >;
  private readonly groupedPresentation = new AstryxTableGroupedPresentationCompiler();
  private groupedPresentationIdentity: readonly CompiledColumn[] | undefined;
  private groupedPresentationRevision = 0;
  private groupRowsColumn: AstryxTableCompiledGroupRowsColumn;

  public constructor(
    columns: readonly CompiledColumn[],
    quickFilterFields: readonly string[] | undefined,
    initialFilters: readonly unknown[] = Object.freeze([]),
    initialOrderBy: AstryxTableServerRuntimeQuery["orderBy"] = Object.freeze([]),
    completeRawSelect?: unknown,
    groupRowsColumn?: unknown,
  ) {
    assertAstryxTableServerAggregateAuthorities(columns);
    this.columns = columns;
    this.rowEquivalencePlan = compileRowEquivalencePlan(columns);
    this.quickFilterFields = snapshotAstryxTableQuickFilterFields(quickFilterFields);
    this.completeRawSelect =
      completeRawSelect === undefined ? undefined : snapshotCompleteRawSelect(completeRawSelect);
    this.groupRowsColumn = compileAstryxTableGroupRowsColumn(groupRowsColumn);
    this.projectionFields = compileAstryxTableServerProjectionFields(
      columns,
      this.quickFilterFields,
      this.completeRawSelect,
    );
    this.columnsById = new Map<string, CompiledColumn>(
      columns.map((column) => [column.columnId, column]),
    );
    const filterCollection = compileClientFilterCollection(initialFilters, columns, {
      rejectOverBudget: true,
    });
    this.initialFilters = filterCollection.filters;
    this.initialOrderBy = sanitizeClientInitialOrderBy(initialOrderBy, columns);
    this.queryConfiguration = Object.freeze({
      baselineFilters: this.initialFilters,
      baselineFilterCollection: filterCollection,
      baselineOrderBy: this.initialOrderBy,
      quickFilterFields: this.quickFilterFields,
    });
    this.store = new AstryxTableServerViewportStore(
      (row, columnId) => {
        if (isAstryxTableServerGroupedRow(row)) return row.values.get(columnId);
        const column = this.columnsById.get(columnId);
        return column === undefined ? undefined : readCompiledColumnValue(column, row);
      },
      (previous, next) =>
        isAstryxTableServerGroupedRow(previous) && isAstryxTableServerGroupedRow(next)
          ? groupedRowsEquivalent(
              previous,
              next,
              this.active?.grouped,
              this.columnsById,
              this.groupRowsColumn,
            )
          : rowsEquivalentBySelectedValues(this.rowEquivalencePlan, previous, next),
    );
    this.publication = this.createPublication();
    const initialStoreSnapshot = this.store.getSnapshot();
    this.observedRowSpace = initialStoreSnapshot.rowSpace;
    this.observedAuthoritativeTotalRows = initialStoreSnapshot.authoritativeTotalRows;
    this.observedStructureVersion = initialStoreSnapshot.structureVersion;
    this.structureSnapshot = createStructureSnapshot(
      this.publication,
      initialStoreSnapshot.findRowIndex,
      this.queryGeneration,
      this.generationNavigationMode,
    );
    this.metadataSnapshot = metadataFromStructure(this.structureSnapshot);
    this.store.subscribe(this.reconcileStorePublication);
  }

  public readonly getPublication = (): AstryxTableRowPipelinePublication<TRow> => this.publication;

  public readonly subscribePublication = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public readonly getResultRowCountSnapshot = (): number => this.resultRowCount;

  public readonly subscribeResultRowCount = (listener: Listener): (() => void) => {
    this.resultRowCountListeners.add(listener);
    return () => this.resultRowCountListeners.delete(listener);
  };

  public readonly getStructureSnapshot = (): AstryxTableServerStructureSnapshot =>
    this.structureSnapshot;

  public readonly getMetadataSnapshot = (): Readonly<
    Pick<
      AstryxTableServerStructureSnapshot,
      "totalRows" | "generation" | "navigationMode" | "loading"
    >
  > => this.metadataSnapshot;

  public readonly subscribeMetadata = (listener: Listener): (() => void) => {
    this.metadataListeners.add(listener);
    return () => this.metadataListeners.delete(listener);
  };

  public readonly subscribeStructure = (listener: Listener): (() => void) => {
    this.structureListeners.add(listener);
    return () => this.structureListeners.delete(listener);
  };

  public readonly initializeResultRowCount = (
    _query: AstryxTableQuerySnapshot,
    _rowSpace: AstryxTableRowSpaceSnapshot<unknown> | undefined,
  ): boolean => {
    const count = this.resolveResultRowCount();
    if (this.resultRowCount === count) return false;
    this.publishResultRowCount(count);
    return true;
  };

  public readonly getQueryConfiguration = (): AstryxTableQueryConfiguration =>
    this.queryConfiguration;

  public readonly findRowIndex = (rowId: string): number | undefined =>
    this.store.findRowIndex(rowId);

  public reconcileColumns(
    columns: readonly CompiledColumn[],
    quickFilterFields: readonly string[] | undefined,
    groupRowsColumn: AstryxTableCompiledGroupRowsColumn = this.groupRowsColumn,
  ): AstryxTableQueryConfiguration {
    assertAstryxTableServerAggregateAuthorities(columns);
    const groupRowsChanged = groupRowsColumn !== this.groupRowsColumn;
    this.groupRowsColumn = groupRowsColumn;
    const nextQuickFilterFields =
      quickFilterFields === this.quickFilterFields
        ? this.quickFilterFields
        : snapshotAstryxTableQuickFilterFields(quickFilterFields);
    const visibleColumnIds = retainSurvivingVisibleColumnIds(
      columns,
      this.active?.inputs.visibleColumnIds,
    );
    const nextProjectionFields = compileAstryxTableServerProjectionFields(
      columns,
      nextQuickFilterFields,
      this.completeRawSelect,
      visibleColumnIds,
    );
    if (
      columns === this.columns &&
      sameStringArray(nextQuickFilterFields, this.quickFilterFields)
    ) {
      if (groupRowsChanged) this.publication = this.createPublication();
      return this.queryConfiguration;
    }
    if (columns === this.columns) {
      if (!sameProjectionFields(this.projectionFields, nextProjectionFields)) {
        this.forceNextNavigationReset = true;
      }
      this.quickFilterFields = nextQuickFilterFields;
      this.projectionFields = nextProjectionFields;
      this.queryConfiguration = Object.freeze({
        ...this.queryConfiguration,
        quickFilterFields: nextQuickFilterFields,
      });
      return this.queryConfiguration;
    }
    const filterCollection = compileClientFilterCollection(this.initialFilters, columns);
    const initialOrderBy = reconcileAstryxTableOrderBy(
      this.queryConfiguration.baselineOrderBy,
      this.initialOrderBy,
      columns,
    );
    if (!sameProjectionFields(this.projectionFields, nextProjectionFields)) {
      this.forceNextNavigationReset = true;
    }
    this.columns = columns;
    this.quickFilterFields = nextQuickFilterFields;
    this.projectionFields = nextProjectionFields;
    this.rowEquivalencePlan = compileRowEquivalencePlan(columns, visibleColumnIds);
    this.columnsById = new Map(columns.map((column) => [column.columnId, column]));
    this.queryConfiguration = Object.freeze({
      baselineFilters: filterCollection.filters,
      baselineFilterCollection: filterCollection,
      baselineOrderBy: initialOrderBy,
      quickFilterFields: nextQuickFilterFields,
    });
    this.publication = this.createPublication();
    return this.queryConfiguration;
  }

  public reconcileSource(source: AstryxTableServerSourceInput): void {
    const nextCompleteRawSelect = snapshotCompleteRawSelect(source.completeRawSelect);
    const next = snapshotSource(source);
    requireViewportTransport<TRow>(next.viewport);
    const nextProjectionFields = compileAstryxTableServerProjectionFields(
      this.columns,
      this.quickFilterFields,
      nextCompleteRawSelect,
      this.active?.inputs.visibleColumnIds,
    );
    const replacingActiveSource =
      this.active !== undefined &&
      (this.active.semanticKey.viewport !== next.viewport ||
        !sameProjectionFields(this.projectionFields, nextProjectionFields));
    this.source = next;
    this.completeRawSelect = nextCompleteRawSelect;
    this.projectionFields = nextProjectionFields;
    if (replacingActiveSource) this.forceNextNavigationReset = true;
    this.publishResultRowCount(this.resolveResultRowCount());
    if (replacingActiveSource) return;
    this.publication = this.createPublication();
    this.reconcileStructureSnapshot();
    notify(this.listeners);
  }

  public stageProjection(
    query: AstryxTableServerRuntimeQuery,
    inputs: AstryxTableServerQueryInputs = EMPTY_SERVER_QUERY_INPUTS,
  ): void {
    const prepared = this.prepareProjection(query, inputs);
    const { nextInputs, queryPlan } = prepared;
    this.installPreparedProjection(prepared);
    this.installProjectionIntent(queryPlan, nextInputs, query.rowsWidth, query.navigationMode);
    this.stagedInitialNavigationMode = query.navigationMode;
    this.generationNavigationMode = query.navigationMode;
    if (queryPlan.grouped !== undefined) this.publishResultRowCount(0);
    this.publication = this.createPublication();
    this.reconcileStructureSnapshot();
  }

  public replace(
    viewport: unknown,
    query: AstryxTableServerRuntimeQuery,
    inputs: AstryxTableServerQueryInputs = EMPTY_SERVER_QUERY_INPUTS,
    resetWhenInputsChange = false,
  ): void {
    const replacementRevision = ++this.replacementRevision;
    const prepared = this.prepareProjection(query, inputs);
    const { nextInputs, queryPlan } = prepared;
    const groupedAdmissionIdentity = compileGroupedAdmissionIdentity(
      queryPlan.grouped,
      this.columnsById,
      this.groupRowsColumn,
    );
    const groupedSortIdentity = snapshotGroupedSortIdentity(queryPlan.grouped, query.groupOrderBy);
    const transport = requireViewportTransport<TRow>(viewport);
    if (replacementRevision !== this.replacementRevision) return;
    let semanticKey: ActiveGeneration["semanticKey"];
    try {
      semanticKey = Object.freeze({
        viewport,
        query: transport.semanticKey(queryPlan.query),
      });
    } catch (error) {
      if (replacementRevision !== this.replacementRevision) throw error;
      this.invalidateAfterSemanticKeyFailure(error);
    }
    if (replacementRevision !== this.replacementRevision) return;
    const semanticKeyUnchanged = sameSemanticKey(this.active?.semanticKey, semanticKey);
    const admissionIdentityCompatible = sameGroupedAdmissionIdentity(
      this.active?.groupedAdmissionIdentity,
      groupedAdmissionIdentity,
    );
    const groupedSortIdentityCompatible = sameGroupedSortIdentity(
      this.active?.groupedSortIdentity,
      groupedSortIdentity,
    );
    const admissionAuthorityChanged =
      semanticKeyUnchanged &&
      groupedSortIdentityCompatible &&
      !admissionIdentityCompatible &&
      sameGroupedAdmissionProjection(
        this.active?.groupedAdmissionIdentity,
        groupedAdmissionIdentity,
      );
    if (semanticKeyUnchanged && admissionIdentityCompatible && groupedSortIdentityCompatible) {
      this.installPreparedProjection(prepared);
      this.installProjectionIntent(queryPlan, nextInputs, query.rowsWidth, query.navigationMode);
      const active = this.active;
      if (active !== undefined) {
        const {
          grouped: _previousGrouped,
          groupedAdmissionIdentity: _previousAdmissionIdentity,
          groupedSortIdentity: _previousGroupedSortIdentity,
          rowsWidth: _previousRowsWidth,
          ...activeBase
        } = active;
        this.active = Object.freeze({
          ...activeBase,
          inputs: nextInputs,
          ...(queryPlan.grouped === undefined ? {} : { grouped: queryPlan.grouped }),
          ...(groupedAdmissionIdentity === undefined ? {} : { groupedAdmissionIdentity }),
          ...(groupedSortIdentity === undefined ? {} : { groupedSortIdentity }),
          ...(query.rowsWidth === undefined ? {} : { rowsWidth: query.rowsWidth }),
        });
        this.forceNextNavigationReset = false;
        this.publication = this.createPublication();
        this.reconcileStructureSnapshot();
        notify(this.listeners);
      }
      return;
    }
    let semanticInputsChanged = false;
    try {
      semanticInputsChanged =
        resetWhenInputsChange &&
        this.active !== undefined &&
        this.active.semanticKey.viewport === viewport &&
        !Object.is(
          transport.semanticKey(this.compilePlan(query, this.active.inputs).query),
          semanticKey.query,
        );
    } catch (error) {
      if (replacementRevision !== this.replacementRevision) throw error;
      this.invalidateAfterSemanticKeyFailure(error);
    }
    if (replacementRevision !== this.replacementRevision) return;
    this.installPreparedProjection(prepared);
    this.installProjectionIntent(queryPlan, nextInputs, query.rowsWidth, query.navigationMode);
    const nextNavigationMode =
      semanticInputsChanged ||
      this.forceNextNavigationReset ||
      (this.lastReplacedViewport === undefined && this.stagedInitialNavigationMode === undefined) ||
      (this.lastReplacedViewport !== undefined && this.lastReplacedViewport !== viewport)
        ? "reset"
        : admissionAuthorityChanged
          ? "reconcile"
          : (this.stagedInitialNavigationMode ?? query.navigationMode);
    const previous = this.active;
    this.active = undefined;
    this.dispatchedWindow = undefined;
    this.groupedRejectedBatchesByRowIndex.clear();
    if (previous !== undefined) {
      this.store.invalidateGeneration(previous.token);
      this.generationReleased = true;
      try {
        previous.controller.release();
      } catch (error) {
        if (replacementRevision !== this.replacementRevision) throw error;
        this.publication = this.createPublication();
        preservePrimaryFailure(() => this.reconcileStructureSnapshot());
        preservePrimaryFailure(() => this.publishResultRowCount(this.resolveResultRowCount()));
        preservePrimaryFailure(() => notify(this.listeners));
        throw error;
      }
      if (replacementRevision !== this.replacementRevision) return;
    }
    this.generationReleased = false;
    this.suppressStorePublication = true;
    const activeToken = this.store.beginGeneration(INITIAL_WINDOW);
    let deliveryRevision = 0;
    let controller: AstryxTableServerViewportGeneration;
    try {
      controller = transport.replace({
        window: INITIAL_WINDOW,
        query: queryPlan.query,
        sink: Object.freeze({
          setRowCount: (count, keepRenderedRows) => {
            const accepted = this.store.setRowCount(
              activeToken,
              count,
              keepRenderedRows,
              (acceptedCount) => {
                this.clearGroupedInvalidsWhere((rowIndex) => rowIndex >= acceptedCount);
              },
            );
            if (!accepted && this.store.isActiveGeneration(activeToken)) {
              throw new TypeError("AstryxTable Server viewport delivered an invalid row count.");
            }
          },
          setRowData: (rowsByIndex, rowKeysByIndex) => {
            const revision = ++deliveryRevision;
            if (!this.store.isActiveGeneration(activeToken)) return;
            const delivery = snapshotAstryxTableServerViewportDelivery(rowsByIndex, rowKeysByIndex);
            if (revision !== deliveryRevision) return;
            if (delivery === undefined) {
              throw new TypeError("AstryxTable Server viewport delivered invalid row/key maps.");
            }
            const admission = this.store.planRowDataSnapshot(activeToken, delivery);
            if (revision !== deliveryRevision) return;
            if (admission === undefined) {
              throw new TypeError("AstryxTable Server viewport delivered invalid row/key maps.");
            }
            let admittedRows: AstryxTableServerViewportDeliverySnapshot<TRow>;
            try {
              admittedRows =
                queryPlan.grouped === undefined
                  ? admission.delivery
                  : normalizeGroupedRows(admission.delivery, queryPlan.grouped, this.columnsById);
            } catch (error) {
              if (
                revision !== deliveryRevision ||
                !this.store.isActiveGeneration(activeToken) ||
                this.store.isSupersededRowDataPlan(admission)
              )
                return;
              if (error instanceof AstryxTableGroupedDeliveryError) {
                this.rejectGroupedDelivery(
                  error.invalid,
                  admission.delivery.map(({ index }) => index),
                );
                return;
              }
              throw error;
            }
            if (revision !== deliveryRevision) return;
            let repairedInvalid = false;
            const accepted = this.store.commitRowDataPlan(admission, admittedRows, (admitted) => {
              repairedInvalid = this.clearGroupedInvalidsWhere((rowIndex) =>
                admitted.some(({ index }) => index === rowIndex),
              );
            });
            if (!accepted && this.store.isSupersededRowDataPlan(admission)) return;
            if (!accepted && this.store.isActiveGeneration(activeToken)) {
              throw new TypeError("AstryxTable Server viewport delivered invalid row/key maps.");
            }
            if (repairedInvalid) this.publishGroupedInvalidChange();
          },
        }),
      });
    } catch (error) {
      if (
        replacementRevision !== this.replacementRevision ||
        !this.store.isActiveGeneration(activeToken)
      ) {
        throw error;
      }
      this.store.invalidateGeneration(activeToken);
      this.groupedRejectedBatchesByRowIndex.clear();
      this.generationReleased = true;
      this.suppressStorePublication = false;
      this.alignObservedStoreSnapshot();
      this.publication = this.createPublication();
      this.reconcileStructureSnapshot();
      this.publishResultRowCount(this.resolveResultRowCount());
      notify(this.listeners);
      throw error;
    }
    if (
      replacementRevision !== this.replacementRevision ||
      !this.store.isActiveGeneration(activeToken)
    ) {
      preservePrimaryFailure(() => controller.release());
      return;
    }
    this.active = Object.freeze({
      token: activeToken,
      controller,
      inputs: nextInputs,
      semanticKey,
      ...(queryPlan.grouped === undefined ? {} : { grouped: queryPlan.grouped }),
      ...(groupedAdmissionIdentity === undefined ? {} : { groupedAdmissionIdentity }),
      ...(groupedSortIdentity === undefined ? {} : { groupedSortIdentity }),
      ...(query.rowsWidth === undefined ? {} : { rowsWidth: query.rowsWidth }),
    });
    this.lastReplacedViewport = viewport;
    this.queryGeneration += 1;
    this.generationNavigationMode = nextNavigationMode;
    this.stagedInitialNavigationMode = undefined;
    this.forceNextNavigationReset = false;
    this.dispatchedWindow = INITIAL_WINDOW;
    this.suppressStorePublication = false;
    this.forceFullStorePublication = true;
    this.reconcileStorePublication();
  }

  private prepareProjection(
    query: AstryxTableServerRuntimeQuery,
    inputs: AstryxTableServerQueryInputs,
  ) {
    const snappedInputs = snapshotServerQueryInputs(inputs);
    const visibleColumnIds = retainSurvivingVisibleColumnIds(
      this.columns,
      snappedInputs.visibleColumnIds,
    );
    const nextInputs =
      visibleColumnIds === snappedInputs.visibleColumnIds
        ? snappedInputs
        : Object.freeze({ ...snappedInputs, visibleColumnIds });
    const rowEquivalencePlan = compileRowEquivalencePlan(this.columns, nextInputs.visibleColumnIds);
    const queryPlan = this.compilePlan(query, nextInputs);
    const projectionFields = "select" in queryPlan.query ? queryPlan.query.select : undefined;
    return Object.freeze({ nextInputs, queryPlan, rowEquivalencePlan, projectionFields });
  }

  private installPreparedProjection(
    prepared: Readonly<{
      readonly rowEquivalencePlan: RowEquivalencePlan;
      readonly projectionFields: readonly string[] | undefined;
    }>,
  ): void {
    this.rowEquivalencePlan = prepared.rowEquivalencePlan;
    if (prepared.projectionFields !== undefined) {
      this.projectionFields = prepared.projectionFields;
    }
  }

  private compilePlan(query: AstryxTableServerRuntimeQuery, candidate: AstryxTableServerQueryInputs) {
    const candidateVisibleColumnIds = retainSurvivingVisibleColumnIds(
      this.columns,
      candidate.visibleColumnIds,
    );
    return compileAstryxTableServerQueryPlan(
      this.columns,
      {
        ...(candidate.routeBy === undefined ? {} : { routeBy: candidate.routeBy }),
        ...(candidate.externalFilters === undefined
          ? {}
          : { externalFilters: candidate.externalFilters }),
        ...(candidateVisibleColumnIds === undefined
          ? {}
          : { visibleColumnIds: candidateVisibleColumnIds }),
        filters: query.filters,
        quickFilter: query.quickFilter,
        quickFilterFields: this.quickFilterFields,
        orderBy: query.orderBy,
        groupBy: query.groupBy ?? Object.freeze([]),
        groupOrderBy: query.groupOrderBy ?? Object.freeze([]),
      },
      this.completeRawSelect,
    );
  }

  private installProjectionIntent(
    queryPlan: ReturnType<AstryxTableServerRowPipelineAdapter<TRow>["compilePlan"]>,
    inputs: AstryxTableServerQueryInputs,
    rowsWidth: number | undefined,
    navigationMode: AstryxTableQueryNavigationMode,
  ): void {
    this.projectionIntent = Object.freeze({
      inputs,
      ...(queryPlan.grouped === undefined ? {} : { grouped: queryPlan.grouped }),
      ...(rowsWidth === undefined ? {} : { rowsWidth }),
      navigationMode,
    });
  }

  private invalidateAfterSemanticKeyFailure(error: unknown): never {
    const previous = this.active;
    this.active = undefined;
    this.dispatchedWindow = undefined;
    this.groupedRejectedBatchesByRowIndex.clear();
    this.forceNextNavigationReset = true;
    if (previous !== undefined) {
      this.store.invalidateGeneration(previous.token);
      this.generationReleased = true;
      preservePrimaryFailure(() => previous.controller.release());
    }
    this.suppressStorePublication = false;
    this.alignObservedStoreSnapshot();
    this.publication = this.createPublication();
    preservePrimaryFailure(() => this.reconcileStructureSnapshot());
    preservePrimaryFailure(() => this.publishResultRowCount(this.resolveResultRowCount()));
    preservePrimaryFailure(() => notify(this.listeners));
    throw error;
  }

  private rejectGroupedDelivery(
    invalid: Extract<
      AstryxTableRowPipelinePublication<TRow>["invalid"],
      { readonly kind: "invalid-value" }
    >,
    rejectedRowIndexes: readonly number[],
  ): void {
    const previous = this.resolveGroupedInvalid();
    const existing = this.groupedRejectedBatchesByRowIndex.get(invalid.rowIndex);
    const pendingRowIndexes = new Set(existing?.pendingRowIndexes);
    for (const rowIndex of rejectedRowIndexes) pendingRowIndexes.add(rowIndex);
    this.groupedRejectedBatchesByRowIndex.set(
      invalid.rowIndex,
      Object.freeze({ invalid, pendingRowIndexes }),
    );
    if (this.suppressStorePublication) return;
    if (Object.is(previous, this.resolveGroupedInvalid())) return;
    this.publication = this.createPublication();
    notify(this.listeners);
  }

  private resolveGroupedInvalid(): AstryxTableGroupedInvalidValue | undefined {
    let first: AstryxTableGroupedInvalidValue | undefined;
    for (const { invalid } of this.groupedRejectedBatchesByRowIndex.values()) {
      if (
        first === undefined ||
        invalid.rowIndex < first.rowIndex ||
        (invalid.rowIndex === first.rowIndex && invalid.columnId < first.columnId)
      ) {
        first = invalid;
      }
    }
    return first;
  }

  private clearGroupedInvalidsWhere(predicate: (rowIndex: number) => boolean): boolean {
    let changed = false;
    for (const [rejectedRowIndex, batch] of this.groupedRejectedBatchesByRowIndex) {
      for (const rowIndex of batch.pendingRowIndexes) {
        if (!predicate(rowIndex)) continue;
        batch.pendingRowIndexes.delete(rowIndex);
        changed = true;
      }
      if (batch.pendingRowIndexes.size === 0) {
        this.groupedRejectedBatchesByRowIndex.delete(rejectedRowIndex);
      }
    }
    return changed;
  }

  private publishGroupedInvalidChange(): void {
    if (this.suppressStorePublication) return;
    const invalid = this.resolveGroupedInvalid();
    if (Object.is(this.publication.invalid, invalid)) return;
    this.publication = this.createPublication();
    notify(this.listeners);
  }

  public readonly setRequiredRange = (start: number, end: number): void => {
    const active = this.active;
    if (active === undefined) return;
    const snapshot = this.store.getSnapshot();
    const totalRows = snapshot.rowSpace.totalRows;
    const requestedFirst = Math.max(0, Math.trunc(start));
    const maximumIndex = Math.max(0, totalRows - 1);
    const firstRow = snapshot.authoritativeTotalRows
      ? Math.min(requestedFirst, maximumIndex)
      : requestedFirst;
    const requestedLast = Math.max(firstRow, Math.trunc(end) - 1);
    const lastRow = snapshot.authoritativeTotalRows
      ? Math.min(requestedLast, maximumIndex)
      : requestedLast;
    const window = sanitizeAstryxTableServerViewportWindow({ firstRow, lastRow });
    let prunedInvalid = false;
    const storeChanged = this.store.setRequiredRange(active.token, window, (acceptedWindow) => {
      prunedInvalid = this.clearGroupedInvalidsWhere(
        (rowIndex) => rowIndex < acceptedWindow.firstRow || rowIndex > acceptedWindow.lastRow,
      );
    });
    if (prunedInvalid) this.publishGroupedInvalidChange();
    if (!storeChanged && sameViewportWindow(this.dispatchedWindow, window)) return;
    active.controller.setWindow(window);
    this.dispatchedWindow = window;
  };

  public release(): void {
    this.replacementRevision += 1;
    const active = this.active;
    if (active === undefined) return;
    this.active = undefined;
    this.dispatchedWindow = undefined;
    this.store.invalidateGeneration(active.token);
    this.groupedRejectedBatchesByRowIndex.clear();
    this.generationReleased = true;
    this.publication = this.createPublication();
    let invalidationFailed = false;
    let invalidationFailure: unknown;
    const publishInvalidation = (operation: () => void): void => {
      try {
        operation();
      } catch (error) {
        if (!invalidationFailed) invalidationFailure = error;
        invalidationFailed = true;
      }
    };
    publishInvalidation(() => this.reconcileStructureSnapshot());
    publishInvalidation(() => this.publishResultRowCount(this.resolveResultRowCount()));
    publishInvalidation(() => notify(this.listeners));
    active.controller.release();
    if (invalidationFailed) throw invalidationFailure;
  }

  private createPublication(
    changedRowIds?: ReadonlySet<string>,
  ): AstryxTableRowPipelinePublication<TRow> {
    const projection = this.projectionIntent;
    const snapshot = this.store.getSnapshot();
    const retainedRowSpace =
      snapshot.generation === 0 || this.generationReleased ? undefined : snapshot.rowSpace;
    const totalRows =
      retainedRowSpace?.totalRows ??
      (projection.grouped === undefined ? this.source.totalRows : INITIAL_WINDOW.lastRow + 1);
    const hasCoherentRows =
      retainedRowSpace !== undefined &&
      (retainedRowSpace.loadedRows > 0 ||
        (snapshot.authoritativeTotalRows && retainedRowSpace.totalRows === 0));
    const status =
      !hasCoherentRows && this.source.status === "ready" ? "loading" : this.source.status;
    const hidesProvisionalRows =
      !hasCoherentRows &&
      (this.source.status === "stale" ||
        this.source.status === "closed" ||
        this.source.status === "error");
    const rowSpace =
      this.source.status === "loading" && retainedRowSpace !== undefined
        ? this.getMaskedRowSpace(retainedRowSpace)
        : hidesProvisionalRows
          ? undefined
          : retainedRowSpace;
    const visibleChangedRowIds =
      rowSpace === retainedRowSpace
        ? changedRowIds
        : rowSpace === undefined
          ? undefined
          : EMPTY_CHANGED_ROW_IDS;
    const invalid = this.resolveGroupedInvalid();
    return Object.freeze({
      status,
      totalRows,
      ...(projection.grouped !== undefined &&
      (retainedRowSpace === undefined || !snapshot.authoritativeTotalRows)
        ? { loadingAriaRowCount: -1 }
        : {}),
      version: this.source.version,
      ...(this.source.statusCode === undefined ? {} : { statusCode: this.source.statusCode }),
      ...(this.source.message === undefined ? {} : { message: this.source.message }),
      ...(this.source.retry === undefined ? {} : { retry: this.source.retry }),
      ...(rowSpace === undefined ? {} : { rowSpace }),
      ...(visibleChangedRowIds === undefined ? {} : { changedRowIds: visibleChangedRowIds }),
      hasCoherentRows,
      ...(invalid === undefined ? {} : { invalid }),
      clientProjection:
        projection.grouped === undefined
          ? null
          : createServerGroupedProjectionPublication(
              projection.grouped,
              projection.inputs.presentationColumns ?? this.columns,
              projection.inputs.visibleColumnIds,
              this.groupRowsColumn,
              this.groupedPresentation,
              projection.rowsWidth,
              this.store.getSnapshot().rowSpace,
              this.store.getSnapshot().findRowIndex,
              this.setRequiredRange,
              this.queryGeneration,
              this.active === undefined
                ? (projection.navigationMode ?? this.generationNavigationMode)
                : this.generationNavigationMode,
              this.getGroupedPresentationRevision,
            ),
    });
  }

  private readonly getGroupedPresentationRevision = (
    presentation: readonly CompiledColumn[],
  ): number => {
    if (presentation !== this.groupedPresentationIdentity) {
      this.groupedPresentationIdentity = presentation;
      this.groupedPresentationRevision += 1;
    }
    return this.groupedPresentationRevision;
  };

  private publishResultRowCount(count: number): void {
    if (this.resultRowCount === count) return;
    this.resultRowCount = count;
    notify(this.resultRowCountListeners);
  }

  private resolveResultRowCount(): number {
    const snapshot = this.store.getSnapshot();
    if (!this.generationReleased && snapshot.authoritativeTotalRows) {
      return snapshot.rowSpace.totalRows;
    }
    return snapshot.generation === 0 && this.projectionIntent.grouped === undefined
      ? this.source.totalRows
      : 0;
  }

  private getMaskedRowSpace(
    rowSpace: AstryxTableRowSpaceSnapshot<TRow>,
  ): AstryxTableRowSpaceSnapshot<TRow> {
    if (this.maskedRowSpace !== undefined && this.maskedRowSpace.totalRows === rowSpace.totalRows) {
      return this.maskedRowSpace.snapshot;
    }
    const snapshot = maskAstryxTableServerRowSpace(rowSpace);
    this.maskedRowSpace = Object.freeze({ totalRows: rowSpace.totalRows, snapshot });
    return snapshot;
  }

  private readonly reconcileStorePublication = (): void => {
    if (this.suppressStorePublication) return;
    const storeSnapshot = this.store.getSnapshot();
    if (
      storeSnapshot.rowSpace === this.observedRowSpace &&
      storeSnapshot.authoritativeTotalRows === this.observedAuthoritativeTotalRows
    ) {
      return;
    }
    this.observedRowSpace = storeSnapshot.rowSpace;
    this.observedAuthoritativeTotalRows = storeSnapshot.authoritativeTotalRows;
    const changedRowIds = this.forceFullStorePublication ? undefined : storeSnapshot.affectedRowIds;
    this.forceFullStorePublication = false;
    this.publication = this.createPublication(changedRowIds);
    if (storeSnapshot.structureVersion !== this.observedStructureVersion) {
      this.observedStructureVersion = storeSnapshot.structureVersion;
      this.reconcileStructureSnapshot();
    }
    this.publishResultRowCount(this.resolveResultRowCount());
    notify(this.listeners);
  };

  private alignObservedStoreSnapshot(): void {
    const storeSnapshot = this.store.getSnapshot();
    this.observedRowSpace = storeSnapshot.rowSpace;
    this.observedAuthoritativeTotalRows = storeSnapshot.authoritativeTotalRows;
    this.observedStructureVersion = storeSnapshot.structureVersion;
  }

  private reconcileStructureSnapshot(): void {
    const next = createStructureSnapshot(
      this.publication,
      this.store.getSnapshot().findRowIndex,
      this.queryGeneration,
      this.generationNavigationMode,
    );
    if (
      next.totalRows === this.structureSnapshot.totalRows &&
      next.getRowId === this.structureSnapshot.getRowId &&
      next.findRowIndex === this.structureSnapshot.findRowIndex &&
      next.generation === this.structureSnapshot.generation &&
      next.navigationMode === this.structureSnapshot.navigationMode &&
      next.loading === this.structureSnapshot.loading
    ) {
      return;
    }
    this.structureSnapshot = next;
    const metadataChanged =
      next.totalRows !== this.metadataSnapshot.totalRows ||
      next.generation !== this.metadataSnapshot.generation ||
      next.navigationMode !== this.metadataSnapshot.navigationMode ||
      next.loading !== this.metadataSnapshot.loading;
    if (metadataChanged) this.metadataSnapshot = metadataFromStructure(next);
    notify(
      metadataChanged
        ? [...this.metadataListeners, ...this.structureListeners]
        : this.structureListeners,
    );
  }
}

function metadataFromStructure(snapshot: AstryxTableServerStructureSnapshot) {
  return Object.freeze({
    totalRows: snapshot.totalRows,
    generation: snapshot.generation,
    navigationMode: snapshot.navigationMode,
    loading: snapshot.loading,
  });
}

function createServerGroupedProjectionPublication<TRow>(
  grouped: AstryxTableCompiledServerGroupedProjection,
  columns: readonly CompiledColumn[],
  visibleColumnIds: readonly string[] | undefined,
  rowsColumn: AstryxTableCompiledGroupRowsColumn,
  presentationCompiler: AstryxTableGroupedPresentationCompiler,
  persistedRowsWidth: number | undefined,
  rowSpace: AstryxTableRowSpaceSnapshot<TRow>,
  findRowIndex: (rowId: string) => number | undefined,
  setRequiredRange: (start: number, end: number) => void,
  queryGeneration: number,
  queryNavigationMode: AstryxTableQueryNavigationMode,
  presentationRevisionFor: (presentation: readonly CompiledColumn[]) => number,
) {
  const groupBy = Object.freeze(grouped.groupKeys.map(({ columnId }) => columnId));
  const presentation = presentationCompiler.compile({
    columns,
    visibleColumnIds: visibleColumnIds ?? columns.map(({ columnId }) => columnId),
    groupBy,
    rowsColumn,
    ...(persistedRowsWidth === undefined ? {} : { persistedRowsWidth }),
  });
  return Object.freeze({
    kind: "grouped" as const,
    layoutKey: JSON.stringify(["grouped", groupBy]),
    groupBy,
    columns: presentation,
    presentationKey: JSON.stringify([
      "server-grouped",
      groupBy,
      presentation.map(({ columnId }) => columnId),
      presentationRevisionFor(presentation),
    ]),
    rowIds: Object.freeze([]),
    rowSpaceAuthority: "pipeline" as const,
    rowSpace: Object.freeze({
      totalRows: rowSpace.totalRows,
      getRowId: rowSpace.getRowId,
      findRowIndex,
      setRequiredRange,
    }),
    queryGeneration,
    queryNavigationMode,
  });
}

function normalizeGroupedRows<TRow>(
  delivery: AstryxTableServerViewportDeliverySnapshot<TRow>,
  grouped: AstryxTableCompiledServerGroupedProjection,
  columnsById: ReadonlyMap<string, CompiledColumn>,
): AstryxTableServerViewportDeliverySnapshot<TRow> {
  return Object.freeze(
    delivery.map(({ index, row: input, rowId }) => {
      const groupedPropertiesByField = new Map<string, AstryxTableGroupedProperty>();
      const groupKeys = grouped.groupKeys.map(({ columnId, field }) => {
        let property = groupedPropertiesByField.get(field);
        if (property === undefined) {
          property = readGroupedProperty(input, field, index, columnId);
          groupedPropertiesByField.set(field, property);
        }
        return readGroupedPresence(
          input,
          field,
          columnsById.get(columnId),
          index,
          columnId,
          false,
          false,
          false,
          property,
        );
      });
      const values = new Map<string, unknown>();
      const presences = new Map<string, AstryxTableGroupedPresence>();
      grouped.groupKeys.forEach(({ columnId }, index) => {
        const presence = groupKeys[index]!;
        presences.set(columnId, presence);
        values.set(columnId, presence._tag === "Present" ? presence.value : undefined);
      });
      const rowCount = readRequiredBigInt(input, grouped.rowsAlias, index);
      const rowsPresence = Object.freeze({ _tag: "Present" as const, value: rowCount });
      values.set(ASTRYX_TABLE_ROWS_COLUMN_ID, rowCount);
      presences.set(ASTRYX_TABLE_ROWS_COLUMN_ID, rowsPresence);
      for (const aggregate of grouped.aggregates) {
        const column = columnsById.get(aggregate.columnId);
        const presence = readGroupedPresence(
          input,
          aggregate.alias,
          column,
          index,
          aggregate.columnId,
          aggregate.aggFunc === "countDistinct",
          true,
          aggregate.aggFunc === "min" || aggregate.aggFunc === "max",
        );
        values.set(aggregate.columnId, presence._tag === "Present" ? presence.value : undefined);
        presences.set(aggregate.columnId, presence);
      }
      const row = Object.freeze({
        rowId,
        rowCount,
        groupKeys: Object.freeze(groupKeys),
        values,
        presences,
      }) as TRow;
      markAstryxTableServerGroupedRow(row as unknown as AstryxTableServerGroupedRowSnapshot);
      return Object.freeze({ index, row, rowId });
    }),
  );
}

function readGroupedPresence(
  row: unknown,
  field: string,
  column: CompiledColumn | undefined,
  rowIndex: number,
  columnId: string,
  forceBigInt = false,
  requiredResult = false,
  allowNullishResult = false,
  capturedProperty?: AstryxTableGroupedProperty,
): AstryxTableGroupedPresence {
  const property = capturedProperty ?? readGroupedProperty(row, field, rowIndex, columnId);
  if (property._tag === "Missing") {
    if (!requiredResult) return Object.freeze({ _tag: "Missing" });
    throw new AstryxTableGroupedDeliveryError(
      Object.freeze({
        kind: "invalid-value",
        rowIndex,
        columnId,
        message: forceBigInt
          ? "Expected an exact bigint aggregate."
          : "Expected a grouped aggregate result.",
      }),
    );
  }
  const input = property.value;
  if (
    !forceBigInt &&
    (input === null || input === undefined) &&
    (!requiredResult || allowNullishResult)
  )
    return Object.freeze({ _tag: "Present", value: input });
  const decoded = forceBigInt
    ? typeof input === "bigint" && input >= 0n
      ? { _tag: "Success" as const, value: input }
      : { _tag: "Failure" as const, message: "Expected an exact bigint aggregate." }
    : column?.semantics.decodeRuntime(input);
  if (decoded === undefined || decoded._tag === "Failure") {
    throw new AstryxTableGroupedDeliveryError(
      Object.freeze({
        kind: "invalid-value",
        rowIndex,
        columnId,
        message: decoded?._tag === "Failure" ? decoded.message : `Unknown grouped column: ${field}`,
      }),
    );
  }
  return Object.freeze({ _tag: "Present", value: decoded.value });
}

function readRequiredBigInt(row: unknown, alias: string, rowIndex: number): bigint {
  const property = readGroupedProperty(row, alias, rowIndex, ASTRYX_TABLE_ROWS_COLUMN_ID);
  const value = property._tag === "Present" ? property.value : undefined;
  if (typeof value !== "bigint" || value <= 0n) {
    throw new AstryxTableGroupedDeliveryError(
      Object.freeze({
        kind: "invalid-value",
        rowIndex,
        columnId: ASTRYX_TABLE_ROWS_COLUMN_ID,
        message: "AstryxTable Server grouped Rows count must be a positive bigint.",
      }),
    );
  }
  return value;
}

type AstryxTableGroupedProperty =
  | Readonly<{ readonly _tag: "Missing" }>
  | Readonly<{ readonly _tag: "Present"; readonly value: unknown }>;

const MISSING_GROUPED_PROPERTY: AstryxTableGroupedProperty = Object.freeze({ _tag: "Missing" });

function readGroupedProperty(
  row: unknown,
  field: string,
  rowIndex: number,
  columnId: string,
): AstryxTableGroupedProperty {
  try {
    if (
      typeof row !== "object" ||
      row === null ||
      !Object.prototype.propertyIsEnumerable.call(row, field)
    ) {
      return MISSING_GROUPED_PROPERTY;
    }
    return Object.freeze({ _tag: "Present", value: Reflect.get(row, field) });
  } catch {
    throw new AstryxTableGroupedDeliveryError(
      Object.freeze({
        kind: "invalid-value",
        rowIndex,
        columnId,
        message: "Unable to read grouped result.",
      }),
    );
  }
}

function groupedRowsEquivalent(
  previous: AstryxTableServerGroupedRowSnapshot,
  next: AstryxTableServerGroupedRowSnapshot,
  grouped: AstryxTableCompiledServerGroupedProjection | undefined,
  columnsById: ReadonlyMap<string, CompiledColumn>,
  groupRowsColumn: AstryxTableCompiledGroupRowsColumn,
): boolean {
  if (Object.is(previous, next)) return true;
  if (
    grouped === undefined ||
    previous.rowId !== next.rowId ||
    previous.rowCount !== next.rowCount
  ) {
    return false;
  }
  for (const { columnId } of grouped.groupKeys) {
    const column = columnsById.get(columnId);
    if (
      !groupedPresenceEquivalent(
        previous,
        next,
        columnId,
        column,
        false,
        groupRowsObservesGroupKeys(groupRowsColumn) ||
          (column?.kind === "field" && groupedRoleObservesValue(column, "groupKey")),
      )
    ) {
      return false;
    }
  }
  for (const aggregate of grouped.aggregates) {
    const column = columnsById.get(aggregate.columnId);
    if (
      !groupedPresenceEquivalent(
        previous,
        next,
        aggregate.columnId,
        column,
        aggregate.aggFunc === "countDistinct",
        column?.kind === "field" && groupedRoleObservesValue(column, "aggregate"),
      )
    ) {
      return false;
    }
  }
  return true;
}

function groupedPresenceEquivalent(
  previous: AstryxTableServerGroupedRowSnapshot,
  next: AstryxTableServerGroupedRowSnapshot,
  columnId: string,
  column: CompiledColumn | undefined,
  forceBigInt: boolean,
  presentationObservesValue: boolean,
): boolean {
  const left = previous.presences.get(columnId);
  const right = next.presences.get(columnId);
  if (left?._tag !== right?._tag) return false;
  if (left?._tag !== "Present" || right?._tag !== "Present") return true;
  if (Object.is(left.value, right.value)) return true;
  if (presentationObservesValue) return false;
  if (forceBigInt || column === undefined) return false;
  try {
    return (
      column.semantics.equivalent(left.value, right.value) &&
      column.semantics.formatDisplay(left.value) === column.semantics.formatDisplay(right.value) &&
      column.semantics.formatCanonicalText(left.value) ===
        column.semantics.formatCanonicalText(right.value)
    );
  } catch {
    return false;
  }
}

function groupedRoleObservesValue(
  column: CompiledFieldColumn,
  role: "groupKey" | "aggregate",
): boolean {
  const formatter =
    role === "groupKey" ? column.groupKeyValueFormatter : column.aggregateValueFormatter;
  const className =
    role === "groupKey" ? column.groupKeyCellClassName : column.aggregateCellClassName;
  const renderer = role === "groupKey" ? column.groupKeyCellRenderer : column.aggregateCellRenderer;
  return formatter !== undefined || typeof className === "function" || renderer !== undefined;
}

function groupRowsObservesGroupKeys(column: AstryxTableCompiledGroupRowsColumn): boolean {
  return (
    column.valueFormatter !== undefined ||
    typeof column.cellClassName === "function" ||
    column.cellRenderer !== undefined
  );
}

function maskAstryxTableServerRowSpace<TRow>(
  rowSpace: AstryxTableRowSpaceSnapshot<TRow>,
): AstryxTableRowSpaceSnapshot<TRow> {
  return Object.freeze({
    totalRows: rowSpace.totalRows === 0 ? INITIAL_WINDOW.lastRow + 1 : rowSpace.totalRows,
    loadedRows: 0,
    getRowId: EMPTY_SERVER_ROW_ID,
    getRow: () => undefined,
    getCellValue: () => undefined,
  });
}

function createStructureSnapshot<TRow>(
  publication: AstryxTableRowPipelinePublication<TRow>,
  findRowIndex: (rowId: string) => number | undefined,
  generation: number,
  navigationMode: AstryxTableQueryNavigationMode,
): AstryxTableServerStructureSnapshot {
  const rowSpace = publication.rowSpace;
  const identitiesHidden = rowSpace === undefined || rowSpace.getRowId === EMPTY_SERVER_ROW_ID;
  return Object.freeze({
    totalRows: rowSpace?.totalRows ?? 0,
    getRowId: rowSpace?.getRowId ?? EMPTY_SERVER_ROW_ID,
    findRowIndex: identitiesHidden ? EMPTY_SERVER_ROW_INDEX : findRowIndex,
    generation,
    navigationMode,
    loading: publication.status === "loading",
  });
}

const EMPTY_SERVER_ROW_ID = (): undefined => undefined;
const EMPTY_SERVER_ROW_INDEX = (): undefined => undefined;
const EMPTY_CHANGED_ROW_IDS: ReadonlySet<string> = new Set();

function requireViewportTransport<TRow>(
  viewport: unknown,
): AstryxTableServerViewportTransport<TRow> {
  if (typeof viewport !== "object" || viewport === null) {
    throw new TypeError("AstryxTable Server viewportSource.viewport must be an object.");
  }
  const replace = Reflect.get(viewport, "replace");
  if (typeof replace !== "function") {
    throw new TypeError("AstryxTable Server viewportSource.viewport must expose replace().");
  }
  const semanticKey = Reflect.get(viewport, "semanticKey");
  if (typeof semanticKey !== "function") {
    throw new TypeError("AstryxTable Server viewportSource.viewport must expose semanticKey().");
  }
  return Object.freeze({
    semanticKey: (query) => Reflect.apply(semanticKey, viewport, [query]),
    replace: (request) => {
      const candidate = Reflect.apply(replace, viewport, [request]);
      if (typeof candidate !== "object" || candidate === null) {
        throw new TypeError("AstryxTable Server viewport.replace() returned no generation.");
      }
      const setWindow = Reflect.get(candidate, "setWindow");
      const release = Reflect.get(candidate, "release");
      if (typeof setWindow !== "function" || typeof release !== "function") {
        const compatibilityError = new TypeError(
          "AstryxTable Server viewport generation must expose setWindow() and release().",
        );
        if (typeof release === "function") {
          try {
            Reflect.apply(release, candidate, []);
          } catch {
            // Compatibility is primary; a partially valid controller still receives best-effort
            // cleanup without replacing the boundary error.
          }
        }
        throw compatibilityError;
      }
      return Object.freeze({
        setWindow: (window) => Reflect.apply(setWindow, candidate, [window]),
        release: () => Reflect.apply(release, candidate, []),
      });
    },
  });
}

function snapshotSource(source: AstryxTableServerSourceInput): AstryxTableServerSourceSnapshot {
  const status: AstryxTableSourceStatus = SOURCE_STATUSES.has(source.status)
    ? source.status
    : "error";
  const statusCode = snapshotAstryxTableSourceStatusCode(source.statusCode);
  const message = snapshotAstryxTableSourceMessage(source.message);
  return Object.freeze({
    viewport: source.viewport,
    totalRows:
      Number.isSafeInteger(source.totalRows) && source.totalRows >= 0 ? source.totalRows : 0,
    version: Number.isSafeInteger(source.version) && source.version >= 0 ? source.version : 0,
    status,
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(message === undefined ? {} : { message }),
    ...(source.retry === undefined ? {} : { retry: source.retry }),
  });
}

function snapshotCompleteRawSelect(candidate: unknown): readonly [string, ...string[]] {
  if (!Array.isArray(candidate)) {
    throw new TypeError(
      "AstryxTable Server viewportSource.completeRawSelect must be a non-empty unique source field tuple.",
    );
  }
  const first = candidate[0];
  let hasInvalidField = false;
  for (let index = 0; index < candidate.length; index += 1) {
    const field = candidate[index];
    if (
      !Object.hasOwn(candidate, index) ||
      typeof field !== "string" ||
      field.trim().length === 0
    ) {
      hasInvalidField = true;
      break;
    }
  }
  if (
    typeof first !== "string" ||
    first.trim().length === 0 ||
    hasInvalidField ||
    new Set(candidate).size !== candidate.length
  ) {
    throw new TypeError(
      "AstryxTable Server viewportSource.completeRawSelect must be a non-empty unique source field tuple.",
    );
  }
  return Object.freeze([first, ...candidate.slice(1)]);
}

function notify(listeners: Iterable<Listener>): void {
  let firstError: unknown;
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError !== undefined) throw firstError;
}

function preservePrimaryFailure(operation: () => void): void {
  try {
    operation();
  } catch {
    // Cleanup remains best-effort after a source failure; a secondary release, reconciliation,
    // or subscriber failure must not replace the primary transport error.
  }
}

function sameViewportWindow(
  left: AstryxTableServerViewportWindow | undefined,
  right: AstryxTableServerViewportWindow,
): boolean {
  return left?.firstRow === right.firstRow && left.lastRow === right.lastRow;
}

const SOURCE_STATUSES = new Set<AstryxTableSourceStatus>([
  "loading",
  "ready",
  "stale",
  "closed",
  "error",
]);

function sameSemanticKey(
  previous: ActiveGeneration["semanticKey"] | undefined,
  next: ActiveGeneration["semanticKey"],
): boolean {
  return (
    previous !== undefined &&
    previous.viewport === next.viewport &&
    Object.is(previous.query, next.query)
  );
}

function snapshotServerQueryInputs(
  inputs: AstryxTableServerQueryInputs,
): AstryxTableServerQueryInputs {
  return Object.freeze({
    routeBy: inputs.routeBy === undefined ? undefined : Object.freeze({ ...inputs.routeBy }),
    externalFilters:
      inputs.externalFilters === undefined ? undefined : Object.freeze([...inputs.externalFilters]),
    visibleColumnIds:
      inputs.visibleColumnIds === undefined
        ? undefined
        : Object.freeze([...inputs.visibleColumnIds]),
    ...(inputs.presentationColumns === undefined
      ? {}
      : { presentationColumns: inputs.presentationColumns }),
  });
}

function compileGroupedAdmissionIdentity(
  grouped: AstryxTableCompiledServerGroupedProjection | undefined,
  columnsById: ReadonlyMap<string, CompiledColumn>,
  groupRowsColumn: AstryxTableCompiledGroupRowsColumn,
): AstryxTableServerGroupedAdmissionIdentity | undefined {
  if (grouped === undefined) return undefined;
  const identity = [
    ...grouped.groupKeys.map(({ columnId, field }) => {
      const column = columnsById.get(columnId);
      return Object.freeze({
        role: "groupKey" as const,
        columnId,
        source: field,
        decoderAuthority: column?.semantics.decodeRuntimeAuthority,
        retentionAuthority: column?.semantics.groupedRetentionAuthority ?? ("bigint" as const),
        presentationObservesValue:
          groupRowsObservesGroupKeys(groupRowsColumn) ||
          (column?.kind === "field" && groupedRoleObservesValue(column, "groupKey")),
      });
    }),
    ...grouped.aggregates.map(({ columnId, alias, aggFunc }) => {
      const column = columnsById.get(columnId);
      return Object.freeze({
        role: "aggregate" as const,
        columnId,
        source: alias,
        decoderAuthority:
          aggFunc === "countDistinct" ? "bigint" : column?.semantics.decodeRuntimeAuthority,
        retentionAuthority:
          aggFunc === "countDistinct"
            ? ("bigint" as const)
            : (column?.semantics.groupedRetentionAuthority ?? ("bigint" as const)),
        presentationObservesValue:
          column?.kind === "field" && groupedRoleObservesValue(column, "aggregate"),
      });
    }),
  ];
  return Object.freeze(identity);
}

function sameGroupedAdmissionIdentity(
  previous: AstryxTableServerGroupedAdmissionIdentity | undefined,
  next: AstryxTableServerGroupedAdmissionIdentity | undefined,
): boolean {
  return (
    previous === next ||
    (previous !== undefined &&
      next !== undefined &&
      previous.length === next.length &&
      previous.every((entry, index) => {
        const candidate = next[index]!;
        return (
          entry.role === candidate.role &&
          entry.columnId === candidate.columnId &&
          entry.source === candidate.source &&
          (entry.presentationObservesValue || !candidate.presentationObservesValue) &&
          Object.is(entry.decoderAuthority, candidate.decoderAuthority) &&
          sameGroupedRetentionAuthority(entry.retentionAuthority, candidate.retentionAuthority)
        );
      }))
  );
}

function sameGroupedAdmissionProjection(
  previous: AstryxTableServerGroupedAdmissionIdentity | undefined,
  next: AstryxTableServerGroupedAdmissionIdentity | undefined,
): boolean {
  return (
    previous !== undefined &&
    next !== undefined &&
    previous.length === next.length &&
    previous.every((entry, index) => {
      const candidate = next[index]!;
      return (
        entry.role === candidate.role &&
        entry.columnId === candidate.columnId &&
        entry.source === candidate.source
      );
    })
  );
}

function sameGroupedRetentionAuthority(
  previous: AstryxTableServerGroupedAdmissionIdentity[number]["retentionAuthority"],
  next: AstryxTableServerGroupedAdmissionIdentity[number]["retentionAuthority"],
): boolean {
  return (
    previous === next ||
    (previous !== "bigint" &&
      next !== "bigint" &&
      Object.is(previous.equivalent, next.equivalent) &&
      Object.is(previous.formatCanonicalText, next.formatCanonicalText) &&
      Object.is(previous.formatDisplay, next.formatDisplay))
  );
}

function snapshotGroupedSortIdentity(
  grouped: AstryxTableCompiledServerGroupedProjection | undefined,
  groupOrderBy: AstryxTableServerRuntimeQuery["groupOrderBy"],
): AstryxTableServerGroupedSortIdentity | undefined {
  return grouped === undefined
    ? undefined
    : Object.freeze(
        (groupOrderBy ?? []).map(({ columnId, direction }) =>
          Object.freeze({ columnId, direction }),
        ),
      );
}

function sameGroupedSortIdentity(
  previous: AstryxTableServerGroupedSortIdentity | undefined,
  next: AstryxTableServerGroupedSortIdentity | undefined,
): boolean {
  return (
    previous === next ||
    (previous !== undefined &&
      next !== undefined &&
      previous.length === next.length &&
      previous.every(
        (entry, index) =>
          entry.columnId === next[index]?.columnId && entry.direction === next[index]?.direction,
      ))
  );
}

function retainSurvivingVisibleColumnIds(
  columns: readonly CompiledColumn[],
  visibleColumnIds: readonly string[] | undefined,
): readonly string[] | undefined {
  return visibleColumnIds === undefined ||
    visibleColumnIds.some((columnId) => columns.some((column) => column.columnId === columnId))
    ? visibleColumnIds
    : undefined;
}

function sameProjectionFields(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((field) => right.includes(field));
}

function sameArray<TValue>(
  left: readonly TValue[],
  right: readonly TValue[],
  equivalent: (left: TValue, right: TValue) => boolean,
): boolean {
  return (
    left.length === right.length && left.every((value, index) => equivalent(value, right[index]!))
  );
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return sameArray(left, right, Object.is);
}

function compileRowEquivalencePlan(
  columns: readonly CompiledColumn[],
  visibleColumnIds?: readonly string[],
): RowEquivalencePlan {
  const visibleIds = visibleColumnIds === undefined ? undefined : new Set(visibleColumnIds);
  const fieldColumns = new Map<string, CompiledColumn[]>();
  const computedColumns: CompiledColumn[] = [];
  for (const column of columns) {
    if (visibleIds !== undefined && !visibleIds.has(column.columnId)) continue;
    if (column.kind === "computed") {
      computedColumns.push(column);
      continue;
    }
    const matching = fieldColumns.get(column.field) ?? [];
    matching.push(column);
    fieldColumns.set(column.field, matching);
  }
  return Object.freeze({
    fieldColumns: new Map(
      [...fieldColumns].map(([field, matching]) => [field, Object.freeze(matching)] as const),
    ),
    computedColumns: Object.freeze(computedColumns),
    usesRawRowPresentation: columns.some(
      (column) =>
        (visibleIds === undefined || visibleIds.has(column.columnId)) &&
        columnUsesRawRowPresentation(column),
    ),
  });
}

function rowsEquivalentBySelectedValues<TRow>(
  plan: RowEquivalencePlan,
  previous: TRow,
  next: TRow,
): boolean {
  if (Object.is(previous, next)) return true;
  if (
    typeof previous !== "object" ||
    previous === null ||
    typeof next !== "object" ||
    next === null
  ) {
    return false;
  }
  if (plan.usesRawRowPresentation) return false;
  const previousKeys = Reflect.ownKeys(previous);
  const nextKeys = Reflect.ownKeys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  for (const key of previousKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    const left = Reflect.get(previous, key);
    const right = Reflect.get(next, key);
    const matching = typeof key === "string" ? plan.fieldColumns.get(key) : undefined;
    if (matching === undefined) {
      if (!Object.is(left, right)) return false;
      continue;
    }
    for (const column of matching) {
      try {
        if (
          !column.semantics.equivalent(left, right) ||
          column.semantics.formatDisplay(left) !== column.semantics.formatDisplay(right)
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }
  for (const column of plan.computedColumns) {
    try {
      const left = readCompiledColumnValue(column, previous);
      const right = readCompiledColumnValue(column, next);
      if (
        !column.semantics.equivalent(left, right) ||
        column.semantics.formatDisplay(left) !== column.semantics.formatDisplay(right)
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}
