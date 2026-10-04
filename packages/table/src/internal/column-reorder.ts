import {
  projectAstryxTableLogicalColumnIndex,
  resolveAstryxTableReorderCenterBounds,
  resolveAstryxTableReorderTargetIndex,
} from "./column-geometry";
import { astryxTableColumnCssVariable } from "./column-management";
import { recordAstryxTableClientColumnPreviewStyleWrite } from "./render-instrumentation";
import type { AstryxTableViewportAdapterState } from "./react-compiler-adapters";
import type { AstryxTableRuntimeView } from "./grid-runtime";

// Geometry and preview belong to the gesture owner, not React state. Stable
// logical indexes keep a virtual window's edge from becoming a drop boundary.
export function createColumnReorder({
  grid,
  adapter,
  runtime,
  columnId,
  startX,
  direction,
  origin,
}: {
  grid: HTMLDivElement;
  origin: HTMLElement;
  adapter: AstryxTableViewportAdapterState;
  runtime: AstryxTableRuntimeView;
  columnId: string;
  startX: number;
  direction: "ltr" | "rtl";
}) {
  const { columns } = runtime.getColumnLayoutSnapshot();
  const indexes = new Map<string, number>(columns.map((column, index) => [column.columnId, index]));
  const sourceIndex = indexes.get(columnId)!;
  const source = columns[sourceIndex]!;
  const hasRemainingCentre = columns.some(
    (column, index) => index !== sourceIndex && column.pinned === undefined,
  );
  const suspended = adapter.viewportSnapshot.virtualWindow.pinningSuspended;
  const properties = new Map<string, string>();
  let ownsFocus = true;
  const onFocus = (event: FocusEvent) => {
    if (event.target !== origin && event.target !== grid) ownsFocus = false;
  };
  const onBlur = () => {
    ownsFocus = false;
  };
  grid.ownerDocument.addEventListener("focusin", onFocus, true);
  grid.ownerDocument.defaultView?.addEventListener("blur", onBlur);

  const readGeometry = () =>
    Array.from(grid.querySelectorAll<HTMLElement>('[role="columnheader"][data-astryx-column-id]'))
      .flatMap((element) => {
        const columnIndex = indexes.get(element.dataset["astryxColumnId"]!);
        if (columnIndex === undefined) return [];
        const { left, right, width } = element.getBoundingClientRect();
        return [{ element, columnIndex, left, right, width }];
      })
      .sort((a, b) => a.columnIndex - b.columnIndex);
  let geometry = readGeometry();
  const measured = new Map(geometry.map((cell) => [cell.columnIndex, cell]));
  const anchor = geometry.find(
    (cell) => suspended || columns[cell.columnIndex]?.pinned === undefined,
  );
  const initialScrollLeft = grid.scrollLeft;
  const offsets = [0];
  for (const column of columns) offsets.push(offsets[offsets.length - 1]! + column.semantics.width);
  const refreshGeometry = (nativeScrollLeft: number, windowChanged: boolean) => {
    const mounted = windowChanged
      ? Array.from(
          grid.querySelectorAll<HTMLElement>('[role="columnheader"][data-astryx-column-id]'),
        ).flatMap((element) => {
          const columnIndex = indexes.get(element.dataset["astryxColumnId"]!);
          return columnIndex === undefined ? [] : [{ element, columnIndex }];
        })
      : geometry;
    // Layout changes cancel this gesture. Widths and pinned boundaries therefore
    // remain stable; only the native scroll delta and mounted identities change.
    // Do not clear transforms then force layout reads across the entire grid.
    geometry = mounted
      .flatMap(({ element, columnIndex }) => {
        const column = columns[columnIndex]!;
        if (!suspended && column.pinned !== undefined) {
          const pinned = measured.get(columnIndex);
          return pinned === undefined ? [] : [{ ...pinned, element }];
        }
        if (anchor === undefined) return [];
        const width = column.semantics.width;
        const offset = offsets[columnIndex]! - offsets[anchor.columnIndex]!;
        const scrollDelta = nativeScrollLeft - initialScrollLeft;
        const left =
          direction === "rtl"
            ? anchor.right - offset - scrollDelta - width
            : anchor.left + offset - scrollDelta;
        return [{ element, columnIndex, left, right: left + width, width }];
      })
      .sort((a, b) => a.columnIndex - b.columnIndex);
    if (windowChanged) {
      const mountedProperties = new Set(
        geometry.map((cell) =>
          astryxTableColumnCssVariable("transform", columns[cell.columnIndex]!.columnId),
        ),
      );
      for (const property of properties.keys()) {
        if (mountedProperties.has(property)) continue;
        grid.style.removeProperty(property);
        properties.delete(property);
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
          recordAstryxTableClientColumnPreviewStyleWrite(property);
      }
    }
  };
  const startRects = suspended
    ? []
    : geometry.filter((cell) => columns[cell.columnIndex]?.pinned === "start");
  const endRects = suspended
    ? []
    : geometry.filter((cell) => columns[cell.columnIndex]?.pinned === "end");
  const bounds = resolveAstryxTableReorderCenterBounds(
    direction,
    grid.getBoundingClientRect(),
    direction === "rtl" ? endRects : startRects,
    direction === "rtl" ? startRects : endRects,
  );
  let targetIndex = sourceIndex;
  let targetPinned = source.pinned;
  let scrollLeft = grid.scrollLeft;
  let columnWindow = adapter.getHeaderColumnWindowSnapshot();
  let frameVersion = 0;
  let awaitingFrame: number | undefined;
  const detachFrame = adapter.subscribeFrameCommit(() => {
    frameVersion += 1;
  });
  const isWindowCommitted = () => {
    const expected = adapter.getHeaderColumnWindowSnapshot().center;
    const mounted = new Set(
      Array.from(
        grid.querySelectorAll<HTMLElement>('[role="columnheader"][data-astryx-column-id]'),
        (element) => element.dataset["astryxColumnId"],
      ),
    );
    return expected.every((column) => mounted.has(column.columnId));
  };
  const clear = () => {
    for (const property of properties.keys()) {
      grid.style.removeProperty(property);
      if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
        recordAstryxTableClientColumnPreviewStyleWrite(property);
    }
    properties.clear();
  };
  const targetPin = (x: number) => {
    if (x < bounds.left) return direction === "rtl" ? ("end" as const) : ("start" as const);
    if (x > bounds.right) return direction === "rtl" ? ("start" as const) : ("end" as const);
    // In an active sticky layout the physical centre remains an unpinned drop zone,
    // including the trailing half of its last column and any viewport-fill gap.
    if (!suspended) return undefined;
    // Suspended pinning retains logical regions. Releasing inside the source
    // region must not inherit the adjacent centre column's unpinned state.
    const sourceRect = geometry.find((cell) => cell.columnIndex === sourceIndex);
    if (sourceRect !== undefined && x >= sourceRect.left && x <= sourceRect.right)
      return source.pinned;
    const remaining = geometry.filter((cell) => cell.columnIndex !== sourceIndex);
    if (!hasRemainingCentre) return source.pinned;
    const reference =
      remaining.find((cell) =>
        direction === "rtl" ? x > cell.left + cell.width / 2 : x < cell.left + cell.width / 2,
      ) ?? remaining.at(-1);
    return columns[reference?.columnIndex ?? targetIndex]?.pinned;
  };
  return {
    preview(x: number, allowAutoScroll = true): boolean {
      if (
        allowAutoScroll &&
        ((awaitingFrame !== undefined && awaitingFrame === frameVersion) || !isWindowCommitted())
      )
        return true;
      awaitingFrame = undefined;
      // Scroll before publishing preview CSS variables. The native scroll setter
      // may flush layout; writing transforms first would force their full-grid
      // style invalidation into this same callback.
      const physicalDelta =
        x >= bounds.left && x < bounds.left + 48
          ? -64
          : x <= bounds.right && x > bounds.right - 48
            ? 64
            : 0;
      const didScroll =
        allowAutoScroll && adapter.scrollByLogical(physicalDelta * (direction === "rtl" ? -1 : 1));
      if (didScroll) awaitingFrame = frameVersion;
      const nextWindow = adapter.getHeaderColumnWindowSnapshot();
      const nativeScrollLeft = grid.scrollLeft;
      if (nativeScrollLeft !== scrollLeft || nextWindow !== columnWindow) {
        refreshGeometry(nativeScrollLeft, nextWindow !== columnWindow);
        scrollLeft = nativeScrollLeft;
        columnWindow = nextWindow;
      }
      targetIndex = resolveAstryxTableReorderTargetIndex(
        geometry,
        x,
        direction,
        sourceIndex,
        0,
        columns.length - 1,
      );
      targetPinned = targetPin(x);
      for (const cell of geometry) {
        const column = columns[cell.columnIndex]!;
        const shift =
          projectAstryxTableLogicalColumnIndex(cell.columnIndex, sourceIndex, targetIndex) -
          cell.columnIndex;
        const delta =
          cell.columnIndex === sourceIndex
            ? x -
              startX +
              (suspended || source.pinned === undefined ? nativeScrollLeft - initialScrollLeft : 0)
            : shift * source.semantics.width * (direction === "rtl" ? -1 : 1);
        const value = delta === 0 ? "none" : `translate3d(${delta}px, 0, 0)`;
        const property = astryxTableColumnCssVariable("transform", column.columnId);
        if (properties.get(property) === value) continue;
        grid.style.setProperty(property, value);
        properties.set(property, value);
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
          recordAstryxTableClientColumnPreviewStyleWrite(property);
      }
      return didScroll;
    },
    finish(commit: boolean, x: number) {
      detachFrame();
      grid.ownerDocument.removeEventListener("focusin", onFocus, true);
      grid.ownerDocument.defaultView?.removeEventListener("blur", onBlur);
      if (commit && (x !== startX || grid.scrollLeft !== initialScrollLeft)) {
        // A stationary click is not a drop. Autoscroll can still change the
        // logical destination when physical X returns to its starting coordinate.
        this.preview(x, false);
        if (targetIndex !== sourceIndex || targetPinned !== source.pinned)
          runtime.dispatchGridCommand({
            type: "column.reorder.commit",
            columnId,
            targetIndex,
            pinned: targetPinned,
          });
      }
      clear();
      return ownsFocus;
    },
  };
}
