# product-default-policy Specification

## Purpose

规定 HyperCode 用户可感知能力的默认值如何选择：默认值为 HyperCode 用户而定，upstream 提供机制、兼容约束和参考策略，但不拥有下游产品决策。能力启用与联网下载、外部披露、付费、破坏性授权分开审查。

来源：`openspec/changes/archive/2026-09-24-product-default-policy/`；首批审计记录见 `docs/阶段记录/2026-09-24-product-default-audit.md`。

## Requirements

### Requirement: 省略值必须归入明确的默认类别

每项用户可感知能力的省略值 SHALL 解析到以下 HyperCode 类别之一，MUST NOT 意外继承 upstream 语义：

1. `default_on_lazy`：核心、非破坏性价值，仅在需要时启动；
2. `default_on_passive`：副作用可忽略的观察或状态能力；
3. `environment_managed`：默认有用，但联网、安装或可用性受交付形态约束；
4. `explicit_opt_in`：数据披露、公开分享、遥测、付费消耗、破坏性行为或其他显著外部副作用；
5. `explicit_unsupported`：宿主无法提供且不得模拟。

分类 MUST 依据核心价值、用户预期、副作用、成本、网络、激活方式、失败隔离、环境差异与可逆性九个维度评估。

#### Scenario: 新增可配置能力
- **WHEN** 新增或调整一项用户可感知能力的默认值
- **THEN** MUST 记录其省略、`false`、`true` 与对象/值覆盖时的行为，以及分类与理由

#### Scenario: 默认值涉及外部副作用
- **WHEN** 某能力会披露数据、公开分享、发送遥测、产生付费或执行破坏性操作
- **THEN** 该能力 MUST 归类为 `explicit_opt_in`，默认不得静默授权

### Requirement: 能力启用与联网下载分离

启用一项能力与允许其下载依赖 SHALL 是两个独立决策。离线与受控企业交付 MUST NOT 静默启用公共网络下载。

#### Scenario: LSP 默认行为
- **WHEN** 用户未配置 `lsp`
- **THEN** LSP 分析 MUST 默认启用并按相关文件懒启动，失败时显示清晰、非阻塞的不可用/错误状态；用户可显式禁用

#### Scenario: 离线交付中的 LSP 依赖
- **WHEN** HyperCode 以离线或受控企业形态交付
- **THEN** MUST 设置 `OPENCODE_DISABLE_LSP_DOWNLOAD=1`，仅使用本地或随包提供的语言服务器

### Requirement: 默认值所有权分层

`packages/product` SHALL 拥有能力可用性、激活状态、错误含义与用户文本 key 的跨宿主呈现语义；Core/config/runtime 拥有进程启动、文件匹配、依赖发现与环境策略；安装器与交付模板拥有在线/离线部署默认值。

#### Scenario: 同一运行时形态下的跨宿主结果
- **WHEN** TUI 与 VSCode 运行在同一交付形态
- **THEN** 两者 MUST 呈现相同的 Product 能力语义，交付模板不得造成不同结果

#### Scenario: 实现默认值变更
- **WHEN** 落地一项默认值决策
- **THEN** MUST 通过默认值解析器、生成配置、安装器形态或带版本迁移的组合实现，不得以单次修改用户当前配置代替

### Requirement: upstream 默认值变化需要产品审查

当 upstream 改变省略语义、默认开关、懒激活、自动安装、联网、权限、分享、遥测、收费、破坏性语义、用户可见的 fallback/恢复或 TUI/VSCode 结果差异时，同步流程 SHALL 执行产品默认值审查，并给出 `ACCEPT_UPSTREAM_DEFAULT`、`PRESERVE_HYPERCODE_DEFAULT`、`PROFILE_SPECIFIC_DEFAULT` 或 `NEEDS_HUMAN_DECISION` 结论。

#### Scenario: 仅构建通过
- **WHEN** upstream 默认值变化后构建、typecheck 均通过
- **THEN** 构建成功 MUST NOT 被视为审查结论，仍需完成分类

### Requirement: 默认值决策需要分层验证

每项已接受的策略 SHALL 在最低所有层具备测试，并在两个 Host 都暴露时具备对等覆盖。

#### Scenario: 验证默认值策略
- **WHEN** 一项默认值策略被接受或修改
- **THEN** MUST 覆盖省略/false/true/覆盖 fixture、在线/离线形态检查、懒激活与非阻塞失败、TUI/VSCode Product 投影对等、已有用户的升级迁移，以及 disabled、pending、connected、unavailable、error 等适用状态的中文文案
