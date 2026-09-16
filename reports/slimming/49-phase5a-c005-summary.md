# Phase 5A C-005 Summary

## Preflight result

`C005_NO_NET_BENEFIT`

`C-005 — Session retry messaging` was selected as the sole `NEXT`. No production implementation was executed.

## Candidate-specific preflight

- Current behavior: `retryable()` maps free-tier and Go usage-limit errors to retry actions; retry policy, delay, classification, and action schema are unchanged upstream-compatible behavior.
- Current custom surface: one HyperCode-specific free-tier description in `packages/opencode/src/session/retry.ts`; existing constants already centralize the free-tier message and Go URL.
- Current consumers: `SessionRetry.retryable()` feeds session retry status/events; TUI consumes the action fields for the upsell presentation. The retry test suite and session status schema characterize the contract.
- Public contract: `Retryable`, `RetryReason`, action fields, `GO_UPSELL_MESSAGE`, and `GO_UPSELL_URL` must remain unchanged.
- Runtime dependencies: provider error parsing, session retry scheduling, TUI action rendering, and external Go URL; no dependency or manifest changes allowed.
- Expected allowlist: initially `packages/opencode/src/session/retry.ts` only; tests are characterization-only unless a demonstrated gap appears.
- Validation baseline: `bun test test/session/retry.test.ts` plus affected session status/schema tests, OpenCode typecheck with baseline F-013 comparison, and broad known-signature comparison.
- Rollback boundary: one independent C-005 commit, if implementation were authorized.
- Frozen interaction: no direct Frozen Area modification, but retry status/action semantics are behavior-sensitive and must not change.

## Net-benefit ruling

- Current upstream files touched: `1`.
- Proposed extraction to a separate resource/helper module: at least `2` production files plus a new import edge.
- New modules/packages: `1` if extracted; new wrapper: `1`; dependency edges: `+1`.
- Modified upstream files after extraction: `1 → 2`; production source-of-truth count remains `1`.
- The only other matching strings are localization/UI documentation or test expectations, not duplicate retry implementations. Centralizing them would cross package/localization boundaries and alter product copy ownership.
- Therefore Fork Tax does not decrease; the change would increase indirection and maintenance surface.

## Decision

- Implementation: `NOT_EXECUTED`.
- Production files changed: `0`.
- Config/retry behavior: `UNCHANGED`.
- No commit created for C-005.
- C-005 is reclassified `NO_NET_BENEFIT`; do not automatically select another candidate in this round.
