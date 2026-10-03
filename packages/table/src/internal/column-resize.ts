import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  hasAstryxTableClientColumnGestureFrameListener,
  recordAstryxTableClientColumnGestureFrame,
  recordAstryxTableClientColumnGestureListener,
} from "./render-instrumentation";
import { createAstryxTableColumnGestureActor } from "./column-gesture";
import { clampAstryxTableColumnWidth } from "./column-management";
import { useAstryxTableGridHotkeys } from "./hotkey-adapter";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AstryxTableViewportAdapterState } from "./react-compiler-adapters";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import type { AstryxTableNavigationRuntime } from "./navigation";

type Bindings = Readonly<{
  tableId: string;
  queryGeneration: number;
  totalRows: number;
  adapter: AstryxTableViewportAdapterState;
  runtime: AstryxTableRuntimeView;
  navigation: AstryxTableNavigationRuntime;
  announce: (message: string) => void;
}>;
type Session = {
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
const noop = () => undefined;

export function useColumnResize(bindings: Bindings) {
  const grid = useRef<HTMLDivElement | null>(null);
  const latest = useRef(bindings);
  const session = useRef<Session | undefined>(undefined);
  const [actor] = useState(createAstryxTableColumnGestureActor);
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
    const width = widthOf(gesture);
    latest.current.adapter.previewColumnWidth(gesture.columnId, width);
    gesture.target.setAttribute("aria-valuenow", String(width));
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
          kind: "resize",
          frameId: gesture.frame,
        });
    }
    gesture.detach();
    try {
      if (gesture.target.hasPointerCapture?.(gesture.pointerId))
        gesture.target.releasePointerCapture(gesture.pointerId);
    } catch {
      /* Synthetic pointer events have no browser capture. */
    }
    const width = widthOf(gesture);
    const { adapter, runtime } = latest.current;
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
    const label =
      adapter.columns.find((column) => column.columnId === gesture.columnId)?.headerName ??
      gesture.columnId;
    latest.current.announce(
      commit ? `${label} width ${width} pixels` : "Column layout change cancelled",
    );
    if (startedAt !== undefined)
      recordAstryxTableClientColumnGestureFrame(gesture.tableId, {
        phase: "synchronous",
        kind: "resize",
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
    };
  }, [actor, adapter.subscribeViewportEnvironment, runtime]);

  useLayoutEffect(() => {
    finishRef.current(false);
  }, [bindings.queryGeneration, bindings.totalRows]);

  useAstryxTableGridHotkeys(grid, {
    documentEscapeActive: () => session.current !== undefined,
    escape: (event) => {
      if (session.current !== undefined) {
        event.preventDefault();
        finish(false);
      }
    },
    shiftTab: noop,
    headerMenu: noop,
    copy: noop,
    activate: noop,
    navigate: noop,
    page: noop,
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
      const command = runtime.getColumnCommandSnapshot(columnId);
      if (!command.visible) return;
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

  function start(event: ReactPointerEvent<HTMLElement>, columnId: string) {
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
    const command = runtime.getColumnCommandSnapshot(columnId);
    if (!command.visible) return;
    event.preventDefault();
    latest.current.navigation.activateHeader(columnId);
    target.focus({ preventScroll: true });
    const move = (next: PointerEvent) => {
      const gesture = session.current;
      if (!gesture || next.pointerId !== gesture.pointerId) return;
      next.preventDefault();
      gesture.currentX = next.clientX;
      if (gesture.frame !== undefined) return;
      const measured =
        __ASTRYX_TABLE_TEST_DIAGNOSTICS__ &&
        hasAstryxTableClientColumnGestureFrameListener(gesture.tableId);
      const frameId = owner.requestAnimationFrame(() => {
        const startedAt = measured ? performance.now() : undefined;
        gesture.frame = undefined;
        if (session.current === gesture) preview(gesture);
        if (startedAt !== undefined)
          recordAstryxTableClientColumnGestureFrame(gesture.tableId, {
            phase: "ran",
            kind: "resize",
            frameId,
            durationMs: performance.now() - startedAt,
          });
      });
      gesture.frame = frameId;
      if (measured)
        recordAstryxTableClientColumnGestureFrame(gesture.tableId, {
          phase: "scheduled",
          kind: "resize",
          frameId,
        });
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
    actor.send({ type: "START", kind: "resize" });
    owner.addEventListener("pointermove", move, true);
    owner.addEventListener("pointerup", up, true);
    owner.addEventListener("pointercancel", cancel, true);
    if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
      for (const event of ["pointermove", "pointerup", "pointercancel"] as const)
        recordAstryxTableClientColumnGestureListener(tableId, { phase: "attach", event });
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      /* Synthetic pointer events have no browser capture. */
    }
  }
  const attachGrid = useCallback((element: HTMLDivElement | null) => {
    grid.current = element;
  }, []);
  return { attachGrid, start };
}
