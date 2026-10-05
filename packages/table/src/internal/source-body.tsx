import { recordAstryxTableSourceLifecycleRender } from "./source-lifecycle-instrumentation";
import { SourceLifecycle } from "./source-lifecycle-view";
import {
  memo,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import type { AstryxTableRuntimeView } from "./grid-runtime";
import type { CompiledColumn } from "./compile-columns";
import { LoadingGrid } from "./loading-grid";

/** Body state owns the presentation branch; source adapters own all row evidence. */
export const SourceBody = memo(function SourceBody({
  runtime,
  columns,
  scope,
  tableId,
  children,
  setRequiredRange,
}: {
  readonly runtime: AstryxTableRuntimeView;
  readonly columns: readonly CompiledColumn[];
  readonly scope: RefObject<HTMLElement | null>;
  readonly tableId: string;
  readonly setRequiredRange?: ((start: number, end: number) => void) | undefined;
  readonly children: (showRows: boolean) => ReactNode;
}) {
  const body = useSyncExternalStore(
    runtime.subscribeBody,
    runtime.getBodySnapshot,
    runtime.getBodySnapshot,
  );
  const chrome = useSyncExternalStore(
    runtime.subscribeChrome,
    runtime.getChromeSnapshot,
    runtime.getChromeSnapshot,
  );
  const grouping = useSyncExternalStore(
    runtime.subscribeInstalledGroupingStructure,
    runtime.getInstalledGroupingStructureSnapshot,
    runtime.getInstalledGroupingStructureSnapshot,
  );
  useLayoutEffect(() => {
    if (__ASTRYX_TABLE_TEST_DIAGNOSTICS__) recordAstryxTableSourceLifecycleRender("body");
  });
  const terminalEmpty =
    body.kind === "empty" && (chrome.status === "closed" || chrome.status === "error");
  const element = useRef<HTMLDivElement>(null);
  const ownedFocus = useRef(false);
  useLayoutEffect(() => {
    if (!ownedFocus.current) return;
    const root = element.current;
    const document = root?.ownerDocument;
    if (
      root === null ||
      document === undefined ||
      !document.hasFocus() ||
      document.activeElement !== document.body
    )
      return;
    const next = root.querySelector<HTMLElement>('[role="grid"]') ?? scope.current;
    ownedFocus.current = false;
    next?.focus({ preventScroll: true });
  }, [body, scope, terminalEmpty]);
  return (
    <div
      ref={element}
      onFocusCapture={(event) => {
        const OwnerElement = event.currentTarget.ownerDocument.defaultView?.Element;
        ownedFocus.current =
          OwnerElement !== undefined &&
          event.target instanceof OwnerElement &&
          event.target.closest('[role="grid"]') !== null;
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget !== null &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          ownedFocus.current = false;
      }}
    >
      {body.kind === "loading" ? (
        <LoadingGrid
          setRequiredRange={setRequiredRange}
          runtime={runtime}
          columns={columns}
          structuralColumns={grouping.columns}
          totalRows={body.totalRows}
          ariaRowCount={body.ariaRowCount ?? body.totalRows}
          tableId={tableId}
        />
      ) : (
        children(body.kind !== "invalid" && !terminalEmpty)
      )}
      {terminalEmpty ? <SourceLifecycle runtime={runtime} scope={scope} placement="empty" /> : null}
    </div>
  );
});
