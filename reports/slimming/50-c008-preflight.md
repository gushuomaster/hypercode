# C-008 Candidate-specific Preflight

## Gate

`C008_NO_NET_BENEFIT`

本报告为 READ / VALIDATE ONLY；未修改 C-008 production code、manifest、`bun.lock` 或依赖。

## Baseline and definition

- `PHASE5A_CURRENT_HEAD`: `81ef2c8b0f6d74c85c09fcb34310cf0de90db177`.
- Fork baseline: OpenCode `1.18.30`, pure upstream `193de13a88d62a6409c6d385831180f1def527dc`.
- Name/purpose: `C-008 — Codex/DigitalOcean OAuth pages`; candidate goal was to replace duplicated provider callback HTML with the shared upstream `OauthCallbackPage` while preserving provider-specific OAuth behavior and branding.
- Current disposition: `UPSTREAM_REPLACEMENT` candidate, static confidence `Medium`, runtime criticality `Medium/High`.
- Allowlist from Phase 5A: `packages/opencode/src/plugin/openai/codex.ts`, `packages/opencode/src/plugin/digitalocean.ts`; no manifest or dependency changes.

## Current implementation and structure

```text
Plugin.Service.internalPlugins
  ├─ CodexAuthPlugin
  │    └─ OauthCallbackPage.error/success → ChatGPT OAuth server → token exchange/account metadata
  └─ DigitalOceanAuthPlugin
       └─ OauthCallbackPage.bootstrap → DigitalOcean loopback server → token/router metadata
```

- `OauthCallbackPage` is already a single implementation in `packages/core/src/oauth/page.ts` and is imported by both provider files.
- Codex also exports `renderOAuthError`, a thin provider-specific adapter that supplies the `ChatGPT` label; it is not duplicate HTML.
- The only C-008 production diff against pure upstream is one DigitalOcean instruction string (`OpenCode` → `HyperCode`), `1 insertion / 1 deletion`.
- Classification of implementations: callback page implementation is `DISTINCT_SHARED_IMPLEMENTATION`; provider OAuth flows are `DISTINCT_RESPONSIBILITY`, not duplicates.

## Consumers and contracts

- Runtime consumers: `Plugin.Service.internalPlugins` registers both plugins; auth discovery consumes their `Hooks.auth.methods`; TUI/CLI connect flows invoke `authorize()` and `callback()`.
- DigitalOcean provider tests consume router/auth metadata; Codex tests consume callback error rendering, PKCE/token/account handling, and model filtering.
- `OauthCallbackPage` export is `INTERNAL_SHARED` across Core and built-in plugins. `Hooks.auth`, provider IDs, OAuth method labels, callback result shape, token metadata, and callback URLs are `PUBLIC_COMPATIBILITY_CONTRACT` boundaries.
- Direct Frozen interaction: `NO` for the proposed no-op; Indirect Contract Interaction: `YES` because plugin auth hooks, token persistence, state validation, and callback rendering must remain unchanged.

## PRE_IMPLEMENTATION_METRICS

| Metric | Current value |
|---|---:|
| Production files in candidate scope | `2` |
| Modified upstream production files | `1` (`digitalocean.ts`) |
| Modified upstream symbols | `1` (`DigitalOceanAuthPlugin` instruction) |
| HyperCode delta LOC vs pure upstream | `1 insertion / 1 deletion` |
| Sources of truth | `1` shared callback page; `1` provider instruction string |
| Duplicate branches | `0` |
| Wrappers/adapters | `1` thin `renderOAuthError` adapter (provider labeling, not duplicate HTML) |
| Existing import edges | `2` imports of the shared page; no new edge required |
| Runtime consumers | `2` built-in auth plugins plus auth discovery/UI consumers |

## Simulated implementation

- Expected production files: `2 → 2` at best; both already import the shared page. Removing nonexistent duplicate HTML changes nothing.
- Expected upstream patches: `1 → 1`; the remaining HyperCode instruction string is a product-localization difference.
- Expected sources of truth: `1 → 1` for callback HTML; provider-specific instruction remains one source.
- Expected wrappers: `1 → 1`; deleting `renderOAuthError` would only inline a public test-visible helper and increase coupling.
- Expected import edges: `2 → 2`; no edge reduction is available.
- Expected abstraction layers: `1 → 1` shared callback page; no simplification without moving code and adding indirection.
- Any extraction of the instruction/resource would add a module and import edge while leaving the modified upstream file count unchanged.

## Complexity and validation

- `EXPECTED_COMPLEXITY_DELTA`: `NEUTRAL` for a no-op; any extraction is `HIGHER` due to added module/indirection.
- Available tests: Core OAuth page `1 pass / 0 fail`; Codex and DigitalOcean provider suites `49 pass / 0 fail`.
- Typecheck: Core `PASS`; OpenCode retains only baseline `F-013`.
- Build/smoke: no provider-specific build needed for a no-op; real OAuth callback requires external credentials/network and was not forced.
- Validation can detect regression: `PARTIAL` for full live OAuth, but sufficient to prove the current shared page and provider mapping boundary; no implementation is authorized.
- Runtime external dependency: OAuth endpoints, browser callback, credentials, and DigitalOcean router API (`RUNTIME_EXTERNAL_DEPENDENCY`).

## Gate rationale

1. C-008 currently preserves shared callback behavior; it does not contain the duplicate HTML that the candidate description assumes.
2. There is no duplicate production source of truth or compatibility branch to centralize.
3. A change would either be a one-line branding edit already present or move one line into a new resource module.
4. That would not reduce Fork Tax and could increase files, imports, and indirection while touching public plugin-auth boundaries.
5. Rollback would be technically clear (one commit), but rollback clarity cannot compensate for zero maintenance-surface benefit.

Therefore C-008 is `C008_NO_NET_BENEFIT`; no implementation plan is authorized. Per the continuation rule, `C-007` becomes the next candidate, but this task does not start its preflight.
