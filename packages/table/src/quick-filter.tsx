import { memo, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useDebouncer } from "@tanstack/react-pacer";
import { useClientContext } from "./internal/client-context";
import type { AstryxTableRuntimeView } from "./internal/grid-runtime";
import { recordAstryxTableClientQuickFilterRender } from "./internal/render-instrumentation";
import {
  ASTRYX_TABLE_MAX_QUICK_FILTER_LENGTH,
  boundAstryxTableQuickFilterText,
  isAstryxTableQuickFilterTextWithinLimit,
} from "./internal/quick-filter";

/** Session-only search over the Client's explicit quickFilterFields. */
export const AstryxTableQuickFilter = memo(function AstryxTableQuickFilter() {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableClientQuickFilterRender();
  const { runtime } = useClientContext();
  const fields = useSyncExternalStore(
    runtime.subscribeQuickFilter,
    runtime.getQuickFilterFieldsSnapshot,
    runtime.getQuickFilterFieldsSnapshot,
  );
  const committed = useSyncExternalStore(
    runtime.subscribeQuickFilter,
    runtime.getQuickFilterSnapshot,
    runtime.getQuickFilterSnapshot,
  );
  if (fields.length === 0) {
    if (__ASTRYX_TABLE_DEVELOPMENT__)
      throw new TypeError(
        "AstryxTableQuickFilter requires AstryxTableClient quickFilterFields to be configured.",
      );
    return null;
  }
  return <QuickFilterInput initialValue={committed} runtime={runtime} />;
});

const QuickFilterInput = memo(function QuickFilterInput({
  initialValue,
  runtime,
}: {
  readonly initialValue: string;
  readonly runtime: AstryxTableRuntimeView;
}) {
  if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableClientQuickFilterRender();
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState<string | undefined>(undefined);
  const draftRef = useRef(initialValue);
  const lastCommitted = useRef(initialValue);
  const draftEpoch = useRef(0);
  const composition = useRef<{
    nextToken: number;
    activeToken: number | undefined;
    invalidatedToken: number | undefined;
  }>({ nextToken: 0, activeToken: undefined, invalidatedToken: undefined });
  const publish = useCallback(
    (candidate: {
      readonly text: string;
      readonly commandEpoch: number;
      readonly draftEpoch: number;
    }) => {
      if (
        runtime.getQuickFilterCommandEpochSnapshot() !== candidate.commandEpoch ||
        draftEpoch.current !== candidate.draftEpoch
      )
        return false;
      if (!isAstryxTableQuickFilterTextWithinLimit(candidate.text)) {
        draftEpoch.current++;
        draftRef.current = lastCommitted.current;
        setDraft(lastCommitted.current);
        setError("Quick Filter text is too long.");
        return false;
      }
      const accepted = runtime.dispatchGridCommand({
        type: "quick-filter.replace",
        text: candidate.text,
      });
      if (!accepted) {
        const committed = runtime.getQuickFilterSnapshot();
        lastCommitted.current = committed;
        draftRef.current = committed;
        setDraft(committed);
        setError("Quick Filter could not be committed.");
        return false;
      }
      lastCommitted.current = candidate.text;
      setError(undefined);
      return true;
    },
    [runtime],
  );
  const debouncer = useDebouncer(publish, { wait: 150 });
  useLayoutEffect(() => {
    debouncer.cancel();
    if (lastCommitted.current === initialValue) return;
    lastCommitted.current = initialValue;
    if (draftRef.current === initialValue) return;
    draftRef.current = initialValue;
    setDraft(initialValue);
  }, [debouncer, initialValue]);
  useLayoutEffect(
    () =>
      runtime.registerQuickFilterInvalidation(() => {
        debouncer.cancel();
        draftEpoch.current++;
        const session = composition.current;
        if (session.activeToken !== undefined) session.invalidatedToken = session.activeToken;
        const committed = runtime.getQuickFilterSnapshot();
        lastCommitted.current = committed;
        setError(undefined);
        if (draftRef.current === committed) return;
        draftRef.current = committed;
        setDraft(committed);
      }),
    [debouncer, runtime],
  );
  useLayoutEffect(() => () => debouncer.cancel(), [debouncer]);
  const queue = (value: string) => {
    const text = boundAstryxTableQuickFilterText(value);
    draftEpoch.current++;
    draftRef.current = text;
    setDraft(text);
    if (composition.current.activeToken !== undefined) return;
    debouncer.maybeExecute({
      text,
      commandEpoch: runtime.getQuickFilterCommandEpochSnapshot(),
      draftEpoch: draftEpoch.current,
    });
  };
  return (
    <TextInput
      label="Quick Filter"
      isLabelHidden
      placeholder="Quick Filter"
      type="search"
      width={224}
      maxLength={ASTRYX_TABLE_MAX_QUICK_FILTER_LENGTH}
      value={draft}
      hasClear
      status={error === undefined ? undefined : { type: "error", message: error }}
      onCompositionStart={() => {
        const session = composition.current;
        session.nextToken++;
        session.activeToken = session.nextToken;
        session.invalidatedToken = undefined;
        draftEpoch.current++;
        debouncer.cancel();
      }}
      onCompositionEnd={(event) => {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        const session = composition.current;
        const token = session.activeToken;
        session.activeToken = undefined;
        if (token !== undefined && session.invalidatedToken === token) {
          session.invalidatedToken = undefined;
          input.value = draftRef.current;
          return;
        }
        queue(input.value);
      }}
      onChange={(value: string, event: ChangeEvent<HTMLInputElement> | null) => {
        // Core 0.6.5's native Clear passes null despite its declared ChangeEvent (ASTRYX-006).
        if (event === null) {
          debouncer.cancel();
          const session = composition.current;
          if (session.activeToken !== undefined) session.invalidatedToken = session.activeToken;
          draftEpoch.current++;
          draftRef.current = "";
          setDraft("");
          publish({
            text: "",
            commandEpoch: runtime.getQuickFilterCommandEpochSnapshot(),
            draftEpoch: draftEpoch.current,
          });
          return;
        }
        const session = composition.current;
        if (session.activeToken !== undefined && session.invalidatedToken === session.activeToken) {
          event.currentTarget.value = draftRef.current;
          return;
        }
        queue(value);
      }}
    />
  );
});
