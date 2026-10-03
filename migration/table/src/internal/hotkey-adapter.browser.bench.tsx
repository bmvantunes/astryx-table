import { afterAll, beforeAll, bench, describe } from "vite-plus/test";
import { cleanup, render } from "vitest-browser-react";
import { getHotkeyManager } from "@tanstack/react-hotkeys";
import { useRef, useState } from "react";

import {
  ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_REACT_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_ROW_SELECTION_HOTKEY_REGISTRATION_COUNT,
  useAstryxTableGridHotkeys,
  type AstryxTableGridHotkeyCommands,
} from "./hotkey-adapter";
import { compileColumns } from "./compile-columns";
import { AstryxTableNavigationRuntime } from "./navigation";

let owner: HTMLElement;
let dispatchedCommands = 0;

function AdapterBenchmarkProbe() {
  const ownerRef = useRef<HTMLElement>(null);
  const [navigation] = useState(() => {
    const runtime = new AstryxTableNavigationRuntime();
    runtime.setShape(
      Object.freeze({
        totalRows: 10_000,
        getRowId: (index: number) => `row-${String(index)}`,
        findRowIndex: (rowId: string) => Number(rowId.slice(4)),
      }),
      compileColumns([
        {
          columnId: "COL_ID_ADAPTER_BROWSER_BENCHMARK",
          field: "value",
          headerName: "Adapter Browser benchmark",
          valueType: "text",
        },
      ]),
    );
    return runtime;
  });
  const commands: AstryxTableGridHotkeyCommands = {
    escape: () => undefined,
    shiftTab: () => undefined,
    headerMenu: () => undefined,
    copy: () => undefined,
    selectAll: () => undefined,
    resize: () => undefined,
    activate: () => undefined,
    navigate: (_event, command) => {
      dispatchedCommands += 1;
      navigation.navigate(command);
    },
    page: () => undefined,
  };
  useAstryxTableGridHotkeys(ownerRef, commands);
  return (
    <section
      ref={ownerRef}
      role="region"
      aria-label="Adapter Browser benchmark"
      data-astryx-table="adapter-browser-benchmark"
    />
  );
}

beforeAll(async () => {
  const baselineRegistrations = getHotkeyManager().registrations.state.size;
  const screen = await render(<AdapterBenchmarkProbe />);
  const candidate = screen.getByRole("region", { name: "Adapter Browser benchmark" }).element();
  if (!(candidate instanceof HTMLElement)) throw new Error("Expected an HTML benchmark owner.");
  owner = candidate;
  if (
    getHotkeyManager().registrations.state.size !==
    baselineRegistrations +
      ASTRYX_TABLE_REACT_HOTKEY_REGISTRATION_COUNT +
      ASTRYX_TABLE_ROW_SELECTION_HOTKEY_REGISTRATION_COUNT
  ) {
    throw new Error("The Browser benchmark did not mount the complete table registration set.");
  }
  if (
    ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT +
      ASTRYX_TABLE_ROW_SELECTION_HOTKEY_REGISTRATION_COUNT !==
    61
  ) {
    throw new Error("The Browser benchmark registration-definition bound changed unexpectedly.");
  }
});

afterAll(async () => {
  await cleanup();
});

describe("AstryxTable real-listener Adapter dispatch benchmark (8.33 ms/120 Hz reference)", () => {
  let direction: "ArrowDown" | "ArrowUp" = "ArrowDown";
  bench(
    "matches and dispatches 100 held-arrow events through TanStack and the Adapter",
    () => {
      const before = dispatchedCommands;
      for (let gesture = 0; gesture < 100; gesture += 1) {
        owner.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: direction, repeat: true }),
        );
      }
      direction = direction === "ArrowDown" ? "ArrowUp" : "ArrowDown";
      if (dispatchedCommands - before !== 100) {
        throw new Error("The Adapter did not dispatch exactly once per held-key repeat unit.");
      }
    },
    { iterations: 100, time: 0, warmupIterations: 0, warmupTime: 0 },
  );
});
