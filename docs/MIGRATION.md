# Audited import and control foundation

The merged issue #2 established the non-shipping migration baseline and approved
Astryx 0.6.5 corrections. The merged issue #3 slice activates a read-only Client
and separately tests its Astryx presentation and emitted package. Later features
and the release gate remain pending.

## Source and transformations

The original audited baseline is merged commit
`431aa4013db89bb8d803e8b7cff005d8375b9cdf` of
[bmvantunes/shadcn-table](https://github.com/bmvantunes/shadcn-table/tree/431aa4013db89bb8d803e8b7cff005d8375b9cdf).
No dirty working-tree files or unmerged PR #100 implementation were copied.
`migration/manifest.json` records all 603 source tree entries, including exclusions,
Git modes/blob identities, source SHA-256 hashes and retained target SHA-256 hashes.
302 files are retained.

Only `packages/table/src` receives these ordered, case-sensitive literal
replacements, in both contents and filenames:

| Original      | Successor      |
| ------------- | -------------- |
| `BrunoTable`  | `AstryxTable`  |
| `brunoTable`  | `astryxTable`  |
| `bruno-table` | `astryx-table` |
| `BRUNO_TABLE` | `ASTRYX_TABLE` |

Other retained files are byte-identical reference material. Executable/configuration
reference files carry a `.reference` suffix so tools cannot discover them as active
project configuration. Original copyright, notices, source-domain documentation,
ADRs, benchmarks and release tests remain available. `@bruno/table` imports inside
archived consumer tests and historical repository URLs are intentionally retained.
They are not successor package exports.

Run `vp run verify:import /path/to/shadcn-table` to verify every origin blob and the
complete deterministic transform. Without a source checkout the command checks
only retained inventory and hashes. Added, deleted or edited retained files fail.
The immutable tree is excluded from formatting/lint rewriting; it is not exempt
from hash verification or the retained test gates. CodeRabbit uses the same
user-approved exemption for `migration/table/**` and `migration/reference/**` to
keep the review within its file limit; it still reviews the manifest, verifier,
patches, integration code and CI. Semantic changes must live outside this frozen
archive and receive a full review.

## Ownership and persistence reconciliation

`migration/table` is quarantined from the application, package exports, package
build, and production dependency graph. It may contain old renderer imports as
per issue #2's temporary non-shipping renderer allowance. No legacy UI dependency
is installed into the successor workspace. Imported descriptions requiring
Base UI controls or Tailwind are historical: the successor requires published
Astryx controls and StyleX, as specified in `SPEC.md`.

The new brand changes internal DOM attributes, diagnostics and reserved system
identities. There is no automatic import of BrunoTable persisted preferences.
Applications must treat AstryxTable preferences as a separate namespace until an
explicit migration is designed and tested. Stable consumer column and row IDs,
exact value semantics, and versioned sanitized user-only preferences remain required.
See `PARITY.md` for the feature owners and evidence still required.

## Known follow-up disposition

[PR #100](https://github.com/bmvantunes/shadcn-table/pull/100) remains excluded.
Its known changes/findings have explicit owners:

| Finding/change                                       | Disposition                                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deleted files survive release snapshot cloning       | #16: rebuild release capture against the final successor tree; do not execute archived release scripts. The import verifier rejects missing/extra files and its verification fixture starts from an empty directory. |
| `GIT_*` overrides contaminate source capture         | Import Git commands scrub those variables. #16 must prove this again for release capture.                                                                                                                            |
| Executable modes missing from source identity        | Import records the exact Git mode. Reference copies are inert data, not a released build snapshot. #16 must hash and verify final release modes.                                                                     |
| Missing provenance/failure command logs              | New import fixture prints each executed command and fails on nonzero status. #16 still owns the complete release evidence/failure artifact contract.                                                                 |
| Menu final focus steals deliberately moved focus     | #3/#5: prove published Astryx menu focus with the new renderer; do not transplant the Base UI workaround. Selector focus correction and control regressions are included here.                                       |
| Dirty-remap benchmark callback missing `async`       | #16: explicitly repair/review this before running the migrated performance gate. The archived baseline is not performance certification.                                                                             |
| Grouping/browser assertion and package-skill changes | #7/#15/#16: reconcile against Astryx markup, accessibility and emitted package; not silently copied or treated as passed.                                                                                            |

## Verification boundaries

- `vp run test:core`: presentation-independent retained Node contracts run directly
  from the immutable renamed source with the original dependency versions.
- `vp run test:import /path/to/shadcn-table`: creates a disposable archive of the
  pinned source, installs its frozen dependencies and builds its original UI types.
  Replaces the entire table source with the verified renamed tree, updates fixture
  compiler defines, then runs all retained source type and Node tests. This proves
  import fidelity against original UI contracts; it does **not** prove Astryx UI,
  emitted successor types or installed successor behavior. The fixture is outside
  the successor workspace and its location is printed for diagnosis.
- `vp run test:browser`: real successor StyleX/React Compiler control regressions,
  workbench and public Client tests. It is not full grid parity certification.
- Source layout/Compiler, benchmark-runner, Server facet and Client/Server SSR
  contracts depend on the original workspace/UI and run in the import fixture,
  not the direct core runner. Browser and performance files remain in the ledger
  pending their respective Astryx slices; no old assertion was weakened.

## Astryx corrections

Core and neutral theme are pinned to 0.6.5. The initial approved pnpm patch changed six
upstream source modules (+81/-29), together with their shipped JS/declarations:
TextInput native props; Selector focus return; Toast cancellation/lifecycle; and
Dialog/focus-trap containment and restoration. Regression cases run against the
installed patched package, including StrictMode, nested dialogs and startup toast
cancellation. A further review regression proves that a nested Popover owns
forward/reverse Tab and one Escape before its host Dialog. The original unpatched experiment had 31/42 passing cases; the patched
experiment passed 42/42. The project adds that Popover regression and retains its two workbench Browser
cases, plus a public Selector-to-Dialog synchronous focus-transfer regression,
for 46 Browser cases in total.

No upstream issue/PR or npm publication is part of this change. A pnpm installation
patch does not propagate to consumers of a published grid. #16 must settle and
verify that distribution boundary before releasing any dependent renderer. Remove
patches only after the same regressions pass against an unpatched upstream version.

The subsequent native Table investigation adds two source modules and their shipped
JS: sticky-column and sorting plugins now publish semantic configuration changes to
Table/React Compiler while preserving memoization for equivalent values. The patch
adds no new public API. Regression cases exercise the published Table entry with
stable data/columns. See [the running bug record](../astryx-bugs.md) and
[reuse assessment](research/astryx-table-reuse.md). These plugin fixes are preparation
for adoption, not a claim that full pinning/sorting parity is implemented.

## Activated Client core and newer source corrections

`packages/table/core-provenance.json` records 50 activated modules. Forty-four
are byte-identical to the retained baseline, one has the reviewed diagnostic correction
described below, and five use the current merged source
`00efa81616b2a999714db595fd1fec48caa55c58`, with only the recorded branding
renames: column helpers, Client source adapter, navigation, Compiler adapter and
viewport. Their raw bytes, Git blobs and hashes are archived separately from the
immutable initial import. Two current-source helper contract files are retained
with explicit import remapping. No dirty source working-tree content was imported.

`verify:active-core` verifies these bytes and transformations. Only these exact
files are excluded from automatic formatting, preserving the audit trail; lint,
TypeScript and behavioral verification remain enabled. Semantic edits must leave
this mechanical-copy ledger and receive ordinary review.
`test:active-core` runs the 1,066 retained core cases with imports redirected to
activated modules where available. Unactivated subsystems still use their retained
baseline. This is not 1,066 newly written renderer tests.

The new public Client suite covers exact bigint sorting, empty results, keyboard
menu focus, 10,000 × 150 data, unchanged-row presentation, root render isolation
and coherent per-frame horizontal preparation. Source and installed declarations
share an inference/rejection fixture. `test:package` exercises the actual tarball
and its emitted CSS in an isolated consumer without Effect or StyleX compilation.
The source control patch is not applied to that consumer; only the specific
read-only menu/rendering path is proven against unpatched Astryx 0.6.5.

## Current-source follow-up ownership

Remote `main` was verified on 2026-10-03 at
`00efa81616b2a999714db595fd1fec48caa55c58`. This advances the parity target beyond
the older local checkout; the immutable initial import remains reproducible.

| Source PR | Requirement and Astryx disposition                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| #101      | Resize-preview row windows/transforms: active viewport updated; gesture proof remains #4.                                          |
| #102      | Portal stacking: prove equivalent Astryx overlays under #5/#15; do not copy Base UI layers.                                        |
| #104      | Drag-fill frame optimization and accessible row ownership: #14/#15/#16.                                                            |
| #105      | Invalidated Active Cell stays cleared: active navigation updated; Server proof under #9.                                           |
| #106      | Retained-source lifecycle recovery: active source adapter updated; lifecycle proof under #9.                                       |
| #107      | Measured header insets: active viewport/Compiler adapter updated and header attached; keyboard reveal proof under #5.              |
| #108      | PageUp remains on the active header: active navigation updated; interaction proof under #5.                                        |
| #109      | Opaque Combobox chips remain renderable: Astryx filter/group control proof under #6/#7/#15.                                        |
| #110      | Select aggregate capability: active helper updated; 18 retained Node contracts and source/emitted Select type fixture run.         |
| #111      | Fail-closed diagnostics and runtime chunks: native build definitions adopted and tested; complete chunk/release audit remains #16. |

Resize/reorder, complete keyboard navigation, filters, grouping, selection,
Server and editing interfaces must each pass their ledger rows before full parity
is claimed. New upstream source commits require explicit reconciliation in this
ledger; old smoke-test results never establish their behavior in the new renderer.

## Reviewed correction in the first Client slice

`toolbar-instrumentation.ts` is an explicit semantic adaptation, outside the
mechanical import exemption. Its two diagnostic publishers isolate observer
exceptions so diagnostics cannot interrupt subscriptions or suppress later
observers. Source and target hashes are recorded under `reviewedChanges` in the
active-core manifest, and independent review plus regression tests cover the
change. The remaining 47 active modules and two source contracts remain exact.

The range-runtime identity-attribute comment on PR #18 concerns the future #13
integration. The current Client never constructs or attaches that runtime, and
Row Selection is explicitly unavailable. Its type-only renderer references do
not activate pointer hits or range registration. #13 must connect stable cell
identities and prove range behavior through the public Browser seam before that
capability becomes available; adding unused legacy attributes is not evidence
of that integration.

## Production validation for the migrated Client

`vp run test:browser:performance` runs React's production profiling build with
Compiler enabled and the retained capable-hardware profile and evidence finalizer.
The Client slice has raw and pinned 5,000 × 150 two-axis/custom-renderer workloads and a
5,000 × 150 live-publication workload at 20 Hz. All preserve 12 warmup and 100
measured samples, complete callback/React work accounting and the 8.33 ms p99
budget. Presentation cadence retains its separate 20 ms threshold. Commit probes
measure the renderer view and grid surface, matching the source instrumentation
boundary, rather than counting the consumer's source-prop delivery component.

The report at `test-results/performance.json` records environment, scenario evidence,
commit and working-tree cleanliness. A dirty-tree report is development evidence,
not evidence for a published commit. The package's `prepublishOnly` invokes this
same command; the package remains private and no publication is authorized.

These scenarios do not certify resizing, reordering, editing, Server updates or
other unimplemented capabilities. Their retained scenarios remain owned by the
corresponding feature tickets and the full release gate in #16. No original
profile, sample minimum, timing budget or accounting rule has been weakened.

CI's `performance-evidence` job checks the exact push/PR head and requires the
repository owner's successful `performance/capable-hardware` status plus the linked
structured report. The publisher accepts only a clean start/end at the same commit,
all required scenarios, the production environment and unchanged budgets. Standard
GitHub hardware verifies that attestation; the timings execute on a compatible host.
The same rule applies to the new SHA produced by merge. This enforces the migrated
feature gate now; it does not defer performance validation to #16.

## Native pinning integration (issue #4, first slice)

The renderer composes published Astryx Table cells, headers, rows and sticky-column
presentation with the retained viewport's one scroll owner and bounded two-axis
windows. Initial, restored and menu pinning share the existing command and
preference state. Measured narrow viewports suspend pinning and restore it when
the layout fits; premeasurement SSR keeps a bounded unpinned window. Flat keyed
headers preserve menu focus when a column moves between regions.

Public Browser and installed-tarball regressions cover LTR/RTL alignment, narrow
viewport recovery, persistence, keyboard menu focus and long custom content.
Chromium accessibility-tree checks prove one logical row with ordered cells across
all three visual regions during horizontal window changes. The performance gate
now also requires pinned scroll work and cadence, with the original thresholds.
Resize/reorder and complete keyboard navigation remain pending; this slice does
not close issue #4 or certify complete parity.

## Native resize presentation (issue #4, second slice)

The public Astryx `Divider` presents a vertical resize handle inside each native
header. Pointer preview uses the retained viewport CSS variables and one queued
animation frame; final width changes use the existing Grid Command and persistence
path. The retained column-gesture XState workflow is activated byte-for-byte with
its provenance entry and existing tests. TanStack Hotkeys owns keyboard matching,
modifier handling and scoped Escape. A table boundary also scopes sibling toolbars.

The shared polite status region announces accepted widths and cancellation.
Ordinary width previews keep geometry outside React state and perform no persistence.
Source invalidation, pointer cancellation, Escape and unmount roll back previews;
value-only live updates preserve the active gesture. Resizing may suspend pinning
and cancellation restores the previous geometry.

[The native reuse assessment](research/astryx-column-gestures.md) explains why the
published Table resize engine cannot delegate its geometry and keyboard ownership
through its current API. This is a capability mismatch, not a patched upstream bug.
The production gate adds start/end resize work and presentation cadence with the
same warmup, sample counts and thresholds. Reorder and complete keyboard navigation
remain pending; this slice does not close #4.

### Deferred native menu layers

The resize performance investigation adds an opt-in `usePopover.lazyMount` seam and enables it for native DropdownMenu. Layer's existing lazy lifecycle remains authoritative. DropdownMenu reads the existing Layer dismissal guard through a private Popover hook before retaining deferred opening intent, preserving keyboard focus, controlled rejection and same-gesture dismissal. Public `show` methods retain their original void-returning callback contract. Public regressions cover repeated opens and no retained closed menu layer; all previous focus suites remain required. Ordinary Popover defaults remain eager. See `astryx-bugs.md` for the controlled performance comparison and exact patch footprint. This workspace patch is not propagated by the emitted grid; issue #16 remains a release prerequisite.

## Native reorder presentation (issue #4, third slice)

Native icon-only Buttons present drag handles; native menus expose logical start/end
moves constrained to the current pinning region. Pointer drops may change order and
pinning atomically through the retained command. The private gesture owner now serves
resize and reorder with one pointer lifecycle, TanStack Escape handling, and stable
callbacks. `column-geometry.ts` is activated byte-for-byte with provenance.

Reorder previews share per-column transforms across headers and cells without React
state updates or preference writes. The viewport owns edge scrolling; geometry is
updated after its published header window is mounted. Stable measured anchors and
committed widths avoid layout reads on every scroll frame; native scroll writes
precede preview style changes. Source disappearance through
virtualization preserves the logical source index. Centre fill is an unpin drop zone;
suspended centreless layouts preserve the source pinning intent. Focus restoration is
bounded and stops if another control or window takes focus.

Public tests cover LTR/RTL menu moves and disabled boundaries, preview/final-pointer
coordinates, atomic pinning, narrow suspension, source unmount during autoscroll,
cancellation/teardown, focus ownership and live source publications. The same tests
run against the installed tarball. The production gate adds preview and RTL autoscroll
work/cadence over 5,000 rows and 150 columns, including a custom renderer. Every active
frame is accounted once, and final commit/deferred cleanup is charged to the last
sample. Existing scenarios and budgets are unchanged. The new full-range header cap
is derived from viewport width, 32px scroll guards, body/header overscan and pinned
columns; fractional offsets can mount more headers than the older sampled paths.

Remote review of the preceding pinning/resize slice also led to stable gesture start
callbacks and moving grid-owned interaction/empty statuses outside the grid's row
ownership. Native status descendants within a header control remain valid. These
changes receive fresh local review with the reorder integration. Complete keyboard
and segmented reveal proof remains pending; this slice does not close #4.

## Keyboard projection (issue #5, in progress)

The native renderer now projects the retained logical navigation runtime onto
stable header/body IDs and `aria-activedescendant`, without a React subscription
at the grid root. One existing TanStack Hotkeys owner admits navigation, page
movement, header sorting, menu shortcuts, custom-control entry and Escape. Native
DropdownMenu receives controlled open requests through the retained private
workflow-action registry. It still owns menu focus and dismissal.

The exact `focus.ts` and `focus-ownership.ts` modules are activated with recorded
hashes. Pacer owns the temporary Shift+Tab handoff. Header controls remain outside
ordinary Tab order; custom-renderer descendants are normalized when mounted or
changed. A removed focused custom control falls back to its connected grid only
while its document still owns focus. Ordinary scroll never reveals the old cell;
its accessible descendant reconnects when that identity mounts again.

Public Browser coverage currently includes LTR/RTL header/body navigation,
minimum pinned-aware reveal, held logical moves, empty results, native custom
inputs, composition, descendant Escape ownership, nested grids, keyboard menu
opening and return, context-menu opening, SVG pointer targets, removed menu-trigger
fallback with external-focus ownership, live identity movement/deletion, suspended
pinning traversal in both directions, recycling, and header Enter/Space sorting.
The installed consumer runs the same suite. Submenu and filter transfers and the
complete Client/Server issue matrix remain pending; this is not issue #5 closure.

The held-navigation benchmark retains 5,000 × 150 data, 24 warmups, 200 measured
samples, one and two ArrowDown commands per frame, horizontal traversal, exact
final identities and the original work/cadence budgets. Its six scenarios are
required by the evidence validator in addition to the existing thirteen. The
current native renderer's established mounted-window envelope replaces source
DOM selectors. Root/surface and column-command isolation are measured; toolbar
and per-row/per-cell render counters from the original suite are not claimed
because those active boundaries have not yet been instrumented or migrated.

All production scenarios now charge asynchronous MutationObserver work separately
from the maximum of React and RAF work. The harness conservatively includes native
control and test observers created during each workload. Performance remains
working-tree evidence until a clean reviewed commit is measured and attested.

## Native text-filter controls (issues #5/#6, in progress)

The first working slice combines published TextInput, Selector, CheckboxInput and
usePopover with the existing filter runtime and versioned preferences. The native
Table filtering plugin was evaluated; its scalar PowerSearch conversion and
Apply/Reset editor do not replace the retained exact-expression contract. See
[the assessment](research/astryx-filter-controls.md).

Implemented locally: menu and Alt+Enter opening, eight scalar text operators,
case/accent sensitivity, 150 ms Pacer debounce, local IME drafts with session
invalidation, invalid/pending-draft cancellation, Clear/Restore commands and
Alt+Shift+Enter baseline toggling. F2 retains its existing body role. Native
Selector Escape dismisses only its own overlay first; native filter unmount
returns focus without revealing the old column. Committed preferences restore
through the unchanged codec format and separate Astryx namespace policy.

Compound expressions remain unchanged when opened; their full editor, `in` operand
lists, other scalar families, live facets, toolbar controls and the Server matrix
remain pending. Full regression, installed-package, performance and independent
review gates are still required; neither #5 nor #6 is closed by this slice.

Production diagnostics now add three scenarios to the existing nineteen: a
5,000 × 150 text-column scroll workload (work and presentation cadence) and
20 Hz live publication with a filter open. The latter checks that both the
filter editor and trigger retain their render counts through unrelated value
updates. Original budgets, sample counts and earlier scenarios remain unchanged.
This does not certify filter typing, compound editing, facets or deferred families.

### Text operand-list editor

The native text filter now includes `in` alongside the first eight scalar
operators. Its operand list is one atomic local draft: adding an unauthored value
or clearing a required value publishes nothing and preserves the committed
expression. Each value parses through the compiled Column Value Semantics;
text emptiness uses the same case/accent normalization as runtime admission.
Spaces are not silently trimmed into a different text value.

Native buttons add/remove values with focus recovery. The editor mounts at most
64 operand inputs and exposes previous/next controls for larger admitted lists.
The Add control respects the shared 16,384-operand admission allowance, including
other columns. Removing or adding operands and changing the operator invalidate
old composition sessions even when the draft cannot yet produce a runtime command.
Interrupting commands first restore the composing operand's pre-composition draft;
window movement does this locally without a query publication. Input events from
that invalidated session cannot overwrite a different operand.

Public Browser and installed-package regressions exercise restoration, invalid
whole drafts, add/remove focus, bounded mounting, composition invalidation and the
shared limit. A required 23rd production scenario keeps a 612-value list open
while preserving the original 20 Hz update accounting and editor/trigger render
isolation. Performance and review remain publication gates. Compound conditions,
other value families, facets and the Server matrix remain required for #6.

### Built-in boolean filter editor

Built-in `valueType: "boolean"` columns now expose the native filter trigger and
menu/header commands. Published Astryx Selector controls choose True or False and
one of Equals, Not equal, Blank or Not blank. An untouched value is unauthored,
while choosing False is a real exact boolean operand. Discrete choices commit
immediately through existing runtime admission and codecs; no text sensitivity
controls are exposed. Nested Escape and focus restoration remain upstream-owned.

The public Browser regression is also executed against the installed tarball.
A 24th required production scenario keeps this editor open during the retained
5,000 × 150, 20 Hz live-publication protocol and checks editor/trigger isolation.
Custom Boolean-family descriptors, numeric/Select/Set families, compound editing,
facets and the Server matrix remain pending. Numeric work is preserved separately
while two concrete dependency-patch approvals remain outstanding; see astryx-bugs.md.

### Configured Select filter editor

Columns with a compiled Select option domain now use the native Astryx Selector
for Equals, Not equal, Blank and Not blank. A choice identifies its configured
option directly; its label and private UI token never become the runtime operand.
Restoration uses the compiled exact-option index, without scanning rows or calling
custom equivalence during render. Zero and empty-string options remain authored
values. Empty labels display `Empty value` without changing their canonical value.

The published Selector renders its supplied options rather than virtualizing them.
The grid therefore retains the original 64-option window, plus at most one selected
option outside that window. Paging changes only local presentation. Native Selector
continues to own the listbox, focus, keyboard interaction and dismissal.

Public and installed-package tests cover exact numeric choices, JSON restoration,
empty options and off-window selection. A 25th required production scenario keeps
a 612-option domain's bounded native listbox open through 5,000 × 150, 20 Hz live
updates, retaining editor/trigger isolation and every previous scenario. Numeric
and Set workflows, compound editing, live facets and the Server matrix remain open.

### Live Client Set filters

The `client-facet.ts` engine is activated from the audited import, with its
store projection optimized after the first live performance failure. This is a
reviewed adaptation in `core-provenance.json`, not a mechanical-review exemption;
retained tests execute against the active module. It derives complete resident facets after other filters and Quick Filter,
excluding its own column expression. No viewport sampling or second filter engine
is introduced.

An open overlay alone owns the facet subscription. Astryx TextInput, CheckboxInput
and Button supply searchable value selection with counts, a 64-option window,
selected-value summaries and exact include/exclude intent. Clear All commits Match
None for current and future values; passive arrivals never rewrite intent. Explicit
missing values remain reversible zero-count options. Boolean and Select columns
use their existing default Set capability; other value families require opt-in.
The scalar editor remains available beneath the values and gives way to a committed
Set expression until the user chooses Use conditions.

The public tests also execute against the installed package. The added 26th
production scenario measures a live, open Set filter under the retained 5,000-row,
150-column, 20 Hz protocol, including narrow notification and mounted-option
bounds. Numeric condition controls, compound editing, global filter review and
Server facets remain separate pending work.

The first Set workload failed at p99 12.1 ms. Memoized native option boundaries
reduced redundant control rendering, but full resident facet recomputation still
cost too much. The open store now indexes exact value contributions by admitted
source position, updates only changed rows when their identity/shape is stable,
and reconstructs the index for query or structural changes. It preserves original
first-source-occurrence ordering, exact equivalence and zero-count intent.
The index is released with the overlay. Differential tests compare incremental
results with complete recomputation across Text, Number, BigInt and Boolean,
including signed zero, nulls, other filters, Match None and source reordering.

## Active-filter review slice — issue #6

`AstryxTableActiveFilters` composes through optional Client toolbar children and
uses the published Astryx Button/Popover. A stable private Client context serves
both controls and facets; it exposes no public table controller or TanStack state.
The closed trigger observes only the active count, while the mounted review uses
the runtime's narrow filter snapshot and compiled summaries. Neither subscribes to
row publications. Complete column expressions count once, including hidden columns.
Removal clears the complete expression; Clear all Grid Filters is one runtime
command. The review retains the source Quick Filter entry semantics for the later
Quick Filter control slice; that control is not exposed by this change.

A 64-entry window bounds mounted controls. Native dismissal returns trigger focus,
and removal focuses the next surviving entry, including at window boundaries.
Empty state uses the published disabled-with-tooltip Button behavior to preserve
return focus. No Astryx patch or copied generic control is introduced.

Public source and installed-tarball regressions cover count, complete-expression
removal, hidden preferences, atomic clearing, window/focus behavior and live labels.
The added production workload holds a 70-filter review open (64 mounted controls)
over 5,000 × 150 at 20 Hz, retains full frame accounting and the 8.33 ms p99 budget,
and asserts no review/trigger renders from row publications. All 26 preceding
scenarios remain mandatory. Full validation, independent review and clean-commit
attestation remain publication prerequisites; issue #6 is not closed.

## Quick Filter control slice — issue #6

`AstryxTableQuickFilter` is an optional Client toolbar child. It consumes published
TextInput with its native Clear button and focus restoration. Explicit configured
string fields define the OR search, independently of column visibility; Grid
Filters remain AND-combined. Raw query text is session-only and never enters
persisted preferences. Missing fields are a development configuration error.

Continuous input retains the 150 ms Pacer debounce. Native Clear is immediate and
cancels pending drafts. The control retains the complete IME invalidation protocol:
clear or external review removal invalidates the composing token, and every late
input from that session is ignored until compositionend consumes it. Removing the
control releases its subscriptions and cancels its pending debounce without
resetting the retained Table Instance's committed query.

Core 0.6.5 passes a null event from its native Clear callback despite the declared
non-null type. The independent published-control regression and nullable-event
integration are recorded as ASTRYX-006; no dependency patch is introduced.

Public and installed-package coverage exercises explicit hidden fields, conjunction
with Grid Filters, active review and clearing, no persistence, remount, native
focus, valid/cancelled composition and invalid configuration. The production gate
adds a mounted active Quick Filter during the original 5,000 × 150, 20 Hz protocol,
including stable render counts. All previous 27 scenarios and thresholds remain.
Numeric/compound editors, remaining preference controls and Server facets remain
pending, along with complete validation and review before publication of this slice.

## Compound filter editor slice — issue #6

The native filter editor now restores and edits one complete AND/OR/NOT expression
per column. Creating a compound adds an unauthored condition; until every operand
is valid, all changes remain local and the previous committed expression remains
active. Changing an operator, Boolean/Select choice or expression structure applies
a valid complete draft immediately; continuous text still uses Pacer's 150 ms delay.

Condition add/remove and expression mode changes cancel an active composition before
changing the tree. Late input from that session remains invalid until composition
ends. Closing the overlay cancels its pending publication. The editor observes its
own column's committed snapshot, version and command epoch, not row publications.

Each compound mounts at most 64 conditions and nested editors share a 256-node
render budget. Windows retain off-screen condition drafts and canonical values.
Budget-exhausted branches expose an Open conditions command with a bounded subtree
view and a Back to full expression control; every retained operand remains reachable.
Global node/operand and depth limits govern structural commands. Native controls
own selection and overlay behavior; structural removals/additions transfer focus
to surviving controls. A global draft status keeps errors discoverable even when
the invalid condition is outside the current window.

Aggregate admission failures, including the shared text budget, retain the complete
authored draft and subtree position with an accessible error. A changed column
version or command epoch restores the authoritative expression instead. The
runtime owns aggregate admission; the editor does not duplicate its accounting.

Immutable draft and candidate caches retain unchanged branches. Stable event
callbacks delegate only to the last committed React projection; memoized native
leaf boundaries avoid re-rendering unrelated operand controls. Accepted local
publications keep authored draft references; external column changes still restore
from the authoritative runtime snapshot. This is reviewed integration work, not a
mechanical import or an upstream Astryx workaround.

Public and installed-package regressions cover restored edits, persistence, atomic
invalid drafts, Boolean expression modes, IME cancellation, bounded windows,
structural focus, nested rendering and shared complexity/depth limits. The 29th
production scenario holds a 70-condition editor open during the unchanged 5,000 ×
150, 20 Hz workload, including full accounting and stable filter render counts.
The suite process watchdog is three minutes because the full 29-scenario run
exceeds two minutes; individual test timeouts and performance thresholds are unchanged.
All preceding scenarios and thresholds remain mandatory. Numeric editors,
remaining preference controls, Server facets and issue #6 publication remain open.

## Column preference controls — issue #6

Every Client has a 36px end-side management rail and a native Button/Popover
that mounts preference controls on demand. The optional page toolbar still renders
only when children are supplied, preserving the retained no-extra-height contract.
The rail contributes one tab stop before the existing single grid tab stop;
header/body navigation remains one coherent grid space. One searchable MultiSelector controls visibility and a
separate DropdownMenu dispatches Reset order, widths, visibility, pinning or the
complete layout. The controls use the retained runtime's commands, baselines and
versioned persistence; no public controller or duplicate preference store is added.
The sole visible column is disabled in the picker and remains guarded by admission.
Hidden sorted columns retain sorting, and Reset layout preserves filters and sorts.

Visibility subscribes only to the structural column source, which excludes hot row
publications and width-only commits. Reset has no grid-state subscription. Native
controls own search, keyboard interaction and focus. The one on-demand picker keeps
a stable anchor when a column header is hidden. Its native list is not virtualized;
the 150-column production workload measures this actual implementation rather than
claiming a bounded native list. See [the API investigation](research/astryx-column-preferences.md).

Labels come from the Table Instance's existing memoized compiled definitions through
a private prop. This keeps an open picker and its search current after label-only
replacement without changing the retained structural notification contract. Option
membership, order, visibility and commands remain owned by the runtime snapshot.

Public and installed tests cover persistence restoration, final-column protection,
individual idempotent resets, complete layout reset, virtualized-column search and
keyboard selection, and live replacement definitions while the picker remains open.
All existing production scenarios retain their budgets; the 30th holds the native
150-option picker open during 5,000 × 150, 20 Hz source publications and requires
stable visibility/reset render counts. Existing scenarios also assert
that visibility/reset controls are unmounted while the preference panel is closed.
Repeated successful resets publish fresh accessible status messages. Numeric editors, the full sort panel, grouped
eligibility, Server integration and publication remain separate pending work.

The native nested-selector regression also extends the existing ASTRYX-001 patch
to recognize focus fallback to a containing dialog. Intentional focus on a sibling
control remains preserved; this corrects our prior patch rather than claiming a
new defect in unpatched Core. Source and emitted-JS paths are covered.

## Native sort controls and stable live order (2026-10-04)

The side rail now includes a count-only Sort control. Its on-demand native Popover
composes List/ListItem, Button and one searchable Selector over the retained sorting
commands. Users add eligible hidden or visible columns, toggle direction, change
priority, remove all but the final sort and restore the original admitted baseline.
Active entries mount in windows of at most 64 with absolute priority labels; the
add picker retains every inactive option for native search. It is not virtualized.
The controls preserve focus through moves, removal and replacement definitions and
announce successful commands. No public controller or mandatory toolbar was added.

Current compiled definitions supply header labels and sorting eligibility through
private props, fixing stale open controls after definition-only changes. The retained
column-structure notification contract remains unchanged. The sort trigger observes
only the active-sort count; the open review observes sorting itself. Width commits
and source publications do not wake these controls.

The new 150-active-sort production scenario exposed full row-model reconstruction
when a secondary sort value changed without moving a row. A private proof now uses
the last committed TanStack order and next-publication neighbours to retain that
order only when all affected edges remain ordered. Filter membership, identities,
invalid operands and actual moves still trigger the complete projection. Every
changed included row is checked, including one returning to its original reference
after earlier retained publications. The proof resets with query generation and
commits only accepted row-model evidence. TanStack still owns construction/sorting.
This client-row-pipeline change is also outside the mechanical import exemption.

Public and installed tests cover controls, focus, restoration, live membership and
sort changes, simultaneous moves and accumulated changes. Differential Node cases
compare neighbour proofs with complete stable sorts. The unchanged production gate
now contains 32 scenarios, adding the open 150-sort review and 149-option picker.
Focused development measurement reduced review p99 from 12.6 ms to 4.9 ms; the picker
measured 4.4 ms. Full validation, independent review and clean-commit evidence remain
separate gates. Issue #6 remains partial: numeric editors, Server facets, remaining
status controls and publication are still pending. See
[the native API investigation](research/astryx-sort-controls.md).

The original retained pipeline suite runs unchanged, including its requirement for
zero structural notifications on a label-only replacement. Only the row-pipeline
optimization moves out of the mechanical provenance exemption; its source and target
hashes and independent-review requirement are recorded in core-provenance.json.

## Optional Client row-count controls

`AstryxTableResultRowCount` and `AstryxTableLoadedRowCount` compose through existing
optional toolbar children. Both retain typed numeric render callbacks and named
status output. Published Astryx Text supplies default typography. The existing
Client adapter and runtime own separate counts; no copied toolbar engine, extra
filtering authority or dependency patch is introduced. First Result projection
remains lazy and SSR-correct. See `research/astryx-row-count-controls.md`.

Public source/installed regressions cover live filtering, source lifecycle and
custom rendering; source diagnostics cover subscription isolation and cleanup.
A production scenario adds both counters to 5,000 × 150 cells at 20 Hz with no
count notifications for unchanged totals. All 33 production scenarios, the clean
review round and exact-commit evidence are required before publication. Active
filter/sort count-only controls, Server counts and full parity remain separate.

## Client command and toolbar composition

The optional toolbar now exposes `AstryxTableFilterControl` with typed Grid Filter
replace/clear/reset/clear-all commands and explicit external ownership. A stable
private command capability reads current column authority on invocation, avoiding
an extra schema cache or subscription. Removed/disabled columns and invalid or
over-budget replacements are rejected before dispatch. External children are
composition only; Server External Filters remain unimplemented.

`AstryxTableActiveFilterCount` and `AstryxTableActiveSortCount` complete the four
independent numeric projections. All support custom numeric children. Count-only
subscriptions remain isolated from value-only publications and same-cardinality
expression changes. Clear All does not clear session-only Quick Filter.

`AstryxTableToolbar` is transparent inside the Client's existing native Toolbar;
standalone usage creates one native Toolbar. The Client keeps its table-specific
accessible name, while standalone composition uses `Table controls`. Empty known
wrappers do not create a landmark. `AstryxTableToolbarSpacer` uses native StackItem
and retains the prior minimum spacing. Keyboard LTR/RTL and roving focus belong to
Astryx. See `research/astryx-toolbar-capabilities.md` for the source comparison.

Source/emitted type checks, public/installed Browser regressions and production
isolation of commands plus all four counters are required. All 34 performance
scenarios and clean exact-commit evidence must pass before publication. Numeric
editors, Server filtering and full parity remain pending.
