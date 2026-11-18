# Proposal

## Why

Cross-host contract 已让 MCP/LSP/formatter 的整体摘要由 Product 推导，但仍有几处没有落地，导致两端可能漂移、状态显示不真实：

- 一个 MCP 都没配置时显示"已禁用"而不是"未配置"：`deriveProductMcpSummary` 只接收 `configured: boolean`，零条目与全部禁用无法区分；`unconfigured` 在类型中存在但从不产生，`text.ts` 也没有对应 key。
- "是否已配置"由 Host 各算一份（`packages/tui/src/product/capability-adapter.ts`、`sdks/vscode/src/panel/provider/snapshot.ts:164`），VSCode 在缺配置时还用 `mcpStates.length > 0` 从运行时状态反推（`App.tsx:1465-1467`）。
- 单个 MCP 条目的文案与颜色由 Host 决定且已经不一致：`needs_client_registration` 在 TUI 显示为"失败"（`dialog-mcp.tsx` `mcpStatusLabel`），在 VSCode 显示为"需要客户端注册"（`status-picker.tsx`）。
- 设计要求的 MCP 运行时 `connecting` 与操作 pending 状态没有建模。
- 计划中的共享 capability fixture 不存在，两端 parity 测试各写一份内联数据，只覆盖 LSP idle、MCP failed 两个场景。
- TUI 负向边界测试方向写反：它**要求** `dialog-mcp.tsx` 存在 `availability === "failed" ||`，把 Host 侧优先级判断锁死。
- Contract 的完成标准"focused 测试、全部 typecheck、VSCode 打包通过"没有任何执行记录；现有 VSIX 早于最后一次 VSCode 源码提交。

## What Changes

- Product 从 Host 提供的原始配置事实（条目数、启用条目数、`lsp`/`formatter` 开关）推导配置状态，Host 不再传 `configured` 布尔值，也不再从运行时状态反推。
- MCP 摘要区分 `unconfigured`（零条目）与 `disabled`（有条目但全部禁用），新增 `status.mcp.unconfigured` 等文案 key（中英文）。
- Product 为每个 MCP/LSP/formatter 条目输出语义 `textKey` 与 `severity`，Host 只做 key 本地化与 severity → 视觉 token 映射。
- MCP 状态建模 `connecting` 与 pending 操作（由 Host 上报 pending 事实，Product 决定显示与可用动作）。
- 新增 `packages/product/test/fixtures/capability-states.ts`，两端 adapter 用同一份 fixture 断言 Product 结果一致；覆盖 unconfigured、disabled、idle、healthy、degraded、failed、needs_auth、needs_client_registration、unsupported、pending。
- 重写两端负向 ownership 测试，改为禁止 Host 中出现 availability 优先级判断与整体色调计算。
- 补齐 contract 的验证记录并重新打包 VSIX。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `cross-host-product-contract`：新增"能力配置状态与单条目语义由 Product 推导"的要求。

## Impact

- `packages/product/src/{capability,mcp,lsp,formatter,text}.ts` 及测试、fixtures
- `packages/tui/src/product/capability-adapter.ts`、`packages/tui/src/component/dialog-mcp.tsx`、footer/status 相关组件、`packages/tui/src/i18n/*`
- `sdks/vscode/src/panel/provider/snapshot.ts`、`bridge/types.ts`、`panel/webview/app/{App.tsx,state.ts,status-picker.tsx}`、`sdks/vscode/src/i18n/*`
- 测试：`packages/tui/test/product/*`、`sdks/vscode/src/product/ownership-boundary.test.ts`、`sdks/vscode/src/test/parity/*`
- 与 `fix-cross-host-command-dispatch` 无代码依赖，可并行；两者都需在完成后重新打包 VSIX
