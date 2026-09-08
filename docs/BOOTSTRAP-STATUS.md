# Bootstrap validation — 2026-09-08

This is a scaffold, not the grid implementation or an npm release. The user has
approved the specification, ticket dependencies and test boundaries, plus the
narrow StyleX lifecycle fix.

Verified locally:

- Locked install: Astryx 0.5.4, StyleX 0.19.0, Vite+ 0.2.8, bundled Vitest/Browser
  provider 4.1.10, Playwright 1.60.0 and React 19.2.8.
- Static formatting/lint and strict TypeScript.
- One Node contract test and two real Chromium tests: pointer/keyboard activation
  and compiled StyleX. These smoke tests do not prove grid accessibility or parity.
- Workbench application build and empty private library declarations/JavaScript.
  The empty library build does not prove StyleX library CSS distribution.

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
Three command-boundary tests additionally cover a clean exit, a zero exit with a
shutdown warning, and a descendant retaining inherited pipes. Deadline failure is
immediate and cleans up the owned process group/tree rather than only the launcher.

Remove the dependency patch after an upstream version passes the same regression
unpatched. Do not disable StyleX transformation or lower assertions to remove it.

## Remaining migration work

Audited core import/rename, the real renderer and all feature/performance parity
remain the linked migration tickets. No core source was silently copied from the
old dirty worktree or its unmerged follow-up. The old repository remains untouched.
