# Native Row Selection integration

Date: 2026-10-05. Scope: the raw Client Row Selection portion of issue #13.

## Reuse and ownership

The imported `row-selection.ts` remains byte-identical to its mechanical source.
Its authoritative source IDs and complete filtered order own membership and Shift
anchors. Astryx 0.6.5 `CheckboxInput` supplies native inputs, hidden labels and its
native indeterminate property. Its controlled `onChange` feeds the retained
runtime; the original MouseEvent detail distinguishes pointer and native keyboard activation.
The hotkey adapter passes native pointer modifiers through TanStack's public
`parseKeyboardEvent` using an undispatched owning-realm KeyboardEvent with an
Unidentified key. This avoids the installed held-key singleton's parent-document
scope; it creates no listener, held-key state or shortcut matcher.

The published Table selection state hook requires a controlled Set and processes
the provided data array. Installing it over the mounted viewport would change
Select All semantics, while duplicating the complete grid selection state would
add another authority. The native checkbox and cell primitives fit the fine-grained
retained subscriptions directly. `TableSelectionToolbar` remains a compatible
future optional composition candidate, but its complete-selection count differs
from the retained filtered header count; this delivery does not silently conflate
them or add a permanent toolbar.

## Geometry and focus

The 40px utility gutter remains outside Logical Column Order. Header and body use
one ordered semantic row ownership relation, with data column indexes shifted by
one only while selection is available. Viewport measurement subtracts the gutter,
rendered surfaces add it, and native start-pinned cells share gutter-aware offsets
with resize previews. Suspended pinning keeps the gutter and virtualizes all data
columns. Public LTR/RTL tests independently calculate reveal as
`max(480 + 40 - clientWidth, 0)` for four 120px columns.

Native cells use a truncation max-width by default. The utility cell declares its
fixed width and removes that truncation bound, just as the data-cell integration
already does. This is ordinary renderer composition, not an upstream bug patch.
A focused header checkbox that becomes disabled returns focus only when that
control still owned focus and its document focus chain remains active.

## Evidence and remaining scope

The first public test failed because the Client rejected `rowSelection`; the next
keyboard case failed before Space/Shift/Mod+A were connected. A separate empty
source test exposed the disabled-header focus transition before its correction.
All use public Client behavior; the installed consumer runs the same cases without
Effect. Diagnostic integration tests measure affected checkbox/header commits and
absence of structural grid commits or value-only selection work. SSR keeps bounded
suspended columns and the optional gutter.

One RTL test initially compared absolute screen coordinates before and after an
automated click that scrolled the outer page to an off-screen control. It now
captures geometry after the click. The keyboard test follows the retained logical
ArrowRight order in both directions; RTL changes physical reveal geometry. Neither
test correction changes product behavior or weakens its bounds.

Production measurements add selection to the existing 5,000-row/150-column pinned
two-axis workload and to the 112-publication 20Hz workload. Twelve warmups and 100
measured samples, full callback/React/observer accounting, the 8.33ms grid-work
budget, cadence gates and mounted-window bounds remain. Native selection controls
must not rerender for value-only publications. This does not certify the still
unimplemented linear range, Copy, Paste, fill or editing capabilities.

Local review reproduced two integration gaps before correction: iframe Shift-click
missed its inclusive interval, and loading omitted the selection gutter. Iframe
regressions now include accompanying Ctrl/Alt/Meta modifiers and detail-zero
keyboard activation. Loading preserves utility geometry and semantic indexes with
active or suspended pinning, and capability changes reset its private viewport.
These are integration fixes, not additional Astryx Core dependency patches.

The first production selection publication run failed before measurement because
the observer queried data column index 1, which is now the utility column. It now
observes the same data cell at index 2 in selection mode; work accounting and
budgets are unchanged. The separate retained 10,000-identity Select All Node
benchmark measures runtime work only, not a complete native-checkbox gesture.

The next local review reproduced loading-to-loading capability changes losing
owned grid focus. Source-body recovery now observes the effective gutter
discriminator. Four paired public cases cover enable/disable and outside focus.
