type Part = "visibility" | "reset";
type Listener = (part: Part) => void;
const listeners = new Set<Listener>();
export function installAstryxTableColumnSettingsRenderListener(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function recordAstryxTableColumnSettingsRender(part: Part): void {
  for (const listener of listeners) {
    try {
      listener(part);
    } catch {
      /* Diagnostics never change runtime behavior. */
    }
  }
}
