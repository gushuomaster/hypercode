# Spec Delta

## ADDED Requirements

### Requirement: 用户可见命令必须显式分类

每个用户可见命令 SHALL 在命令审计矩阵中具有语义 ID、分类（`shared`、`shared_surface_optional` 或 `host_only`）以及分类理由。Host adapter MUST NOT 把未出现在 Product 目录或 Host 显式 host_only 声明中的命令自动归类为 `host_only`。

#### Scenario: 新增未分类命令
- **WHEN** 任一 Host 注册了一个既不在 Product 目录、也不在该 Host 显式 host_only 声明中的用户可见命令
- **THEN** 回归测试 MUST 失败，并提示补充分类

#### Scenario: 两端都具备的能力
- **WHEN** 某命令依赖的能力在 TUI 与 VSCode 中都存在（如会话重命名、分享、切换语言）
- **THEN** 该命令 MUST 分类为 `shared` 或 `shared_surface_optional`，不得归为 `host_only`

#### Scenario: upstream 新增命令
- **WHEN** upstream 同步引入新的用户可见命令
- **THEN** 合入前 MUST 在审计矩阵中完成分类，缺失分类时 Cross-Host Product Contract Review 结论为 `NEEDS_HUMAN_DECISION`

### Requirement: 命令上下文事实语义由 Product 定义

`hasSession`、`canUndo`、`canRedo`、`hasVariants`、`hasConnectableProvider` 等命令可用性上下文事实 SHALL 由 Product 定义其语义，Host 只上报计算这些事实所需的原始数据。Host MUST NOT 以各自不同的规则（例如 keybinding 是否可达、是否存在 user message）推导同一事实。

#### Scenario: 同一会话状态
- **WHEN** TUI 与 VSCode 处于等价的会话状态（相同的消息历史与 revert 状态）
- **THEN** 两端对 `/undo`、`/redo` 的可用性结论 MUST 相同
