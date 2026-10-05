import type { AstryxTableRowPipelineRuntimeView } from "./grid-runtime";
import { compileClientFilterCollection } from "./grid-query";

/** Reads current column authority only when a command is issued; owns no subscription. */
export function createGridFilterCommands(runtime: AstryxTableRowPipelineRuntimeView) {
  const canFilter = (columnId: string) =>
    runtime
      .getQuerySnapshot()
      .columns.some((column) => column.columnId === columnId && column.enableFilter);
  return Object.freeze({
    replace: (filter: unknown): boolean => {
      let admitted: ReturnType<typeof compileClientFilterCollection>;
      try {
        admitted = compileClientFilterCollection([filter], runtime.getQuerySnapshot().columns);
      } catch {
        return false;
      }
      if (admitted.columnIds.size !== 1 || admitted.filters.length !== 1) return false;
      const columnId = admitted.columnIds.values().next().value;
      const value = admitted.filters[0];
      return (
        columnId !== undefined &&
        value !== undefined &&
        runtime.dispatchGridCommand({ type: "column.filter.replace", columnId, filter: value })
      );
    },
    clear: (columnId: string): boolean =>
      canFilter(columnId) && runtime.dispatchGridCommand({ type: "column.filter.clear", columnId }),
    reset: (columnId: string): boolean =>
      canFilter(columnId) && runtime.dispatchGridCommand({ type: "column.filter.reset", columnId }),
    clearAll: (): boolean => runtime.dispatchGridCommand({ type: "column.filters.clear" }),
  });
}
