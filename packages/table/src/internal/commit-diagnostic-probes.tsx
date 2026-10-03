import { Fragment, useLayoutEffect } from "react";

import type { ReactElement, RefCallback } from "react";

import {
  recordAstryxTableClientCellRender,
  recordAstryxTableClientGridSurfaceRender,
  recordAstryxTableClientHeaderRender,
  recordAstryxTableClientRowRender,
  recordAstryxTableClientSortPanelRender,
  recordAstryxTableClientViewRender,
} from "./render-instrumentation";
import { ASTRYX_TABLE_COMMIT_PROBE_DIAGNOSTIC_SENTINEL } from "./test-diagnostic-build-contract";
import { recordAstryxTableRowSelectionRender } from "./row-selection";

export function AstryxTableViewCommitDiagnosticProbe({
  commitEvidence,
  tableId,
}: {
  readonly commitEvidence: unknown;
  readonly tableId: string;
}): ReactElement {
  void commitEvidence;
  useLayoutEffect(() => recordAstryxTableClientViewRender(tableId));
  return <Fragment key={ASTRYX_TABLE_COMMIT_PROBE_DIAGNOSTIC_SENTINEL} />;
}

export function AstryxTableGridSurfaceCommitDiagnosticProbe({
  commitEvidence,
  tableId,
}: {
  readonly commitEvidence: unknown;
  readonly tableId: string;
}): ReactElement {
  void commitEvidence;
  useLayoutEffect(() => recordAstryxTableClientGridSurfaceRender(tableId));
  return <Fragment key={ASTRYX_TABLE_COMMIT_PROBE_DIAGNOSTIC_SENTINEL} />;
}

export function AstryxTableHeaderCommitDiagnosticProbe({
  commitEvidence,
  tableId,
}: {
  readonly commitEvidence: unknown;
  readonly tableId: string;
}): ReactElement {
  void commitEvidence;
  useLayoutEffect(() => recordAstryxTableClientHeaderRender(tableId));
  return <Fragment key={ASTRYX_TABLE_COMMIT_PROBE_DIAGNOSTIC_SENTINEL} />;
}

export function AstryxTableSortPanelCommitDiagnosticProbe({
  commitEvidence,
  tableId,
}: {
  readonly commitEvidence: unknown;
  readonly tableId: string;
}): ReactElement {
  void commitEvidence;
  useLayoutEffect(() => recordAstryxTableClientSortPanelRender(tableId));
  return <Fragment key={ASTRYX_TABLE_COMMIT_PROBE_DIAGNOSTIC_SENTINEL} />;
}

export function AstryxTableRowCommitDiagnosticProbe({
  commitEvidence,
  rowId,
  tableId,
}: {
  readonly commitEvidence: unknown;
  readonly rowId: string;
  readonly tableId: string;
}): ReactElement {
  void commitEvidence;
  useLayoutEffect(() => recordAstryxTableClientRowRender(tableId, rowId));
  return <Fragment key={ASTRYX_TABLE_COMMIT_PROBE_DIAGNOSTIC_SENTINEL} />;
}

export function createAstryxTableCellCommitDiagnosticRef({
  columnId,
  commitEvidence,
  rowId,
  tableId,
}: {
  readonly columnId: string;
  readonly commitEvidence: unknown;
  readonly rowId: string;
  readonly tableId: string | undefined;
}): RefCallback<HTMLTableCellElement> {
  void commitEvidence;
  return (element) => {
    if (element !== null) recordAstryxTableClientCellRender(rowId, columnId, tableId);
  };
}

export function AstryxTableRowSelectionCommitDiagnosticProbe({
  commitEvidence,
  rowId,
  tableId,
}: {
  readonly commitEvidence: unknown;
  readonly rowId?: string;
  readonly tableId: string;
}): ReactElement {
  void commitEvidence;
  useLayoutEffect(() =>
    recordAstryxTableRowSelectionRender(tableId, rowId === undefined ? "header" : "row", rowId),
  );
  return <Fragment key={ASTRYX_TABLE_COMMIT_PROBE_DIAGNOSTIC_SENTINEL} />;
}
