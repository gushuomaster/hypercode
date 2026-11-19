# Spec Delta

## ADDED Requirements

### Requirement: 交付版不使用 upstream 更新渠道

HyperCode 没有自己的在线更新渠道。交付版 SHALL NOT 联网检查 upstream 版本、提示更新或推销 upstream 新版本，也 SHALL NOT 从 upstream 发布渠道下载安装。无论 `autoupdate` 如何配置、是否设置 `HYPERCODE_DISABLE_AUTOUPDATE`，结论都不变。分类：`explicit_unsupported`；同步审查结论：`PRESERVE_HYPERCODE_DEFAULT`。

#### Scenario: 启动 TUI
- **WHEN** 用户在任意配置下启动 TUI
- **THEN** MUST NOT 发起 upstream 版本检查，MUST NOT 出现更新提示或 OpenCode 2.0 推销

#### Scenario: 使用更新命令
- **WHEN** 用户执行 `hypercode upgrade`，或在 TUI 中输入 `/update`
- **THEN** CLI MUST 以本地化文案说明 HyperCode 没有在线更新渠道、应向管理员获取新安装包，并以非零退出码结束；`/update` MUST NOT 出现在 TUI 与 VSCode 的命令列表中

#### Scenario: upstream 改动更新行为
- **WHEN** 后续 upstream 同步改变更新检查、更新提示或安装逻辑
- **THEN** 同步 MUST 保持本要求，并有回归测试证明上述行为未被带回
