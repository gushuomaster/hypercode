# Design

## 基线与目标

| 项 | 值 |
| --- | --- |
| 正式主线 | `dev` = `90bd7d514`（已与 `origin/dev` 一致） |
| 同步基线 | `193de13a88d62a6409c6d385831180f1def527dc`（v1.18.30 之后的 upstream `dev` 提交） |
| 目标 | `v1.19.6` = `f4e363c829`（2026-11-17），基线是其祖先，209 个提交，581 个文件 |
| fork tax 基线 | `221 / 149 / 62 / 1538`（`reports/slimming/post-slimming-baseline.md`） |
| 不同步 | 2.x（v2.3.2）：HyperCode 的挂载文件在 2.x 已删除，另行立项 |

## 隔离方式

按《上游同步工作流总纲》的"等价隔离环境"：从 `dev` 建分支 `sync-v1-19-6`，在主工作区中执行 `git merge v1.19.6`。不用新 worktree 的原因：Windows 上新 worktree 的依赖安装曾因 `tree-sitter-powershell` 原生编译失败，VSCode 测试结果不可靠；主工作区依赖完整。合并、适配、验证、打包都在该分支完成。人工验收通过前，`dev` 不动、不推送。合并提交保留 upstream 历史（不 squash），便于下一次同步以 v1.19.6 为基线。

## 冲突处理（2026-11-18 试合并，16 个）

| 文件 | 方向 |
| --- | --- |
| `.gitignore` | 两边合并 |
| `.github/workflows/pr-management.yml` | 取 upstream（CI 不在交付面；HyperCode 侧改动若只是品牌化，保留） |
| `.opencode/command/changelog.md`、`translate.md` | 取 upstream 的 `model`，保留 `description_i18n` |
| `packages/opencode/script/build.ts` | 保留 upstream 构建改动与 HyperCode 产物命名、品牌注入 |
| `packages/opencode/src/cli/cmd/github.handler.ts`、`pr.ts` | 取 upstream 功能，保留 `UI.product` 等品牌化 |
| `packages/opencode/src/cli/cmd/upgrade.ts` | 见"更新渠道" |
| `packages/tui/src/app.tsx` | 取 upstream 的 `openUrl` 重构等；保留本地化与 Product 命令目录；不注册 `/update` |
| `packages/tui/src/routes/home.tsx`、`session/index.tsx`、`session/sidebar.tsx`、`feature-plugins/home/tips-view.tsx` | 取 upstream 功能，保留 HyperCode 文案；更新提示相关的接入不保留 |
| `sdks/vscode/package.json` | `version` 取 `1.19.6`，`publisher` 等品牌字段保持 HyperCode |
| `packages/opencode/test/cli/run/run-process.test.ts`、`test/share/share-next.test.ts` | 按功能合并 |

无法判断保留哪一侧时停止，列入阻塞清单交维护者。

## 更新渠道（Product Default Review：`PRESERVE_HYPERCODE_DEFAULT`）

upstream v1.19.x 的行为：省略 `autoupdate` 时联网检查版本；TUI 弹出 `/update` 对话框与更新提示；1.x 已最新时推销并安装 OpenCode 2.0；`opencode upgrade` 从 upstream 渠道安装。

HyperCode 的处理，按改动从小到大：

1. `packages/opencode/src/cli/upgrade.ts` 的 `upgrade()` 在 HyperCode 中直接返回 `undefined`。这是 TUI 更新提示与推销的唯一数据来源，返回 `undefined` 时 upstream 代码本身就不提示。
2. `packages/tui/src/app.tsx` 不注册 `/update` 命令，因此 TUI 和 VSCode 的命令列表都不出现它；`packages/tui/test/product/command-adapter.test.ts` 的 host_only 白名单保持不变。
3. `cli/cmd/upgrade.ts` 的 handler 开头输出本地化提示"HyperCode 没有在线更新渠道，请向管理员获取新的安装包"，并以退出码 1 结束；命令保留，以免旧文档中的 `hypercode upgrade` 报"未知命令"。
4. 新增 `dialog-update.tsx`、`update-notification.tsx` 原样保留（upstream 文件，不本地化）。因为已不可达，不加入 `hardcoded-copy` 清单；由第 5 条的测试保证不可达。
5. 回归测试：`upgrade()` 在 `autoupdate` 省略、为 `true`、为 `"notify"` 时都返回 `undefined` 且不发起网络请求；`hypercode upgrade` 输出中文提示并以非零退出；TUI 命令列表不含 `/update`。

`HYPERCODE_DISABLE_AUTOUPDATE=1` 继续保留在离线模板里，作为双保险。

`packages/desktop` 的 OpenCode 2 升级推销不处理：桌面版不在交付面，按 upstream 原样接收。

## 其他 Product Default Review

| upstream 变更 | 结论 |
| --- | --- |
| `debug config` 输出脱敏凭据 | `ACCEPT_UPSTREAM_DEFAULT`；核对用户文档中的示例输出 |
| Gemini 思考参数默认逻辑 | `ACCEPT_UPSTREAM_DEFAULT` |
| 按配置的推理选项生成 variants | `ACCEPT_UPSTREAM_DEFAULT`；验证 `/variants` 在 TUI 与 VSCode 结果一致 |
| 历史图片重发上限（v1.19.6） | `ACCEPT_UPSTREAM_DEFAULT` |

合并后若发现上表之外、触及默认值的变更，补充审查；无法定结论时标 `NEEDS_HUMAN_DECISION` 并停止。

## Cross-Host Product Contract Review

- `/update`：不注册，两端都不出现，`CROSS_HOST_CONTRACT_PRESERVED`。
- `/status` 插件名路径分隔符修复：只影响展示文本，核对与 Product 状态契约一致。
- 浏览器打开逻辑统一到 `@opencode-ai/core/open`：VSCode 不受影响。
- `/variants`：见上表。

## 验证

1. 五个包 typecheck：`packages/product`、`packages/core`、`packages/tui`、`packages/opencode`、`sdks/vscode`。
2. 全量测试，与基线文档的已知失败签名逐条对比；新失败先在 `dev` worktree 复跑，再在 pure upstream v1.19.6 worktree 复跑，按"新回归 / upstream / 环境"归因。新回归必须修复或升级为人工决策。
3. `bun run rebrand:check` 与基线签名（Blocked 0、Planned/Patchable 0/0、Manual 1）对比。
4. `packages/opencode/test/cli/localization-audit.test.ts` 的运行时英文基线：增加的条目本地化，减少的下调基线。
5. `-Mode Measure -CurrentRef HEAD` 重测 fork tax，解释与 `221 / 149 / 62 / 1538` 的差异。
6. 打包 Windows EXE、VSIX、Ubuntu 离线包，记录 SHA-256；EXE 内置冒烟、VSIX 品牌检查。

## 交付与回滚

- 目标状态 `READY_FOR_HUMAN_VSIX`：产物与人工验收清单交维护者。
- 人工验收通过且维护者确认后，`dev` 快进或合并 `sync-v1-19-6`，再推送。
- 回滚：验收前删除 worktree 与分支即可，`dev` 未受影响；合入后回滚用 `git revert -m 1 <合并提交>`。
