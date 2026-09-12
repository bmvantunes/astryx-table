# Bootstrap validation — 2026-09-12

This is a scaffold, not the grid implementation or an npm release. The user has
approved the specification, ticket dependencies and test boundaries, plus the
narrow StyleX lifecycle fix.

Verified locally:

- Locked install: Astryx Core and neutral theme 0.6.0, StyleX 0.19.0, Vite+ 0.2.8, bundled Vitest/Browser
  provider 4.1.10, Playwright 1.60.0 and React 19.2.8.
- Static formatting/lint and strict TypeScript.
- Five Node contract tests and two real Chromium tests: pointer/keyboard activation
  and compiled StyleX. These smoke tests do not prove grid accessibility or parity.
- Workbench application build and empty private library declarations/JavaScript.
  The empty library build does not prove StyleX library CSS distribution.

This snapshot supersedes the September 8 validation against Astryx 0.5.4.
The 0.6.0 snapshot includes the frozen install, `vp check`, `vp run typecheck`,
`vp test --run`, all eight `vp run test:runner` cases, `vp run test:browser`,
`vp build`, and `vp pack`. It is bootstrap evidence only; the separate migration
worktree's component probes and incomplete grid implementation are not covered.

## Approved lifecycle patch

`@stylexjs/unplugin@0.19.0` starts a CSS-update interval in `configureServer` but
originally clears it only on HTTP-server close. Vitest's middleware-mode server
can have no HTTP server. The pinned pnpm patch clears the plugin-owned interval
in `closeBundle`, also clearing a previous interval before server reconfiguration.
Both published ESM and CommonJS Vite adapters receive the same small change.
No global timers are patched, and style transformation/injection is unchanged.

Red: the real Browser command passed two assertions but reported a 10-second
shutdown timeout; the command-level regression rejected that result.
Green: the same Browser command and assertions completed without the warning.
The wrapper treats nonzero exit, process error, a 120-second deadline, or a shutdown
warning as failure. It never converts a timeout into success.
Eight command-boundary tests cover a clean exit, a zero exit with a shutdown warning,
a descendant retaining inherited pipes, a slow shared output sink, split/interleaved
and long warning lines, an output sink that never drains, and SIGINT/SIGTERM cancellation. Warning recognition
retains only a short suffix and line state per stream, not the complete output.
Both child streams pause while the shared sink is blocked. Deadline failure is
immediate and cleans up the owned process group/tree rather than only the launcher.
Cancellation uses the same cleanup; signal listeners are removed when the run ends.
The two cancellation regressions failed before this change and now pass. All eight
scaffold validation commands passed after the cancellation fix, including five Node
tests, eight runner tests and two Chromium tests. Independent review must be repeated
for this updated diff before publication.

Remove the dependency patch after an upstream version passes the same regression
unpatched. Do not disable StyleX transformation or lower assertions to remove it.

## Remaining migration work

Audited core import/rename, the real renderer and all feature/performance parity
remain the linked migration tickets. No core source was silently copied from the
old dirty worktree or its unmerged follow-up. The old repository remains untouched.
