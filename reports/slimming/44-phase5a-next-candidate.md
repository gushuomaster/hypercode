# Phase 5A Next Candidate

## NEXT_PHASE5A_CANDIDATE

- Candidate ID/name: `C-001 — Env flag aliases`
- Decision: `PHASE5A_READY_WITH_GUARDRAILS`

### Why this candidate is next

`C-001` is the strongest remaining low-risk option after the completed `C-009` pilot. It touches two existing flag consumers and can extract only the duplicated name-mapping rule without changing flag semantics. `C-002` has higher config/bootstrap risk and fresh-home validation gaps. `C-007` and `C-008` cross OAuth/plugin callback boundaries and require auth-focused checks. `C-012` lacks a clean artifact smoke baseline. `C-005` is small, but its implementation lives in the frozen `Session` area and is therefore not eligible while that freeze remains in force.

### Scope and controls

- Expected production files: `packages/core/src/flag/env.ts`, `packages/core/src/flag/flag.ts`, `packages/opencode/src/effect/runtime-flags.ts`.
- Expected test files: `packages/core/test/flag/flag.test.ts`, `packages/opencode/test/effect/runtime-flags.test.ts`.
- Fork Tax reduction: remove one duplicated alias-mapping implementation and make precedence a shared invariant; no expected file-count reduction.
- Validation: alias precedence characterization, affected Core/OpenCode tests, Core typecheck, OpenCode typecheck (F-013 allowed), and baseline signature comparison.
- Frozen-area interaction: `NONE`; no Session, TUI, VS Code, provider lifecycle, plugin architecture, dependency topology, global schema, license, or video files.
- Rollback boundary: one independent commit containing only the shared helper, two consumers, and characterization tests; revert that commit if any new failure or signature drift appears.

The candidate is ready only with these guardrails; process-environment and ConfigProvider precedence must remain HYPERCODE-first, with `OPENCODE_*` compatibility intact.
