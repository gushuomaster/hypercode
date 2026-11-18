# Spec Delta

## ADDED Requirements

### Requirement: 共享命令在声明支持的 Host 中具备完整执行绑定

对于每个 Host 声明为支持的共享内置命令，该 Host 的每一个命令输入入口（例如补全菜单选中、输入后回车提交、命令面板）SHALL 将其解析为同一个 Product action 并执行。Host MUST NOT 让某个入口遗漏共享命令，也 MUST NOT 把已解析为内置命令的输入当作普通 prompt 发送。

#### Scenario: 回车提交共享命令
- **WHEN** 用户在 VSCode 输入 `/models`、`/compact`、`/undo`、`/redo`、`/help` 等任一共享命令并回车
- **THEN** VSCode MUST 执行对应 Product action，且 MUST NOT 把该文本作为 prompt 发送给模型

#### Scenario: 不同入口结果一致
- **WHEN** 同一个共享命令分别通过补全菜单选中和回车提交触发
- **THEN** 两个入口 MUST 产生相同的 Product action

#### Scenario: 回车提交不可用命令
- **WHEN** 用户回车提交一个已知但当前 `unavailable` 或 `unsupported` 的命令
- **THEN** Host MUST NOT 发送 prompt，并 MUST 显示 Product 提供的本地化原因

#### Scenario: 新增共享命令缺少绑定
- **WHEN** Product 目录新增一个共享命令，而某个声明支持它的 Host 未提供执行绑定
- **THEN** 回归测试 MUST 失败
