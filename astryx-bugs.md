# Astryx bugs and local corrections

This is the running record requested by Bruno. Package under investigation: `@astryxdesign/core@0.6.5`. Corrections are version-pinned in [the Core patch](patches/@astryxdesign__core@0.6.5.patch). A local patch is not an upstream release and does not automatically reach consumers of a published AstryxTable package; issue #16 owns that release boundary.

The first three entries group the earlier corrections by user-visible problem. They cover six source modules, not three individual line changes. New findings get stable IDs. Keep reproduced defects, API gaps and unconfirmed observations distinct; mark a correction validated only after its regression tests pass.

| ID         | Area            | Problem                                                                              | Status                                                         |
| ---------- | --------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| ASTRYX-001 | Focus           | Modal focus containment and Selector focus restoration can choose the wrong target   | Corrected locally; merged in PR #17                            |
| ASTRYX-002 | Toast           | Same-turn or queued dismissal can lose cancellation and lifecycle evidence           | Corrected locally; merged in PR #17                            |
| ASTRYX-003 | TextInput types | Native search, input mode and maximum length are rejected by the public types        | Corrected locally; merged in PR #17                            |
| ASTRYX-004 | Table pinning   | Pin changes leave memoized body cells sticky; Compiler can also retain stale headers | Corrected locally; merged in PR #19                            |
| ASTRYX-005 | Table sorting   | Controlled sort changes leave the header/ARIA stale with React Compiler              | Corrected locally; merged in PR #19                            |
| ASTRYX-006 | TextInput Clear | Native Clear passes a null event despite the non-null ChangeEvent callback type      | Reproduced; nullable event handled by Quick Filter integration |

## Patch size

Measured with `git apply --numstat patches/@astryxdesign__core@0.6.5.patch`, counting only `src/` modules so the shipped JS/declarations do not double-count the same correction:

- Earlier corrections: 6 source modules, **81 added / 29 removed lines**.
- Pinning and sorting corrections: 2 source modules, **11 added / 10 removed lines**, including comments and whitespace.
- Deferred menu mounting and guarded opening: 2 source modules, **17 added / 15 removed lines**. This is the optimization described below, not an additional confirmed original runtime bug.
- Total Core source patch: **10 modules, 112 added / 54 removed lines**.

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

## Text operand-list integration (not an upstream defect)

The native filter editor now represents `in` operands as separate exact text
values. It validates the complete list before publication, keeps unfinished or
normalized-empty operands local, and preserves the committed expression on close.
Add/remove controls restore focus to the appropriate operand. A 64-control window
bounds mounting, while the existing collection-wide operand budget limits growth.

A public regression reproduced an integration error when removing an operand
while an IME session and an invalid draft were active. No filter version changed,
so the old composition events could overwrite the value that moved into that
position. Local list/operator shape changes now invalidate the composition token
independently of runtime command/version changes. This adds no Astryx Core patch.

The public source and installed-package suites cover these contracts. The new
production workload keeps a 612-value list open (64 mounted inputs) during the
original 5,000 × 150, 20 Hz publication protocol. Its performance gate and review
must pass before publication; this does not certify typing a maximum-size list,
compound editing, other filter families or live facets.

Independent review found a second IME path: removing a different operand could
publish the composing value even after invalidating its token. Discrete commands
now restore that operand's pre-composition draft before applying their change.
Window movement cancels and restores composition locally; subsequent input in a
different operand remains usable. Public regressions reproduced both failures
before correction. The production probe also caught list navigation preceding
the first operand in native autofocus order; navigation now follows the inputs.
These remain integration corrections with no additional Core patch.

The window regression also covers returning to an earlier operand after its input
was unmounted. The composition token is tied to its actual input element, so a
newly mounted input at the same ordinal is usable while late events from the old
input remain invalid. This prevents an invalidated session from locking new input.

Two further public regressions reproduce adjacent composition lifetime errors.
A cancelled token could cancel a later valid operand's pending publication when
paging again before 150 ms; paging now cancels only a current composition session.
Conversely, editing another visible input during a still-active composition could
publish the unfinished composing value. Whole-expression updates now remain local
until that active session completes or a discrete command restores and cancels it.
The tests control only timeout scheduling and verify query and persistence effects.
These are integration fixes, not defects attributed to Astryx Core.

## Numeric-filter investigation — pending dependency changes

The next filter slice reproduced a declaration gap: native `type="number"` is
rejected by TextInput's public type union, and `step` is not declared. NumberInput
is not equivalent: its published implementation commits validated numbers on blur
or Enter, rather than exposing the retained continuously validated native draft.
The proposed compatibility extension adds `number` and `step` only to TextInput's
source and emitted types. Automatic approval review rejected that concrete patch
and requires another explicit confirmation; it has **not** been applied. This is
an API compatibility extension, not evidence that NumberInput violates its own API.

A separate public Client test reproduced a React DOM 19.2.8 development-profiler
failure on bigint arrays: `addValueToProperties` classifies the array as primitive
and calls `JSON.stringify`, which throws for bigint. A minimal React-only Browser
reproduction confirms the same unhandled error when an array prop is introduced.
This is a React diagnostic bug, **not an Astryx defect**. A narrowly scoped proposed
patch would stringify bigint only in the diagnostic description in the two React
DOM development builds. It is awaiting user confirmation; no React patch is applied
and numeric filtering is not yet validated or shipped.

## Configured Select integration (no additional upstream patch)

Select filters now reuse published Selector with exact configured option values.
Its current implementation renders every supplied option, so the retained grid
window bounds the supplied set to 64 plus an off-window selected option. This is
an integration requirement, not a claim that Selector's documented API is broken.
Zero and empty-string choices retain their exact codecs; an empty display label
receives a visible `Empty value` label without changing the operand.

## Separate compiler observation — not an Astryx defect

While isolating the React bigint diagnostic error, a minimal component also exposed
Oxc React Compiler 0.145.0 replacing bigint literals inside an inferred component
with `undefined`. A direct `transformSync` of `useState([90071992547409931234567890n])`
and a state-setting click callback confirmed the emitted substitutions. The final
React diagnostic reproduction supplies its bigint data from the test body to
isolate that separate error. No application workaround, compiler opt-out or compiler
patch has been applied; this observation needs its own toolchain investigation.

### Select restoration verification follow-up

CodeRabbit PR #25 identified that the empty-string Select test only reopened the
same table instance. It now round-trips the saved preferences through JSON,
unmounts the table and restores a fresh instance. The test verifies the native
Empty value label, the exact filtered row set and no extra persistence callback.
The same fixture runs against the installed package. This strengthens evidence;
it does not add an Astryx defect or change the dependency patch.

### Live Set filter integration

The Client Set filter uses native Astryx inputs/buttons over the retained facet
engine. No additional Astryx defect or Core patch was needed. The search field is
the first focusable control, allowing the native Popover to own opening focus.
The grid supplies bounded option windows and exact value intent; those are retained
grid requirements rather than replacements for generic Astryx control behavior.

The initial open-Set production workload measured p99 12.1 ms against the unchanged
8.33 ms limit. Stable per-option boundaries plus incremental resident facet counts
replace redundant native-control renders and full scans after each single-row
publication. This is a grid integration/performance improvement, not an Astryx
bug or new dependency patch. The source engine adaptation has independent review
and differential regression requirements; clean-commit evidence remains required.

### Active-filter review integration

The Client review panel consumes the runtime's already compiled, bounded labels
and whole-column filter commands. It includes hidden columns, counts one entry per
column expression, and mounts at most 64 entries. Only its open review subscribes
to filter details; the closed trigger observes the count. Live row publications do
not notify either projection. Native Popover owns dismissal and return focus;
removal transfers focus to the next surviving entry.

The empty trigger uses Button's documented disabled-with-tooltip behavior, which
keeps it programmatically focusable for return focus. Passing `aria-disabled`
directly does not override Button's own disabled policy. This is normal native
composition, not a reproduced Astryx bug or additional dependency patch.

A CodeRabbit concern about a pending text filter using uncommitted replacement
column semantics was investigated at PR #22 head `2168c27`. Two public suspended
replacement probes passed; the editor receives only installed runtime columns.
CodeRabbit verified that ownership boundary and withdrew the finding in
[the review thread](https://github.com/bmvantunes/astryx-table/pull/22#discussion_r4176156067).
No speculative fix or upstream bug is claimed for that report.

Local review caught an avoidable subscription in this new integration: deriving a
count from the general filter snapshot avoided React renders but still received
same-count operand notifications. The trigger now uses the retained runtime's
dedicated active-count subscription directly. A Browser regression first failed
on the broader subscription, then verifies zero same-count notifications, detail
subscription only while open, and cleanup on close/unmount. This is a grid
integration correction, not an Astryx defect.

## ASTRYX-006 — Native Clear callback event differs from its type

**Version:** Core 0.6.5. `TextInputProps.onChange` declares a non-null
`ChangeEvent<HTMLInputElement>`, but `handleClear` invokes it with `null` using a
cast. Ordinary input changes still provide the event. A consumer that trusts the
declaration and reads `event.currentTarget` therefore fails on native Clear.

**Reproduction:** `src/controls/astryx-clear-event.browser.test.tsx` renders the
published TextInput with `hasClear`, clicks its native clear button and observes
`["", null]`. No grid or package patch is involved in that reproduction.

**Integration:** Quick Filter accepts a nullable event and treats native Clear as
an immediate command, cancelling its pending debounce and composition session.
Ordinary edits retain the 150 ms debounce. Native Clear still owns its button and
focus restoration. This is defensive integration for the reproduced callback
contract; no dependency patch or upstream correction is claimed. The Core patch
size above is unchanged. Full integration validation/review remain required.

### Operand-list test synchronization follow-up

CodeRabbit PR #23 identified possible races in immediate locator counts. Most
cited assertions already follow a DOM-specific awaited value/focus check; those
remain unchanged. Three counts that follow an action or timer/persistence boundary
now wait for their exact DOM count. This preserves the same expected states and
budgets; it is test synchronization, not an additional Astryx defect. The changes
were validated and merged in PR #23; this integration preserves them.

### Quick Filter performance investigation

The initial production Quick Filter scenario detected one React commit outside
its source-publication samples. Temporary subtree profiling excluded the Quick
Filter and active-filter controls. Core's Toolbar `useKeyboardHint` owns a
three-second dismissal after the search field receives focus; that delayed
interaction overlapped steady-state publication measurement. Completing its
native arrow-key dismissal before recording removes the unrelated interaction.
The focused production scenario then passes with the original zero-unowned-commit
assertion and 8.33 ms budget. No dependency patch, disabled hint, arbitrary sleep
or relaxed accounting was introduced. This is benchmark setup, not an Astryx bug.

### Compound filter integration

AND/OR/NOT authoring uses native Selector, TextInput, CheckboxInput and Button
controls over one atomic column draft. No new Astryx defect or Core patch was
required. The integration preserves unchanged leaf references and stable event
callbacks to avoid redundant native-control renders. Temporary Browser tracing
also identified expensive repeated accessible-name enumeration in mounted-input
count assertions; those bounds now measure native inputs within the role-located
dialog, while user interactions retain role-based locators. The original limits,
assertions and test timeouts remain unchanged.

Local review found that the initial shared render budget hid deep descendants
without a way to edit them. A public regression now reaches the hidden operand
through a bounded subtree view, edits it atomically and returns to the full tree
without changing sibling expressions. This was an integration defect, not an
additional Astryx Core defect.

Fresh integration review also found that aggregate filter admission rejection
discarded an authored compound draft. A public regression crosses the runtime's
shared text budget while keeping each operand valid. The editor now retains the
complete draft and subtree position with an accessible error when its column
version and command epoch are unchanged; changed authority restores the current
snapshot. Runtime admission remains the sole authority for aggregate budgets.

### Column preference control integration

The published MultiSelector supplies search, selection, disabled options and
keyboard behavior for one table-level visibility picker. Its complete option list
is not virtualized and its layer is not lazy by default; this is a documented
capability/cost, not a confirmed upstream defect. The integration avoids one picker
per header and measures the actual 150-column list in the production gate. Native
DropdownMenu owns Reset presentation; command-only Reset has no grid-state
subscriptions. Adding the new subpath to Vite's
existing dependency pre-optimization list avoids a mid-test dependency reload.

Local review caught an integration regression that placed these controls in a
mandatory top toolbar. They now open from a 36px side rail: absent page children
still mean no top toolbar or extra vertical space. The outer native popover lazily
mounts the preference controls. Reset announcements use a sequence so repeating
the same successful action produces a fresh live-region update. These are local
integration corrections, not additional Astryx Core bugs.

Fresh review found that replacing only a column's header label left the native
visibility picker and its search stale. Structural snapshots intentionally ignore
label-only changes. The picker now receives labels from the Table Instance's existing
memoized compiled definitions through a private prop, while runtime snapshots retain
ownership of option membership, order and visibility. Public tests cover the open
picker, search and reopening. Core notification contracts stay unchanged; this was
an integration defect, not an Astryx Core defect.

### ASTRYX-001 follow-up — nested selector focus fallback

**Reproduction:** Open a native Popover containing a searchable MultiSelector,
click the same option twice, then press Escape. Our existing patched version left
focus on the parent dialog instead of the selector trigger. The minimal probe uses
only published components; the column preference Browser test also reproduced it.

**Cause:** Clicking a non-focusable option can put DOM focus on its containing
dialog. The ASTRYX-001 focus-return guard treated this ancestor fallback as an
intentional outside target and declined restoration. This is a correction to our
previous patch, not a newly discovered unpatched upstream defect.

**Correction:** Permit restoration when the current active element contains the
selector trigger. Sibling controls remain outside that condition, preserving an
intentional click's focus. Three source lines (including two explanatory comments)
and their emitted-JS counterpart extend the existing Selector presentation patch.

**Evidence:** The native nested-selector regression failed before this change;
[native focus regressions](src/controls/astryx-menu-focus.browser.test.tsx) cover
Escape after repeated toggles and focus retained on a clicked sibling button.
The table-level case remains in
[column preferences](src/column-preferences.browser.test.tsx). Delivery is local
pending complete validation and review of this slice.

### Sort control integration and live-update optimization

The native List/ListItem, Selector, Button and existing lazy Popover support the
sort panel without another Core patch. Active entries are bounded to 64 per review
window; native add search receives the complete eligible option list. This slice
does not change the upstream patch totals above.

Two integration defects were reproduced and corrected: open controls ignored a
header-label/sortability-only column replacement, and focus could disappear when a
focused sort's column was removed by new definitions. Current compiled definitions now supply that metadata directly, preserving the
retained structural-notification contract, and focus recovers to a surviving sort only when the removed
control owned focus. Public Browser regressions cover both cases.

A production scenario with 150 active sorts found a separate retained-core cost:
a secondary value change rebuilt and sorted all 5,000 rows even when no position
changed (p99 12.6 ms). A private neighbour proof retains the committed TanStack order
only while current affected edges remain ordered. Actual moves, membership or
identity changes still reproject. A regression also caught and fixed the initial
optimization's failure when a row returned to its original reference after its
neighbours had changed. These are our grid corrections, not new Astryx defects.

The focused production rerun passed at p99 4.9 ms for the active review and 4.4 ms
for the 149-option add picker, with 100 measured samples each and zero over-budget
samples. The 8.33 ms limit, 5,000 × 150 workload and 20 Hz cadence are unchanged.
Differential tests and public live-update regressions cover the proof; full local
validation, independent review and clean-commit measurement remain required before
publication.

The three independent reviewers identified one additional focus gap: Remove was
missing from the registered controls, so replacement definitions could leave focus
on the document body when that button disappeared. The public regression failed
for Remove while passing for Direction and both Move buttons. Remove now registers
its identity too, and the public/installed case covers all four controls.

The first complete 32-scenario development run passed every Client work scenario
but failed start-resize presentation cadence with three dropped frames (maximum
two). The unchanged isolated start/end resize run then passed. The cause of that
cadence failure is unconfirmed; both records are retained outside the checkout,
and a fresh complete run remains required after the focus fix. No budget, sample
count, timing assertion or measurement boundary was relaxed.

A fresh review also caught the conditional Previous/Next controls: shrinking the
sort list to 64 or fewer entries removes them. They now retain focus ownership
with the current review window as their fallback position. Two public regressions
failed before the fix and cover 65→64 and 65→2 replacement transitions. The same
surviving-sort recovery handles these controls without moving intentional outside
focus. This is another local integration correction, not an Astryx patch.
