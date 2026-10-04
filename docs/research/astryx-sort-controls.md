# Native sort controls

Inspected installed `@astryxdesign/core@0.6.5` on 2026-10-04. Findings come from
published source and declarations, plus the repository's existing patch. Behavioral
and performance claims require the separate Browser and installed-package gates.

## Selected composition

Use a native Button and the existing lazy Popover integration for the side control.
Inside it, a native ordered List/ListItem displays absolute sort priorities. One
searchable Selector adds inactive sortable Column Identities. Native Buttons change
direction, move earlier/later and remove an entry. The retained runtime remains the
only sorting, admission and persistence authority.

A two-option controlled Selector can express direction, but the existing two-way
runtime toggle maps directly to a Button. Using that Button also avoids one hidden
option list per mounted sort. Clear and Select All are not relevant sort commands.
The last active sort remains protected by both the control and runtime admission.

- Selector public props and value contract: `src/Selector/Selector.tsx:503`, `:754`.
- Native search focus: `Selector.tsx:1017`; controlled commit path: `:1190`.
- Selection and keyboard behavior: `src/Selector/hooks.ts:221`, `:325`.
- Stable option values and labels: `src/Selector/types.ts:15`.
- Ordered list and absolute start: `src/List/List.tsx:37`, `:186`.
- Independent ListItem controls: `src/List/ListItem.tsx:40`.
- Button labels, refs and disabled behavior: `src/Button/Button.tsx:244`, `:600`.

All paths above are under the installed Core package. A disabled Button with a
native tooltip remains focusable through `aria-disabled`, while activation remains
blocked. This preserves focus when moving a sort onto the first/last priority.

## Bounds and lifecycle

Neither List nor Selector virtualizes. Mount the review only while its outer panel
is open and bound the active review to 64 entries with Previous/Next commands and
absolute priority labels. Do not truncate the add-picker options: native search
can find only the options supplied to it. Its complete matching list is rendered
(`Selector.tsx:1486`) and is measured separately at the 150-column workload. This
is not a constant DOM bound for arbitrary schemas.

The `usePopover({ lazyMount: true })` seam comes from our existing approved Core
patch, not unmodified 0.6.5. Reusing it adds no new patch. It bounds closed-panel
cost by avoiding the review component entirely.

ComplexSelector offers controlled generic values and an open-change callback, but
supplies neither search nor collection rendering. Its children callback executes
while constructing content, and its hide path unconditionally focuses the trigger.
Adopting it would require more integration and an outside-click focus probe; this
source observation is not a reproduced defect. See
`src/ComplexSelector/ComplexSelector.tsx:230`, `:395`, `:470`.

## Required integration evidence

Preserve stable Column Identity keys and explicitly recover focus when a command
removes or pages out its initiating control. Announce successful commands with
native VisuallyHidden status content (`src/VisuallyHidden/VisuallyHidden.tsx:21`).
Public and installed tests cover mandatory sorting, reset/restoration, hidden and
ineligible columns, numeric ascending-first behavior, priority and removal focus,
search, replacement definitions and long-list reachability. Production evidence
must retain the full existing workload and prove narrow subscriptions while open.
