import { recordAstryxTableColumnSettingsRender } from "./column-settings-instrumentation";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@astryxdesign/core/Button";
import { usePopover } from "@astryxdesign/core/Popover";
import { memo, useMemo, useState, useSyncExternalStore } from "react";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { MultiSelector } from "@astryxdesign/core/MultiSelector";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import type { CompiledColumn } from "./compile-columns";

const styles = stylex.create({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: 240,
    maxWidth: "calc(100vw - 32px)",
  },
});

/** A stable side-rail anchor; native layers mount preference controls on demand. */
export const ColumnManagement = memo(function ColumnManagement({
  runtime,
  columns,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly columns: readonly CompiledColumn[];
}) {
  const { triggerRef, triggerProps, toggle, isOpen, render } = usePopover({
    lazyMount: true,
    dialogLabel: "Column preferences",
    padding: 3,
  });
  return (
    <>
      <Button
        ref={triggerRef}
        {...triggerProps}
        label="Column preferences"
        isIconOnly
        icon={<span aria-hidden="true">▥</span>}
        size="sm"
        variant="ghost"
        onClick={toggle}
      />
      {render(
        isOpen ? (
          <div {...stylex.props(styles.panel)}>
            <ColumnVisibility runtime={runtime} columns={columns} />
            <ResetColumns runtime={runtime} />
          </div>
        ) : null,
      )}
    </>
  );
});

/** Native selection UI over the one durable Column Visibility preference. */
export const ColumnVisibility = memo(function ColumnVisibility({
  runtime,
  columns,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly columns: readonly CompiledColumn[];
}) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableColumnSettingsRender("visibility");
  const snapshot = useSyncExternalStore(
    runtime.subscribeColumnStructure,
    runtime.getColumnStructureSnapshot,
    runtime.getColumnStructureSnapshot,
  );
  const labels = useMemo(
    () => new Map(columns.map((column) => [column.columnId, column.headerName])),
    [columns],
  );
  const visible = new Set(snapshot.visibleColumnIds);
  const options = snapshot.allColumns.map((column) => ({
    value: column.columnId,
    label: labels.get(column.columnId) ?? column.headerName,
    disabled: visible.size === 1 && visible.has(column.columnId),
  }));
  return (
    <MultiSelector
      label="Visible columns"
      isLabelHidden
      variant="ghost"
      size="sm"
      hasSearch
      presentation="popover"
      options={options}
      value={[...snapshot.visibleColumnIds]}
      formatValue={(items) => `Columns (${String(items.length)})`}
      onChange={(next) => {
        const current = runtime.getColumnStructureSnapshot();
        const before = new Set(current.visibleColumnIds);
        const after = new Set(next);
        const changed = current.allColumns.filter(
          (column) => before.has(column.columnId) !== after.has(column.columnId),
        );
        // Clear/Select All are not exposed: one native toggle is one atomic command.
        if (changed.length !== 1) return;
        const columnId = changed[0]!.columnId;
        runtime.dispatchGridCommand({
          type: "column.visibility.commit",
          columnId,
          visible: after.has(columnId),
        });
      }}
    />
  );
});

/** Reset controls dispatch commands without subscribing to grid state. */
export const ResetColumns = memo(function ResetColumns({
  runtime,
}: {
  readonly runtime: AstryxTableRuntimeView;
}) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableColumnSettingsRender("reset");
  const [announcement, setAnnouncement] = useState({ sequence: 0, message: "" });
  return (
    <>
      <DropdownMenu
        presentation="popover"
        button={{ label: "Reset columns", variant: "ghost", size: "sm" }}
        items={(
          [
            ["order", "Reset column order", "Column order reset"],
            ["widths", "Reset column widths", "Column widths reset"],
            ["visibility", "Reset column visibility", "Column visibility reset"],
            ["pinning", "Reset column pinning", "Column pinning reset"],
            ["layout", "Reset entire column layout", "Column layout reset"],
          ] as const
        ).map(([kind, label, message]) => ({
          id: kind,
          label,
          onClick: () => {
            if (runtime.dispatchGridCommand({ type: `column.reset.${kind}` }))
              setAnnouncement((previous) => ({ sequence: previous.sequence + 1, message }));
          },
        }))}
      />
      <VisuallyHidden role="status" aria-label="Column preferences status">
        <span key={announcement.sequence}>{announcement.message}</span>
      </VisuallyHidden>
    </>
  );
});
