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

## C-002 — Bundled config bootstrap (Fresh-Home Preflight)

- Status: `ACCEPTED_WITH_WARNINGS`
- Candidate: `C-002`
- Preflight: `C002_READY_WITH_GUARDRAILS`; implementation batch authorized
- Worktree: `D:\project\hypercode\.worktrees\opencode-1.18.30-sync`
- `C002_PRECHECK_HEAD`: `17dacc3651518c01a45605f5d5855d3288e69811`
- Bun: `1.3.14 (0d9b296a)`
- Report: `reports/slimming/46-c002-fresh-home-validation.md`

### Implementation batch

- Current HEAD before change: `17dacc3651518c01a45605f5d5855d3288e69811`
- Objective: config bootstrap extraction/deduplication only
- EXPECTED_PRODUCTION_FILES: `packages/opencode/src/config/config.ts`
- EXPECTED_TEST_FILES: none initially; existing config characterization is sufficient unless a gap is found
- Immutable behavior: schema, migration, filenames, precedence, fresh-home side effects, Config public contract
- Planned validation: config suite, fresh-home CLI matrix, HyperCode/legacy/precedence smoke, OpenCode typecheck, app build, diff/manifest/lockfile/Frozen Area gates
- Rollback boundary: C-002 independent commit only; preserve `C-009` and `C-001`

### Bootstrap responsibility scan

| Source | Responsibility | Finding / ruling |
|---|---|---|
| `syncBundledGlobalConfig` | Fresh global bundled file creation | Required behavior; retain exact guard and payload |
| `loadGlobal` fallback block | Schema-only fallback after failed/absent bootstrap | Same bootstrap responsibility; extract with the first source, retain fallback semantics |
| `loadGlobal` config merge sequence | Load and merge five global filenames plus legacy migration | Distinct processing; keep in place and unchanged |

Ruling: only the two bootstrap branches are combined into one private helper; merge order and legacy migration remain untouched. Cost if wrong: revert the single C-002 commit.

### Preflight evidence

- Isolated production-like fresh HOME (`HOME`/`USERPROFILE`/`TEMP`/`TMP` + `XDG_*`) generated bundled `opencode.json`; CLI exit `0`.
- HyperCode `hypercode.json` path loaded without creating `opencode.json`.
- Legacy TOML `config` path returned `provider/model`, migrated to `config.json`, and removed the legacy file.
- Global file precedence resolved in observed order `config.json → opencode.json → opencode.jsonc → hypercode.json → hypercode.jsonc`; project/local files then overrode global.
- Side effects were limited to isolated config/data/state/cache/log directories and expected migration files; no auth or credentials were created.
- `bun test test/config/config.test.ts`: `118 pass / 0 fail`.
- `packages/opencode bun typecheck`: existing F-013 only; `packages/app bun run build`: success with existing Vite warnings.

### Guardrails

- Preserve bundled bootstrap condition, all config filenames, legacy migration semantics, schema/variable substitution, and global/local precedence.
- Future implementation is limited to extraction/deduplication in the C-002 allowlist; no schema, manifest, lockfile, Frozen Area, or business behavior changes.
- Re-run the report's matrix before/after any change; new failure or changed side effect blocks the batch.

### Change record

- Replaced the separate `syncBundledGlobalConfig` function and `loadGlobal` schema-only bootstrap branch with one private `bootstrapGlobalConfig` helper.
- Preserved the bundled payload, both guards, failed-write fallback, global merge order, legacy migration, filename compatibility, schema substitution, and Config public API.
- Only `packages/opencode/src/config/config.ts` changed for C-002; no tests, manifests, lockfile, or Frozen Area changes.

### Post-change validation

- `bun test test/config/config.test.ts` (`packages/opencode`): `118 pass / 0 fail`.
- Fresh-home CLI matrix: fresh bundled bootstrap, HyperCode path, legacy migration, global precedence, and project/local precedence all `PASS`; isolated HOME removed.
- `bun typecheck` (`packages/opencode`): existing F-013 only; no new type errors.
- `bun run build` (`packages/app`): success with existing Vite warnings.
- OpenCode broad suite: `3609 pass / 58 skip / 1 todo / 7 fail`; six Windows symlink `EPERM` failures and one CLI help snapshot spacing failure match frozen baseline.
- `git diff --check`: `PASS`.

### Fork Tax and complexity

- Bootstrap implementation sources: `2 → 1`; duplicate bootstrap ownership: `2 → 1`.
- Modified upstream production files: `1 → 1`; modified upstream symbols: `2 → 2`.
- Technical delta: `9 insertions / 10 deletions` (net `-1` line).
- Core patches: `55 → 55`; compatibility behavior count unchanged.
- Complexity Delta: `LOWER`; Net Fork Tax: `REDUCED`.

### Decision

- Final status: `ACCEPTED_WITH_WARNINGS`.
- Warning: broad suite retains only frozen Windows symlink privilege and CLI help snapshot spacing failures; typecheck retains baseline F-013.
- Commit: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177` (`slim(C-002): deduplicate config bootstrap`).

## Remaining ranking and C-005 preflight

- `PHASE5A_CURRENT_HEAD`: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Ranking report: `reports/slimming/48-phase5a-remaining-ranking.md`.
- Sole `NEXT`: `C-005`; preflight result: `C005_NO_NET_BENEFIT`.
- C-005 validation: `bun test test/session/retry.test.ts test/session/schema-decoding.test.ts` → `85 pass / 0 fail`.
- C-005 production implementation: `NOT_EXECUTED`; no production files or dependencies changed.
- Ruling: retry copy has one production source of truth already; extraction would add a module/import edge and increase production files without reducing Fork Tax.
- Remaining candidates were not advanced automatically; Phase 5A remains `PASS_WITH_WARNINGS` and Phase 5B remains prohibited.

## C-008 — Codex/DigitalOcean OAuth pages preflight

- Status: `PREFLIGHT_COMPLETE` → `C008_NO_NET_BENEFIT`.
- `PHASE5A_CURRENT_HEAD`: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Report: `reports/slimming/50-c008-preflight.md`.
- Current production delta vs pure upstream: `1 insertion / 1 deletion` in `packages/opencode/src/plugin/digitalocean.ts`; Codex has no C-008 production delta.
- Shared callback HTML is already centralized in Core `OauthCallbackPage`; provider implementations are distinct responsibilities, with zero duplicate branches.
- Validation: Core OAuth page `1 pass / 0 fail`; Codex + DigitalOcean provider tests `49 pass / 0 fail`; Core typecheck `PASS`; OpenCode typecheck baseline F-013 only.
- Simulated extraction would add a module/import edge without reducing modified upstream files or sources of truth; gate result `C008_NO_NET_BENEFIT`.
- C-008 production implementation: `NOT_EXECUTED`; no commit created. Per rule, C-007 is the next candidate, but its preflight is not started in this task.

## C-007 — xAI OAuth flow

- Initial status: `PENDING` at `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Status: `PREFLIGHT_COMPLETE` → `C007_BLOCKED_BY_GUARDRAIL`.
- Current HEAD: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Report: `reports/slimming/51-phase5a-c007-summary.md`.
- Targeted validation: `test/plugin/xai.test.ts` → `24 pass / 0 fail`.
- Blocking guardrails: the allowlisted `xai.ts` contains an existing uncommitted Phase 4.6 repair; independent C-007 rollback cannot be isolated. Extraction would also cross frozen Plugin architecture and increase indirection/files.
- Implementation: `NOT_EXECUTED`; existing dirty repair preserved; C-007 queued for Phase 5B.

## C-012 — Offline delivery boundary

- Initial status: `PENDING` at `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Status: `PREFLIGHT_COMPLETE` → `C012_DEFER_PHASE5B`.
- Current HEAD: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Report: `reports/slimming/53-phase5a-c012-summary.md`.
- Targeted validation: `test/script/offline-package.test.ts` → `5 pass / 0 fail`.
- Current Linux/Windows packaging boundaries are already explicit; common extraction would add module/import edges and not reduce upstream patches.
- Missing clean cross-platform artifact baseline (native compiler downloads/builds, VSIX packaging, installer execution) prevents Phase 5A implementation.
- Implementation: `NOT_EXECUTED`; no C-012 production, manifest, lockfile, or dependency changes.

## Phase 5B Readiness — C-007 / C-012

- Readiness HEAD: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177` (`C002` commit remains intact).
- C-007 report: `reports/slimming/53-c007-phase5b-readiness.md`; result `C007_NOT_READY_FOR_PHASE_5B`.
- C-007 boundary: `BASE_HEAD` is the current HEAD; `PRE_EXISTING_REPAIR` is the uncommitted 98-line R-005 delta in `packages/opencode/src/plugin/xai.ts`; `C007_DELTA=0`; clean rollback boundary not established.
- C-007 validation: prior xAI targeted run was `24 pass / 0 fail`; latest rerun had `24 pass` plus one `beforeEach/afterEach` timeout, so device-code/mock coverage is functionally green but the local harness has environment variance; live loopback/external OAuth is unverified.
- C-012 report: `reports/slimming/54-c012-cross-platform-artifact-baseline.md`; result `C012_NOT_READY_FOR_PHASE_5B`.
- C-012 validation: offline fixture suite remains `5 pass / 0 fail`; Linux/Windows compiler, VSIX, installer and clean-profile artifact baseline unavailable; macOS is not an existing offline delivery target.
- Global gate report: `reports/slimming/55-phase5b-gate.md`; result `NOT_READY_FOR_PHASE_5B`.
- No Phase 5B production refactor, manifest, lockfile, dependency, or Frozen Area change was made.
- R-005 blocker resolution: independently committed as `fe8c6b1a3ccdd7a38fd85807dff3ca6841c00a31`; C-007 remains not ready due no net-benefit extraction and incomplete live OAuth coverage.
- C-012 Windows end-to-end artifact attempt succeeded; Linux attempt was blocked by compiler download `ConnectionRefused`; final summary is `reports/slimming/61-phase5b-final-summary.md`.
