# C-007 Phase 5B Readiness

## Scope and gate

本报告只做 C-007 的 Phase 5B readiness，不实施 OAuth utility extraction、provider 重构或 Plugin architecture 变更。

| Field | Value |
|---|---|
| Candidate | C-007 — xAI OAuth flow |
| `BASE_HEAD` | `81ef2c8b0f6d74c85c09fcb34310cf0de90db177` |
| Bun / platform | Bun `1.3.14 (0d9b296a)` / `win32-x64` |
| Current implementation | `packages/opencode/src/plugin/xai.ts`；device-code flow 为已提交路径，loopback PKCE/server 为当前工作区未提交修复 |
| Existing targeted validation | Earlier run `24 pass / 0 fail`; fresh rerun had a `beforeEach/afterEach` timeout after the 24 passing cases (environment variance) |
| Production implementation | `NOT_EXECUTED` |

## Clean comparison boundary

`BASE_HEAD` 的 `xai.ts` blob 为 `c702c9609c04c417a429353db6e3ead8a287ed7a`；pure upstream `193de13a...` 的对应 blob 为 `a455121d6aedfac1ee9f68bd4f6d455ce5a86eba`。`BASE_HEAD` 相对 pure upstream 已有 `254` 行 HyperCode xAI callback/UI/CORS 差异。

当前工作区相对 `BASE_HEAD` 为 `98 additions / 0 deletions`，全部位于 C-007 allowlist：

| Classification | Evidence | Decision |
|---|---|---|
| `PRE_EXISTING_REPAIR` / `SYNC_REPAIR_UNCOMMITTED` | `reports/slimming/24-phase4.6-sync-repairs.md` 的 R-005；新增 `createServer`、PKCE helpers、state/HTML/token-exchange helpers | 保留，不纳入 C-007 commit |
| `USER_CHANGE` | 当前无额外可归因用户业务改动证据；不得假定 dirty 内容可回滚 | 按用户内容保护处理 |
| `REPORT_ONLY` | 本报告及 readiness 台账 | 可新增 |
| `C007_DELTA` | 本次 Phase 5B readiness 未产生 production diff | `0` |

因此无法在不提交或回滚 `PRE_EXISTING_REPAIR` 的情况下建立独立 C-007 rollback boundary。任何 extraction commit 都会把同步修复与候选变更混在一起，违反单候选回滚要求。

## Local OAuth behavior matrix

| Scenario | Environment / input | Expected | Observed evidence | Result |
|---|---|---|---|---|
| Device authorization request | mock `deviceAuthorizationUrl` | POST RFC 8628 fields，解析 verification URL/code | xAI suite covers request and field validation | `PASS` |
| Device pending/slow-down/success | mock token endpoint | 按 `authorization_pending`、`slow_down` 轮询并成功返回 token | xAI suite covers all branches | `PASS` |
| Refresh and rotating refresh token | mock token endpoint + auth setter | single-flight、刷新后持久化、失败传播 | xAI suite covers 24 tests including concurrency/failure | `PASS` |
| Loopback PKCE authorize | local callback with code/state | 校验 state/PKCE 后 exchange token | Static implementation exists in uncommitted repair; no exported/in-process harness for live callback | `UNVERIFIED` |
| Invalid state / missing code / OAuth error | local callback malformed query | reject and render escaped error page | Static branches present; no runtime callback test | `UNVERIFIED` |
| CORS preflight | `accounts.x.ai` / `auth.x.ai` origins | allowlisted origin only | Static allowlist inspection only | `UNVERIFIED` |
| External xAI OAuth | real browser, credentials, network | real consent, redirect, token persistence | Not run; cannot fabricate external success | `BLOCKED` |

## Consumers and compatibility

- Runtime consumer is the built-in `Plugin.Service.internalPlugins → XaiAuthPlugin` registration, then CLI/TUI auth discovery through `Hooks.auth`.
- Public compatibility includes provider `xai`, auth method labels, `OAUTH_DUMMY_KEY` replacement, token fields, refresh persistence, device authorization URLs, and callback/error contracts.
- The device-code path is already upstream-equivalent in shape; the loopback path is HyperCode-specific and partly restored by R-005. It is not safe to infer that upstream `OauthCallbackPage` or another provider helper can replace it.
- Plugin loader/lifecycle and auth storage remain Frozen Areas. Moving helpers would add an import/module edge while retaining the same provider boundary.

Fresh verification note: `bun test test/plugin/xai.test.ts` produced `24 pass / 1 beforeEach/afterEach timeout` in the latest run; the timeout is not tied to an assertion or C-007 production change, but it means the local harness is not fully repeatable yet.

## Readiness answers

1. Default behavior at `BASE_HEAD` is device-code authorization; current dirty repair additionally restores loopback helper code but is not a clean candidate baseline.
2. Device-code compatibility is reproducible; live loopback compatibility is not.
3. A real consumer exists through the built-in xAI plugin and auth discovery.
4. The loopback code is not merely historical static code; it is wired helper logic in the dirty worktree, but its external consumer path is unverified here.
5. No new/legacy/upstream precedence applies to OAuth method selection; provider exposes ordered OAuth then API methods. Token refresh uses stored OAuth state and falls through to API auth when the stored type changes.
6. OpenCode `1.18.30` upstream covers the device-code path and shared callback page primitives, but not proof of equivalent xAI loopback/token lifecycle semantics.
7. Any future change must preserve state/PKCE validation, loopback host/port, token exchange fields, refresh rotation, auth persistence, method order, and user-visible error behavior.
8. Live browser redirect, external consent, CORS behavior, and cross-process token persistence are not covered by current runtime validation.
9. Proof requires an isolated commit boundary, deterministic local callback harness, PKCE/state/error matrix, auth persistence test, and one real external OAuth smoke run recorded without secrets.
10. C-007 is not suitable for Phase 5A and is not ready for Phase 5B implementation yet.

## Gate

`C007_NOT_READY_FOR_PHASE_5B`

## Blocker-resolution update

- R-005 inventory classified all 98 dirty additions as `CONFIRMED_SYNC_REPAIR` for F-008/R-005; no `USER_CHANGE`, `UNKNOWN`, `C007_PREMATURE_CHANGE`, or unrelated hunk was found in `xai.ts`.
- Independent repair commit: `fe8c6b1a3ccdd7a38fd85807dff3ca6841c00a31` (`fix(sync): restore xai oauth helpers`).
- Boundary now exists: `81ef2c8b0f6d...` → `fe8c6b1a3` → future C-007 commit; reverting a future C-007 commit would leave R-005 intact.
- The candidate itself remains `C007_NOT_READY`: `xai.ts` is already the plugin boundary, extraction would add files/import indirection, and the proposed move crosses Frozen Plugin/auth-storage contracts without reducing modified upstream paths.
- Local device-code/refresh contracts remain covered; loopback callback, CORS, and real external OAuth remain `LOCAL_ONLY`/`EXTERNAL_REQUIRED`.
