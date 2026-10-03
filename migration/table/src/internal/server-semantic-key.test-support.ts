export function astryxTableTestSemanticQueryKey(candidate: unknown): unknown {
  const bigintTag = "\u0000astryx-table-test-bigint:";
  const escapedStringTag = "\u0000astryx-table-test-string:";
  return JSON.stringify(candidate, (key, value: unknown) => {
    if (typeof value === "bigint") return `${bigintTag}${value}`;
    if (typeof value === "string" && value.startsWith("\u0000astryx-table-test-")) {
      return `${escapedStringTag}${value}`;
    }
    if (key === "select" && Array.isArray(value)) {
      return value.toSorted((left, right) => String(left).localeCompare(String(right)));
    }
    return value;
  });
}
