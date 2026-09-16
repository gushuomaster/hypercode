# Phase 5A C-007 Summary

## Preflight result

`C007_BLOCKED_BY_GUARDRAIL`

## Current behavior and scope

- C-007 is the xAI OAuth flow: device-code authorization plus a HyperCode-specific loopback PKCE callback, token exchange, refresh, CORS handling, state validation, and HTML responses.
- Runtime entry is `Plugin.Service.internalPlugins → XaiAuthPlugin`; auth discovery and the CLI/TUI connect flow consume its `Hooks.auth` methods. Token persistence and provider loading remain plugin contracts.
- Current file is `packages/opencode/src/plugin/xai.ts`; it is already at the plugin boundary rather than in core. Against pure upstream it contains a substantial custom delta (`352` added lines in the current dirty worktree).
- Current behavior is covered by `test/plugin/xai.test.ts`: `24 pass / 0 fail` (`94 expect()` calls).

## Maintenance surface

| Metric | Current value |
|---|---:|
| Production files in candidate scope | `1` |
| Modified upstream production files | `1` (`xai.ts`) |
| Modified upstream symbols | `10+` OAuth helpers/constants/interfaces and `XaiAuthPlugin` paths |
| HyperCode delta LOC vs pure upstream | `352` added lines (current dirty repair) |
| Sources of truth | `1` xAI flow; shared callback/page helpers are not interchangeable with provider flow |
| Duplicate branches | `0` exact; PKCE/loopback patterns are provider-specific partial overlap |
| Wrappers/adapters | `0` package wrappers; plugin hook is the existing boundary |
| Import edges | `1` additional `node:http` edge in the dirty repair |
| Runtime consumers | `1` built-in plugin registration plus auth discovery/CLI/TUI consumers |

## Guardrail and simulated implementation

- The current `xai.ts` has an existing uncommitted Phase 4.6 repair (F-008/R-005) restoring the OAuth helpers. It overlaps the exact C-007 production allowlist.
- A C-007 commit cannot isolate a new extraction from that repair without either committing unrelated work or reverting user changes; this violates the independent rollback boundary.
- Moving the flow to another module would predict production files `1 → 2`, import edges `+1`, and a wrapper/adapter `+1`; the modified upstream path count would remain at least `1`.
- The proposed extraction would cross the frozen Plugin architecture/auth-storage boundary and would require real loopback, PKCE/state, token-refresh, and persistence validation not available in this environment.
- Public compatibility boundaries include `Hooks.auth`, provider `xai`, OAuth URLs/redirect URI, token metadata, `OAUTH_DUMMY_KEY` replacement, and error/callback behavior.
- Direct Frozen interaction: `YES` (Plugin architecture); indirect contract interaction: `YES` (auth hooks, token persistence, provider lifecycle).
- `EXPECTED_COMPLEXITY_DELTA`: `HIGHER` for extraction; no safe `LOWER`/`NEUTRAL` plan is evidenced.

## Validation

- Targeted xAI suite: `24 pass / 0 fail`.
- OpenCode typecheck: existing F-013 only; no new C-007 error observed.
- Real OAuth callback requires external xAI credentials/network and was not forced.
- Validation coverage is `PARTIAL`: mock/device-code paths are covered, but live loopback and external token lifecycle are not.

## Decision

- Gate: `C007_BLOCKED_BY_GUARDRAIL`.
- Implementation: `NOT_EXECUTED`; no C-007 commit created.
- Existing dirty `xai.ts` repair is preserved unchanged.
- C-007 is placed in the Phase 5B queue pending a clean rollback boundary, plugin-architecture gate, and live callback/persistence matrix.
