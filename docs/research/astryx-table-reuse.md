# Astryx Table reuse assessment

Date: 2026-10-03. Package: published `@astryxdesign/core@0.6.5`. Status: source investigation plus public-API Browser experiments; no native Table integration has shipped.

The user asked us to evaluate the complete Table capability set and improve the implementation instead of copying blindly. The shadcn version defines the required contracts, not the required implementation. Prefer direct consumption or a small private Adapter where it removes local ownership without weakening parity. The prior blanket preference against the native Table engine is superseded; see [SPEC](../SPEC.md#reuse-and-improvement-direction-2026-10-03).

## Evidence and scope

One independent read-only research worker inspected the installed package's source, public exports, emitted declarations and shipped tests. It also checked the complete official repository tree at `d8370a1ee401b7a07c1ec798c2d23aad0ba7bf63` as corroboration. Findings below describe 0.6.5; they do not rule out a different package, example or later implementation.

The Table entry publishes real components and controlled plugins, substantially more than ordinary buttons. `BaseTable` itself is not exported from that entry, even though its props type is exported. Unsupported deep imports are not a reuse strategy. Sources: `node_modules/@astryxdesign/core/src/Table/index.ts:30`, `dist/Table/index.d.ts:26`, `package.json:517`.

The published Table has no native row or column virtualizer. `BaseTable` renders all supplied resolved columns in its header, maps all supplied data rows, and maps their supplied columns. `rowIndexStart` and `rowCount` describe externally windowed data rather than calculating a window. Sources: `src/Table/BaseTable.tsx:161`, `:415`, `:558`; `src/Table/types.ts:572`, all within the pinned Core package.

The parent ran a real Chromium Browser experiment against the published `@astryxdesign/core/Table` entry and CSS, using the repository's React Compiler configuration. Two cases passed, LTR and RTL: a 640-pixel wrapper with 20 rows, 150 fixed-width columns and sticky first/last columns. Both pinned headers remained at their original X positions after 1,800 pixels of horizontal scroll. All 150 headers and 3,000 body cells remained mounted before and after scrolling. This proves actual sticky behavior and the absence of automatic windowing in that configuration; it is not a performance certification or a universal claim about every possible external plugin.

Local experiment: `/private/tmp/astryx-native-table-probe/native.browser.test.tsx`; run from that directory with `vp test --config vitest.config.ts --run`. Log: `/private/tmp/astryx-native-table-probe.log`. The fixture is temporary research material and must not become an unreviewed production dependency.

## Capability map

| Capability                           | Published behavior                                                                                                                                        | Reuse direction and remaining proof                                                                                                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table presentation                   | Table, Row, Cell, HeaderCell, Header, Body, Footer and Context; density, dividers, striping, hover, wrapping, truncation, custom children and empty state | Test native elements or children mode while retaining fine-grained cell subscriptions. They could remove local visual styling.                                                                                                                                                      |
| Scroll wrapper                       | Default inline scroll wrapper; inherited custom `scrollWrapper` seam                                                                                      | A custom wrapper may preserve one native two-axis owner. Do not nest an independent native Table scroller around the existing viewport.                                                                                                                                             |
| Row/column virtualization            | No implementation in the inspected Table; metadata supports externally windowed rows                                                                      | Retain a virtualizer. Evaluate native rendering of an externally bounded window rather than assuming native scrolling windows the DOM.                                                                                                                                              |
| Sticky columns                       | Controlled start/end keys, logical offsets, backgrounds and scroll-aware shadows                                                                          | High-priority private Adapter candidate. Validate dynamic pinning, narrow suspension, measured widths and mounted sticky partitions. Static LTR/RTL Browser experiment passed; unpatched dynamic unpinning fails with stable rows/columns; the local correction passes (see below). |
| Resize                               | Controlled committed widths, imperative preview, pointer and keyboard controls                                                                            | Evaluate DOM assumptions and width redistribution before reuse. It is not yet proven equivalent to the virtual grid's logical geometry.                                                                                                                                             |
| Column settings                      | Controlled active keys filter and order columns; optional state hook offers toggle/show-all/reset                                                         | Reuse controlled transforms if native rendering fits; consume a published picker separately for presentation. The state hook supplies no picker UI. Keep one order/visibility owner and our versioned persistence. No drag-reorder engine is supplied here.                         |
| Sorting presentation                 | Controlled sorting, Shift multi-sort, priorities and context actions; unsorted click cycling can be disabled                                              | Strong candidate while our runtime retains exact comparisons, server queries and mandatory non-empty order. Probe context Clear and multi-sort ARIA.                                                                                                                                |
| Sorting data                         | Companion state hook accepts controlled sort state and per-key custom comparators                                                                         | Exact domains can use our comparators. Evaluate net deletion against retaining TanStack; default comparator differences alone do not rule out reuse.                                                                                                                                |
| Filtering                            | PowerSearch-backed inline/popover controls and filter state conversion                                                                                    | Partial candidate for matching simple domains. Published numeric state cannot represent native bigint/BigDecimal operands unchanged. Generic inputs/popovers remain reusable.                                                                                                       |
| Row selection                        | Controlled item/select-all queries and commands; per-checkbox subscriptions and imperative row styling                                                    | Candidate for control presentation. Preserve stable identities, grouped-view disabling/clearing, Shift selection and narrow notifications.                                                                                                                                          |
| Selection toolbar                    | Structural selection projection, selected count, clear command and Toolbar content                                                                        | Basic controlled composition is Browser-proven. Feed our narrow selection projection; no native selection state owner is required. Hot-update isolation and production integration remain unproven.                                                                                 |
| Grouped rows                         | String-key sections, synthetic header records, collapse state and custom header content                                                                   | Not our flat aggregate-summary model. Retain grouping semantics; use section presentation only if a real matching requirement exists.                                                                                                                                               |
| Trees                                | External row metadata/toggle commands, optional flattening and expansion state                                                                            | Controlled presentation is reusable if a matching feature is needed. Do not add tree scope or equate it with aggregate summaries.                                                                                                                                                   |
| Detail expansion                     | Controlled expanded keys and full-width extra row                                                                                                         | Available, but additional physical rows need explicit geometry work. Not a replacement for grouped summaries.                                                                                                                                                                       |
| Context menus                        | Lazy cell/header context actions and public action resolution                                                                                             | Reuse directly with native cells, otherwise use the published ContextMenu. Preserve typed commands and focus ownership.                                                                                                                                                             |
| Row status                           | Status column with semantic/custom icon, color, label and tooltip                                                                                         | Presentation candidate; does not replace source lifecycle, conflicts, accepted overlays or save reconciliation. Do not add an unwanted column merely to reuse it.                                                                                                                   |
| Row numbering                        | Synthetic ordinal column with key/offset support                                                                                                          | Use only for a real ordinal-column requirement. This is not the exact-bigint Rows aggregate System Column.                                                                                                                                                                          |
| Pagination                           | Pagination hook and data helper                                                                                                                           | Excluded by our continuous-rowspace contract. Availability is not a reason to add it.                                                                                                                                                                                               |
| Editing, clipboard, source lifecycle | No corresponding grid workflows in the inspected Table export surface                                                                                     | Retain our domain/workflows while consuming published generic controls for their presentation.                                                                                                                                                                                      |

## Pinning and geometry

The sticky plugin's offset and shadow behavior is real. Its scroll listener writes CSS variables without React state and handles logical start/end in RTL. Reusing it could remove local sticky visual styles and shadow handling. Sources: `src/Table/plugins/stickyColumns/useTableStickyColumns.tsx:296`, `:344`.

Keys identify contiguous prefix/suffix runs: a start key also pins preceding columns, while an end key pins following columns. Our arbitrary selected identities must reach it in normalized start → centre → end order. Offsets use pixel widths or proportional minimums, so fixed-pixel geometry is compatible in principle. Sources: the same module at `:42`, `:59`.

The plugin does not own centre virtualization, pre-measurement suspension, the minimum 80-pixel centre band, segmented rowspace or minimal Active Cell reveal. Those still need one owner. An adapter should consume the existing effective geometry, including empty pin sets during suspension, without introducing another geometry engine.

A promising experiment is to call the public plugin transforms once per effective column configuration and reuse the resulting presentation across mounted cells. Applying each transform independently to every cell repeats column scans and offset-map construction. That is a source-level cost observation, not a measured performance regression.

The dynamic-update risk is now reproduced through the published entry. With unchanged data and columns, changing both pin sets from the edge keys to empty arrays leaves body cells sticky. Four Browser cases fail in each configuration: LTR/RTL × stable/inline plugin record. The toggle label confirms the consumer state changed, and the assertions poll for the updated layout. With React Compiler, both headers and body remain sticky in this fixture. Without React Compiler, headers unpin but the body remains sticky. This is a correctness failure, not a throughput measurement.

The source explains the stale rendering: the sticky hook returns a stable plugin reading a mutable configuration ref; `useBaseTablePlugins` stabilizes the array by plugin identity; the body row comparator skips unchanged item/column/plugin identities. React Compiler can also retain the Table JSX when its visible inputs stay identical. Sources: sticky hook `:288`; `src/Table/useBaseTablePlugins.ts:160`; `src/Table/BaseTable.tsx:286`.

The user explicitly authorized upstream bug corrections after reproduction. The local patch now publishes a different plugin identity when semantic key contents change, while preserving identity for equivalent fresh arrays. This is one corrective design; an upstream design with explicit reactive subscriptions could also work. The four dynamic pinning regression cases now pass with React Compiler. Record ongoing validation and delivery in [astryx-bugs.md](../../astryx-bugs.md#astryx-004--dynamic-table-pinning). Native plugin correctness alone does not prove our complete virtual-grid integration.

Minimal reproduction, with module-scope stable `rows` and `columns`:

```tsx
function DynamicTable() {
  const [pinned, setPinned] = useState(true);
  const sticky = useTableStickyColumns({
    startKeys: pinned ? ["c0"] : [],
    endKeys: pinned ? ["c149"] : [],
  });
  return (
    <>
      <button onClick={() => setPinned((value) => !value)}>{pinned ? "Unpin" : "Pin"}</button>
      <Table data={rows} columns={columns} idKey="id" plugins={{ sticky }} />
    </>
  );
}
```

After clicking Unpin, assert that both the first/last header and corresponding body cells no longer have computed `position: sticky`. Run the scratch fixture with `vitest.config.ts` and `vitest.no-compiler.config.ts` to compare configurations. The existing static geometry tests pass in both runs.

Native resize uses `closest('th')` and snapshots mounted sibling headers. Its algorithm can redistribute widths and fill the final column, and it owns keyboard matching. A virtual mounted subset is not automatically the full logical column space. Investigate the controlled seams before deciding whether an adapter actually removes more code than it adds. Sources: `src/Table/plugins/columnResize/useTableColumnResize.tsx:144`, `:328`, `:619`.

## Sorting, filtering and selection

The sorting plugin can present controlled state without running its own data sorting. A public Browser experiment reproduced stale header `aria-sort` after the consumer received the new sort state with React Compiler; without Compiler it passed. The authorized local patch now propagates semantic sort configuration changes and that regression passes. See [ASTRYX-005](../../astryx-bugs.md#astryx-005--controlled-sorting-with-react-compiler). Map Column Identities and directions, translate commands, and keep canonical values unchanged. Its companion supports custom comparisons. Sources: `src/Table/plugins/sortable/useTableSortable.tsx:69`; `useTableSortableState.tsx:216`.

Two behaviors need Browser evidence: sorted columns receive a context Clear action even when unsorted click cycling is disabled, and every active sort entry receives `aria-sort`. Preserve mandatory sorting and coherent multi-sort accessibility at the integrated seam. These are source observations, not reproduced upstream bugs. Sources: `useTableSortable.tsx:431`, `:447`.

Native filter state is `string | number | string[]`; numeric conversion uses JavaScript number, while custom/nested/range conversion and control branches do not provide our complete operations. Do not coerce exact operands into that model. Published text inputs, selectors and popovers can still own generic UI while our value codecs retain exact parsing, half-open ranges and persistence. Sources: `src/Table/plugins/filtering/useTableFiltering.tsx:72`, `:211`, `:904`.

Selection controls accept consumer-owned queries and commands. Their host broadcasts notifications from an effect when it renders, so keep that host independent of hot row publications. Its callback shape lacks gesture modifiers; preserve the Shift-selection interaction seam explicitly. Sources: `src/Table/plugins/selection/useTableSelection.tsx:62`, `:350`.

`TableSelectionToolbar` accepts selected keys/count/presence and a clear command. A Browser case passed with consumer-owned selection containing an offscreen identity: the count includes both keys and Clear removes the toolbar. This proves basic composition, not hot-row isolation or production throughput. Feed that shape from the existing selection store rather than introducing another state hook. Sources: `src/Table/plugins/selection/useTableSelectionState.tsx:66`; `src/Table/TableSelectionToolbar.tsx:33`.

## Additional concrete reuse candidates

- The public `TableContext` contains appearance configuration. It can provide density, divider, striping, hover and overflow styling to `TableRow`, `TableCell` and `TableHeaderCell` while a consumer owns the native table/viewport. This could remove local visual styles without adopting the Table wrapper. Without the context, those elements do not acquire the complete Table appearance; standalone headers also need the consumer to supply `scope="col"`. Sources: `src/Table/TableContext.ts:21`, `TableHeaderCell.tsx:131`, `BaseTable.tsx:418`.
- Published `MultiSelector` offers controlled selection, search, disabled options and optional Select All. It is a concrete visibility-picker candidate, independent of the column-settings state hook. Keep visibility and column order separate, and preserve at least one visible column. The retained visibility presentation is about 34 lines plus its submenu infrastructure, so measure actual net deletion rather than assume a large saving. Sources: `src/MultiSelector/MultiSelector.tsx:517`, `:605`, `:690`; local `migration/table/src/internal/astryx-table-view.tsx:5839`.
- Published `Text maxLines={1}` supplies truncation and an overflow-only tooltip, already used in native Table default cells. Start by evaluating header labels; observing every mounted cell can cost more than the local CSS it removes. Sources: `src/Text/Text.tsx:99`, `src/Table/BaseTable.tsx:193`.
- Native default text rendering already converts `bigint` with `String`, preserving its digits. BigDecimal objects need an explicit `renderCell`. This does not establish exact comparison, filtering, editing or exchange semantics. Source: `src/Table/columnUtils.ts:176`.
- A single textual filter input could use a controlled textual UI projection and feed our exact parser without placing canonical bigint/BigDecimal operands into the numeric PowerSearch model. Do not route that text through numeric `toSearchFilters`. Empty-string-to-null behavior, external updates with Compiler, range inputs and operator selection still need proof. Sources: `src/Table/plugins/filtering/useTableFiltering.tsx:424`, `:1147`.

## Renderer alternatives and next experiments

Evaluate three levels, rather than accepting or rejecting the entire Table as one unit:

1. Retain the current renderer and consume selected public plugins/components.
2. Retain viewport/cell stores, render with public native Table elements.
3. Feed a bounded external row/column window to native Table, with cell components subscribing directly to our store.

Native Row/Cell/HeaderCell hard-code tr/td/th and have no polymorphic `as` prop. Changing the div partitions requires real layout, row-ownership and SSR/hydration evidence. The native default scroll wrapper also schedules overflow measurement and can update React state; profile it or use its supported custom wrapper. Sources: `src/Table/TableRow.tsx:103`, `TableCell.tsx:43`, `Table.tsx:138`, `:244`; `src/hooks/useScrollableArea.ts:252`.

Next proofs, in order:

- Dynamic pin/unpin with stable data/columns, both sides, LTR/RTL and narrow/centreless suspension.
- Public sticky-transform adapter or native element rendering with bounded two-axis windows, fast reversal, per-frame header/body alignment and minimal reveal.
- Controlled sorting actions, especially context Clear, Shift multi-sort and keyboard focus.
- Native selection controls/toolbar driven only by selection projections; live row values must not wake them.
- Exact values, custom renderers, fixed-height loading slots and SSR/hydration through any proposed renderer replacement.
- Existing production workloads and the unchanged 8.33 ms p99 gate, including complete handler/React/frame accounting and bounded mounted DOM.

The shipped sticky tests use JSDOM and explicitly do not resolve actual sticky CSS; native Table performance tests establish row memoization rather than our production virtual-grid budget. The initial Browser experiment proves basic sticky geometry; the retained regressions additionally prove dynamic updates and equivalent-key row reuse. Suspension, virtual-grid integration and production plugin throughput still need their own evidence. Sources: `src/Table/plugins/stickyColumns/useTableStickyColumns.test.tsx:9`; `src/Table/Table.perf.test.tsx:129`.

Record each adoption with the local code it removes and the contracts it proves. Preserve local ownership only where native capabilities do not satisfy the required behavior; copying the old implementation is not itself an acceptance criterion.

## Native renderer integration, 2026-10-03 (issue #4, work in progress)

The first integration now consumes public `TableContext`, `TableRow`, `TableHeaderCell`, `TableCell` and sticky plugin transforms. The existing viewport owns one native scroll element, row/centre windows, separate mounted start/end body regions, live CSS geometry and measured suspension. Plugin transforms are resolved for pinned columns per effective layout; source updates do not recalculate their offsets. Shadow refs are connected separately so a changed plugin cannot reattach/reset the viewport.

A single flat keyed header list retains its menu trigger when moving across regions. Menu focus activates the matching header in the existing navigation runtime; a layout command then reveals that header rather than a stale initial body cell. Body cells have Table Instance/row/column DOM identities. Chromium accessibility-tree tests exercise `aria-owns` ordering over independent pinned regions while the centre window moves and reverses.

Native cell presentation remains in use after isolating a CSS performance trigger. `overflow: clip` avoids nested cell scroll containers, and `maxWidth: none` permits authoritative flex widths. Pinned shadows keep visible overflow while their content clips separately. The measured comparisons and limits are in [the running ledger](../../astryx-bugs.md#integration-optimizations-not-counted-as-upstream-bugs). This is supported composition, not another upstream patch.

Current tests cover initial/restored pinning, LTR/RTL, dynamic pin/unpin, menu keyboard focus, narrow suspension/recovery with coordinate rebasing, bounded mounts, exact cell dimensions, long custom content and real AX row ownership. Resize/reorder gestures, their cancellation/keyboard contracts, and complete navigation remain pending; this slice does not close issue #4 or establish full parity.
