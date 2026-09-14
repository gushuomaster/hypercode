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
