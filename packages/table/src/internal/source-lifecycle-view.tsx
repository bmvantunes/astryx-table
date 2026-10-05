import { recordAstryxTableSourceLifecycleRender } from "./source-lifecycle-instrumentation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { memo, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import type { AstryxTableChromeSnapshot, AstryxTableRuntimeView } from "./grid-runtime";

/** Lifecycle ownership stays in the source; row publications do not wake this boundary. */
export const SourceLifecycle = memo(function SourceLifecycle({
  runtime,
  scope,
  placement = "above",
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly scope: RefObject<HTMLElement | null>;
  readonly placement?: "above" | "empty";
}) {
  const chrome = useSyncExternalStore(
    runtime.subscribeChrome,
    runtime.getChromeSnapshot,
    runtime.getChromeSnapshot,
  );
  const body = useSyncExternalStore(
    runtime.subscribeBody,
    runtime.getBodySnapshot,
    runtime.getBodySnapshot,
  );
  useLayoutEffect(() => {
    if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableSourceLifecycleRender("chrome");
  });
  const terminal = chrome.status === "closed" || chrome.status === "error";
  const visible = placement === "empty" ? terminal : !(terminal && body.kind === "empty");
  const retry = visible && terminal ? chrome.retry : undefined;
  const ownedFocus = useRef(false);
  const retryElement = useRef<HTMLButtonElement>(null);
  useLayoutEffect(
    () => () => {
      const button = retryElement.current;
      if (
        button !== null &&
        button.ownerDocument.hasFocus() &&
        button.ownerDocument.activeElement === button
      )
        scope.current?.focus({ preventScroll: true });
    },
    [scope],
  );
  useLayoutEffect(() => {
    if (retry !== undefined || !ownedFocus.current) return;
    ownedFocus.current = false;
    const root = scope.current;
    if (
      root !== null &&
      root.ownerDocument.hasFocus() &&
      root.ownerDocument.activeElement === root.ownerDocument.body
    ) {
      root.focus({ preventScroll: true });
    }
  }, [retry, scope]);
  const invalid = invalidSourceDetails(chrome.invalid);
  const description =
    [chrome.message, chrome.statusCode, invalid]
      .filter((detail): detail is string => detail !== undefined && detail.length > 0)
      .join(" · ") || undefined;
  const title =
    chrome.status === "stale"
      ? "Live data delayed"
      : chrome.status === "closed"
        ? "Live updates stopped"
        : chrome.status === "error"
          ? "Live data error"
          : chrome.invalid?.kind === "row-count-mismatch"
            ? "Incomplete source"
            : chrome.invalid?.kind === "invalid-group"
              ? "Invalid grouped result"
              : chrome.invalid !== undefined
                ? "Invalid source"
                : undefined;
  if (!visible || title === undefined) return null;
  return (
    <Banner
      status={chrome.status === "stale" ? "warning" : chrome.status === "closed" ? "info" : "error"}
      title={title}
      description={description}
      container={placement === "empty" ? "card" : "section"}
      endContent={
        retry === undefined ? undefined : (
          <Button
            ref={retryElement}
            label="Retry"
            size="sm"
            variant="secondary"
            tooltip={retry.pending ? "Retry in progress" : "Retry live updates"}
            isLoading={retry.pending}
            onClick={runtime.retry}
            onFocusCapture={() => {
              ownedFocus.current = true;
            }}
            onBlurCapture={(event) => {
              if (event.relatedTarget !== null) ownedFocus.current = false;
            }}
          />
        )
      }
    />
  );
});

function invalidSourceDetails(invalid: AstryxTableChromeSnapshot["invalid"]): string | undefined {
  if (invalid?.kind === "invalid-value")
    return `Source row ${String(invalid.rowIndex + 1)}, column ${invalid.columnId}: ${invalid.message}`;
  if (invalid?.kind === "invalid-group")
    return `Grouped result, column ${invalid.columnId}: ${invalid.message}`;
  if (invalid?.kind === "invalid-status")
    return `Unsupported source status: ${invalid.receivedStatus}.`;
  if (invalid?.kind === "invalid-lifecycle")
    return `Unreadable Client Source lifecycle field: ${invalid.field}.`;
  if (invalid?.kind === "invalid-rows")
    return `Invalid Client Source rows: ${invalid.receivedRows}.`;
  if (invalid?.kind === "row-count-mismatch")
    return `Expected ${String(invalid.expectedRows)} rows but received ${String(invalid.receivedRows)}.`;
  return undefined;
}
