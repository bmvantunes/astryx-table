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
- Total Core source patch: **8 modules, 92 added / 39 removed lines**.

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
