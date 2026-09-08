# Astryx Table migration investigation

Date: 2026-09-08. Status: source investigation complete for the initial architecture decision; build/Browser proof and detailed parity inventory remain open. No repository or tickets have been published. No migration implementation has begun.

## Decision summary

Recommended direction: a new Astryx/StyleX presentation for the existing BrunoTable domain and viewport engine, retaining Vite+. Do not assume Astryx Table or its sticky-column plugin can replace that engine. Consume published Astryx controls; do not vendor or swizzle ordinary components by default.

This is a substantial presentation port, not a fresh grid implementation and not a dependency rename. Calendar estimates before a working integration spike would be unreliable. The first milestone should be a packed, installable, read-only virtual grid with an Astryx menu; it must demonstrate the hardest integration boundaries before committing to the remaining port.

## Evidence baselines

- Astryx v0.5.4: `b92b07613fbf941392a2138bd22b42c71e2707f0`, released September 7. Sources below are pinned to this release; newer main changes are not assumed present in the package.
- BrunoTable inspected at `d99924b8f6205c2845cd127f3bc662157aa71354`, the unmerged PR #100 follow-up. This is a research reference, NOT an approved migration seed. Its release-script review findings remain unresolved. Select an explicit clean seed before copying implementation.
- Existing user's root checkout is dirty and older; it was not changed.
- Read-only upstream source/test inspection, independent research worker, and coordinator verification of rendering/dependency facts. No Astryx installation, Browser run, or performance measurement was conducted.

## Capability comparison

| Capability                                | Astryx evidence                                                                   | Proposed ownership                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Buttons, fields, menus, dialogs, tooltips | Published component subpaths; precompiled CSS distribution                        | Astryx npm packages, with grid-domain composition locally                           |
| Table rendering                           | Native table; maps supplied rows and resolved columns                             | Keep bounded virtual renderer; investigate individual visual primitives only        |
| Sticky columns                            | Contiguous prefix/suffix with declared-width offsets                              | Keep identity-based pinned partitions, measured geometry and suspension             |
| Two-axis virtualization                   | Not implemented by the examined Table; metadata/extension seams are not windowing | Retain grid viewport runtime and mounted-window bounds                              |
| Client/Server sources                     | No equivalent Viewport Source/query-generation implementation in examined Table   | Retain source adapters, exact identities and lifecycle semantics                    |
| Spreadsheet keyboard/range/copy           | Native-table accessibility is not the existing grid interaction contract          | Retain grid commands and TanStack Hotkeys; retest new component focus boundaries    |
| Editing and conflicts                     | No exported Table editing plugin in examined release                              | Retain save preflight, canonical source authority, Accepted Overlays, Batch history |
| Resize                                    | Upstream native-table pointer/keyboard resize exists                              | Do not install a second width/keyboard authority                                    |
| Performance                               | Upstream tests include 100-row render/update budgets of 200/100 ms                | Preserve our production 8.33 ms p99 and workload/evidence rules                     |

Upstream source: [BaseTable](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/packages/core/src/Table/BaseTable.tsx), [Table](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/packages/core/src/Table/Table.tsx), [sticky plugin](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/packages/core/src/Table/plugins/stickyColumns/useTableStickyColumns.tsx), [exports](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/packages/core/src/Table/index.ts), [performance tests](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/packages/core/src/Table/Table.perf.test.tsx).

The exported Table hooks are real extension points, but the unstyled BaseTable component is not itself publicly exported. Plugin failures can be caught while prior output is retained; atomic domain changes must not depend on this presentation pipeline. The upstream contract also records accessibility/coverage limitations. [Contract](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/packages/core/src/Table/Table.spec.md).

## Local reuse audit

The inspected package uses TanStack Table v9, Store, Hotkeys, Pacer and XState independently of its shadcn peer. Effect remains optional at the root, with the View Server adapter separately packaged. These boundaries support reuse without adopting a second table semantics engine.

Seven production TSX modules directly import `@bruno/shadcn`: the shared view, grouping controls, filter controls, filter rendering, edit chrome, paste chrome and drag-fill chrome. This is not a measure of migration size: the shared view alone is 9,374 lines and combines rendering, geometry integration and overlays. Styling exists beyond import sites. The source tree has 72 test files, including 23 Browser test files; preserve behavioral coverage, not implementation-specific DOM assumptions.

Reference files at the inspected commit: `packages/table/package.json`, `packages/table/src/internal/bruno-table-view.tsx`, `packages/table/src/public-types.ts`, `docs/grid/architecture.md`, `docs/grid/benchmark-profile.md`.

### Reuse, adapt, prove

- Reuse candidates: column identity/value semantics, exact numbers, filters and persistence codecs, Client/Server source contracts, query generation, sparse edit/history state, save/conflict reconciliation, selection spans, atomic clipboard capture and fill planning.
- Adapt: view styling, theme/density tokens, lifecycle presentation, menus/submenus, editors, dialogs/reviews, notifications, grouping and filter controls, package peers/exports and consumer guidance.
- Re-prove: focus restoration after recycling/unmount, nested Escape ownership, pointer/keyboard/context activation, screen-reader virtual coordinates, pinned RTL geometry, reduced motion, React Compiler subscription boundaries and all production performance workloads.
- Do not carry the Base UI hidden-trigger workaround across as an architectural requirement. It addressed that upstream library; investigate Astryx's supported focus/anchor APIs first.

## Build and distribution

Astryx offers precompiled CSS and React components. Its own source compilation is optional for consumers. The pinned core declares `intl-messageformat` plus StyleX/React/ReactDOM peers, not Base UI or Tailwind. [Metadata](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/packages/core/package.json), [distribution overview](https://astryx.atmeta.com/blog/how-astryx-works).

StyleX documents a Vite plugin, CSS extraction and development integration. That supports a plausible Vite+ demo path, not automatic proof of the library packaging path. Vite+ uses `vp build` for applications and `vp pack`/tsdown for libraries; validate CSS extraction and React Compiler ordering separately for both. [StyleX Vite guide](https://stylexjs.com/docs/learn/installation/vite/).

Required emitted-consumer checks: install actual tarball; render with documented CSS imports; verify theme/reset ordering, dark mode and RTL; ensure CSS survives tree-shaking; check declarations without optional Effect; SSR/import and hydration behavior; no Tailwind/Base UI/shadcn requirement; no requirement that ordinary consumers compile our source. Keep continuously changing geometry outside top-level React state and avoid generating arbitrary style classes per pointer event.

Astryx is MIT and described as beta. Meta authorship does not establish API stability or compatibility with our workload. Retain license notices for any substantial copied upstream source; consuming packages is the default. [License](https://github.com/facebook/astryx/blob/b92b07613fbf941392a2138bd22b42c71e2707f0/LICENSE), [release](https://github.com/facebook/astryx/releases/tag/v0.5.4).

## Open proof gates

| Question                                             | Evidence needed                                                                 | Consequence of failure                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Can published controls support virtual header menus? | Anchoring, submenu, focus-return and unmount Browser regression                 | Adjust composition through supported APIs; do not silently introduce workaround |
| Can StyleX ship through both Vite+ paths?            | Demo dev/build and installed tarball CSS/type/SSR tests                         | Resolve build seam before styling port                                          |
| Can any Table primitives be reused safely?           | One scroll owner, correct DOM semantics, virtual coordinates and bounded mounts | Use grid-owned structural DOM with Astryx styling/components                    |
| Is full parity performant?                           | Same realistic two-axis/pinned/custom-renderer benchmarks                       | Optimize; never loosen workload/accounting/budget                               |
| What is the migration seed?                          | Explicit merged revision and reviewed-fix disposition                           | Do not import unreviewed release tooling by accident                            |

## Proposed sequence, not published tickets

1. Establish parity ledger and seed provenance; verify a minimal Astryx/Vite+ packed consumer.
2. Deliver read-only Client vertical slice: real rows, mandatory identities/order, one-scroll-owner two-axis virtualization, Astryx theme and one supported header menu.
3. Restore complete pinning/resize/reorder and keyboard/focus behavior, with performance evidence.
4. Restore filters/preferences and grouping in independently demoable slices.
5. Restore Server Viewport Source, lifecycle and grouped source behavior.
6. Restore Immediate/Batch editing, conflict reviews and live confirmation; split into small behavior-complete tickets.
7. Restore ranges, atomic copy/paste and drag fill against the new UI boundaries.
8. Close parity gaps, run accessibility/type/production performance gates, verify release tarballs and document upgrades.

Actual dependency edges need the chosen baseline/architecture and behavior inventory; this outline is intentionally not an approved ticket DAG.

## Decisions required before publication

- Repository visibility (private/public) and confirm owner `bmvantunes`.
- Full existing behavior parity as destination versus a smaller first product.
- One successor fork versus maintaining two actively shared renderers. Recommendation: successor with preserved provenance, not a premature public headless-core extraction.
- Public package/API branding: retain BrunoTable semantics or rename. Repository name alone does not decide this.
- Confirm highest-level test seam: public Client/Server components and installed package, retaining focused pure-domain tests and original performance protocol.

The requested grill-with-docs workflow should settle these decisions before to-spec synthesis. The requested to-tickets workflow requires approval of ticket granularity and blocking edges before GitHub publication. No change to the old tracker, issue #80, issue #96, or PR #100 is included here.
