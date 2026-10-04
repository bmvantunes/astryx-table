type Listener = (part: "trigger" | "review") => void;
const listeners = new Set<Listener>();
export function installAstryxTableActiveFilterRenderListener(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function recordAstryxTableActiveFilterRender(part: "trigger" | "review"): void {
  for (const listener of listeners) {
    try {
      listener(part);
    } catch {
      /* Diagnostics never change runtime behavior. */
    }
  }
}
