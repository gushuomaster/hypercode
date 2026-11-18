# Phase 4 Final Architecture Closure

## 目标

完成 HyperCode exe/TUI 与 VSCode/VSIX 的 Product Alignment 架构收口。`packages/product` 是跨宿主行为投影与 canonical 状态的唯一 owner；TUI 和 VSCode 只保留 renderer、宿主能力和协议适配责任。

本阶段不改变 Protocol、Server `HttpApi` 或 generated client，也不把 messages、parts、raw protocol payload 搬入 Product。

## Ownership matrix

| 区域 | 当前 owner | 分类 | Phase 4 决策 |
| --- | --- | --- | --- |
| model catalog、composer selection、variant/fallback | `packages/product` | `SHARED_SINGLE_SOURCE` | 保留 Product；Host 只适配输入和渲染 |
| session reducer、mutation availability、pending/success/error | `packages/product` | `SHARED_SINGLE_SOURCE` | 保留 Product；Host 只发请求和确认事件 |
| subagent parent/children/navigation | `packages/product` | `SHARED_SINGLE_SOURCE` | 保留 Product；Host 只执行导航 |
| provider/MCP/LSP/formatter/locale/theme/command/help projection | `packages/product` | `SHARED_SINGLE_SOURCE` | 保留 Product；宿主 capability 仍可返回 `unsupported` |
| raw messages/parts、protocol payload、SDK response normalization | Core/Host | `HOST_SPECIFIC_VALID` | 不删除；这些不是 Product 行为规则 |
| VSCode `deferredUpdate` bridge 与 snapshot seed | VSCode bridge | `TRANSITIONAL_LEGACY` | 保留；仍承载异步 host payload 合并与旧协议字段 |
| VSCode legacy provider `all/default` fallback | VSCode provider adapter | `TRANSITIONAL_LEGACY` | 保留；外部服务响应兼容责任，不能证明可删除 |
| persisted panel/session state restore fallback | VSCode state/restore | `TRANSITIONAL_LEGACY` | 保留；持久化数据兼容责任 |
| TUI `thinking_visibility` migration、theme defaults、plugin command shim | TUI host | `TRANSITIONAL_LEGACY` | 保留；用户数据/插件 API 兼容责任 |
| VSCode raw `overallMcpStatus`/`overallLspStatus`/`overallFormatterStatus` | VSCode renderer helper | `DEAD_COMPATIBILITY` | 删除；无生产引用，仅重复 Product 投影 |
| Host-specific command/tag/session target construction | TUI/VSCode host | `HOST_SPECIFIC_VALID` | 保留；属于 API/宿主执行边界，不是 canonical rule |

## 删除准则

只删除同时满足以下条件的兼容代码：没有生产消费者、没有持久化或协议兼容责任、没有作为唯一诊断来源、并且 Product 或宿主现有 projection 已覆盖其行为。测试应迁移到实际 owner，而不是保留对 dead helper 的锁定。

## Parity 与验证

Phase 4 需要验证 Product full、TUI/VSCode related parity、两端 typecheck、VSCode package、diff hygiene，并记录 VSCode full suite 的环境相关失败集合。若 full suite 基线不可比，报告 `PARTIAL_BASELINE`，不把环境失败归因于 Product 改动。

