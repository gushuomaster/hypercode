# Conflict Map

## Evidence Basis

- HyperCode delta：merge base → `b192343c6`。
- Upstream delta：merge base → `193de13a8`。
- 同路径变化交集：89。
- `git merge-tree --write-tree HEAD refs/audit/opencode-dev`：38 个实际 content conflict。
- 同样的 merge 曾在 detached 临时 worktree 中执行；临时 worktree 已移除，主工作区状态与审计开始前一致。

## HIGH

### `packages/opencode/src/session/*`

- HyperCode Change：session processor、retry、session 主流程及相关测试均发生修改。
- Upstream Change：同文件继续演进，并伴随 Core/session architecture 和数据模型变化。
- Risk：`HIGH_CONFLICT`。
- Evidence：3 个生产文件和多项 session tests 发生实际 content conflict；上游 Core 有 364 个分类变化路径。

### `packages/opencode/src/plugin/*` 与 `packages/opencode/src/provider/*`

- HyperCode Change：provider/plugin compatibility、Codex/XAI/DigitalOcean 等实现发生修改。
- Upstream Change：provider SDK、路由、reasoning、鉴权与 plugin architecture 持续变化。
- Risk：`HIGH_CONFLICT`。
- Evidence：`digitalocean.ts`、`openai/codex.ts`、`xai.ts`、`provider.ts` 共 4 个实际冲突；同路径交集还包含 plugin loader 等文件。

### `packages/opencode/src/config/*` 与 `packages/core/src/config.ts`

- HyperCode Change：HyperCode bundled config、兼容配置和相关测试。
- Upstream Change：配置 schema、v1/v2 config 兼容与 Core config 继续演进。
- Risk：`HIGH_CONFLICT`。
- Evidence：`packages/core/src/config.ts` 和 `packages/opencode/src/config/config.ts` 实际冲突；对应测试也冲突。

### `packages/tui/src/*`

- HyperCode Change：品牌、中文化、prompt、plugin UI 和 session UI。
- Upstream Change：TUI app、prompt、Dynamic/session view 与 plugin 界面继续变化。
- Risk：`HIGH_CONFLICT`。
- Evidence：10 个精确同路径交集；5 个实际冲突，覆盖 app、prompt autocomplete/index、tips、diff viewer。

### `sdks/vscode/package.json`

- HyperCode Change：定义 `hypercode.*` commands、configuration、views、Activity Bar 与产品元数据。
- Upstream Change：VS Code extension package metadata 同样变化。
- Risk：`HIGH_CONFLICT`。
- Evidence：实际 content conflict；该文件是 HyperCode 扩展公开面入口。

### Root dependency/build metadata

- Path：`package.json`、`bun.lock`、`.github/workflows/test.yml`。
- HyperCode Change：品牌、workspace dependencies、build/test workflow。
- Upstream Change：版本、workspace package、依赖与 CI 大规模变化。
- Risk：`HIGH_CONFLICT`。
- Evidence：3 个文件均发生实际 content conflict；上游新增 7 个 workspace package name 和大量 dependency changes。

## MEDIUM

### `packages/app/src/*`

- HyperCode Change：中文与其他 i18n 文案、UI 行为调整。
- Upstream Change：App v2、prompt input、tabs、settings、workspace flows 大规模演进。
- Risk：`MEDIUM_CONFLICT`。
- Evidence：18 个精确同路径交集；3 个 i18n 文件实际冲突，另有 `packages/app/package.json` 冲突。

### `packages/opencode/src/mcp/*` 与 `packages/opencode/src/ide/*`

- HyperCode Change：MCP OAuth 与 IDE integration 修改。
- Upstream Change：相同实现继续变化。
- Risk：`MEDIUM_CONFLICT`，涉及认证回调时需按高敏感度审查。
- Evidence：`mcp/index.ts`、`mcp/oauth-callback.ts`、`ide/index.ts` 实际冲突。

### `packages/opencode/test/*`

- HyperCode Change：CLI、session、config、server、tool 行为测试。
- Upstream Change：相同测试随架构与行为调整。
- Risk：`MEDIUM_CONFLICT`。
- Evidence：16 个精确同路径交集，11 个实际冲突。风险主要是测试语义漂移，不应简单选择任一侧。

### `packages/storybook/.storybook/*`

- HyperCode Change：Solid Router mock 调整。
- Upstream Change：相同 mock 变化。
- Risk：`MEDIUM_CONFLICT`。
- Evidence：`mocks/solid-router.tsx` 实际冲突。

## LOW

### HyperCode-only VS Code implementation files

- HyperCode Change：约 218 个 `sdks/vscode/src` 路径构成增强产品层。
- Upstream Change：上游同目录仍是轻量扩展，绝大多数 HyperCode 文件没有同路径变化。
- Risk：`LOW_CONFLICT`（直接文本冲突低），但 API integration 风险不为零。
- Evidence：Trial Merge 仅 `sdks/vscode/package.json` 冲突，产品源码未产生 content conflict。

### HyperCode docs and sync scripts

- HyperCode Change：`docs/`、`scripts/rebrand-*`、`scripts/sync-*`。
- Upstream Change：没有明显同路径大规模变化。
- Risk：`LOW_CONFLICT`。
- Evidence：无实际 merge conflict；这些内容主要是 HyperCode-only。

### License/offline packaging modules

- HyperCode Change：新增 license generator/runtime 与 offline package scripts。
- Upstream Change：没有同路径修改。
- Risk：`LOW_CONFLICT`（文本层面）。
- Evidence：无实际 merge conflict；功能是否仍适配目标架构需要同步后验证。

## NO_OBVIOUS_CONFLICT

- `.opencode/` 中 HyperCode-only agents/commands/skills：未进入实际冲突清单。
- HyperCode 阶段记录与用户指南：未进入实际冲突清单。
- `scripts/rebrand-opencode-to-hypercode.mjs`、`scripts/sync-opencode-upstream.ps1`：未进入实际冲突清单。

`NO_OBVIOUS_CONFLICT` 仅表示未发现直接路径冲突，不代表功能兼容已经验证。

## Actual Trial Merge Conflicts

实际冲突数：38，全部为 content conflict。未观察到 modify/delete、add/add 或 rename conflict。

```text
.github/workflows/test.yml
bun.lock
package.json
packages/app/package.json
packages/app/src/i18n/en.ts
packages/app/src/i18n/pl.ts
packages/app/src/i18n/zh.ts
packages/core/src/config.ts
packages/opencode/src/cli/cmd/run/splash.ts
packages/opencode/src/config/config.ts
packages/opencode/src/ide/index.ts
packages/opencode/src/mcp/index.ts
packages/opencode/src/mcp/oauth-callback.ts
packages/opencode/src/plugin/digitalocean.ts
packages/opencode/src/plugin/openai/codex.ts
packages/opencode/src/plugin/xai.ts
packages/opencode/src/provider/provider.ts
packages/opencode/src/session/processor.ts
packages/opencode/src/session/retry.ts
packages/opencode/src/session/session.ts
packages/opencode/test/cli/help/__snapshots__/help-snapshots.test.ts.snap
packages/opencode/test/cli/run/run-process.test.ts
packages/opencode/test/config/config.test.ts
packages/opencode/test/lib/cli-process.ts
packages/opencode/test/server/httpapi-file.test.ts
packages/opencode/test/server/httpapi-v2-location.test.ts
packages/opencode/test/session/compaction.test.ts
packages/opencode/test/session/prompt.test.ts
packages/opencode/test/session/retry.test.ts
packages/opencode/test/share/share-next.test.ts
packages/opencode/test/tool/fixtures/models-api.json
packages/storybook/.storybook/mocks/solid-router.tsx
packages/tui/src/app.tsx
packages/tui/src/component/prompt/autocomplete.tsx
packages/tui/src/component/prompt/index.tsx
packages/tui/src/feature-plugins/home/tips-view.tsx
packages/tui/src/feature-plugins/system/diff-viewer.tsx
sdks/vscode/package.json
```

按区域：

| 区域 | 冲突数 |
| --- | ---: |
| `packages/opencode/test` | 11 |
| `packages/tui/src` | 5 |
| `packages/opencode/src/session` | 3 |
| `packages/app/src` | 3 |
| `packages/opencode/src/plugin` | 3 |
| `packages/opencode/src/mcp` | 2 |
| 其他区域 | 11 |

## Recovery Evidence

Trial Merge 使用 detached 临时 worktree `D:\project\hypercode-audit-trial`。该 worktree 在命令结束时已不存在，`git worktree list` 仅剩主工作区。主工作区最终状态仍为：

```text
## dev...origin/dev
 M AGENTS.md
?? packages/opencode/script/run-real-doubao.ts
?? sdks/vscode/.vscode-test/
```

与 Trial Merge 前一致。
