# Native grouping reuse for Client #7

Inspected the published Astryx Core 0.6.5 source and retained Client grouping
contracts on 2026-10-04. This is a source-supported reuse decision, not a report
of an upstream defect.

## Native APIs and retained requirements

`useTableGroupedRows` groups raw records by a string key, inserts a full-width
synthetic header, and can hide the member rows. Its `renderGroupHeader` replaces
header content; the plugin still supplies the disclosure behavior and a spanning
cell. `groupOrder` orders section keys, not the aggregate sorting context. Its
count is `rows.length`; no exact aggregate algebra or typed Group Key/Aggregate
callback boundary is provided.

`useTableTreeState` flattens hierarchical children and owns expansion intent.
`useTableTreeData` accepts externally supplied tree metadata and adds indentation
and expanders. `useTableRowExpansion` adds a disclosure column and detail panels.
These are useful maintained capabilities for different row structures.

Our V1 requires one flat summary row per complete ordered key tuple, with keys,
Rows and participating aggregates, no disclosure, member rows or drill-down.
Adapting native grouped headers would retain our executor while introducing a
second grouping/header authority. Keep the retained executor and presentation
compiler, and render their output through the existing native TableRow,
TableHeaderCell and TableCell. Use native Selector, Button and VisuallyHidden for
the ordered Group By commands, with the existing TanStack Hotkeys Adapter.

Sources:

- `node_modules/@astryxdesign/core/src/Table/plugins/groupedRows/useTableGroupedRows.tsx`, API, row derivation and renderGroupHeader.
- `node_modules/@astryxdesign/core/src/Table/plugins/groupedRows/useTableGroupedRows.test.tsx`, raw renderCell suppression regression.
- `node_modules/@astryxdesign/core/src/Table/plugins/tree/useTableTreeState.tsx` and `useTableTreeData.tsx`.
- `node_modules/@astryxdesign/core/src/Table/plugins/rowExpansion/useTableRowExpansion.tsx`.
- `migration/reference/docs/grid/requirements.md`, grouping and aggregation.
- `migration/reference/docs/grid/implementation-plan.md`, Phase 10.
- `migration/reference/docs/adr/0031-own-exact-aggregate-arithmetic-in-column-value-semantics.md`.

Do not call fabricated raw-cell rendering an Astryx bug: native grouped headers
explicitly suppress the ordinary raw-cell renderer, with upstream regression
coverage. Their Proxy-backed section headers simply implement a different model.

## Retained authority and activation

`deriveAstryxTableClientGroupedProjection` already owns exact tuple identities,
bigint row counts, aggregate execution, separate grouped sorting and stable
unchanged group references. `AstryxTableGroupedPresentationCompiler` derives key
columns, Rows and visible aggregates, removes raw-row callbacks, and wraps only
role-specific contexts. No raw record is fabricated for these callbacks.

`AstryxTableClientProjectionStore` coordinates the complete source and query
projection before publication. Its initial constructor also supports restored
SSR grouping. The public slice had explicitly rejected grouping; activation
must remove that guard and pass the actual installed projection kind at the
viewport boundary, which previously hardcoded `raw`. The latter is a local
integration gap, not a native library workaround.

Preserve normal `orderBy` separately from `groupOrderBy`, dormant base order and
pinning, forced active-key visibility, the exact Rows System Column identity and
persisted width, and identity-first live focus reconciliation. Shape changes
reset logical focus only after the new projection without moving control focus.
Public/installed tests must prove these behaviors rather than relying solely on
retained core coverage.

LoadedRowCount follows the runtime's resident projection, as in the source
implementation: while grouped it counts resident summaries. ResultRowCount also
counts the grouped result. It is not a second raw-source-row count in this mode.
The first new test assumed three raw rows but the source contract reports two
resident summaries; the expectation was reconciled against the retained runtime
and toolbar implementation, without changing the count engine.

Sources: current and retained `internal/client-grouping.ts`,
`client-grouping-presentation.ts`, `client-row-pipeline.tsx`, `grid-runtime.ts`,
`toolbar-capabilities.tsx`; retained public `client-grouping.browser.test.tsx`.

## Remaining full-issue evidence

Source lifecycle/error recovery (#9), optional-Effect aggregate presentation,
installed-consumer validation, grouped virtualization and live publication
performance must be reconciled before declaring #7 done. Management controls
and live schema focus recovery are covered by the current public activation
regressions; pointer grouping is reconciled below.
Row Selection, range selection and canonical Copy integrations remain coupled to
#13 and must receive their grouped transition regressions there. No issue is
closed by this research or the first grouping activation tests.

## Reconciled specification conflicts

All ten direct retained grid documents and ADR 0031 were inspected. The settled
architecture (lines 527–531) explicitly says V1 requires no pointer drag or
keyboard pickup/drop workflow. Older API/implementation-plan references to
pointer addition do not add such a workflow back: native Add/Remove and scoped
Alt-arrow commands satisfy the settled V1 control model.

Rows-width intent remains dormant if replacement definitions temporarily remove
grouping eligibility. Requirements around line 471 and the current runtime's
`rowsWidth`/`queryRowsWidth` split preserve an explicit user override; older prose
that says to discard it must not erase durable intent.

The visibility picker retains the complete base registry and adds only forced
active-key presentation. The sort picker instead reads installed grouped columns
and existing column-command sortable admission. The installed grouping snapshot
is stabilized by layout/presentation keys and avoids hot value subscriptions.

Native Divider remains the resize presentation. The retained runtime supplies
Rows bounds of 32–1000 CSS pixels and owns committed persistence. A normally hidden
active key still needs resize participation even though its dormant base
`command.visible` is false; resolve rendered participation without changing that
base preference.

Replacement definitions can remove a focused chip or Remove control even when no
Remove gesture was issued. Logical projection reconciliation does not recover
DOM focus; track only owned focus and move it to a surviving group control or a
stable table destination when its node disappears. Never reclaim intentional
outside focus. Menu-originated removal needs the same explicit handoff.

The Add Group trigger must be recognized with its owning document's button
constructor. A real iframe regression reproduced the global-constructor check
leaving focus on the iframe body when the last eligible column was revoked.
The corrected check recovers to the surviving grid and preserves intentional
parent-document focus. Both cases run through public and installed consumers.

## Production optimization and retained boundaries

The complete public 20 Hz workload initially failed at p99 15.3 ms for 2,000
resident rows, two keys and four aggregates. Temporary phase probes localized
the cost to repeated grouped derivation. A generic canonical-cache LRU rewrite
and a per-derivation key trie were investigated and removed; neither is required
by the final change.

The Projection Store now owns a bounded cache of successful prepared built-in
inputs keyed by immutable Adapter admission objects. Its plan includes the exact
compiled key and aggregate columns and the key/aggregate boundary. The boundary
matters: promoting an aggregate to a key can preserve the combined column array
while changing the tuple. A failing differential test precedes that fix.

Retain at most 16,384 key/aggregate slots from the latest successful filtered
projection. The temporary previous/next maps have a bounded peak of twice that
slot budget and the old map is released on commit. Ungrouping and owner disposal
clear it. Column replacement, tuple order, key/aggregate roles and participating
aggregate changes invalidate the plan; overflow uses the ordinary uncached path.
Only literal built-in text/boolean/number/bigint inputs are reused. Custom key
codecs disable preparation, and custom aggregate inputs are reread. The initial input-cache optimization still ran every aggregate operation,
comparison and final division in source order. The native-result refinement below
adds reuse only for provably unchanged native groups; it introduces no inverse
or reassociated arithmetic. Built-in distinct counts
use exact primitive Set identity: native canonical scalar encoding is injective,
with a private Missing sentinel distinct from null and undefined. This avoids
allocating framed strings per scalar without changing equality or bigint values.
Custom distinct inputs still execute their canonical encoder on every derivation,
including observable failures and recovery. Tests cover all four native domains,
missing/null/undefined, signed zero, large bigint and custom canonical collisions.

Two focused production runs passed after the prepared-input change, including a
run after removing the generic cache rewrite. These are dirty development
measurements, not exact-commit publication evidence. The complete 37-scenario
suite and clean-commit attestation remain required. Per-scenario budgets, sample
counts and dropped-frame limits remain unchanged. The runner watchdog grows from
180 to 240 seconds to accommodate the additional grouped scroll (~20 seconds)
and live (~6 seconds) scenarios on top of the prior ~159-second suite.

The first full dirty suite failed grouped live work at p99 9.0 ms despite earlier
focused passes. A further phase probe confirmed repeated grouping work; it was
removed after diagnosis. Primitive distinct identity reduced the next focused
run to p99 6.9 ms, maximum 7.2 ms, with no over-budget samples. This is development
evidence only; the complete suite and clean-commit measurement remain required.

Subsequent full runs still exceeded grouped-live work (p99 8.8 and 8.4 ms); one
also failed start-resize cadence, which passed unchanged in focused repetition.
The cause of the cadence variance is unconfirmed. CPU diagnostics and temporary
array-state, algebra-call and lazy-identity experiments were removed without
weakening the measurement protocol. The pipeline now passes immutable admitted
rows through one shared reader rather than allocating a wrapper and closure per
resident row on every publication. Standalone derivation keeps its existing API;
exact operations, error handling and bounded preparation remain unchanged.
A differential test covers direct-reader identity replacement and failure recovery.
Focused production passed at p99 7.4 ms; full-suite validation remains required.

### Native result reuse follow-up

The exact clean `f0b34db` run failed grouped live work at p99 8.5 ms against
8.33 ms, despite the preceding full dirty pass. An epoch-based input-cache
retention experiment failed at 8.6 ms and was set aside; it demonstrated no gain.
These results do not constitute publication evidence.

The Client Adapter now explicitly opts its pure canonical reader into a bounded
membership prepass. It compares the exact ordered immutable admission identities
for each group, under the same compiled key/aggregate plan. Only columns certified
by the column compiler qualify: a private WeakSet records its frozen native
columns. Custom descriptors and cloned columns/semantics cannot certify purity.
This also keeps altered key encoders and distinct-count encoders on their normal
execution path. No public option or consumer requirement is added.

An unchanged native group reuses its successful row result. Changed groups still
execute the existing aggregate loop in original source order; custom or mixed
plans always do so. Current first-occurrence positions and group sorting are
rebuilt. The prepass contains identity evidence, not per-group value arrays or
inverse arithmetic. If speculative key preparation fails, the normal executor
runs to preserve the original first diagnostic. This speculation is enabled only
at the Adapter seam whose reads are canonical and repeatable.

Result reuse requires all resident prepared value slots to fit the 16,384-slot
input budget. Separately, membership references plus retained key, aggregate and
Rows result slots must fit 16,384 slots. Only the latest successful projection is
retained, with bounded previous/next overlap. Failure does not commit partial
membership or results. Plan replacement, overflow, ungrouping and disposal drop
inapplicable evidence. Differential tests cover identity replacement, source and
member order, deletion, movement between groups, schema changes, exact bigint,
capacity fallback, failures and overridden native callbacks. Production and
independent review of this refinement are pending.

The first full production suite with native result reuse passed all 37 scenarios
(24 tests), including grouped-live p99 7.3 ms, maximum 7.6 ms and zero over-budget
samples. This is a dirty development result. Complete functional validation,
independent review and exact clean-commit production evidence remain required.
