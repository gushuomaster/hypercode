# Phase 5A Validation Results

## C-009 — CLI branding resource

### PRE_CHANGE

- Typecheck: `packages/opencode bun typecheck` → F-013 only, matching baseline.
- Targeted tests: CLI error and read-only smoke suites → `13 pass / 0 fail`.
- Smoke: `bun src/index.ts --help` → exit 0; HyperCode branding present.
- Baseline signature: unchanged before the candidate.

### POST_CHANGE

- Typecheck: `packages/opencode bun typecheck` → F-013 only; no new type errors.
- Targeted tests: CLI error, read-only smoke, run entry body, serve process → `29 pass / 0 fail`.
- Smoke: `bun src/index.ts --help` → exit 0; branding and command output preserved.
- Broad: `3606 pass / 58 skip / 1 todo / 8 fail` in the aggregate run.
- Broad failure attribution: six Windows symlink `EPERM` failures and one CLI help snapshot spacing failure match the frozen baseline; one `Server.listen` timeout passed on isolated rerun and is treated as an environment flake.
- New failures: none attributable to C-009.
- Changed known failures: none; help snapshot remains the existing spacing signature.

### Result

`ACCEPTED_WITH_WARNINGS`

## C-005 — Retry copy/resource preflight

- Preflight targeted validation: `bun test test/session/retry.test.ts test/session/schema-decoding.test.ts` → `85 pass / 0 fail` (`113 expect()` calls).
- Retry action shape, reason values, Go/free-tier mapping, delay policy, and schema decoding remain characterized.
- No production implementation executed after the net-benefit gate; no C-005 regression was introduced.
- Result: `C005_NO_NET_BENEFIT`.

## C-007 — xAI OAuth flow preflight

- Targeted suite: `24 pass / 0 fail`.
- OpenCode typecheck: existing F-013 only.
- Live loopback/token exchange requires external xAI credentials/network; not forced.
- Result: `C007_BLOCKED_BY_GUARDRAIL`; no implementation or regression introduced.

## C-012 — Offline delivery boundary preflight

- Package characterization: `5 pass / 0 fail` (`36 expect()` calls).
- Fixture coverage includes Linux tar, Windows zip, installers, config examples, and checksums.
- End-to-end cross-platform artifact smoke remains unavailable; no new production validation was needed because implementation was not executed.
- Result: `C012_DEFER_PHASE5B`; no implementation or regression introduced.

## C-002 — Bundled config bootstrap

### PRE_CHANGE

- HEAD: `17dacc3651518c01a45605f5d5855d3288e69811` (`C002_PRECHECK_HEAD`).
- Config suite: `118 pass / 0 fail`.
- Fresh-home preflight: all matrix scenarios passed; see `46-c002-fresh-home-validation.md`.
- Typecheck: existing F-013 only.

### POST_CHANGE

- Targeted config suite: `118 pass / 0 fail` (`219 expect()` calls).
- Fresh-home CLI matrix: fresh bootstrap, HyperCode path, legacy migration, global precedence, and project/local precedence all passed; expected side effects remained in isolated HOME.
- Typecheck: existing F-013 only; no new C-002 errors.
- App build: success with existing Vite dynamic-import/chunk warnings.
- Broad OpenCode suite: `3609 pass / 58 skip / 1 todo / 7 fail`; six symlink `EPERM` and one CLI help snapshot spacing failure match frozen baseline.
- New failures attributable to C-002: `0`.
- Changed known failure signatures: `0`.

### Result

`ACCEPTED_WITH_WARNINGS`
