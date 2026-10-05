import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import type { CompiledColumn } from "./compile-columns";
import { useClientContext } from "./client-context";
import { SetFilterView } from "./set-filter-view";
import {
  applyAstryxTableSetFilterCommand,
  createAstryxTableClientFacetStore,
  type AstryxTableSetFilterCommand,
} from "./client-facet";

export const ClientSetFilter = memo(function ClientSetFilter({
  column,
}: {
  readonly column: CompiledColumn;
}) {
  const { rows, runtime } = useClientContext();
  if (rows === undefined) throw new Error("Client facets require the complete Client source.");
  const store = useMemo(
    () => createAstryxTableClientFacetStore({ column, rows, runtime }),
    [column, rows, runtime],
  );
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
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
  return <SetFilterView column={column} snapshot={snapshot} publish={publish} />;
});
