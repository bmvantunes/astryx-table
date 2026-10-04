# Native row-count controls

Inspected published Astryx Core 0.6.5 and the retained toolbar contract on
2026-10-04. These controls migrate optional Client toolbar capabilities; they do
not establish Server or grouping parity.

## Native presentation

Use published `Text` with `type="supporting"`, secondary color and tabular numbers
inside a named `<output role="status">`. The retained names are `Result rows` and
`Loaded rows`; default text preserves singular/plural. Custom
`children: (count: number) => ReactNode` renders directly inside the same semantic
wrapper. Text's `as` union does not include `output`, so no dependency extension is
necessary. With default `maxLines=0`, its truncation observer is inactive.

Sources: `node_modules/@astryxdesign/core/src/Text/Text.tsx`,
`src/Text/useTruncation.ts`, and `dist/Text/Text.d.ts` in that package;
`migration/table/src/internal/toolbar-capabilities.tsx`, lines 230–265 and 306–320.

The native Table row-status plugin is per-row presentation: `getStatus(row)` adds
a marker column. It does not supply result or loaded counts. TableFooter renders
`tfoot`, which does not fit optional toolbar placement. Badge could display a
number but imposes pill geometry and clipping; Text preserves the retained
presentation more closely.

Sources: Core `src/Table/plugins/rowStatus/useTableRowStatus.tsx`,
`src/Table/TableFooter.tsx`, and `src/Badge/Badge.tsx`.

## Authority and subscriptions

Result count belongs to the Client source adapter's filtered projection, never
the mounted row window. Preserve its lazy `initializeResultRowCount(query,
rowSpace)` before the initial snapshot, including SSR. Loaded count belongs to
runtime source metadata. Both existing publishers suppress unchanged numbers.

The private stable Client context carries only the three result-count methods
needed by the controls, alongside its existing capabilities. No extra adapter,
public controller, mirrored React state or local filtering implementation is
needed. Each control subscribes to its own numeric source. The existing test-only
toolbar instrumentation observes subscription lifecycle without changing policy.

Sources: `packages/table/src/internal/client-source-adapter.ts`, lines 264–327;
`packages/table/src/internal/grid-runtime.ts`, loaded-row snapshot/subscription;
`migration/reference/docs/adr/0006-compose-optional-toolbar-as-children.md`;
`migration/reference/docs/grid/public-api-design.md`, optional toolbar section.

## Verification scope

Public Browser and installed-package fixtures cover filtered versus loaded counts,
Quick Filter, live insertion, custom presentation, table scoping, invalid source
input, loading and coherent stale/error/closed restoration. Source diagnostics
also check unchanged-count value publications, callback replacement and cleanup.
SSR checks truthful initial filtering and one lazy initialization across duplicate
Result controls. Source and emitted declarations verify the numeric callback.

Production validation adds both counters to the unchanged 5,000 × 150, 20 Hz
publication workload. It checks zero count notifications and stable subscriptions
after warmup while preserving complete frame accounting and the 8.33 ms budget.
Server counts must later use source-authoritative generation-aware totals; loaded
slots are not a substitute. No upstream defect or new dependency patch was found.
