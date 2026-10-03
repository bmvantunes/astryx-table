import type { AstryxTableGridCommand } from "./column-management";
import { installTableScopedListener } from "./listener-registry";

type GridCommandListener = (command: AstryxTableGridCommand) => void;

const listenersByTableId = new Map<string, Set<GridCommandListener>>();
let listenerCount = 0;

export function recordAstryxTableGridCommand(tableId: string, command: AstryxTableGridCommand): void {
  if (listenerCount === 0) return;
  const listeners = listenersByTableId.get(tableId);
  if (listeners === undefined) return;
  for (const listener of listeners) {
    try {
      listener(command);
    } catch {
      // Diagnostics are observational and must never alter command behavior.
    }
  }
}

export function installAstryxTableGridCommandListener(
  tableId: string,
  listener: GridCommandListener,
): () => void {
  return installTableScopedListener(
    listenersByTableId,
    tableId,
    listener,
    () => {
      listenerCount += 1;
    },
    () => {
      listenerCount -= 1;
    },
  );
}
