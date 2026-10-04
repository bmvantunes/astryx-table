import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Schema } from "effect";
import { defineViewServerConfig, ViewServerId } from "effect-view-server/config";
import { createViewServerReact } from "effect-view-server/react";
import { expect, test, vi } from "vite-plus/test";
import { AstryxTableServer, type AstryxTableColumns } from "../packages/table/src";

test("Server SSR presents loading without opening a transport or facet subscription", () => {
  const binding = createViewServerReact(
    defineViewServerConfig({
      topics: { orders: { schema: Schema.Struct({ id: ViewServerId, name: Schema.String }) } },
    }),
  );
  type Source = ReturnType<typeof binding.useLiveQueryViewport>;
  type Viewport = Omit<Source["viewport"], "destroy">;
  const replace = vi.fn();
  const useWholeResult = vi.fn();
  const viewport = {
    semanticKey: (query: unknown) => JSON.stringify(query),
    replace,
  } as unknown as Viewport;
  const columns = [
    { columnId: "COL_ID_NAME", headerName: "Name", field: "name", valueType: "text" },
  ] as const satisfies AstryxTableColumns<{ readonly id: string; readonly name: string }>;
  const html = renderToString(
    createElement(AstryxTableServer<Viewport, typeof columns>, {
      tableId: "server-ssr",
      columns,
      initialOrderBy: [{ columnId: "COL_ID_NAME", direction: "asc" }],
      viewportSource: {
        viewport,
        useWholeResult,
        completeRawSelect: ["id", "name"] as unknown as Source["completeRawSelect"],
        totalRows: 1000,
        status: "loading",
        version: 1,
      },
    }),
  );
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-label="Loading Name"');
  expect(replace).not.toHaveBeenCalled();
  expect(useWholeResult).not.toHaveBeenCalled();
});
