import { expect, test, vi } from "vite-plus/test";
import {
  installAstryxTableToolbarLifetimeListener,
  installAstryxTableToolbarSubscriptionListener,
  recordAstryxTableToolbarLifetime,
  recordAstryxTableToolbarSubscription,
} from "../packages/table/src/internal/toolbar-instrumentation";

test("throwing toolbar diagnostics cannot interrupt lifetime events or later observers", () => {
  const event = { tableId: "diagnostics", kind: "row-pipeline-subscribe" as const, identity: {} };
  const later = vi.fn();
  const disposeThrowing = installAstryxTableToolbarLifetimeListener(() => {
    throw new Error("observer failed");
  });
  const disposeLater = installAstryxTableToolbarLifetimeListener(later);
  try {
    expect(() => recordAstryxTableToolbarLifetime(event)).not.toThrow();
    expect(later).toHaveBeenCalledExactlyOnceWith(event);
  } finally {
    disposeThrowing();
    disposeLater();
  }
});

test("throwing toolbar diagnostics cannot interrupt subscription events or later observers", () => {
  const event = {
    tableId: "diagnostics",
    projection: "result-row-count" as const,
    phase: "subscribe" as const,
  };
  const later = vi.fn();
  const disposeThrowing = installAstryxTableToolbarSubscriptionListener(() => {
    throw new Error("observer failed");
  });
  const disposeLater = installAstryxTableToolbarSubscriptionListener(later);
  try {
    expect(() => recordAstryxTableToolbarSubscription(event)).not.toThrow();
    expect(later).toHaveBeenCalledExactlyOnceWith(event);
  } finally {
    disposeThrowing();
    disposeLater();
  }
});
