import { memo, useCallback, useSyncExternalStore, type ReactNode } from "react";
import { Text } from "@astryxdesign/core/Text";
import {
  recordAstryxTableToolbarLifetime,
  recordAstryxTableToolbarSubscription,
  type AstryxTableToolbarProjection,
} from "./internal/toolbar-instrumentation";
import { useClientContext } from "./internal/client-context";

type CountProps = Readonly<{ children?: ((count: number) => ReactNode) | undefined }>;

/** The complete filtered Client result, independent of the mounted virtual window. */
export const AstryxTableResultRowCount = memo(function AstryxTableResultRowCount({
  children,
}: CountProps) {
  const { resultRows, runtime, tableId } = useClientContext();
  const snapshot = useCallback(() => {
    const initialized = resultRows.initializeResultRowCount(
      runtime.getQuerySnapshot(),
      runtime.getRowSpaceSnapshot(),
    );
    if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__ && initialized)
      recordAstryxTableToolbarLifetime({
        tableId,
        kind: "result-row-count-initialize",
        identity: resultRows,
      });
    return resultRows.getResultRowCountSnapshot();
  }, [resultRows, runtime, tableId]);
  const subscribe = useCountSubscription("result-row-count", resultRows.subscribeResultRowCount);
  const count = useSyncExternalStore(subscribe, snapshot, snapshot);
  return renderCount("Result rows", "result row", count, children);
});

/** The number of resident source rows, before Client filters. */
export const AstryxTableLoadedRowCount = memo(function AstryxTableLoadedRowCount({
  children,
}: CountProps) {
  const { runtime } = useClientContext();
  const subscribe = useCountSubscription("loaded-row-count", runtime.subscribeLoadedRowCount);
  const count = useSyncExternalStore(
    subscribe,
    runtime.getLoadedRowCountSnapshot,
    runtime.getLoadedRowCountSnapshot,
  );
  return renderCount("Loaded rows", "loaded row", count, children);
});

function renderCount(
  label: string,
  singular: string,
  count: number,
  children: CountProps["children"],
) {
  return (
    <output role="status" aria-label={label}>
      {children === undefined ? (
        <Text
          type="supporting"
          color="secondary"
          hasTabularNumbers
        >{`${String(count)} ${count === 1 ? singular : label.toLowerCase()}`}</Text>
      ) : (
        children(count)
      )}
    </output>
  );
}

function useCountSubscription(
  projection: AstryxTableToolbarProjection,
  source: (listener: () => void) => () => void,
) {
  const { tableId } = useClientContext();
  return useCallback(
    (listener: () => void) => {
      if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
        recordAstryxTableToolbarSubscription({ tableId, projection, phase: "subscribe" });
      const unsubscribe = source(() => {
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
          recordAstryxTableToolbarSubscription({ tableId, projection, phase: "notify" });
        listener();
      });
      return () => {
        unsubscribe();
        if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__)
          recordAstryxTableToolbarSubscription({ tableId, projection, phase: "unsubscribe" });
      };
    },
    [projection, source, tableId],
  );
}
