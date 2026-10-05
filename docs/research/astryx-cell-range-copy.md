# Client keyboard ranges and canonical Copy

This is an incremental delivery for issue #13, after native row selection in PR #39.
The slice activates read-only Client keyboard ranges and Client/Server canonical
Copy. Pointer drag/Shift-click ranges and editable draft/overlay precedence remain
unfinished; this delivery does not close #13 or claim complete selection parity.

## Ownership

The installed Astryx 0.6.5 Table exports native row-selection presentation but no
cell-range or clipboard interface. TanStack Table v9's cell-selection package and
examples were inspected through the local pinned source and its Intent skill.
Its rectangle operation log and corner-based projection do not own this product's
singular one-axis, exact identity-span contract. Reuse the retained private range
runtime and immutable clipboard snapshot rather than translating between two
selection authorities. TanStack Hotkeys continues to own generic shortcuts.

The Client projection owner reconciles the full ordered row/column identity space
before raw/grouped publication. Value-only changes and changes outside the span
preserve it; changed covered identities invalidate it. Group By commands clear it.
The mounted native cells receive narrow DOM decoration updates without subscribing
the React grid tree to every extension. Server exposes only the loaded Active Cell.
Copy captures its row-space/column reader and canonical values before serialization
and submits one finalized TSV payload. Display formatters do not affect exchange.

## Verification and limitations

Public tests cover vertical/horizontal axis locking, exact bigint, structural
invalidation, value-only updates, grouping, asynchronous clipboard success/failure,
and authoritative loaded/unloaded Server coordinates. The production held-key
workload extends 224 times and copies all selected values on every step over a
5,000-row/150-column pinned table. It accounts for admission, animation frames,
React commits, observers and presentation with the inherited budgets.

Cross-document regressions reproduce a separate TanStack Hotkeys dependency bug;
see `astryx-bugs.md`. Installed-consumer validation retains unpatched Client/Server
phases and adds a clearly conditional iframe phase with an explicit Hotkeys patch.
That is not evidence of a fixed unpatched npm dependency. Release issue #16 remains
responsible for resolving runtime patches before publication.
