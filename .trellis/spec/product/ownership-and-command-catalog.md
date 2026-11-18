# Product 所有权与命令目录

适用于 `packages/product`，以及任何新增或修改 TUI 与 VSCode 共享行为的改动。权威来源是 `openspec/specs/product-ownership/spec.md` 和 `openspec/specs/cross-host-product-contract/spec.md`，本文只提炼写代码时的落点。

## 所有权规则

`packages/product` 是同时影响 TUI 与 VSCode 的产品行为的唯一所有者，包括：

- 模型目录、fallback、最近与收藏更新、variant 与 agent 轮换
- composer 选择与 action 重置语义
- 会话列表选择、生命周期投影、mutation 可用性与状态、subagent 导航
- 权限与提问的优先级、message/tool/subagent 投影、运行状态
- provider、MCP、LSP、formatter、locale、theme、command、help 的能力投影
- 语义文本与错误 key，同时保留原始诊断信息

新增一项两端都会呈现的行为时，先在 `packages/product` 定义并写测试，再由两个 Host 适配。

## 包结构

- 入口只有 `packages/product/src/index.ts`，按主题 `export *`，新增主题文件时要在这里补一行。
- `src/` 下一个主题一个文件（`command.ts`、`mcp.ts`、`lsp.ts`、`session-mutation.ts` 等），`test/` 下有同名测试，共享 fixture 放在 `test/fixtures`。
- Product 不依赖 TUI 或 VSCode，只被它们依赖。

## 命令目录的写法

参考 `packages/product/src/command.ts`。

- 命令 ID 是 `productCommandIDs` 这个 `as const` 数组，`ProductCommandID` 类型由它推导。不要另写一份字符串联合类型。
- 每条内置命令在 `builtinCommands` 里声明 `id`、`name`、可选 `aliases`、`textKey`，以及可选的 `scope`。
- `ProductCommandScope` 有三类：`shared`、`shared_surface_optional`、`host_only`。内置定义里的 `scope` 不能写 `host_only`，`host_only` 命令必须由 Host 显式声明，不能因为"没在目录里"被自动归类。
- 可用性是 `available`、`unavailable`、`unsupported` 三种。宿主不具备某项能力时返回 `unsupported`，不要模拟。
- 用户输入的解析结果是 `resolveProductCommand` 返回的 `builtin`、`dynamic`、`unavailable` 三种之一。`unavailable` 要带上 `reasonKey`，Host 据此显示本地化原因，不能把命令当普通文本发给模型。

## 可用性事实由 Product 推导

Host 只上报原始会话数据，语义由 Product 统一推导：

- Host 构造 `ProductCommandSessionFacts`：是否有会话、消息列表（`id`、`role`）、撤销点 `revertMessageID`、分享链接。
- `deriveProductCommandSessionContext` 推导 `canUndo`（撤销点之前仍有 user 消息）、`canRedo`（存在撤销点）、`isShared`（存在分享链接）。
- 不要在 Host 里再写一份 `canUndo` 之类的算法。本分支已经出现过两端算法不一致的问题：VSCode 忽略撤销点，TUI 按快捷键是否可达判断。

参考测试：`packages/product/test/command.test.ts`。

## 新增共享命令的步骤

1. 在 `productCommandIDs` 加 ID，在 `builtinCommands` 加定义，确定 `scope`。
2. 在 `packages/product/src/text.ts` 补对应的 `ProductTextKey`，需要不可用原因时同样补 key。
3. 补 `packages/product/test/command.test.ts` 的用例。
4. 两个 Host 的 `targets: Record<ProductCommandID, ...>` 会因为类型检查报缺项，按报错逐个补映射（见 `host-adapters.md`）。
5. 两端的文本适配表、i18n 文案、分发表同步补齐，并更新 parity 测试里写死的菜单列表。
6. 三个包的类型检查和相关测试通过后再提交。

## 常见错误

- 在 Host 里自行决定排序、fallback、availability、状态优先级、恢复目标或 mutation 状态。这类改动违反所有权边界，应当拒绝合入。
- 把 raw messages、parts 或协议 payload 放进 Product。
- 新增命令 ID 却只改一端。
- 删除兼容路径前没有证明它的生产引用为零。兼容分支要停留在 adapter 或持久化边界，不能开始承担产品决策。
