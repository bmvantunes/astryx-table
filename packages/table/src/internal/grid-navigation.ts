import { requestAstryxTableHotkeyWorkflowAction } from "./hotkey-adapter";
import { useLayoutEffect, useRef } from "react";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import type { RefObject } from "react";
import { cellDomId, headerDomId, unloadedCellDomId } from "./native-table-presentation";
import { useAstryxTableGridTabStopHandoff } from "./focus";
import { isAstryxTableDocumentFocusChainActive } from "./focus-ownership";
import { ASTRYX_TABLE_ROW_HEIGHT } from "./virtual-viewport";
import type { AstryxTableGridHotkeyCommands, AstryxTableHotkeyGesture } from "./hotkey-adapter";
import type { AstryxTableNavigationRuntime } from "./navigation";
import type { AstryxTableViewportAdapterState } from "./react-compiler-adapters";

const interactive =
  'a[href],area[href],button,input,select,summary,textarea,iframe,object,embed,audio[controls],video[controls],[contenteditable]:not([contenteditable="false"]),[tabindex]';
type InteractiveElement = HTMLElement | SVGElement;
function usable(candidate: InteractiveElement) {
  return (
    !candidate.matches(':disabled,[aria-disabled="true"]') &&
    candidate.closest('[inert],[hidden],[aria-hidden="true"]') === null &&
    candidate.getClientRects().length > 0 &&
    !["hidden", "collapse"].includes(
      candidate.ownerDocument.defaultView!.getComputedStyle(candidate).visibility,
    )
  );
}
type Bindings = {
  tableId: string;
  runtime: AstryxTableRuntimeView;
  findRowIndex: (rowId: string) => number | undefined;
  adapter: AstryxTableViewportAdapterState;
  navigation: AstryxTableNavigationRuntime;
  isGestureActive: () => boolean;
  announce: (message: string) => void;
};

// Logical navigation stays in the retained runtime. This boundary projects it
// onto mounted native cells without subscribing the structural React tree.
export function useGridNavigation(grid: RefObject<HTMLDivElement | null>, bindings: Bindings) {
  const latest = useRef(bindings);
  const yieldTabStop = useAstryxTableGridTabStopHandoff();
  useLayoutEffect(() => {
    latest.current = bindings;
  });
  const { navigation, tableId, adapter } = bindings;
  useLayoutEffect(() => {
    const element = grid.current;
    if (element === null) return;
    const document = element.ownerDocument;
    const OwnerElement = document.defaultView!.HTMLElement;
    const OwnerNode = document.defaultView!.Element;
    const OwnerSvg = document.defaultView!.SVGElement;
    const isInteractiveElement = (target: EventTarget | null): target is InteractiveElement =>
      target instanceof OwnerElement || target instanceof OwnerSvg;
    const authored = new Map<InteractiveElement, string | null>();
    const managedWrites = new WeakMap<InteractiveElement, number>();
    const rememberAuthoredChanges = (records: readonly MutationRecord[]) => {
      for (const record of records) {
        const target = record.target;
        if (
          record.type !== "attributes" ||
          record.attributeName !== "tabindex" ||
          !isInteractiveElement(target) ||
          !authored.has(target)
        )
          continue;
        const pending = managedWrites.get(target) ?? 0;
        if (pending > 0) managedWrites.set(target, pending - 1);
        else authored.set(target, target.getAttribute("tabindex"));
      }
    };
    const restore = (candidate: InteractiveElement, value: string | null) => {
      if (value === null) candidate.removeAttribute("tabindex");
      else candidate.setAttribute("tabindex", value);
      authored.delete(candidate);
      managedWrites.delete(candidate);
    };
    let highlighted: HTMLElement | null = null;
    let proxyRow: HTMLDivElement | undefined;
    let proxyCell: HTMLDivElement | undefined;
    let proxyOwner: HTMLElement | undefined;
    let ownedProxyId: string | undefined;
    const releaseProxyOwnership = () => {
      if (proxyOwner !== undefined) {
        const retained = (proxyOwner.getAttribute("aria-owns") ?? "")
          .split(" ")
          .filter((id) => id.length > 0 && id !== ownedProxyId)
          .join(" ");
        if (retained.length === 0) proxyOwner.removeAttribute("aria-owns");
        else proxyOwner.setAttribute("aria-owns", retained);
      }
      proxyOwner = undefined;
      ownedProxyId = undefined;
    };
    let focusedDescendant: InteractiveElement | undefined;
    const owns = (target: Element) => target.closest('[role="grid"]') === element;
    const synchronize = () => {
      const active = navigation.getSnapshot();
      const unloaded =
        active?.region === "body" &&
        (active.rowId === undefined || latest.current.findRowIndex(active.rowId) === undefined);
      const id =
        active === undefined
          ? undefined
          : active.region === "header"
            ? headerDomId(adapter.instanceId, active.columnId)
            : unloaded || active.rowId === undefined
              ? unloadedCellDomId(adapter.instanceId, tableId, active.rowIndex, active.columnId)
              : cellDomId(adapter.instanceId, tableId, active.rowId, active.columnId);
      const mounted = id === undefined ? null : document.getElementById(id);
      let target = mounted !== null && element.contains(mounted) ? mounted : null;
      // Keep one value-free destination while a focused sparse coordinate is
      // outside the mounted window. Passive publications never reveal it.
      if (
        target === null &&
        unloaded &&
        active !== undefined &&
        element.contains(document.activeElement)
      ) {
        if (proxyRow === undefined) {
          proxyRow = document.createElement("div");
          proxyRow.setAttribute("role", "row");
          Object.assign(proxyRow.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clipPath: "inset(50%)",
            whiteSpace: "nowrap",
          });
          proxyCell = document.createElement("div");
          proxyCell.setAttribute("role", "gridcell");
          proxyRow.append(proxyCell);
          element.append(proxyRow);
        }
        const columnIndex = latest.current.adapter.columns.findIndex(
          (column) => column.columnId === active.columnId,
        );
        const label = `Loading ${latest.current.adapter.columns[columnIndex]?.headerName ?? active.columnId}`;
        proxyCell!.id = `${id}-proxy`;
        proxyCell!.setAttribute("aria-colindex", String(columnIndex + 1));
        proxyCell!.setAttribute("aria-label", label);
        if (proxyCell!.textContent !== label) proxyCell!.textContent = label;
        const rowIndex = String(active.rowIndex + 2);
        const owner = [
          ...element.querySelectorAll<HTMLElement>(`[role="row"][aria-rowindex="${rowIndex}"]`),
        ].find((row) => row !== proxyRow && owns(row));
        if (owner !== proxyOwner || ownedProxyId !== proxyCell!.id) releaseProxyOwnership();
        if (owner === undefined) {
          proxyRow.setAttribute("role", "row");
          proxyRow.setAttribute("aria-rowindex", rowIndex);
        } else {
          proxyRow.setAttribute("role", "presentation");
          proxyRow.removeAttribute("aria-rowindex");
          proxyOwner = owner;
          ownedProxyId = proxyCell!.id;
          const ids = (owner.getAttribute("aria-owns") ?? "")
            .split(" ")
            .filter((candidate) => candidate.length > 0 && candidate !== ownedProxyId);
          ids.push(ownedProxyId);
          const indexOf = (candidate: string) =>
            Number(document.getElementById(candidate)?.getAttribute("aria-colindex") ?? 0);
          ids.sort((left, right) => indexOf(left) - indexOf(right));
          const next = ids.join(" ");
          if (owner.getAttribute("aria-owns") !== next) owner.setAttribute("aria-owns", next);
        }
        target = proxyCell!;
      } else if (proxyRow !== undefined) {
        releaseProxyOwnership();
        proxyRow.remove();
        proxyRow = undefined;
        proxyCell = undefined;
      }
      const currentId = element.getAttribute("aria-activedescendant");
      if (target === null) {
        if (currentId !== null) element.removeAttribute("aria-activedescendant");
      } else if (currentId !== target.id) element.setAttribute("aria-activedescendant", target.id);
      if (highlighted !== target) {
        highlighted?.style.removeProperty("outline");
        highlighted?.style.removeProperty("outline-offset");
        highlighted = target;
        highlighted?.style.setProperty("outline", "2px solid currentColor");
        highlighted?.style.setProperty("outline-offset", "-2px");
      }
    };
    const suppressTabStops = (root: Element) => {
      const candidates = [
        ...(root.matches(interactive) ? [root] : []),
        ...root.querySelectorAll(interactive),
      ];
      for (const candidate of candidates) {
        if (candidate === element || !isInteractiveElement(candidate) || !owns(candidate)) continue;
        if (!authored.has(candidate)) authored.set(candidate, candidate.getAttribute("tabindex"));
        if (candidate.getAttribute("tabindex") !== "-1") {
          managedWrites.set(candidate, (managedWrites.get(candidate) ?? 0) + 1);
          candidate.setAttribute("tabindex", "-1");
        }
      }
    };
    // Native header controls declare tabIndex=-1. Only custom cell renderers
    // can introduce new interactive descendants; avoid walking ordinary cells.
    const suppressCustomTabStops = (root: Element) => {
      if (root.closest("[data-astryx-custom-cell]") !== null) suppressTabStops(root);
      else
        for (const cell of root.querySelectorAll("[data-astryx-custom-cell]"))
          suppressTabStops(cell);
    };
    const focus = (event: FocusEvent) => {
      const target = event.target;
      if (!isInteractiveElement(target) || !owns(target)) {
        focusedDescendant = undefined;
        return;
      }
      focusedDescendant = target === element ? undefined : target;
      if (target === element) navigation.activateForFocus();
      synchronize();
    };
    const pointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        !(target instanceof OwnerNode) ||
        !owns(target)
      )
        return;
      const cell = target.closest<HTMLElement>('[role="gridcell"], [role="columnheader"]');
      const columnId = cell?.dataset["astryxColumnId"];
      if (cell === null || cell === undefined || columnId === undefined) return;
      if (cell.getAttribute("role") === "columnheader") navigation.activateHeader(columnId);
      else {
        const rowId = cell.dataset["astryxRowId"];
        const loadingIndex = cell.dataset["astryxLoadingRowIndex"];
        const rowIndex =
          rowId === undefined
            ? loadingIndex === undefined
              ? undefined
              : Number(loadingIndex)
            : latest.current.findRowIndex(rowId);
        if (rowIndex !== undefined) navigation.activateBody(rowIndex, rowId, columnId);
      }
      const control = target.closest(interactive);
      if (control === null || control === element) {
        event.preventDefault();
        element.focus({ preventScroll: true });
      }
    };
    const customRoots = new Set(
      Array.from(element.querySelectorAll("[data-astryx-custom-cell]")).filter(owns),
    );
    const observer = new MutationObserver((records) => {
      rememberAuthoredChanges(records);
      let rootsChanged = false;
      for (const root of customRoots) {
        if (!element.contains(root) || !owns(root)) {
          customRoots.delete(root);
          rootsChanged = true;
        }
      }
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof OwnerNode)) continue;
          const addedRoots = node.matches("[data-astryx-custom-cell]")
            ? [node]
            : node.querySelectorAll("[data-astryx-custom-cell]");
          for (const root of addedRoots) {
            if (owns(root) && !customRoots.has(root)) {
              customRoots.add(root);
              rootsChanged = true;
            }
          }
        }
      }
      if (rootsChanged) observeRoots();
      for (const record of records) {
        if (record.type === "attributes") {
          if (
            record.target instanceof OwnerNode &&
            record.target.closest("[data-astryx-custom-cell]") !== null
          )
            suppressTabStops(record.target);
        } else {
          for (const node of record.addedNodes)
            if (node instanceof OwnerNode) suppressCustomTabStops(node);
        }
      }
      if (records.some((record) => record.removedNodes.length > 0)) {
        for (const [candidate, original] of authored) {
          if (
            !element.contains(candidate) ||
            !owns(candidate) ||
            candidate.closest("[data-astryx-custom-cell]") === null
          )
            restore(candidate, original);
        }
      }
      synchronize();
      if (
        focusedDescendant !== undefined &&
        !latest.current.isGestureActive() &&
        (!focusedDescendant.isConnected ||
          (records.some(
            (record) =>
              record.type === "attributes" &&
              record.target instanceof OwnerNode &&
              record.target.contains(focusedDescendant!),
          ) &&
            !usable(focusedDescendant))) &&
        (document.activeElement === document.body ||
          document.activeElement === focusedDescendant ||
          focusedDescendant.contains(document.activeElement)) &&
        isAstryxTableDocumentFocusChainActive(document)
      ) {
        focusedDescendant = undefined;
        element.focus({ preventScroll: true });
      }
    });
    const observeRoots = () => {
      // One observer, bounded roots. Geometry writes on the grid/cells are not
      // custom-control attribute changes and must not wake this boundary.
      rememberAuthoredChanges(observer.takeRecords());
      observer.disconnect();
      observer.observe(element, { childList: true, subtree: true });
      for (const root of customRoots) {
        observer.observe(root, {
          attributes: true,
          subtree: true,
          attributeFilter: [
            "tabindex",
            "href",
            "contenteditable",
            "controls",
            "disabled",
            "hidden",
            "inert",
            "aria-hidden",
            "aria-disabled",
            "class",
            "style",
          ],
        });
        const cell = root.closest('[role="gridcell"]');
        if (cell !== null)
          observer.observe(cell, {
            attributes: true,
            attributeFilter: ["class", "hidden", "inert", "aria-hidden", "aria-disabled"],
          });
      }
    };
    observeRoots();
    suppressCustomTabStops(element);
    synchronize();
    document.addEventListener("focusin", focus, true);
    element.addEventListener("pointerdown", pointer);
    const unsubscribe = navigation.subscribe(synchronize);
    const detachFrame = adapter.subscribeFrameCommit(synchronize);
    return () => {
      rememberAuthoredChanges(observer.takeRecords());
      observer.disconnect();
      for (const [candidate, original] of authored) restore(candidate, original);
      unsubscribe();
      detachFrame();
      document.removeEventListener("focusin", focus, true);
      element.removeEventListener("pointerdown", pointer);
      highlighted?.style.removeProperty("outline");
      highlighted?.style.removeProperty("outline-offset");
      releaseProxyOwnership();
      proxyRow?.remove();
    };
  }, [grid, navigation, tableId, adapter.instanceId, adapter.subscribeFrameCommit]);

  const ownsSurface = (event: AstryxTableHotkeyGesture) =>
    !event.defaultPrevented && event.target === grid.current;
  const reveal = () => {
    const active = navigation.getSnapshot();
    if (active !== undefined)
      latest.current.adapter.revealCell(
        active.rowIndex,
        active.columnId,
        active.region,
        active.rowId,
      );
  };
  const navigate: AstryxTableGridHotkeyCommands["navigate"] = (event, command) => {
    if (!ownsSurface(event)) return;
    event.preventDefault();
    if (latest.current.isGestureActive()) return;
    navigation.activateForFocus();
    navigation.navigate(command);
    reveal();
  };
  return {
    navigate,
    headerMenu: (event) => {
      const element = grid.current;
      if (element === null || event.defaultPrevented || latest.current.isGestureActive()) return;
      const target = event.target;
      const direct =
        target instanceof element.ownerDocument.defaultView!.Element
          ? target.closest<HTMLElement>("[data-astryx-column-menu-trigger]")
          : null;
      const active = navigation.getSnapshot();
      const header =
        active?.region === "header"
          ? element.ownerDocument.getElementById(headerDomId(adapter.instanceId, active.columnId))
          : null;
      const trigger =
        direct ??
        (ownsSurface(event)
          ? header?.querySelector<HTMLElement>("[data-astryx-column-menu-trigger]")
          : undefined);
      if (trigger !== null && trigger !== undefined && element.contains(trigger)) {
        trigger.focus({ preventScroll: true });
        if (requestAstryxTableHotkeyWorkflowAction(trigger)) event.preventDefault();
      }
    },
    page: (event, direction) => {
      const element = grid.current;
      if (element === null) return;
      navigate(event, {
        type: "page",
        rowDelta:
          direction *
          Math.max(
            1,
            Math.floor((element.clientHeight - ASTRYX_TABLE_ROW_HEIGHT) / ASTRYX_TABLE_ROW_HEIGHT),
          ),
      });
    },
    escape: (event) => {
      const element = grid.current;
      const target = event.target;
      if (
        !event.defaultPrevented &&
        element !== null &&
        target !== element &&
        target instanceof element.ownerDocument.defaultView!.Element &&
        element.contains(target)
      ) {
        event.preventDefault();
        element.focus({ preventScroll: true });
      }
    },
    shiftTab: (event) => {
      const element = grid.current;
      if (element !== null && event.target !== element) yieldTabStop(element);
    },
    activate: (event, intent, alt, shift) => {
      if (!ownsSurface(event) || latest.current.isGestureActive()) return;
      const active = navigation.getSnapshot();
      if (active?.region === "header") {
        if (intent === "f2") return;
        const command = latest.current.runtime.getColumnCommandSnapshot(active.columnId);
        const toggleFilter = () => {
          event.preventDefault();
          if (
            latest.current.runtime.dispatchGridCommand({
              type: command.filterActive ? "column.filter.clear" : "column.filter.reset",
              columnId: active.columnId,
            })
          ) {
            const label =
              latest.current.adapter.columns.find((column) => column.columnId === active.columnId)
                ?.headerName ?? active.columnId;
            latest.current.announce(
              `${label} filter ${command.filterActive ? "cleared" : "reset"}`,
            );
          }
        };
        const openFilter = () => {
          const element = grid.current!;
          const header = element.ownerDocument.getElementById(
            headerDomId(adapter.instanceId, active.columnId),
          );
          const trigger = header?.querySelector<HTMLElement>("[data-astryx-column-filter-trigger]");
          if (trigger && element.contains(trigger)) {
            trigger.focus({ preventScroll: true });
            if (requestAstryxTableHotkeyWorkflowAction(trigger)) event.preventDefault();
          }
        };
        if (alt) {
          if (shift && (command.filterActive || command.filterBaselineAvailable)) toggleFilter();
          else openFilter();
        } else if (command.sortable) {
          event.preventDefault();
          latest.current.runtime.toggleColumnSort(active.columnId, shift);
        } else if (command.filterActive || command.filterBaselineAvailable) toggleFilter();
        else openFilter();
        return;
      }
      if (intent === "space" || alt || shift) return;
      const element = grid.current!;
      const id = element.getAttribute("aria-activedescendant");
      const cell = id === null ? null : element.ownerDocument.getElementById(id);
      for (const candidate of cell?.querySelectorAll<InteractiveElement>(interactive) ?? []) {
        if (
          candidate.matches("iframe,object,embed") ||
          candidate.closest('[role="grid"]') !== element ||
          !usable(candidate)
        )
          continue;
        candidate.focus({ preventScroll: true });
        if (element.ownerDocument.activeElement === candidate) {
          event.preventDefault();
          break;
        }
      }
    },
  } satisfies Pick<
    AstryxTableGridHotkeyCommands,
    "navigate" | "page" | "escape" | "shiftTab" | "activate" | "headerMenu"
  >;
}
