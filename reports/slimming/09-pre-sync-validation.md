# Phase 2 Pre-Sync Validation

## Baseline known failures / environment

- 主工作区在 Phase 1 前已有未提交内容：`AGENTS.md`、`packages/opencode/script/run-real-doubao.ts`、`sdks/vscode/.vscode-test/`；本阶段未修改、暂存、隐藏或删除。
- 隔离工作区由 `b192343c6` 创建，未继承主工作区未跟踪内容，也没有现成 `node_modules`。
- 隔离工作区执行 `bun install --frozen-lockfile` 时停留在 `Resolving dependencies`，无输出后中止；未改写锁文件。

## Static validation

- `git diff --check`：PASS。
- 删除后 `git grep -I -n -e 'src.rar' -e 'license.rar' -- .`：无引用（`NONE`）。
- 隔离工作区状态仅包含两个预期删除：PASS。
- 主工作区状态与审计前一致：PASS。

## Affected tests

- 主工作区 `packages/opencode`：`bun test test/license --timeout 30000` → **12 pass, 0 fail**。
- 隔离工作区同命令：无法执行完整测试，初始错误为 `preload not found "@opentui/solid/preload"`；原因是隔离工作区没有安装 workspace dependencies，记录为 `ENVIRONMENT_BLOCKER`。

## Typecheck

- 隔离工作区 `packages/opencode`：`bun typecheck` → 失败，首批错误为 `TS2307 Cannot find module ...`，覆盖 `effect`、`@opencode-ai/core/*`、`@opencode-ai/tui/*` 等未安装 workspace 依赖；记录为 `ENVIRONMENT_BLOCKER`。
- 主工作区 `packages/opencode`：`bun typecheck` → 失败，错误集中在用户已有未跟踪脚本 `script/run-real-doubao.ts` 的缺失模块和隐式 `any`，与本批次删除的两个归档无关；记录为 `BASELINE_FAILURE`。

## Build / Smoke

- 未运行 build 或 VS Code smoke；本批次只删除不参与构建/运行的归档容器，不需要额外产品 smoke。

## Trial Merge

- 在隔离工作区运行 `git merge-tree --write-tree HEAD refs/audit/opencode-dev`：保持 38 个 `content conflict`。
- 冲突文件集合与 Phase 1 报告一致；未新增冲突类型或文件。

## Regression assessment

- 本批次没有修改源码、配置、依赖、脚本或公共 API。
- 未发现由 Phase 2 引入的新 failure。
- 测试/typecheck 的不可执行或既有失败均已与本批次变更分离记录。

