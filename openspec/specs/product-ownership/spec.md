# product-ownership Specification

## Purpose

定义 `packages/product` 对 TUI 与 VSCode 共享产品行为的唯一所有权，以及 Host、兼容层与维护验证的边界。命令目录与能力状态部分由 `cross-host-product-contract` 细化并取代早期闭环结论。

来源：`openspec/changes/archive/2026-09-24-product-alignment-maintenance-baseline/design.md`（Phase 1–4 闭环与负向审计，实施基线 `402a7baf2`）。

## Requirements

### Requirement: Product 唯一拥有跨宿主产品行为

`packages/product` SHALL 是同时影响 TUI 与 VSCode 的产品行为的唯一所有者，包括：

- 模型目录、fallback、最近/收藏更新、variant 与 agent 轮换；
- composer 选择与 action 重置语义；
- 会话列表选择、生命周期投影、mutation 可用性/状态/失败恢复与 subagent 导航；
- 权限/提问优先级、message/tool/subagent 投影与运行状态；
- provider、MCP、LSP、formatter、locale、theme、command 与 help 能力投影；
- 语义文本/错误 key，同时保留原始诊断信息。

#### Scenario: 新增共享行为
- **WHEN** 需要新增一项 TUI 与 VSCode 都会呈现的行为
- **THEN** 该行为 MUST 先在 `packages/product` 中定义并测试，再由两个 Host 适配

#### Scenario: Host 自行实现排序或 fallback
- **WHEN** 任一 Host 代码自行决定排序、fallback、availability、状态优先级、恢复目标或 mutation 状态
- **THEN** 该改动 MUST 被视为违反所有权边界并拒绝合入

### Requirement: Host 只负责渲染与宿主能力

TUI 与 VSCode Host SHALL 只负责 render、host API、持久化、SDK/protocol 归一化、input、focus、scroll、keyboard/mouse 以及 editor/terminal capability 与能力上报。raw messages、parts 与 protocol payload MUST 留在 Product 之外。

#### Scenario: Host 归一化原始数据
- **WHEN** Host reducer 对原始协议实体进行排序或合并
- **THEN** 该处理 MUST 仅服务于渲染，不得决定 Product 的 availability、fallback 或 recovery

#### Scenario: 宿主不具备某能力
- **WHEN** 某 Host 无法提供一项共享能力
- **THEN** Host MUST 明确返回 `unsupported`，不得模拟不存在的宿主功能

### Requirement: 兼容路径保留需满足移除门槛

仓库不声明 `LEGACY_ZERO`。仍承担兼容职责的路径（如 VSCode raw retry/permission/question payload、`deferredUpdate` 与 snapshot seeding、legacy provider `all/default` fallback、持久化恢复 fallback、`opencodePath` 等旧设置、TUI `thinking_visibility`、TUI `api.command` shim、本地化命令描述与 skill 目录 fallback、TUI 插件 MCP/LSP raw state）SHALL 保留到各自的移除门槛满足为止。兼容分支 MUST 停留在 adapter/持久化边界。

#### Scenario: 删除兼容代码
- **WHEN** 计划删除一条兼容路径
- **THEN** MUST 证明其生产引用为零，且协议、持久化、插件与受支持运行时义务均已结束

#### Scenario: 兼容路径承担产品决策
- **WHEN** 某兼容路径开始决定排序、availability、状态优先级、fallback 或恢复语义
- **THEN** MUST 将该决策移回 Product，兼容路径不得成为第二所有者

### Requirement: 共享规则需要 Product 测试与共享 fixture 对等测试

每条共享规则 SHALL 具备 Product 测试；当两个 Host 的输入形态不同时，MUST 额外具备基于共享 fixture 的 adapter 对等测试。

#### Scenario: 修改 Product 契约
- **WHEN** 修改任一 Product 契约
- **THEN** MUST 重新运行聚焦基线测试、Product/TUI/VSCode 三个 typecheck 以及 VSCode 打包，并检查 `git diff --check`

#### Scenario: 对比全量测试结果
- **WHEN** 对比全量测试套件结果
- **THEN** MUST 按失败用例的身份与类别对比已知债务基线，而非只比较通过数量；闭环结论为 `NO_NEW_PRODUCT_ALIGNMENT_REGRESSION`，不代表仓库全部测试为绿
