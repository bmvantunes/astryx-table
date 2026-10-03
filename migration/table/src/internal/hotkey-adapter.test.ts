import { describe, expect, it } from "vitest";

import {
  ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_CELL_EDITOR_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_EDIT_MEMORY_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_ESCAPE_HOTKEYS,
  ASTRYX_TABLE_FILTER_WORKFLOW_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_GRID_DOCUMENT_ESCAPE_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_GRID_HOTKEYS,
  ASTRYX_TABLE_GRID_LOCAL_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_GROUP_BY_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_PASTE_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_REACT_HOTKEY_REGISTRATION_COUNT,
  ASTRYX_TABLE_ROW_SELECTION_HOTKEYS,
  ASTRYX_TABLE_ROW_SELECTION_HOTKEY_REGISTRATION_COUNT,
  astryxTableHotkeyRegistrationBound,
} from "./hotkey-adapter";

describe("AstryxTable hotkey Adapter contract", () => {
  it("keeps one table registration set bounded independently of rendered geometry", () => {
    expect(ASTRYX_TABLE_GRID_HOTKEYS).toContain("Mod+ArrowUp");
    expect(ASTRYX_TABLE_GRID_HOTKEYS).toContain("Mod+ArrowDown");
    expect(ASTRYX_TABLE_GRID_HOTKEYS).toContain("Escape");
    expect(ASTRYX_TABLE_GRID_HOTKEYS).toContain("Mod+C");
    expect(ASTRYX_TABLE_GRID_HOTKEYS).not.toContain("Mod+A");
    expect(ASTRYX_TABLE_ROW_SELECTION_HOTKEYS).toEqual(["Mod+A"]);
    expect(new Set(ASTRYX_TABLE_GRID_HOTKEYS).size).toBe(ASTRYX_TABLE_GRID_HOTKEYS.length);
    expect(astryxTableHotkeyRegistrationBound(1, 1)).toBe(
      astryxTableHotkeyRegistrationBound(10_000, 1_000),
    );
  });

  it("does not admit a per-cell, per-row, or per-header registration dimension", () => {
    expect(ASTRYX_TABLE_ESCAPE_HOTKEYS).toHaveLength(16);
    expect(ASTRYX_TABLE_GRID_HOTKEYS).toHaveLength(60);
    expect(ASTRYX_TABLE_GRID_LOCAL_HOTKEY_REGISTRATION_COUNT).toBe(44);
    expect(ASTRYX_TABLE_GRID_DOCUMENT_ESCAPE_HOTKEY_REGISTRATION_COUNT).toBe(16);
    expect(ASTRYX_TABLE_REACT_HOTKEY_REGISTRATION_COUNT).toBe(60);
    expect(ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT).toBe(60);
    expect(ASTRYX_TABLE_ROW_SELECTION_HOTKEY_REGISTRATION_COUNT).toBe(1);
    expect(ASTRYX_TABLE_FILTER_WORKFLOW_HOTKEY_REGISTRATION_COUNT).toBe(1);
    expect(ASTRYX_TABLE_GROUP_BY_HOTKEY_REGISTRATION_COUNT).toBe(2);
    expect(ASTRYX_TABLE_CELL_EDITOR_HOTKEY_REGISTRATION_COUNT).toBe(5);
    expect(ASTRYX_TABLE_EDIT_MEMORY_HOTKEY_REGISTRATION_COUNT).toBe(3);
    expect(ASTRYX_TABLE_PASTE_HOTKEY_REGISTRATION_COUNT).toBe(1);
    expect(astryxTableHotkeyRegistrationBound(0, 0)).toBe(
      ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT,
    );
    expect(astryxTableHotkeyRegistrationBound(0, 0, 1)).toBe(
      ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT +
        ASTRYX_TABLE_FILTER_WORKFLOW_HOTKEY_REGISTRATION_COUNT,
    );
    expect(astryxTableHotkeyRegistrationBound(0, 0, 0, true)).toBe(
      ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT +
        ASTRYX_TABLE_ROW_SELECTION_HOTKEY_REGISTRATION_COUNT,
    );
    expect(astryxTableHotkeyRegistrationBound(0, 0, 0, false, true)).toBe(
      ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT + ASTRYX_TABLE_GROUP_BY_HOTKEY_REGISTRATION_COUNT,
    );
    expect(astryxTableHotkeyRegistrationBound(0, 0, 0, false, false, true)).toBe(
      ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT +
        ASTRYX_TABLE_CELL_EDITOR_HOTKEY_REGISTRATION_COUNT,
    );
    expect(astryxTableHotkeyRegistrationBound(0, 0, 0, false, false, false, true)).toBe(
      ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT +
        ASTRYX_TABLE_EDIT_MEMORY_HOTKEY_REGISTRATION_COUNT,
    );
    expect(astryxTableHotkeyRegistrationBound(0, 0, 0, false, false, false, true, true)).toBe(
      ASTRYX_TABLE_BASE_HOTKEY_REGISTRATION_COUNT +
        ASTRYX_TABLE_EDIT_MEMORY_HOTKEY_REGISTRATION_COUNT +
        ASTRYX_TABLE_PASTE_HOTKEY_REGISTRATION_COUNT,
    );
  });
});
