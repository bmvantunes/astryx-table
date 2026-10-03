# AstryxTable

A standalone successor to [shadcn-table](https://github.com/bmvantunes/shadcn-table),
retaining its grid behavior while adopting published Astryx components and StyleX.
Independent project; not an official Meta product.

## Current status

The read-only Client implements exact column/value semantics, initial sorting,
two-axis virtualization, and published Astryx cells and column menus. Initial,
restored and menu-driven column pinning support LTR/RTL and narrow-layout suspension. The
workbench renders 10,000 rows. This is **not full parity or an npm release**.
The [parity ledger](docs/PARITY.md) tracks the remaining interactions and release gates.
This intermediate Client still rejects restored grouping explicitly;
Row Selection and group-row configuration are rejected by its public props. Their
implementations remain required in #7 and #13. Pointer and keyboard resize now use native Astryx handles; reorder remains in #4, and
complete keyboard navigation remains in #5. Shared column grouping/aggregation
metadata remains valid for raw read-only rendering. These temporary restrictions
are not reductions of the final parity target.
The package remains private; its provisional npm scope does not reserve or publish it.

The audited source and tests remain under `migration/`. Activated core modules have
separate byte-level provenance; new Astryx presentation receives independent review.
Astryx 0.6.5 controls use the [documented corrections](docs/MIGRATION.md).

## Develop

Development and test tooling supports macOS and Linux. The Browser validation
runner rejects other platforms before launching processes. This tooling policy
does not restrict the operating systems of consumers of the future React library.

Use Node 24.20.0 and pnpm 11.18.0 through Vite+:

```sh
vp install --frozen-lockfile
vp exec playwright install chromium
vp dev
vp check
vp run typecheck
vp test --run
vp run test:runner
vp run test:core
vp run verify:active-core
vp run test:active-core
vp run test:browser
vp run test:browser:performance
vp build
vp pack
vp run test:package
```

On Linux, use `vp exec playwright install --with-deps chromium` instead of the
browser-only install above. This also installs Chromium's system dependencies,
matching the Ubuntu CI setup; installing system packages may require sudo.

`vp build` builds the workbench; `vp pack` emits the library JavaScript, declarations
and `dist/assets/stylex.css`. Consumers explicitly import
`@bmvantunes/astryx-table/styles.css` after Astryx's reset, component and theme CSS.
`test:package` installs a real tarball into a temporary project and checks declarations,
styles and menu behavior without StyleX/Compiler plugins or Effect. It prints the
fixture path for inspection and never publishes to npm.

Browser tests cover controls and the new Client through its public API. The retained
production performance profiles remain a separate gate; bounded DOM tests do not
prove the 8.33 ms p99 target. The current raw Client has its own production gate
for two-axis scrolling/custom rendering and 20 Hz live publications, using the
unchanged capable-hardware protocol; later capabilities still require their own
retained scenarios. To re-prove the original import, run
`vp run test:import /path/to/shadcn-table`. See [verification boundaries](docs/MIGRATION.md).

## Plan

See [migration specification](docs/SPEC.md), [ticket draft](docs/TICKETS.md),
[source investigation](docs/INVESTIGATION.md), and [provenance](docs/PROVENANCE.md).
The public API will use `AstryxTableClient`, `AstryxTableServer` and the
`AstryxTable` prefix throughout. Full existing feature parity is the destination.
The old repository is not modified or retired by this scaffold.

Ordinary controls come from npm. No shadcn, Base UI or Tailwind dependency is
installed in the successor workspace. Controls remain npm dependencies with
version-pinned patches; these patches require a distribution decision before release.

## Performance evidence before integration

The standard GitHub runner cannot satisfy the retained eight-processor performance
profile. CI therefore requires an owner-authored report from a capable host for
the exact pushed or merged commit, verifies the linked report and rejects missing,
stale, incomplete or failed evidence. It never substitutes a weaker timing profile.

After the local review gate passes, commit the changes, run
`vp run test:browser:performance` from the clean commit, push/open the PR, then run
`vp run publish:performance-evidence <PR number>`. The command validates and links
the complete report before publishing the GitHub status. Repeat for a merge commit
when main receives its new SHA. This publishes verification evidence only, not npm.
The performance command must run alone under the retained host protocol in
[migration/reference/docs/grid/benchmark-profile.md](migration/reference/docs/grid/benchmark-profile.md).
