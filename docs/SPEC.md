# AstryxTable full-parity successor

Status: approved for ticket publication by the user on 2026-09-08. Repository: https://github.com/bmvantunes/astryx-table.

## Problem Statement

The current grid has valuable, tested domain and interaction behavior, but its shadcn/Base UI/Tailwind presentation entails local ownership of generic UI source. The user wants a standalone Astryx/StyleX successor with the same features, strong typing and performance, retaining Vite+.

## Solution

Port the proven grid, not Astryx's ordinary Table engine. Consume maintained Astryx controls and themes from npm. Mechanically rename public grid symbols to AstryxTable. Preserve source provenance, domain invariants and verification evidence; replace presentation-bound code and re-prove changed integrations.

## User Stories

1. As a grid consumer or user, I want to install a normal npm package rather than own copied buttons, fields, menus and dialogs, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
2. As a grid consumer or user, I want to use AstryxTableClient and AstryxTableServer with precise, distinct TypeScript contracts, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
3. As a grid consumer or user, I want to reuse explicit column identities, helpers and presets without losing field/value inference, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
4. As a grid consumer or user, I want to render number, bigint and optional BigDecimal without lossy coercion, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
5. As a grid consumer or user, I want to use a single continuous virtual row space, not pagination, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
6. As a grid consumer or user, I want to scroll large row and column sets with bounded mounted DOM and no root rerender per frame, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
7. As a grid consumer or user, I want to pin start/end columns with coherent RTL geometry and narrow-viewport suspension, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
8. As a grid consumer or user, I want to resize and reorder columns while retaining stable identities and committed preferences, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
9. As a grid consumer or user, I want to navigate headers and body as one keyboard space, with correct virtual focus restoration, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
10. As a grid consumer or user, I want to open menus, submenus, popovers and dialogs by keyboard or pointer without losing focus, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
11. As a grid consumer or user, I want to filter and sort exact values with non-empty normal sorting and half-open numeric ranges, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
12. As a grid consumer or user, I want to restore only versioned, sanitized preferences, never transient selection or scroll state, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
13. As a grid consumer or user, I want to group and aggregate read-only Client rows without inventing raw rows for presentation callbacks, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
14. As a grid consumer or user, I want to consume Server grouping, aggregation and authoritative row keys from the Viewport Source, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
15. As a grid consumer or user, I want to retain same-generation viewport overlap and reject stale query-generation deliveries, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
16. As a grid consumer or user, I want to see source-owned loading/stale/error/closed states and an optional source-owned Retry command, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
17. As a grid consumer or user, I want to edit eligible Client cells through explicit capability policies, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
18. As a grid consumer or user, I want to save Immediate gestures as non-empty row-grouped compare-and-set changes, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
19. As a grid consumer or user, I want to collect Batch drafts, undo/redo sparse commands and resolve conflicts against live canonical data, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
20. As a grid consumer or user, I want to retain Accepted Overlays until source reconciliation rather than assume promise resolution is canonical, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
21. As a grid consumer or user, I want to use a persistent compact edit footer and on-demand reviews without a permanent ledger, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
22. As a grid consumer or user, I want to select raw Client rows without leaking dormant selection into grouped views, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
23. As a grid consumer or user, I want to select identity-stable linear cell ranges and copy from one immutable canonical snapshot, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
24. As a grid consumer or user, I want to paste and drag-fill atomically with one save operation per admitted Immediate gesture, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
25. As a grid consumer or user, I want to customize raw/group/aggregate cell presentation without corrupting value semantics, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
26. As a grid consumer or user, I want to use accessible labels, announcements, reduced motion, themes and RTL across workflows, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
27. As a grid consumer or user, I want to use React Compiler and fine-grained subscriptions without making Effect mandatory, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
28. As a grid consumer or user, I want to install emitted JavaScript, CSS and declarations without compiling library source, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
29. As a grid consumer or user, I want to upgrade the underlying design system through package updates rather than maintain a fork, so that the successor preserves the existing contract without owning unrelated UI infrastructure.
30. As a grid consumer or user, I want to trust unchanged 120 Hz performance gates and a verified release, not merely a successful bundle, so that the successor preserves the existing contract without owning unrelated UI infrastructure.

## Implementation Decisions

- Standalone successor; no dual-skin maintenance framework or premature public headless-core extraction.
- New API prefix AstryxTable, including Client/Server variants and all grid-owned public helpers/types. No legacy aliases required.
- A pinned merged source revision is the import baseline, with explicit disposition of known follow-up findings. Preserve attribution. Record deterministic transformations; do not blindly alter historical URLs or upstream symbols.
- Existing core and its tests are reuse candidates, not exempt from regression testing. User waived repeated reviewers only for verified unchanged copy plus mechanical rename. Changed behavior and UI integration require fresh review.
- Preserve mandatory table/column identities, Client raw-row identity and Server source-owned identity, strict editing/read-only discrimination, mandatory non-empty sorting and exact value domains.
- Retain authoritative source generations/versions, atomic clipboard and edit gestures, sparse histories, overlays and conflict evidence. Keep Effect optional and View Server first-party semantics intact.
- Retain one scroll owner, segmented logical rowspace, virtual center columns, mounted sticky partitions and suspension behavior. Astryx sticky plugins are not equivalent and must not become a second authority.
- Keep TanStack Table v9, Store, Hotkeys and Pacer ownership and private XState workflows unless a separately approved decision changes them.
- Generic controls remain upstream npm dependencies. Do not bring Base UI-specific trigger workarounds into Astryx automatically or swizzle controls by default.
- Use Vite+ for dev/build/check/test/pack, React Compiler, StyleX for owned presentation and published Astryx CSS/theme entry points. Independently prove application and library CSS paths.
- Keep package private/non-publishable during bootstrap. Final npm scope, release credentials and publication require a release decision.
- Import and reconcile the original domain docs, ADRs, all feature specifications and test/benchmark inventory into a parity ledger; every requirement receives an owner and evidence, including grouped view transitions, narrow pinning and exact numeric exchange.

## Testing Decisions

Use public Client/Server components and installed-package consumers as the highest behavioral seams. Retain pure-domain and type-level tests where they prove exactness or inference. Avoid tests coupled to Base UI DOM structure; preserve their user-facing assertions. Test keyboard/pointer focus ownership, virtual unmount, nested Escape, RTL, reduced motion, source races and atomic edits through real Browser Mode.

Preserve production profiling, mounted-window constraints, realistic workloads, minimum sample counts and complete accounting. The capable-hardware p99 budget remains 8.33 ms; separate presentation cadence from grid work. CI smoke tests do not prove this budget. Emit/import CSS/types and verify SSR/hydration and optional-Effect consumers from the actual tarball before release.

## Out of Scope

Retiring/deleting the old repository, publishing npm immediately, expanding feature scope, adopting Astryx's Table as an unverified grid engine, vendoring ordinary controls, maintaining compatibility aliases, or modifying shadcn-table issues #80/#96 and its pending PR.

## Further Notes

The bootstrap has a real styled Astryx interaction workbench and an empty private library entry, not a migrated grid. The first ticket establishes audited import evidence. Large mechanical changes may use one isolated integration branch; do not pretend every intermediate partial rename is independently publishable. Once baseline import is verified, each UI slice must be independently demoable and tested.
