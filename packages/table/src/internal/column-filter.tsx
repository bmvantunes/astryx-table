import { memo, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { usePopover } from "@astryxdesign/core/Popover";
import { useDebouncer } from "@tanstack/react-pacer";
import { useAstryxTableHotkeyWorkflowAction } from "./hotkey-adapter";
import {
  recordAstryxTableClientColumnFilterRender,
  recordAstryxTableClientColumnFilterTriggerRender,
} from "./render-instrumentation";
import type { CompiledColumn } from "./compile-columns";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import {
  normalizeAstryxTableFilterText,
  ASTRYX_TABLE_MAX_FILTER_OPERAND_LENGTH,
  ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_OPERANDS,
} from "./grid-query";

const styles = stylex.create({
  editor: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: 280,
    maxHeight: "min(480px, 70vh)",
    overflowY: "auto",
  },
});
type Props = {
  readonly column: CompiledColumn;
  readonly runtime: AstryxTableRuntimeView;
  readonly open: boolean;
  readonly active: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly activate: () => void;
};

export const ColumnFilter = memo(function ColumnFilter({
  column,
  runtime,
  open,
  active,
  onOpenChange,
  activate,
}: Props) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
    recordAstryxTableClientColumnFilterTriggerRender(column.columnId);
  const onHide = useCallback(() => onOpenChange(false), [onOpenChange]);
  const {
    show,
    hide,
    triggerRef,
    triggerProps,
    render: renderPopover,
    isOpen,
  } = usePopover({
    lazyMount: true,
    dialogLabel: `Filter ${column.headerName}`,
    onHide,
    padding: 3,
  });
  useLayoutEffect(() => {
    if (open) show();
    else hide();
  }, [open, show, hide]);
  const register = useAstryxTableHotkeyWorkflowAction(() => onOpenChange(true));
  const attach = useCallback(
    (node: HTMLElement | null) => {
      triggerRef(node);
      register(node);
    },
    [triggerRef, register],
  );
  return (
    <>
      <Button
        ref={attach}
        data-astryx-column-filter-trigger=""
        {...triggerProps}
        label={`Filter ${column.headerName}${active ? " (active)" : ""}`}
        aria-keyshortcuts="Alt+Enter"
        isIconOnly
        icon={<span aria-hidden="true">⌕</span>}
        size="sm"
        variant={active ? "secondary" : "ghost"}
        tabIndex={-1}
        onFocus={activate}
        onClick={() => onOpenChange(!open)}
      />
      {renderPopover(isOpen ? <TextFilterEditor column={column} runtime={runtime} /> : null)}
    </>
  );
});

type Operator =
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "equals"
  | "notEqual"
  | "in"
  | "blank"
  | "notBlank";
const operators: { value: Operator; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does not contain" },
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" },
  { value: "equals", label: "Equals" },
  { value: "notEqual", label: "Not equal" },
  { value: "in", label: "Is one of" },
  { value: "blank", label: "Blank" },
  { value: "notBlank", label: "Not blank" },
];
const VISIBLE_OPERANDS = 64;
type Draft = {
  operator: Operator;
  operands: readonly { readonly text: string; readonly authored: boolean }[];
  caseSensitive: boolean;
  accentSensitive: boolean;
};
function restoredDraft(column: CompiledColumn, value: unknown): Draft | undefined {
  if (value === undefined)
    return {
      operator: "contains",
      operands: [{ text: "", authored: false }],
      caseSensitive: false,
      accentSensitive: false,
    };
  if (value === null || typeof value !== "object") return undefined;
  const expression = value as Readonly<Record<string, unknown>>;
  const operator = operators.find((candidate) => candidate.value === expression["type"])?.value;
  if (operator === undefined) return undefined;
  const noOperand = operator === "blank" || operator === "notBlank";
  const raw = expression["filter"];
  const values = operator === "in" && Array.isArray(raw) ? raw : [raw];
  const operands = values.map((value) => ({
    text: noOperand
      ? ""
      : operator === "in" || operator === "equals" || operator === "notEqual"
        ? column.semantics.formatCanonicalText(value)
        : value,
    authored: !noOperand,
  }));
  if (!operands.every((operand) => typeof operand.text === "string")) return undefined;
  return {
    operator,
    operands: operands as Draft["operands"],
    caseSensitive: expression["caseSensitive"] === true,
    accentSensitive: expression["accentSensitive"] === true,
  };
}
function filterCandidate(
  column: CompiledColumn,
  draft: Draft,
): { filter?: Readonly<Record<string, unknown>>; error?: string; invalidIndex?: number } {
  const base = { columnId: column.columnId, type: draft.operator };
  if (draft.operator === "blank" || draft.operator === "notBlank") return { filter: base };
  const operands = draft.operator === "in" ? draft.operands : draft.operands.slice(0, 1);
  const values: unknown[] = [];
  if (operands.length === 0) return { error: "Enter one or more valid values." };
  for (const [invalidIndex, operand] of operands.entries()) {
    if (!operand.authored) return { error: "Enter one or more valid values.", invalidIndex };
    if (operand.text.length > ASTRYX_TABLE_MAX_FILTER_OPERAND_LENGTH)
      return { error: "Filter value is too long.", invalidIndex };
    const exact =
      draft.operator === "in" || draft.operator === "equals" || draft.operator === "notEqual";
    const parsed = exact ? column.semantics.parseCanonicalText(operand.text) : undefined;
    if (parsed?._tag === "Failure") return { error: parsed.message, invalidIndex };
    const value = parsed?._tag === "Success" ? parsed.value : operand.text;
    if (
      draft.operator !== "equals" &&
      draft.operator !== "notEqual" &&
      normalizeAstryxTableFilterText(
        exact ? column.semantics.formatCanonicalText(value) : operand.text,
        draft.caseSensitive,
        draft.accentSensitive,
      ).length === 0
    )
      return { error: "Enter a non-empty search value.", invalidIndex };
    values.push(value);
  }
  return {
    filter: {
      ...base,
      caseSensitive: draft.caseSensitive,
      accentSensitive: draft.accentSensitive,
      filter: draft.operator === "in" ? values : values[0],
    },
  };
}

const TextFilterEditor = memo(function TextFilterEditor({
  column,
  runtime,
}: Pick<Props, "column" | "runtime">) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableClientColumnFilterRender(column.columnId);
  const subscribe = useCallback(
    (listener: () => void) => runtime.subscribeColumnFilter(column.columnId, listener),
    [runtime, column.columnId],
  );
  const getVersion = useCallback(
    () => runtime.getColumnFilterVersionSnapshot(column.columnId),
    [runtime, column.columnId],
  );
  const subscribeEpoch = useCallback(
    (listener: () => void) => runtime.subscribeColumnFilterCommandEpoch(column.columnId, listener),
    [runtime, column.columnId],
  );
  const getEpoch = useCallback(
    () => runtime.getColumnFilterCommandEpochSnapshot(column.columnId),
    [runtime, column.columnId],
  );
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  const epoch = useSyncExternalStore(subscribeEpoch, getEpoch, getEpoch);
  const [local, setLocal] = useState(() => ({
    column,
    version,
    epoch,
    draft: restoredDraft(column, runtime.getColumnFilterSnapshot(column.columnId)),
    error: undefined as string | undefined,
    invalidIndex: undefined as number | undefined,
  }));
  const current =
    local.column === column && local.version === version && local.epoch === epoch
      ? local
      : {
          column,
          version,
          epoch,
          draft: restoredDraft(column, runtime.getColumnFilterSnapshot(column.columnId)),
          error: undefined,
          invalidIndex: undefined,
        };
  const [windowStart, setWindowStart] = useState(0);
  const inputNodes = useRef(new Map<number, HTMLInputElement>());
  const focusRequest = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const index = focusRequest.current;
    focusRequest.current = undefined;
    if (index !== undefined) inputNodes.current.get(index)?.focus();
  }, [local, column, version, epoch]);
  const latestColumn = useRef(column);
  useLayoutEffect(() => {
    latestColumn.current = column;
  }, [column]);
  const publish = useCallback(
    (candidate: { column: CompiledColumn; version: number; epoch: number; draft: Draft }) => {
      if (
        candidate.column !== latestColumn.current ||
        candidate.version !== getVersion() ||
        candidate.epoch !== getEpoch()
      )
        return;
      const result = filterCandidate(column, candidate.draft);
      if (result.filter === undefined) return;
      let accepted = false;
      try {
        accepted = runtime.dispatchGridCommand({
          type: "column.filter.replace",
          columnId: column.columnId,
          filter: result.filter,
        });
      } catch {
        /* Admission preserves the last coherent runtime state. */
      }
      if (!accepted)
        setLocal({
          column,
          version: getVersion(),
          epoch: getEpoch(),
          draft: restoredDraft(column, runtime.getColumnFilterSnapshot(column.columnId)),
          error: "This filter could not be applied.",
          invalidIndex: undefined,
        });
    },
    [column, runtime, getVersion, getEpoch],
  );
  const shapeRevision = useRef(0);
  const composition = useRef<
    | {
        column: CompiledColumn;
        version: number;
        epoch: number;
        shapeRevision: number;
        index: number;
        input: HTMLInputElement;
        before: Draft["operands"][number];
      }
    | undefined
  >(undefined);
  const debouncer = useDebouncer(publish, { wait: 150 });
  useLayoutEffect(() => () => debouncer.cancel(), [debouncer, column, version, epoch]);
  if (current.draft === undefined)
    return <p>This expression is preserved. Its editor is not available yet.</p>;
  const update = (draft: Draft, immediate: boolean, localOnly = false) => {
    const candidate = filterCandidate(column, draft);
    setLocal({
      column,
      version,
      epoch,
      draft,
      error: candidate.error,
      invalidIndex: candidate.invalidIndex,
    });
    debouncer.cancel();
    if (!localOnly && candidate.filter !== undefined) {
      const next = { column, version, epoch, draft };
      if (immediate) publish(next);
      else debouncer.maybeExecute(next);
    }
  };
  const draft = current.draft;
  const invalidIndex = current.invalidIndex;
  const changeOperand = (index: number, text: string): Draft => ({
    ...draft,
    operands: draft.operands.map((operand, at) =>
      at === index ? { text, authored: true } : operand,
    ),
  });
  const maxWindowStart = Math.max(0, draft.operands.length - VISIBLE_OPERANDS);
  const start = Math.min(windowStart, maxWindowStart);
  const canAddOperand = () => {
    const raw = runtime.getColumnFilterSnapshot(column.columnId);
    const expression = raw as Readonly<Record<string, unknown>> | undefined;
    const filter = expression?.["filter"];
    const committedCount =
      expression === undefined ||
      expression["type"] === "blank" ||
      expression["type"] === "notBlank"
        ? 0
        : expression["type"] === "in" && Array.isArray(filter)
          ? filter.length
          : 1;
    return (
      runtime.getFilterComplexitySnapshot().operands - committedCount + draft.operands.length <
      ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_OPERANDS
    );
  };
  const compositionIsCurrent = (input?: HTMLInputElement) => {
    const session = composition.current;
    return (
      session === undefined ||
      (input !== undefined && session.input !== input) ||
      (session.column === column &&
        session.version === getVersion() &&
        session.epoch === getEpoch() &&
        session.shapeRevision === shapeRevision.current)
    );
  };
  const commandDraft = (): Draft => {
    const session = composition.current;
    const currentSession = compositionIsCurrent();
    shapeRevision.current++;
    // A discrete command cancels composition before changing the complete expression.
    return session !== undefined && currentSession
      ? {
          ...draft,
          operands: draft.operands.map((operand, index) =>
            index === session.index ? session.before : operand,
          ),
        }
      : draft;
  };
  return (
    <div {...stylex.props(styles.editor)}>
      {draft.operator === "blank" || draft.operator === "notBlank"
        ? null
        : (draft.operator === "in"
            ? draft.operands.slice(start, start + VISIBLE_OPERANDS)
            : draft.operands.slice(0, 1)
          ).map((operand, offset) => {
            const index = draft.operator === "in" ? start + offset : 0;
            return (
              <div key={index}>
                <TextInput
                  ref={(node) => {
                    if (node === null) inputNodes.current.delete(index);
                    else inputNodes.current.set(index, node);
                  }}
                  label={index === 0 ? "Filter value" : `Filter value ${String(index + 1)}`}
                  value={operand.text}
                  maxLength={ASTRYX_TABLE_MAX_FILTER_OPERAND_LENGTH}
                  status={
                    current.error === undefined || invalidIndex !== index
                      ? undefined
                      : { type: "error", message: current.error }
                  }
                  onCompositionStart={(event) => {
                    composition.current = {
                      column,
                      version,
                      epoch,
                      shapeRevision: shapeRevision.current,
                      index,
                      before: operand,
                      input: event.currentTarget as HTMLInputElement,
                    };
                    debouncer.cancel();
                  }}
                  onCompositionEnd={(event) => {
                    const input = event.currentTarget as HTMLInputElement;
                    if (composition.current !== undefined && composition.current.input !== input)
                      return;
                    const valid = compositionIsCurrent(input);
                    composition.current = undefined;
                    if (valid) update(changeOperand(index, input.value), false);
                    else input.value = operand.text;
                  }}
                  onChange={(text, event) => {
                    if (!compositionIsCurrent(event.currentTarget)) {
                      event.currentTarget.value = operand.text;
                      return;
                    }
                    update(
                      changeOperand(index, text),
                      false,
                      composition.current !== undefined && compositionIsCurrent(),
                    );
                  }}
                />
                {draft.operator === "in" && draft.operands.length > 1 ? (
                  <Button
                    label={`Remove filter value ${String(index + 1)}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = commandDraft();
                      const operands = next.operands.filter((_, at) => at !== index);
                      focusRequest.current = Math.min(index, operands.length - 1);
                      update({ ...next, operands }, true);
                    }}
                  />
                ) : null}
              </div>
            );
          })}
      {draft.operator === "in" && draft.operands.length > VISIBLE_OPERANDS ? (
        <>
          <span role="status">{`Showing values ${String(start + 1)}–${String(Math.min(start + VISIBLE_OPERANDS, draft.operands.length))} of ${String(draft.operands.length)}`}</span>
          <Button
            label="Previous filter values"
            size="sm"
            variant="ghost"
            isDisabled={start === 0}
            onClick={() => {
              if (composition.current !== undefined && compositionIsCurrent())
                update(commandDraft(), false, true);
              setWindowStart(Math.max(0, start - VISIBLE_OPERANDS));
            }}
          />
          <Button
            label="Next filter values"
            size="sm"
            variant="ghost"
            isDisabled={start === maxWindowStart}
            onClick={() => {
              if (composition.current !== undefined && compositionIsCurrent())
                update(commandDraft(), false, true);
              setWindowStart(Math.min(maxWindowStart, start + VISIBLE_OPERANDS));
            }}
          />
        </>
      ) : null}
      {draft.operator === "in" ? (
        <Button
          label="Add filter value"
          isDisabled={!canAddOperand()}
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!canAddOperand()) return;
            const next = commandDraft();
            focusRequest.current = next.operands.length;
            setWindowStart(Math.max(0, draft.operands.length - VISIBLE_OPERANDS + 1));
            update({ ...next, operands: [...next.operands, { text: "", authored: false }] }, true);
          }}
        />
      ) : null}
      {current.error !== undefined &&
      (invalidIndex === undefined ||
        invalidIndex < start ||
        invalidIndex >= start + VISIBLE_OPERANDS) ? (
        <p role="status">{current.error}</p>
      ) : null}
      <Selector
        label="Operator"
        value={draft.operator}
        options={operators}
        onChange={(value) => {
          const operator = operators.find((option) => option.value === value)?.value;
          if (operator !== undefined) {
            update({ ...commandDraft(), operator }, true);
          }
        }}
      />
      <CheckboxInput
        label="Case sensitive"
        value={draft.caseSensitive}
        onChange={(caseSensitive) => update({ ...commandDraft(), caseSensitive }, true)}
      />
      <CheckboxInput
        label="Accent sensitive"
        value={draft.accentSensitive}
        onChange={(accentSensitive) => update({ ...commandDraft(), accentSensitive }, true)}
      />
    </div>
  );
});
