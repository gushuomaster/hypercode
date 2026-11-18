# OpenCode 1.18.30 Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 HyperCode 同步到锁定的 OpenCode `193de13a88d62a6409c6d385831180f1def527dc`，解决全部冲突并保留必要产品能力。

**Architecture:** 先将 Phase 2 两个安全删除与审计报告固化为 `PRE_SYNC_HEAD`，再在隔离分支执行 `--no-ff` merge。按 metadata/dependency/CI/VS Code/config/provider-plugin/session/TUI 顺序逐项解决冲突，每个区域记录证据并局部验证，最后建立目标 commit → Synced HyperCode 的新 Fork Baseline。

**Tech Stack:** Git merge/rerere、Bun workspace、TypeScript、Solid/OpenTUI、VS Code extension。

**Spec:** `C:/Users/28320/.codex/attachments/a0805565-d4e5-47fa-8cc5-236b67f515eb/pasted-text.txt`

## Global Constraints

- 精确目标固定为 `193de13a88d62a6409c6d385831180f1def527dc`。
- 使用 merge，不使用 rebase，不重写 HyperCode 历史。
- 不在 dirty 主工作区执行 merge，不自动 stash/reset/clean/restore 用户内容。
- 不进行架构重构、Feature Parity 大规模删除、Core → Plugin、目录重组、全仓格式化或额外依赖升级。
- 38 个冲突逐项语义裁决，不批量采用任何一侧。
- 仅修复 Phase 3 同步直接引入的 regression。

---

### Task 1: 建立 Pre-Sync 基点

**Files:** Phase 0–2 reports、两个 `.rar` 删除。

- [ ] 复制 Phase 0–2 报告到隔离工作区。
- [ ] 删除 `packages/opencode/src.rar` 与 `packages/opencode/script/license.rar`。
- [ ] 提交 `chore: establish pre-sync baseline` 并记录 `PRE_SYNC_HEAD`。

### Task 2: 执行锁定目标 Merge

**Files:** Git merge state、`reports/slimming/11-sync-conflict-ledger.md`。

- [ ] 校验目标对象与 package version。
- [ ] 启用 repository-local rerere。
- [ ] 执行 `git merge --no-ff 193de13a...`。
- [ ] 捕获全部实际冲突并建立 ledger 框架。

### Task 3: 解决机械与外围冲突

**Files:** CI、root manifests/lockfile、App metadata/i18n、VS Code manifest、storybook mock、CLI splash。

- [ ] 逐文件读取三方版本与历史意图。
- [ ] 保留目标依赖拓扑并叠加仍必要的 HyperCode 产品差异。
- [ ] 执行静态检查和可用的 package-level validation。
- [ ] 更新 conflict ledger。

### Task 4: 解决 Core 高风险冲突

**Files:** config、IDE/MCP、provider/plugin、session 及对应 tests/fixtures。

- [ ] 按 config → provider/plugin → session 顺序理解双方意图。
- [ ] 迁移仍必要的最小 HyperCode 行为到目标结构。
- [ ] 对同步回归使用 test-first 修复。
- [ ] 更新 ledger 与 Phase 4 review queue。

### Task 5: 解决 TUI 冲突

**Files:** `packages/tui/src` 五个冲突文件。

- [ ] 优先保留目标 TUI 结构。
- [ ] 最小移植中文化、品牌和交互差异。
- [ ] 运行 TUI package validation。
- [ ] 更新 ledger 与 review queue。

### Task 6: 完成 Merge 与验证

**Files:** 全部 merge 结果、`13-post-sync-validation.md`。

- [ ] 确认不存在 unmerged path。
- [ ] 运行 affected typecheck/tests/build/smoke。
- [ ] 区分 `BASELINE_FAILURE` 与 `NEW_SYNC_REGRESSION`。
- [ ] 提交 merge commit。

### Task 7: 建立新 Fork Baseline

**Files:** `12-post-sync-review-queue.md`、`14-phase3-summary.md`。

- [ ] 按目标 commit → merge commit 重算 Fork Surface。
- [ ] 统计 conflict decisions 和区域差异。
- [ ] 回答 Phase 3 十五项总结问题。
- [ ] 验证报告、Git 历史与工作区状态。

