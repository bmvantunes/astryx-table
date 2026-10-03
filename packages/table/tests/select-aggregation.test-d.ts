import { AstryxTableSelectColumn, type AstryxTableColumns } from "../src";

type Row = { side: "Buy" | "Sell" | null };
const selectColumns = [
  AstryxTableSelectColumn({
    columnId: "COL_ID_SIDE",
    field: "side",
    headerName: "Side",
    options: ["Buy", "Sell"],
    groupBy: true,
    groupKeyValueFormatter: ({ value, columnId }) => {
      const exact: "Buy" | "Sell" | null = value;
      const identity: "COL_ID_SIDE" = columnId;
      // @ts-expect-error Exact Select Group Keys never become numbers or any.
      const invalid: number = value;
      void identity;
      void invalid;
      return exact ?? "No side";
    },
  }),
] as const satisfies AstryxTableColumns<Row>;
void selectColumns;

const preset = AstryxTableSelectColumn.withDefaults({
  headerName: "Side",
  options: ["Buy", "Sell"],
});
const presetColumns = [
  preset({
    columnId: "COL_ID_SIDE",
    field: "side",
    groupBy: true,
    groupKeyValueFormatter: ({ value }) => value ?? "No side",
  }),
] satisfies AstryxTableColumns<Row>;
void presetColumns;
const invalidPreset = [
  preset({
    columnId: "COL_ID_SIDE",
    // @ts-expect-error Presets retain the same unsupported aggregate capability.
    field: "side",
    aggFunc: "min",
  }),
] satisfies AstryxTableColumns<Row>;
void invalidPreset;

const rejectedcountDistinct = [
  AstryxTableSelectColumn({
    columnId: "COL_ID_SIDE",
    // @ts-expect-error Select does not declare aggregate result semantics.
    field: "side",
    headerName: "Side",
    options: ["Buy", "Sell"],
    aggFunc: "countDistinct",
  }),
] satisfies AstryxTableColumns<Row>;
void rejectedcountDistinct;

const rejectedmin = [
  AstryxTableSelectColumn({
    columnId: "COL_ID_SIDE",
    // @ts-expect-error Select does not declare aggregate result semantics.
    field: "side",
    headerName: "Side",
    options: ["Buy", "Sell"],
    aggFunc: "min",
  }),
] satisfies AstryxTableColumns<Row>;
void rejectedmin;

const rejectedmax = [
  AstryxTableSelectColumn({
    columnId: "COL_ID_SIDE",
    // @ts-expect-error Select does not declare aggregate result semantics.
    field: "side",
    headerName: "Side",
    options: ["Buy", "Sell"],
    aggFunc: "max",
  }),
] satisfies AstryxTableColumns<Row>;
void rejectedmax;

const rejectedsum = [
  AstryxTableSelectColumn({
    columnId: "COL_ID_SIDE",
    // @ts-expect-error Select does not declare aggregate result semantics.
    field: "side",
    headerName: "Side",
    options: ["Buy", "Sell"],
    aggFunc: "sum",
  }),
] satisfies AstryxTableColumns<Row>;
void rejectedsum;

const rejectedavg = [
  AstryxTableSelectColumn({
    columnId: "COL_ID_SIDE",
    // @ts-expect-error Select does not declare aggregate result semantics.
    field: "side",
    headerName: "Side",
    options: ["Buy", "Sell"],
    aggFunc: "avg",
  }),
] satisfies AstryxTableColumns<Row>;
void rejectedavg;
