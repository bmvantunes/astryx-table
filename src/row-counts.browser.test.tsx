import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import {
  AstryxTableClient,
  AstryxTableQuickFilter,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  type AstryxTableColumns,
} from "../packages/table/src";
import "./styles.css";

afterEach(cleanup);
type Row = { id: string; name: string };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "row-counts",
  columns,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }] as const,
  clientSource: {
    rows: [
      { id: "ada", name: "Ada" },
      { id: "alan", name: "Alan" },
      { id: "grace", name: "Grace" },
    ],
    totalRows: 3,
    version: 1,
    status: "ready" as const,
  },
};

test("row counts distinguish the filtered result from all loaded source rows", async () => {
  await render(
    <AstryxTableClient
      {...props}
      initialFilters={[{ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" }]}
    >
      <AstryxTableResultRowCount />
      <AstryxTableLoadedRowCount />
    </AstryxTableClient>,
  );
  await expect
    .element(page.getByRole("status", { name: "Result rows", exact: true }))
    .toHaveTextContent("1 result row");
  await expect
    .element(page.getByRole("status", { name: "Loaded rows", exact: true }))
    .toHaveTextContent("3 loaded rows");
});

test("result counts follow Quick Filter and live rows while loaded counts retain source ownership", async () => {
  const controls = (
    <>
      <AstryxTableResultRowCount />
      <AstryxTableLoadedRowCount />
      <AstryxTableQuickFilter />
    </>
  );
  const view = await render(
    <AstryxTableClient {...props} quickFilterFields={["name"]}>
      {controls}
    </AstryxTableClient>,
  );
  const input = page.getByRole("searchbox", { name: "Quick Filter", exact: true });
  const result = page.getByRole("status", { name: "Result rows", exact: true });
  const loaded = page.getByRole("status", { name: "Loaded rows", exact: true });
  await input.fill("Ada");
  await expect.element(result).toHaveTextContent("1 result row");
  await expect.element(loaded).toHaveTextContent("3 loaded rows");
  await view.rerender(
    <AstryxTableClient
      {...props}
      quickFilterFields={["name"]}
      clientSource={{
        ...props.clientSource,
        rows: [...props.clientSource.rows, { id: "ada2", name: "Ada Lovelace" }],
        totalRows: 4,
        version: 2,
      }}
    >
      {controls}
    </AstryxTableClient>,
  );
  await expect.element(result).toHaveTextContent("2 result rows");
  await expect.element(loaded).toHaveTextContent("4 loaded rows");
  await input.fill("Missing");
  await expect.element(result).toHaveTextContent("0 result rows");
  await expect.element(loaded).toHaveTextContent("4 loaded rows");
  await input.fill("");
  await expect.element(result).toHaveTextContent("4 result rows");
});

test.for(["stale", "error", "closed"] as const)(
  "counts clear on loading and recover coherent %s rows",
  async (status) => {
    const controls = (
      <>
        <AstryxTableResultRowCount />
        <AstryxTableLoadedRowCount />
      </>
    );
    const view = await render(<AstryxTableClient {...props}>{controls}</AstryxTableClient>);
    await expect
      .element(page.getByRole("status", { name: "Result rows", exact: true }))
      .toHaveTextContent("3 result rows");
    await view.rerender(
      <AstryxTableClient
        {...props}
        clientSource={{ ...props.clientSource, version: 2, status: "loading" }}
      >
        {controls}
      </AstryxTableClient>,
    );
    await expect
      .element(page.getByRole("status", { name: "Result rows", exact: true }))
      .toHaveTextContent("0 result rows");
    await expect
      .element(page.getByRole("status", { name: "Loaded rows", exact: true }))
      .toHaveTextContent("0 loaded rows");
    await view.rerender(
      <AstryxTableClient
        {...props}
        clientSource={{ ...props.clientSource, version: 3, status, message: "Retained source" }}
      >
        {controls}
      </AstryxTableClient>,
    );
    await expect.element(page.getByRole("gridcell", { name: "Ada", exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("status", { name: "Result rows", exact: true }))
      .toHaveTextContent("3 result rows");
    await expect
      .element(page.getByRole("status", { name: "Loaded rows", exact: true }))
      .toHaveTextContent("3 loaded rows");
  },
);

test("invalid source rows clear both counts and later valid rows recover", async () => {
  const controls = (
    <>
      <AstryxTableResultRowCount />
      <AstryxTableLoadedRowCount />
    </>
  );
  const view = await render(<AstryxTableClient {...props}>{controls}</AstryxTableClient>);
  await view.rerender(
    <AstryxTableClient
      {...props}
      clientSource={{ ...props.clientSource, totalRows: 4, version: 2 }}
    >
      {controls}
    </AstryxTableClient>,
  );
  await expect
    .element(page.getByRole("status", { name: "Result rows", exact: true }))
    .toHaveTextContent("0 result rows");
  await expect
    .element(page.getByRole("status", { name: "Loaded rows", exact: true }))
    .toHaveTextContent("0 loaded rows");
  await view.rerender(
    <AstryxTableClient {...props} clientSource={{ ...props.clientSource, version: 3 }}>
      {controls}
    </AstryxTableClient>,
  );
  await expect
    .element(page.getByRole("status", { name: "Result rows", exact: true }))
    .toHaveTextContent("3 result rows");
  await expect
    .element(page.getByRole("status", { name: "Loaded rows", exact: true }))
    .toHaveTextContent("3 loaded rows");
});

test("custom count content retains accessible names and stays scoped to its table", async () => {
  const view = await render(
    <>
      <AstryxTableClient
        {...props}
        tableId="first"
        initialFilters={[{ columnId: "COL_ID_NAME", type: "equals", filter: "Ada" }]}
      >
        <AstryxTableResultRowCount>
          {(count) => <strong>{`First: ${count}`}</strong>}
        </AstryxTableResultRowCount>
        <AstryxTableLoadedRowCount>{(count) => `Resident: ${count}`}</AstryxTableLoadedRowCount>
      </AstryxTableClient>
      <AstryxTableClient {...props} tableId="second">
        <AstryxTableResultRowCount>{(count) => `Second: ${count}`}</AstryxTableResultRowCount>
      </AstryxTableClient>
    </>,
  );
  await expect
    .element(page.getByRole("status", { name: "Result rows", exact: true }).nth(0))
    .toHaveTextContent("First: 1");
  await expect
    .element(page.getByRole("status", { name: "Loaded rows", exact: true }))
    .toHaveTextContent("Resident: 3");
  await expect
    .element(page.getByRole("status", { name: "Result rows", exact: true }).nth(1))
    .toHaveTextContent("Second: 3");
  await view.rerender(
    <AstryxTableClient {...props} tableId="first">
      <AstryxTableResultRowCount>{(count) => `Replaced: ${count}`}</AstryxTableResultRowCount>
    </AstryxTableClient>,
  );
  await expect
    .element(page.getByRole("status", { name: "Result rows", exact: true }))
    .toHaveTextContent("Replaced: 1");
});
