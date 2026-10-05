# Exact numeric filter controls

Investigated 2026-10-04 against installed Astryx Core 0.6.5, React DOM 19.2.8 and
oxc-transform-react 0.145.0. The user explicitly authorized local upstream fixes.

## Astryx TextInput

The [source](../../node_modules/@astryxdesign/core/src/TextInput/TextInput.tsx)
and [emitted declarations](../../node_modules/@astryxdesign/core/dist/TextInput/TextInput.d.ts)
omitted `number` from TextInputType and omitted `step`, although the
[runtime](../../node_modules/@astryxdesign/core/dist/TextInput/TextInput.js) forwards
both to its native input. The versioned Core patch extends these two declarations
in both files. It does not alter runtime input behavior.

The positive source type fixture and Browser test reproduce the declaration error
before patching and exercise native fractional input, step and change-event identity.
Native badInput remains distinct from an empty draft. The existing nullable Clear
event mismatch remains separately recorded as ASTRYX-006.

[NumberInput](../../node_modules/@astryxdesign/core/src/NumberInput/NumberInput.tsx)
owns a number-valued draft/commit workflow, committing its parsed draft on blur or
Enter and handling stepping itself. This is not equivalent to the retained 150 ms
continuously validated filter draft, and cannot represent exact bigint/BigDecimal.
This mismatch is not a defect in NumberInput's own contract.

## React development diagnostics

Both [client](../../node_modules/react-dom/cjs/react-dom-client.development.js)
and [profiling](../../node_modules/react-dom/cjs/react-dom-profiling.development.js)
development builds classify bigint arrays as primitive, then pass them to plain
JSON.stringify in addValueToProperties. The public React-only Browser regression
introduces a bigint-array prop and fails with an unhandled diagnostic exception
before patching, even though its visible value assertion passes.

The versioned React patch changes only these diagnostic stringifications, rendering
bigint as decimal text with an `n` suffix. It changes neither the values passed to
components nor JSON globally, canonical operands, persistence codecs or production
builds. Verify both development paths and byte-identical production files.

## Separate compiler defect

The installed [transform API](../../node_modules/oxc-transform-react/index.d.ts),
using the project's infer/all_errors/target-19 compiler options, transforms bigint
literals inside a component's useState and state-setting callback to undefined,
without errors or a fatal result. Disabling React Compiler in the isolated
comparison preserves them. The cause and smallest safe compiler repair are still
unverified; neither patch above fixes this defect.

The React regression receives bigint data from outside the compiled component to
isolate the diagnostic problem. This is a test boundary, not a compiler workaround
or evidence that bigint literals are safe throughout compiled application code.

The same defect is tracked in [Oxc issue #26161](https://github.com/oxc-project/oxc/issues/26161).
The [0.145 lowering implementation](https://github.com/oxc-project/oxc/blob/crates_v0.145.0/crates/oxc_react_compiler/src/react_compiler_lowering/build_hir.rs#L3541)
omits BigIntLiteral and falls through to PrimitiveValue::Undefined. The latest
inspected [0.152 release source](https://github.com/oxc-project/oxc/blob/dfbc0d1ea752f021ba4a68e4703b3a9031082a46/crates/oxc_react_compiler/src/react_compiler_lowering/build_hir.rs#L4292)
still has that omission. An upgrade alone is not a verified repair.

[PR #26587](https://github.com/oxc-project/oxc/pull/26587) was open and unmerged
when inspected, at `1ecf3acfa23ef64fae8e32b85291556af6367408`. It adds native HIR,
lowering and code generation, but its
[constant folding](https://github.com/oxc-project/oxc/blob/1ecf3acfa23ef64fae8e32b85291556af6367408/crates/oxc_react_compiler/src/react_compiler_optimization/constant_propagation.rs#L815)
also admits bigint without mixed bigint/number/string abstract-equality cases.
Source inspection indicates a risk of incorrectly folding `1n == 1`; this candidate
has not been built or executed here. Do not adopt it without equivalence tests.

A possible native backport would preserve bigint HIR/codegen while declining
unproven bigint constant folding, audit all primitive consumers, and rebuild pinned
bindings reproducibly for supported platforms. That is separate toolchain work.
Required equivalence coverage includes literal bases, negative/large values,
arithmetic, comparisons, mixed-domain errors, truthiness, templates, keys, hooks,
callbacks and memoization under development and production. No compiler repair is
included in the two dependency corrections documented here.

### Executed compiler integration follow-up

The [official Vite integration](https://react.dev/learn/react-compiler/installation#vite)
supports `@rolldown/plugin-babel` and plugin-react's `reactCompilerPreset`, retaining
ordinary React JSX/Refresh handling. Both application and library factories now
use this path, with the compiler before StyleX. The existing `infer`, `all_errors`
and target-19 policy and source exclusions remain unchanged.

The first executed trial disproved an unpatched replacement: stable
`babel-plugin-react-compiler@1.0.0` rejects BigIntLiteral under `all_errors`.
Unlike Oxc's silent corruption, it fails the build. The registry still lists 1.0.0
as latest stable. The pinned local patch adds five exact boundaries:

- Literal lowering into a native bigint Primitive value.
- Code generation into a bigint literal, with unary minus for negative values.
- Exact decimal property-key lowering for ordinary/computed bigint literal keys.
- Safe bigint diagnostic printing.
- The matching public HIR Primitive type union.

The patch changes no arithmetic optimizer. Existing number-only arithmetic guards
leave bigint operations in emitted JavaScript; native equality folding preserves
mixed-domain behavior. Template folding excludes bigint and also leaves it at runtime.
No global constructor substitution, number conversion, compiler opt-out or relaxed
error threshold is involved. This patch is a local compatibility extension, not a
claim that upstream Babel already supports these literals.

`NumericProbe` initially reproduced missing/NaN values in Browser and the emitted
library. With the patch, the Browser interaction and both actual app/pack builds
preserve values, callbacks, memoization imports, source maps and extracted StyleX.
A separate public compiler-API equivalence suite compares compiled hooks against
native JavaScript, including exact object keys and native TypeError/RangeError cases.

Full-project compilation also exposed stable compiler limitations around optional
calls inside try/catch, a nested ternary and an empty-label fallback in try/catch.
The pointer-capture, document-target and label expressions are written equivalently
without those unsupported expression forms. No module was excluded from compilation.
Full regression, installed-consumer, independent-review and performance completion
remain required before adopting this integration.

The earlier isolated compiler branch passed its 346-case Browser suite. A real development-server check
also preserves the updated exact bigint state across a component hot update, with
no page errors. Its first trial used `test-results`, which Vite explicitly ignores
for file watching; repeating in an ordinary watched temporary directory succeeds.
This was a verification setup correction, not a Fast Refresh defect. The obsolete
direct Oxc compiler dependency is removed; runtime consumers receive compiled output.

## Integration contract

Reuse the current compound/list/session editor rather than restoring its old stash.
The [retained numeric editor](../../migration/table/src/internal/client-filter.tsx)
and [requirements](../../migration/reference/docs/grid/requirements.md) require:

- Native number input with step any, native badInput checks and semantic parsing.
- Text input and exact parsers for bigint and optional BigDecimal.
- Native exact operands, nonempty lists and strictly ordered half-open ranges.
- Invalid whole expressions remain local without query or persistence publication.
- Continuous changes use 150 ms Pacer; valid discrete changes publish immediately.
- Exact tagged persistence, bounded operand windows and composition cancellation.

Coverage must include source/emitted types, Browser controls, Client and Server
publication isolation, installed consumers and production performance. The root
package must remain usable without Effect. No numeric parity claim follows solely
from these dependency patches.
