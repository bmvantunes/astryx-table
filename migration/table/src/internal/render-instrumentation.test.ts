import { describe, expect, it, vi } from "vitest";

import {
  hasAstryxTableClientDragFillFrameListener,
  installAstryxTableClientDragFillFrameListener,
  recordAstryxTableClientDragFillFrame,
} from "./render-instrumentation";
import { ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL } from "./test-diagnostic-build-contract";

describe("AstryxTable Drag Fill frame instrumentation", () => {
  it("records table-scoped frame lifecycle evidence only while a listener is installed", () => {
    const listener = vi.fn();

    expect(hasAstryxTableClientDragFillFrameListener("orders")).toBe(false);
    recordAstryxTableClientDragFillFrame("orders", {
      phase: "scheduled",
      frameId: 11,
    });
    expect(listener).not.toHaveBeenCalled();

    const dispose = installAstryxTableClientDragFillFrameListener("orders", listener);
    try {
      expect(hasAstryxTableClientDragFillFrameListener("orders")).toBe(true);
      expect(hasAstryxTableClientDragFillFrameListener("inventory")).toBe(false);

      recordAstryxTableClientDragFillFrame("inventory", {
        phase: "scheduled",
        frameId: 12,
      });
      recordAstryxTableClientDragFillFrame("orders", {
        phase: "scheduled",
        frameId: 13,
      });
      recordAstryxTableClientDragFillFrame("orders", {
        phase: "ran",
        frameId: 13,
        durationMs: 1.25,
      });

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenNthCalledWith(1, {
        tableId: "orders",
        diagnosticBuildContract: ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL,
        phase: "scheduled",
        frameId: 13,
      });
      expect(listener).toHaveBeenNthCalledWith(2, {
        tableId: "orders",
        diagnosticBuildContract: ASTRYX_TABLE_GESTURE_TIMING_DIAGNOSTIC_SENTINEL,
        phase: "ran",
        frameId: 13,
        durationMs: 1.25,
      });

      dispose();
      expect(hasAstryxTableClientDragFillFrameListener("orders")).toBe(false);
      recordAstryxTableClientDragFillFrame("orders", {
        phase: "cancelled",
        frameId: 14,
      });
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      dispose();
    }
  });

  it("keeps diagnostics observational when one listener throws", () => {
    const throwing = () => {
      throw new Error("diagnostic failure");
    };
    const survivor = vi.fn();
    const disposeThrowing = installAstryxTableClientDragFillFrameListener("orders", throwing);
    const disposeSurvivor = installAstryxTableClientDragFillFrameListener("orders", survivor);
    try {
      expect(() =>
        recordAstryxTableClientDragFillFrame("orders", {
          phase: "ran",
          frameId: 21,
          durationMs: 0.5,
        }),
      ).not.toThrow();
      expect(survivor).toHaveBeenCalledOnce();
    } finally {
      disposeSurvivor();
      disposeThrowing();
    }
  });
});
