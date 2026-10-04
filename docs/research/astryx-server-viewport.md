# Native Server viewport activation

Research against the retained source at `00efa81616b2a999714db595fd1fec48caa55c58`,
active Astryx renderer and installed effect-view-server 4.2.8. One independent
read-only research agent inspected integration boundaries; implementation and
verification remain the parent task's responsibility.

The four retained Server modules match the source after the recorded branding
transformation. Their activation passed provenance, 1,066 retained tests and
TypeScript before public integration. No Effect runtime import is needed for
Server: root inference uses the dependency-free viewport-base-row witnesses.
The optional BigDecimal entry remains separate work.

## Source ownership

Preserve Server root sequencing: stage semantic input changes before synchronous
runtime/query publications, then reconcile columns and replace the query. Compare
the transport's opaque semantic key; release and invalidate on semantic changes,
use generation.setWindow for movement, and admit row/key maps together. Old sinks
must never publish into the replacement generation. Row keys and canonical values
come from the source, not reconstructed raw fields or display indexes.

References: `migration/table/src/astryx-table-server.tsx`, active
`server-source-adapter.ts`, `server-viewport-store.ts`, and installed View Server
viewport declarations and React binding. The binding already separates insertion
installation and layout flushing; no upstream reconnect workaround is indicated.

## Native rendering

The active center and pinned renderers previously dropped unresolved indexes and
subscribed only to range changes. Reuse `AstryxTableMountedRowSlots` to subscribe
to bounded ranges and source identity publications, with a subscription recheck.
Unresolved positions own skeleton presentation slots, never invented Row IDs.
Keep one logical accessible row across center/start/end regions and one native
two-axis scroll owner. Preserve the existing virtualizer, pinning suspension,
segmentation and geometry subscriptions.

SourceBody's loading branch uses a separate loading renderer. It must forward
that renderer's current required range to the same source adapter; otherwise
scrolling during loading cannot request newly visible data. No competing hidden
scroll owner should be mounted merely to maintain requests.

## Controls and remaining facets

Shared private control context can consume the adapter's existing result-count
subscription directly. Client facet rows remain explicitly unavailable on Server.
Server Set Filters need the retained source-owned useWholeResult integration,
mounted only while the overlay is open and excluding its own filter. Until issue
#10 activates that path, do not offer a Client facet list over sparse rows and do
not weaken the public source contract by making useWholeResult optional.

## Required proof

The first public slice needs stationary sparse delivery, pinned skeletons and row
ownership, loading window requests, overlap retention, key movement/eviction,
query replacement and late delivery rejection, lifecycle retention and Retry,
active-descendant behavior, narrow/RTL/segmented viewports, source and emitted
inference, real published source integration, SSR/hydration, installed-tarball
checks and production request/delivery/React-commit accounting. Research and
retained core tests alone do not establish native integration parity.

## First implementation checkpoint

The native public Server is now wired to the four unchanged core modules. Fifteen
public Browser cases pass both from source and an installed tarball: stationary
sparse delivery and pinned ownership, loading scroll windows, query replacement
and late-sink rejection, stale/closed/error retention with counts and Retry,
loading-cell keyboard identity, conflicting-key invalidation, grouped presentation,
and a real View Server hook in Strict Mode. Source and emitted type tests preserve
mandatory sorting, exact operands and source authority while rejecting Server
editing, selection, pagination and consumer row IDs. The installed consumer first
passes without Effect before opting into the real-source dependencies.

The complete source Browser suite passes 333 tests; the installed suites pass
248 existing tests plus the fifteen Server tests. SSR independently confirms that
rendering loading markup starts neither viewport nor facet subscriptions. Check,
typecheck, retained core tests, runner tests, build and pack pass. This is dirty
development evidence, not a completed issue or publication gate.

Hydration, overlap/eviction and 20-million-row narrow LTR/RTL segmentation now
pass public integration tests. Unresolved pointer activation is a reviewed
semantic adaptation of the retained navigation module: valid positions remain
coordinates until the source supplies authoritative identity. All 71 Node tests,
1,066 retained tests and provenance verification pass. The manifest records 50
mechanical modules, two current-source contract files and six adaptations.

Three Server production scenarios now measure scroll requests/loading/delivery,
presentation cadence and sparse value delivery. A focused development run passes
with p99 values of 7.9 ms, 18.5 ms and 0.7 ms respectively. The full 42-scenario
suite, complete three-axis review and exact clean-commit gate remain required. Server
facets remain the explicit issue #10 source-owned integration; Active Cell Copy
is part of #13. No Server issue or complete parity is claimed here.

The first full production run passed all 42 scenarios, before review corrections.
The first independent review reported three distinct integration blockers: grouped
focus fallback, sparse loading/count accessibility, and the accessible destination
for retained unloaded identity. Six additional public cases cover these boundaries;
all 76 focused Server/navigation/grouping tests now pass. Updated checks, types,
71 Node tests, provenance, build and the complete 339-test Browser suite pass.
Installed-package validation passes its original 248 cases without Effect and
21 Server cases after opting into the source dependencies. Updated performance
and a fresh independent round remain required; prior results do not approve the
changed diff. See `astryx-bugs.md` for the reproduction and correction details.

Round two found and corrected a horizontal loading-proxy ownership gap: the proxy
cell now belongs to the mounted semantic row, or to its own single row only when
that logical row is absent. The transition regression failed before correction;
all 22 Server cases pass afterward. No source key or loaded value is invented for
the proxy. The second complete 42-scenario run passed before this final correction,
so a fresh complete review and updated performance evidence are still required.

The ownership regression now covers unpinned and suspended pinning too. Both
revealed incorrect DOM-before-proxy ordering. Native rows now expose their complete
ordered cell ownership uniformly, allowing temporary proxies to join and leave
without changing logical order. All 24 Server cases pass; final full validation,
review convergence and clean-commit proof remain separate gates.

A nested-grid reproduction subsequently proved that proxy owner lookup also needs
the existing nearest-grid guard. That one-line correction preserves table-local
ownership when the outer active row is evicted; all 25 Server cases pass. Updated
complete checks, independent convergence and exact-commit performance remain required.
