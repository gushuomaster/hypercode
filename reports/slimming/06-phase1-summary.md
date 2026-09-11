# HyperCode Slimming Phase 0 / Phase 1 Summary

## Direct Answers

1. **HyperCode 当前基于什么 OpenCode 基线？** 真实 Git merge base 为 `bf05e8a1224d6560f7a441f70d09e0c77e50e931`。用户提供的 `opencode-1.15.11-custom@68b660a6` 是独立来源快照，不是本轮 Git merge base。
2. **计划同步到什么版本？** 官方 `https://github.com/anomalyco/opencode.git` 的 `dev@193de13a88d62a6409c6d385831180f1def527dc`，package version `1.18.30`，exact tag 为 `UNKNOWN`。
3. **HyperCode 修改了多少 OpenCode 原生文件？** 149 个既有路径发生变化，其中 144 个为 `M`，5 个为 type change。
4. **HyperCode 新增了多少文件？** 282。
5. **HyperCode 删除了多少上游文件？** 0。
6. **有多少 HyperCode-only package/module？** 1 个独占 package name；7 个主要自定义 module group。
7. **最大的 Fork Surface 在哪里？** `sdks/vscode`，尤其 `sdks/vscode/src` 的 218 个变化路径；其次是 `packages/opencode` 和测试层。
8. **哪些目录同时被双方大量修改？** `packages/opencode/src`（30 个精确交集）、`packages/app/src`（18）、`packages/opencode/test`（16）、`packages/tui/src`（10）。
9. **Trial Merge 实际产生多少冲突？** 38 个，全部为 content conflict。
10. **哪些区域属于 HIGH_CONFLICT？** Session、provider/plugin、config、TUI、VS Code public metadata、根 dependency/build metadata。
11. **哪些区域可能适合 Phase 2 低风险 cleanup？** 当前没有区域达到 `SAFE_CLEANUP_CANDIDATE` 的证据门槛。生成物、归档和临时目录只能列为 `NEEDS_MORE_EVIDENCE`。
12. **哪些区域必须 DEFER_UNTIL_SYNC？** Session、provider/plugin、config、TUI、App i18n/UI、VS Code metadata、dependencies/CI、旧 server/UI API 使用点。
13. **是否发现可能被新版 OpenCode 覆盖的 HyperCode 功能？** 是，provider/model、部分 config、session、CLI 行为存在 `POSSIBLE_UPSTREAM_OVERLAP`；尚无足够证据认定功能等价。
14. **当前是否具备进入 Phase 2 的条件？** 仅具备继续做证据型、低风险候选调查的条件；不具备在同步前直接清理高耦合区域的条件。

## HyperCode Fork Baseline

```text
Modified upstream files: 149 (144 M + 5 type changes)
Added HyperCode files: 282
Deleted upstream files: 0
Renamed files: 0

HyperCode-only packages: 1
HyperCode-only modules: 7 major module groups

High-conflict areas: 6
Medium-conflict areas: 4
Low-conflict areas: 3

Trial merge conflicts: 38 content conflicts

Core fork surface: 25 files / approx. 465 changed lines
Server fork surface: 9 files / approx. 47 changed lines
CLI fork surface: 20 files / approx. 285 changed lines
TUI fork surface: 28 files / approx. 1,717 changed lines
UI fork surface: 22 files / approx. 152 changed lines
Provider fork surface: 2 files / approx. 9 changed lines
Plugin fork surface: 150 files / approx. 32,956 changed lines
Agent/Skill fork surface: AGENT 0 files; SKILL 1 file
Command/Prompt fork surface: COMMAND 0 files; PROMPT 11 files
Config/Patch fork surface: CONFIG 11 files; PATCH 0 files

Candidate pre-sync cleanup areas: 0 confirmed-safe areas
Deferred areas: session, provider/plugin, config, TUI, App UI/i18n,
                VS Code metadata, dependency/CI, moved server/UI APIs
```

注：分类为互斥路径映射。`PLUGIN` 包含增强 VS Code extension，`TEST` 单独分类，因此业务模块的测试规模未重复计入各模块。

## Phase 2 Candidate Areas

### `SAFE_CLEANUP_CANDIDATE`

```text
NONE
```

当前没有通过“已弃用、确认未引用或明确临时生成物”完整证据链的候选项。

### `NEEDS_MORE_EVIDENCE`

- `packages/opencode/src.rar`、`packages/opencode/script/license.rar`：看似归档，但尚未确认发布或运维依赖。
- `packages/opencode/dist`、`sdks/vscode/dist`、`release-artifacts`：具有生成物特征，但需先确认 tracked 状态、交付流程和复现方式。
- `tmp/` 下 source/vendor/compare 目录：名称显示临时用途，但需要所有权与引用检查。
- License generator/runtime：现有代码与长期规范边界存在表面张力，需要产品事实确认。
- 旧设计、计划和阶段记录：具有历史审计价值，不能因“已完成”直接删除。

### `DEFER_UNTIL_SYNC`

- `packages/opencode/src/session`。
- `packages/opencode/src/provider`、`packages/opencode/src/plugin`。
- `packages/opencode/src/config`、`packages/core/src/config.ts`。
- `packages/tui/src`。
- `packages/app/src` i18n/UI。
- `sdks/vscode/package.json` 与上游 API adapter。
- `package.json`、`bun.lock`、CI workflow。
- 上游已迁移到 `protocol`、`schema`、`session-ui` 的旧 API 使用点。

### `HIGH_CONFLICT_AREA`

见 `04-conflict-map.md`，实际冲突证据覆盖 38 个文件。

### `DO_NOT_TOUCH_PRE_SYNC`

- Session execution、provider routing、config schema/bootstrap。
- HyperCode public commands/settings/views 和 VS Code extension identity。
- TUI 用户可见中文与品牌边界。
- Dependency lock 与 workspace package graph。
- 上游已删除或迁移的 Core/Server/UI API compatibility layer。

## Trial Merge Result

- 方法：detached 临时 worktree 中执行 `git merge --no-commit --no-ff refs/audit/opencode-dev`，并使用 `git merge-tree --write-tree` 复核冲突清单。
- 结果：38 个 content conflict；没有记录到 modify/delete、add/add 或 rename conflict。
- 恢复：临时 worktree 已移除；主工作区状态恢复并保持为审计前的 `WORKTREE_NOT_CLEAN` 状态。
- 正式分支：未执行 merge、commit、reset、stash、rebase 或业务代码修改。

## Readiness

已完成：Baseline、Merge Base、Target、HyperCode Delta、Upstream Delta、Fork Surface、Conflict Map、Feature Inventory 和隔离 Trial Merge 取证。

警告：

- 主工作区在审计开始前即不干净。
- 目标上游跨度达到 1,660 个 upstream-only commits，架构变化显著。
- 38 个真实冲突集中在核心运行路径。
- 89 个同路径交集之外仍可能存在 rename/API-level semantic conflict。
- 完整 build/test/typecheck 未执行，因为本阶段只建立验证拓扑，且当前主工作区不干净。

```text
PHASE_1_RESULT:

PASS_WITH_WARNINGS
```

原因：六项审计输出和 Trial Merge 证据已建立，且未修改业务代码；但工作区不干净、目标跨度大、核心区存在 38 个真实冲突，不能直接进入实际 slimming 或同步。
