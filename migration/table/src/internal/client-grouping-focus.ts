type AstryxTableGroupingFocusOwner = Readonly<{
  readonly prepareRemoval: (columnId: string) => () => void;
}>;

const owners = new WeakMap<object, AstryxTableGroupingFocusOwner>();

export function registerAstryxTableGroupingFocusOwner(
  runtime: object,
  owner: AstryxTableGroupingFocusOwner,
): () => void {
  owners.set(runtime, owner);
  return () => {
    if (owners.get(runtime) === owner) owners.delete(runtime);
  };
}

export function prepareAstryxTableGroupingRemovalFocus(
  runtime: object,
  columnId: string,
): () => void {
  return owners.get(runtime)?.prepareRemoval(columnId) ?? (() => undefined);
}
