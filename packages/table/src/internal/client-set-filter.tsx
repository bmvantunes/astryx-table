import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import type { CompiledColumn } from "./compile-columns";
import type { AstryxTableClientFacetRowsSource } from "./client-source-adapter";
import type { AstryxTableRowPipelineRuntimeView } from "./grid-runtime";
import { normalizeAstryxTableFilterText } from "./grid-query";
import { astryxTableSetValueKey } from "./set-value-identity";
import {
  applyAstryxTableSetFilterCommand,
  createAstryxTableClientFacetStore,
  createAstryxTableSetValueIndex,
  hasAstryxTableSetValue,
  type AstryxTableSetFilterCommand,
} from "./client-facet";

export const ClientFacetContext = createContext<
  | Readonly<{ rows: AstryxTableClientFacetRowsSource; runtime: AstryxTableRowPipelineRuntimeView }>
  | undefined
>(undefined);
const WINDOW_SIZE = 64;
const styles = stylex.create({
  section: { display: "flex", flexDirection: "column", gap: 8 },
  options: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 224, overflowY: "auto" },
  actions: { display: "flex", gap: 4 },
});

export const ClientSetFilter = memo(function ClientSetFilter({
  column,
}: {
  readonly column: CompiledColumn;
}) {
  const context = useContext(ClientFacetContext);
  if (context === undefined) throw new Error("Client facet source is missing.");
  const { rows, runtime } = context;
  const store = useMemo(
    () => createAstryxTableClientFacetStore({ column, rows, runtime }),
    [column, rows, runtime],
  );
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [search, setSearch] = useState("");
  const [windowStart, setWindowStart] = useState(0);
  const normalized = normalizeAstryxTableFilterText(search);
  const matching = useMemo(
    () =>
      normalized.length === 0
        ? snapshot.options
        : snapshot.options.filter((option) =>
            normalizeAstryxTableFilterText(option.display).includes(normalized),
          ),
    [normalized, snapshot.options],
  );
  const maxStart = Math.max(0, matching.length - WINDOW_SIZE);
  const start = Math.min(windowStart, maxStart);
  const intentIndex = useMemo(
    () =>
      createAstryxTableSetValueIndex(
        column,
        snapshot.intent.kind === "all" ? [] : snapshot.intent.values,
      ),
    [column, snapshot.intent],
  );
  const selected = (value: unknown) =>
    snapshot.intent.kind === "all" ||
    (snapshot.intent.kind === "include"
      ? hasAstryxTableSetValue(column, intentIndex, value)
      : !hasAstryxTableSetValue(column, intentIndex, value));
  const evidence = useMemo(() => {
    const counts = new Map<string, number>();
    snapshot.options.forEach((option) => {
      const label = normalizeAstryxTableFilterText(option.display || "Empty value");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return new Map(
      snapshot.options.map((option, index) => [
        option,
        (counts.get(normalizeAstryxTableFilterText(option.display || "Empty value")) ?? 0) > 1
          ? `, option ${String(index + 1)} of ${String(snapshot.options.length)}`
          : "",
      ]),
    );
  }, [snapshot.options]);
  const publish = useCallback(
    (command: AstryxTableSetFilterCommand) => {
      // Read at the gesture boundary, so a live publication cannot leave the command with stale intent.
      const current = store.getSnapshot();
      const filter = applyAstryxTableSetFilterCommand(
        column,
        current.intent,
        current.options.filter((option) => option.count > 0).map((option) => option.value),
        command,
      );
      runtime.dispatchGridCommand(
        filter === undefined
          ? { type: "column.filter.clear", columnId: column.columnId }
          : { type: "column.filter.replace", columnId: column.columnId, filter },
      );
    },
    [column, runtime, store],
  );
  const chosen = snapshot.options.filter((option) => selected(option.value));
  return (
    <section {...stylex.props(styles.section)} aria-label="Values">
      <strong>Values</strong>
      <span role="status">
        {snapshot.intent.kind === "all"
          ? "All selected"
          : snapshot.intent.kind === "include"
            ? `${String(snapshot.intent.values.length)} selected`
            : `All except ${String(snapshot.intent.values.length)} selected`}
      </span>
      {chosen.length === 0 ? null : (
        <div aria-label="Selected values">
          {chosen
            .slice(0, 3)
            .map((option) => `${option.display} · ${String(option.count)}`)
            .join("; ")}
          {chosen.length > 3 ? `; +${String(chosen.length - 3)}` : ""}
        </div>
      )}
      <TextInput
        type="search"
        label={`Search values for ${column.headerName}`}
        value={search}
        onChange={(value) => {
          setSearch(value);
          setWindowStart(0);
        }}
      />
      <div {...stylex.props(styles.actions)}>
        <Button
          label="Select All"
          size="sm"
          variant="ghost"
          onClick={() => publish({ type: "select-all" })}
        />
        <Button
          label="Clear All"
          size="sm"
          variant="ghost"
          onClick={() => publish({ type: "clear-all" })}
        />
      </div>
      {matching.length === 0 ? (
        <p role="status">No values found. Try a different search.</p>
      ) : (
        <div {...stylex.props(styles.options)} role="group" aria-label="Filter values">
          {matching.slice(start, start + WINDOW_SIZE).map((option) => (
            <SetFilterOption
              key={
                astryxTableSetValueKey(column, option.value) ??
                `${typeof option.value}:${String(option.value)}`
              }
              label={`Select ${option.display || "Empty value"}, ${String(option.count)}${evidence.get(option) ?? ""}`}
              value={option.value}
              selected={selected(option.value)}
              publish={publish}
            />
          ))}
        </div>
      )}
      {matching.length <= WINDOW_SIZE ? null : (
        <div {...stylex.props(styles.actions)}>
          <Button
            label="Previous values"
            size="sm"
            variant="ghost"
            isDisabled={start === 0}
            onClick={() => setWindowStart(Math.max(0, start - WINDOW_SIZE))}
          />
          <span role="status">{`${String(start + 1)}–${String(Math.min(matching.length, start + WINDOW_SIZE))} of ${String(matching.length)}`}</span>
          <Button
            label="Next values"
            size="sm"
            variant="ghost"
            isDisabled={start === maxStart}
            onClick={() => setWindowStart(Math.min(maxStart, start + WINDOW_SIZE))}
          />
        </div>
      )}
    </section>
  );
});

// Facet snapshots are immutable and may recreate option records. Subscribe this
// boundary to their exact presentation values, so unrelated updates skip native controls.
const SetFilterOption = memo(function SetFilterOption({
  value,
  label,
  selected,
  publish,
}: {
  readonly value: unknown;
  readonly label: string;
  readonly selected: boolean;
  readonly publish: (command: AstryxTableSetFilterCommand) => void;
}) {
  return (
    <CheckboxInput
      label={label}
      value={selected}
      onChange={(checked) => publish({ type: "toggle", value, selected: checked })}
    />
  );
});
