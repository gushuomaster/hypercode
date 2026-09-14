# Phase 5A C-001 Summary

## Result

`C-001 — Env flag aliases` is `ACCEPTED_WITH_WARNINGS`.

The duplicated `OPENCODE_*` to `HYPERCODE_*` name mapping now lives in one Core helper and is reused by the Core flag reader and OpenCode RuntimeFlags ConfigProvider. HYPERCODE-first precedence and all `OPENCODE_*` compatibility names remain unchanged.

## Fork reduction

- Duplicate alias implementations: `2 → 1`.
- Modified upstream production files: `2 → 2` (the touched paths remain customized, but the mapping rule is centralized).
- New helper: `packages/core/src/flag/env.ts`.
- Core patch count: unchanged at `55`.
- Frozen-area interaction: `NONE`.
- Lockfile/manifests: unchanged.

## Validation

- Core alias characterization: `2 pass / 0 fail`.
- RuntimeFlags characterization: `38 pass / 0 fail`.
- Affected Core tests: `12 pass / 1 skip / 0 fail`.
- Core typecheck: `PASS`.
- OpenCode typecheck: existing F-013 only.
- No alias-related regression observed.

The broad suites retain Windows symlink, help snapshot, and timeout instability. These failures are outside the alias code path and remain warnings rather than reasons to alter the baseline or dependencies.

## Commit boundary

This candidate is isolated in one commit after preserving unrelated dirty-worktree changes. It is safe to revert independently without touching frozen areas or dependency topology.
