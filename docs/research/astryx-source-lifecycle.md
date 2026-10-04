# Native source lifecycle presentation

Issue [#9](https://github.com/bmvantunes/astryx-table/issues/9) owns Server viewport
and shared source lifecycle. This first slice activates shared presentation through
the public read-only Client. Server adapter/query/facet activation remains pending;
this document does not claim issue completion or full parity.

## Contract and native component choice

The retained source contracts are in
`migration/reference/docs/grid/requirements.md` (Client row model),
`migration/table/src/internal/astryx-table-view.tsx` (SourceLifecycle,
EmptySourceBody, LoadingRows and focused-control removal), and the corresponding
Client Browser tests. The existing Client adapter and Grid Runtime remain the
only owners of coherent row evidence, source status, retry capability and pending.
No reconnect operation, retry timer, candidate-row cache or public prop is added.

Installed Astryx Core 0.6.5 provides the necessary primitives:

- `Banner` supplies warning/error/status presentation and a native action slot.
  Essential text uses `description`, not its default collapsed children. Source
  messages stay non-dismissible. A terminal empty result uses its card treatment;
  retained rows use a section banner.
- `EmptyState` supplies ordinary empty presentation. Its source hardcodes
  `role="status"` after spreading caller props, so it is not used for an error
  alert. This is an observed API limitation, not a reproduced upstream defect.
- `Button` receives the source's `pending` through `isLoading`; `onClick` calls
  the existing `runtime.retry`. `clickAction` would create native async ownership
  and is deliberately unused. A meaningful tooltip enables the native button's
  documented focusable `aria-disabled` behavior while pending.
- `Skeleton` provides decorative loading content. Its parent owns the fixed
  36-pixel row height and both virtual axes; native defaults do not define grid
  geometry.

The published direct subpaths are used. Banner/Skeleton/EmptyState join the
existing dependency preparation lists to avoid mid-test optimizer reloads.
No Astryx dependency patch is added.

## Integration and ownership

The chrome boundary consumes compact Chrome and Body snapshots to place source
messages above retained rows or inside an empty body. The separate Body boundary
chooses loaded, loading, invalid or empty presentation. Non-loading branches
retain the raw query pipeline even when suppressing visual output, so query
changes can retry rejected candidates without a new source publication. Ordinary
empty results retain the grid headers and keyboard navigation. Stable row publications
leave these compact snapshots unchanged. Test-only commit diagnostics verify
that lifecycle controls do not rerender during the existing 20 Hz workloads.

Loading uses the retained `AstryxTableLoadingViewportAdapterBoundary`, its
measurement, fixed-height geometry and single native scroll owner. Native table
rows/cells contain Skeletons; pinned start/end regions remain separately mounted
and logically owned by their centre semantic row. Suspended pinning uses the
same bounded all-column virtual window. Placeholder DOM identity is separate
from raw Row Identity. No candidate field reader, row renderer or row ID callback
is needed to display loading rows.

SourceBody owns focus transfer across loaded and loading renderers. A removed
focused Retry falls back to the table region, including complete empty-body
unmount; intentional outside focus is preserved. Source pending keeps the current
Retry focused and blocks activation through the native button and existing
runtime command guard.

## Evidence and remaining work

Public Browser regressions cover source-owned Retry/latest callback/pending,
coherent retention, loading candidate suppression, ready/loading focus, empty-grid
navigation, terminal versus ordinary empty states, bounded 5,000 × 150 loading,
RTL/narrow pinning, segmented large row spaces and grouped loading/recovery.

Independent review identified query-only recovery being lost when the raw pipeline
unmounted. Three regressions first failed with a hidden invalid numeric column and
stale/error/closed sources; filtering then clearing that column now recovers the
same source snapshot. A separate empty-to-terminal focus test also failed before
adding that chrome-driven presentation transition to focus reconciliation.
A same-origin iframe regression reproduced cross-realm focus rejection; the
Element check now uses the owning window. Parent-document focus is preserved.
Retry cleanup also checks owning-document focus. Its separate parent-focus
regression already passed before that defensive guard; no reproduced failure
is claimed for the additional concern.

SSR and installed-tarball coverage are included. The first full production run
passed all 39 scenarios, with loading-work p99 3.1 ms and grouped-live p99 7.0 ms.
This was a dirty development run before the query-recovery follow-up; it does not
replace validation of the final commit. No budgets, sample counts or accounting
boundaries changed. Complete final functional validation, renewed independent
review and clean-commit production evidence remain required.
