import { recordAstryxTableSortControlRender } from "./sort-control-instrumentation";
import { memo, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@astryxdesign/core/Button";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { Selector } from "@astryxdesign/core/Selector";
import { List, ListItem } from "@astryxdesign/core/List";
import { usePopover } from "@astryxdesign/core/Popover";
import type { CompiledColumn } from "./compile-columns";
import type { AstryxTableRuntimeView } from "./grid-runtime";

const WINDOW_SIZE = 64;
const styles = stylex.create({
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 },
  panel: {
    width: 460,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "min(480px, 70vh)",
    overflowY: "auto",
  },
});
type Props = {
  readonly runtime: AstryxTableRuntimeView;
  readonly columns: readonly CompiledColumn[];
};

/** Count-only side control; the detailed review mounts on demand. */
export const SortControls = memo(function SortControls({ runtime, columns }: Props) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableSortControlRender("trigger");
  const count = useSyncExternalStore(
    runtime.subscribeActiveSortCount,
    runtime.getActiveSortCountSnapshot,
    runtime.getActiveSortCountSnapshot,
  );
  const { triggerRef, triggerProps, toggle, isOpen, render } = usePopover({
    lazyMount: true,
    dialogLabel: "Sort rows",
    padding: 3,
  });
  return (
    <>
      <Button
        ref={triggerRef}
        {...triggerProps}
        label={`Sort rows, ${String(count)} active`}
        isIconOnly
        icon={<span aria-hidden="true">↕{count}</span>}
        size="sm"
        variant="ghost"
        onClick={toggle}
      />
      {render(isOpen ? <SortReview runtime={runtime} columns={columns} /> : null)}
    </>
  );
});

const SortReview = memo(function SortReview({ runtime, columns }: Props) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableSortControlRender("review");
  const orderBy = useSyncExternalStore(
    runtime.subscribeSorting,
    runtime.getSortingSnapshot,
    runtime.getSortingSnapshot,
  );
  const grouping = useSyncExternalStore(
    runtime.subscribeInstalledGroupingStructure,
    runtime.getInstalledGroupingStructureSnapshot,
    runtime.getInstalledGroupingStructureSnapshot,
  );
  const sortColumns = grouping.columns ?? columns;
  const [announcement, setAnnouncement] = useState({ sequence: 0, message: "" });
  const announce = (message: string) =>
    setAnnouncement((previous) => ({ sequence: previous.sequence + 1, message }));
  const [windowStart, setWindowStart] = useState(0);
  const maxStart = Math.floor(Math.max(0, orderBy.length - 1) / WINDOW_SIZE) * WINDOW_SIZE;
  const start = Math.min(windowStart, maxStart);
  const end = Math.min(start + WINDOW_SIZE, orderBy.length);
  const panel = useRef<HTMLDivElement>(null);
  const focusedControl = useRef<
    Readonly<{ node: HTMLButtonElement; index: number; isPager: boolean }> | undefined
  >(undefined);
  const controls = useRef(new Map<string, HTMLButtonElement>());
  const focusRequest = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const key = focusRequest.current;
    focusRequest.current = undefined;
    let control = key === undefined ? undefined : controls.current.get(key);
    const previous = focusedControl.current;
    if (previous?.isPager && previous.node.isConnected) {
      focusedControl.current = { ...previous, index: start };
    }
    const root = panel.current;
    if (
      control === undefined &&
      previous !== undefined &&
      !previous.node.isConnected &&
      root !== null
    ) {
      const active = root.ownerDocument.activeElement;
      if (active === root.ownerDocument.body || active === root.closest('[role="dialog"]')) {
        const index = Math.max(start, Math.min(previous.index, end - 1));
        const next = orderBy[index];
        if (next !== undefined) control = controls.current.get(`direction:${next.columnId}`);
      }
    }
    control?.focus({ preventScroll: true });
    control?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [orderBy, start, end]);
  const activeIds = new Set(orderBy.map((sort) => sort.columnId));
  const eligible = sortColumns.filter(
    (column) =>
      (grouping.columns === undefined
        ? column.enableSorting !== false
        : runtime.getColumnCommandSnapshot(column.columnId).sortable) &&
      !activeIds.has(column.columnId),
  );
  const bind = (key: string) => (node: HTMLButtonElement | null) => {
    if (node === null) controls.current.delete(key);
    else controls.current.set(key, node);
  };
  const move = (columnId: string, delta: -1 | 1) => {
    const current = runtime.getSortingSnapshot();
    const index = current.findIndex((sort) => sort.columnId === columnId);
    if (index < 0 || index + delta < 0 || index + delta >= current.length) return;
    focusRequest.current = `${delta === -1 ? "earlier" : "later"}:${columnId}`;
    if (
      !runtime.dispatchGridCommand({ type: "sorting.move", columnId, targetIndex: index + delta })
    )
      focusRequest.current = undefined;
    else {
      setWindowStart(Math.floor((index + delta) / WINDOW_SIZE) * WINDOW_SIZE);
      announce(`${names.get(columnId) ?? columnId} moved to priority ${String(index + delta + 1)}`);
    }
  };
  const remove = (columnId: string) => {
    const current = runtime.getSortingSnapshot();
    const index = current.findIndex((sort) => sort.columnId === columnId);
    if (index < 0 || current.length === 1) return;
    const next = current[index + 1] ?? current[index - 1];
    focusRequest.current = next === undefined ? undefined : `direction:${next.columnId}`;
    if (!runtime.dispatchGridCommand({ type: "sorting.remove", columnId }))
      focusRequest.current = undefined;
    else {
      setWindowStart(Math.floor(Math.min(index, current.length - 2) / WINDOW_SIZE) * WINDOW_SIZE);
      announce(`Removed ${names.get(columnId) ?? columnId} sort`);
    }
  };
  const names = new Map<string, string>(
    sortColumns.map((column) => [column.columnId, column.headerName]),
  );
  return (
    <div
      ref={panel}
      {...stylex.props(styles.panel)}
      onFocusCapture={(event) => {
        const entry = [...controls.current].find(
          ([, node]) => node === event.currentTarget.ownerDocument.activeElement,
        );
        if (entry === undefined) {
          focusedControl.current = undefined;
          return;
        }
        const columnId = entry[0].slice(entry[0].indexOf(":") + 1);
        focusedControl.current = {
          node: entry[1],
          isPager: entry[0].startsWith("pager:"),
          index: entry[0].startsWith("pager:")
            ? start
            : orderBy.findIndex((sort) => sort.columnId === columnId),
        };
      }}
      onBlurCapture={(event) => {
        if (
          event.target.isConnected &&
          (event.relatedTarget === null || !event.currentTarget.contains(event.relatedTarget))
        )
          focusedControl.current = undefined;
      }}
    >
      <p>Change direction and priority. At least one sort always remains active.</p>
      <List
        aria-label="Active sorts"
        listStyle="decimal"
        start={start + 1}
        density="compact"
        hasDividers
      >
        {orderBy.slice(start, end).map((sort, offset) => {
          const index = start + offset;
          const name = names.get(sort.columnId) ?? sort.columnId;
          const direction = sort.direction === "asc" ? "ascending" : "descending";
          return (
            <ListItem
              key={sort.columnId}
              aria-label={`Priority ${String(index + 1)}, ${name}, ${direction}`}
              label={name}
              endContent={
                <div {...stylex.props(styles.actions)}>
                  <Button
                    ref={bind(`direction:${sort.columnId}`)}
                    label={sort.direction === "asc" ? "Ascending" : "Descending"}
                    aria-label={`Toggle ${name} direction, currently ${direction}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (
                        runtime.dispatchGridCommand({
                          type: "column.sort.toggle",
                          columnId: sort.columnId,
                          multi: true,
                        })
                      )
                        announce(
                          `${name}, ${sort.direction === "asc" ? "descending" : "ascending"}`,
                        );
                    }}
                  />
                  <Button
                    ref={bind(`earlier:${sort.columnId}`)}
                    label={`Move ${name} earlier`}
                    isIconOnly
                    icon={<span aria-hidden="true">↑</span>}
                    size="sm"
                    variant="ghost"
                    isDisabled={index === 0}
                    tooltip={index === 0 ? "Already the first priority" : undefined}
                    onClick={() => move(sort.columnId, -1)}
                  />
                  <Button
                    ref={bind(`later:${sort.columnId}`)}
                    label={`Move ${name} later`}
                    isIconOnly
                    icon={<span aria-hidden="true">↓</span>}
                    size="sm"
                    variant="ghost"
                    isDisabled={index === orderBy.length - 1}
                    tooltip={index === orderBy.length - 1 ? "Already the last priority" : undefined}
                    onClick={() => move(sort.columnId, 1)}
                  />
                  <Button
                    ref={bind(`remove:${sort.columnId}`)}
                    label={`Remove ${name} sort`}
                    isIconOnly
                    icon={<span aria-hidden="true">×</span>}
                    size="sm"
                    variant="ghost"
                    isDisabled={orderBy.length === 1}
                    tooltip={orderBy.length === 1 ? "At least one sort must remain" : undefined}
                    onClick={() => remove(sort.columnId)}
                  />
                </div>
              }
            />
          );
        })}
      </List>
      {orderBy.length > WINDOW_SIZE ? (
        <>
          <span role="status">{`Showing sorts ${String(start + 1)}–${String(end)} of ${String(orderBy.length)}`}</span>
          <div {...stylex.props(styles.actions)}>
            <Button
              ref={bind("pager:previous")}
              label="Previous sorts"
              size="sm"
              variant="ghost"
              isDisabled={start === 0}
              tooltip={start === 0 ? "First sort window" : undefined}
              onClick={() => setWindowStart(Math.max(0, start - WINDOW_SIZE))}
            />
            <Button
              ref={bind("pager:next")}
              label="Next sorts"
              size="sm"
              variant="ghost"
              isDisabled={end === orderBy.length}
              tooltip={end === orderBy.length ? "Last sort window" : undefined}
              onClick={() => setWindowStart(Math.min(maxStart, start + WINDOW_SIZE))}
            />
          </div>
        </>
      ) : null}
      <Selector
        label="Add sort column"
        isLabelHidden
        placeholder="Add sort"
        hasSearch
        presentation="popover"
        size="sm"
        value=""
        options={eligible.map((column) => ({ value: column.columnId, label: column.headerName }))}
        isDisabled={eligible.length === 0}
        disabledMessage={
          eligible.length === 0 ? "All sortable columns are already active" : undefined
        }
        onChange={(columnId) => {
          if (runtime.dispatchGridCommand({ type: "sorting.add", columnId }))
            announce(`Added ${names.get(columnId) ?? columnId} sort`);
        }}
      />
      <Button
        label="Reset sorting"
        size="sm"
        variant="ghost"
        onClick={() => {
          if (runtime.dispatchGridCommand({ type: "sorting.reset" })) {
            setWindowStart(0);
            announce("Sorting reset");
          }
        }}
      />
      <VisuallyHidden role="status" aria-label="Sorting status">
        <span key={announcement.sequence}>{announcement.message}</span>
      </VisuallyHidden>
    </div>
  );
});
