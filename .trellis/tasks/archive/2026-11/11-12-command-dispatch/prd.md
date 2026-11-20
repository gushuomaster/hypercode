# 修复跨宿主命令分发（fix-cross-host-command-dispatch）

## Goal

按 openspec/changes/fix-cross-host-command-dispatch 统一 VSCode 斜杠命令分发、实现 /help、区分不可用命令、TUI MCP 失败 toast 与回归测试

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.

## 关闭说明（2026-11-20）

本任务创建后未进入规划（上方 Requirements / Acceptance Criteria 仍为 TBD）。实际工作直接按 OpenSpec change `openspec/changes/fix-cross-host-command-dispatch/` 执行，并在 `467eb4d452` 中落地（tasks 13/14）。剩余 5.3 手工冒烟在该 change 中跟踪，随下一轮统一 VSIX 实机验证完成。本任务作为空壳归档，由 `11-20-state-cleanup` 收尾。
