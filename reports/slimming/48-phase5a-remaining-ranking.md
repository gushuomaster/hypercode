# Phase 5A Remaining Candidate Ranking

## Baseline

- `PHASE5A_CURRENT_HEAD`: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Phase 5A accepted commits remain `f13c32d54`, `17dacc365`, and `81ef2c8b0`.
- Fork baseline remains OpenCode `1.18.30`, pure upstream `193de13a88d62a6409c6d385831180f1def527dc`.
- This ranking is read-only and does not authorize implementation by itself.

## Scoring

Scores are `0–3`; higher is better. Runtime Risk and Frozen-Area Distance score low risk / greater distance higher.

| Candidate | Static Confidence | Validation | Runtime Risk | Frozen Interaction | Change Scope | Fork Benefit | Decision |
|---|---:|---:|---:|---:|---:|---:|---|
| C-008 Codex/DigitalOcean OAuth pages | 2 | 2 | 1 | 1 | 2 | 0 | `NO_NET_BENEFIT` |
| C-007 xAI OAuth flow | 2 | 2 | 0 | 1 | 1 | 2 | `FROZEN` |
| C-012 Offline delivery boundary | 2 | 0 | 1 | 2 | 1 | 2 | `DEFER_PHASE5B` |

## Candidate evidence

### C-008

- Both Codex and DigitalOcean already use shared `OauthCallbackPage`; remaining HyperCode delta is primarily one DigitalOcean instruction string.
- Auth callback/state/token behavior is runtime-sensitive and no complete DigitalOcean provider matrix is present.

- Preflight result: `C008_NO_NET_BENEFIT`; shared callback implementation is already a single source of truth and the remaining branding instruction is one production string.

### C-007

- xAI contains a substantial custom loopback/device OAuth flow with mock coverage, but extraction would cross auth storage and plugin internals.
- No real callback smoke exists; plugin lifecycle and token persistence remain guardrails.

### C-012

- Offline entrypoints and package boundaries are statically identifiable, but clean Linux/Windows artifact smoke is absent.
- No deletion or build-script change is authorized until artifact validation exists.

## Selection

Historical selection after C-008 was `C-007` as the sole `NEXT`. Its preflight is now complete and the final decision is `FROZEN`; C-008 remains closed as `NO_NET_BENEFIT`.

## Round completion

- C-007 preflight result: `C007_BLOCKED_BY_GUARDRAIL`; no implementation.
- C-012 preflight result: `C012_DEFER_PHASE5B`; no implementation.
- Remaining-candidate round is closed; no further `NEXT` is selected automatically.
