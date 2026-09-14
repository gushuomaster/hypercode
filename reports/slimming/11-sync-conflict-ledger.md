# Phase 3 Sync Conflict Ledger

- Target: `193de13a88d62a6409c6d385831180f1def527dc` (OpenCode 1.18.30)
- Pre-sync head: `b965c81d32ceddd6f05e982ad99abc4e0dff93bb`
- Merge mode: `--no-ff`
- Status: in progress

## Decisions

| File | Decision | Evidence / rationale | Risk |
|---|---|---|---|
| `.github/workflows/test.yml` | `MANUAL_MERGE` | 保留 upstream 检查并合并 HyperCode Windows 测试步骤 | CI YAML 语法或平台矩阵变化需验证 |
| `bun.lock` | `MANUAL_MERGE` | 采用 upstream 依赖解析，保留 HyperCode 必需包 | lockfile 漂移可能影响离线安装 |
| `package.json` | `MANUAL_MERGE` | 保留品牌/offline scripts，叠加 upstream 脚本 | 脚本条件变化需 package 校验 |
| `packages/app/package.json` | `MANUAL_MERGE` | 采用 upstream ghostty-web pin，保留 HyperCode manifest 差异 | 依赖版本需与 lockfile 一致 |
| `packages/app/src/i18n/en.ts` | `MANUAL_MERGE` | 保留 upstream 新 key 与 HyperCode 品牌文案 | key 漏译风险 |
| `packages/app/src/i18n/pl.ts` | `MANUAL_MERGE` | 保留 upstream 新 key 与现有本地化 | key shape 不一致风险 |
| `packages/app/src/i18n/zh.ts` | `MANUAL_MERGE` | 保留 upstream 新 key 与简体中文品牌文案 | 文案回退英文风险 |
| `packages/core/src/config.ts` | `MANUAL_MERGE` | 保留配置文件兼容性并迁移 upstream 行为 | 配置发现路径回归风险 |
| `packages/opencode/src/cli/cmd/run/splash.ts` | `MANUAL_MERGE` | 保留 HyperCode CLI 品牌显示并核对 upstream `--mini` | 启动参数/快照风险 |
| `packages/opencode/src/config/config.ts` | `MANUAL_MERGE` | 迁移 upstream config lifecycle，保留 bundled config 兼容 | 配置加载优先级风险 |
| `packages/opencode/src/ide/index.ts` | `MANUAL_MERGE` | 保留 upstream `IdeEvent` schema 与 HyperCode VS Code ID | IDE 事件兼容风险 |
| `packages/opencode/src/mcp/index.ts` | `MANUAL_MERGE` | 保留 upstream directory/client 语义与 HyperCode 品牌 client name | MCP 连接/认证风险 |
| `packages/opencode/src/mcp/oauth-callback.ts` | `MANUAL_MERGE` | 保留 upstream auth commit 语义与本地品牌上下文 | OAuth 回调失败风险 |
| `packages/opencode/src/plugin/digitalocean.ts` | `MANUAL_MERGE` | 迁移 upstream plugin API，保留 HyperCode provider metadata | provider 初始化风险 |
| `packages/opencode/src/plugin/openai/codex.ts` | `MANUAL_MERGE` | 迁移 upstream Codex plugin 变化并保留本地差异 | OAuth/provider 行为风险 |
| `packages/opencode/src/plugin/xai.ts` | `MANUAL_MERGE` | 迁移 upstream xAI plugin API 与本地 provider 配置 | 模型请求参数风险 |
| `packages/opencode/src/provider/provider.ts` | `MANUAL_MERGE` | 以 upstream provider registry 为主，保留 HyperCode 增强 | provider 列表/默认值风险 |
| `packages/opencode/src/session/processor.ts` | `MANUAL_MERGE` | 以 upstream session processing 为主，核对本地行为 | 会话执行回归风险 |
| `packages/opencode/src/session/retry.ts` | `MANUAL_MERGE` | 迁移 upstream retry 语义并保留必要本地处理 | 重试次数/退避风险 |
| `packages/opencode/src/session/session.ts` | `MANUAL_MERGE` | 保留 upstream session API 与 HyperCode 兼容入口 | session 状态回归风险 |
| `packages/opencode/test/cli/help/__snapshots__/help-snapshots.test.ts.snap` | `MANUAL_MERGE` | 快照同步新命令并保留 HyperCode 文案 | 快照误差风险 |
| `packages/opencode/test/cli/run/run-process.test.ts` | `MANUAL_MERGE` | 合并 upstream 测试与 HyperCode CLI 断言 | 测试覆盖漂移风险 |
| `packages/opencode/test/config/config.test.ts` | `MANUAL_MERGE` | 合并配置生命周期与兼容路径测试 | 配置回归漏测风险 |
| `packages/opencode/test/lib/cli-process.ts` | `MANUAL_MERGE` | 采用 upstream 测试 helper 并保留品牌环境设置 | 测试进程启动差异 |
| `packages/opencode/test/server/httpapi-file.test.ts` | `MANUAL_MERGE` | 迁移 upstream API 测试，保留本地文件语义 | HTTP API 回归风险 |
| `packages/opencode/test/server/httpapi-v2-location.test.ts` | `MANUAL_MERGE` | 保留 V2 location 覆盖并同步 upstream 断言 | location 语义风险 |
| `packages/opencode/test/session/compaction.test.ts` | `MANUAL_MERGE` | 合并上游 compaction 测试与本地上下文 | 压缩行为回归风险 |
| `packages/opencode/test/session/prompt.test.ts` | `MANUAL_MERGE` | 合并 prompt 测试并保留 V2 约束 | prompt 持久化回归风险 |
| `packages/opencode/test/session/retry.test.ts` | `MANUAL_MERGE` | 同步 retry 测试与 HyperCode 断言 | retry 回归风险 |
| `packages/opencode/test/share/share-next.test.ts` | `MANUAL_MERGE` | 合并分享 API 测试变更 | 分享流程回归风险 |
| `packages/opencode/test/tool/fixtures/models-api.json` | `MANUAL_MERGE` | 采用 upstream fixture schema，保留本地 provider 样例 | fixture 与实现不一致风险 |
| `packages/storybook/.storybook/mocks/solid-router.tsx` | `MANUAL_MERGE` | 保留 upstream 新 mock API 与现有导出 | storybook 编译风险 |
| `packages/tui/src/app.tsx` | `MANUAL_MERGE` | 优先 upstream TUI 结构，最小保留中文/品牌 | TUI 启动回归风险 |
| `packages/tui/src/component/prompt/autocomplete.tsx` | `MANUAL_MERGE` | 同步 upstream autocomplete 行为并保留中文提示 | 输入交互回归风险 |
| `packages/tui/src/component/prompt/index.tsx` | `MANUAL_MERGE` | 同步 upstream prompt API 与本地交互 | prompt 状态回归风险 |
| `packages/tui/src/feature-plugins/home/tips-view.tsx` | `MANUAL_MERGE` | 保留中文 tips 与 upstream 内容结构 | 文案/渲染风险 |
| `packages/tui/src/feature-plugins/system/diff-viewer.tsx` | `MANUAL_MERGE` | 采用 upstream diff viewer 结构并保留本地标签 | diff 显示回归风险 |
| `sdks/vscode/package.json` | `MANUAL_MERGE` | 采用 upstream 扩展 metadata，同时保留 HyperCode ID/命令 | 扩展安装兼容风险 |

## Batch Notes

- 冲突已全部解决；最终 merge 前执行 unmerged-path 检查。

## TUI Resolution (Phase 3)

| 文件 | 决策 | 证据与处理 | 风险 |
|---|---|---|---|
| `packages/tui/src/app.tsx` | `MANUAL_MERGE` | 保留 HyperCode 终端标题、语言切换及禁用自动更新弹窗；合并 upstream `PermissionProvider` 已有结构与 `permission.mode` 命令。 | 权限切换文案仍为 upstream 英文；更新弹窗保持禁用为产品策略。 |
| `packages/tui/src/component/prompt/autocomplete.tsx` | `MANUAL_MERGE` | 采用 upstream autocomplete 数据结构，并以 V2 Agent schema 的 `agent.name` 调用本地 mention 插入逻辑。 | agent mention 行为依赖本地 `prepareAgentMention`，需配套 prompt 回归测试。 |
| `packages/tui/src/component/prompt/index.tsx` | `MANUAL_MERGE` | 合并 upstream `useLocation` 与 `registerOpencodeSpinner()` 初始化；保留本地中文 session.move 与 placeholder 文案。 | 中文 key 必须持续覆盖所有 locale。 |
| `packages/tui/src/feature-plugins/home/tips-view.tsx` | `KEEP_HYPERCODE` | 采用 HEAD 完整中文化 tips 列表；内容与 upstream 1.18.30 列表对应，避免重复显示英文 tips。 | 新增 upstream tip 若未来未同步到翻译 key，需 post-sync review。 |
| `packages/tui/src/feature-plugins/system/diff-viewer.tsx` | `MANUAL_MERGE` | 采用 upstream 动态 `branch` 差异源选项；工作树/上一轮标题继续使用 `translate("command.vcs.*")`。 | `Main branch` 尚无中文 locale key，当前保留 upstream 文案。 |

### TUI Validation

- `git diff --check -- packages/tui/src/app.tsx packages/tui/src/component/prompt/autocomplete.tsx packages/tui/src/component/prompt/index.tsx packages/tui/src/feature-plugins/home/tips-view.tsx packages/tui/src/feature-plugins/system/diff-viewer.tsx`：通过。
- `bun typecheck`（`packages/tui`）：语法冲突已消除；命令因 worktree 未安装依赖而产生大量 `TS2307`（`@opentui/*`、`solid-js` 等）基线环境错误，非本批次新增。 

## Core and Peripheral Resolution

- 38/38 冲突文件已逐文件解决并暂存；未发现残留冲突标记或 unmerged path。
- `bun` JSON 解析验证通过：根 manifest、App manifest、VS Code manifest、models fixture。
- `git diff --cached --check` 仅报告 upstream 新增 patch 文件中的既有空白告警；本批次源码无冲突格式错误。
- `packages/opencode` `bun typecheck` 被 worktree 缺少依赖阻断（大量 `TS2307`），归类为 `BASELINE_FAILURE`；未能执行受影响测试。
