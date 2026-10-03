import { createContext, useContext } from "react";

import type { ReactNode } from "react";

import type { AstryxTableClientFacetRowsSource } from "./client-source-adapter";
import type { AstryxTableRowPipelineRuntimeView } from "./grid-runtime";

type AstryxTableClientFilterContextValue = Readonly<{
  readonly runtime: AstryxTableRowPipelineRuntimeView;
  readonly facetRows: AstryxTableClientFacetRowsSource;
}>;

const AstryxTableClientFilterContext = createContext<AstryxTableClientFilterContextValue | undefined>(
  undefined,
);

export function AstryxTableClientFilterContextProvider({
  children,
  value,
}: Readonly<{
  readonly children: ReactNode;
  readonly value: AstryxTableClientFilterContextValue;
}>): ReactNode {
  return (
    <AstryxTableClientFilterContext.Provider value={value}>
      {children}
    </AstryxTableClientFilterContext.Provider>
  );
}

export function useAstryxTableClientFilterContext(): AstryxTableClientFilterContextValue {
  const value = useContext(AstryxTableClientFilterContext);
  if (value === undefined) {
    throw new Error("AstryxTable filter controls must be rendered inside AstryxTableClient.");
  }
  return value;
}
