# Provenance and import policy

The source project is https://github.com/bmvantunes/shadcn-table.
The currently verified merged main baseline is
`431aa4013db89bb8d803e8b7cff005d8375b9cdf`.
Research also inspected unmerged follow-up `d99924b8f6205c2845cd127f3bc662157aa71354`
(PR #100). Do not treat that follow-up as reviewed-clean or silently import it.
The import ticket must resolve applicable known findings explicitly and record
which baseline/fixes were selected. Full parity is not permission to preserve known defects.

No core source has been copied by the bootstrap. The strict React Compiler
settings and Vite+ tool versions are informed by the source project's configuration.

The mechanical import will retain original copyright/notices and record source
hashes, target hashes, inclusion/exclusion lists and a deterministic rename map.
Rename BrunoTable public symbols to AstryxTable; distinguish internal identifiers,
CSS/data attributes, persistence keys, documentation links and historical provenance.
Do not blindly rewrite upstream package names or historical URLs. Explicitly decide
whether persisted preferences need a migration; a new package name does not settle it.

Astryx is consumed from npm at 0.6.0, corresponding to release commit
`1e63a5144bdf4777081edee472089277aceb5d75` in facebook/astryx. Its published license is
MIT. No upstream component implementation is copied into this scaffold.

The original research report is retained with its dated findings. Subsequent user
decisions supersede its open questions: public repository, full-parity standalone
successor, AstryxTable naming, Vite+, published controls and a mechanical-core-only
review exemption.
