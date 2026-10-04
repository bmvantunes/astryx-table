# Native toolbar composition and command capabilities

Inspected published Astryx Core 0.6.5 and retained toolbar contracts on 2026-10-04.
This delivery completes Client filter-command and count composition; it does not
activate Server External Filters, editing controls or selection counts.

## One native keyboard authority

The root already renders published Toolbar for optional children. Toolbar enables
roving tabindex and caret guards over descendant buttons, inputs and tabindex
nodes; its public interface has no roving opt-out. A branded wrapper inside a
Client therefore returns its children directly. Outside a Client it renders one
native Toolbar, preserving standalone composition. Empty fragments and branded
wrappers are recognized at the root without executing arbitrary components.

The Client retains its table-specific `${tableId} controls` accessible name;
standalone branded Toolbar retains `Table controls`. This is the explicit naming
reconciliation with the old wrapper, which always rendered `Table controls`.
There is never a second toolbar merely to preserve both names.

Sources: Core `src/Toolbar/Toolbar.tsx`, `src/hooks/useListFocus.ts`;
`migration/table/src/internal/astryx-table-view.tsx`, Toolbar and
`hasRenderableChildren`; retained ADR 0006 and public-api-design optional toolbar
section. Nested native toolbars are an integration risk, not a reproduced bug.

Published StackItem (`as="span"`, `size="fill"`, `aria-hidden`) supplies spacer
flex growth, with an owned StyleX minimum width of 8px matching the prior minimum.
Toolbar's start-only slot already fills available width. No additional layout or
keyboard engine is required. LTR/RTL Browser geometry and authored arrow-key order
must run with the official stylesheet loaded.

Sources: Core `src/Stack/StackItem.tsx`, `src/Stack/stackItem.stylex.ts`, and
`src/Toolbar/Toolbar.tsx` start-slot rendering.

## Typed commands, no state subscriptions

FilterControl preserves explicit ownership. Grid children receive only frozen,
stable `replace`, `clear`, `reset`, `clearAll` functions with boolean results.
External children receive no capability and require no table context; the wrapper
neither interprets nor activates External Filters for Client Tables.

Replacement uses the retained compile/admit/single-column/dispatch sequence.
Only admission exceptions are caught. Dispatch errors retain their existing
semantics. Clear and Reset first validate current column eligibility: runtime
Clear alone accepts absent identities, while saved public commands must reject
removed or disabled columns. Clear All leaves Quick Filter untouched.

Commands read the installed query's columns only when invoked. This replaces the
old extra column cache and reconciliation effect with the runtime's existing
authority. The query reader stays private, and no subscription or broad public
controller is exposed. Structural TypeScript compatibility passes this broad
private admission boundary to the exact public capability without a type cast.

Sources: `migration/table/src/internal/toolbar-capabilities.tsx`, lines 66–89 and
159–229; `packages/table/src/internal/grid-runtime.ts`, filter command dispatch;
`packages/table/src/internal/grid-query.ts`, `compileClientFilterCollection`.

## Numeric count projections

ActiveFilterCount and ActiveSortCount reuse the existing count presentation and
separate numeric subscriptions. Filters count complete column expressions plus
active normalized Quick Filter. Sorts count the active sorting context. Exact
numeric callbacks and accessible names remain unchanged; unchanged cardinality
does not notify these controls even when expression details change.

Sources: retained toolbar-capabilities and runtime count snapshot/notification
implementations. Public and installed tests cover ownership, commands, invalid
admission, stale capabilities, scope and native composition. Source diagnostics
cover capability identity, zero command subscriptions, numeric isolation and
cleanup. Production adds the complete composition to the unchanged 5,000 × 150,
20 Hz protocol; no new dependency patch is involved.
