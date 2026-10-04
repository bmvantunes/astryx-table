import {
  AstryxTableClient,
  AstryxTableBigIntColumn,
  AstryxTableTextColumn,
  AstryxTableComputedColumn,
  type AstryxTableColumns,
  type AstryxTableClientProps,
  type AstryxTableQuickFilterField,
  type AstryxTableQuickFilterFields,
} from "../src";

type Row = { id: string; name: string; amount: bigint };
const columns = [
  AstryxTableTextColumn({
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    valueFormatter: ({ row, value }) => `${row.id}:${value.toUpperCase()}`,
  }),
  AstryxTableBigIntColumn({
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    valueFormatter: ({ value }) => (value + 1n).toString(),
  }),
  AstryxTableComputedColumn({
    columnId: "COL_ID_DOUBLE",
    headerName: "Double",
    fields: ["amount"],
    valueType: "bigint",
    valueGetter: ({ row }) => row.amount * 2n,
  }),
] as const satisfies AstryxTableColumns<Row>;
const clientSource = {
  rows: [{ id: "one", name: "One", amount: 9007199254740993n }],
  totalRows: 1,
  version: 1,
  status: "ready" as const,
};
const props = {
  tableId: "types",
  columns,
  clientSource,
  getRowId: (row: Row) => row.id,
  initialOrderBy: [{ columnId: "COL_ID_AMOUNT", direction: "asc" }] as const,
};
void (<AstryxTableClient {...props} getRowId={(row) => row.id} />);
// Source fields remain eligible even when they have no visible column.
const quickFilterFields = ["id", "name"] as const satisfies AstryxTableQuickFilterFields<Row>;
void (<AstryxTableClient {...props} quickFilterFields={quickFilterFields} />);
const quickFilterField: AstryxTableQuickFilterField<Row> = "id";
void quickFilterField;
// @ts-expect-error Quick Filter requires a non-empty source-field tuple.
void (<AstryxTableClient {...props} quickFilterFields={[]} />);
// @ts-expect-error Exact numeric fields are not string Quick Filter fields.
void (<AstryxTableClient {...props} quickFilterFields={["amount"]} />);
// @ts-expect-error Misspelled source fields are rejected.
void (<AstryxTableClient {...props} quickFilterFields={["naem"]} />);
// @ts-expect-error Column Identities are not source fields.
void (<AstryxTableClient {...props} quickFilterFields={["COL_ID_NAME"]} />);
const missingSort = { tableId: "types", columns, clientSource, getRowId: props.getRowId };
const missingId = { tableId: "types", columns, clientSource, initialOrderBy: props.initialOrderBy };
const missingTable = {
  columns,
  clientSource,
  getRowId: props.getRowId,
  initialOrderBy: props.initialOrderBy,
};
const computedSort = [{ columnId: "COL_ID_DOUBLE", direction: "asc" }] as const;
const unknownSort = [{ columnId: "COL_ID_UNKNOWN", direction: "asc" }] as const;
// @ts-expect-error initialOrderBy is mandatory.
void (<AstryxTableClient {...missingSort} />);
// @ts-expect-error getRowId is mandatory.
void (<AstryxTableClient {...missingId} />);
// @ts-expect-error tableId is mandatory.
void (<AstryxTableClient {...missingTable} />);
// @ts-expect-error an empty sorting tuple is forbidden.
void (<AstryxTableClient {...props} initialOrderBy={[]} />);
// @ts-expect-error sorting requires a sortable column identity.
void (<AstryxTableClient {...props} initialOrderBy={computedSort} />);
// @ts-expect-error unknown columns cannot become sort targets.
void (<AstryxTableClient {...props} initialOrderBy={unknownSort} />);
const invalidColumns = [
  // @ts-expect-error a field column must declare its runtime value type.
  { columnId: "COL_ID_NAME", headerName: "Name", field: "name" },
  // @ts-expect-error headerName is mandatory.
  { columnId: "COL_ID_AMOUNT", field: "amount", valueType: "bigint" },
  // @ts-expect-error bigint columns preserve bigint formatter input.
  {
    columnId: "COL_ID_WRONG",
    headerName: "Wrong",
    field: "amount",
    valueType: "bigint",
    valueFormatter: ({ value }: { value: number }) => value.toFixed(2),
  },
] as const satisfies AstryxTableColumns<Row>;
void invalidColumns;

const checkedProps: AstryxTableClientProps<Row, typeof columns> = props;
void (<AstryxTableClient {...checkedProps} />);
// @ts-expect-error Row Selection belongs to the later selection slice.
void (<AstryxTableClient {...props} rowSelection />);
const selectionProps: AstryxTableClientProps<Row, typeof columns> = {
  ...props,
  // @ts-expect-error The exported props agree with the current component capability.
  rowSelection: true,
};
void selectionProps;
