# Independent React work in production benchmarks

Issue #16 requires complete accounting. The pointer-range review exposed an inherited
assumption: taking `max(callback CPU, React CPU)` silently treats all React work as
if it happened inside measured callbacks. The collectors do not establish that
execution overlap. A 6 ms callback followed by 3 ms of independent React CPU can be
reported as 6 ms and incorrectly pass an 8.33 ms gate.

All active production collectors now share conservative addition for callback and
React CPU. Admission and observer work remain separately charged. The two-phase
Client publication and held-navigation collectors use the same policy for both
phases. Synchronous overlap may be counted twice; unrelated React work cannot be
dropped. This is an upper-bound accounting policy, not an exact de-duplicated CPU
measurement. No grid runtime, public API, historical source fixture or library
provenance changes. The historical `combine...` helper remains in the copied core for source-provenance
regression checks; current production harnesses use the corrected collector.

Two gate-level regressions reproduced false passes for independent React CPU in a
single frame and across admission/render/presentation phases. They failed before
the fix and pass after it; an in-budget case still passes. The production workload,
scenario list, warmups, sample counts, 8.33 ms work limit, presentation limits and
dropped-frame allowances are unchanged. Older reported values used a different
accounting policy and must not be treated as directly comparable performance numbers.

This strengthens the existing proof, not the complete parity claim. Deferred edit,
paste, fill and other release scenarios still belong to their implementation issues
and #16. No npm release is authorized by this change.
