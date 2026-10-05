import "./styles.css";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableToolbar,
  AstryxTableToolbarSpacer,
  type AstryxTableColumns,
} from "../packages/table/src";

type Row = { id: string; value: number };
const columns = [
  { columnId: "COL_ID_VALUE", headerName: "Value", field: "value", valueType: "number" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "toolbar",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_VALUE", direction: "asc" }] as const,
  clientSource: {
    rows: [{ id: "one", value: 1 }],
    totalRows: 1,
    version: 1,
    status: "ready" as const,
  },
};
afterEach(cleanup);

test("optional page controls belong to a named published toolbar and remain operable", async () => {
  const onAction = vi.fn();
  const screen = await render(
    <AstryxTableClient {...props}>
      <button type="button" onClick={onAction}>
        Refresh
      </button>
      <button type="button">Export</button>
    </AstryxTableClient>,
  );
  const toolbar = page.getByRole("toolbar", { name: "toolbar controls" });
  await expect.element(toolbar).toBeVisible();
  const refresh = toolbar.getByRole("button", { name: "Refresh" });
  refresh.element().focus();
  await userEvent.keyboard("{Enter}");
  expect(onAction).toHaveBeenCalledTimes(1);
  await screen.rerender(<AstryxTableClient {...props} />);
  await expect.element(toolbar).not.toBeInTheDocument();
});

test("empty branded toolbar wrappers and fragments leave no toolbar landmark", async () => {
  const view = await render(<AstryxTableClient {...props} />);
  const grid = page.getByRole("grid");
  await expect.element(grid).toBeVisible();
  const top = grid.element().getBoundingClientRect().top;
  await view.rerender(
    <AstryxTableClient {...props}>
      <>
        <AstryxTableToolbar>
          <>
            {null}
            {false}
          </>
        </AstryxTableToolbar>
      </>
    </AstryxTableClient>,
  );
  await expect.element(page.getByRole("toolbar")).not.toBeInTheDocument();
  expect(grid.element().getBoundingClientRect().top).toBe(top);
});

test.for(["ltr", "rtl"] as const)(
  "branded composition keeps one native toolbar and authored keyboard order in %s",
  async (direction) => {
    await render(
      <div dir={direction}>
        <AstryxTableClient {...props}>
          <AstryxTableToolbar>
            <button>First</button>
            <AstryxTableToolbarSpacer />
            <button>Second</button>
            <button>Third</button>
          </AstryxTableToolbar>
        </AstryxTableClient>
      </div>,
    );
    const toolbar = page.getByRole("toolbar", { name: "toolbar controls", exact: true });
    await expect.element(toolbar).toBeVisible();
    expect(page.getByRole("toolbar").all()).toHaveLength(1);
    expect(
      toolbar
        .getByRole("button")
        .all()
        .map((button) => button.element().textContent),
    ).toEqual(["First", "Second", "Third"]);
    const first = toolbar.getByRole("button", { name: "First", exact: true });
    const second = toolbar.getByRole("button", { name: "Second", exact: true });
    const third = toolbar.getByRole("button", { name: "Third", exact: true });
    expect(
      Math.abs(
        first.element().getBoundingClientRect().x - second.element().getBoundingClientRect().x,
      ),
    ).toBeGreaterThan(100);
    first.element().focus();
    await userEvent.keyboard(direction === "rtl" ? "{ArrowLeft}" : "{ArrowRight}");
    await expect.element(second).toHaveFocus();
    await userEvent.keyboard(direction === "rtl" ? "{ArrowLeft}" : "{ArrowRight}");
    await expect.element(third).toHaveFocus();
  },
);

test("standalone branded toolbars retain native keyboard ownership and omit empty content", async () => {
  const view = await render(
    <AstryxTableToolbar>
      <button>First</button>
      <button>Second</button>
    </AstryxTableToolbar>,
  );
  const toolbar = page.getByRole("toolbar", { name: "Table controls", exact: true });
  await expect.element(toolbar).toBeVisible();
  toolbar.getByRole("button", { name: "First", exact: true }).element().focus();
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(toolbar.getByRole("button", { name: "Second", exact: true })).toHaveFocus();
  await view.rerender(<AstryxTableToolbar />);
  await expect.element(page.getByRole("toolbar")).not.toBeInTheDocument();
});
