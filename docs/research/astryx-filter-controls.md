# Filtering and menu-to-filter integration

Date: 2026-10-04. Scope: issues #5 and #6. Evidence: installed, locally patched
`@astryxdesign/core@0.6.5`, retained source and public Browser regressions.
This is an implementation assessment, not a claim that filtering UI has shipped.

## Recommended first slice

Implement a text-column filter opened from its column menu, using native Astryx
controls and the existing grid filter runtime. Include committed-filter persistence
and restoration. Keep #6 open for other filter families, compound editing, facets
and toolbar controls.

The runtime already owns filter commands, narrow per-column subscriptions and
command epochs. The Client installs the persistence callback. Rebuilding these
around Astryx's plugin would duplicate infrastructure. Sources:
`packages/table/src/internal/grid-runtime.ts:367`, `:1750`, and
`packages/table/src/astryx-table-client.tsx:109`.

Use a native Popover, TextInput and Selector. Retain draft validation, identity and
command-epoch invalidation, and 150 ms TanStack Pacer scheduling. Continuous text
changes commit after the debounce; discrete valid choices commit immediately.
Dismissal and unmount cancel pending drafts. Invalid drafts leave the last valid
filter intact. Opening an existing compound expression must not silently replace
it with a simple leaf. No Apply/Reset buttons belong inside the filter overlay.
Sources: `migration/reference/docs/grid/requirements.md:583`, `:591`;
`migration/table/src/internal/client-filter.tsx:486`, `:517`.

## Public controls and focus ownership

| API              | Reusable seam                                                                        | Constraint                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| DropdownMenuItem | `onClick` opens the filter; selection closes the menu                                | Callback precedes native closure; do not simulate clicks or add a timer                      |
| Popover          | `isOpen`, `onOpenChange`, `label`, `content`, trigger children/render function       | Native overlay owns focus and dismissal; Base UI close-reason/autofocus APIs do not transfer |
| usePopover       | `triggerRef`, `show`, `hide`, `isOpen`, `render`, `triggerProps`                     | Lower-level public alternative; its render still owns the focus-trap container               |
| TextInput        | String value, `onChange(value, event)`, input ref, `inputMode`, composition handlers | Suitable for exact numeric drafts; no `type="number"` variant                                |
| Selector         | Controlled string tokens/options and change callback                                 | Map tokens to typed operands; never coerce exact numeric values through number               |

Package sources under `node_modules/@astryxdesign/core/src/`:
`DropdownMenu/DropdownMenuItem.tsx:162`, `Popover/Popover.tsx:118`,
`Popover/usePopover.tsx:273`, `TextInput/TextInput.tsx:117`, `:219`, and
`Selector/Selector.tsx:756`. Their `index.ts` files publish these APIs.
The control names are TextInput and Selector, not Input and Select.

The existing public regression already composes a menu item that sets controlled
Popover state. Keyboard activation moves focus into the Popover, closes the menu,
and returns to the menu opener on Escape:
`src/controls/astryx-menu-focus.browser.test.tsx:105–140`.

`Popover.anchorRef` also installs click/keyboard trigger listeners and ARIA; it is
not just a positioning anchor (`Popover/Popover.tsx:124`). Do not attach both menu
and Popover trigger behaviors to one button without a composition test. Grid-owned
recovery must handle a recycled header and yield to unrelated focused controls;
rewrite the archived Base UI mechanics rather than copying them
(`migration/table/src/internal/client-filter.tsx:252`).

## Why the native Table filtering plugin currently removes little code

The public `useTableFiltering` plugin uses `TableFilterValue = string | number |
string[]`, translated to PowerSearch filters. Configuration supplies filters,
change callbacks, variant and search configuration. Conversion excludes some
kinds, including custom/nested/empty/date-relative/date-range. Sources:
`node_modules/@astryxdesign/core/src/Table/plugins/filtering/useTableFiltering.tsx:73`,
`:162`, `:211`, `:303`.

Its private Popover editor owns drafts and Apply/Reset controls. The public config
does not expose its open state or a separate menu-to-editor command (`:917`).
The inline variant avoids those buttons but still requires translation between a
scalar model and our typed expressions, compound filters, scheduling, validation
and exact operands (`:1147`). It also transforms native headers.

Consume the underlying public controls directly. This removes the archived UI
dependency while retaining the required filter engine; adapting the plugin adds
another state representation without deleting that engine. This is an API/contract
mismatch, not a newly reproduced upstream bug.

## Exact values and persistence

Use textual drafts and compiled semantic parsing for bigint and BigDecimal;
the native plugin's numeric slot cannot represent these domains. The archived
parser uses the owning column's `semantics.parseCanonicalText`
(`migration/table/src/internal/client-filter.tsx:2236`).

Preserve native runtime operands, tagged/versioned JSON-safe column codecs,
half-open numeric ranges, ordered bounds and conservative restoration. Quick
Filter, draft text, open overlays and focus are not persisted. Astryx preferences
already have an explicit separate-namespace policy; do not automatically import
BrunoTable storage. Sources: `migration/reference/docs/grid/requirements.md:481`,
`:483`, `:595`; `docs/MIGRATION.md`, Ownership and persistence reconciliation.

The number-domain input contract includes native `type="number"`, `step="any"`
and `badInput`. Exact domains use textual inputs without `valueAsNumber`.
The published NumberInput source does not provide that contract: its callback is
number/null, text edits commit on blur/Enter, and its actual input is `type="text"`
(`NumberInput/NumberInput.tsx:410`, `:519`, `:904`). This is an API mismatch, not a
reproduced NumberInput defect. The proposed TextInput declaration extension remains
unapplied pending explicit confirmation; see `astryx-bugs.md`.

## Implementation and verification boundaries

Retain query compilation, column semantics, preference codecs, exact parsing,
command epochs, Pacer cancellation and facet intent semantics. Rewrite shadcn/
Base UI markup, event-detail-dependent closing and native control adapters.
Extracting helpers from the archived TSX editor is a behavior-preserving refactor
requiring verification, not a mechanical-import exemption.

The first slice must verify public Client behavior and installed-package behavior:

- TextInput focus and nested Selector Escape ownership.
- Header virtualization while a filter is open and external-focus preservation.
- Debounce cancellation on close, unmount and command-epoch changes.
- IME completion after an intervening reset.
- Invalid drafts producing no query or persistence publication.
- One persisted snapshot per accepted command, without an initial echo.
- Compound filters surviving opening without lossy replacement.
- Controlled updates under React Compiler and narrow subscription isolation.

Native filtering-plugin Compiler behavior remains unverified. Existing sorting,
pinning and overlay corrections do not establish a filtering-plugin defect.
This investigation used the approved patched package; see `astryx-bugs.md` for
actual upstream findings and integration corrections.

## Configured Select options

The published Selector loops through all supplied options when rendering its
listbox (`Selector/Selector.tsx:1487–1575`); it exposes native keyboard, selection
and optional search, but this path is not virtualized. Supply the retained bounded
64-option window plus an off-window selected option. Keep configured values in
the compiled domain and use private UI tokens only to select their exact indexes.
The grid owns paging; native Selector owns interaction and overlay behavior.

## Client Set filter composition

Use published CheckboxInput for each exact value and TextInput for search. The
native Table filtering plugin does not own the retained include/exclude, Match
None or source-admission contracts, so the existing pure facet engine remains the
authority. Its subscription observes admitted resident rows and other grid filters,
never the native Table's windowed data. Generic controls remain upstream-owned.
The search field precedes action buttons so Popover's native first-control focus
lands there without another focus scheduler or dependency patch.
