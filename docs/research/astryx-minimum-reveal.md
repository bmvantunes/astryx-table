# Minimum reveal and segmented keyboard evidence

Date: 2026-10-05. Scope: the geometry acceptance in issues #4 and #5 and the
segmented Server window acceptance in #9. This delivery adds public Browser
coverage; it changes no production implementation or performance budget.

## Client geometry

The existing LTR/RTL pinned test now checks the exact horizontal displacement
instead of merely bounding it between zero and one column width. With a 120px
start pin, two 120px centre columns and a 120px end pin, revealing the second
centre column requires `max(480 - clientWidth, 0)` pixels. The measured native
viewport width excludes its scrollbar; the declared widths supply the independent
expected column edges. Navigating a pinned destination preserves that position.

Two additional cases run in each direction:

- An oversized centre destination approached from either side reveals only its
  nearest edge. Declared widths of 1,200 / 2,000 / 2,000 pixels yield an initial
  displacement of 1,200, then `max(3200 - clientWidth, 0)` when approached from a
  manually scrolled position of 4,000. Active Column Identity and grid focus remain.
- Moving from the body to sticky headers and across headers preserves a manually
  established vertical offset of 720 pixels.

These cases retain the public components and real TanStack-owned key bindings.
They complement the existing suspension, resize, reorder, recycled focus and
custom-renderer scenarios rather than replacing their evidence.

## Server segmentation and source ownership

The source-controlled fixture exposes 20 million logical rows. Four cases combine
LTR/RTL with 640px and 180px host widths, covering active and suspended pinning.
The source returns keys deliberately different from the raw records' `id` values.

The platform-neutral keyboard gesture reaches the final row and final column
before data arrives. The loading Active Cell has no fabricated Row Identity.
After the source delivers the record, the same coordinate adopts its authoritative
key. Its physical scroll range remains bounded, and the last row aligns with the
bottom of the native viewport.

Twenty upward steps then reveal the target at the first unobscured body position.
The expected vertical displacement is independently derived from the measured
row/header heights and native viewport height:
`max(headerHeight + 21 * rowHeight - clientHeight, 0)`.
A subsequent visible downward step does not scroll. The header Home gesture
preserves the body offset; moving down from that header reveals row zero. Source
delivery supplies its identity. All movement stays within one source generation
without release, and fewer than 40 semantic rows remain mounted.

Pinned cells participate through their semantic row's ordered `aria-owns` relation;
the tests accept the documented separate sticky regions and require exactly one
owning row. The first draft incorrectly assumed physical DOM ancestry and expected
Home to select body row zero. Those test assumptions were corrected against the
existing row ownership and header/body navigation contracts. Neither was a product
bug or a weakened requirement.

## Validation boundaries

`src/client-navigation.browser.test.tsx` and `src/server.browser.test.tsx` contain
the cases. The installed-package harness copies both: Client cases run without
Effect, then Server cases run with the published View Server dependency. The
complete production gate retains its 42 scenarios and existing thresholds.

Issue #4 still requires the merged-delivery audit, and #5 retains its full
interaction/overlay obligations. These tests do not claim editing, clipboard or
numeric-filter completion. The real View Server integration remains covered by
the existing Server fixture alongside these controlled sparse-delivery cases.
