export const ASTRYX_TABLE_SOURCE_STATUS_CODE_LENGTH_LIMIT = 128;
export const ASTRYX_TABLE_SOURCE_MESSAGE_LENGTH_LIMIT = 512;

export function snapshotAstryxTableSourceStatusCode(value: unknown): string | undefined {
  return boundedOptionalText(value, ASTRYX_TABLE_SOURCE_STATUS_CODE_LENGTH_LIMIT);
}

export function snapshotAstryxTableSourceMessage(value: unknown): string | undefined {
  return boundedOptionalText(value, ASTRYX_TABLE_SOURCE_MESSAGE_LENGTH_LIMIT);
}

function boundedOptionalText(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length <= limit ? value : value.slice(0, limit);
}
