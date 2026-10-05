import { act } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, type AstryxTableColumns } from "../packages/table/src";
import { getHotkeyManager } from "@tanstack/react-hotkeys";
import "./styles.css";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
type Row = { id: string; name: string; amount: bigint };
const rows: Row[] = [
  { id: "a", name: "Ada", amount: 9007199254740993n },
  { id: "b", name: "Alan", amount: 9007199254740995n },
  { id: "c", name: "Grace", amount: 9007199254740997n },
];
const columns = [
  {
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    valueType: "text",
    width: 120,
    groupBy: true,
  },
  {
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    valueType: "bigint",
    width: 120,
    valueFormatter: () => "Formatted amount",
    aggFunc: "sum",
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "range",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: { rows, totalRows: rows.length, version: 1, status: "ready" as const },
};
test("iframe range highlighting uses its owning document", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  let view: Awaited<ReturnType<typeof render>> | undefined;
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  try {
    const owner = frame.contentDocument!;
    const realm = owner.defaultView!;
    const container = owner.createElement("div");
    owner.body.append(container);
    view = await render(<AstryxTableClient {...props} />, { container, baseElement: owner.body });
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    const grid = owner.querySelector<HTMLElement>('[role="grid"]')!;
    await act(async () => {
      grid.focus();
      grid.dispatchEvent(
        new realm.KeyboardEvent("keydown", {
          key: "ArrowDown",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const activeId = grid.getAttribute("aria-activedescendant");
    expect(owner.getElementById(activeId!)?.textContent).toBe("Alan");
    await expect
      .poll(() => grid.querySelectorAll('[role="gridcell"][aria-selected="true"]').length)
      .toBe(2);
    await act(async () => {
      grid.dispatchEvent(
        new realm.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    await expect
      .poll(() => grid.querySelectorAll('[role="gridcell"][aria-selected="true"]').length)
      .toBe(1);
  } finally {
    await view?.unmount();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
    frame.remove();
  }
});

for (const scope of ["element", "document", "window"] as const) {
  test(`TanStack iframe ${scope} scope preserves input exclusion, ownership and cleanup`, () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const owner = frame.contentDocument!;
    const realm = owner.defaultView!;
    const container = owner.createElement("section");
    const child = owner.createElement("button");
    const input = owner.createElement("input");
    const textarea = owner.createElement("textarea");
    const select = owner.createElement("select");
    const editable = owner.createElement("div");
    editable.contentEditable = "true";
    const shadowHost = owner.createElement("div");
    const shadowInput = owner.createElement("input");
    shadowHost.attachShadow({ mode: "open" }).append(shadowInput);
    container.append(child, input, textarea, select, editable, shadowHost);
    owner.body.append(container);
    const callback = vi.fn();
    const registration = getHotkeyManager().register("Alt+K", callback, {
      target: scope === "element" ? container : scope === "document" ? owner : realm,
      ignoreInputs: true,
      requireReset: false,
      conflictBehavior: "error",
    });
    const send = (target: HTMLElement) => {
      target.focus();
      target.dispatchEvent(
        new realm.KeyboardEvent("keydown", {
          key: "k",
          altKey: true,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      );
    };
    try {
      send(child);
      expect(callback).toHaveBeenCalledTimes(1);
      for (const control of [input, textarea, select, editable, shadowInput]) send(control);
      expect(callback).toHaveBeenCalledTimes(1);
      send(child);
      expect(callback).toHaveBeenCalledTimes(2);
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", altKey: true, bubbles: true }),
      );
      expect(callback).toHaveBeenCalledTimes(2);
      registration.unregister();
      send(child);
      expect(callback).toHaveBeenCalledTimes(2);
    } finally {
      registration.unregister();
      frame.remove();
    }
  });
}
