import { Store } from "@tanstack/store";
import { assign, createActor, createMachine } from "xstate";

export type AstryxTableColumnGestureKind = "resize" | "reorder";

type AstryxTableColumnGestureEvent =
  | Readonly<{
      readonly type: "START";
      readonly kind: AstryxTableColumnGestureKind;
    }>
  | Readonly<{ readonly type: "COMMIT" }>
  | Readonly<{ readonly type: "CANCEL" }>
  | Readonly<{ readonly type: "INVALIDATE" }>;

type AstryxTableColumnGestureContext = Readonly<{
  readonly kind: AstryxTableColumnGestureKind | undefined;
}>;

const astryxTableColumnGestureMachine = createMachine({
  id: "astryxTableColumnGesture",
  initial: "idle",
  types: {} as {
    context: AstryxTableColumnGestureContext;
    events: AstryxTableColumnGestureEvent;
  },
  context: { kind: undefined },
  states: {
    idle: {
      on: {
        START: {
          target: "active",
          actions: assign({ kind: ({ event }) => event.kind }),
        },
      },
    },
    active: {
      on: {
        COMMIT: { target: "idle", actions: assign({ kind: undefined }) },
        CANCEL: { target: "idle", actions: assign({ kind: undefined }) },
        INVALIDATE: { target: "idle", actions: assign({ kind: undefined }) },
      },
    },
  },
});

export type AstryxTableColumnGestureSnapshot = Readonly<{
  readonly value: "idle" | "active";
  readonly status: "active" | "done" | "error" | "stopped";
  readonly kind: AstryxTableColumnGestureKind | undefined;
}>;

export type AstryxTableColumnGestureActor = Readonly<{
  readonly start: () => void;
  readonly stop: () => void;
  readonly send: (event: AstryxTableColumnGestureEvent) => void;
  readonly getSnapshot: () => AstryxTableColumnGestureSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
}>;

export function createAstryxTableColumnGestureActor(): AstryxTableColumnGestureActor {
  let actor = createActor(astryxTableColumnGestureMachine);
  const initialSnapshot = Object.freeze({
    value: "idle" as const,
    status: "stopped" as const,
    kind: undefined,
  });
  const projection = new Store<AstryxTableColumnGestureSnapshot>(initialSnapshot);
  let started = false;
  let stopped = false;
  const readProjection = (): AstryxTableColumnGestureSnapshot => {
    const snapshot = actor.getSnapshot();
    return Object.freeze({
      value: snapshot.value === "active" ? "active" : "idle",
      status: snapshot.status,
      kind: snapshot.context.kind,
    });
  };
  const publishProjection = (): void => {
    const next = readProjection();
    const previous = projection.get();
    if (
      previous.value === next.value &&
      previous.status === next.status &&
      previous.kind === next.kind
    ) {
      return;
    }
    projection.setState(() => next);
  };
  let actorSubscription = actor.subscribe(publishProjection);
  return Object.freeze({
    start: () => {
      if (!started) {
        if (stopped) {
          actorSubscription.unsubscribe();
          actor = createActor(astryxTableColumnGestureMachine);
          actorSubscription = actor.subscribe(publishProjection);
          stopped = false;
        }
        started = true;
        actor.start();
      }
      publishProjection();
    },
    stop: () => {
      if (started) {
        started = false;
        stopped = true;
        actor.stop();
      }
      publishProjection();
    },
    send: (event: AstryxTableColumnGestureEvent) => {
      if (!started) return;
      actor.send(event);
      publishProjection();
    },
    getSnapshot: () => {
      return projection.get();
    },
    subscribe: (listener) => {
      const subscription = projection.subscribe(listener);
      return () => subscription.unsubscribe();
    },
  });
}
