# Host 适配与所有权边界测试

适用于 `packages/tui/src/product`、`sdks/vscode/src/product` 以及两个 Host 里消费 Product 输出的代码。

## Host 的职责

Host 只负责 render、host API、持久化、SDK 与 protocol 归一化、input、focus、scroll、keyboard 与 mouse，以及 editor 与 terminal 能力上报。Host 拿到 Product 的输出后渲染，不再二次判断。

## adapter 的写法

两端的 adapter 目录结构对应：

- TUI：`packages/tui/src/product/*-adapter.ts`
- VSCode：`sdks/vscode/src/product/*-adapter.ts`

命令 adapter（`command-adapter.ts`）的共同模式：

- 声明 `targets: Record<ProductCommandID, ...>`，把 Product 的命令 ID 映射到宿主自己的命令。TUI 映射到 keymap 命令名字符串，VSCode 映射到 `VsCodeCommandTarget` 联合类型。因为键类型是 `ProductCommandID`，Product 新增 ID 时类型检查会强制补齐。
- 调用 Product 的 `deriveProductCommandCatalog` 与 `resolveProductCommand`，不自己筛选或排序。
- 动态命令（插件、服务端下发）用内置 ID 集合排除，不能按 `scope` 过滤：动态命令的 `scope` 也可能是 `shared_surface_optional`，按 scope 过滤会让它们被当成内置命令重复投影到菜单里。参考 `toTuiDynamicProductCommands`。
- 宿主确实不支持的命令，在 `supported` 里声明为 `false`，由 Product 返回 `unsupported`。例如 VSCode 只有消息级别的 fork，没有会话级别的，所以 `session.fork` 在 VSCode 里为 `false`。

## 所有权边界测试

每个 Host 各有一份 `ownership-boundary.test.ts`：

- TUI：`packages/tui/test/product/ownership-boundary.test.ts`（`bun:test`）
- VSCode：`sdks/vscode/src/product/ownership-boundary.test.ts`（`node:test`）

它们读取 Host 源码，用正则断言违规写法不存在，目前覆盖：

- Host 文件里不能出现 `availability === "failed"`、`"connected"`、`"disabled"`、`"needs_auth"`、`"needs_client_registration"`、`"unsupported"` 这类对原始 availability 的判断。文案和严重程度由 Product 的 `textKey` 与 severity 决定，Host 只渲染。
- 不能出现 `mcp_product.length > 0`、`mcpStates.length > 0` 这类"按宿主手里有几条状态决定显示摘要还是列表"的写法。显示什么由 Product 的摘要决定。
- Host 的 capability adapter 与 snapshot 只上报原始配置事实，不携带"是否已配置"的规则（不出现 `capabilityConfigured`、`toProductCapabilityConfigured`，也不对 mcp、lsp、formatter 的配置对象调用 `.some(`）。
- TUI 的 `app.tsx` 里不能写死共享命令的 `slashName`，VSCode 的 `composer-menu.ts` 里不能写死 `slash-agents`、`slash-new` 这类共享命令条目。

新增这类规则时沿用同样的写法，并把正则收窄到只命中违规写法。例如 VSCode 的 `snapshot.ts` 合法使用 `.some()` 做子会话去重，所以断言只匹配对配置对象调用 `.some(` 的那一种。

## 对等测试

当两个 Host 的输入形态不同，用共享 fixture 驱动两端 adapter，断言同一状态得到相同结论。

- TUI：`packages/tui/test/product/command-contract-parity.test.ts`、`capability-summary-parity.test.ts`
- VSCode：`sdks/vscode/src/product/capability-summary-parity.test.ts`，以及 `sdks/vscode/src/test/parity/` 下的 `command-contract-parity.test.ts`、`command-dispatch-parity.test.ts`、`composer-parity.test.ts`（菜单期望列表在 `composer-parity-fixtures.ts`）

菜单列表、命令数量这类写死的期望值，在新增共享命令后要同步更新。

## 已知取舍

TUI 的命令上下文仍由 keymap 的"已注册"与"可达"推导（`toTuiProductCommands` 里的 `hasSession`、`canUndo`），没有直接调用 `deriveProductCommandSessionContext`。目前是用 `session.undo` 的 `enabled` 条件让结论与 Product 规则一致。这是折中，不是完全迁移，不要把它当成可以照抄的写法。

## 常见错误

- 用 `scope` 区分内置命令与动态命令。
- 新增 `ProductTextKey` 后只补了一端的文本适配表（TUI 在 `text-adapter.ts`，VSCode 在 `webview/lib/product-text-adapter.ts`），另一端的类型检查会失败。
- 边界测试的正则写得过宽，误伤合法代码。
- Host 为了"更好看"改写 Product 给出的文案或排序。
