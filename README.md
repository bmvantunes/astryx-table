# AstryxTable

A standalone successor to [shadcn-table](https://github.com/bmvantunes/shadcn-table),
retaining its grid behavior while adopting published Astryx components and StyleX.
Independent project; not an official Meta product.

## Current status

This is the migration scaffold, **not a working grid or an npm release**.
It includes Vite+, strict TypeScript, React Compiler, StyleX, published Astryx UI,
Vitest Node tests, and real Chromium Browser Mode tests. The library workspace is
deliberately private and empty until the audited import. Its provisional npm scope
does not reserve or publish a package.

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
vp run test:browser
vp build
vp pack
```

On Linux, use `vp exec playwright install --with-deps chromium` instead of the
browser-only install above. This also installs Chromium's system dependencies,
matching the Ubuntu CI setup; installing system packages may require sudo.

`vp build` builds the workbench; `vp pack` checks the library packaging baseline.
The empty package build is not proof of grid CSS distribution or consumer parity.
Browser smoke tests verify pointer/keyboard activation and compiled StyleX in an
actual browser, not jsdom. Production grid performance tests arrive with migration.

## Plan

See [migration specification](docs/SPEC.md), [ticket draft](docs/TICKETS.md),
[source investigation](docs/INVESTIGATION.md), and [provenance](docs/PROVENANCE.md).
The public API will use `AstryxTableClient`, `AstryxTableServer` and the
`AstryxTable` prefix throughout. Full existing feature parity is the destination.
The old repository is not modified or retired by this scaffold.

Ordinary controls come from npm. No shadcn, Base UI or Tailwind dependency is
installed, and no upstream Button/Dialog source is vendored.
