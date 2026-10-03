export type AstryxTableToolbarProjection =
  | "result-row-count"
  | "loaded-row-count"
  | "active-filter-count"
  | "active-sort-count";

export type AstryxTableToolbarSubscriptionEvent = Readonly<{
  readonly tableId: string;
  readonly projection: AstryxTableToolbarProjection;
  readonly phase: "subscribe" | "unsubscribe" | "notify";
}>;

const subscriptionListeners = new Set<(event: AstryxTableToolbarSubscriptionEvent) => void>();
export type AstryxTableToolbarLifetimeEvent = Readonly<{
  readonly tableId: string;
  readonly kind:
    | "runtime-create"
    | "row-pipeline-subscribe"
    | "row-pipeline-unsubscribe"
    | "result-row-count-initialize"
    | "result-row-count-project";
  readonly identity: object;
}>;

const lifetimeListeners = new Set<(event: AstryxTableToolbarLifetimeEvent) => void>();

export function installAstryxTableToolbarSubscriptionListener(
  next: (event: AstryxTableToolbarSubscriptionEvent) => void,
): () => void {
  subscriptionListeners.add(next);
  return () => subscriptionListeners.delete(next);
}

export function installAstryxTableToolbarLifetimeListener(
  next: (event: AstryxTableToolbarLifetimeEvent) => void,
): () => void {
  lifetimeListeners.add(next);
  return () => lifetimeListeners.delete(next);
}

export function recordAstryxTableToolbarSubscription(
  event: AstryxTableToolbarSubscriptionEvent,
): void {
  for (const listener of subscriptionListeners) {
    try {
      listener(event);
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}

export function recordAstryxTableToolbarLifetime(event: AstryxTableToolbarLifetimeEvent): void {
  for (const listener of lifetimeListeners) {
    try {
      listener(event);
    } catch {
      // Diagnostics are observational and must never alter runtime behavior.
    }
  }
}
