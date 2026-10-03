import { describe, expect, test, vi } from "vite-plus/test";

import {
  createAstryxTableCellRangeStructure,
  serializeAstryxTableClipboardSnapshot,
} from "./cell-range-clipboard";
import {
  ASTRYX_TABLE_PASTE_MAX_LINEAR_CELLS,
  ASTRYX_TABLE_PASTE_MAX_TEXT_CODE_UNITS,
  AstryxTablePasteRuntime,
  createAstryxTablePasteActor,
  createAstryxTablePasteCoordinateEvidence,
  createAstryxTablePasteDiagnostic,
  createAstryxTablePasteGesture,
  formatAstryxTablePasteDiagnostic,
  parseAstryxTablePaste,
  projectAstryxTablePasteTarget,
  sameAstryxTablePasteTarget,
} from "./cell-paste";

const structure = createAstryxTableCellRangeStructure(
  ["row-a", "row-b", "row-c"],
  ["name", "score", "note"],
);

describe("AstryxTable Cell Paste", () => {
  test("parses canonical quoted TSV without inferring values", () => {
    expect(parseAstryxTablePaste('"1\t2"\t"a""b"\r\n')).toEqual({
      kind: "accepted",
      paste: { axis: "horizontal", canonicalTexts: ["1\t2", 'a"b'] },
    });
    expect(parseAstryxTablePaste("001\ntrue\n9007199254740993")).toEqual({
      kind: "accepted",
      paste: {
        axis: "vertical",
        canonicalTexts: ["001", "true", "9007199254740993"],
      },
    });
    expect(parseAstryxTablePaste('value\n""')).toEqual({
      kind: "accepted",
      paste: { axis: "vertical", canonicalTexts: ["value", ""] },
    });
    expect(parseAstryxTablePaste("value\n")).toEqual({
      kind: "accepted",
      paste: { axis: "horizontal", canonicalTexts: ["value"] },
    });
  });

  test("round-trips final blanks in vertical and horizontal clipboard snapshots", () => {
    const serialized = serializeAstryxTableClipboardSnapshot({
      axis: "vertical",
      rowIds: ["row-a", "row-b"],
      columnIds: ["note"],
      canonicalTexts: ["value", ""],
    });

    expect(serialized).toBe('value\n""');
    expect(parseAstryxTablePaste(serialized)).toEqual({
      kind: "accepted",
      paste: { axis: "vertical", canonicalTexts: ["value", ""] },
    });

    const horizontal = serializeAstryxTableClipboardSnapshot({
      axis: "horizontal",
      rowIds: ["row-a"],
      columnIds: ["name", "note"],
      canonicalTexts: ["value", ""],
    });
    expect(horizontal).toBe("value\t");
    expect(parseAstryxTablePaste(horizontal)).toEqual({
      kind: "accepted",
      paste: { axis: "horizontal", canonicalTexts: ["value", ""] },
    });
  });

  test("rejects rectangles, ragged TSV, and malformed quoting", () => {
    expect(parseAstryxTablePaste("a\tb\nc\td")).toEqual({
      kind: "rejected",
      diagnostic: {
        code: "unsupported-shape",
        detail: "Copied 2×2. AstryxTable accepts only one row or one column.",
      },
    });
    expect(parseAstryxTablePaste("a\tb\nc")).toMatchObject({ kind: "rejected" });
    expect(parseAstryxTablePaste('"unfinished')).toMatchObject({ kind: "rejected" });
  });

  test("admits the exact paste text and linear-cell budgets", () => {
    expect(parseAstryxTablePaste("x".repeat(ASTRYX_TABLE_PASTE_MAX_TEXT_CODE_UNITS))).toMatchObject({
      kind: "accepted",
    });
    const maximumVerticalLine = Array.from(
      { length: ASTRYX_TABLE_PASTE_MAX_LINEAR_CELLS },
      () => "x",
    ).join("\n");

    expect(parseAstryxTablePaste(maximumVerticalLine)).toMatchObject({
      kind: "accepted",
      paste: {
        axis: "vertical",
        canonicalTexts: { length: ASTRYX_TABLE_PASTE_MAX_LINEAR_CELLS },
      },
    });
    for (const terminalDelimiter of ["\n", "\r\n"]) {
      expect(parseAstryxTablePaste(`${maximumVerticalLine}${terminalDelimiter}`)).toMatchObject({
        kind: "accepted",
        paste: {
          axis: "vertical",
          canonicalTexts: { length: ASTRYX_TABLE_PASTE_MAX_LINEAR_CELLS },
        },
      });
    }
  });

  test("rejects paste text or cell count over budget with one closed diagnostic", () => {
    const textRejection = parseAstryxTablePaste(
      "x".repeat(ASTRYX_TABLE_PASTE_MAX_TEXT_CODE_UNITS + 1),
    );
    expect(textRejection).toEqual({
      kind: "rejected",
      diagnostic: { code: "input-budget-text" },
    });
    if (textRejection.kind !== "rejected") throw new Error("fixture must exceed the text budget");
    expect(formatAstryxTablePasteDiagnostic(textRejection.diagnostic)).toContain(
      "UTF-16 code-unit paste limit",
    );
    const overBudgetVerticalLine = Array.from(
      { length: ASTRYX_TABLE_PASTE_MAX_LINEAR_CELLS + 1 },
      () => "x",
    ).join("\n");

    const cellRejection = parseAstryxTablePaste(overBudgetVerticalLine);
    expect(cellRejection).toEqual({
      kind: "rejected",
      diagnostic: { code: "input-budget-cells" },
    });
    if (cellRejection.kind !== "rejected") throw new Error("fixture must exceed the cell budget");
    expect(formatAstryxTablePasteDiagnostic(cellRejection.diagnostic)).toContain("cell paste limit");
  });

  test("bounds retained diagnostic evidence and rendered messages", () => {
    const diagnostic = createAstryxTablePasteDiagnostic("invalid-value", {
      rowId: "row-a",
      columnId: "score",
      detail: "x".repeat(1_000),
      additionalInvalidCount: Number.MAX_SAFE_INTEGER,
    });

    expect(diagnostic.detail).toHaveLength(256);
    expect(diagnostic.detail?.endsWith("…")).toBe(true);
    expect(diagnostic.additionalInvalidCount).toBe(ASTRYX_TABLE_PASTE_MAX_LINEAR_CELLS - 1);
    const message = formatAstryxTablePasteDiagnostic(diagnostic);
    expect(message.length).toBeLessThanOrEqual(512);
    expect(message).toContain(String(ASTRYX_TABLE_PASTE_MAX_LINEAR_CELLS - 1));

    const longCoordinateMessage = formatAstryxTablePasteDiagnostic(
      createAstryxTablePasteDiagnostic("invalid-value", {
        rowId: "row-a",
        columnId: "score",
        detail: "The canonical value is invalid.",
        additionalInvalidCount: 7,
      }),
      () =>
        createAstryxTablePasteCoordinateEvidence(
          `${"Revenue".repeat(200)}, row forecast`,
          `quarter-${"x".repeat(1_000)}`,
        ),
    );
    expect(longCoordinateMessage).toContain("Revenue");
    expect(longCoordinateMessage).toContain("The canonical value is invalid.");
    expect(longCoordinateMessage).toContain("7 additional destinations are invalid.");
    expect(longCoordinateMessage.length).toBeLessThanOrEqual(512);
  });

  test("broadcasts one cell and accepts only exact direct linear matches", () => {
    const broadcast = parseAstryxTablePaste("9");
    const horizontal = parseAstryxTablePaste("9\tnine");
    const vertical = parseAstryxTablePaste("9\nnine");
    if (
      broadcast.kind !== "accepted" ||
      horizontal.kind !== "accepted" ||
      vertical.kind !== "accepted"
    ) {
      throw new Error("fixtures must parse");
    }
    const selected = {
      axis: "horizontal" as const,
      rowIds: ["row-a"] as const,
      columnIds: ["score", "note"] as const,
    };
    expect(createAstryxTablePasteGesture(broadcast.paste, selected, structure)).toEqual([
      { rowId: "row-a", columnId: "score", canonicalText: "9" },
      { rowId: "row-a", columnId: "note", canonicalText: "9" },
    ]);
    expect(createAstryxTablePasteGesture(horizontal.paste, selected, structure)).toHaveLength(2);
    expect(createAstryxTablePasteGesture(vertical.paste, selected, structure)).toBeUndefined();
    const longerHorizontal = parseAstryxTablePaste("9\tnine\tten");
    if (longerHorizontal.kind !== "accepted") throw new Error("fixture must parse");
    expect(
      createAstryxTablePasteGesture(longerHorizontal.paste, selected, structure),
    ).toBeUndefined();
  });

  test("projects a mismatch from its exact identity start without clipping", () => {
    const vertical = parseAstryxTablePaste("one\ntwo");
    if (vertical.kind !== "accepted") throw new Error("fixture must parse");
    expect(
      projectAstryxTablePasteTarget(
        vertical.paste,
        { rowId: "row-a", columnId: "score" },
        structure,
      ),
    ).toEqual({ axis: "vertical", rowIds: ["row-a", "row-b"], columnIds: ["score"] });
    expect(
      projectAstryxTablePasteTarget(
        vertical.paste,
        { rowId: "row-c", columnId: "score" },
        structure,
      ),
    ).toBeUndefined();
    expect(
      sameAstryxTablePasteTarget(
        { axis: "vertical", rowIds: ["row-a", "row-b"], columnIds: ["score"] },
        { axis: "vertical", rowIds: ["row-a", "row-b"], columnIds: ["score"] },
      ),
    ).toBe(true);
    expect(
      sameAstryxTablePasteTarget(
        { axis: "vertical", rowIds: ["row-a", "row-b"], columnIds: ["score"] },
        { axis: "vertical", rowIds: ["row-a", "row-c"], columnIds: ["score"] },
      ),
    ).toBe(false);
  });

  test("keeps a rejected confirmation in the workflow and closes only after acceptance", () => {
    const restoreFocus = vi.fn();
    const runtime = new AstryxTablePasteRuntime(restoreFocus);
    const confirmation = {
      paste: { axis: "vertical" as const, canonicalTexts: ["one", "two"] as const },
      selected: {
        axis: "horizontal" as const,
        rowIds: ["row-a"] as const,
        columnIds: ["score", "note"] as const,
      },
      start: { rowId: "row-a", columnId: "score" },
      proposed: {
        axis: "vertical" as const,
        rowIds: ["row-a", "row-b"] as const,
        columnIds: ["score"] as const,
      },
      copiedDescription: "2-cell vertical line",
      selectedDescription: "2-cell horizontal line",
      proposedDescription: "2-cell vertical line",
      startCoordinate: createAstryxTablePasteCoordinateEvidence("Score", "1"),
      endCoordinate: createAstryxTablePasteCoordinateEvidence("Score", "2"),
    };
    let accepted = false;
    runtime.register(
      () =>
        accepted
          ? { kind: "accepted" }
          : {
              kind: "rejected",
              diagnostic: createAstryxTablePasteDiagnostic("invalid-value", {
                rowId: "row-b",
                columnId: "score",
                detail: "is no longer editable.",
              }),
            },
      restoreFocus,
      ({ rowId, columnId }) =>
        columnId === "score" && rowId === "row-b"
          ? createAstryxTablePasteCoordinateEvidence("Score", "2")
          : createAstryxTablePasteCoordinateEvidence(columnId, rowId),
    );

    runtime.open(confirmation);
    runtime.confirm();

    expect(runtime.getSnapshot()).toMatchObject({
      open: true,
      confirmation,
      error: "Score, row 2: is no longer editable.",
    });
    expect(restoreFocus).not.toHaveBeenCalled();

    accepted = true;
    runtime.confirm();

    expect(runtime.getSnapshot()).toEqual({ open: false });
    expect(restoreFocus).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });

  test("releases every retained confirmation field after acceptance or cancellation", () => {
    const confirmation = {
      paste: { axis: "vertical" as const, canonicalTexts: ["one", "two"] as const },
      selected: {
        axis: "horizontal" as const,
        rowIds: ["row-a"] as const,
        columnIds: ["score", "note"] as const,
      },
      start: { rowId: "row-a", columnId: "score" },
      proposed: {
        axis: "vertical" as const,
        rowIds: ["row-a", "row-b"] as const,
        columnIds: ["score"] as const,
      },
      copiedDescription: "2-cell vertical line",
      selectedDescription: "2-cell horizontal line",
      proposedDescription: "2-cell vertical line",
      startCoordinate: createAstryxTablePasteCoordinateEvidence("Score", "1"),
      endCoordinate: createAstryxTablePasteCoordinateEvidence("Score", "2"),
    };
    const actor = createAstryxTablePasteActor();
    actor.start();

    actor.send({ type: "OPEN", confirmation });
    actor.send({ type: "CONFIRM", attempt: () => ({ kind: "accepted" }) });
    expect(actor.getSnapshot().matches("applied")).toBe(true);
    expect(actor.getSnapshot().context).toEqual({
      confirmation: undefined,
      error: undefined,
      result: undefined,
    });

    actor.send({ type: "OPEN", confirmation });
    actor.send({ type: "CANCEL" });
    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(actor.getSnapshot().context).toEqual({
      confirmation: undefined,
      error: undefined,
      result: undefined,
    });
    actor.stop();
  });

  test("unregister releases coordinate dependencies and restores the bounded fallback", () => {
    const runtime = new AstryxTablePasteRuntime();
    const release = runtime.register(
      () => ({ kind: "accepted" }),
      () => undefined,
      () => createAstryxTablePasteCoordinateEvidence("Sensitive header", "99"),
    );

    release();
    runtime.notify(
      createAstryxTablePasteDiagnostic("unchanged", {
        rowId: "row-a",
        columnId: "score",
      }),
    );

    expect(runtime.getNotificationSnapshot().message).toBe(
      "score, row row-a: The pasted values did not change the table. Nothing was applied.",
    );
    runtime.dispose();
  });

  test("owns one clipboard read across surface registration lifetimes", () => {
    const runtime = new AstryxTablePasteRuntime();
    const firstRead = runtime.beginClipboardRead();
    expect(firstRead).toBe(1);
    expect(runtime.isClipboardReadPending()).toBe(true);

    const release = runtime.register(
      () => ({ kind: "accepted" }),
      () => undefined,
      ({ rowId, columnId }) => createAstryxTablePasteCoordinateEvidence(columnId, rowId),
    );
    release();

    expect(runtime.beginClipboardRead()).toBeUndefined();
    expect(runtime.finishClipboardRead(firstRead!)).toBe(true);
    expect(runtime.isClipboardReadPending()).toBe(false);
    expect(runtime.beginClipboardRead()).toBe(2);
    runtime.dispose();
    expect(runtime.finishClipboardRead(2)).toBe(false);
  });
});
