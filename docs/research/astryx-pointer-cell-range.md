# Client pointer ranges

This continues issue #13 after keyboard ranges and canonical Copy. Native Astryx
0.6.5 cells now admit the retained one-axis pointer workflow. The XState gesture
actor, exact identity spans, slop, axis locking, capture, autoscroll, cancellation
and sparse DOM decoration remain owned by the existing private range runtime.
TanStack Table v9's rectangle operation log does not satisfy this product's single
linear identity-span contract; its inspected Intent guidance explicitly documents
corner retargeting after structural changes. No second selection authority is added.

Both native centre and pinned cells carry their logical row position alongside
stable row/column identities. Pointer hits stay scoped to the owning grid and
exclude nested controls. Shift intent goes through the existing TanStack modifier
parser without the click-count guard used by row checkboxes. Ctrl/Meta gestures
replace the single range. Column gestures, navigation and Copy are excluded while
range capture is active; Escape cancels at the owning-document boundary.

Physical horizontal autoscroll is translated to the viewport's logical direction.
Direction, size or pinning environment changes cancel the gesture before its
captured geometry can become stale, restoring the prior Active Cell and selection.
This is an AstryxTable integration correction, not an upstream Astryx defect.

Browser regressions cover LTR/RTL pinned spans, slop/ties/axis locking, cancellation,
Shift-click, Ctrl/Meta replacement, nested controls, source invalidation, direction
changes and autoscroll across both virtual axes. The installed-consumer harness
includes these same public cases. Production workloads add vertical and horizontal
pointer autoscroll over 5,000 rows and 150 columns, preserving 24 warmups, 200 measured
frames, complete input/RAF/React/observer accounting and existing budgets.

Editable draft/overlay precedence, range traversal and the remaining clipboard/edit
work are still tracked by #13 and dependent issues. This slice neither closes the
issue nor resolves the separate patched-Hotkeys distribution limitation in #16.

The initial benchmark draft summed three independently scrolling frames per sample
and incorrectly applied one frame budget to that sum. Phase profiling found
individual horizontal geometry reads around 5–6 ms. The corrected protocol accounts
for every consecutive frame once, carries asynchronous work into the next interval,
and charges release/drain work to the final sample. It increases measurement to 200
frames and preserves the 8.33 ms work and 20 ms presentation limits. No inherited
benchmark or production scrolling behavior changes for this correction.

Independent verification also rejected using the larger of callback and React time:
React can commit outside RAF execution. The final collector conservatively sums both
and observer work. Overlapping work may be charged twice; separate React work cannot
disappear. All three reviewers must review this corrected collector before publication.
