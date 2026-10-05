import type { ReactNode } from "react";
import type {
  AstryxTableColumns,
  AstryxTableFilterExpression,
  AstryxTableFilterableColumnId,
} from "./public-types";
import { useClientContext } from "./internal/client-context";

export type AstryxTableGridFilterCommandCapability<
  TRow,
  TColumns extends AstryxTableColumns<TRow>,
> = Readonly<{
  replace: (filter: AstryxTableFilterExpression<TRow, TColumns>) => boolean;
  clear: (columnId: AstryxTableFilterableColumnId<TColumns>) => boolean;
  reset: (columnId: AstryxTableFilterableColumnId<TColumns>) => boolean;
  clearAll: () => boolean;
}>;

export type AstryxTableFilterControlProps<TRow, TColumns extends AstryxTableColumns<TRow>> =
  | Readonly<{
      ownership: "grid";
      children: (commands: AstryxTableGridFilterCommandCapability<TRow, TColumns>) => ReactNode;
    }>
  | Readonly<{ ownership: "external"; children: ReactNode }>;

/** Declares filter ownership without exposing grid state or subscribing to it. */
export function AstryxTableFilterControl<TRow, const TColumns extends AstryxTableColumns<TRow>>(
  props: AstryxTableFilterControlProps<TRow, TColumns>,
): ReactNode {
  return props.ownership === "external" ? (
    props.children
  ) : (
    <GridFilterControl>{props.children}</GridFilterControl>
  );
}

function GridFilterControl<TRow, TColumns extends AstryxTableColumns<TRow>>({
  children,
}: {
  readonly children: (
    commands: AstryxTableGridFilterCommandCapability<TRow, TColumns>,
  ) => ReactNode;
}): ReactNode {
  const { filterCommands } = useClientContext();
  return children(filterCommands);
}
