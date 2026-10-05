type Part = "chrome" | "body";
type Listener = (part: Part) => void;
const listeners = new Set<Listener>();
export function installAstryxTableSourceLifecycleRenderListener(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function recordAstryxTableSourceLifecycleRender(part: Part): void {
  for (const listener of listeners) {
    try {
      listener(part);
    } catch {
      /* Diagnostics never change runtime behavior. */
    }
  }
}
