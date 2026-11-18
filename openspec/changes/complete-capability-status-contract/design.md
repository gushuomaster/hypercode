# Design

## Context

- `packages/product/src/capability.ts` 的三个 `derive*Summary` 都接收 `{ configured: boolean; states }`。`ProductCapabilityAvailability` 声明了 `unconfigured`，但没有任何分支产生它。
- `ProductMcpAvailability` 只有 `connected | disabled | failed | needs_auth | needs_client_registration | unsupported`，没有 `connecting`/pending。
- TUI 的 `toProductCapabilityConfigured(config)` 与 VSCode `snapshot.ts` 的 `capabilityConfigured` 是同一规则的两份实现；VSCode webview 在 `capabilityConfigured` 缺失时用 `*States.length > 0` 兜底。
- 单条目文案：TUI `mcpStatusLabel`、VSCode `buildStatusPickerItems` 各自从 `availability` 选文案和颜色。
- Parity：`packages/tui/test/product/capability-summary-parity.test.ts` 与 VSCode 对应测试各自内联数据。
- 负向测试：`packages/tui/test/product/ownership-boundary.test.ts`（9 行）、`sdks/vscode/src/product/ownership-boundary.test.ts`（12 行）。

## Goals / Non-Goals

**Goals:**
- 配置事实 → 配置状态的推导只在 Product 中存在一份。
- 两端对任意 capability fixture 产生逐字段相同的 Product 结果。

**Non-Goals:**
- 不改变 LSP/formatter 的默认值（属于产品默认值决策 D3）。
- 不新增 MCP 管理能力（新增/删除 server），只改状态与文案语义。
- 不改 VSCode 编辑器自带语言服务的显示。

## Decisions

1. **Product 输入改为原始配置事实**：新增 `ProductCapabilityConfigInput = { mcp?: { name: string; enabled: boolean }[]; lsp?: boolean; formatter?: boolean }`，字段缺失表示"未知"。`derive*Summary` 接收该输入而非布尔值。Host adapter 只把 SDK `Config` 形态归一化为该输入（TUI 与 VSCode 各一份归一化函数，但不含判断规则）。备选是把 `toProductCapabilityConfigured` 挪进 Product 并直接接收 SDK `Config`——会让 Product 依赖 SDK 类型，违反 Schema → Core/Protocol → Server 的依赖方向，放弃。
2. **未知配置**：摘要新增 `availability: "unknown"`（或复用 `idle` + 专用 textKey，实施时以最小改动为准，需同步 `text.ts`），Host 不再兜底。
3. **单条目 textKey**：在 `ProductMcpState`、`ProductLspState`、`ProductFormatterState` 上增加 `textKey`，Product 依据 availability/pending 选择；Host 删除 `mcpStatusLabel` 与 picker 中的 availability 三元链。
4. **pending 建模**：Host 上报 `pending?: ProductMcpActionName` 作为输入事实；Product 输出 `availability: "connecting"`（连接/重连中）或保留原 availability 加 `pending` 字段（断开中），并清空 `availableActions` 中冲突项。
5. **共享 fixture**：`packages/product/test/fixtures/capability-states.ts` 导出"事实 → 期望 Product 结果"表，同时提供 TUI SDK 形态与 VSCode snapshot 形态的原始输入构造器；两端 parity 测试遍历同一张表。
6. **负向测试**：改为 grep 断言 Host 生产代码中不存在 `availability ===` 驱动的文案/色调选择、`*States.length > 0` 兜底与 `toProductCapabilityConfigured` 风格的规则判断；源码审计只作辅助，主证据是 fixture parity。

## Risks / Trade-offs

- [`ProductCapabilityAvailability` 增加取值会影响 Host 的 exhaustive 分支] → 先改 Product 与类型，依靠 typecheck 找出全部消费点。
- [TUI 插件 API 暴露的 raw MCP/LSP state 属于兼容保留项] → 不动插件 API，只改第一方视图。
- [VSCode bridge 协议字段变化（`capabilityConfigured` → 原始配置事实）] → 同一 VSIX 内 host 与 webview 同步发布，无跨版本兼容问题；保留旧字段读取一个版本即可删除。
