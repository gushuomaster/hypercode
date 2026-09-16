# Phase 4.5 — Validation Environment Recovery

## 结论

- 状态：`PASS_WITH_WARNINGS`，不提升 Phase 4 的原有状态。
- 安装环境已恢复到可重复执行的 frozen baseline：`bun install --frozen-lockfile --offline` 成功。
- 在线安装仍不稳定：registry manifest 请求出现超时并长时间停留在最后安装任务；这属于网络/registry 传输问题，不是 lockfile 解析失败。
- 本次未升级依赖、未修改任何 manifest、未修改 `bun.lock`，也未修改业务代码。

## 环境调查

| 项目 | 结果 |
|---|---|
| Bun | `1.3.14`，与根 `package.json` 的 `packageManager` 一致 |
| Registry | `https://registry.npmjs.org/`；`effect`、`@opentui/solid` 请求可达并返回 `200` |
| Proxy | 未发现有效 proxy 环境变量；本机 npm 配置仅包含 `store-dir` |
| Workspace | Bun 正确识别 workspace；lockfile 解析为约 `2708` 个 package、`2416` 个安装项 |
| Platform | Windows x64；平台专属 optional packages 被正常跳过 |
| Cache | Bun cache 中 `drizzle-orm` tarball 文件完整；一次中断安装曾留下残缺 peer 变体 |

## 安装复现

1. `bun install --frozen-lockfile --verbose`：解析和下载取得进展，但 `aws4fetch`、`@storybook/addon-docs` manifest 多次 timeout，最终停留在等待任务。
2. `bun install --frozen-lockfile --offline`：成功，执行 `fix-node-pty` 与 `husky`，`2416` installs checked，无变更。
3. `sdks/vscode/bun install --frozen-lockfile --offline`：成功安装 `252` packages。
4. `bun install --frozen-lockfile --force`：重建链接时再次停留在最后任务，已中止；未保留其半成品目录。

安装成功后检查 `git status --short` 与 `git diff --name-only`，工作树保持干净，`bun.lock` blob 与 `HEAD:bun.lock` 一致。

## Post-Sync Validation

| 范围 | 命令 | 结果 | 分类 |
|---|---|---|---|
| Core | `packages/core bun typecheck` | 初次 FAIL；重新链接后 PASS | 初次为残缺 Drizzle variant cascade；恢复后不再复现 |
| Core | `packages/core bun test --only-failures` | `269 pass / 110 fail / 108 errors` | `BASELINE_FAILURE` |
| OpenCode | `packages/opencode bun typecheck` | FAIL；Effect/Drizzle 类型错误 | `BASELINE_FAILURE` |
| OpenCode | `packages/opencode bun test --timeout 30000 --only-failures` | `457 pass / 205 fail / 204 errors` | `BASELINE_FAILURE` |
| TUI | `packages/tui bun typecheck` | 初次 FAIL；重新链接后 PASS | 初次为残缺 Drizzle variant cascade；恢复后不再复现 |
| TUI | `packages/tui bun test --timeout 30000 --only-failures` | `194 pass / 1 skip / 3 fail / 1 error` | `BASELINE_FAILURE`；含 Windows 路径分隔符与 HyperCode 品牌断言差异 |
| App | `packages/app bun run typecheck` | PASS | — |
| App | `packages/app bun run build` | PASS（Vite warnings） | `PASS_WITH_WARNINGS` |
| OpenCode build | `packages/opencode bun run build` | FAIL；构建脚本内部 `bun add` 后触发 Drizzle 模块缺失 | `BASELINE_FAILURE`；同时曾生成 lockfile/manifest 改动，已精确恢复 |
| VS Code | `sdks/vscode bun run check-types` | 初次 FAIL；R-001 后 PASS | `SYNC_INTRODUCED_REGRESSION`，已完成最小 adapter union 修复 |

## Phase 5 门槛

验证 baseline 虽可执行，但尚未达到全绿 `PASS`。在用户确认并完成独立依赖/基线失败归因前，Phase 5 禁止：

- 任何基于 runtime/test 通过的删除或替换决策；
- `HIGH_RISK_KEEP`、`NEEDS_REVIEW` 项的删除；
- 以构建或测试“通过”为依据的 fork surface 收缩；
- 修改依赖、lockfile、manifest 或业务代码来迁就当前环境。

仍允许继续的内容仅限不依赖 runtime baseline 的只读分析，例如 upstream overlap、patch surface 和冲突面统计。
