import { describe, expect, it, vi } from "vitest";

import {
  installAstryxTableColumnCommandSubscriptionListener,
  recordAstryxTableColumnCommandSubscriptionNotification,
} from "./grid-subscription-instrumentation";

describe("column command subscription instrumentation", () => {
  it("keeps duplicate registrations active until every disposer runs", () => {
    const listener = vi.fn();
    const tableId = "TABLE_ID_DUPLICATE_COLUMN_SUBSCRIPTION";
    const disposeFirst = installAstryxTableColumnCommandSubscriptionListener(tableId, listener);
    const disposeSecond = installAstryxTableColumnCommandSubscriptionListener(tableId, listener);

    disposeFirst();
    recordAstryxTableColumnCommandSubscriptionNotification(tableId, "COL_ID_NAME", 1);
    expect(listener).toHaveBeenCalledTimes(1);

    disposeFirst();
    recordAstryxTableColumnCommandSubscriptionNotification(tableId, "COL_ID_NAME", 1);
    expect(listener).toHaveBeenCalledTimes(2);

    disposeSecond();
    recordAstryxTableColumnCommandSubscriptionNotification(tableId, "COL_ID_NAME", 1);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
