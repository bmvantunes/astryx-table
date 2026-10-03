import type { CompiledColumn } from "./compile-columns";

export type AstryxTableSetValueIndex = ReadonlyMap<string, readonly unknown[]>;

export function astryxTableSetValueKey(column: CompiledColumn, value: unknown): string | undefined {
  try {
    const presence = value == null ? "nullish" : "value";
    return `${column.semantics.codecId}:${presence}:${
      value == null ? "" : column.semantics.formatCanonicalText(value)
    }`;
  } catch {
    return undefined;
  }
}

export function areAstryxTableSetValuesEquivalent(
  column: CompiledColumn,
  left: unknown,
  right: unknown,
): boolean {
  try {
    return Object.is(left, right) || column.semantics.equivalent(left, right);
  } catch {
    return false;
  }
}

export function createAstryxTableSetValueIndex(
  column: CompiledColumn,
  values: readonly unknown[],
): AstryxTableSetValueIndex {
  const index = new Map<string, unknown[]>();
  for (const value of values) addAstryxTableSetValueToIndex(column, index, value);
  return index;
}

export function hasAstryxTableSetValue(
  column: CompiledColumn,
  index: AstryxTableSetValueIndex,
  value: unknown,
): boolean {
  const key = astryxTableSetValueKey(column, value);
  if (key === undefined) return false;
  return (
    index
      .get(key)
      ?.some((candidate) => areAstryxTableSetValuesEquivalent(column, candidate, value)) === true
  );
}

export function addAstryxTableSetValueToIndex(
  column: CompiledColumn,
  index: Map<string, unknown[]>,
  value: unknown,
): boolean {
  const key = astryxTableSetValueKey(column, value);
  if (key === undefined) return false;
  const bucket = index.get(key) ?? [];
  if (bucket.some((candidate) => areAstryxTableSetValuesEquivalent(column, candidate, value))) {
    return false;
  }
  bucket.push(value);
  index.set(key, bucket);
  return true;
}
