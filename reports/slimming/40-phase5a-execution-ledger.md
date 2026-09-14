# Phase 5A Execution Ledger

## C-009 — CLI branding resource

- Status: `ACCEPTED_WITH_WARNINGS`
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

## C-001 — Env flag aliases

- Status: `PENDING`
- Candidate: `C-001`
- Worktree: `D:\project\hypercode\.worktrees\opencode-1.18.30-sync`
- Current HEAD: `f13c32d54`
- Post-sync baseline: `0472ed06209bc24eb76508005b16737aa0d8638c`
- Pure upstream reference: `193de13a88d62a6409c6d385831180f1def527dc`
- Bun: `1.3.14`
- Lockfile/manifests: unchanged before this candidate
- EXPECTED_FILES (production): `packages/core/src/flag/env.ts`, `packages/core/src/flag/flag.ts`, `packages/opencode/src/effect/runtime-flags.ts`
- EXPECTED_FILES (tests): `packages/core/test/flag/flag.test.ts`, `packages/opencode/test/effect/runtime-flags.test.ts`

### Guardrails

- Share only the `OPENCODE_*` → `HYPERCODE_*` name mapping; preserve HYPERCODE-first precedence.
- Preserve all existing flag values, defaults, initialization timing, and ConfigProvider behavior.
- Do not remove the `OPENCODE_*` aliases or rename public flag fields.
- Do not modify frozen areas, manifests, or `bun.lock`.
- Revert this candidate if precedence, consumer behavior, or baseline failure signatures change.

### Pre-change validation

- `packages/opencode bun test test/effect/runtime-flags.test.ts`: 36 pass / 0 fail.
- `packages/core bun typecheck`: PASS.
- `packages/opencode bun typecheck`: F-013 only (`NpmTest.noop` / `Npm.Service.which`).

### Planned post-change validation

- Alias precedence characterization in Core and RuntimeFlags tests.
- Core and OpenCode typecheck with F-013 comparison.
- RuntimeFlags targeted suite and affected Core flag tests.
- Baseline regression signature comparison; no dependency or lockfile changes.

### Post-change validation

- Core alias tests (`test/flag/flag.test.ts`): 2 pass / 0 fail.
- RuntimeFlags targeted suite: 38 pass / 0 fail.
- Affected Core consumers (`watcher`, `instruction-context`): 12 pass / 1 skip / 0 fail.
- `packages/core bun typecheck`: PASS.
- `packages/opencode bun typecheck`: F-013 only; no new type errors.
- Core broad suite: 1091 pass / 7 skip / 4 fail. The four failure signatures match the existing Windows baseline (Npm timeout, Git Bash shell selection, legacy config fixture, and quoted `echo` output).
- OpenCode broad suite: 3604 pass / 58 skip / 1 todo / 12 fail / 1 error. Six symlink failures and the help snapshot remain known; isolated reruns passed for the HEAD request, snapshot race, and snapshot isolation timeout cases. Two revert/compact timeout cases remain unrelated to alias code and require separate environment investigation.
- `git diff --check`: PASS. `bun.lock` and package manifests unchanged.

### Decision

- Status: `ACCEPTED_WITH_WARNINGS`
- Fork reduction: the alias-name mapping is implemented once in `packages/core/src/flag/env.ts`; both Core process-env reads and OpenCode ConfigProvider reads now share HYPERCODE-first ordering.
- Modified upstream production files: `2 → 2`; one shared helper added; no core patch count change (`55`).
- New alias-related failures: `0`.
- Warning: aggregate OpenCode timeout variance is retained as an environment/dirty-worktree issue and is not attributed to `C-001`.
