import { memo, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@astryxdesign/core/Button";
import { usePopover } from "@astryxdesign/core/Popover";
import { recordAstryxTableActiveFilterRender } from "./internal/active-filter-instrumentation";
import { useClientContext } from "./internal/client-context";
import type {
  AstryxTableFilterSnapshot,
  AstryxTableRowPipelineRuntimeView,
} from "./internal/grid-runtime";
import { normalizeAstryxTableFilterText } from "./internal/grid-query";

const WINDOW_SIZE = 64;
const styles = stylex.create({
  review: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: 360,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "min(480px, 70vh)",
    overflowY: "auto",
  },
  entry: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { overflowWrap: "anywhere", minWidth: 0 },
  navigation: { display: "flex", gap: 4 },
});
function quickFilterActive(snapshot: AstryxTableFilterSnapshot) {
  return normalizeAstryxTableFilterText(snapshot.quickFilter).length > 0;
}
/** Reviews and removes committed filters across visible and hidden Client columns. */
export const AstryxTableActiveFilters = memo(function AstryxTableActiveFilters() {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableActiveFilterRender("trigger");
  const { runtime } = useClientContext();
  const count = useSyncExternalStore(
    runtime.subscribeActiveFilterCount,
    runtime.getActiveFilterCountSnapshot,
    runtime.getActiveFilterCountSnapshot,
  );
  const { triggerRef, triggerProps, toggle, hide, isOpen, render } = usePopover({
    lazyMount: true,
    dialogLabel: "Active filters",
    padding: 3,
  });
  useLayoutEffect(() => {
    if (count === 0 && isOpen) hide();
  }, [count, hide, isOpen]);
  return (
    <>
      <Button
        ref={triggerRef}
        {...triggerProps}
        label={`Filters ${String(count)}`}
        aria-label={`Active filters (${String(count)})`}
        isDisabled={count === 0}
        tooltip={count === 0 ? "No active filters" : undefined}
        tabIndex={count === 0 ? -1 : undefined}
        size="sm"
        variant="ghost"
        onClick={() => {
          if (count > 0) toggle();
        }}
      />
      {render(isOpen && count > 0 ? <ActiveFilterReview runtime={runtime} /> : null)}
    </>
  );
});

type Entry = Readonly<{ key: string; label: string; columnId?: string }>;
const ActiveFilterReview = memo(function ActiveFilterReview({
  runtime,
}: {
  readonly runtime: AstryxTableRowPipelineRuntimeView;
}) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableActiveFilterRender("review");
  const snapshot = useSyncExternalStore(
    runtime.subscribeFilter,
    runtime.getFilterSnapshot,
    runtime.getFilterSnapshot,
  );
  const entries = useMemo(() => {
    const next: Entry[] = [];
    if (quickFilterActive(snapshot)) {
      const text = JSON.stringify(snapshot.quickFilter);
      next.push({
        key: "quick",
        label: `Quick Filter contains ${text.length > 512 ? `${text.slice(0, 511)}…` : text}`,
      });
    }
    for (const column of snapshot.columns) {
      if (snapshot.filtersByColumn.get(column.columnId) !== undefined)
        next.push({
          key: column.columnId,
          columnId: column.columnId,
          label: snapshot.activeFilterLabelsByColumn.get(column.columnId) ?? column.headerName,
        });
    }
    return next;
  }, [snapshot]);
  const [windowStart, setWindowStart] = useState(0);
  const maxStart = Math.max(0, entries.length - WINDOW_SIZE);
  const start = Math.min(windowStart, maxStart);
  const end = Math.min(start + WINDOW_SIZE, entries.length);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusRequest = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const key = focusRequest.current;
    focusRequest.current = undefined;
    if (key !== undefined) buttons.current.get(key)?.focus({ preventScroll: true });
  }, [entries, start]);
  const remove = (entry: Entry) => {
    const index = entries.indexOf(entry);
    const next = entries[index + 1] ?? entries[index - 1];
    const accepted = runtime.dispatchGridCommand(
      entry.columnId === undefined
        ? { type: "quick-filter.replace", text: "" }
        : { type: "column.filter.clear", columnId: entry.columnId },
    );
    if (!accepted) return;
    focusRequest.current = next?.key;
    setWindowStart(
      Math.floor(Math.max(0, Math.min(index, entries.length - 2)) / WINDOW_SIZE) * WINDOW_SIZE,
    );
  };
  return (
    <div {...stylex.props(styles.review)}>
      <p>Review filters across visible and hidden columns.</p>
      {entries.slice(start, end).map((entry) => (
        <div key={entry.key} {...stylex.props(styles.entry)}>
          <span {...stylex.props(styles.label)}>{entry.label}</span>
          <Button
            ref={(node) => {
              if (node === null) buttons.current.delete(entry.key);
              else buttons.current.set(entry.key, node);
            }}
            label={`Remove ${entry.label}`}
            isIconOnly
            icon={<span aria-hidden="true">×</span>}
            size="sm"
            variant="ghost"
            onClick={() => remove(entry)}
          />
        </div>
      ))}
      {entries.length > WINDOW_SIZE ? (
        <>
          <span role="status">{`Showing filters ${String(start + 1)}–${String(end)} of ${String(entries.length)}`}</span>
          <div {...stylex.props(styles.navigation)}>
            <Button
              label="Previous active filters"
              size="sm"
              variant="ghost"
              isDisabled={start === 0}
              onClick={() => setWindowStart(Math.max(0, start - WINDOW_SIZE))}
            />
            <Button
              label="Next active filters"
              size="sm"
              variant="ghost"
              isDisabled={end === entries.length}
              onClick={() => setWindowStart(Math.min(maxStart, start + WINDOW_SIZE))}
            />
          </div>
        </>
      ) : null}
      {entries.some((entry) => entry.columnId !== undefined) ? (
        <Button
          label="Clear all Grid Filters"
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!runtime.dispatchGridCommand({ type: "column.filters.clear" })) return;
            setWindowStart(0);
            focusRequest.current = quickFilterActive(snapshot) ? "quick" : undefined;
          }}
        />
      ) : null}
    </div>
  );
});
