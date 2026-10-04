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
