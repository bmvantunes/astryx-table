import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  hasAstryxTableClientColumnGestureFrameListener,
  recordAstryxTableClientColumnGestureFrame,
  recordAstryxTableClientColumnGestureListener,
} from "./render-instrumentation";
import { createAstryxTableColumnGestureActor } from "./column-gesture";
import { useGridNavigation } from "./grid-navigation";
import { createColumnReorder } from "./column-reorder";
import { clampAstryxTableColumnWidth } from "./column-management";
import { useAstryxTableGridHotkeys } from "./hotkey-adapter";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AstryxTableRowSelectionRuntime } from "./row-selection";
import type { AstryxTableViewportAdapterState } from "./react-compiler-adapters";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import type { AstryxTableNavigationRuntime } from "./navigation";

type Bindings = Readonly<{
  cellRange?: import("./cell-range-clipboard").AstryxTableCellRangeRuntime | undefined;
  rowSelection?: AstryxTableRowSelectionRuntime | undefined;
  tableId: string;
  findRowIndex: (rowId: string) => number | undefined;
  queryGeneration: number;
  totalRows: number;
  adapter: AstryxTableViewportAdapterState;
  runtime: AstryxTableRuntimeView;
  navigation: AstryxTableNavigationRuntime;
  announce: (message: string) => void;
}>;
type Session = {
  kind: "resize" | "reorder";
  reorder?: ReturnType<typeof createColumnReorder> | undefined;
  tableId: string;
  columnId: string;
  pointerId: number;
  target: HTMLElement;
  owner: Window;
  initialWidth: number;
  minimum: number;
  maximum: number;
  startX: number;
  currentX: number;
  multiplier: number;
  frame: number | undefined;
  detach: () => void;
};

export function useColumnInteractions(bindings: Bindings) {
  const grid = useRef<HTMLDivElement | null>(null);
  const latest = useRef(bindings);
  const session = useRef<Session | undefined>(undefined);
  const [actor] = useState(createAstryxTableColumnGestureActor);
  const focusFrame = useRef<{ owner: Window; id: number } | undefined>(undefined);
  function isRenderedColumn(columnId: string) {
    return latest.current.adapter.columns.some((column) => column.columnId === columnId);
  }
  function cancelFocusRestore() {
    if (focusFrame.current !== undefined)
      focusFrame.current.owner.cancelAnimationFrame(focusFrame.current.id);
    focusFrame.current = undefined;
  }
  function restoreFocus(gesture: Session) {
    cancelFocusRestore();
    const element = grid.current;
    if (element === null || !isRenderedColumn(gesture.columnId)) return;
    const document = element.ownerDocument;
    const canRestore = () =>
      document.hasFocus() &&
      [gesture.target, element, document.body].includes(document.activeElement as HTMLElement);
    if (!canRestore()) return;
    latest.current.adapter.revealCell(0, gesture.columnId, "header");
    let attempts = 4;
    const restore = () => {
      focusFrame.current = undefined;
      if (!element.isConnected || grid.current !== element || !canRestore()) return;
      const target = Array.from(
        element.querySelectorAll<HTMLElement>("[data-astryx-reorder-column]"),
      ).find((candidate) => candidate.dataset["astryxReorderColumn"] === gesture.columnId);
      attempts = attempts - 1;
      if (target !== undefined) target.focus({ preventScroll: true });
      else if (attempts > 0)
        focusFrame.current = {
          owner: gesture.owner,
          id: gesture.owner.requestAnimationFrame(restore),
        };
    };
    focusFrame.current = { owner: gesture.owner, id: gesture.owner.requestAnimationFrame(restore) };
  }
  useLayoutEffect(() => {
    latest.current = bindings;
  }, [bindings]);

  function widthOf(gesture: Session) {
    return clampAstryxTableColumnWidth(
      gesture.initialWidth + (gesture.currentX - gesture.startX) * gesture.multiplier,
      { min: gesture.minimum, max: gesture.maximum },
    );
  }
  function preview(gesture: Session) {
    if (gesture.reorder !== undefined) {
      return gesture.reorder.preview(gesture.currentX);
    }
    const width = widthOf(gesture);
    latest.current.adapter.previewColumnWidth(gesture.columnId, width);
    gesture.target.setAttribute("aria-valuenow", String(width));
    return false;
  }
  function finish(commit: boolean) {
    const gesture = session.current;
    if (gesture === undefined || actor.getSnapshot().value !== "active") return;
    const measured =
      __ASTRYX_TABLE_TEST_DIAGNOSTICS__ &&
      hasAstryxTableClientColumnGestureFrameListener(gesture.tableId);
    const startedAt = measured ? performance.now() : undefined;
    actor.send({ type: commit ? "COMMIT" : "CANCEL" });
    session.current = undefined;
    if (gesture.frame !== undefined) {
      gesture.owner.cancelAnimationFrame(gesture.frame);
      if (measured)
        recordAstryxTableClientColumnGestureFrame(gesture.tableId, {
          phase: "cancelled",
          kind: gesture.kind,
          frameId: gesture.frame,
        });
    }
    gesture.detach();
    try {
      const hasCapture = gesture.target.hasPointerCapture;
      if (typeof hasCapture === "function") {
        if (hasCapture.call(gesture.target, gesture.pointerId))
          gesture.target.releasePointerCapture(gesture.pointerId);
      }
    } catch {
      /* Synthetic pointer events have no browser capture. */
    }
    const { adapter, runtime } = latest.current;
    if (gesture.reorder !== undefined) {
      if (gesture.reorder.finish(commit, gesture.currentX)) restoreFocus(gesture);
    } else {
      const width = widthOf(gesture);
      adapter.clearColumnWidthPreview(!(commit && width !== gesture.initialWidth));
      if (commit && width !== gesture.initialWidth)
        runtime.dispatchGridCommand({
          type: "column.resize.commit",
          columnId: gesture.columnId,
          width,
        });
      gesture.target.setAttribute(
        "aria-valuenow",
        String(runtime.getColumnCommandSnapshot(gesture.columnId).width),
      );
    }
    const label =
      adapter.columns.find((column) => column.columnId === gesture.columnId)?.headerName ??
      gesture.columnId;
    const { visibleColumnIds } = runtime.getColumnLayoutSnapshot();
    latest.current.announce(
      !commit
        ? "Column layout change cancelled"
        : gesture.kind === "resize"
          ? `${label} width ${runtime.getColumnCommandSnapshot(gesture.columnId).width} pixels`
          : `${label} position ${visibleColumnIds.indexOf(gesture.columnId) + 1} of ${visibleColumnIds.length}`,
    );
    if (startedAt !== undefined)
      recordAstryxTableClientColumnGestureFrame(gesture.tableId, {
        phase: "synchronous",
        kind: gesture.kind,
        durationMs: performance.now() - startedAt,
      });
  }
  const finishRef = useRef(finish);
  useLayoutEffect(() => {
    finishRef.current = finish;
  });
  const { runtime, adapter } = bindings;
  useLayoutEffect(() => {
    actor.start();
    const removeEnvironment = adapter.subscribeViewportEnvironment(() => finishRef.current(false));
    const removeLayout = runtime.subscribeColumnLayout(() => finishRef.current(false));
    const removeChrome = runtime.subscribeChrome(() => {
      const status = runtime.getChromeSnapshot().status;
      if (status === "stale" || status === "closed" || status === "error") finishRef.current(false);
    });
    return () => {
      finishRef.current(false);
      removeEnvironment();
      removeLayout();
      removeChrome();
      actor.stop();
      cancelFocusRestore();
    };
  }, [actor, adapter.subscribeViewportEnvironment, runtime]);

  useLayoutEffect(() => {
    finishRef.current(false);
  }, [bindings.queryGeneration, bindings.totalRows]);

  const navigationCommands = useGridNavigation(grid, {
    ...bindings,
    isGestureActive: () => session.current !== undefined,
  });
  useAstryxTableGridHotkeys(grid, {
    ...navigationCommands,
    ...(bindings.rowSelection === undefined
      ? {}
      : {
          selectAll: (event: import("./hotkey-adapter").AstryxTableHotkeyGesture) => {
            const element = grid.current;
            const selection = latest.current.rowSelection;
            if (!element || !selection || event.defaultPrevented || session.current !== undefined)
              return;
            const OwnerElement = element.ownerDocument.defaultView!.Element;
            const checkbox =
              event.target instanceof OwnerElement
                ? event.target.closest("[data-astryx-row-selection-checkbox]")
                : null;
            if (event.target !== element && checkbox?.closest('[role="grid"]') !== element) return;
            event.preventDefault();
            const header = selection.getHeaderSnapshot();
            if (header.disabled || header.checked) return;
            selection.toggleAll(true);
            latest.current.announce(
              `${selection.getHeaderSnapshot().selectedCount} matching rows selected`,
            );
          },
        }),
    activate: (event, intent, alt, shift) => {
      const selection = latest.current.rowSelection;
      if (
        selection !== undefined &&
        intent === "space" &&
        !alt &&
        event.target === grid.current &&
        !event.defaultPrevented &&
        session.current === undefined
      ) {
        latest.current.navigation.activateForFocus();
        const active = latest.current.navigation.getSnapshot();
        if (active?.region === "body" && active.rowId !== undefined) {
          event.preventDefault();
          const result = selection.toggleRow(
            active.rowId,
            !selection.getRowSnapshot(active.rowId),
            shift,
          );
          if (result.kind !== "ignored")
            latest.current.announce(
              result.kind === "range" && result.rowCount > 1
                ? `${result.rowCount} rows ${result.checked ? "selected" : "deselected"}, rows ${result.startIndex + 1} through ${result.endIndex + 1}`
                : `Row ${active.rowIndex + 1} ${result.checked ? "selected" : "deselected"}`,
            );
          return;
        }
      }
      navigationCommands.activate(event, intent, alt, shift);
    },
    documentEscapeActive: () => session.current !== undefined,
    escape: (event) => {
      if (session.current !== undefined) {
        event.preventDefault();
        finish(false);
      } else navigationCommands.escape(event);
    },
    resize: (event, adjustment, step, allowActiveHeader) => {
      if (event.defaultPrevented || session.current !== undefined) return;
      const element = grid.current;
      const OwnerElement = element?.ownerDocument.defaultView?.Element;
      if (!element || !OwnerElement || !(event.target instanceof OwnerElement)) return;
      const handle = event.target.closest<HTMLElement>("[data-astryx-resize-column]");
      const active = latest.current.navigation.getSnapshot();
      const columnId =
        handle?.dataset["astryxResizeColumn"] ??
        (allowActiveHeader && event.target === element && active?.region === "header"
          ? active.columnId
          : undefined);
      if (columnId === undefined) return;
      const runtime = latest.current.runtime;
      const command = runtime.getColumnCommandSnapshot(columnId);
      if (!isRenderedColumn(columnId)) return;
      event.preventDefault();
      const multiplier =
        element.ownerDocument.defaultView!.getComputedStyle(element).direction === "rtl" ? -1 : 1;
      const requested =
        adjustment === "minimum"
          ? command.minWidth
          : adjustment === "maximum"
            ? command.maxWidth
            : command.width + adjustment * step * multiplier;
      const width = clampAstryxTableColumnWidth(requested, {
        min: command.minWidth,
        max: command.maxWidth,
      });
      if (width === command.width) return;
      runtime.dispatchGridCommand({ type: "column.resize.commit", columnId, width });
      const label =
        latest.current.adapter.columns.find((column) => column.columnId === columnId)?.headerName ??
        columnId;
      latest.current.announce(`${label} width ${width} pixels`);
    },
  });

  function start(
    event: ReactPointerEvent<HTMLElement>,
    columnId: string,
    kind: "resize" | "reorder",
  ) {
    if (
      event.button !== 0 ||
      session.current !== undefined ||
      actor.getSnapshot().value !== "idle" ||
      actor.getSnapshot().status !== "active"
    )
      return;
    const target = event.currentTarget;
    const owner = target.ownerDocument.defaultView;
    if (owner === null) return;
    const runtime = latest.current.runtime;
    const command = runtime.getColumnCommandSnapshot(columnId);
    if (!isRenderedColumn(columnId) || grid.current === null) return;
    if (kind === "reorder" && runtime.getGroupBySnapshot().length > 0) return;
    event.preventDefault();
    cancelFocusRestore();
    latest.current.navigation.activateHeader(columnId);
    target.focus({ preventScroll: true });
    const schedule = (gesture: Session) => {
      if (gesture.frame !== undefined) return;
      const measured =
        __ASTRYX_TABLE_TEST_DIAGNOSTICS__ &&
        hasAstryxTableClientColumnGestureFrameListener(gesture.tableId);
      const frameId = owner.requestAnimationFrame(() => {
        const startedAt = measured ? performance.now() : undefined;
        gesture.frame = undefined;
        if (session.current === gesture && preview(gesture)) schedule(gesture);
        if (startedAt !== undefined)
          recordAstryxTableClientColumnGestureFrame(gesture.tableId, {
            phase: "ran",
            kind: gesture.kind,
            frameId,
            durationMs: performance.now() - startedAt,
          });
      });
      gesture.frame = frameId;
      if (measured)
        recordAstryxTableClientColumnGestureFrame(gesture.tableId, {
          phase: "scheduled",
          kind: gesture.kind,
          frameId,
        });
    };
    const move = (next: PointerEvent) => {
      const gesture = session.current;
      if (!gesture || next.pointerId !== gesture.pointerId) return;
      next.preventDefault();
      gesture.currentX = next.clientX;
      schedule(gesture);
    };
    const up = (next: PointerEvent) => {
      const gesture = session.current;
      if (gesture && next.pointerId === gesture.pointerId) {
        gesture.currentX = next.clientX;
        finishRef.current(true);
      }
    };
    const cancel = (next: PointerEvent) => {
      if (next.pointerId === session.current?.pointerId) finishRef.current(false);
    };
    const tableId = latest.current.tableId;
    session.current = {
      tableId,
      kind,
      reorder:
        kind === "reorder" && grid.current !== null
          ? createColumnReorder({
              grid: grid.current,
              origin: target,
              adapter: latest.current.adapter,
              runtime,
              columnId,
              startX: event.clientX,
              direction: owner.getComputedStyle(grid.current).direction === "rtl" ? "rtl" : "ltr",
            })
          : undefined,
      columnId,
      pointerId: event.pointerId,
      target,
      owner,
      initialWidth: command.width,
      minimum: command.minWidth,
      maximum: command.maxWidth,
      startX: event.clientX,
      currentX: event.clientX,
      multiplier: owner.getComputedStyle(grid.current ?? target).direction === "rtl" ? -1 : 1,
      frame: undefined,
      detach: () => {
        owner.removeEventListener("pointermove", move, true);
        owner.removeEventListener("pointerup", up, true);
        owner.removeEventListener("pointercancel", cancel, true);
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
          for (const event of ["pointermove", "pointerup", "pointercancel"] as const)
            recordAstryxTableClientColumnGestureListener(tableId, { phase: "detach", event });
      },
    };
    actor.send({ type: "START", kind });
    owner.addEventListener("pointermove", move, true);
    owner.addEventListener("pointerup", up, true);
    owner.addEventListener("pointercancel", cancel, true);
    if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
      for (const event of ["pointermove", "pointerup", "pointercancel"] as const)
        recordAstryxTableClientColumnGestureListener(tableId, { phase: "attach", event });
    try {
      const capture = target.setPointerCapture;
      if (typeof capture === "function") capture.call(target, event.pointerId);
    } catch {
      /* Synthetic pointer events have no browser capture. */
    }
  }
  const attachGrid = useCallback((element: HTMLDivElement | null) => {
    grid.current = element;
  }, []);
  const startRef = useRef(start);
  useLayoutEffect(() => {
    startRef.current = start;
  });
  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLElement>, columnId: string) =>
      startRef.current(event, columnId, "resize"),
    [],
  );
  const startReorder = useCallback(
    (event: ReactPointerEvent<HTMLElement>, columnId: string) =>
      startRef.current(event, columnId, "reorder"),
    [],
  );
  return { attachGrid, startResize, startReorder };
}
