import { Button } from "@astryxdesign/core/Button";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import {
  AstryxTableClient,
  AstryxTableQuickFilter,
  AstryxTableActiveFilters,
  type AstryxTableColumns,
} from "../packages/table/src";

type Quote = { id: string; instrument: string; quantity: bigint };
const columns = [
  {
    columnId: "COL_ID_INSTRUMENT",
    headerName: "Instrument",
    field: "instrument",
    valueType: "text",
    width: 320,
  },
  {
    columnId: "COL_ID_QUANTITY",
    headerName: "Quantity",
    field: "quantity",
    valueType: "bigint",
    width: 240,
  },
] as const satisfies AstryxTableColumns<Quote>;
const rows = Array.from({ length: 10_000 }, (_, index) => ({
  id: `quote-${index}`,
  instrument: `Instrument ${String(index + 1).padStart(5, "0")}`,
  quantity: 9007199254740993n + BigInt(index),
}));
const source = { rows, totalRows: rows.length, version: 1, status: "ready" as const };
const getRowId = (row: Quote) => row.id;

const styles = stylex.create({
  page: { maxWidth: 960, marginInline: "auto", padding: 32 },
  heading: { fontSize: 32, marginBottom: 16 },
  paragraph: { marginBottom: 16 },
});

export function App() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Theme theme={neutralTheme}>
      <main {...stylex.props(styles.page)}>
        <h1 {...stylex.props(styles.heading)}>AstryxTable</h1>
        <p {...stylex.props(styles.paragraph)}>
          Client workbench: 10,000 rows, exact bigint values, Quick Filter and Astryx column menus.
        </p>
        <Button label="Verify Astryx interaction" onClick={() => setConfirmed(true)} />
        <p role="status" aria-label="Workbench status">
          {confirmed ? "Astryx interaction confirmed" : "Ready to verify"}
        </p>
        <AstryxTableClient
          tableId="quotes"
          columns={columns}
          getRowId={getRowId}
          clientSource={source}
          initialOrderBy={[{ columnId: "COL_ID_INSTRUMENT", direction: "asc" }]}
          quickFilterFields={["instrument"]}
        >
          <AstryxTableQuickFilter />
          <AstryxTableActiveFilters />
        </AstryxTableClient>
      </main>
    </Theme>
  );
}
