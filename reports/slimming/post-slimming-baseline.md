# HyperCode Post-Slimming Baseline

## 2026-11-13 基线刷新（Product 跨宿主对齐后）

下文 2026-09-16 的内容保留为历史记录；同步对比以本节为准。来源：`openspec/changes/prepare-upstream-sync`。

### Fork Tax

测量口径与命令不变（见下文"可重复测量命令"），upstream commit 仍为 `193de13a88d62a6409c6d385831180f1def527dc`。

| 测量点 | Modified upstream files | Production paths | Core patch paths | Technical surface |
|---|---:|---:|---:|---:|
| 2026-09-16 历史基线 | 141 | 92 | 48 | 792 |
| `359960c7d`（Product 跨宿主对齐） | 218 | 149 | 62 | 1538 |
| 本轮暂存快照（openspec/trellis 迁移，提交前） | 220 | 149 | 62 | 1538 |

增量来源：Product 跨宿主对齐（TUI/VSCode 改为消费 `packages/product` 的命令目录与状态契约）、TUI 中文本地化、授权门禁接入点，属于 `KEEP` 类的有意成本。本轮迁移只多改了 2 个 upstream 仓库配置文件。收尾冒烟中又增加 1 个：`packages/opencode/test/preload.ts` 固定 `LANG=en_US.UTF-8`（系统语言回退上线后，让 upstream 英文断言在中文主机上保持稳定），预计 Modified upstream files 为 221。**提交后用 `-CurrentRef HEAD` 重新实测，把结果填回本表作为正式基线。**

### 已修复的债务

- F-013（`test/config/config.test.ts:284`）与 `script/build-windows-validation.ts` 类型问题：`485b115f1 fix(opencode): restore full typecheck` 已修复，OpenCode typecheck 恢复全量通过。
- `rebrand:check` 的 `core-env-alias-missing` / `runtime-env-alias-missing` blocked 签名：属于审计规则过时（C-001 把别名集中到 `packages/core/src/flag/env.ts` 后旧规则误报），已在 `cleanup-delivery-branding` 中修正规则。当前签名为 Blocked 0、Planned/Patchable 0/0、Manual 1（`README.md`），详见 `docs/规范/上游同步与品牌化规范.md`。
- A/B 对照环境 `NOT_TESTED`（F-002 / B2）：Windows 上改用 `bun install --frozen-lockfile --backend=copyfile --minimum-release-age=0` 后可安装，已在 `193de13a8` 上跑通 `test/config/config.test.ts`（108 pass）。方法见 `docs/操作手册/上游同步操作流程.md` 第 7 步。

### 仍存在的债务

- `packages/opencode/script/run-real-doubao.ts`：改为 `packages/opencode/tsconfig.json` 的 `exclude`，不再影响 typecheck，但依赖未集成分支的问题仍在（`KNOWN_USER_SCRIPT_TYPE_DEBT`）。
- CLI 运行时输出中 124 处 upstream 硬编码英文，已由 `packages/opencode/test/cli/localization-audit.test.ts` 冻结为基线。
- 全量测试中的已知失败见下方"验证基线"。

### 验证基线

2026-11-18 在本轮暂存状态上运行（Windows，`core.autocrlf=true`）。归因方法：失败用例在 HEAD `359960c7d` 的干净 worktree 上复跑；仍失败的再到 pure upstream `193de13a8` worktree 复跑（方法见 `docs/操作手册/上游同步操作流程.md` 第 7 步）。

| 包 | typecheck | 测试 |
|---|---|---|
| `packages/product` | PASS | 全部通过 |
| `packages/core` | PASS | 1093 pass / 7 skip / 3 fail |
| `packages/tui` | PASS | 278 pass / 1 skip / 4 fail |
| `packages/opencode` | PASS | 3638 pass / 58 skip / 1 todo / 13 fail |
| `sdks/vscode` | PASS（`check-types`） | `bun test`：441 pass / 29 fail / 20 errors（修复前） |

**新回归：0。** 本轮暂存改动引入的 3 个失败已在本轮修复：`sdks/vscode` 的 `lsp-adapter`、`formatter-adapter`、`session-meta` 测试未跟进 `complete-capability-status-contract` 新增的 `textKey`（此前误记为已知债务）。另修复 HEAD 就存在的 `visible-copy-localization` 失败：`status-picker.tsx` 4 处硬编码英文。

已知失败签名（同步后与此对比，不得新增）：

| 包 | 失败 | 归因 |
|---|---|---|
| opencode | `Glob > scan()` ×2、`filesystem > resolve()` ×2、`nested symlinks`、`symlink handling` | `KNOWN_WINDOWS_SYMLINK_EPERM`（沿用 2026-09-16 基线） |
| opencode | `cf-ai-gateway` ×4（`provider "anthropic.messages" is currently not supported`） | upstream：pure upstream `193de13a8` 同样失败 |
| opencode | `snapshot-tool-race`、`tool.shell permissions > normalizes external_directory workdir variants on Windows` | upstream：pure upstream 同样失败 |
| opencode | `offline Linux package > creates an offline archive…` | 环境：Windows 上 GNU tar 把 `C:` 当远程主机；HEAD 同样失败，Linux 构建产物已手工核对 |
| core | `Config > does not load legacy config.json files`、`shell > normalizes Git Bash shell paths from env` | HEAD 同样失败 |
| core | `Npm.add > reifies when package cache…` | 偶发：负载下 5000ms 超时，单独重跑两次通过 |
| tui | `app.exit prints the session epilogue…`、`formats session continuation summary` | 断言仍期望 `opencode -s`，实际为 HyperCode 品牌；upstream 测试文件，为控制 fork tax 不改 |
| tui | `DiffViewerFileTree > keeps loading and error quiet…` | 断言期望英文 `No files`，中文环境显示"没有文件"；同上不改 |
| tui | `abbreviates paths within home boundaries` | Windows 路径分隔符 `~\project`；HEAD 同样失败 |
| vscode | 5 个 `animates …` 测试 | 环境：`core.autocrlf=true` 使 CSS 为 CRLF，测试按 LF 匹配 |
| vscode | 20 个 `Cannot find package 'vscode'` | 环境：需在 VS Code 扩展宿主（`vscode-test`）中运行，`bun test` 无法加载 |

2026-09-16 基线中的"1 个 CLI help spacing snapshot"失败已不再出现。

### 下一次同步目标

见 `docs/阶段记录/专项_上游同步影响_20261113.md`：建议目标 v1.19.5（14 个真实冲突），合并前须先定案更新检查与 OpenCode 2.0 推销的处理；v2.2.7 单独立项。

---

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
