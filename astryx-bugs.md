# Astryx bugs and local corrections

This is the running record requested by Bruno. Package under investigation: `@astryxdesign/core@0.6.5`. Corrections are version-pinned in [the Core patch](patches/@astryxdesign__core@0.6.5.patch). A local patch is not an upstream release and does not automatically reach consumers of a published AstryxTable package; issue #16 owns that release boundary.

The first three entries group the earlier corrections by user-visible problem. They cover six source modules, not three individual line changes. New findings get stable IDs. Keep reproduced defects, API gaps and unconfirmed observations distinct; mark a correction validated only after its regression tests pass.

| ID         | Area            | Problem                                                                              | Status                              |
| ---------- | --------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| ASTRYX-001 | Focus           | Modal focus containment and Selector focus restoration can choose the wrong target   | Corrected locally; merged in PR #17 |
| ASTRYX-002 | Toast           | Same-turn or queued dismissal can lose cancellation and lifecycle evidence           | Corrected locally; merged in PR #17 |
| ASTRYX-003 | TextInput types | Native search, input mode and maximum length are rejected by the public types        | Corrected locally; merged in PR #17 |
| ASTRYX-004 | Table pinning   | Pin changes leave memoized body cells sticky; Compiler can also retain stale headers | Corrected locally; merged in PR #19 |
| ASTRYX-005 | Table sorting   | Controlled sort changes leave the header/ARIA stale with React Compiler              | Corrected locally; merged in PR #19 |

## Patch size

Measured with `git apply --numstat patches/@astryxdesign__core@0.6.5.patch`, counting only `src/` modules so the shipped JS/declarations do not double-count the same correction:

- Earlier corrections: 6 source modules, **81 added / 29 removed lines**.
- Pinning and sorting corrections: 2 source modules, **11 added / 10 removed lines**, including comments and whitespace.
- Deferred menu mounting and guarded opening: 2 source modules, **17 added / 15 removed lines**. This is the optimization described below, not an additional confirmed original runtime bug.
- Total Core source patch: **10 modules, 109 added / 54 removed lines**.

Tests, documentation, lockfile changes and the mirrored emitted files are additional. These numbers describe the upstream patch, not the work required to deliver full grid parity.

## ASTRYX-001 — Focus containment and restoration

**Symptoms:** Dialog and nested overlay keyboard focus need coherent containment; closed dialogs must not contribute focus targets. Selector closing must not steal focus that the consumer deliberately moved, including synchronous opening of a Dialog.

**Correction:** Dialog uses the existing focus-trap hook. The hook uses the element's owner document, ignores closed dialogs, respects an inner open overlay and already-handled keyboard events, and restores focus only when appropriate. Selector checks where focus currently belongs before returning it to the trigger.

**Source modules:** `Dialog/Dialog.tsx`, `hooks/useFocusTrap.ts`, `Selector/useSelectorPresentation.ts`, plus shipped JS.

**Evidence:** [focus regressions](src/controls/astryx-focus.browser.test.tsx), [Dialog regressions](src/controls/astryx-dialog.browser.test.tsx), [Selector/menu focus](src/controls/astryx-menu-focus.browser.test.tsx), and nested Dialog/Popover cases in [additional regressions](src/controls/fix-regressions.browser.test.tsx). These were validated before [PR #17](https://github.com/bmvantunes/astryx-table/pull/17) merged; they remain in the Browser suite.

## ASTRYX-002 — Toast cancellation and lifecycle

**Reproduction:** Create and immediately dismiss a toast before its first React render; cancel one queued behind `maxVisible`; cancel a startup fallback toast; publish colliding unique IDs or a replacement from `onHide` in the same turn.

**Cause:** Imperative commands could observe an older React-rendered list or leave a cancelled toast in the pending queue.

**Correction:** Publish the imperative list synchronously and render immutable snapshots. Remove not-yet-mounted cancelled entries immediately, remove fallback pending entries, preserve replacement identity and invoke dismissal callbacks once.

**Source modules:** `Toast/ToastViewport.tsx`, `Toast/useToast.tsx`, plus shipped JS.

**Evidence:** [Toast regressions](src/controls/astryx-toast.browser.test.tsx) and [same-turn, queued, startup and StrictMode regressions](src/controls/fix-regressions.browser.test.tsx); merged in [PR #17](https://github.com/bmvantunes/astryx-table/pull/17).

## ASTRYX-003 — TextInput native property types

**Classification:** Public type/API gap, distinct from a runtime state bug.

**Reproduction:** Pass `type="search"`, `inputMode="decimal"` and `maxLength` to the published TextInput. The original declarations reject these supported native input properties.

**Correction:** Extend `TextInputType` and its props in source and emitted declarations. The runtime already forwards the native properties; no replacement input or numeric coercion was introduced.

**Source module:** `TextInput/TextInput.tsx` and `dist/TextInput/TextInput.d.ts`.

**Evidence:** [type contract](src/controls/input-contract.tsx) and the native search/length/exact-string case in [Browser regressions](src/controls/fix-regressions.browser.test.tsx); merged in [PR #17](https://github.com/bmvantunes/astryx-table/pull/17).

## ASTRYX-004 — Dynamic Table pinning

**Reproduction:** Render the public Table with stable data/columns and `useTableStickyColumns`. Change `startKeys`/`endKeys` to empty arrays. LTR and RTL fail with both a memoized plugin record and an inline `plugins={{ sticky }}` record. Without React Compiler, headers unpin but body cells remain sticky. With Compiler, both stay stale in the reproduction.

**Cause:** The hook mutates its configuration ref but keeps one plugin identity forever. Table stabilizes plugin arrays by identity and memoizes rows; React Compiler may also reuse Table JSX whose inputs appear unchanged.

**Correction:** Include serialized key contents in the plugin memo dependencies. A changed pin configuration now reaches native Table rendering; equivalent fresh arrays keep the same plugin identity. The existing upstream offset calculation, scroll listener and sticky styling remain in use.

**Evidence:** [public Table pinning regressions](src/controls/astryx-table-pinning.browser.test.tsx). The four initial dynamic cases failed before the patch. The [reuse investigation](docs/research/astryx-table-reuse.md) records the separate static geometry experiment and Compiler comparison.

## ASTRYX-005 — Controlled sorting with React Compiler

**Reproduction:** Use stable rows/columns and controlled `useTableSortable`, initially ascending. Click the header. The consumer receives descending state while `aria-sort` remains ascending. The same experiment passes without React Compiler.

**Cause:** Sorting state is hidden behind a ref while plugin identity stays unchanged, so the Compiler can retain the Table subtree.

**Correction:** Include serialized sorting and rendering-relevant multi-sort/cycle options in plugin memo dependencies. Keep callbacks current through the existing ref and preserve exact cell values.

**Evidence:** [controlled sorting regression](src/controls/astryx-table-controls.browser.test.tsx). The header-update assertion failed before the patch while the consumer-state assertion passed.

## Observations not counted as corrected bugs

- The inspected native Table does not calculate row/column virtual windows; supplying externally windowed rows is a supported integration approach, not an upstream defect.
- Native filter state cannot represent all our exact numeric operands. This is a capability mismatch, not evidence that ordinary numeric filtering is broken.
- Sorting's context Clear action and multi-sort ARIA need further investigation against our contract; do not mark them fixed based on a source read.
- The separate `@stylexjs/unplugin` patch is tooling work, not an Astryx Core bug.

For every future entry, record the pinned version, smallest reproduction, cause, correction, regression evidence and delivery status. Remove a local patch only after the same regression passes against an unpatched upstream version.

## Integration optimizations (not counted as upstream bugs)

The virtual native-cell Adapter uses `maxWidth: none` because native Table cells default to a zero maximum width for ordinary table layout; our flex rows own explicit widths. It uses `overflow: clip` for body content. Native pinned-cell shadows retain visible overflow, with a separate clipped content box.

The first full native-cell production run exceeded our scroll p99 budget (9.3 ms). A temporary plain `td` without presentation passed at 2.7 ms, but applying the native classes to that same `td` still failed at 9.7 ms; replacing the component alone was not a solution. Removing only `overflow: hidden` from the comparison isolated the CSS trigger. Keeping native `TableCell` with `overflow: clip` passed the existing raw workload at 3.3 ms and live 20 Hz publication at 0.8 ms. These are development measurements, not clean-commit publication evidence. The exact browser cost mechanism has not been traced; `hidden` creates scroll containers while `clip` does not. See [CSS Overflow](https://www.w3.org/TR/css-overflow-3/#valdef-overflow-hidden).

This uses supported presentation overrides, adds no Core patch, and does not assert that native Table is generally defective. [Public integration tests](src/client-column-layout.browser.test.tsx) cover fixed dimensions, long custom content and clipping in LTR/RTL; production gates also cover native pinned regions before publication.

The installed-tarball check also caught CSS-order dependence when the generic clip override and native pinned overflow were applied together. The Adapter now applies that override only to centre cells, leaving pinned cells' native shadow overflow intact and clipping their inner content box. The same long-content regression passes in source and installed-consumer builds. This is an integration correction, not another upstream patch.

Independent review found that the inner pinned content box also needed a maximum block size: a 100px custom renderer could extend beyond the fixed 36px row. The LTR/RTL regression failed before adding `maxBlockSize: 100%`; it now checks both horizontal and vertical clipping through source and installed-package seams. Native shadow overflow remains on the outer cell.

GitHub review of PR #20 found two further integration defects. End-pinned headers and cells stopped at the sum of column widths when the viewport was wider. The renderer now includes the retained viewport-fill space in its header, body and sticky surfaces, including after viewport resizing. Four public LTR/RTL cases (one end-pinned column and a three-region layout) failed before the correction.

Pin/unpin commands also lacked an accessible completion announcement. A polite status region now announces the accepted logical start/end or unpinned state. The public command regression failed before the correction and covers all three outcomes. Both corrections belong to the Adapter, add no Core patch, and run through source and installed-package validation.

The repeated-message regression also exposed that two distinct columns may share a header label: consecutive same-side pin commands then produce the same text. Announcements now carry a sequence so each accepted command updates the live region even when its wording repeats.

Adding the status-region styles exposed another emitted-package cascade conflict: centre cells retained both native `overflow: hidden` and Adapter `overflow: clip` classes because their cross-package StyleX property keys differed. The installed LTR/RTL tests failed while source tests passed. Centre clipping now uses the public inline style override, which has deterministic precedence over both package stylesheets. Pinned content still uses its separate StyleX clipping box; no native shadows are removed and no Core patch is added.

A later remote review questioned whether native sticky transforms receive contiguous pinned partitions. The reported dynamic pin-to-end case passed a stronger exact-offset reproduction on the reviewed commit; the raw Client already supplies its logical projection. The native presentation boundary now nevertheless assembles an explicit start → centre → end metadata order, so it no longer depends on that caller ordering. This is defensive integration hardening, not a reproduced upstream defect.

The resize slice uses the public `Divider` as presentation rather than installing a second geometry/keyboard engine. Its native Table resize engine lacks a delegation seam for our virtual column window; this is an API mismatch, not a confirmed bug. See the [reuse assessment](docs/research/astryx-column-gestures.md). The new subpath is explicitly prebundled with the existing Astryx imports so development and Browser tests share one React instance.

Local review of the resize Adapter found two retained-behavior regressions: Alt+Arrow could resize a stale active header while a custom input/contenteditable owned focus, and ready source row-count/query-generation changes did not cancel a gesture. Four public cases failed before correction. Active-header shortcuts now require the grid surface itself, and the private controller cancels on generation/count changes while preserving value-only publications. These are integration fixes, not additional Astryx Core patches.

## Native menu mounting optimization

**Classification:** Performance/API integration improvement; separate from the five reproduced upstream defect/gap groups above. Local implementation and regression checks are complete; full production and publication gates remain required.

Closed DropdownMenus eagerly mounted their Popover layers. A CPU sample profile found `readPortalWritingContext` among the largest named costs while virtual headers entered the window. A controlled production comparison rebuilt dependencies in both variants: eager mounting failed raw/pinned scroll p99 at 9.7/11.8 ms; using Layer's existing `lazyMount` passed all five workload tests. CSS containment did not solve pinned scroll and was removed. Profiling itself changed timings, so the diagnostic run is not publication evidence.

The patch forwards an optional `lazyMount` through `usePopover`, defaulting to the existing eager behavior, and enables it for DropdownMenu only. Layer still owns portal selection, mounting, dismissal and focus infrastructure. No replacement menu or portal engine was added.

The first integration failed keyboard focus: DropdownMenu treated an opening as rejected until `onShow` fired synchronously, while lazy mounting intentionally defers that callback. DropdownMenu now checks the existing Layer dismissal guard through a private Popover hook before requesting an opening, preserving its pending focus/callback intent during deferred mounting. The public `Layer.show` and `Popover.show` retain their `void` return contracts. An initial boolean-return implementation was rejected in local review because it broke valid React effect callbacks; a failing type regression preceded this correction. A controlled close also avoids echoing a false state already supplied by the controller.

[Public regressions](src/controls/astryx-menu-mount.browser.test.tsx) cover absent closed layers, repeated keyboard open/Escape focus, initial controlled opening, a rejected controlled request, repeated trigger dismissal without reopening or duplicate notifications, and the original public React effect callback contract. Existing menu-to-Dialog/Popover transfers, Tab, removed actions and outside-click focus remain in the focused suite. The patch affects source, distributed JS and declarations; #16 still owns distribution to published grid consumers.

Remote review also identified repeated linear index searches in native pinned presentation. The Adapter now compiles one Column Identity → native index map per presentation update. This is an integration optimization with no extra Core patch.

## Reorder integration corrections

The new public LTR/RTL drag regression reproduced an error in the retained target-pin heuristic: dropping in the trailing half of the last centre column selected the next pinned column's region, even though the pointer remained inside the centre. The Adapter now uses the physical sticky-region boundaries. The centre, including its viewport-fill gap, is an unpinned drop zone. Suspended centreless layouts preserve the source pinning intent. This is a correction to our integration logic, not an Astryx Core defect or patch.

Reorder uses the published native Button, the same private gesture lifecycle as resize, and the retained logical geometry helpers. Edge autoscroll waits for the viewport publication and mounted header window before measuring again. Preview transforms affect both headers and cells; only the final accepted command persists order and pinning together. Focus restoration is bounded and yields to another focused control or a window that loses focus. These features still require the complete production, package and review gates before publication.

CodeRabbit's full review of the preceding pinning/resize commit found grid-owned status announcements directly inside `role="grid"`. Public empty/non-empty regressions failed before moving interaction and empty-state statuses beside the grid. The table wrapper supplies their positioning context. Native control announcements inside header cells remain supported. Gesture start callbacks are now explicitly stable so status updates do not invalidate memoized headers solely through new callback identities. Both are integration corrections, with no additional Astryx Core patch.

The first per-frame production autoscroll run exceeded the unchanged 8.33ms budget at 22.2ms p99. Reusing stable measured anchors and committed widths instead of clearing transforms and rereading every rectangle reduced it to 10.2ms. Moving the native scroll write ahead of preview CSS writes removed another forced-layout boundary; the next complete development run passed at 4.3ms p99. Its single over-16.66ms sample remains within the existing maximum of two and includes the final commit/cleanup accounting. These are dirty-development diagnostics, not clean-commit publication evidence. The original raw/pinned/resize scenarios also passed unchanged. This is local interaction optimization, not a new upstream bug.

Local specification and verification reviews independently found that releasing at the initial screen X after autoscroll skipped a valid logical reorder. Both LTR/RTL public regressions failed before the correction. Final release resolves the current logical destination whenever the pointer or native scroll position changed; unchanged index and pinning still produce no durable command. A second review reproduced stationary clicks incorrectly unpinning a column while pinning was suspended in a narrow mixed layout. The LTR/RTL regression failed before preserving clicks with unchanged pointer and scroll positions. This is an Adapter correction, not an upstream patch.

The same suspended-layout reproduction also failed with a two-pixel release movement inside the source column. Hit-testing now preserves its pin intent inside its own untransformed logical rectangle, while a real crossing still selects the destination region. Both directions are covered through the public Client; the same-screen-X autoscroll cases remain covered separately.

A further public LTR/RTL regression reproduced a virtual-window dependency in that exception: after autoscrolling both centre columns out of a suspended mixed layout, a centre-to-end drop incorrectly retained the unpinned source state. The existence of remaining centre columns is now compiled once from the complete logical projection; mounted geometry only selects the physical destination. This local integration correction adds no Astryx Core patch.

Remote review reproduced source-preview drift during reorder autoscroll: the
logical destination was correct, but an unpinned source header and its body cells
moved away from the pointer by the accumulated native scroll delta. Public LTR/RTL
regressions failed with a 320px drift before correction. The source transform now
compensates native scrolling only when the source participates in scrolling
(unpinned or suspended); active sticky sources keep their original pointer-only
transform. The same tests protect both source kinds and body/header alignment.
Pin announcements now also require the runtime to accept the command before
checking its resulting state. Both are local integration corrections, with no
additional Astryx Core patch.

## Keyboard integration work (not an upstream defect)

The new navigation boundary reuses the retained logical runtime, TanStack Hotkeys,
Pacer handoff and native controlled menus. Loading Pacer lazily in the production
profiling harness caused dependency re-optimization and an invalid React instance;
explicit prebundling fixes the harness configuration. That failed run is not
performance evidence and adds no Astryx Core patch.

Complete accounting exposed 9.4ms p99 reorder autoscroll after adding asynchronous
focus observers. The boundary now suppresses tab stops only inside custom cell
renderers (native header controls declare their own `tabIndex=-1`) and avoids
rewriting an unchanged active-descendant attribute. The unchanged workload then
passed with observer work still included. This is a local integration optimization;
clean-commit publication and independent review are still pending.

Public navigation tests also reproduced two missing Adapter behaviors: a header
context-menu gesture did not open its native menu, and SVG pointer targets did not
activate their containing cell. The header now opens the controlled native menu
and the pointer boundary admits DOM Elements, including SVG. No Core patch is
needed. Separate tests confirm that native menu-trigger recycling already returns
focus to the grid while yielding to an external control; that behavior is reused.

Independent local review found retained custom-control contracts missing from the
new Adapter: focusable SVG descendants, live changes to focusability/usability,
and restoring the author's latest `tabindex` when a control leaves management.
The SVG regression failed before correction; the expanded public suite now covers
SVG entry/Escape/recycling, disabled/hidden/inert controls, newly focusable links
and contenteditable nodes, and detached-control restoration. These are integration
corrections, not additional upstream defects.

The same review found gaps between held-navigation performance samples and during
final key-release cleanup. Samples now retain ownership until the next admission,
with final keyup and deferred work charged to the last sample. The harness tracks
scheduled, executed and cancelled frames, waits for quiescence, and rejects unowned
RAF, React or observer work. Original sample counts and budgets remain unchanged.

The expanded focus observer initially made resize/reorder exceed the original
production budget. Attribute observation now targets only custom-content roots;
ordinary grid geometry writes do not wake it, and usability reads occur only for
relevant focused-control changes outside an active gesture. No accessibility
cases or performance budgets were removed.

A frame-cost diagnostic then isolated an additional retained integration cost:
reorder preview variables written to the scroll owner's inline style woke its
LTR/RTL environment observer, forcing native-scroll reads during DOM updates.
Temporary preview variables now live in one grid-scoped CSSOM rule, released on
finish/cancel/unmount, including exceptional command completion. Direction and
stylesheet observation remain intact. Public reorder regressions pass; the first
focused production comparison reduced autoscroll p99 from 9.1ms to 4.2ms. These
are development measurements; the complete clean-commit gate is still required.

A subsequent public regression reproduced lost focus recovery when a live
`cellClassName` change hid the owning cell while its custom button stayed mounted.
The bounded observer now includes the owning cell's visibility-related attributes,
while still excluding its hot geometry style writes. This is an Adapter correction.

## Filter integration work (not an upstream defect)

The first menu-to-filter slice consumes published TextInput, Selector,
CheckboxInput and usePopover controls while retaining grid-owned query, exact
value and preference semantics. Native nested Escape and recycled-header focus
recovery pass the public Client regressions without another Core patch.

React Compiler initially classified the complete usePopover result as a ref-like
object when its members were read during render. Destructuring the public return
fields directly removes that compiler diagnostic; no compiler opt-out or upstream
patch is needed. This is an integration correction, not a reproduced Core bug.

A public IME regression reproduced our initial editor publishing intermediate
composition text after the debounce. Composition drafts now stay local until
compositionend, and a replaced column invalidates the entire old session. The
regressions also protect deferred-draft cancellation, committed-only persistence,
restoration and nested overlay ownership. The filter work remains in progress;
these focused tests do not establish full filtering parity or publication readiness.

Further public regressions caught two missing retained header behaviors: Enter
on an unsortable text column did not open its filter, and active filters lacked
a visible/accessible trigger indication. Both are corrected locally; F2 remains
a body-cell action, while Alt+Enter opens a header filter and Alt+Shift+Enter
clears/restores the initial expression. No additional Core patch is involved.

CI exposed a timing assumption in the inherited keyboard-pinning regression: it
sent navigation keys before the native menu's animation-frame focus transfer.
The test now observes focus on the first action and then on Pin to end before
activation. It still verifies the same trigger identity, returned focus and
logical column index. This is test synchronization, not a reproduced Core defect.

A separate CI run exposed a test racing its own 150 ms debounce: the awaited
Browser fill and outside-click commands could take longer than that interval.
The dismissal and header-recycling cancellation tests now freeze only timeout
scheduling while admitting the draft and closing/recycling its owner, then advance
past the unchanged debounce. Native focus, animation frames, real controls and
query/persistence assertions remain active. This corrects the test clock boundary;
it does not lengthen production debounce or retry a failed assertion.
