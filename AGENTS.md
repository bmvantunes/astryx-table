# AstryxTable agent contract

## Scope and tracker

This is the standalone successor to BrunoTable, not a second skin in the old repo.
GitHub Issues at https://github.com/bmvantunes/astryx-table are authoritative.
Read docs/SPEC.md, docs/PROVENANCE.md and the relevant ticket before implementation.
Do not modify shadcn-table or its issues as part of this project.

## Technology and boundaries

- Use Vite+ (`vp`), strict TypeScript, React Compiler and Vitest Browser Mode.
- Use published Astryx component subpaths and StyleX; no Tailwind/Base UI/shadcn.
- Keep controls upstream-owned. Do not swizzle ordinary components by default.
- Public grid symbols use AstryxTable branding. No legacy aliases are required.
- Preserve proven domain/runtime logic; do not introduce a public shared-core
  abstraction just to support the old repository.
- Keep one two-axis native scroll owner, bounded mounted windows, fine-grained
  subscriptions, exact identities/value semantics and source-owned concurrency.
- Preserve 8.33 ms capable-hardware interaction budgets and complete accounting.
- Keep Effect optional for consumers. Retain TanStack-owned shortcuts and pacing.
- For any copied subsystem, import and reconcile its original domain docs and
  invariants before changing it. Never infer parity from a passing smoke test.

## Mechanical import review exemption

The user explicitly waived repeated reviewers for unchanged copied core plus
mechanical AstryxTable renaming. Record exact source commit, file hashes, rename
rules and exclusions. Verify transformed source and run retained tests/types.
This is not an exemption for bug fixes, behavior changes, rewritten adapters,
Astryx integration, package releases or weakening tests. Review those changes
independently; do not label them mechanical to bypass review.

For new behavior, use test-first changes, full relevant validation and independent
review before publication. Ask before implementing an upstream-library workaround.
Preserve unrelated user work. Do not publish npm packages without authorization.

## Validation

Run `vp install --frozen-lockfile`, `vp check`, `vp run typecheck`, `vp test --run`,
`vp run test:runner`, `vp run test:browser`, `vp build` and `vp pack` for the scaffold. Migrated features
must add retained source/emitted type tests, public Browser regression tests,
installed-tarball checks and unchanged production performance gates.
Use `vp env doctor` for environment problems; never silently loosen a gate.

Before substantial implementation, discover package skills with
`pnpm dlx @tanstack/intent@latest list` and load matching package guidance.
