# Phase 5 Guardrails（Phase 4.8 产出）

> 本报告的历史 Gate 记录为 `NOT_READY_FOR_PHASE_5`；Phase 4 Final Gate Review 已将其收敛为受限的 `READY_FOR_PHASE_5A`。

## Gate

当前仍为 `NOT_READY_FOR_PHASE_5`。原因不是单一 typecheck 红灯，而是 A/B runtime baseline 缺失、OpenCode 存在历史 type debt、Core/TUI 存在平台/fixture 红灯，且完整 broad validation 尚未达到可比较的全绿基线。

## 禁止事项

1. 不启动 Deep Slimming，不删除 `HIGH_RISK_KEEP` 或 `NEEDS_REVIEW`。
2. 不以“custom 文件”或文件数量作为删除依据。
3. 不修改依赖、manifest、`bun.lock`、build script 来换取安装或构建成功。
4. 不修改测试断言来掩盖 HyperCode branding、中文化或 Windows 行为差异。
5. 不把 A/B `NOT_TESTED` 写成通过，也不把 broad cascade 计数当成业务回归数量。

## 允许事项

- 继续只读分析 upstream overlap、modified upstream paths、core patch 排名、VS Code fork surface 和冲突频率。
- 对明确的 `SYNC_INTRODUCED_REGRESSION` 做单文件最小修复，但必须保留失败复现、源码对照和 package-local 验证证据。
- 继续建立 area validation gates；任何区域只有在自身验证闭合后，才可进入后续候选评审。

## 成功条件

Phase 5 只能在以下条件同时满足后重新评估：

- A/B pure upstream 与 pre-sync worktree 可重复执行 frozen install 和最小 runtime smoke；
- Core、OpenCode、TUI、VS Code 的 baseline 结果可按 primary cluster 对照；
- modified upstream paths、core patches 和 conflict surface 有可复测基线；
- branding、localization、offline、config、provider、OAuth、session、TUI、VS Code、Drizzle/build 各区域均有明确 gate；
- 任何 slimming 变更都保持自定义能力和 validation baseline。
