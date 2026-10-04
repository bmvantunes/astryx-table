import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableActiveFilters,
  AstryxTableClient,
  AstryxTableQuickFilter,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string; team: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "quick-filter",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  quickFilterFields: ["name", "team"] as const,
  clientSource: {
    rows: [
      { id: "ada", name: "Ada", team: "Core" },
      { id: "alan", name: "Alan", team: "Core" },
      { id: "grace", name: "Grace", team: "Data" },
    ],
    totalRows: 3,
    version: 1,
    status: "ready" as const,
  },
};

test("Quick Filter searches explicit fields, composes with Grid Filters, and stays session-only", async () => {
  const persisted: unknown[] = [];
  const view = await render(
    <AstryxTableClient
      {...props}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "contains", filter: "Ada" }]}
      onPersistChange={(state) => persisted.push(state)}
    >
      <AstryxTableQuickFilter />
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  const input = page.getByRole("searchbox", { name: "Quick Filter", exact: true });
  await input.fill("córe");
  await expect
    .element(page.getByRole("button", { name: "Active filters (2)", exact: true }))
    .toBeVisible();
  expect(page.getByRole("gridcell").all()).toHaveLength(1);
  expect(persisted).toHaveLength(0);
  await page.getByRole("button", { name: "Active filters (2)", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Active filters", exact: true });
  await review.getByRole("button", { name: "Clear all Grid Filters", exact: true }).click();
  await expect.element(review.getByRole("button", { name: /^Remove Quick Filter/ })).toHaveFocus();
  expect(page.getByRole("gridcell").all()).toHaveLength(2);
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).not.toHaveProperty("quickFilter");
  await review.getByRole("button", { name: /^Remove Quick Filter/ }).click();
  await expect.element(input).toHaveValue("");
  expect(persisted).toHaveLength(1);
  expect(page.getByRole("gridcell").all()).toHaveLength(3);
  await input.fill("Grace");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  await view.unmount();
  await render(
    <AstryxTableClient {...props}>
      <AstryxTableQuickFilter />
    </AstryxTableClient>,
  );
  await expect.element(input).toHaveValue("");
  expect(page.getByRole("gridcell").all()).toHaveLength(3);
});

test("native Quick Filter Clear is immediate, returns focus, and cancels a pending draft", async () => {
  await render(
    <AstryxTableClient {...props}>
      <AstryxTableQuickFilter />
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  const input = page.getByRole("searchbox", { name: "Quick Filter", exact: true });
  await input.fill("Ada");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await input.fill("Grace");
    await page.getByRole("button", { name: "Clear Quick Filter", exact: true }).click();
    await expect.element(input).toHaveFocus();
    await expect.element(input).toHaveValue("");
    expect(page.getByRole("gridcell").all()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(200);
    expect(page.getByRole("gridcell").all()).toHaveLength(3);
    await expect
      .element(page.getByRole("button", { name: "Active filters (0)", exact: true }))
      .toBeVisible();
  } finally {
    vi.useRealTimers();
  }
});

test("Quick Filter ignores all late events from an IME session invalidated by review removal", async () => {
  await render(
    <AstryxTableClient {...props}>
      <AstryxTableQuickFilter />
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  const input = page.getByRole("searchbox", { name: "Quick Filter", exact: true });
  await input.fill("Ada");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  input.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await input.fill("Gr");
  await page.getByRole("button", { name: "Active filters (1)", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Active filters", exact: true })
    .getByRole("button", { name: /^Remove Quick Filter/ })
    .click();
  await expect.element(input).toHaveValue("");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await input.fill("Grace");
    await expect.element(input).toHaveValue("");
    input
      .element()
      .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
    await vi.advanceTimersByTimeAsync(200);
    expect(page.getByRole("gridcell").all()).toHaveLength(3);
    await expect.element(input).toHaveValue("");
    await input.fill("Alan");
    await vi.advanceTimersByTimeAsync(200);
    await expect.element(page.getByRole("gridcell", { name: "Alan", exact: true })).toBeVisible();
    expect(page.getByRole("gridcell").all()).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
  await userEvent.keyboard("{Escape}");
});

test("unmounting Quick Filter cancels its pending draft while retaining the table session", async () => {
  const view = await render(
    <AstryxTableClient {...props}>
      <AstryxTableQuickFilter />
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  await page.getByRole("searchbox", { name: "Quick Filter", exact: true }).fill("Grace");
  await expect.poll(() => page.getByRole("gridcell").all().length).toBe(1);
  await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await page.getByRole("searchbox", { name: "Quick Filter", exact: true }).fill("Ada");
    await view.rerender(
      <AstryxTableClient {...props}>
        <AstryxTableActiveFilters />
      </AstryxTableClient>,
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(page.getByRole("gridcell").all()).toHaveLength(1);
    await expect
      .element(page.getByRole("button", { name: "Active filters (1)", exact: true }))
      .toBeVisible();
    await view.rerender(
      <AstryxTableClient {...props}>
        <AstryxTableQuickFilter />
        <AstryxTableActiveFilters />
      </AstryxTableClient>,
    );
    await expect
      .element(page.getByRole("searchbox", { name: "Quick Filter", exact: true }))
      .toHaveValue("Grace");
  } finally {
    vi.useRealTimers();
  }
});

test("IME input stays local until completion and native Clear invalidates the composing session", async () => {
  await render(
    <AstryxTableClient {...props}>
      <AstryxTableQuickFilter />
      <AstryxTableActiveFilters />
    </AstryxTableClient>,
  );
  const input = page.getByRole("searchbox", { name: "Quick Filter", exact: true });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    input.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    await input.fill("Gr");
    await vi.advanceTimersByTimeAsync(200);
    expect(page.getByRole("gridcell").all()).toHaveLength(3);
    await input.fill("Grace");
    input
      .element()
      .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Grace" }));
    await vi.advanceTimersByTimeAsync(200);
    await expect.element(page.getByRole("gridcell", { name: "Grace", exact: true })).toBeVisible();
    expect(page.getByRole("gridcell").all()).toHaveLength(1);
    input.element().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    await input.fill("Ad");
    await page.getByRole("button", { name: "Clear Quick Filter", exact: true }).click();
    await input.fill("Ada");
    await expect.element(input).toHaveValue("");
    input
      .element()
      .dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "Ada" }));
    await vi.advanceTimersByTimeAsync(200);
    expect(page.getByRole("gridcell").all()).toHaveLength(3);
  } finally {
    vi.useRealTimers();
  }
});
