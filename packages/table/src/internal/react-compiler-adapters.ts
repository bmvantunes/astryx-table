import {
  createElement,
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { ReactElement, RefCallback } from "react";

import type { CompiledColumn } from "./compile-columns";
import type { AstryxTableColumnLayoutSnapshot } from "./column-management";
import type { AstryxTableQueryNavigationMode, AstryxTableRuntimeView } from "./grid-runtime";
import type { AstryxTableActiveCell, AstryxTableNavigationRuntime } from "./navigation";
import {
  ASTRYX_TABLE_ROW_HEIGHT,
  AstryxTableViewportRuntime,
  type AstryxTableBodyColumnWindowSnapshot,
  type AstryxTableRowRangeSnapshot,
  type AstryxTableViewportSnapshot,
  type AstryxTableViewportBodyHitRequest,
  type AstryxTableViewportBodyHit,
} from "./virtual-viewport";

import type { AstryxTableLogicalRowSpace } from "./astryx-table-view";

const documentInstanceCounters = new WeakMap<Document, number>();
const subscribeNoop =
  (_listener: () => void): (() => void) =>
  () =>
    undefined;

export function useAstryxTableRowIdentitySnapshot(
  rowSpace: AstryxTableLogicalRowSpace,
): Pick<AstryxTableLogicalRowSpace, "getRowId" | "findRowIndex"> {
  const getFallbackSnapshot = useCallback(() => rowSpace, [rowSpace]);
  const getSnapshot = rowSpace.identitySource?.getSnapshot ?? getFallbackSnapshot;
  return useSyncExternalStore(
    rowSpace.identitySource?.subscribe ?? subscribeNoop,
    getSnapshot,
    getSnapshot,
  );
}

function captureLogicalRowSpace(rowSpace: AstryxTableLogicalRowSpace): AstryxTableLogicalRowSpace {
  const identities = rowSpace.identitySource?.getSnapshot();
  return identities === undefined
    ? rowSpace
    : Object.freeze({
        ...rowSpace,
        getRowId: identities.getRowId,
        findRowIndex: identities.findRowIndex,
      });
}

function AstryxTableRowIdentityNavigationBridge({
  rowSpace,
  columns,
  generation,
  getCommittedGeneration,
  navigation,
  rebasePendingReveal,
}: {
  readonly rowSpace: AstryxTableLogicalRowSpace;
  readonly columns: readonly CompiledColumn[];
  readonly generation: number;
  readonly getCommittedGeneration: () => number;
  readonly navigation: AstryxTableNavigationRuntime;
  readonly rebasePendingReveal: AstryxTableViewportRuntime["rebasePendingReveal"];
}): null {
  const identities = useAstryxTableRowIdentitySnapshot(rowSpace);
  useLayoutEffect(() => {
    if (getCommittedGeneration() !== generation) return;
    rebasePendingReveal(identities.findRowIndex);
    navigation.setShape(
      Object.freeze({
        ...rowSpace,
        getRowId: identities.getRowId,
        findRowIndex: identities.findRowIndex,
      }),
      columns,
    );
  }, [
    columns,
    generation,
    getCommittedGeneration,
    identities,
    navigation,
    rebasePendingReveal,
    rowSpace,
  ]);
  return null;
}

type AstryxTablePublishedRequiredRange = Readonly<{
  rowSpace: AstryxTableLogicalRowSpace;
  generation: number;
  start: number;
  end: number;
}>;

function AstryxTableRequiredRangeBridge({
  generation,
  getCommittedGeneration,
  getRowRangeSnapshot,
  rowSpace,
  subscribeRowRange,
}: {
  readonly generation: number;
  readonly getCommittedGeneration: () => number;
  readonly getRowRangeSnapshot: () => AstryxTableRowRangeSnapshot;
  readonly rowSpace: AstryxTableLogicalRowSpace;
  readonly subscribeRowRange: (listener: () => void) => () => void;
}): null {
  const publishedRangeRef = useRef<AstryxTablePublishedRequiredRange | undefined>(undefined);
  const rowRange = useSyncExternalStore(
    subscribeRowRange,
    getRowRangeSnapshot,
    getRowRangeSnapshot,
  );
  useLayoutEffect(() => {
    // Child layout effects precede the parent's committed-query reset. Never
    // publish the previous viewport against the incoming query generation.
    if (getCommittedGeneration() !== generation) return;
    if (rowRange !== getRowRangeSnapshot()) return;
    const previous = publishedRangeRef.current;
    if (
      previous?.rowSpace === rowSpace &&
      previous.generation === generation &&
      previous.start === rowRange.rowStart &&
      previous.end === rowRange.rowEnd
    ) {
      return;
    }
    rowSpace.setRequiredRange(rowRange.rowStart, rowRange.rowEnd);
    publishedRangeRef.current = Object.freeze({
      rowSpace,
      generation,
      start: rowRange.rowStart,
      end: rowRange.rowEnd,
    });
  }, [
    getCommittedGeneration,
    generation,
    getRowRangeSnapshot,
    publishedRangeRef,
    rowRange,
    rowSpace,
  ]);
  return null;
}

function allocateDocumentInstanceId(ownerDocument: Document): string {
  const next = (documentInstanceCounters.get(ownerDocument) ?? 0) + 1;
  documentInstanceCounters.set(ownerDocument, next);
  return `document-${String(next)}`;
}

class AstryxTableInstanceIdStore {
  private hydrated = false;
  private snapshot: string;

  public constructor(private readonly serverId: string) {
    this.snapshot = serverId;
  }

  public readonly getSnapshot = (): string => this.snapshot;
  public readonly getServerSnapshot = (): string => this.serverId;

  public readonly subscribe = (listener: () => void): (() => void) => {
    if (!this.hydrated) {
      this.hydrated = true;
      this.snapshot = `${this.serverId}-${allocateDocumentInstanceId(document)}`;
      listener();
    }
    return () => undefined;
  };
}

type AstryxTableServerFacetHookSource = Readonly<{
  readonly useWholeResult: (...arguments_: never[]) => unknown;
  readonly viewport: unknown;
}>;

class AstryxTableServerFacetHookBridge {
  public readonly source: AstryxTableServerFacetHookSource;

  public constructor(
    public readonly viewport: unknown,
    private hook: AstryxTableServerFacetHookSource["useWholeResult"],
  ) {
    this.source = Object.freeze({
      useWholeResult: (...arguments_: never[]) => this.hook(...arguments_),
      viewport,
    });
  }

  public updateHook(hook: AstryxTableServerFacetHookSource["useWholeResult"]): void {
    this.hook = hook;
  }
}

class AstryxTableServerFacetHookBridgeStore {
  private committed: AstryxTableServerFacetHookBridge;

  public constructor(source: AstryxTableServerFacetHookSource) {
    this.committed = new AstryxTableServerFacetHookBridge(source.viewport, source.useWholeResult);
  }

  public resolve(source: AstryxTableServerFacetHookSource): AstryxTableServerFacetHookBridge {
    return Object.is(this.committed.viewport, source.viewport)
      ? this.committed
      : new AstryxTableServerFacetHookBridge(source.viewport, source.useWholeResult);
  }

  public commit(
    source: AstryxTableServerFacetHookSource,
    bridge: AstryxTableServerFacetHookBridge,
  ): void {
    bridge.updateHook(source.useWholeResult);
    this.committed = bridge;
  }
}

export function useAstryxTableServerFacetHookSource(
  source: AstryxTableServerFacetHookSource,
): AstryxTableServerFacetHookSource {
  "use no memo";
  const [store] = useState(() => new AstryxTableServerFacetHookBridgeStore(source));
  const bridge = store.resolve(source);
  useLayoutEffect(() => {
    store.commit(source, bridge);
  }, [bridge, source, store]);
  return bridge.source;
}

function useAstryxTableInstanceId(): string {
  const reactInstanceId = useId();
  const [{ subscribeInstanceId, getInstanceId, getServerInstanceId }] = useState(() => {
    const store = new AstryxTableInstanceIdStore(reactInstanceId);
    return {
      subscribeInstanceId: store.subscribe,
      getInstanceId: store.getSnapshot,
      getServerInstanceId: store.getServerSnapshot,
    };
  });
  return useSyncExternalStore(subscribeInstanceId, getInstanceId, getServerInstanceId);
}

export type AstryxTableViewportAdapterState = Readonly<{
  instanceId: string;
  columns: readonly CompiledColumn[];
  columnLayout: AstryxTableColumnLayoutSnapshot;
  viewportSnapshot: AstryxTableViewportSnapshot;
  attach: (element: HTMLElement | null) => void;
  attachHeader: (element: HTMLElement | null) => void;
  attachBodyLayer: RefCallback<HTMLElement>;
  attachPinnedEditorHost: RefCallback<HTMLElement>;
  attachRowLayer: (element: HTMLElement | null) => void;
  attachScrollbarOverlay: (element: HTMLElement | null) => void;
  subscribeViewportEnvironment: (listener: () => void) => () => void;
  subscribeColumnWindow: (listener: () => void) => () => void;
  getColumnWindowSnapshot: () => AstryxTableBodyColumnWindowSnapshot;
  subscribeHeaderColumnWindow: (listener: () => void) => () => void;
  getHeaderColumnWindowSnapshot: () => AstryxTableBodyColumnWindowSnapshot;
  getHeaderColumnActivitySnapshot: (columnId: string) => boolean;
  attachHeaderColumn: (columnId: string, element: HTMLElement | null) => void;
  subscribeRowRange: (listener: () => void) => () => void;
  subscribeFrameCommit: (listener: () => void) => () => void;
  getRowRangeSnapshot: () => AstryxTableRowRangeSnapshot;
  subscribeBodyRowColumnWindow: (logicalRowIndex: number, listener: () => void) => () => void;
  getBodyRowColumnWindowSnapshot: (logicalRowIndex: number) => AstryxTableBodyColumnWindowSnapshot;
  scrollByLogical: (delta: number) => boolean;
  scrollVerticalByLogical: (delta: number) => boolean;
  adjustVerticalByLogical: (delta: number) => number | undefined;
  resolveBodyHit: (
    request: AstryxTableViewportBodyHitRequest,
  ) => AstryxTableViewportBodyHit | undefined;
  previewColumnWidth: (columnId: string, width: number) => void;
  clearColumnWidthPreview: (publishSnapshot?: boolean) => void;
  revealCell: (
    rowIndex: number,
    columnId: string,
    region?: "header" | "body",
    rowId?: string,
  ) => void;
}>;

export function AstryxTableViewportAdapterBoundary({
  rowSpace,
  runtime,
  columns,
  projectionKind,
  navigation,
  queryGeneration,
  queryNavigationMode,
  onCommittedNavigationChange,
  leadingUtilityWidth = 0,
  children,
}: {
  readonly rowSpace: AstryxTableLogicalRowSpace;
  readonly runtime: AstryxTableRuntimeView;
  readonly columns: readonly CompiledColumn[];
  readonly projectionKind: "raw" | "grouped" | "invalid";
  readonly navigation: AstryxTableNavigationRuntime;
  readonly queryGeneration: number;
  readonly queryNavigationMode: AstryxTableQueryNavigationMode;
  readonly onCommittedNavigationChange?: (
    activeCell: AstryxTableActiveCell | undefined,
    columns: readonly CompiledColumn[],
  ) => void;
  readonly leadingUtilityWidth?: number;
  readonly children: (state: AstryxTableViewportAdapterState) => ReactElement;
}): ReactElement {
  const instanceId = useAstryxTableInstanceId();
  const installedColumns = columns;
  const installedRowSpace = rowSpace;
  const installedQueryGeneration = queryGeneration;
  const installedQueryNavigationMode = queryNavigationMode;
  const columnLayout = useSyncExternalStore(
    runtime.subscribeColumnLayout,
    runtime.getColumnLayoutSnapshot,
    runtime.getColumnLayoutSnapshot,
  );
  const visibleColumnIds = useMemo(
    () => new Set(columnLayout.visibleColumnIds),
    [columnLayout.visibleColumnIds],
  );
  const layoutColumnsById = useMemo(
    () => new Map(columnLayout.allColumns.map((column) => [column.columnId, column])),
    [columnLayout.allColumns],
  );
  const logicalColumns = useMemo(() => {
    return projectionKind === "grouped"
      ? installedColumns
      : Object.freeze(
          installedColumns.flatMap((column) => {
            if (!visibleColumnIds.has(column.columnId)) return [];
            return [layoutColumnsById.get(column.columnId) ?? column];
          }),
        );
  }, [installedColumns, layoutColumnsById, projectionKind, visibleColumnIds]);
  const logicalColumnLayoutSignature = useMemo(
    () =>
      JSON.stringify(
        logicalColumns.map((column) => [
          column.columnId,
          column.pinned ?? null,
          column.semantics.width,
        ]),
      ),
    [logicalColumns],
  );
  const [viewport] = useState(() => {
    const next = new AstryxTableViewportRuntime(ASTRYX_TABLE_ROW_HEIGHT, leadingUtilityWidth);
    next.setLayout(installedRowSpace.totalRows, logicalColumns, installedRowSpace.findRowIndex);
    return next;
  });
  const [viewportBindings] = useState(() => {
    let committedGeneration = installedQueryGeneration;
    return {
      getCommittedGeneration: () => committedGeneration,
      commitGeneration: (generation: number) => {
        committedGeneration = generation;
      },
      subscribe: viewport.subscribeRender,
      getSnapshot: viewport.getRenderSnapshot,
      setLayout: viewport.setLayout,
      rebasePendingReveal: viewport.rebasePendingReveal,
      setLeadingUtilityWidth: viewport.setLeadingUtilityWidth,
      resetVertical: viewport.resetVertical,
      dispose: viewport.dispose,
      attach: viewport.attach,
      attachBodyLayer: viewport.attachBodyLayer,
      attachPinnedEditorHost: viewport.attachPinnedEditorHost,
      attachRowLayer: viewport.attachRowLayer,
      attachHeader: viewport.attachHeader,
      attachScrollbarOverlay: viewport.attachScrollbarOverlay,
      subscribeEnvironment: viewport.subscribeEnvironment,
      subscribeColumnWindow: viewport.subscribeColumnWindow,
      getColumnWindowSnapshot: viewport.getColumnWindowSnapshot,
      subscribeHeaderColumnWindow: viewport.subscribeHeaderColumnWindow,
      getHeaderColumnWindowSnapshot: viewport.getHeaderColumnWindowSnapshot,
      getHeaderColumnActivitySnapshot: viewport.getHeaderColumnActivitySnapshot,
      attachHeaderColumn: viewport.attachHeaderColumn,
      subscribeRowRange: viewport.subscribeRowRange,
      subscribeFrameCommit: viewport.subscribeFrameCommit,
      getRowRangeSnapshot: viewport.getRowRangeSnapshot,
      subscribeBodyRowColumnWindow: viewport.subscribeBodyRowColumnWindow,
      getBodyRowColumnWindowSnapshot: viewport.getBodyRowColumnWindowSnapshot,
      scrollByLogical: viewport.scrollByLogical,
      scrollVerticalByLogical: viewport.scrollVerticalByLogical,
      adjustVerticalByLogical: viewport.adjustVerticalByLogical,
      resolveBodyHit: viewport.resolveBodyHit,
      previewColumnWidth: viewport.previewColumnWidth,
      clearColumnWidthPreview: viewport.clearColumnWidthPreview,
      revealCell: viewport.revealCell,
    };
  });
  const appliedColumnLayoutSignatureRef = useRef<string | undefined>(undefined);
  const viewportSnapshot = useSyncExternalStore(
    viewportBindings.subscribe,
    viewportBindings.getSnapshot,
    viewportBindings.getSnapshot,
  );
  useLayoutEffect(() => {
    viewportBindings.setLeadingUtilityWidth(leadingUtilityWidth);
  }, [leadingUtilityWidth, viewportBindings]);
  const filterPositionResetEpoch = useSyncExternalStore(
    runtime.subscribeFilterPositionReset,
    runtime.getFilterPositionResetEpochSnapshot,
    runtime.getFilterPositionResetEpochSnapshot,
  );
  const filterPositionResetEpochRef = useRef(filterPositionResetEpoch);
  const resetViewportForCommittedQuery = useCallback((): void => {
    viewportBindings.setLayout(
      installedRowSpace.totalRows,
      logicalColumns,
      installedRowSpace.findRowIndex,
    );
    viewportBindings.resetVertical();
    const resetRange = viewportBindings.getRowRangeSnapshot();
    installedRowSpace.setRequiredRange(resetRange.rowStart, resetRange.rowEnd);
  }, [installedRowSpace, logicalColumns, viewportBindings]);
  useLayoutEffect(() => {
    const changed = navigation.installCommittedQuery(
      installedQueryGeneration,
      installedQueryNavigationMode,
      captureLogicalRowSpace(installedRowSpace),
      logicalColumns,
    );
    if (!changed) {
      viewportBindings.commitGeneration(installedQueryGeneration);
      return;
    }
    resetViewportForCommittedQuery();
    viewportBindings.commitGeneration(installedQueryGeneration);
    onCommittedNavigationChange?.(navigation.getSnapshot(), logicalColumns);
  }, [
    logicalColumns,
    navigation,
    onCommittedNavigationChange,
    installedQueryNavigationMode,
    installedQueryGeneration,
    installedRowSpace,
    resetViewportForCommittedQuery,
    viewportBindings,
  ]);
  useLayoutEffect(() => {
    if (filterPositionResetEpochRef.current === filterPositionResetEpoch) return;
    filterPositionResetEpochRef.current = filterPositionResetEpoch;
    resetViewportForCommittedQuery();
    navigation.resetForCommittedQuery(captureLogicalRowSpace(rowSpace), logicalColumns);
    onCommittedNavigationChange?.(navigation.getSnapshot(), logicalColumns);
  }, [
    filterPositionResetEpoch,
    logicalColumns,
    navigation,
    onCommittedNavigationChange,
    resetViewportForCommittedQuery,
    rowSpace,
  ]);
  useLayoutEffect(() => {
    const columnsChanged = appliedColumnLayoutSignatureRef.current !== logicalColumnLayoutSignature;
    viewportBindings.setLayout(
      installedRowSpace.totalRows,
      logicalColumns,
      installedRowSpace.findRowIndex,
    );
    navigation.setShape(captureLogicalRowSpace(installedRowSpace), logicalColumns);
    if (columnsChanged) {
      const activeCell = navigation.getSnapshot();
      if (activeCell !== undefined) {
        viewportBindings.revealCell(
          activeCell.rowIndex,
          activeCell.columnId,
          activeCell.region,
          activeCell.rowId,
        );
      }
    }
    appliedColumnLayoutSignatureRef.current = logicalColumnLayoutSignature;
  }, [
    installedRowSpace,
    logicalColumnLayoutSignature,
    logicalColumns,
    navigation,
    viewportBindings,
  ]);
  useEffect(() => () => viewportBindings.dispose(), [viewportBindings]);

  return createElement(
    Fragment,
    null,
    createElement(AstryxTableRequiredRangeBridge, {
      getCommittedGeneration: viewportBindings.getCommittedGeneration,
      generation: installedQueryGeneration,
      getRowRangeSnapshot: viewportBindings.getRowRangeSnapshot,
      rowSpace: installedRowSpace,
      subscribeRowRange: viewportBindings.subscribeRowRange,
    }),
    installedRowSpace.identitySource === undefined
      ? null
      : createElement(AstryxTableRowIdentityNavigationBridge, {
          rowSpace: installedRowSpace,
          columns: logicalColumns,
          generation: installedQueryGeneration,
          getCommittedGeneration: viewportBindings.getCommittedGeneration,
          rebasePendingReveal: viewportBindings.rebasePendingReveal,
          navigation,
        }),
    children({
      instanceId,
      columns: logicalColumns,
      columnLayout,
      viewportSnapshot,
      attach: viewportBindings.attach,
      attachBodyLayer: viewportBindings.attachBodyLayer,
      attachPinnedEditorHost: viewportBindings.attachPinnedEditorHost,
      attachRowLayer: viewportBindings.attachRowLayer,
      attachHeader: viewportBindings.attachHeader,
      attachScrollbarOverlay: viewportBindings.attachScrollbarOverlay,
      subscribeViewportEnvironment: viewportBindings.subscribeEnvironment,
      subscribeColumnWindow: viewportBindings.subscribeColumnWindow,
      getColumnWindowSnapshot: viewportBindings.getColumnWindowSnapshot,
      subscribeHeaderColumnWindow: viewportBindings.subscribeHeaderColumnWindow,
      getHeaderColumnWindowSnapshot: viewportBindings.getHeaderColumnWindowSnapshot,
      getHeaderColumnActivitySnapshot: viewportBindings.getHeaderColumnActivitySnapshot,
      attachHeaderColumn: viewportBindings.attachHeaderColumn,
      subscribeRowRange: viewportBindings.subscribeRowRange,
      subscribeFrameCommit: viewportBindings.subscribeFrameCommit,
      getRowRangeSnapshot: viewportBindings.getRowRangeSnapshot,
      subscribeBodyRowColumnWindow: viewportBindings.subscribeBodyRowColumnWindow,
      getBodyRowColumnWindowSnapshot: viewportBindings.getBodyRowColumnWindowSnapshot,
      scrollByLogical: viewportBindings.scrollByLogical,
      scrollVerticalByLogical: viewportBindings.scrollVerticalByLogical,
      adjustVerticalByLogical: viewportBindings.adjustVerticalByLogical,
      resolveBodyHit: viewportBindings.resolveBodyHit,
      previewColumnWidth: viewportBindings.previewColumnWidth,
      clearColumnWidthPreview: viewportBindings.clearColumnWidthPreview,
      revealCell: viewportBindings.revealCell,
    }),
  );
}

type AstryxTableFocusHandoff = Readonly<{
  claim: () => boolean;
  release: () => void;
}>;

class AstryxTableGridAttachment {
  private element: HTMLDivElement | null = null;

  public constructor(
    private focusFallback: () => void,
    private focusHandoff: AstryxTableFocusHandoff,
    private readonly attachViewport: (element: HTMLDivElement | null) => void,
  ) {}

  public updateFocusBindings(
    focusFallback: () => void,
    focusHandoff: AstryxTableFocusHandoff,
  ): void {
    this.focusFallback = focusFallback;
    this.focusHandoff = focusHandoff;
  }

  public readonly attach = (element: HTMLDivElement | null): void => {
    const previousGrid = this.element;
    const activeElement = previousGrid?.ownerDocument.activeElement;
    if (
      element === null &&
      previousGrid !== null &&
      activeElement !== undefined &&
      activeElement !== null &&
      previousGrid.contains(activeElement)
    ) {
      this.focusHandoff.release();
      this.focusFallback();
    }
    this.element = element;
    this.attachViewport(element);
    if (element !== null && this.focusHandoff.claim()) element.focus({ preventScroll: true });
  };
}

export type AstryxTableLoadingViewportAdapterState = Readonly<{
  columns: readonly CompiledColumn[];
  instanceId: string;
  logicalRowCount: number;
  viewportSnapshot: AstryxTableViewportSnapshot;
  attachGrid: (element: HTMLDivElement | null) => void;
  attachBodyLayer: RefCallback<HTMLElement>;
  attachRowLayer: (element: HTMLElement | null) => void;
  attachScrollbarOverlay: (element: HTMLElement | null) => void;
}>;

export function AstryxTableLoadingViewportAdapterBoundary({
  runtime,
  totalRows,
  compiledColumns,
  structuralColumns,
  focusFallback,
  focusHandoff,
  defaultLoadingRowCount,
  leadingUtilityWidth = 0,
  children,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly totalRows: number;
  readonly compiledColumns: readonly CompiledColumn[];
  readonly structuralColumns?: readonly CompiledColumn[] | undefined;
  readonly focusFallback: () => void;
  readonly focusHandoff: AstryxTableFocusHandoff;
  readonly defaultLoadingRowCount: number;
  readonly leadingUtilityWidth?: number;
  readonly children: (state: AstryxTableLoadingViewportAdapterState) => ReactElement;
}): ReactElement {
  const structuralColumnLayout = useMemo(
    () =>
      structuralColumns === undefined ? undefined : Object.freeze({ columns: structuralColumns }),
    [structuralColumns],
  );
  const subscribeColumnLayout =
    structuralColumnLayout === undefined ? runtime.subscribeColumnLayout : subscribeNoop;
  const getColumnLayout = useMemo(
    () =>
      structuralColumnLayout === undefined
        ? runtime.getColumnLayoutSnapshot
        : () => structuralColumnLayout,
    [runtime, structuralColumnLayout],
  );
  const columnLayout = useSyncExternalStore(
    subscribeColumnLayout,
    getColumnLayout,
    getColumnLayout,
  );
  const columns = columnLayout.columns.length > 0 ? columnLayout.columns : compiledColumns;
  const instanceId = useAstryxTableInstanceId();
  const logicalRowCount =
    Number.isSafeInteger(totalRows) && totalRows > 0 ? totalRows : defaultLoadingRowCount;
  const [viewport] = useState(() => {
    const next = new AstryxTableViewportRuntime(0, leadingUtilityWidth);
    next.setLayout(logicalRowCount, columns);
    return next;
  });
  const [viewportBindings] = useState(() => ({
    subscribe: viewport.subscribe,
    getSnapshot: viewport.getSnapshot,
    setLayout: viewport.setLayout,
    dispose: viewport.dispose,
    attach: viewport.attach,
    attachBodyLayer: viewport.attachBodyLayer,
    attachRowLayer: viewport.attachRowLayer,
    attachScrollbarOverlay: viewport.attachScrollbarOverlay,
  }));
  const viewportSnapshot = useSyncExternalStore(
    viewportBindings.subscribe,
    viewportBindings.getSnapshot,
    viewportBindings.getSnapshot,
  );
  useLayoutEffect(() => {
    viewportBindings.setLayout(logicalRowCount, columns);
  }, [columns, logicalRowCount, viewportBindings]);
  useEffect(() => () => viewportBindings.dispose(), [viewportBindings]);
  const [gridAttachment] = useState(
    () => new AstryxTableGridAttachment(focusFallback, focusHandoff, viewportBindings.attach),
  );
  useLayoutEffect(() => {
    gridAttachment.updateFocusBindings(focusFallback, focusHandoff);
  }, [focusFallback, focusHandoff, gridAttachment]);

  return children({
    columns,
    instanceId,
    logicalRowCount,
    viewportSnapshot,
    attachGrid: gridAttachment.attach,
    attachBodyLayer: viewportBindings.attachBodyLayer,
    attachRowLayer: viewportBindings.attachRowLayer,
    attachScrollbarOverlay: viewportBindings.attachScrollbarOverlay,
  });
}
