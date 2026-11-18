# Spec Delta

## ADDED Requirements

### Requirement: 能力配置状态由 Product 依据原始配置事实推导

Host SHALL 只向 Product 提供原始配置事实（如 MCP 条目及各自启用状态、`lsp` 与 `formatter` 的解析后开关）。Product SHALL 据此推导 `unconfigured`、`disabled` 等配置状态。Host MUST NOT 自行计算"是否已配置"，也 MUST NOT 在配置事实缺失时从运行时状态反推。

#### Scenario: 没有配置任何 MCP
- **WHEN** 配置中 MCP 条目为零
- **THEN** MCP 摘要 MUST 为 `unconfigured`，并显示"未配置"语义文案，而不是"已禁用"

#### Scenario: 所有 MCP 均被禁用
- **WHEN** 配置中存在 MCP 条目且全部 `enabled: false`
- **THEN** MCP 摘要 MUST 为 `disabled`

#### Scenario: 配置事实暂不可得
- **WHEN** Host 尚未取得配置
- **THEN** Product MUST 输出明确的未知或加载中语义，Host MUST NOT 以运行时条目数量代替配置事实

### Requirement: 单条目状态语义由 Product 输出

Product SHALL 为每个 MCP、LSP、formatter 条目输出语义文本 key 与严重度。Host SHALL 只负责本地化该 key 并把严重度映射为自身视觉 token，MUST NOT 根据原始 availability 自行选择条目文案或颜色。

#### Scenario: 需要客户端注册
- **WHEN** 某 MCP 条目处于 `needs_client_registration`
- **THEN** TUI 与 VSCode MUST 显示同一语义的文案（"需要客户端注册"），不得一端显示为"失败"

#### Scenario: 操作进行中
- **WHEN** 用户对某 MCP 条目发起连接或断开，Host 上报 pending
- **THEN** Product MUST 输出 pending 语义并收起冲突动作，两端显示一致

#### Scenario: 共享 fixture 等价
- **WHEN** 同一份 capability fixture 分别以 TUI 与 VSCode 的原始形态输入各自 adapter
- **THEN** 两端得到的摘要与单条目 Product 结果 MUST 完全相同
