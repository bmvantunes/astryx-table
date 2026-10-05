import { isAstryxTableInvalidCellValue } from "./grid-runtime";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import type { CompiledColumn } from "./compile-columns";
import {
  captureAstryxTableClipboardSnapshot,
  clipboardTargetFromRange,
  clipboardTargetFromSelection,
  createAstryxTableCellRangeStructure,
  serializeAstryxTableClipboardSnapshot,
  type AstryxTableCellRangeRuntime,
  type AstryxTableCellRangeStructure,
} from "./cell-range-clipboard";
import { isAstryxTableCellRangeNavigationCommandAdmitted } from "./navigation";
import type { AstryxTableNavigationCommand, AstryxTableNavigationRuntime } from "./navigation";

const structures = new WeakMap<
  AstryxTableCellRangeRuntime,
  Readonly<{
    rows: readonly string[];
    columns: readonly CompiledColumn[];
    structure: AstryxTableCellRangeStructure;
  }>
>();

/** Called by the identity projection owner, not by hot value subscribers. */
export function reconcileClientCellRange(
  range: AstryxTableCellRangeRuntime | undefined,
  rows: readonly string[],
  columns: readonly CompiledColumn[],
): void {
  if (range === undefined) return;
  const previous = structures.get(range);
  if (previous?.rows === rows && previous.columns === columns) {
    range.reconcile(previous.structure);
    return;
  }
  const indexes =
    previous?.rows === rows
      ? previous.structure.rowIndexById
      : new Map(rows.map((id, index) => [id, index]));
  const structure = createAstryxTableCellRangeStructure(
    rows,
    columns.map((column) => column.columnId),
    indexes,
  );
  structures.set(range, { rows, columns, structure });
  range.reconcile(structure);
}

export function navigateCellRange(
  navigation: AstryxTableNavigationRuntime,
  range: AstryxTableCellRangeRuntime | undefined,
  command: AstryxTableNavigationCommand,
  extend: boolean,
): void {
  const structure = range?.getStructure();
  const currentRange = range?.getSnapshot().range;
  const extending = extend && range !== undefined && structure !== undefined;
  if (extending && currentRange !== undefined) {
    const index = structure.rowIndexById.get(currentRange.focus.rowId);
    if (index !== undefined)
      navigation.activateBody(index, currentRange.focus.rowId, currentRange.focus.columnId);
  } else navigation.activateForFocus();
  const current = navigation.getSnapshot();
  if (
    extending &&
    current?.region === "body" &&
    !isAstryxTableCellRangeNavigationCommandAdmitted(currentRange?.axis, command, current.rowIndex)
  )
    return;
  const projected =
    extending && currentRange !== undefined && command.type === "grid-edge"
      ? {
          type:
            currentRange.axis === "horizontal" ? ("row-edge" as const) : ("column-edge" as const),
          edge: command.edge,
        }
      : command;
  const effective =
    extending && projected.type === "column-edge"
      ? {
          type: "page" as const,
          rowDelta: (projected.edge === "start" ? -1 : 1) * structure.rowIds.length,
        }
      : projected;
  navigation.navigate(effective);
  const next = navigation.getSnapshot();
  if (range === undefined || structure === undefined) return;
  if (next?.region !== "body" || next.rowId === undefined) {
    range.clear();
    return;
  }
  const coordinate = { rowId: next.rowId, columnId: next.columnId };
  if (extending && current?.region === "body" && current.rowId !== undefined) {
    const selected = range.extendFromCurrent(
      { rowId: current.rowId, columnId: current.columnId },
      coordinate,
      structure,
    );
    const focus = selected.range?.focus ?? selected.anchor;
    const index = focus === undefined ? undefined : structure.rowIndexById.get(focus.rowId);
    if (focus !== undefined && index !== undefined)
      navigation.activateBody(index, focus.rowId, focus.columnId);
  } else range.replace(coordinate, structure);
}

/** Captures canonical values before any formatter or asynchronous clipboard work. */
export function copyCanonicalCells({
  runtime,
  navigation,
  range,
  document,
  announce,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly navigation: AstryxTableNavigationRuntime;
  readonly range: AstryxTableCellRangeRuntime | undefined;
  readonly document: Document;
  readonly announce: (message: string) => void;
}): boolean {
  if (range?.consumeStructuralInvalidation()) {
    announce("Copy failed: the selected cells are no longer available");
    return true;
  }
  const selection = range?.getSnapshot() ?? {};
  const active = navigation.getSnapshot();
  const coordinate =
    active?.region === "body" && active.rowId !== undefined
      ? { rowId: active.rowId, columnId: active.columnId }
      : undefined;
  const target =
    selection.range !== undefined
      ? clipboardTargetFromRange(selection.range)
      : coordinate === undefined
        ? undefined
        : clipboardTargetFromSelection({}, coordinate);
  if (target === undefined) return false;
  const clipboard = document.defaultView?.navigator.clipboard;
  if (clipboard?.writeText === undefined) {
    announce("Copy failed: clipboard access is unavailable");
    return true;
  }
  let snapshot: ReturnType<typeof captureAstryxTableClipboardSnapshot>;
  try {
    const read = runtime.captureCellCommandReader();
    snapshot = captureAstryxTableClipboardSnapshot(target, ({ rowId, columnId }) => {
      const cell = read(rowId, columnId);
      if (
        cell.kind !== "available" ||
        !cell.rowPresent ||
        cell.column === undefined ||
        isAstryxTableInvalidCellValue(cell.value)
      )
        return undefined;
      return { value: cell.value, formatCanonicalText: cell.column.semantics.formatCanonicalText };
    });
  } catch {
    announce("Copy failed: a selected value could not be serialized");
    return true;
  }
  if (snapshot === undefined) {
    announce("Copy failed: the selected cells are no longer available");
    return true;
  }
  const text = serializeAstryxTableClipboardSnapshot(snapshot);
  try {
    void clipboard.writeText(text).then(
      () =>
        announce(
          `${snapshot.canonicalTexts.length} ${snapshot.canonicalTexts.length === 1 ? "cell" : "cells"} copied`,
        ),
      () => announce("Copy failed: the browser rejected the clipboard write"),
    );
  } catch {
    announce("Copy failed: the browser rejected the clipboard write");
  }
  return true;
}
