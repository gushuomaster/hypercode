# Phase 4 Final Architecture Closure Plan

1. 完成 Product/TUI/VSCode negative audit 与 ownership matrix。
2. 删除已证明无生产引用的重复 Product helper。
3. 为保留的 host-specific/transitional 边界补充 parity 断言与维护条件。
4. 运行分层测试、typecheck、VSCode package 和 full-suite 对比。
5. 记录 Fork Tax、遗留兼容项、删除条件与 maintenance baseline。

## Exit criteria

- Product 行为规则没有第二个 host-side owner。
- 删除项有零生产引用证据，保留项有明确兼容责任。
- Product/TUI/VSCode focused parity 无新增回归。
- Protocol、HttpApi、generated client 未修改。
- 文档记录当前 commit、验证结果、known failures 和后续清理触发条件。

