import {
  AstryxTableClient,
  AstryxTableFilterControl,
  AstryxTableToolbar,
  AstryxTableToolbarSpacer,
  AstryxTableActiveFilterCount,
  AstryxTableActiveSortCount,
  AstryxTableResultRowCount,
  AstryxTableLoadedRowCount,
  AstryxTableBigIntColumn,
  AstryxTableTextColumn,
  AstryxTableComputedColumn,
  type AstryxTableColumns,
  type AstryxTableClientProps,
  type AstryxTableQuickFilterField,
  type AstryxTableQuickFilterFields,
  type AstryxTableFilterExpression,
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
const compoundFilter = {
  type: "AND",
  conditions: [
    { columnId: "COL_ID_NAME", type: "startsWith", filter: "A" },
    {
      type: "OR",
      conditions: [
        { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
        { type: "NOT", condition: { columnId: "COL_ID_NAME", type: "blank" } },
      ],
    },
  ],
} as const satisfies AstryxTableFilterExpression<Row, typeof columns>;
void (<AstryxTableClient {...props} initialFilters={[compoundFilter]} />);
const emptyCompound = {
  type: "OR",
  // @ts-expect-error Every compound expression requires a non-empty conditions tuple.
  conditions: [],
} satisfies AstryxTableFilterExpression<Row, typeof columns>;
void emptyCompound;
const mixedColumnCompound = {
  type: "AND",
  // @ts-expect-error Every leaf in a compound belongs to the same Column Identity.
  conditions: [
    { columnId: "COL_ID_NAME", type: "equals", filter: "Ada" },
    { columnId: "COL_ID_AMOUNT", type: "equals", filter: 1n },
  ],
} satisfies AstryxTableFilterExpression<Row, typeof columns>;
void mixedColumnCompound;
const wrongNestedOperand = {
  type: "NOT",
  // @ts-expect-error Nested leaves retain the exact value domain of their column.
  condition: { columnId: "COL_ID_AMOUNT", type: "equals", filter: 1 },
} satisfies AstryxTableFilterExpression<Row, typeof columns>;
void wrongNestedOperand;
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

void (<AstryxTableResultRowCount>{(count) => count.toFixed(0)}</AstryxTableResultRowCount>);
void (<AstryxTableLoadedRowCount>{(count) => count.toFixed(0)}</AstryxTableLoadedRowCount>);
// @ts-expect-error Count callbacks receive a number, never a row or string.
void (<AstryxTableResultRowCount>{(count: string) => count}</AstryxTableResultRowCount>);
// @ts-expect-error Counts do not expose their private runtime.
void (<AstryxTableLoadedRowCount runtime={{}} />);

void (
  <AstryxTableToolbar>
    <AstryxTableToolbarSpacer />
    <AstryxTableActiveFilterCount>{(count) => count.toFixed(0)}</AstryxTableActiveFilterCount>
    <AstryxTableActiveSortCount>{(count) => count.toFixed(0)}</AstryxTableActiveSortCount>
  </AstryxTableToolbar>
);
void (
  <AstryxTableFilterControl<Row, typeof columns> ownership="grid">
    {(commands) => {
      const accepted: boolean = commands.replace({
        columnId: "COL_ID_AMOUNT",
        type: "equals",
        filter: 9007199254740993n,
      });
      commands.clear("COL_ID_NAME");
      commands.reset("COL_ID_AMOUNT");
      commands.clearAll();
      // @ts-expect-error Unknown column identities cannot be cleared.
      commands.clear("COL_ID_UNKNOWN");
      // @ts-expect-error Exact bigint filters cannot accept a number operand.
      commands.replace({ columnId: "COL_ID_AMOUNT", type: "equals", filter: 1 });
      // @ts-expect-error Command-only controls expose no runtime or state reader.
      commands.getQuerySnapshot();
      return String(accepted);
    }}
  </AstryxTableFilterControl>
);
void (
  <AstryxTableFilterControl ownership="external">
    <button>Application filter</button>
  </AstryxTableFilterControl>
);
const invalidExternal = { ownership: "external" as const, children: (_commands: unknown) => null };
// @ts-expect-error External ownership supplies no grid command callback.
void AstryxTableFilterControl(invalidExternal);
const invalidGrid = { ownership: "grid" as const, children: "Plain children" };
// @ts-expect-error Grid ownership requires a command callback.
void AstryxTableFilterControl<Row, typeof columns>(invalidGrid);

const groupedColumns = [
  AstryxTableTextColumn({
    columnId: "COL_ID_NAME",
    headerName: "Name",
    field: "name",
    groupBy: true,
  }),
  AstryxTableBigIntColumn({
    columnId: "COL_ID_AMOUNT",
    headerName: "Amount",
    field: "amount",
    aggFunc: "sum",
  }),
] as const satisfies AstryxTableColumns<Row>;
void (
  <AstryxTableClient
    {...props}
    columns={groupedColumns}
    groupRowsColumn={{
      headerName: "Records",
      width: 160,
      valueFormatter: (context) => {
        const count: bigint = context.value;
        const identity: "COL_ID_ASTRYX_TABLE_ROWS" = context.columnId;
        // @ts-expect-error Rows presentation has no fabricated raw row.
        void context.row;
        for (const key of context.groupKeys) {
          const field: "name" = key.field;
          if (key._tag === "Present") {
            const text: string = key.value;
            void text;
          }
          void field;
        }
        return `${identity}: ${String(count)}`;
      },
    }}
  />
);
