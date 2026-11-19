# Implement

执行清单见 `openspec/changes/archive/2026-11-19-sync-upstream-v1-19-6/tasks.md`，按 1→7 顺序执行。具体命令见 `docs/操作手册/上游同步操作流程.md`。

审查节点：
- 第 2 节合并后：若有无法判断的冲突，停止并交维护者
- 第 4 节审查：若出现 `NEEDS_HUMAN_DECISION`，停止并交维护者
- 第 6 节结束：交付产物与验收清单，等待人工验收；第 7 节需维护者确认

回滚：验收前删除 worktree 与 `sync-v1-19-6` 分支即可。
