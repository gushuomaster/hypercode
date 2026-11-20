# Proposal

## Why

HyperCode 停在 OpenCode 1.18.30（合并提交 `0472ed062`，2026-09-14），upstream 已发布 v1.19.1–v1.19.5。下一次同步之前，现有的同步基线与环境已经不能直接使用：

- `reports/slimming/post-slimming-baseline.md` 记录的 fork tax `141 / 92 / 48 / 792`（upstream 改动文件 / 生产路径 / Core patch 路径 / 技术行数）已过时；按同一口径，当前 HEAD `359960c7d` 为 `218 / 149 / 62 / 1538`。增量来自 Product 跨宿主对齐（有意的成本），若不先固化为新基线，同步后的差异无法归因。
- baseline 中的已知债务描述过期：F-013 与 `windows-validation-build.test.ts` 类型问题已被 `485b115f1` 修复；`run-real-doubao.ts` 改为 tsconfig exclude，但债务仍在。
- 本地未配置 `upstream` remote（只有 `origin`），而同步 SOP 第一步是 `git fetch upstream`。
- Windows 上 pure upstream 与 pre-sync 对照 worktree 因 Bun hardlink 失败一直 `NOT_TESTED`（`22-validation-failure-ledger.md` F-002、`32-validation-blocker-ledger.md` B2），同步后无法把失败归因到 upstream 还是 HyperCode。
- 本地 `dev` 领先 `origin/dev` 6 个提交（`8d26fd458..359960c7d`）未推送；工作区有 openspec/trellis 迁移的暂存改动。同步 Prepare 要求干净工作区。

## What Changes

- 用 `scripts/sync-opencode-upstream.ps1 -Mode Measure` 重新测量并发布新的 fork tax 基线，更新 `post-slimming-baseline.md`（或新建基线文档）中的已知债务与验证基线。
- 配置 `upstream` remote 并 fetch，生成 1.18.30 → 最新 v1.19.x 的影响评估（三组 diff、可能冲突文件、触及 Product Default 与 Cross-Host Contract 门禁的变更清单），不执行合并。
- 解决或绕过 Windows 对照 worktree 的 Bun hardlink 问题（例如改用复制安装或在 Linux 环境执行对照），使对照验证可执行。
- 明确同步前的仓库状态要求：暂存改动已提交、`dev` 与 `origin/dev` 一致（推送需维护者确认）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无。本 change 只涉及同步基线、文档与工具环境，不改变产品行为；`skip_specs: true`。实际同步作为后续独立 change。）

## Impact

- `reports/slimming/post-slimming-baseline.md` 或新的基线文档
- `docs/规范/上游同步工作流总纲.md`、`docs/操作手册/上游同步操作流程.md`（引用新基线、对照验证方式）
- `scripts/sync-opencode-upstream.ps1`（如需支持对照 worktree 的替代安装方式）
- 本地 git 配置（新增 remote），不影响仓库内容
