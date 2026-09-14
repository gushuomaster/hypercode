# Phase 5A Execution Ledger

## C-009 — CLI branding resource

- Status: `PENDING`
- Candidate: `C-009`
- Worktree: `D:\project\hypercode\.worktrees\opencode-1.18.30-sync`
- Post-sync baseline: `0472ed06209bc24eb76508005b16737aa0d8638c`
- Pure upstream reference: `193de13a88d62a6409c6d385831180f1def527dc`
- Bun: `1.3.14`
- Lockfile/manifests: unchanged before this candidate

### Guardrails

- Centralize only user-visible CLI branding resources and equivalent hardcoded strings.
- Preserve internal `opencode` identifiers, compatibility filenames, protocol fields, provider IDs, and behavior.
- Do not modify frozen areas, tests, manifests, or `bun.lock`.
- Revert this candidate if a new failure appears or the baseline signature changes.

### Pre-change validation

- `packages/opencode bun typecheck`: F-013 only (`NpmTest.noop` / `Npm.Service.which`), matching the frozen baseline.
- CLI targeted tests (`test/cli/error.test.ts`, `test/cli/smokes/read-only.test.ts`): 13 pass / 0 fail.
- `bun src/index.ts --help`: exit 0; HyperCode wordmark and command descriptions present.

### Change record

- Reused the existing `Brand.product` and `Brand.command` values through the CLI UI module.
- Replaced equivalent product-name and command hardcodes in 9 CLI production files.
- Preserved compatibility identifiers (`opencode`, `opencode.json`, `OPENCODE_*`) and all command behavior.
- No tests, manifests, lockfiles, frozen areas, or dependency topology changed.

### Post-change validation

- `packages/opencode bun typecheck`: F-013 only; no new type errors.
- CLI targeted tests (`error`, read-only smokes, run entry body, serve process): 29 pass / 0 fail.
- `bun src/index.ts --help`: exit 0; output remains HyperCode-branded.
- OpenCode broad suite: 3606 pass / 58 skip / 1 todo / 8 fail. Six symlink failures and one help snapshot failure match baseline; one additional `Server.listen` timeout passed on immediate isolated rerun and is recorded as environment flake.

### Decision

- Status: `ACCEPTED_WITH_WARNINGS`
- Warning: broad suite had one transient timeout during the aggregate run; isolated rerun passed.
- Next candidate: do not start automatically; await Phase 5A continuation decision.
