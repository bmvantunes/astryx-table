import { Schema } from "effect";
import { defineViewServerConfig, ViewServerId } from "effect-view-server/config";
import { createViewServerReact } from "effect-view-server/react";
import { AstryxTableServer, type AstryxTableColumns } from "../src";

const binding = createViewServerReact(
  defineViewServerConfig({
    topics: {
      orders: {
        schema: Schema.Struct({ id: ViewServerId, name: Schema.String, amount: Schema.BigInt }),
      },
    },
  }),
);
declare const source: ReturnType<typeof binding.useLiveQueryViewport>;
type Row = { readonly id: string; readonly name: string; readonly amount: bigint };
const columns = [
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  {
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    valueType: "bigint",
    valueFormatter: ({ value }) => (value + 1n).toString(),
  },
] as const satisfies AstryxTableColumns<Row>;
const props = {
  tableId: "server-types",
  columns,
  viewportSource: source,
  initialOrderBy: [{ columnId: "COL_ID_AMOUNT", direction: "asc" }] as const,
};
void (
  <AstryxTableServer
    {...props}
    externalFilters={[{ field: "amount", type: "equals", filter: 2n }]}
  />
);
// @ts-expect-error Source Row Identity is authoritative.
void (<AstryxTableServer {...props} getRowId={(row: Row) => row.id} />);
// @ts-expect-error Server does not expose editing.
void (<AstryxTableServer {...props} editable />);
// @ts-expect-error Server does not expose row selection.
void (<AstryxTableServer {...props} rowSelection />);
// @ts-expect-error The row space is continuous, not paginated.
void (<AstryxTableServer {...props} pagination={{ pageIndex: 0, pageSize: 10 }} />);
// @ts-expect-error Sorting is mandatory and nonempty.
void (<AstryxTableServer {...props} initialOrderBy={[]} />);
const unknownSort = [{ columnId: "COL_ID_MISSING", direction: "asc" }] as const;
// @ts-expect-error Unknown Column Identities cannot be sorted.
void (<AstryxTableServer {...props} initialOrderBy={unknownSort} />);
const numberFilter = [{ field: "amount", type: "equals", filter: 2 }] as const;
// @ts-expect-error External filters retain the source's exact numeric domain.
void (<AstryxTableServer {...props} externalFilters={numberFilter} />);
const unknownField = [{ field: "missing", type: "equals", filter: "x" }] as const;
// @ts-expect-error External fields come from the source schema.
void (<AstryxTableServer {...props} externalFilters={unknownField} />);
declare const erasedViewport: unknown;
// @ts-expect-error An erased viewport cannot prove row and query authority.
void (<AstryxTableServer {...props} viewportSource={{ ...source, viewport: erasedViewport }} />);
const withoutSort = { tableId: props.tableId, columns, viewportSource: source };
// @ts-expect-error Every public Server starts sorted.
void (<AstryxTableServer {...withoutSort} />);
