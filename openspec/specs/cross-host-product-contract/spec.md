# cross-host-product-contract Specification

## Purpose

规定 TUI 与 VSCode 共享命令目录、动作执行与能力状态（MCP/LSP/formatter）的 Product 契约，使共享行为由 Product 单一拥有，并以共享 fixture 证明跨宿主等价。本 spec 取代 `product-ownership` 早期关于命令与能力状态的闭环结论。

来源：`openspec/changes/archive/2026-09-28-cross-host-product-contract/`。

初始共享斜杠目录：

| 语义 ID | 规范斜杠 | 别名 |
| --- | --- | --- |
| `session.new` | `/new` | `/clear`（保留兼容时） |
| `session.list` | `/sessions` | `/resume`, `/continue` |
| `agent.list` | `/agents` | 无 |
| `model.list` | `/models` | `/model`, `/mo` |
| `variant.list` | `/variants` | 无 |
| `provider.connect` | `/connect` | 无 |
| `mcp.list` | `/mcps` | `/mcp` |
| `system.status` | `/status` | 无 |
| `session.compact` | `/compact` | 无 |
| `session.undo` | `/undo` | 无 |
| `session.redo` | `/redo` | 无 |
| `skill.list` | `/skills` | 无 |
| `theme.list` | `/themes` | `/theme` |
| `help.show` | `/help` | 无 |

## Requirements

### Requirement: 分层所有权

系统 SHALL 分为四层：Core/Config/Runtime 拥有事实与副作用；`packages/product` 拥有语义能力 ID、目录策略、availability、状态机、聚合、action intent、排序、冲突规则与语义文本 key；Host adapter 负责原始形态归一化与真实的 supported/unsupported/host_only 声明；TUI/VSCode 负责渲染、输入、焦点、editor/terminal API 与执行绑定。

#### Scenario: Host 传入最终目录
- **WHEN** Host 试图向 Product 传入已经决定好的最终共享目录
- **THEN** Product MUST NOT 接受；Product 只接收动态条目与能力声明，并自行产出最终目录

### Requirement: 命令拥有稳定语义 ID 与分类

每个用户可见命令或动作 SHALL 拥有与标签、斜杠拼写、Host handler 名称无关的稳定语义 ID，并分类为 `shared`、`shared_surface_optional` 或 `host_only`。可用性 SHALL 与范围分离，取值为 `available`、`unavailable`（附原因文本 key）或 `unsupported`。

规范斜杠与别名见 Purpose 中的初始共享斜杠目录。

#### Scenario: 紧凑选择器隐藏条目
- **WHEN** 某条目因不可用被紧凑选择器隐藏
- **THEN** Product 结果 MUST 仍保留其 unsupported 或 unavailable 原因，供诊断与对等测试使用

#### Scenario: 已公开的命令拼写
- **WHEN** 某命令拼写已对用户公开
- **THEN** MUST 作为别名保留

### Requirement: 动态命令来源独立且由 Product 处理冲突

动态条目 SHALL 保留各自来源：server 定义的用户命令、MCP 提供的业务命令、Skill 命令、内置 Product action、Host-only 命令。Product SHALL 拥有来源优先级、冲突处理、别名解析、过滤与确定性排序。

#### Scenario: MCP 管理命令与 MCP 业务命令
- **WHEN** 同时存在 `/mcps`（管理 MCP 连接）与来源为 `mcp` 的业务命令
- **THEN** 两者 MUST NOT 仅因都包含 MCP 字样而共享身份

#### Scenario: Host 输入顺序不同
- **WHEN** 两个 Host 以不同顺序提供等价的动态条目
- **THEN** Product MUST 产出相同的确定性结果

### Requirement: 动作执行返回 intent 而非回调

Product 目录 SHALL 返回稳定的 `ProductAction` intent，不返回 Host 回调。执行生命周期 MUST 为：Product 解析命令并校验上下文可用性 → Host 启动映射动作并报告 pending → Core/Host 返回刷新后的事实或类型化失败 → Product 推导新状态与语义错误 → Host 渲染结果，不自行发明 fallback 或恢复。

#### Scenario: 未知命令与不可用命令
- **WHEN** 用户输入未知命令，或输入已知但当前不可用的命令
- **THEN** 两种情况 MUST 保持可区分

#### Scenario: 操作失败
- **WHEN** 动作执行失败
- **THEN** 失败 MUST 对用户可见并保留原始诊断，仅写入开发者控制台不满足要求

### Requirement: MCP 状态区分配置、运行时与聚合

MCP 输入 SHALL 包含配置启用状态、原始运行时状态、支持的动作与 pending 操作状态。Product 区分配置（`unconfigured`、`enabled`、`disabled`、`unsupported`）、运行时（`idle`、`connecting`、`connected`、`needs_auth`、`needs_client_registration`、`failed`）与聚合（`unconfigured`、`disabled`、`idle`、`healthy`、`degraded`、`failed`、`needs_attention`、`unsupported`）。

#### Scenario: 已启用但连接失败
- **WHEN** 一个已启用的 MCP server 连接失败
- **THEN** MUST NOT 被标为 disabled

#### Scenario: 混合状态
- **WHEN** 部分 server 已连接、部分失败
- **THEN** 聚合 MUST 为 `degraded`；全部失败时 MUST 为 `failed`

#### Scenario: 需要认证或注册
- **WHEN** server 处于 `needs_auth` 或 `needs_client_registration`
- **THEN** MUST 保留各自的语义错误与恢复动作

### Requirement: LSP 状态结合解析后的配置与运行实例

LSP 状态 SHALL 由解析后的配置与实际运行实例共同决定：`lsp: false` → `disabled`；已启用但无匹配活动实例 → `idle`（表示已启用、懒激活）；已连接且无错误 → `healthy`；已连接与失败并存 → `degraded`；仅有失败实例 → `failed`；Host 不支持 → `unsupported`。

#### Scenario: Core 尚未启动语言服务器
- **WHEN** Core 尚未启动任何语言服务器
- **THEN** Product MUST NOT 预先枚举潜在语言服务器，也不得声称其处于活动状态

#### Scenario: VSCode 编辑器语言服务
- **WHEN** VSCode 同时存在编辑器自带语言服务
- **THEN** HyperCode 状态界面 MUST 标明其展示的是 HyperCode Runtime LSP 还是编辑器语言服务

### Requirement: 聚合摘要由 Product 拥有

Formatter 与 MCP、LSP 一样 SHALL 纳入统一聚合契约。Product 拥有聚合可用性、严重度、active/configured/failed 计数、语义摘要文本 key 与默认恢复动作。

#### Scenario: Host 计算整体色调
- **WHEN** Host 需要展示整体状态颜色
- **THEN** Host MUST 将 Product 严重度映射为自身视觉 token，不得自行计算整体色调或把空数组解释为 disabled

### Requirement: 语义文本与诊断

Product SHALL 输出语义文本 key 并保留原始诊断文本、code 与 source；TUI 与 VSCode 本地化相同的 key。

#### Scenario: 中文覆盖
- **WHEN** 能力状态为 configured、disabled、idle、pending、connected、degraded、需要认证、需要注册、failed 或 unsupported 中适用的任一状态
- **THEN** MUST 具备用户可见的中文文案覆盖

#### Scenario: 第三方错误
- **WHEN** 出现第三方英文错误
- **THEN** MUST 保留原文以便诊断，并附带 Product 提供的本地化解释

### Requirement: 以语义等价验证契约

验证 SHALL 基于语义等价而非代码复用。Product 测试覆盖内置目录、别名、来源优先级与冲突、上下文可用性、MCP/LSP/formatter 个体与聚合状态矩阵、action intent 与语义错误 key、与 Host 输入顺序无关的确定性。共享 Host fixture 以 TUI 与 VSCode 的原始形态表达等价事实，两个 adapter MUST 投影出相同 Product 结果。

#### Scenario: Host 重新引入共享决策
- **WHEN** 第一方 Host 代码重新引入共享内置目录、别名/冲突策略、可用性 fallback、聚合状态优先级或整体色调计算、默认恢复选择或语义错误选择
- **THEN** 测试与聚焦源码审计 MUST 失败；源码审计仅作辅助证据，Product 与共享 fixture 行为测试才是权威证明

#### Scenario: 契约变更的验证命令
- **WHEN** 任一契约发生变更
- **THEN** MUST 运行 Product 测试与 typecheck、TUI Product/adapter 测试与 typecheck、VSCode Product/adapter 测试与 `check-types`、VSCode 打包与 diff 检查，全量失败按身份对比已知债务基线

### Requirement: upstream 同步的跨宿主契约审查

任何触及共享能力定义、Host 命令注册、可用性输入、状态 schema、状态渲染、动作绑定、文本 key 或 Product adapter 的 upstream 变更 SHALL 触发 `Cross-Host Product Contract Review`，记录受影响语义能力 ID、变更属于事实/Product 含义/Host 支持/仅呈现、两个 Host 的能力声明、共享 fixture 结果、新增 `host_only` 或 `unsupported` 的理由，以及在省略或激活语义同时变化时的产品默认值审查。结论为 `CROSS_HOST_CONTRACT_PRESERVED`、`CROSS_HOST_CONTRACT_ADAPTED` 或 `NEEDS_HUMAN_DECISION`。

#### Scenario: 缺少共享 fixture 证据
- **WHEN** 审查缺少共享 fixture 证据或存在无法解释的 Host 差异
- **THEN** 结论 MUST 为 `NEEDS_HUMAN_DECISION` 并阻止 merge-back；构建、typecheck、打包或文本搜索成功均不能满足该门槛
