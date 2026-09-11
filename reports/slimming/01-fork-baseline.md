# HyperCode Fork Baseline

审计时间：2026-09-11（Asia/Shanghai）

## Repository

- 仓库：`https://github.com/gushuomaster/hypercode.git`
- 当前分支：`dev`
- 当前提交：`b192343c6302616d6639b7ae3b183f86cfe8fa41`
- 提交摘要：`b192343c6 merge: integrate local backup into dev`
- 默认开发分支：`dev`

## Git Status

状态：`WORKTREE_NOT_CLEAN`

审计开始前已存在以下工作区内容，本次审计未修改、暂存、隐藏或删除这些内容：

```text
 M AGENTS.md
?? packages/opencode/script/run-real-doubao.ts
?? sdks/vscode/.vscode-test/
```

当前分支与 `origin/dev` 对齐。未发现已配置的 OpenCode upstream remote。

## Remotes

```text
origin  https://github.com/gushuomaster/hypercode.git (fetch)
origin  https://github.com/gushuomaster/hypercode.git (push)
```

审计未修改 remote 配置。为读取上游对象，使用 URL fetch 创建了本地审计 ref：

- `refs/audit/opencode-dev`
- `refs/audit/opencode-1.15.11-custom`

## Workspace Structure

仓库是 Bun workspace monorepo。根 `package.json` 的 workspace 范围包括：

```text
packages/*
packages/console/*
packages/stats/*
packages/sdk/js
packages/slack
```

主要结构：

- `packages/`：应用、核心、CLI、TUI、UI、Desktop、Server、Provider/LLM、Plugin、SDK 等 workspace package。
- `sdks/vscode/`：HyperCode VS Code 扩展；不在根 Bun workspace 声明中，拥有独立 `package.json` 与 `bun.lock`。
- `.opencode/`：仓库级 agents、commands、plugins、skills、themes、tools 与配置。
- `script/`、`scripts/`：构建、发布、离线包、上游同步与 rebrand 脚本。
- `patches/`：Bun dependency patches。
- `docs/`、`specs/`：项目文档、设计与 V2 规范。
- `packages/core/migration/`、`packages/console/core/migrations/`：数据库迁移。
- `packages/*/test`、`packages/app/e2e/`、`sdks/vscode/src/test/`：单元、集成、E2E 与扩展测试。
- `packages/*/dist`、`release-artifacts/`、`tmp/`：生成物、交付物或临时目录；本阶段未判断其可删除性。

当前 `packages/` 顶层目录：

```text
app, cli, console, containers, core, desktop, docs,
effect-drizzle-sqlite, effect-sqlite-node, enterprise, function,
http-recorder, identity, llm, opencode, plugin, script, sdk,
server, slack, stats, storybook, tui, ui, web
```

## Package Manager and Languages

- Package manager：Bun `1.3.14`，依据根 `package.json.packageManager`、`bun.lock`、`bunfig.toml` 和 CI 命令确认。
- Task runner：Turbo `2.8.13`。
- 主要语言：TypeScript、TSX、JavaScript/MJS、CSS、SQL、Astro、Markdown/MDX。
- 辅助语言：Python（license generator）、PowerShell、Shell、Nix。
- Desktop 技术栈包含 Electron；UI 主要包含 SolidJS、Astro、Vite、Playwright。
- Rust/Go：仓库包含容器或基础设施相关线索，但未发现它们是当前主要业务源码语言；业务使用程度记为 `UNKNOWN`。

## Build Commands

验证拓扑仅记录，未在本阶段执行完整构建：

- CLI/Core app：从 `packages/opencode` 运行 `bun run build`。
- 独立 CLI package：从 `packages/cli` 运行 `bun run build`。
- App/Web UI：从 `packages/app` 运行 `bun run build`。
- Desktop：从 `packages/desktop` 运行 `bun run build` 或 `bun run package`。
- VS Code：从 `sdks/vscode` 运行 `bun run package`。
- Offline：根目录提供 `bun run build:offline-linux`、`bun run build:offline-windows`。
- Storybook：从 `packages/storybook` 运行 `bun run build`。

## Test Commands

- 根目录 `bun test` 被显式禁止：脚本返回 `do not run tests from root`。
- `packages/opencode`：`bun test --timeout 30000 --only-failures`；HTTP API 使用 `bun run test:httpapi`。
- `packages/core`：`bun test --only-failures`。
- `packages/tui`、`packages/llm`、`packages/effect-drizzle-sqlite`、`packages/http-recorder`：package 内运行 `bun test`。
- `packages/app`：`bun run test:unit`；E2E 使用 `bun run test:e2e:local` 或 Playwright。
- `packages/ui`：`bun test src --only-failures`。
- `sdks/vscode`：README 记录 `bun run check-types` 与 `bun run package`；测试脚本以该 package 实际 `package.json` 为准。

## Typecheck, Lint and Format

- 类型检查必须从受影响 package 目录运行 `bun typecheck`，不得直接运行 `tsc`。
- 根脚本 `bun typecheck` 实际调用 `bunx turbo typecheck`，但项目协作规则要求实际审查采用 package-level typecheck。
- 根 lint：`bun run lint`，实际调用 `oxlint`。
- VS Code lint：当前脚本显示 `lint skipped for migrated VS Code UI`，因此 lint 覆盖并不完整。
- 格式化入口：`script/format.ts` 与 Prettier 配置；本阶段未执行格式化。

## Detected OpenCode Upstream

- 官方仓库：`https://github.com/anomalyco/opencode.git`
- 证据：根 `package.json.repository.url`、上游同步 SOP、历史 merge 提交与可访问的官方 Git refs。
- 默认分支：`dev`
- 当前仓库未配置 `upstream` remote。

## Git Merge Base

```text
bf05e8a1224d6560f7a441f70d09e0c77e50e931
fix(mcp): preserve headers during auth and debug (#31802)
2026-06-10T23:12:02-05:00
```

选择理由：

1. `git merge-base HEAD refs/audit/opencode-dev` 返回该提交。
2. 它同时是历史同步提交 `ff0d165f9` 的第二父提交。
3. `git merge-base --is-ancestor` 证明它同时是当前 HyperCode 和目标 OpenCode 的祖先。

因此它是本轮三方差异与冲突分析的合理 Git merge base。

## Origin Snapshot Context

用户提供了来源快照：

```text
Repository: https://github.com/gushuomaster/opencode-1.15.11-custom
Branch: main
Commit: 68b660a667db17a4911524cc38fc081d71d1674f
Version: 1.15.11
```

该提交是无父提交的独立快照，与当前 HyperCode 历史不存在可计算的 Git merge base。它可作为来源背景或 snapshot comparison 输入，但不用于本报告的三方 merge-base 统计。

## Target OpenCode

```text
Target repository: https://github.com/anomalyco/opencode.git
Target branch: dev
Target commit: 193de13a88d62a6409c6d385831180f1def527dc
Target version: 1.18.30
Target commit date: 2026-09-10T15:33:35-05:00
Target message: fix(stats): normalize deepseek v4.1 flash
Exact target tag: UNKNOWN
```

选择理由：项目 SOP 明确要求以上游 `dev`/HEAD 为可信同步来源；审计时该提交是官方 `dev` 的远端头。这里只确定审计目标，不执行正式同步。
