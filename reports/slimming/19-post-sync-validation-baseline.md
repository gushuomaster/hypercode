# Phase 4 Post-Sync Validation Baseline

## Dependency Environment

- Worktree：`D:\project\hypercode\.worktrees\opencode-1.18.30-sync`
- Package manager：Bun `1.3.14`，lockfile 未修改。
- `bun install --frozen-lockfile`：两次停留在 `Resolving dependencies`，有限等待后中止；未产生 `node_modules`，未改变 tracked files。
- **状态：`VALIDATION_ENV_BLOCKED`**（网络/registry 解析无法完成）。

## Validation Matrix

| Area | Command / scope | Result | Classification / evidence |
|---|---|---|---|
| Typecheck | `packages/opencode/bun typecheck` | FAIL | `BASELINE_FAILURE`；缺少 `effect`、workspace package 等导致大量 `TS2307` |
| Typecheck | `packages/tui/bun typecheck` | FAIL | `BASELINE_FAILURE`；缺少 `@opentui/*`、`solid-js` 等依赖 |
| Affected tests | opencode config/session/provider/plugin tests | SKIPPED | 环境阻塞，不能猜测运行结果 |
| Core tests | `packages/core` package tests | SKIPPED | 环境阻塞 |
| Build | opencode/app/TUI/VS Code build | SKIPPED | 环境阻塞，未修改依赖或脚本以绕过 |
| Runtime smoke | CLI、server、MCP、session smoke | SKIPPED | 环境阻塞 |
| TUI | 受影响 TS 文件 Bun parse | PASS | 语法解析通过；不等价于 typecheck/runtime pass |
| VS Code | manifest JSON parse | PASS | `sdks/vscode/package.json` 可解析；package/check-types 未运行 |
| Session | TS parse + static diff review | PASS_WITH_WARNINGS | 解析通过；runtime tests 未执行 |
| Provider/plugin | TS parse + static diff review | PASS_WITH_WARNINGS | 解析通过；OAuth/provider tests 未执行 |
| Config | TS parse + JSON fixture parse | PASS_WITH_WARNINGS | 解析通过；fresh-home behavior 未运行 |

## Static Checks

- `git status --porcelain`：clean。
- merge parents：`b965c81d...` 与 `193de13a...` 正确。
- 目标与 merge diff 无残留 merge marker。
- 根/App/VS Code manifest 与 models fixture JSON 解析通过。
- 受影响 TS/TSX 文件使用 `bun build --external '*'` 语法扫描通过。

## Failure Separation

- `PRE_EXISTING_FAILURE` / `BASELINE_FAILURE`：缺依赖导致的模块解析和类型错误；不是本阶段可归因的功能回归。
- `NEW_POST_SYNC_FAILURE`：当前没有在可运行环境中观察到可独立归因的新失败；运行时证据仍待环境恢复。
- 不将 `SKIPPED` 或 `BASELINE_FAILURE` 记为 PASS。
