# Parity ledger

Every source-domain document and ADR is retained under `migration/reference`; its
byte hash and source identity are in the manifest. These are historical contracts,
reconciled by `MIGRATION.md`, `SPEC.md` and the following successor issue owners.
The numbered stories refer to `SPEC.md`. No renderer or release row is complete.

| Issue                                                       | Capability                                               | Stories    | Retained contract/evidence                                                                | Astryx status                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#3](https://github.com/bmvantunes/astryx-table/issues/3)   | Virtual read-only Client, identities and initial sorting | 1–6, 27–28 | architecture, public-api-design, react-compiler-boundaries                                | Read-only Client merged in #18; complete keyboard work remains #5                                                                                                                                                                                                              |
| [#4](https://github.com/bmvantunes/astryx-table/issues/4)   | Pinning, RTL, resize and reorder                         | 7–8        | ADRs 0004, 0025, 0029; column-management, grid-runtime, virtual-viewport                  | Pinning, resize and reorder implemented; publication and complete reveal proof pending                                                                                                                                                                                         |
| [#5](https://github.com/bmvantunes/astryx-table/issues/5)   | Keyboard and recycled focus                              | 9–10       | keyboard-navigation; focus-ownership, hotkey-adapter                                      | Native navigation slice in progress; full overlay/source matrix and publication pending                                                                                                                                                                                        |
| [#6](https://github.com/bmvantunes/astryx-table/issues/6)   | Filters, exact values and persisted preferences          | 3–4, 11–12 | ADRs 0008, 0010, 0027; value-semantics, filters, persistence                              | Native text/list, Boolean, Select, live Client Set, active-filter review, Quick Filter, compound editor, column preferences bounded sort controls and Client row-count controls implemented locally; numeric, Server facets, remaining status controls and publication pending |
| [#7](https://github.com/bmvantunes/astryx-table/issues/7)   | Read-only Client grouping                                | 13, 25     | client-grouping, client-grouping-presentation; ADR 0031                                   | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#9](https://github.com/bmvantunes/astryx-table/issues/9)   | Server viewport/source lifecycle                         | 15–16      | server-viewport-model; server-viewport-store, server-source-adapter                       | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#10](https://github.com/bmvantunes/astryx-table/issues/10) | Server filters and grouping                              | 14         | server-query, server-facet; ADR 0026                                                      | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#11](https://github.com/bmvantunes/astryx-table/issues/11) | Immediate editing and live confirmation                  | 17–18, 20  | editing-and-conflicts; cell-edit, save-operations, accepted-save-reconciliation           | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#12](https://github.com/bmvantunes/astryx-table/issues/12) | Batch history/conflicts and edit reviews                 | 19, 21     | ADRs 0022, 0023, 0028, 0032; edit-memory, client-edit-source                              | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#13](https://github.com/bmvantunes/astryx-table/issues/13) | Row/range selection and atomic copy                      | 22–23      | ADRs 0016, 0020, 0030; row-selection, cell-range-clipboard                                | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#14](https://github.com/bmvantunes/astryx-table/issues/14) | Atomic paste and repetition-only fill                    | 24         | ADRs 0017–0019, 0021; cell-paste, drag-fill                                               | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#15](https://github.com/bmvantunes/astryx-table/issues/15) | Themes, accessibility and custom renderers               | 25–26      | requirements; cell-presentation, public JSX and Browser suites                            | Pending renderer/package validation                                                                                                                                                                                                                                            |
| [#16](https://github.com/bmvantunes/astryx-table/issues/16) | Emitted package, optional Effect and performance         | 27–30      | benchmark-profile, RELEASE; production Browser suites, emitted consumers, release scripts | Pending renderer/package validation                                                                                                                                                                                                                                            |

Issue #2 owns import fidelity for every row: 302 retained files / 603 source
dispositions, 1,109 retained Node tests and all three source type-test files in the
pinned original-UI fixture. The direct successor core suite runs 1,066 of those
tests without legacy UI dependencies. These are overlapping counts, not additive.
46 successor Browser tests prove controls/workbench only.

## Retained test and benchmark inventory

All entries below remain hash-verified. “Fixture” means the complete pinned import
fixture, never a claim of Astryx renderer or installed-package compatibility.

| File                                                      | Current execution boundary                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `astryx-table-client.browser.test.tsx`                    | Pending migrated Browser/performance gate                                              |
| `astryx-table-client.test.tsx`                            | Fixture Node gate                                                                      |
| `astryx-table-server.browser.test.tsx`                    | Pending migrated Browser/performance gate                                              |
| `astryx-table-server.test.tsx`                            | Fixture Node gate                                                                      |
| `cell-edit.browser.test.tsx`                              | Pending migrated Browser/performance gate                                              |
| `cell-paste.browser.test.tsx`                             | Pending migrated Browser/performance gate                                              |
| `cell-range-clipboard.browser.test.tsx`                   | Pending migrated Browser/performance gate                                              |
| `client-grouping.browser.test.tsx`                        | Pending migrated Browser/performance gate                                              |
| `column-helpers.test.ts`                                  | Fixture Node gate                                                                      |
| `column-management.browser.test.tsx`                      | Pending migrated Browser/performance gate                                              |
| `drag-fill-acceptance.browser.test.tsx`                   | Pending migrated Browser/performance gate                                              |
| `drag-fill-performance.browser.test.tsx`                  | Pending migrated Browser/performance gate                                              |
| `drag-fill.browser.test.tsx`                              | Pending migrated Browser/performance gate                                              |
| `edit-memory.browser.test.tsx`                            | Pending migrated Browser/performance gate                                              |
| `edit-review-projected-row.browser.test.tsx`              | Pending migrated Browser/performance gate                                              |
| `effect.test-d.ts`                                        | Fixture source type gate                                                               |
| `effect.test.ts`                                          | Fixture Node gate                                                                      |
| `internal/accepted-save-reconciliation.test.ts`           | Fixture Node gate                                                                      |
| `internal/benchmark-budget.test.ts`                       | Fixture Node gate                                                                      |
| `internal/benchmark-profile.test.ts`                      | Fixture Node gate                                                                      |
| `internal/benchmark-runner.test.ts`                       | Fixture Node gate                                                                      |
| `internal/browser-test-helpers.test.ts`                   | Fixture Node gate                                                                      |
| `internal/cell-edit-traversal.bench.ts`                   | Pending migrated benchmark gate (#16)                                                  |
| `internal/cell-edit-traversal.test.ts`                    | Fixture Node gate                                                                      |
| `internal/cell-edit.test.ts`                              | Fixture Node gate                                                                      |
| `internal/cell-paste.test.ts`                             | Fixture Node gate                                                                      |
| `internal/cell-range-clipboard.bench.ts`                  | Pending migrated benchmark gate (#16)                                                  |
| `internal/cell-range-clipboard.test.ts`                   | Fixture Node gate                                                                      |
| `internal/cell-value.test.ts`                             | Fixture Node gate                                                                      |
| `internal/client-edit-source.test.ts`                     | Fixture Node gate                                                                      |
| `internal/client-facet.test.ts`                           | Activated engine + reviewed incremental projection; retained Node gate                 |
| `internal/client-grouping.bench.ts`                       | Pending migrated benchmark gate (#16)                                                  |
| `internal/client-grouping.test.ts`                        | Fixture Node gate                                                                      |
| `internal/client-projection.test.ts`                      | Fixture Node gate                                                                      |
| `internal/client-row-model.test.ts`                       | Fixture Node gate                                                                      |
| `internal/client-row-pipeline.test.ts`                    | Fixture Node gate                                                                      |
| `internal/client-source-adapter.bench.ts`                 | Pending migrated benchmark gate (#16)                                                  |
| `internal/column-geometry.test.ts`                        | Fixture Node gate                                                                      |
| `internal/column-gesture.test.ts`                         | Fixture Node gate                                                                      |
| `internal/column-management.bench.ts`                     | Pending migrated benchmark gate (#16)                                                  |
| `internal/column-management.test.ts`                      | Fixture Node gate                                                                      |
| `internal/compile-columns.test.ts`                        | Fixture Node gate                                                                      |
| `internal/drag-fill-chrome.browser.test.tsx`              | Pending migrated Browser/performance gate                                              |
| `internal/drag-fill-planner.bench.ts`                     | Pending migrated benchmark gate (#16)                                                  |
| `internal/drag-fill-planner.test.ts`                      | Fixture Node gate                                                                      |
| `internal/drag-fill.browser.test.tsx`                     | Pending migrated Browser/performance gate                                              |
| `internal/drag-fill.test.ts`                              | Fixture Node gate                                                                      |
| `internal/edit-memory.bench.ts`                           | Pending migrated benchmark gate (#16)                                                  |
| `internal/edit-memory.test.ts`                            | Fixture Node gate                                                                      |
| `internal/focus-ownership.test.ts`                        | Fixture Node gate                                                                      |
| `internal/grid-preferences.test.ts`                       | Fixture Node gate                                                                      |
| `internal/grid-runtime.test.ts`                           | Fixture Node gate                                                                      |
| `internal/grid-subscription-instrumentation.test.ts`      | Fixture Node gate                                                                      |
| `internal/hotkey-adapter.bench.ts`                        | Pending migrated benchmark gate (#16)                                                  |
| `internal/hotkey-adapter.browser.bench.tsx`               | Pending migrated Browser/performance gate                                              |
| `internal/hotkey-adapter.browser.test.tsx`                | Pending migrated Browser/performance gate                                              |
| `internal/hotkey-adapter.test.ts`                         | Fixture Node gate                                                                      |
| `internal/listener-registry.test.ts`                      | Fixture Node gate                                                                      |
| `internal/mounted-row-slots.test.ts`                      | Fixture Node gate                                                                      |
| `internal/navigation.test.ts`                             | Fixture Node gate                                                                      |
| `internal/quick-filter.test.ts`                           | Fixture Node gate                                                                      |
| `internal/react-compiler-contract.test.ts`                | Fixture Node gate                                                                      |
| `internal/render-instrumentation.test.ts`                 | Fixture Node gate                                                                      |
| `internal/row-selection.bench.ts`                         | Pending migrated benchmark gate (#16)                                                  |
| `internal/row-selection.test.ts`                          | Fixture Node gate                                                                      |
| `internal/save-operations.test.ts`                        | Fixture Node gate                                                                      |
| `internal/server-facet.test.ts`                           | Fixture Node gate                                                                      |
| `internal/server-query.test.ts`                           | Fixture Node gate                                                                      |
| `internal/server-source-adapter.test.ts`                  | Fixture Node gate                                                                      |
| `internal/server-viewport-store.bench.ts`                 | Pending migrated benchmark gate (#16)                                                  |
| `internal/server-viewport-store.test.ts`                  | Fixture Node gate                                                                      |
| `internal/set-value-identity.test.ts`                     | Fixture Node gate                                                                      |
| `internal/sorting.test.ts`                                | Fixture Node gate                                                                      |
| `internal/table-identity-registry.test.ts`                | Fixture Node gate                                                                      |
| `internal/toolbar-capabilities.bench.ts`                  | Pending migrated benchmark gate (#16)                                                  |
| `internal/value-semantics.test.ts`                        | Fixture Node gate                                                                      |
| `internal/virtual-viewport.test.ts`                       | Fixture Node gate                                                                      |
| `production-accessibility.performance.browser.test.tsx`   | Pending migrated Browser/performance gate                                              |
| `production-capabilities.performance.browser.test.tsx`    | Pending migrated Browser/performance gate                                              |
| `production-held-navigation.performance.browser.test.tsx` | Six native work/cadence scenarios implemented; clean publication pending               |
| `production-interactions.performance.browser.test.tsx`    | Pending migrated Browser/performance gate                                              |
| `production-server-workload.performance.browser.test.tsx` | Pending migrated Browser/performance gate                                              |
| `production-workload.performance.browser.test.tsx`        | Pending migrated Browser/performance gate                                              |
| `public-jsx.test-d.tsx`                                   | Fixture source type gate                                                               |
| `public-types.test-d.ts`                                  | Fixture source type gate                                                               |
| `row-selection.browser.test.tsx`                          | Pending migrated Browser/performance gate                                              |
| `sorting.browser.test.tsx`                                | Native sort controls and live-order regressions implemented; clean publication pending |

## Source-main reconciliation

The parity target includes merged source main
`00efa81616b2a999714db595fd1fec48caa55c58`, verified remotely on 2026-10-03.
[MIGRATION.md](MIGRATION.md#current-source-follow-up-ownership) assigns every
follow-up since the initial import, including #101–#111. Five active modules and
the Select helper/type contracts already consume those fixes. The old repository's
uncommitted work is preserved and is not treated as a reviewed baseline.
