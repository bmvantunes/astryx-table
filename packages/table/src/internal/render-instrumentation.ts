import { installTableScopedListener } from "./listener-registry";
import { ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL } from "./test-diagnostic-build-contract";

type Listener = () => void;
type CellListener = (rowId: string, columnId: string) => void;
type ColumnFilterRenderListener = (columnId: string) => void;
type QueryTransitionListener = (tableId: string, generation: number) => void;
type RowRenderListener = (rowId: string) => void;
type ColumnPreviewStyleWriteListener = (property: string) => void;
type RowOrderPlanningListener = (tableId: string) => void;
type ColumnGestureListenerEvent = Readonly<{
  readonly tableId: string;
  readonly phase: "attach" | "detach";
  readonly event: "pointermove" | "pointerup" | "pointercancel";
}>;
type ColumnGestureListener = (event: ColumnGestureListenerEvent) => void;
type ColumnGestureFrame =
  | Readonly<{
      readonly phase: "scheduled" | "cancelled";
      readonly kind: "resize" | "reorder";
      readonly frameId: number;
    }>
  | Readonly<{
      readonly phase: "ran";
      readonly kind: "resize" | "reorder";
      readonly frameId: number;
      readonly durationMs: number;
    }>
  | Readonly<{
      readonly phase: "synchronous";
      readonly kind: "resize" | "reorder";
      readonly frameId?: never;
      readonly durationMs: number;
    }>;
type ColumnGestureFrameEvent = Readonly<{
  readonly tableId: string;
  readonly diagnosticBuildContract: typeof ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL;
}> &
  ColumnGestureFrame;
type ColumnGestureFrameListener = (event: ColumnGestureFrameEvent) => void;
export type AstryxTableDragFillFrame =
  | Readonly<{
      readonly phase: "scheduled" | "cancelled";
      readonly frameId: number;
    }>
  | Readonly<{
      readonly phase: "ran";
      readonly frameId: number;
      readonly durationMs: number;
    }>;
export type AstryxTableDragFillFrameEvent = Readonly<{
  readonly tableId: string;
  readonly diagnosticBuildContract: typeof ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL;
}> &
  AstryxTableDragFillFrame;
type DragFillFrameListener = (event: AstryxTableDragFillFrameEvent) => void;

let clientGridSurfaceRenderListener: Listener | undefined;
let clientHeaderRenderListener: Listener | undefined;
let clientViewRenderListener: Listener | undefined;
let clientQuickFilterRenderListener: Listener | undefined;
let clientColumnFilterRenderListener: ColumnFilterRenderListener | undefined;
let clientColumnFilterTriggerRenderListener: ColumnFilterRenderListener | undefined;
const clientQueryTransitionListeners = new Set<QueryTransitionListener>();
let clientCellRenderListener: CellListener | undefined;
let clientColumnResizeFrameListener: Listener | undefined;
let clientColumnReorderFrameListener: Listener | undefined;
let clientColumnPreviewStyleWriteListener: ColumnPreviewStyleWriteListener | undefined;
let clientColumnGestureListenerCount = 0;
let clientColumnGestureFrameListenerCount = 0;
let clientDragFillFrameListenerCount = 0;
const clientColumnGestureListeners = new Map<string, Set<ColumnGestureListener>>();
const clientColumnGestureFrameListeners = new Map<string, Set<ColumnGestureFrameListener>>();
const clientDragFillFrameListeners = new Map<string, Set<DragFillFrameListener>>();
const clientRowOrderPlanningListeners = new Set<RowOrderPlanningListener>();
const clientTableRowOrderPlanningListeners = new Map<string, Set<() => void>>();
const clientTableCellRenderListeners = new Map<string, Set<CellListener>>();
const clientTableRowRenderListeners = new Map<string, Set<RowRenderListener>>();
const clientTableViewRenderListeners = new Map<string, Set<Listener>>();
const clientTableGridSurfaceRenderListeners = new Map<string, Set<Listener>>();
const clientTableHeaderRenderListeners = new Map<string, Set<Listener>>();
const clientTableEditFooterRenderListeners = new Map<string, Set<Listener>>();
const clientTableSortPanelRenderListeners = new Map<string, Set<Listener>>();
let clientTableRowOrderPlanningListenerCount = 0;
let clientTableCellRenderListenerCount = 0;
let clientTableRowRenderListenerCount = 0;
let clientTableViewRenderListenerCount = 0;
let clientTableGridSurfaceRenderListenerCount = 0;
let clientTableHeaderRenderListenerCount = 0;
let clientTableEditFooterRenderListenerCount = 0;
let clientTableSortPanelRenderListenerCount = 0;
let hasGlobalRowOrderPlanningListener = false;
let hasGlobalCellRenderListener = false;
let hasGlobalViewRenderListener = false;
let hasGlobalQuickFilterRenderListener = false;
let hasGlobalColumnFilterRenderListener = false;
let hasGlobalColumnFilterTriggerRenderListener = false;
let hasGlobalQueryTransitionListener = false;
let hasGlobalGridSurfaceRenderListener = false;
let hasGlobalHeaderRenderListener = false;

function notifySafely<T>(listeners: Iterable<T>, notify: (listener: T) => void): void {
  for (const listener of listeners) {
    try {
      notify(listener);
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function recordAstryxTableClientColumnGestureListener(
  tableId: string,
  event: Omit<ColumnGestureListenerEvent, "tableId">,
): void {
  if (clientColumnGestureListenerCount === 0) return;
  const listeners = clientColumnGestureListeners.get(tableId);
  if (listeners === undefined) return;
  notifySafely(listeners, (listener) => listener({ tableId, ...event }));
}

export function installAstryxTableClientColumnGestureListener(
  tableId: string,
  listener: ColumnGestureListener,
): () => void {
  return installTableScopedListener(
    clientColumnGestureListeners,
    tableId,
    listener,
    () => {
      clientColumnGestureListenerCount += 1;
    },
    () => {
      clientColumnGestureListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientColumnGestureFrame(
  tableId: string,
  event: ColumnGestureFrame,
): void {
  if (clientColumnGestureFrameListenerCount === 0) return;
  const listeners = clientColumnGestureFrameListeners.get(tableId);
  if (listeners === undefined) return;
  notifySafely(listeners, (listener) =>
    listener({
      tableId,
      diagnosticBuildContract: ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL,
      ...event,
    }),
  );
}

export function hasAstryxTableClientColumnGestureFrameListener(tableId: string): boolean {
  return (
    clientColumnGestureFrameListenerCount > 0 &&
    (clientColumnGestureFrameListeners.get(tableId)?.size ?? 0) > 0
  );
}

export function installAstryxTableClientColumnGestureFrameListener(
  tableId: string,
  listener: ColumnGestureFrameListener,
): () => void {
  return installTableScopedListener(
    clientColumnGestureFrameListeners,
    tableId,
    listener,
    () => {
      clientColumnGestureFrameListenerCount += 1;
    },
    () => {
      clientColumnGestureFrameListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientDragFillFrame(
  tableId: string,
  event: AstryxTableDragFillFrame,
): void {
  if (clientDragFillFrameListenerCount === 0) return;
  const listeners = clientDragFillFrameListeners.get(tableId);
  if (listeners === undefined) return;
  notifySafely(listeners, (listener) =>
    listener({
      tableId,
      diagnosticBuildContract: ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL,
      ...event,
    }),
  );
}

export function hasAstryxTableClientDragFillFrameListener(tableId: string): boolean {
  return (
    clientDragFillFrameListenerCount > 0 &&
    (clientDragFillFrameListeners.get(tableId)?.size ?? 0) > 0
  );
}

export function installAstryxTableClientDragFillFrameListener(
  tableId: string,
  listener: DragFillFrameListener,
): () => void {
  return installTableScopedListener(
    clientDragFillFrameListeners,
    tableId,
    listener,
    () => {
      clientDragFillFrameListenerCount += 1;
    },
    () => {
      clientDragFillFrameListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientRowOrderPlanning(tableId: string): void {
  if (hasGlobalRowOrderPlanningListener) {
    notifySafely(clientRowOrderPlanningListeners, (listener) => listener(tableId));
  }
  if (clientTableRowOrderPlanningListenerCount > 0) {
    const listeners = clientTableRowOrderPlanningListeners.get(tableId);
    if (listeners !== undefined) {
      notifySafely(listeners, (listener) => listener());
    }
  }
}

export function installAstryxTableClientRowOrderPlanningListener(
  listener: RowOrderPlanningListener,
): () => void {
  clientRowOrderPlanningListeners.add(listener);
  hasGlobalRowOrderPlanningListener = true;
  return () => {
    clientRowOrderPlanningListeners.delete(listener);
    hasGlobalRowOrderPlanningListener = clientRowOrderPlanningListeners.size > 0;
  };
}

export function installAstryxTableClientRowOrderPlanningListenerForTable(
  tableId: string,
  listener: () => void,
): () => void {
  return installTableScopedListener(
    clientTableRowOrderPlanningListeners,
    tableId,
    listener,
    () => {
      clientTableRowOrderPlanningListenerCount += 1;
    },
    () => {
      clientTableRowOrderPlanningListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientCellRender(
  rowId: string,
  columnId: string,
  tableId?: string,
): void {
  if (!hasGlobalCellRenderListener && clientTableCellRenderListenerCount === 0) return;
  const listeners = tableId === undefined ? undefined : clientTableCellRenderListeners.get(tableId);
  if (clientCellRenderListener !== undefined) {
    try {
      clientCellRenderListener(rowId, columnId);
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
  if (listeners !== undefined) {
    notifySafely(listeners, (listener) => listener(rowId, columnId));
  }
}

export function installAstryxTableClientCellRenderListener(listener: CellListener): () => void {
  clientCellRenderListener = listener;
  hasGlobalCellRenderListener = true;
  return () => {
    if (clientCellRenderListener === listener) {
      clientCellRenderListener = undefined;
      hasGlobalCellRenderListener = false;
    }
  };
}

export function installAstryxTableClientCellRenderListenerForTable(
  tableId: string,
  listener: CellListener,
): () => void {
  return installTableScopedListener(
    clientTableCellRenderListeners,
    tableId,
    listener,
    () => {
      clientTableCellRenderListenerCount += 1;
    },
    () => {
      clientTableCellRenderListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientRowRender(tableId: string, rowId: string): void {
  if (clientTableRowRenderListenerCount === 0) return;
  const listeners = clientTableRowRenderListeners.get(tableId);
  if (listeners === undefined) return;
  notifySafely(listeners, (listener) => listener(rowId));
}

export function installAstryxTableClientRowRenderListenerForTable(
  tableId: string,
  listener: RowRenderListener,
): () => void {
  return installTableScopedListener(
    clientTableRowRenderListeners,
    tableId,
    listener,
    () => {
      clientTableRowRenderListenerCount += 1;
    },
    () => {
      clientTableRowRenderListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientViewRender(tableId?: string): void {
  if (!hasGlobalViewRenderListener && clientTableViewRenderListenerCount === 0) return;
  if (clientViewRenderListener !== undefined) {
    try {
      clientViewRenderListener();
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
  if (tableId !== undefined) {
    notifySafely(clientTableViewRenderListeners.get(tableId) ?? [], (listener) => listener());
  }
}

export function recordAstryxTableClientQuickFilterRender(): void {
  if (!hasGlobalQuickFilterRenderListener) return;
  if (clientQuickFilterRenderListener !== undefined) {
    try {
      clientQuickFilterRenderListener();
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function installAstryxTableClientQuickFilterRenderListener(listener: Listener): () => void {
  clientQuickFilterRenderListener = listener;
  hasGlobalQuickFilterRenderListener = true;
  return () => {
    if (clientQuickFilterRenderListener === listener) {
      clientQuickFilterRenderListener = undefined;
      hasGlobalQuickFilterRenderListener = false;
    }
  };
}

export function recordAstryxTableClientColumnFilterRender(columnId: string): void {
  if (!hasGlobalColumnFilterRenderListener) return;
  if (clientColumnFilterRenderListener !== undefined) {
    try {
      clientColumnFilterRenderListener(columnId);
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function installAstryxTableClientColumnFilterRenderListener(
  listener: ColumnFilterRenderListener,
): () => void {
  clientColumnFilterRenderListener = listener;
  hasGlobalColumnFilterRenderListener = true;
  return () => {
    if (clientColumnFilterRenderListener === listener) {
      clientColumnFilterRenderListener = undefined;
      hasGlobalColumnFilterRenderListener = false;
    }
  };
}

export function recordAstryxTableClientColumnFilterTriggerRender(columnId: string): void {
  if (!hasGlobalColumnFilterTriggerRenderListener) return;
  if (clientColumnFilterTriggerRenderListener !== undefined) {
    try {
      clientColumnFilterTriggerRenderListener(columnId);
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function installAstryxTableClientColumnFilterTriggerRenderListener(
  listener: ColumnFilterRenderListener,
): () => void {
  clientColumnFilterTriggerRenderListener = listener;
  hasGlobalColumnFilterTriggerRenderListener = true;
  return () => {
    if (clientColumnFilterTriggerRenderListener === listener) {
      clientColumnFilterTriggerRenderListener = undefined;
      hasGlobalColumnFilterTriggerRenderListener = false;
    }
  };
}

export function recordAstryxTableClientQueryTransition(tableId: string, generation: number): void {
  if (!hasGlobalQueryTransitionListener) return;
  notifySafely(clientQueryTransitionListeners, (listener) => listener(tableId, generation));
}

export function installAstryxTableClientQueryTransitionListener(
  listener: QueryTransitionListener,
): () => void {
  clientQueryTransitionListeners.add(listener);
  hasGlobalQueryTransitionListener = true;
  return () => {
    clientQueryTransitionListeners.delete(listener);
    hasGlobalQueryTransitionListener = clientQueryTransitionListeners.size > 0;
  };
}

export function installAstryxTableClientViewRenderListener(listener: Listener): () => void {
  clientViewRenderListener = listener;
  hasGlobalViewRenderListener = true;
  return () => {
    if (clientViewRenderListener === listener) {
      clientViewRenderListener = undefined;
      hasGlobalViewRenderListener = false;
    }
  };
}

export function installAstryxTableClientViewRenderListenerForTable(
  tableId: string,
  listener: Listener,
): () => void {
  return installTableScopedListener(
    clientTableViewRenderListeners,
    tableId,
    listener,
    () => {
      clientTableViewRenderListenerCount += 1;
    },
    () => {
      clientTableViewRenderListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientGridSurfaceRender(tableId?: string): void {
  if (!hasGlobalGridSurfaceRenderListener && clientTableGridSurfaceRenderListenerCount === 0)
    return;
  if (clientGridSurfaceRenderListener !== undefined) {
    try {
      clientGridSurfaceRenderListener();
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
  if (tableId !== undefined) {
    notifySafely(clientTableGridSurfaceRenderListeners.get(tableId) ?? [], (listener) =>
      listener(),
    );
  }
}

export function installAstryxTableClientGridSurfaceRenderListener(listener: Listener): () => void {
  clientGridSurfaceRenderListener = listener;
  hasGlobalGridSurfaceRenderListener = true;
  return () => {
    if (clientGridSurfaceRenderListener === listener) {
      clientGridSurfaceRenderListener = undefined;
      hasGlobalGridSurfaceRenderListener = false;
    }
  };
}

export function installAstryxTableClientGridSurfaceRenderListenerForTable(
  tableId: string,
  listener: Listener,
): () => void {
  return installTableScopedListener(
    clientTableGridSurfaceRenderListeners,
    tableId,
    listener,
    () => {
      clientTableGridSurfaceRenderListenerCount += 1;
    },
    () => {
      clientTableGridSurfaceRenderListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientColumnResizeFrame(): void {
  if (clientColumnResizeFrameListener !== undefined) {
    try {
      clientColumnResizeFrameListener();
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function installAstryxTableClientColumnResizeFrameListener(listener: Listener): () => void {
  clientColumnResizeFrameListener = listener;
  return () => {
    if (clientColumnResizeFrameListener === listener) clientColumnResizeFrameListener = undefined;
  };
}

export function recordAstryxTableClientColumnReorderFrame(): void {
  if (clientColumnReorderFrameListener !== undefined) {
    try {
      clientColumnReorderFrameListener();
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function installAstryxTableClientColumnReorderFrameListener(listener: Listener): () => void {
  clientColumnReorderFrameListener = listener;
  return () => {
    if (clientColumnReorderFrameListener === listener) clientColumnReorderFrameListener = undefined;
  };
}

export function recordAstryxTableClientColumnPreviewStyleWrite(property: string): void {
  if (clientColumnPreviewStyleWriteListener !== undefined) {
    try {
      clientColumnPreviewStyleWriteListener(property);
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function installAstryxTableClientColumnPreviewStyleWriteListener(
  listener: ColumnPreviewStyleWriteListener,
): () => void {
  clientColumnPreviewStyleWriteListener = listener;
  return () => {
    if (clientColumnPreviewStyleWriteListener === listener) {
      clientColumnPreviewStyleWriteListener = undefined;
    }
  };
}

export function recordAstryxTableClientHeaderRender(tableId?: string): void {
  if (!hasGlobalHeaderRenderListener && clientTableHeaderRenderListenerCount === 0) return;
  if (clientHeaderRenderListener !== undefined) {
    try {
      clientHeaderRenderListener();
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
  if (tableId !== undefined) {
    notifySafely(clientTableHeaderRenderListeners.get(tableId) ?? [], (listener) => listener());
  }
}

export function installAstryxTableClientHeaderRenderListener(listener: Listener): () => void {
  clientHeaderRenderListener = listener;
  hasGlobalHeaderRenderListener = true;
  return () => {
    if (clientHeaderRenderListener === listener) {
      clientHeaderRenderListener = undefined;
      hasGlobalHeaderRenderListener = false;
    }
  };
}

export function installAstryxTableClientHeaderRenderListenerForTable(
  tableId: string,
  listener: Listener,
): () => void {
  return installTableScopedListener(
    clientTableHeaderRenderListeners,
    tableId,
    listener,
    () => {
      clientTableHeaderRenderListenerCount += 1;
    },
    () => {
      clientTableHeaderRenderListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientEditFooterRender(tableId: string): void {
  if (clientTableEditFooterRenderListenerCount === 0) return;
  notifySafely(clientTableEditFooterRenderListeners.get(tableId) ?? [], (listener) => listener());
}

export function installAstryxTableClientEditFooterRenderListenerForTable(
  tableId: string,
  listener: Listener,
): () => void {
  return installTableScopedListener(
    clientTableEditFooterRenderListeners,
    tableId,
    listener,
    () => {
      clientTableEditFooterRenderListenerCount += 1;
    },
    () => {
      clientTableEditFooterRenderListenerCount -= 1;
    },
  );
}

export function recordAstryxTableClientSortPanelRender(tableId: string): void {
  if (clientTableSortPanelRenderListenerCount === 0) return;
  notifySafely(clientTableSortPanelRenderListeners.get(tableId) ?? [], (listener) => listener());
}

export function installAstryxTableClientSortPanelRenderListenerForTable(
  tableId: string,
  listener: Listener,
): () => void {
  return installTableScopedListener(
    clientTableSortPanelRenderListeners,
    tableId,
    listener,
    () => {
      clientTableSortPanelRenderListenerCount += 1;
    },
    () => {
      clientTableSortPanelRenderListenerCount -= 1;
    },
  );
}
