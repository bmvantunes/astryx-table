# Audited import and control foundation

This checkpoint implements the non-shipping migration baseline in issue #2 and
integrates the user-approved Astryx 0.6.5 corrections. The public library entry is
still empty. It does not claim completion of the Client renderer (#3), any later
feature, or the release gate (#16).

## Source and transformations

The sole source is merged commit
`431aa4013db89bb8d803e8b7cff005d8375b9cdf` of
[bmvantunes/shadcn-table](https://github.com/bmvantunes/shadcn-table/tree/431aa4013db89bb8d803e8b7cff005d8375b9cdf).
No dirty working-tree files or unmerged PR #100 implementation were copied.
`migration/manifest.json` records all 603 source tree entries, including exclusions,
Git modes/blob identities, source SHA-256 hashes and retained target SHA-256 hashes.
302 files are retained.

Only `packages/table/src` receives these ordered, case-sensitive literal
replacements, in both contents and filenames:

| Original      | Successor      |
| ------------- | -------------- |
| `BrunoTable`  | `AstryxTable`  |
| `brunoTable`  | `astryxTable`  |
| `bruno-table` | `astryx-table` |
| `BRUNO_TABLE` | `ASTRYX_TABLE` |

Other retained files are byte-identical reference material. Executable/configuration
reference files carry a `.reference` suffix so tools cannot discover them as active
project configuration. Original copyright, notices, source-domain documentation,
ADRs, benchmarks and release tests remain available. `@bruno/table` imports inside
archived consumer tests and historical repository URLs are intentionally retained.
They are not successor package exports.

Run `vp run verify:import /path/to/shadcn-table` to verify every origin blob and the
complete deterministic transform. Without a source checkout the command checks
only retained inventory and hashes. Added, deleted or edited retained files fail.
The immutable tree is excluded from formatting/lint rewriting; it is not exempt
from hash verification or the retained test gates. CodeRabbit uses the same
user-approved exemption for `migration/table/**` and `migration/reference/**` to
keep the review within its file limit; it still reviews the manifest, verifier,
patches, integration code and CI. Semantic changes must live outside this frozen
archive and receive a full review.

## Ownership and persistence reconciliation

`migration/table` is quarantined from the application, package exports, package
build, and production dependency graph. It may contain old renderer imports as
per issue #2's temporary non-shipping renderer allowance. No legacy UI dependency
is installed into the successor workspace. Imported descriptions requiring
Base UI controls or Tailwind are historical: the successor requires published
Astryx controls and StyleX, as specified in `SPEC.md`.

The new brand changes internal DOM attributes, diagnostics and reserved system
identities. There is no automatic import of BrunoTable persisted preferences.
Applications must treat AstryxTable preferences as a separate namespace until an
explicit migration is designed and tested. Stable consumer column and row IDs,
exact value semantics, and versioned sanitized user-only preferences remain required.
See `PARITY.md` for the feature owners and evidence still required.

## Known follow-up disposition

[PR #100](https://github.com/bmvantunes/shadcn-table/pull/100) remains excluded.
Its known changes/findings have explicit owners:

| Finding/change                                       | Disposition                                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deleted files survive release snapshot cloning       | #16: rebuild release capture against the final successor tree; do not execute archived release scripts. The import verifier rejects missing/extra files and its verification fixture starts from an empty directory. |
| `GIT_*` overrides contaminate source capture         | Import Git commands scrub those variables. #16 must prove this again for release capture.                                                                                                                            |
| Executable modes missing from source identity        | Import records the exact Git mode. Reference copies are inert data, not a released build snapshot. #16 must hash and verify final release modes.                                                                     |
| Missing provenance/failure command logs              | New import fixture prints each executed command and fails on nonzero status. #16 still owns the complete release evidence/failure artifact contract.                                                                 |
| Menu final focus steals deliberately moved focus     | #3/#5: prove published Astryx menu focus with the new renderer; do not transplant the Base UI workaround. Selector focus correction and control regressions are included here.                                       |
| Dirty-remap benchmark callback missing `async`       | #16: explicitly repair/review this before running the migrated performance gate. The archived baseline is not performance certification.                                                                             |
| Grouping/browser assertion and package-skill changes | #7/#15/#16: reconcile against Astryx markup, accessibility and emitted package; not silently copied or treated as passed.                                                                                            |

## Verification boundaries

- `vp run test:core`: presentation-independent retained Node contracts run directly
  from the immutable renamed source with the original dependency versions.
- `vp run test:import /path/to/shadcn-table`: creates a disposable archive of the
  pinned source, installs its frozen dependencies and builds its original UI types.
  Replaces the entire table source with the verified renamed tree, updates fixture
  compiler defines, then runs all retained source type and Node tests. This proves
  import fidelity against original UI contracts; it does **not** prove Astryx UI,
  emitted successor types or installed successor behavior. The fixture is outside
  the successor workspace and its location is printed for diagnosis.
- `vp run test:browser`: real successor StyleX/React Compiler control regressions
  and workbench tests. Not a grid/browser parity gate yet.
- Source layout/Compiler, benchmark-runner, Server facet and Client/Server SSR
  contracts depend on the original workspace/UI and run in the import fixture,
  not the direct core runner. Browser and performance files remain in the ledger
  pending their respective Astryx slices; no old assertion was weakened.

## Astryx corrections

Core and neutral theme are pinned to 0.6.5. The approved pnpm patch changes six
upstream source modules (+81/-29), together with their shipped JS/declarations:
TextInput native props; Selector focus return; Toast cancellation/lifecycle; and
Dialog/focus-trap containment and restoration. Regression cases run against the
installed patched package, including StrictMode, nested dialogs and startup toast
cancellation. A further review regression proves that a nested Popover owns
forward/reverse Tab and one Escape before its host Dialog. The original unpatched experiment had 31/42 passing cases; the patched
experiment passed 42/42. The project adds that Popover regression and retains its two workbench Browser
cases, plus a public Selector-to-Dialog synchronous focus-transfer regression,
for 46 Browser cases in total.

No upstream issue/PR or npm publication is part of this change. A pnpm installation
patch does not propagate to consumers of a published grid. #16 must settle and
verify that distribution boundary before releasing any dependent renderer. Remove
patches only after the same regressions pass against an unpatched upstream version.
