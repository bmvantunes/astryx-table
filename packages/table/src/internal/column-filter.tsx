import { useClientContext } from "./client-context";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as stylex from "@stylexjs/stylex";
import { ClientSetFilter } from "./client-set-filter";
import { isAstryxTableSetFilterExpression } from "./client-facet";
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
  ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_NODES,
  ASTRYX_TABLE_CLIENT_FILTER_MAX_DEPTH,
} from "./grid-query";

const styles = stylex.create({
  controls: { display: "flex", flexDirection: "column", gap: 8 },
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
  const { rows } = useClientContext();
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
      {renderPopover(
        isOpen ? (
          <div {...stylex.props(styles.editor)}>
            {column.enableSetFilter && rows !== undefined ? (
              <ClientSetFilter column={column} />
            ) : null}
            <ScalarFilterEditor column={column} runtime={runtime} />
          </div>
        ) : null,
      )}
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
const textOperators: { value: Operator; label: string }[] = [
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
const booleanOperators = textOperators.filter(
  ({ value }) =>
    value === "equals" || value === "notEqual" || value === "blank" || value === "notBlank",
);
const booleanOptions = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
];
function filterOperators(column: CompiledColumn) {
  return column.valueType === "boolean" || column.selectOptions !== undefined
    ? booleanOperators
    : textOperators;
}
const VISIBLE_OPERANDS = 64;
type Draft = {
  operator: Operator;
  selectIndex?: number | undefined;
  operands: readonly { readonly text: string; readonly authored: boolean }[];
  caseSensitive: boolean;
  accentSensitive: boolean;
};
function restoredDraft(column: CompiledColumn, value: unknown): Draft | undefined {
  if (value === undefined)
    return {
      operator:
        column.valueType === "boolean" || column.selectOptions !== undefined
          ? "equals"
          : "contains",
      operands: [{ text: "", authored: false }],
      caseSensitive: false,
      accentSensitive: false,
    };
  if (value === null || typeof value !== "object") return undefined;
  const expression = value as Readonly<Record<string, unknown>>;
  const operator = filterOperators(column).find(
    (candidate) => candidate.value === expression["type"],
  )?.value;
  if (operator === undefined) return undefined;
  const noOperand = operator === "blank" || operator === "notBlank";
  const raw = expression["filter"];
  if (column.selectOptions !== undefined) {
    const index = column.selectOptionIndexes?.get(raw);
    return {
      operator,
      operands: [{ text: "", authored: false }],
      selectIndex:
        !noOperand && index !== undefined && Object.is(column.selectOptions[index], raw)
          ? index
          : undefined,
      caseSensitive: false,
      accentSensitive: false,
    };
  }
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
  if (column.selectOptions !== undefined) {
    const option =
      draft.selectIndex === undefined ? undefined : column.selectOptions[draft.selectIndex];
    return option === undefined
      ? { error: "Choose a value.", invalidIndex: 0 }
      : { filter: { ...base, filter: option } };
  }
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
      ...(column.semantics.filterFamily === "text"
        ? {
            caseSensitive: draft.caseSensitive,
            accentSensitive: draft.accentSensitive,
          }
        : {}),
      filter: draft.operator === "in" ? values : values[0],
    },
  };
}

type Expression =
  | (Draft & { readonly kind: "leaf" })
  | { readonly kind: "AND"; readonly conditions: readonly Expression[] }
  | { readonly kind: "OR"; readonly conditions: readonly Expression[] }
  | { readonly kind: "NOT"; readonly condition: Expression }
  | { readonly kind: "opaque"; readonly filter: Readonly<Record<string, unknown>> };
type Path = readonly (number | "not")[];
type Candidate = ReturnType<typeof filterCandidate> & { readonly invalidLeaf?: Expression };
const candidateCaches = new WeakMap<CompiledColumn, WeakMap<Expression, Candidate>>();
function restoreExpression(column: CompiledColumn, value: unknown): Expression {
  if (value !== null && typeof value === "object") {
    const node = value as Readonly<Record<string, unknown>>;
    if ((node["type"] === "AND" || node["type"] === "OR") && Array.isArray(node["conditions"]))
      return {
        kind: node["type"],
        conditions: node["conditions"].map((child) => restoreExpression(column, child)),
      };
    if (node["type"] === "NOT")
      return { kind: "NOT", condition: restoreExpression(column, node["condition"]) };
    const leaf = restoredDraft(column, value);
    return leaf === undefined ? { kind: "opaque", filter: node } : { ...leaf, kind: "leaf" };
  }
  return { ...restoredDraft(column, undefined)!, kind: "leaf" };
}
function expressionCandidate(column: CompiledColumn, draft: Expression): Candidate {
  let cache = candidateCaches.get(column);
  if (cache === undefined) {
    cache = new WeakMap();
    candidateCaches.set(column, cache);
  }
  const cached = cache.get(draft);
  if (cached !== undefined) return cached;
  let result: Candidate;
  if (draft.kind === "leaf") {
    const leaf = filterCandidate(column, draft);
    result = leaf.filter === undefined ? { ...leaf, invalidLeaf: draft } : leaf;
  } else if (draft.kind === "opaque") result = { filter: draft.filter };
  else if (draft.kind === "NOT") {
    const child = expressionCandidate(column, draft.condition);
    result =
      child.filter === undefined ? child : { filter: { type: "NOT", condition: child.filter } };
  } else {
    const conditions: Readonly<Record<string, unknown>>[] = [];
    for (const child of draft.conditions) {
      const candidate = expressionCandidate(column, child);
      if (candidate.filter === undefined) return candidate;
      conditions.push(candidate.filter);
    }
    result = { filter: { type: draft.kind, conditions } };
  }
  if (result.filter !== undefined) cache.set(draft, result);
  return result;
}
function replaceExpression(
  draft: Expression,
  path: Path,
  transform: (node: Expression) => Expression,
): Expression {
  const [first, ...rest] = path;
  if (first === undefined) return transform(draft);
  if (first === "not" && draft.kind === "NOT")
    return { ...draft, condition: replaceExpression(draft.condition, rest, transform) };
  if (typeof first === "number" && (draft.kind === "AND" || draft.kind === "OR"))
    return {
      ...draft,
      conditions: draft.conditions.map((child, index) =>
        index === first ? replaceExpression(child, rest, transform) : child,
      ),
    };
  return draft;
}

function expressionAt(draft: Expression, path: Path): Expression | undefined {
  let current = draft;
  for (const segment of path) {
    if (segment === "not" && current.kind === "NOT") current = current.condition;
    else if (typeof segment === "number" && (current.kind === "AND" || current.kind === "OR")) {
      const child = current.conditions[segment];
      if (child === undefined) return undefined;
      current = child;
    } else return undefined;
  }
  return current;
}

type Composition = {
  readonly column: CompiledColumn;
  readonly version: number;
  readonly epoch: number;
  readonly revision: number;
  readonly path: Path;
  readonly index: number;
  readonly before: Draft["operands"][number];
  readonly input: HTMLInputElement;
};
type EditorContext = {
  readonly column: CompiledColumn;
  readonly error: Candidate;
  readonly composition: { current: Composition | undefined };
  readonly revision: { current: number };
  readonly version: number;
  readonly epoch: number;
  readonly cancel: () => void;
  readonly navigate: (path: Path) => void;
  readonly compositionIsCurrent: (input?: HTMLInputElement) => boolean;
  readonly canAddOperand: () => boolean;
  readonly canAddCondition: (path: Path) => boolean;
  readonly change: (
    path: Path,
    transform: (node: Expression) => Expression,
    immediate: boolean,
    localOnly?: boolean,
    command?: boolean,
    viewPath?: Path,
  ) => void;
};
type EditorActions = Omit<EditorContext, "version" | "epoch" | "error"> & {
  readonly getIdentity: () => Pick<Composition, "version" | "epoch">;
};
const ScalarFilterEditor = memo(function ScalarFilterEditor({
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
  const getCommitted = useCallback(
    () => runtime.getColumnFilterSnapshot(column.columnId),
    [runtime, column.columnId],
  );
  const committed = useSyncExternalStore(subscribe, getCommitted, getCommitted);
  const baseline = useMemo(() => restoreExpression(column, committed), [column, committed]);
  const [local, setLocal] = useState(() => ({
    column,
    version,
    epoch,
    draft: baseline,
    viewPath: ROOT_PATH,
    error: {} as Candidate,
  }));
  const current =
    local.column === column && local.version === version && local.epoch === epoch
      ? local
      : { column, version, epoch, draft: baseline, viewPath: ROOT_PATH, error: {} as Candidate };
  const conditionsHost = useRef<HTMLDivElement | null>(null);
  const focusConditions = useRef(false);
  useLayoutEffect(() => {
    if (focusConditions.current) {
      focusConditions.current = false;
      (
        conditionsHost.current?.querySelector<HTMLElement>("input") ??
        conditionsHost.current?.querySelector<HTMLElement>('[role="combobox"]')
      )?.focus({ preventScroll: true });
    }
  }, [local, column, version, epoch]);
  const latestColumn = useRef(column);
  useLayoutEffect(() => {
    latestColumn.current = column;
  }, [column]);
  const publish = useCallback(
    (candidate: { column: CompiledColumn; version: number; epoch: number; draft: Expression }) => {
      if (
        candidate.column !== latestColumn.current ||
        candidate.version !== getVersion() ||
        candidate.epoch !== getEpoch()
      )
        return;
      const result = expressionCandidate(column, candidate.draft);
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
      if (accepted) {
        const acceptedVersion = getVersion();
        const acceptedEpoch = getEpoch();
        setLocal((previous) => ({
          column,
          version: acceptedVersion,
          epoch: acceptedEpoch,
          draft: candidate.draft,
          viewPath: previous.viewPath,
          error: {},
        }));
      } else {
        const rejectedVersion = getVersion();
        const rejectedEpoch = getEpoch();
        const unchanged =
          candidate.column === latestColumn.current &&
          candidate.version === rejectedVersion &&
          candidate.epoch === rejectedEpoch;
        setLocal((previous) => ({
          column,
          version: rejectedVersion,
          epoch: rejectedEpoch,
          draft: unchanged
            ? candidate.draft
            : restoreExpression(column, runtime.getColumnFilterSnapshot(column.columnId)),
          viewPath: unchanged ? previous.viewPath : ROOT_PATH,
          error: { error: "This filter could not be applied." },
        }));
      }
    },
    [column, runtime, getVersion, getEpoch],
  );
  const debouncer = useDebouncer(publish, { wait: 150 });
  useLayoutEffect(() => () => debouncer.cancel(), [debouncer, column, version, epoch]);
  const revision = useRef(0);
  const composition = useRef<Composition | undefined>(undefined);
  const compositionIsCurrent = (input?: HTMLInputElement) => {
    const session = composition.current;
    return (
      session === undefined ||
      (input !== undefined && session.input !== input) ||
      (session.column === column &&
        session.version === getVersion() &&
        session.epoch === getEpoch() &&
        session.revision === revision.current)
    );
  };
  const context: EditorContext = {
    column,
    version,
    epoch,
    revision,
    composition,
    compositionIsCurrent,
    error: current.error,
    cancel: () => debouncer.cancel(),
    navigate: (path) => {
      focusConditions.current = true;
      if (composition.current !== undefined && compositionIsCurrent())
        context.change(ROOT_PATH, (node) => node, false, true, true, path);
      else setLocal({ ...current, viewPath: path });
    },
    canAddOperand: () => {
      const committed = runtime.getColumnFilterSnapshot(column.columnId);
      const oldCount = committed === undefined ? 0 : expressionOperands(baseline);
      return (
        runtime.getFilterComplexitySnapshot().operands -
          oldCount +
          expressionOperands(current.draft) <
        ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_OPERANDS
      );
    },
    canAddCondition: (path) => {
      const total = runtime.getFilterComplexitySnapshot();
      const oldNodes = committed === undefined ? 0 : expressionShape(baseline).nodes;
      const oldOperands = committed === undefined ? 0 : expressionOperands(baseline);
      return (
        path.length < ASTRYX_TABLE_CLIENT_FILTER_MAX_DEPTH &&
        total.nodes - oldNodes + expressionShape(current.draft).nodes <
          ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_NODES &&
        total.operands - oldOperands + expressionOperands(current.draft) <
          ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_OPERANDS
      );
    },
    change: (path, transform, immediate, localOnly = false, command = false, viewPath) => {
      let next = current.draft;
      const session = composition.current;
      if (command) {
        if (session !== undefined && compositionIsCurrent())
          next = replaceExpression(next, session.path, (node) =>
            node.kind === "leaf"
              ? {
                  ...node,
                  operands: node.operands.map((operand, index) =>
                    index === session.index ? session.before : operand,
                  ),
                }
              : node,
          );
        revision.current++;
      }
      const proposed = replaceExpression(next, path, transform);
      const total = runtime.getFilterComplexitySnapshot();
      const previousShape =
        committed === undefined ? { nodes: 0, height: 0 } : expressionShape(baseline);
      const proposedShape = expressionShape(proposed);
      if (
        proposedShape.height > ASTRYX_TABLE_CLIENT_FILTER_MAX_DEPTH ||
        total.nodes - previousShape.nodes + proposedShape.nodes >
          ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_NODES ||
        total.operands -
          (committed === undefined ? 0 : expressionOperands(baseline)) +
          expressionOperands(proposed) >
          ASTRYX_TABLE_CLIENT_FILTER_MAX_TOTAL_OPERANDS
      ) {
        debouncer.cancel();
        setLocal({
          column,
          version,
          epoch,
          draft: next,
          viewPath: current.viewPath,
          error: { error: "This filter has reached its complexity limit." },
        });
        return;
      }
      next = proposed;
      const candidate = expressionCandidate(column, next);
      setLocal({
        column,
        version,
        epoch,
        draft: next,
        viewPath: viewPath ?? current.viewPath,
        error: candidate,
      });
      debouncer.cancel();
      if (!localOnly && candidate.filter !== undefined) {
        const pending = { column, version, epoch, draft: next };
        if (immediate) publish(pending);
        else debouncer.maybeExecute(pending);
      }
    },
  };
  const latestActions = useRef(context);
  useLayoutEffect(() => {
    latestActions.current = context;
  }, [context]);
  const actions = useMemo<EditorActions>(
    () => ({
      column,
      composition,
      revision,
      getIdentity: () => ({
        version: latestActions.current.version,
        epoch: latestActions.current.epoch,
      }),
      navigate: (path) => latestActions.current.navigate(path),
      cancel: () => latestActions.current.cancel(),
      compositionIsCurrent: (input) => latestActions.current.compositionIsCurrent(input),
      canAddOperand: () => latestActions.current.canAddOperand(),
      canAddCondition: (path) => latestActions.current.canAddCondition(path),
      change: (...args) => latestActions.current.change(...args),
    }),
    [column],
  );
  if (
    column.semantics.filterFamily !== "text" &&
    column.valueType !== "boolean" &&
    column.selectOptions === undefined
  )
    return null;
  if (
    column.enableSetFilter &&
    isAstryxTableSetFilterExpression(column, runtime.getColumnFilterSnapshot(column.columnId))
  )
    return (
      <>
        <p>Values are selected. Switch to conditions to replace this filter.</p>
        <Button
          label="Use conditions"
          variant="ghost"
          size="sm"
          onClick={() => {
            focusConditions.current = true;
            if (
              !runtime.dispatchGridCommand({
                type: "column.filter.clear",
                columnId: column.columnId,
              })
            )
              focusConditions.current = false;
          }}
        />
      </>
    );
  const viewed = expressionAt(current.draft, current.viewPath);
  const viewPath = viewed === undefined ? ROOT_PATH : current.viewPath;
  return (
    <div ref={conditionsHost} {...stylex.props(styles.controls)}>
      {viewPath.length > 0 ? (
        <Button
          label="Back to full expression"
          variant="ghost"
          size="sm"
          onClick={() => actions.navigate(ROOT_PATH)}
        />
      ) : null}
      <ExpressionControls
        key={JSON.stringify(viewPath)}
        context={context}
        actions={actions}
        draft={viewed ?? current.draft}
        path={viewPath}
      />
      {current.error.error !== undefined ? (
        <p role="status" aria-label="Filter draft status">
          {current.error.error}
        </p>
      ) : null}
    </div>
  );
});
const operandCounts = new WeakMap<Expression, number>();
function expressionOperands(draft: Expression): number {
  const cached = operandCounts.get(draft);
  if (cached !== undefined) return cached;
  let count: number;
  if (draft.kind === "NOT") count = expressionOperands(draft.condition);
  else if (draft.kind === "AND" || draft.kind === "OR")
    count = draft.conditions.reduce((total, child) => total + expressionOperands(child), 0);
  else if (draft.kind === "leaf")
    count =
      draft.operator === "blank" || draft.operator === "notBlank"
        ? 0
        : draft.operator === "in"
          ? draft.operands.length
          : 1;
  else
    count =
      draft.filter["type"] === "blank" ||
      draft.filter["type"] === "notBlank" ||
      draft.filter["type"] === "matchNone"
        ? 0
        : Array.isArray(draft.filter["filter"])
          ? draft.filter["filter"].length
          : Number(draft.filter["filter"] !== undefined) +
            Number(draft.filter["filterTo"] !== undefined);
  operandCounts.set(draft, count);
  return count;
}
const ROOT_PATH: Path = [];
const expressionModes = [
  { value: "leaf", label: "Single condition" },
  { value: "AND", label: "All conditions (AND)" },
  { value: "OR", label: "Any condition (OR)" },
  { value: "NOT", label: "Not (NOT)" },
];
function changeExpressionMode(column: CompiledColumn, draft: Expression, mode: string): Expression {
  if (mode === draft.kind) return draft;
  if (mode === "leaf") {
    if (draft.kind === "NOT") return changeExpressionMode(column, draft.condition, "leaf");
    if (draft.kind === "AND" || draft.kind === "OR")
      return changeExpressionMode(column, draft.conditions[0]!, "leaf");
    return restoreExpression(column, undefined);
  }
  if (mode === "NOT") return { kind: "NOT", condition: draft };
  if (mode === "AND" || mode === "OR")
    return draft.kind === "AND" || draft.kind === "OR"
      ? { ...draft, kind: mode }
      : { kind: mode, conditions: [draft, restoreExpression(column, undefined)] };
  return draft;
}
const shapeCounts = new WeakMap<Expression, { nodes: number; height: number }>();
function expressionShape(draft: Expression): { nodes: number; height: number } {
  const cached = shapeCounts.get(draft);
  if (cached !== undefined) return cached;
  const children =
    draft.kind === "NOT"
      ? [draft.condition]
      : draft.kind === "AND" || draft.kind === "OR"
        ? draft.conditions
        : [];
  let nodes = 1;
  let height = 0;
  for (const child of children) {
    const shape = expressionShape(child);
    nodes += shape.nodes;
    height = Math.max(height, shape.height + 1);
  }
  const result = { nodes, height };
  shapeCounts.set(draft, result);
  return result;
}
function expressionLabel(path: Path) {
  return path.length === 0
    ? ""
    : ` (${path.map((segment) => (segment === "not" ? "not" : `condition ${String(segment + 1)}`)).join(" / ")})`;
}
function ExpressionControls({
  context,
  actions,
  draft,
  path,
  budget = 256,
}: {
  readonly context: EditorContext;
  readonly actions: EditorActions;
  readonly draft: Expression;
  readonly path: Path;
  readonly budget?: number;
}) {
  const column = context.column;
  const [windowStart, setWindowStart] = useState(0);
  const hosts = useRef(new Map<number, HTMLDivElement>());
  const removeButtons = useRef(new Map<number, HTMLButtonElement>());
  const focusRequest = useRef<{ index: number; input: boolean } | undefined>(undefined);
  const compound = draft.kind === "AND" || draft.kind === "OR";
  const length = compound ? draft.conditions.length : 0;
  const visibleLimit = Math.min(64, Math.max(0, budget - 1));
  const maxStart = Math.max(0, length - visibleLimit);
  const start = Math.min(windowStart, maxStart);
  const end = Math.min(length, start + visibleLimit);
  const childBudget = Math.floor((budget - 1) / Math.max(1, end - start));
  const suffix = expressionLabel(path);
  const childPaths = useMemo(
    () => Array.from({ length: end - start }, (_, offset) => [...path, start + offset]),
    [path, start, end],
  );
  const notPath = useMemo(() => [...path, "not"] as const, [path]);
  useLayoutEffect(() => {
    const request = focusRequest.current;
    focusRequest.current = undefined;
    if (request === undefined) return;
    const target = request.input
      ? hosts.current.get(request.index)?.querySelector<HTMLElement>('input, [role="combobox"]')
      : (removeButtons.current.get(request.index) ??
        hosts.current.get(request.index)?.querySelector<HTMLElement>('input, [role="combobox"]'));
    target?.focus({ preventScroll: true });
  }, [draft, start]);
  const moveWindow = (next: number) => {
    if (actions.composition.current !== undefined && actions.compositionIsCurrent())
      actions.change(path, (node) => node, false, true, true);
    setWindowStart(next);
  };
  return (
    <div {...stylex.props(styles.controls)}>
      {draft.kind === "leaf" ? (
        <LeafControls
          context={actions}
          draft={draft}
          path={path}
          candidateError={context.error.invalidLeaf === draft ? context.error : undefined}
          mayAddOperand={context.canAddOperand()}
        />
      ) : null}
      {draft.kind === "opaque" ? (
        <p>This expression is preserved. Choose Single condition to replace it.</p>
      ) : null}
      <Selector
        key="expression-mode"
        label={`Filter expression for ${column.headerName}${suffix}`}
        value={draft.kind === "opaque" ? "" : draft.kind}
        options={expressionModes}
        onChange={(mode) =>
          actions.change(
            path,
            (node) => changeExpressionMode(column, node, mode),
            true,
            false,
            true,
          )
        }
      />
      {draft.kind === "NOT" && budget > 1 ? (
        <div role="group" aria-label={`Filter negation for ${column.headerName}${suffix}`}>
          <ExpressionControls
            context={context}
            actions={actions}
            draft={draft.condition}
            path={notPath}
            budget={budget - 1}
          />
        </div>
      ) : null}
      {compound ? (
        <>
          {draft.conditions.slice(start, end).map((child, offset) => {
            const index = start + offset;
            return (
              <div
                key={index}
                ref={(node) => {
                  if (node === null) hosts.current.delete(index);
                  else hosts.current.set(index, node);
                }}
                role="group"
                aria-label={`Filter condition ${String(index + 1)} for ${column.headerName}${suffix}`}
              >
                <ExpressionControls
                  context={context}
                  actions={actions}
                  draft={child}
                  path={childPaths[offset]!}
                  budget={childBudget}
                />
                {length > 1 ? (
                  <Button
                    ref={(node) => {
                      if (node === null) removeButtons.current.delete(index);
                      else removeButtons.current.set(index, node);
                    }}
                    label={`Remove condition ${String(index + 1)} for ${column.headerName}${suffix}`}
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      actions.change(
                        path,
                        (node) => {
                          if (node.kind !== "AND" && node.kind !== "OR") return node;
                          focusRequest.current = {
                            index: Math.min(index, node.conditions.length - 2),
                            input: false,
                          };
                          return {
                            ...node,
                            conditions: node.conditions.filter((_, at) => at !== index),
                          };
                        },
                        true,
                        false,
                        true,
                      )
                    }
                  />
                ) : null}
              </div>
            );
          })}
          {length > visibleLimit && visibleLimit > 0 ? (
            <>
              <span role="status">{`Showing conditions ${String(start + 1)}–${String(end)} of ${String(length)}`}</span>
              <Button
                label={`Previous conditions for ${column.headerName}${suffix}`}
                variant="ghost"
                size="sm"
                isDisabled={start === 0}
                onClick={() => moveWindow(Math.max(0, start - visibleLimit))}
              />
              <Button
                label={`Next conditions for ${column.headerName}${suffix}`}
                variant="ghost"
                size="sm"
                isDisabled={end === length}
                onClick={() => moveWindow(Math.min(maxStart, start + visibleLimit))}
              />
            </>
          ) : null}
          <Button
            label={`Add condition for ${column.headerName}${suffix}`}
            variant="ghost"
            size="sm"
            isDisabled={visibleLimit === 0 || !context.canAddCondition(path)}
            onClick={() => {
              if (visibleLimit === 0 || !actions.canAddCondition(path)) return;
              actions.change(
                path,
                (node) => {
                  if (node.kind !== "AND" && node.kind !== "OR") return node;
                  focusRequest.current = { index: node.conditions.length, input: true };
                  setWindowStart(Math.max(0, node.conditions.length + 1 - visibleLimit));
                  return {
                    ...node,
                    conditions: [...node.conditions, restoreExpression(column, undefined)],
                  };
                },
                true,
                false,
                true,
              );
            }}
          />
        </>
      ) : null}
      {(compound || draft.kind === "NOT") && budget <= 1 ? (
        <Button
          label={`Open conditions for ${column.headerName}${suffix}`}
          variant="ghost"
          size="sm"
          onClick={() => actions.navigate(path)}
        />
      ) : null}
    </div>
  );
}

const LeafControls = memo(function LeafControls({
  context,
  draft,
  path,
  candidateError,
  mayAddOperand,
}: {
  readonly context: EditorActions;
  readonly draft: Extract<Expression, { kind: "leaf" }>;
  readonly path: Path;
  readonly candidateError: Candidate | undefined;
  readonly mayAddOperand: boolean;
}) {
  const { column, composition, compositionIsCurrent, canAddOperand } = context;
  const error = candidateError?.error;
  const invalidIndex = candidateError?.invalidIndex;
  const [windowStart, setWindowStart] = useState(0);
  const inputNodes = useRef(new Map<number, HTMLInputElement>());
  const focusRequest = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const index = focusRequest.current;
    focusRequest.current = undefined;
    if (index !== undefined) inputNodes.current.get(index)?.focus({ preventScroll: true });
  }, [draft]);
  const update = (next: Draft, immediate: boolean, localOnly = false) =>
    context.change(path, () => ({ ...next, kind: "leaf" }), immediate, localOnly);
  const command = (transform: (leaf: Draft) => Draft) =>
    context.change(
      path,
      (node) => (node.kind === "leaf" ? { ...transform(node), kind: "leaf" } : node),
      true,
      false,
      true,
    );
  const changeOperand = (index: number, text: string): Draft => ({
    ...draft,
    operands: draft.operands.map((operand, at) =>
      at === index ? { text, authored: true } : operand,
    ),
  });
  const maxWindowStart = Math.max(0, draft.operands.length - VISIBLE_OPERANDS);
  const start = Math.min(windowStart, maxWindowStart);
  return (
    <div {...stylex.props(styles.controls)}>
      {draft.operator === "blank" || draft.operator === "notBlank" ? null : column.selectOptions !==
        undefined ? (
        <SelectFilterOperand
          column={column}
          selected={draft.selectIndex}
          error={error}
          onChange={(selectIndex) => command((leaf) => ({ ...leaf, selectIndex }))}
        />
      ) : column.valueType === "boolean" ? (
        <Selector
          label="Filter value"
          placeholder="Choose a value"
          value={draft.operands[0]?.authored ? draft.operands[0].text : ""}
          options={booleanOptions}
          status={error === undefined ? undefined : { type: "error", message: error }}
          onChange={(value) => {
            if (value === "true" || value === "false")
              command((leaf) => ({ ...leaf, operands: [{ text: value, authored: true }] }));
          }}
        />
      ) : (
        (draft.operator === "in"
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
                  error === undefined || invalidIndex !== index
                    ? undefined
                    : { type: "error", message: error }
                }
                onCompositionStart={(event) => {
                  composition.current = {
                    column,
                    ...context.getIdentity(),
                    revision: context.revision.current,
                    path,
                    index,
                    before: operand,
                    input: event.currentTarget as HTMLInputElement,
                  };
                  context.cancel();
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
                    command((leaf) => {
                      const operands = leaf.operands.filter((_, at) => at !== index);
                      focusRequest.current = Math.min(index, operands.length - 1);
                      return { ...leaf, operands };
                    });
                  }}
                />
              ) : null}
            </div>
          );
        })
      )}
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
                context.change(path, (node) => node, false, true, true);
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
                context.change(path, (node) => node, false, true, true);
              setWindowStart(Math.min(maxWindowStart, start + VISIBLE_OPERANDS));
            }}
          />
        </>
      ) : null}
      {draft.operator === "in" ? (
        <Button
          label="Add filter value"
          isDisabled={!mayAddOperand}
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!canAddOperand()) return;
            command((leaf) => {
              focusRequest.current = leaf.operands.length;
              setWindowStart(Math.max(0, leaf.operands.length - VISIBLE_OPERANDS + 1));
              return { ...leaf, operands: [...leaf.operands, { text: "", authored: false }] };
            });
          }}
        />
      ) : null}
      {error !== undefined &&
      (invalidIndex === undefined ||
        invalidIndex < start ||
        invalidIndex >= start + VISIBLE_OPERANDS) ? (
        <p role="status">{error}</p>
      ) : null}
      <Selector
        label="Operator"
        value={draft.operator}
        options={filterOperators(column)}
        onChange={(value) => {
          const operator = filterOperators(column).find((option) => option.value === value)?.value;
          if (operator !== undefined) {
            command((leaf) => ({ ...leaf, operator }));
          }
        }}
      />
      {column.semantics.filterFamily === "text" ? (
        <>
          <CheckboxInput
            label="Case sensitive"
            value={draft.caseSensitive}
            onChange={(caseSensitive) => command((leaf) => ({ ...leaf, caseSensitive }))}
          />
          <CheckboxInput
            label="Accent sensitive"
            value={draft.accentSensitive}
            onChange={(accentSensitive) => command((leaf) => ({ ...leaf, accentSensitive }))}
          />
        </>
      ) : null}
    </div>
  );
});

function SelectFilterOperand({
  column,
  selected,
  error,
  onChange,
}: {
  readonly column: CompiledColumn;
  readonly selected: number | undefined;
  readonly error: string | undefined;
  readonly onChange: (index: number) => void;
}) {
  const [windowStart, setWindowStart] = useState(0);
  const options = column.selectOptions ?? [];
  const maxStart = Math.max(0, options.length - VISIBLE_OPERANDS);
  const start = Math.min(windowStart, maxStart);
  const end = Math.min(start + VISIBLE_OPERANDS, options.length);
  const indexes = Array.from({ length: end - start }, (_, offset) => start + offset);
  if (selected !== undefined && (selected < start || selected >= end)) indexes.unshift(selected);
  const choices = indexes.map((index) => {
    let label: string;
    try {
      label = column.semantics
        .formatDisplay(options[index])
        .slice(0, ASTRYX_TABLE_MAX_FILTER_OPERAND_LENGTH);
    } catch {
      label = "<unavailable>";
    }
    return { value: String(index), label: label || "Empty value", index };
  });
  return (
    <>
      <Selector
        label="Filter value"
        placeholder="Choose a value"
        value={selected === undefined ? "" : String(selected)}
        options={choices}
        status={error === undefined ? undefined : { type: "error", message: error }}
        onChange={(value) => {
          const choice = choices.find((option) => option.value === value);
          if (choice !== undefined) onChange(choice.index);
        }}
      />
      {options.length > VISIBLE_OPERANDS ? (
        <>
          <span role="status">{`Showing options ${String(start + 1)}–${String(end)} of ${String(options.length)}`}</span>
          <Button
            label="Previous filter options"
            size="sm"
            variant="ghost"
            isDisabled={start === 0}
            onClick={() => setWindowStart(Math.max(0, start - VISIBLE_OPERANDS))}
          />
          <Button
            label="Next filter options"
            size="sm"
            variant="ghost"
            isDisabled={start === maxStart}
            onClick={() => setWindowStart(Math.min(maxStart, start + VISIBLE_OPERANDS))}
          />
        </>
      ) : null}
    </>
  );
}
