import { registerAstryxTableGroupingFocusOwner } from "./client-grouping-focus";
import { useAstryxTableGroupByHotkeys } from "./hotkey-adapter";
import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import * as stylex from "@stylexjs/stylex";
import type { AstryxTableRuntimeView } from "./grid-runtime";

const styles = stylex.create({
  region: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, paddingBlock: 8 },
  list: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  chip: { display: "flex", alignItems: "center", gap: 2 },
});

export const GroupingControls = memo(function GroupingControls({
  runtime,
  scope,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly scope: RefObject<HTMLElement | null>;
}) {
  const { groupBy } = useSyncExternalStore(
    runtime.subscribeInstalledGroupingStructure,
    runtime.getInstalledGroupingStructureSnapshot,
    runtime.getInstalledGroupingStructureSnapshot,
  );
  const getColumns = useCallback(() => runtime.getQuerySnapshot().columns, [runtime]);
  const columns = useSyncExternalStore(runtime.subscribeQuery, getColumns, getColumns);
  const region = useRef<HTMLDivElement>(null);
  const pickerId = useId();
  const helpId = useId();
  const chips = useRef(new Map<string, HTMLButtonElement>());
  const focusedControl = useRef<Readonly<{ node: HTMLButtonElement; index: number }> | undefined>(
    undefined,
  );
  const focusRequest = useRef<Readonly<{ columnId?: string }> | undefined>(undefined);
  const focusOwner = useMemo(
    () => ({
      prepareRemoval: (columnId: string): (() => void) => {
        const index = groupBy.indexOf(columnId);
        if (index < 0) return () => undefined;
        const next = groupBy[index + 1] ?? groupBy[index - 1];
        const request = next === undefined ? {} : { columnId: next };
        focusRequest.current = request;
        return () => {
          if (focusRequest.current === request) focusRequest.current = undefined;
        };
      },
    }),
    [groupBy],
  );
  useLayoutEffect(
    () => registerAstryxTableGroupingFocusOwner(runtime, focusOwner),
    [runtime, focusOwner],
  );
  const [announcement, setAnnouncement] = useState({ sequence: 0, message: "" });
  const announce = (message: string) =>
    setAnnouncement((previous) => ({ sequence: previous.sequence + 1, message }));
  const eligible = columns.filter((column) => column.kind === "field" && column.groupBy);
  const names = new Map<string, string>(
    eligible.map((column) => [column.columnId, column.headerName]),
  );
  const inactive = eligible.filter((column) => !groupBy.includes(column.columnId));
  useLayoutEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = undefined;
    let element =
      request === undefined
        ? undefined
        : request.columnId === undefined
          ? region.current?.ownerDocument.getElementById(pickerId)
          : chips.current.get(request.columnId);
    const previous = focusedControl.current;
    if (element === undefined && previous !== undefined && !previous.node.isConnected) {
      const document = previous.node.ownerDocument;
      if (document.hasFocus() && document.activeElement === document.body) {
        const next = groupBy[Math.min(previous.index, groupBy.length - 1)];
        element =
          next === undefined
            ? (document.getElementById(pickerId) ??
              scope.current?.querySelector<HTMLElement>('[role="grid"]'))
            : chips.current.get(next);
      }
    }
    element?.focus({ preventScroll: true });
  }, [groupBy, columns, pickerId, scope]);
  useAstryxTableGroupByHotkeys(region, (direction) => {
    const focused = region.current?.ownerDocument.activeElement;
    const index = groupBy.findIndex((columnId) => chips.current.get(columnId) === focused);
    const columnId = groupBy[index];
    const target = index + direction;
    if (columnId === undefined || target < 0 || target >= groupBy.length) return false;
    if (!runtime.dispatchGridCommand({ type: "grouping.move", columnId, direction })) return false;
    announce(
      `${names.get(columnId) ?? columnId} moved to position ${String(target + 1)} of ${String(groupBy.length)}`,
    );
    return true;
  });
  if (eligible.length === 0) return null;
  return (
    <div
      ref={region}
      role="region"
      aria-label="Group By"
      {...stylex.props(styles.region)}
      onFocusCapture={(event) => {
        const ButtonElement = event.currentTarget.ownerDocument.defaultView?.HTMLButtonElement;
        if (
          ButtonElement !== undefined &&
          event.target instanceof ButtonElement &&
          event.target.id === pickerId
        )
          focusedControl.current = { node: event.target, index: 0 };
      }}
      onBlurCapture={(event) => {
        if (
          event.target.isConnected &&
          (event.relatedTarget === null || !event.currentTarget.contains(event.relatedTarget))
        )
          focusedControl.current = undefined;
      }}
    >
      <Selector
        id={pickerId}
        label="Add Group"
        isLabelHidden
        placeholder="Add Group"
        size="sm"
        presentation="popover"
        hasSearch
        value=""
        options={inactive.map((column) => ({ value: column.columnId, label: column.headerName }))}
        isDisabled={inactive.length === 0}
        disabledMessage={inactive.length === 0 ? "All eligible columns are grouped" : undefined}
        onChange={(columnId) => {
          if (runtime.dispatchGridCommand({ type: "grouping.add", columnId }))
            announce(
              `${names.get(columnId) ?? columnId} added at position ${String(groupBy.length + 1)}`,
            );
        }}
      />
      <ol aria-label="Active groups" {...stylex.props(styles.list)}>
        {groupBy.map((columnId, index) => (
          <li key={columnId} {...stylex.props(styles.chip)}>
            <Button
              ref={(node) => {
                if (node === null) chips.current.delete(columnId);
                else chips.current.set(columnId, node);
              }}
              onFocus={(event) => {
                focusedControl.current = { node: event.currentTarget, index };
              }}
              label={names.get(columnId) ?? columnId}
              aria-label={`${names.get(columnId) ?? columnId}, position ${String(index + 1)} of ${String(groupBy.length)}`}
              size="sm"
              variant="ghost"
              aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
              aria-describedby={helpId}
            />
            <Button
              onFocus={(event) => {
                focusedControl.current = { node: event.currentTarget, index };
              }}
              label={`Remove ${names.get(columnId) ?? columnId} from Group By`}
              isIconOnly
              icon={<span aria-hidden="true">×</span>}
              size="sm"
              variant="ghost"
              onClick={() => {
                const cancel = focusOwner.prepareRemoval(columnId);
                if (!runtime.dispatchGridCommand({ type: "grouping.remove", columnId })) cancel();
                else
                  announce(
                    `${names.get(columnId) ?? columnId} removed from Group By, ${String(groupBy.length - 1)} groups remaining`,
                  );
              }}
            />
          </li>
        ))}
      </ol>
      <VisuallyHidden id={helpId}>
        Reorder a group with Alt+Left Arrow or Alt+Right Arrow while its chip is focused.
      </VisuallyHidden>
      <VisuallyHidden role="status" aria-label="Grouping status">
        <span key={announcement.sequence}>{announcement.message}</span>
      </VisuallyHidden>
    </div>
  );
});
