# Native column preference controls

Inspected `@astryxdesign/core@0.6.5` on 2026-10-04. These are source findings;
Browser and production gates establish the selected integration's behavior.

## Published choices

`MultiSelector` accepts controlled string identities, disabled options, native
search, keyboard navigation, count presentation and a ghost toolbar appearance.
The callback supplies the complete selected identity array. With Clear and Select
All disabled, one option toggle maps to one existing column-visibility command.
Disable the sole visible option and retain the runtime's final-column guard.

Selected options are placed first when the picker opens and retain that opening
order during the session. This is a picker presentation order, not durable column
order. Search matches labels case-insensitively, falling back to identity only when no
label is supplied. Our labelled options therefore search header names. Opening focuses
the search; native Escape/Tab and arrow behavior own focus and selection.

There is no public option virtualization, controlled search or open-change callback.
Every matching option is rendered, and the popover does not request lazy mounting.
This control therefore cannot claim bounded option DOM or zero closed-panel cost.
Do not create one picker per mounted header.

Primary sources in the installed package:

- `src/MultiSelector/MultiSelector.tsx:517` — public props;
- `src/Selector/types.ts:15` — option identity, label and disabled state;
- `src/MultiSelector/MultiSelector.tsx:712` and `:928` — search and opening order;
- `src/MultiSelector/MultiSelector.tsx:985`, `:996`, `:1096` — focus, popover and callbacks;
- `src/MultiSelector/MultiSelector.tsx:1513` and `:1660` — complete option rendering;
- `src/MultiSelector/hooks.ts:128` — native keyboard workflow;
- `src/Layer/useLayer.tsx:519` — non-lazy default.

`DropdownMenuSubMenu` and `DropdownMenuCheckboxItem` provide another native option.
They directly express one Boolean column command, nested keyboard navigation,
checked semantics and an open-change lifecycle. The root menu is lazy, but the
submenu still renders every supplied child and has no search or virtualization.
A bounded window would remain integration-owned. The current data-driven menu
shape has no checked/value field; using this option requires the public compound
JSX API rather than simulated check icons.

Sources: `src/DropdownMenu/DropdownMenuCheckboxItem.tsx:100`,
`DropdownMenuSubMenu.tsx:223`, `:425`, `:585`, and
`DropdownMenu.tsx:230`, `:316`, `:658` in the same installed package.

## Selected composition

Use a compact side-rail Button and native Popover to mount one searchable
MultiSelector and an independent native Reset menu on demand. This makes hidden columns reachable even when their former header is
unmounted and preserves a stable focus owner. Page-specific toolbar children keep
their existing optional composition slot; without children there is no top toolbar
or additional vertical space. No new public grid controller or selection state
is introduced. Measure this choice with 150 columns, with the preference panel closed and its picker open; do not
infer its performance from the native component name.

The visibility boundary observes only structural column publications. Reset
controls dispatch existing commands without grid-state subscriptions. Durable
layout, persisted snapshots and reset baselines remain in the retained runtime.
The original behavior is recorded at
`migration/table/src/internal/astryx-table-view.tsx:5839` and the retained column
management requirements. Grouped visibility eligibility remains part of issue #7,
whose grouped renderer is not yet activated in the public Client slice.

The API inspection did not identify a new upstream defect. Subsequent nested-panel
Browser validation reproduced a gap in our existing ASTRYX-001 focus-return patch:
option clicks can leave focus on a containing dialog. The patch now recognizes
that ancestor fallback while preserving focus on clicked sibling controls. See
[`astryx-bugs.md`](../../astryx-bugs.md) for the minimal reproduction and scope.
