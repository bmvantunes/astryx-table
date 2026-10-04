import { createContext, useContext } from "react";
import type { AstryxTableClientFacetRowsSource } from "./client-source-adapter";
import type { AstryxTableRowPipelineRuntimeView } from "./grid-runtime";

export const ClientContext = createContext<
  | Readonly<{ rows: AstryxTableClientFacetRowsSource; runtime: AstryxTableRowPipelineRuntimeView }>
  | undefined
>(undefined);

export function useClientContext() {
  const context = useContext(ClientContext);
  if (context === undefined)
    throw new Error("AstryxTable controls must be rendered inside AstryxTableClient.");
  return context;
}
