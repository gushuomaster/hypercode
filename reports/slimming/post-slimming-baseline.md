# HyperCode Post-Slimming Baseline

固化时间：2026-09-16（Asia/Shanghai）

## Result

`STOP_AT_CURRENT_OPTIMUM`

本 baseline 是后续 OpenCode 升级、冲突归因和 Fork Tax 对比的固定起点。不得把它解释为继续寻找 slimming candidate 的入口；只有新的 upstream 等价能力或新的运行时证据，才允许重新评估已关闭差异。

## Repository Baseline

- HyperCode branch：`dev`
- Integrated slimming HEAD：`25390fa4d34da1acf315ceabcd027baf62de26bd`
- Final maintenance HEAD：`e7333ecac2f5f4ce33fe051cfcd0e604f598e910`
- OpenCode version：`1.18.30`
- OpenCode upstream repository：`https://github.com/anomalyco/opencode.git`
- OpenCode upstream commit：`193de13a88d62a6409c6d385831180f1def527dc`
- Package manager baseline：Bun `1.3.14`
- Validation environment：Windows、PowerShell UTF-8

## Fork Tax

计数仅使用相对 upstream commit 的 baseline-existing `M`/`T` 路径。`technical surface` 是 `packages/core/src/**` 与 `packages/opencode/src/**` 中这些路径的 additions + deletions；HyperCode-only added files不计入。

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Modified upstream files | 147 | 141 | -6 |
| Production paths | 99 | 92 | -7 |
| Core patch paths | 55 | 48 | -7 |
| Technical surface | 832 | 792 | -40 |
| Modified symbols | ≈76 | ≈70 | ≈-6 |

Phase 12 的 `modified upstream files` 从 `140` 变为 `141`，唯一增量是回放根目录 `AGENTS.md` 的治理规则；它不属于生产路径或 Core patch。Session sync repair 删除 upstream 已移除的 6 行 dangling dual-write，使 technical surface 从 `798` 降至 `792`。

可重复测量命令：

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/sync-opencode-upstream.ps1 `
  -Mode Measure `
  -UpstreamCommit 193de13a88d62a6409c6d385831180f1def527dc `
  -CurrentRef HEAD `
  -Json
```

期望输出：

```json
{"upstreamCommit":"193de13a88d62a6409c6d385831180f1def527dc","currentRef":"HEAD","modifiedUpstreamFiles":141,"productionPaths":92,"corePatchPaths":48,"technicalSurface":792}
```

## Accepted Differences

### KEEP

- branding
- Chinese localization
- compatibility
- offline
- VS Code
- product workflows

这些差异是产品或兼容能力，不以“路径数量较多”为删除依据。

### FROZEN

- Session
- Provider lifecycle
- Plugin architecture
- TUI
- VS Code runtime

Frozen Area 默认只允许 upstream sync、明确缺陷修复和带运行时证据的兼容调整；不允许以降低文件数为理由重构。

### CLOSED

- `NO_NET_BENEFIT`
- `GUARDRAIL`
- `ENVIRONMENT_BLOCKED`

Closed 项目不自动重新进入候选队列。未来只有 upstream overlap、maintenance cost 或验证能力发生实质变化时，才允许重新打开并记录新证据。

## Validation Baseline

- OpenAPI branding targeted：`1 pass / 0 fail`
- OpenAPI/SDK related group：`49 pass / 0 fail`
- Full HttpApi affected area：`200 pass / 17 skip / 0 fail`
- Core typecheck：PASS
- TUI typecheck：PASS
- VS Code check-types/package：PASS
- OpenCode typecheck：历史 F-013（`test/config/config.test.ts:284`）+ 已归因 `run-real-doubao.ts` user-script-only debt
- OpenCode broad：`3611 pass / 58 skip / 1 todo / 7 fail`
- 已知 broad failures：6 个 Windows symlink `EPERM`；1 个 CLI help spacing snapshot
- Phase 11/12 replay 新增可归因回归：`0`

新的同步结果只有在与本节 known failure signature 完成对比后，才能提升为 PASS。环境或已知失败未消除时保持 `PASS_WITH_WARNINGS`。

### Integration-Time Warnings

- 对纯 committed HEAD `25390fa4d` 的隔离 typecheck 仍在 `src/session/processor.ts`、`test/config/config.test.ts`、`test/plugin/loader-shared.test.ts`、`test/session/compaction.test.ts`、`test/share/share-next.test.ts` 失败。
- 上述路径全部存在于 preservation stash `3674c90ad0b99c877a70348af05c28ef1c9985fb`；旧 validation baseline 是在这些 dirty 内容存在时建立的。它们进入 Frozen/人工回放边界，本次不自动覆盖 committed HEAD。
- `rebrand:check` 当前签名为：blocked IDs `core-env-alias-missing`、`runtime-env-alias-missing`；planned file `packages/app/src/i18n/en.ts`（4 处）；manual checks `README.md`、`sdks/vscode/src/extension.ts`。
- 以上 warning 不授权自动运行 `rebrand --write`、自动应用 stash 或修改业务代码。未来同步不得增加该签名；要提升为 PASS，需独立修复 rebrand audit 规则并完成人工回放验证。
- `packages/opencode/script/run-real-doubao.ts` 原样来自 preservation stash；其依赖未集成的 `chatgpt-image-runtime` 分支（97 文件，含数据库、Provider、Plugin、Video workflow 与 lockfile 变化），因此标记为 `KNOWN_USER_SCRIPT_TYPE_DEBT`，未扩大本阶段范围。

## Dependency Integrity

- `bun.lock` baseline blob：`d1a30094ccd5e607f14859313b2e8ee951577441`
- `packages/opencode/package.json` baseline blob：`3f72ba0dc1dc275d53dd63eebfa5294440297147`
- 当前 baseline 不授权升级依赖、修改 manifest 或改变 workspace topology。

## Preservation and Maintenance Closure

- Preservation stashes retained: `125c4541d6270b7e911631d3a334bc7e834ee5c1`, `4c3f7690e2863188f7fa3e9c729060f3fcddd336`, `3674c90ad0b99c877a70348af05c28ef1c9985fb`.
- Future sync entrypoint: `scripts/sync-opencode-upstream.ps1`.
- Phase 12 status: `MAINTENANCE_READY_WITH_KNOWN_DEBT`.
- Untracked `sdks/vscode/.vscode-test/` is generated test-download residue, excluded from commits and preservation baseline.

## Reopen Rule

重新评估已关闭差异必须同时提供：

1. 新 upstream 版本或新的运行时证据；
2. 明确 consumer 与行为边界；
3. 可重复 pre-change baseline；
4. targeted validation 与 broad regression；
5. 可量化 Fork Tax 收益；
6. 独立 rollback commit。
