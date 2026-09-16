# Phase 9 Preservation Replay — Start

记录时间：2026-09-15（Asia/Shanghai）

## Current Safety Point

- Branch：`dev`
- HEAD：`25390fa4d34da1acf315ceabcd027baf62de26bd`
- Upstream：`origin/dev`，当前 `dev` ahead `1672`
- Merge state：无 `MERGE_HEAD`，无 unmerged path
- 当前状态：`INTEGRATED_WITH_MANUAL_REPLAY_GUARDRAILS`

## Current Working Tree

本阶段开始前，工作树已有以下内容；本报告创建前未应用 stash：

```text
 M scripts/sync-opencode-upstream.ps1
?? packages/opencode/script/run-real-doubao.ts
?? packages/opencode/test/script/upstream-sync-workflow.test.ts
?? reports/slimming/future-opencode-sync-workflow.md
?? reports/slimming/post-slimming-baseline.md
?? reports/slimming/post-slimming-integration-report.md
?? sdks/vscode/.vscode-test/
```

## Preservation Stashes

| Ref | Hash | Source | State |
|---|---|---|---|
| `stash@{0}` | `125c4541d6270b7e911631d3a334bc7e834ee5c1` | residual tracked `dev` dirty | preserved |
| `stash@{1}` | `4c3f7690e2863188f7fa3e9c729060f3fcddd336` | primary `dev` snapshot | preserved |
| `stash@{2}` | `3674c90ad0b99c877a70348af05c28ef1c9985fb` | slimming worktree dirty | preserved |

## Replay Rules

- 本阶段禁止 `git stash pop`、reset、clean、stash drop 和目录级覆盖。
- 先用 stash parent 与当前 HEAD 做文件级分类，再逐文件恢复。
- `AGENTS.md`、`reports/`、Session、Provider lifecycle、Plugin architecture、TUI、VS Code runtime 默认进入人工清单。
- `bun.lock`、manifest 和 dependency topology 不自动恢复。

后续文件级证据见 `phase9-stash-inventory.md` 与 `manual-replay-required.md`。
