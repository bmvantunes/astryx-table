import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  pixel,
  useTableStickyColumns,
  type TableColumn,
  type HeaderCellRenderProps,
  type BodyCellRenderProps,
} from "@astryxdesign/core/Table";
import { astryxTableColumnCssVariable } from "./column-management";
import type { AstryxTableViewportAdapterState } from "./react-compiler-adapters";

export const nativeTableAppearance = {
  density: "compact",
  dividers: "rows",
  isStriped: false,
  hasHover: false,
  verticalAlign: "middle",
  textOverflow: "truncate",
} as const;

export type NativePinnedPresentation = Readonly<{
  header: HeaderCellRenderProps;
  body: BodyCellRenderProps;
}>;

// Native Table owns cell styling/shadows. The viewport remains the only geometry owner.
export function useNativeTablePresentation(adapter: AstryxTableViewportAdapterState) {
  const {
    columns,
    viewportSnapshot: { virtualWindow: window },
  } = adapter;
  const { pinnedStart, pinnedEnd } = window;
  const plugin = useTableStickyColumns({
    startKeys: pinnedStart.map((column) => column.columnId),
    endKeys: pinnedEnd.map((column) => column.columnId),
  });
  const presentation = useMemo(() => {
    // Astryx interprets pin keys as contiguous prefix/suffix boundaries. Make
    // that contract explicit here, independently of the incoming projection.
    const pinnedIds = new Set([...pinnedStart, ...pinnedEnd].map((column) => column.columnId));
    const nativeOrder = [
      ...pinnedStart,
      ...columns.filter((column) => !pinnedIds.has(column.columnId)),
      ...pinnedEnd,
    ];
    const nativeColumns: TableColumn<Record<string, unknown>>[] = nativeOrder.map((column) => ({
      key: column.columnId,
      header: column.headerName,
      width: pixel(column.semantics.width),
    }));
    const pinned = new Map<string, NativePinnedPresentation>();
    for (const [side, region] of [
      ["start", pinnedStart],
      ["end", pinnedEnd],
    ] as const) {
      for (const column of region) {
        const index = nativeOrder.indexOf(column);
        const native = nativeColumns[index];
        if (native === undefined) continue;
        const base = { htmlProps: {}, xstyle: [], columns: nativeColumns };
        const header: HeaderCellRenderProps =
          plugin.transformHeaderCell?.(base, native, index, nativeColumns) ?? base;
        const body: BodyCellRenderProps =
          plugin.transformBodyCell?.(base, native, {}, 0, nativeColumns) ?? base;
        const offset = side === "start" ? "insetInlineStart" : "insetInlineEnd";
        // Resize previews publish these variables without waking React subscribers.
        const variable = astryxTableColumnCssVariable(
          side === "start" ? "pinned-start-offset" : "pinned-end-offset",
          column.columnId,
        );
        pinned.set(column.columnId, {
          header: {
            ...header,
            htmlProps: {
              ...header.htmlProps,
              style: {
                ...header.htmlProps.style,
                [offset]: `var(${variable}, ${header.htmlProps.style?.[offset] ?? "0px"})`,
              },
            },
          },
          body: {
            ...body,
            htmlProps: {
              ...body.htmlProps,
              style: {
                ...body.htmlProps.style,
                [offset]: `var(${variable}, ${body.htmlProps.style?.[offset] ?? "0px"})`,
              },
            },
          },
        });
      }
    }
    return pinned;
  }, [columns, pinnedStart, pinnedEnd, plugin]);
  const element = useRef<HTMLDivElement | null>(null);
  const attachViewport = adapter.attach;
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      element.current = node;
      attachViewport(node);
    },
    [attachViewport],
  );
  useLayoutEffect(() => {
    const shadowRef = plugin.transformScrollWrapper?.({ htmlProps: {}, xstyle: [] }).htmlProps.ref;
    // The plugin may replace its merged ref when pinning changes. Reconnect only
    // its shadow listener, never the viewport (which owns scroll/segment state).
    if (typeof shadowRef !== "function") return;
    shadowRef(element.current);
    return () => {
      shadowRef(null);
    };
  }, [plugin]);
  return { presentation, attach };
}

export function cellDomId(instanceId: string, tableId: string, rowId: string, columnId: string) {
  return `astryx-table-cell-${encode(instanceId)}-${encode(tableId)}-${encode(rowId)}-${encode(columnId)}`;
}
// Fixed-width UTF-16 preserves even lone surrogates and avoids delimiter collisions.
const encodedSegments = new Map<string, string>();
function encode(value: string): string {
  const cached = encodedSegments.get(value);
  if (cached !== undefined) return cached;
  let encoded = "";
  for (let index = 0; index < value.length; index++)
    encoded += value.charCodeAt(index).toString(16).padStart(4, "0");
  if (encodedSegments.size >= 16_384) {
    const oldest = encodedSegments.keys().next().value;
    if (oldest !== undefined) encodedSegments.delete(oldest);
  }
  encodedSegments.set(value, encoded);
  return encoded;
}
