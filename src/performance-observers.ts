// Mutation observers run after React/RAF callbacks. Charge them separately so
// asynchronous focus projection remains separate from React and RAF work.
// Includes native-control and harness observers conservatively during sampling.
export function measureMutationObserverWork(onWork?: (durationMs: number) => void) {
  const NativeObserver = window.MutationObserver;
  let durationMs = 0;
  window.MutationObserver = class extends NativeObserver {
    constructor(callback: MutationCallback) {
      super((records, observer) => {
        const started = performance.now();
        try {
          callback(records, observer);
        } finally {
          const elapsed = performance.now() - started;
          durationMs += elapsed;
          onWork?.(elapsed);
        }
      });
    }
  };
  return {
    take() {
      const result = durationMs;
      durationMs = 0;
      return result;
    },
    restore() {
      window.MutationObserver = NativeObserver;
    },
  };
}
