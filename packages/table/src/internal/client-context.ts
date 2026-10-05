import type { createGridFilterCommands } from "./filter-commands";
import { createContext, useContext } from "react";
import type {
  AstryxTableClientFacetRowsSource,
  AstryxTableClientRowPipelineAdapter,
} from "./client-source-adapter";
import type { AstryxTableRowPipelineRuntimeView } from "./grid-runtime";

export const ClientContext = createContext<
  | Readonly<{
      tableId: string;
      filterCommands: ReturnType<typeof createGridFilterCommands>;
      rows: AstryxTableClientFacetRowsSource;
      resultRows: Pick<
        AstryxTableClientRowPipelineAdapter<unknown>,
        "getResultRowCountSnapshot" | "subscribeResultRowCount" | "initializeResultRowCount"
      >;
      runtime: AstryxTableRowPipelineRuntimeView;
    }>
  | undefined
>(undefined);

export function useClientContext() {
  const context = useContext(ClientContext);
  if (context === undefined)
    throw new Error("AstryxTable controls must be rendered inside AstryxTableClient.");
  return context;
}
