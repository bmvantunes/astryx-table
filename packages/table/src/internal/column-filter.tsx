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
} from "./grid-query";

const styles = stylex.create({
  editor: { display: "flex", flexDirection: "column", gap: 8, width: 280 },
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
  | "blank"
  | "notBlank";
const operators: { value: Operator; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does not contain" },
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" },
  { value: "equals", label: "Equals" },
  { value: "notEqual", label: "Not equal" },
  { value: "blank", label: "Blank" },
  { value: "notBlank", label: "Not blank" },
];
type Draft = {
  operator: Operator;
  text: string;
  authored: boolean;
  caseSensitive: boolean;
  accentSensitive: boolean;
};
function restoredDraft(column: CompiledColumn, value: unknown): Draft | undefined {
  if (value === undefined)
    return {
      operator: "contains",
      text: "",
      authored: false,
      caseSensitive: false,
      accentSensitive: false,
    };
  if (value === null || typeof value !== "object") return undefined;
  const expression = value as Readonly<Record<string, unknown>>;
  const operator = operators.find((candidate) => candidate.value === expression["type"])?.value;
  if (operator === undefined) return undefined;
  const noOperand = operator === "blank" || operator === "notBlank";
  const text = noOperand
    ? ""
    : operator === "equals" || operator === "notEqual"
      ? column.semantics.formatCanonicalText(expression["filter"])
      : expression["filter"];
  if (typeof text !== "string") return undefined;
  return {
    operator,
    text,
    authored: !noOperand,
    caseSensitive: expression["caseSensitive"] === true,
    accentSensitive: expression["accentSensitive"] === true,
  };
}
function filterCandidate(
  column: CompiledColumn,
  draft: Draft,
): { filter?: Readonly<Record<string, unknown>>; error?: string } {
  const base = { columnId: column.columnId, type: draft.operator };
  if (draft.operator === "blank" || draft.operator === "notBlank") return { filter: base };
  if (!draft.authored) return { error: "Enter one or more valid values." };
  if (draft.text.length > ASTRYX_TABLE_MAX_FILTER_OPERAND_LENGTH)
    return { error: "Filter value is too long." };
  const sensitivity = {
    caseSensitive: draft.caseSensitive,
    accentSensitive: draft.accentSensitive,
  };
  if (draft.operator === "equals" || draft.operator === "notEqual") {
    const parsed = column.semantics.parseCanonicalText(draft.text);
    return parsed._tag === "Failure"
      ? { error: parsed.message }
      : { filter: { ...base, ...sensitivity, filter: parsed.value } };
  }
  if (
    normalizeAstryxTableFilterText(draft.text, draft.caseSensitive, draft.accentSensitive)
      .length === 0
  )
    return { error: "Enter a non-empty search value." };
  return { filter: { ...base, ...sensitivity, filter: draft.text } };
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
        };
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
        });
    },
    [column, runtime, getVersion, getEpoch],
  );
  const composition = useRef<
    { column: CompiledColumn; version: number; epoch: number } | undefined
  >(undefined);
  const debouncer = useDebouncer(publish, { wait: 150 });
  useLayoutEffect(() => () => debouncer.cancel(), [debouncer, column, version, epoch]);
  if (current.draft === undefined)
    return <p>This expression is preserved. Its editor is not available yet.</p>;
  const update = (draft: Draft, immediate: boolean, localOnly = false) => {
    const candidate = filterCandidate(column, draft);
    setLocal({ column, version, epoch, draft, error: candidate.error });
    debouncer.cancel();
    if (!localOnly && candidate.filter !== undefined) {
      const next = { column, version, epoch, draft };
      if (immediate) publish(next);
      else debouncer.maybeExecute(next);
    }
  };
  const draft = current.draft;
  const compositionIsCurrent = () => {
    const session = composition.current;
    return (
      session === undefined ||
      (session.column === column &&
        session.version === getVersion() &&
        session.epoch === getEpoch())
    );
  };
  return (
    <div {...stylex.props(styles.editor)}>
      {draft.operator === "blank" || draft.operator === "notBlank" ? null : (
        <TextInput
          label="Filter value"
          value={draft.text}
          maxLength={ASTRYX_TABLE_MAX_FILTER_OPERAND_LENGTH}
          status={
            current.error === undefined ? undefined : { type: "error", message: current.error }
          }
          onCompositionStart={() => {
            composition.current = { column, version, epoch };
            debouncer.cancel();
          }}
          onCompositionEnd={(event) => {
            const valid = compositionIsCurrent();
            composition.current = undefined;
            const input = event.currentTarget as HTMLInputElement;
            if (valid) update({ ...draft, text: input.value, authored: true }, false);
            else input.value = draft.text;
          }}
          onChange={(text, event) => {
            if (!compositionIsCurrent()) {
              event.currentTarget.value = draft.text;
              return;
            }
            update({ ...draft, text, authored: true }, false, composition.current !== undefined);
          }}
        />
      )}
      <Selector
        label="Operator"
        value={draft.operator}
        options={operators}
        onChange={(value) => {
          const operator = operators.find((option) => option.value === value)?.value;
          if (operator !== undefined) update({ ...draft, operator }, true);
        }}
      />
      <CheckboxInput
        label="Case sensitive"
        value={draft.caseSensitive}
        onChange={(caseSensitive) => update({ ...draft, caseSensitive }, true)}
      />
      <CheckboxInput
        label="Accent sensitive"
        value={draft.accentSensitive}
        onChange={(accentSensitive) => update({ ...draft, accentSensitive }, true)}
      />
    </div>
  );
});
