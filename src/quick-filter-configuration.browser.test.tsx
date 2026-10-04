import { Component, type ReactNode } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";
import { AstryxTableClient, AstryxTableQuickFilter } from "../packages/table/src";

// Source Browser configuration enables development diagnostics. The installed
// production fixture separately checks the no-control, usable-grid fallback.
class Boundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message === null ? (
      this.props.children
    ) : (
      <div role="alert">{this.state.message}</div>
    );
  }
}
afterEach(cleanup);

test("Quick Filter requires explicit configured fields in development", async () => {
  await render(
    <Boundary>
      <AstryxTableClient
        tableId="quick-filter-configuration"
        columns={[
          { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
        ]}
        getRowId={(row) => row.id}
        initialOrderBy={[{ columnId: "COL_ID_NAME", direction: "asc" }]}
        clientSource={{
          rows: [{ id: "one", name: "One" }],
          totalRows: 1,
          version: 1,
          status: "ready",
        }}
      >
        <AstryxTableQuickFilter />
      </AstryxTableClient>
    </Boundary>,
  );
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent(
      "AstryxTableQuickFilter requires AstryxTableClient quickFilterFields to be configured.",
    );
});
