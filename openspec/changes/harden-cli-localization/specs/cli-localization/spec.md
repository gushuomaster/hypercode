# Spec Delta

## Purpose

规定 HyperCode CLI 与 TUI 的界面语言如何选择、哪些内容必须本地化、哪些技术标识保留原文，以及防止 upstream 同步带回未本地化文案的回归要求。

## ADDED Requirements

### Requirement: 界面语言按固定优先级选择

CLI 与 TUI SHALL 支持 `zh` 与 `en`，并按以下优先级确定界面语言：`tui.json` 中显式配置的 `language`、TUI `/language` 保存的用户选择、系统语言环境（`zh*` 选择中文，其他选择英文）。无效值或读取失败 MUST 静默回退到系统语言，不得阻止启动。

#### Scenario: 显式配置优先
- **WHEN** `tui.json` 配置了 `language: "en"`，且用户曾通过 `/language` 选择中文
- **THEN** 界面 MUST 使用英文

#### Scenario: TUI 即时切换
- **WHEN** 用户在 TUI 中执行 `/language` 切换语言
- **THEN** 当前界面与已打开对话框 MUST 立即更新，下一次执行传统 CLI 命令时 MUST 使用同一语言

#### Scenario: 语言配置不可读
- **WHEN** 语言配置或状态文件无法读取或包含无效值
- **THEN** CLI MUST 回退到系统语言识别结果并正常启动

### Requirement: 产品文案本地化而技术标识保留原文

产品自身产生的标题、标签、按钮、说明、状态、错误、警告与提示 SHALL 随界面语言本地化。命令与参数标识、内部 agent ID、模型与 Provider 名称及 ID、`MCP`/`LSP`/`JSON` 等技术标识、URL、路径、快捷键，以及插件、MCP、Skill、用户自定义命令提供的名称与介绍 MUST 保留原文。

#### Scenario: 中文模式下的帮助
- **WHEN** 界面语言为中文并执行 `hypercode --help`、`hypercode mcp --help` 或 `hypercode run --help`
- **THEN** 说明文字 MUST 为中文，命令名与参数名 MUST 保持原文

#### Scenario: 第三方错误
- **WHEN** 产品显示第三方返回的英文错误
- **THEN** MUST 保留原文并附加本地化上下文

#### Scenario: 外部内容
- **WHEN** 展示插件、MCP、Skill 或用户自定义命令的名称与介绍
- **THEN** MUST 保留作者原文并附带本地化的来源标签

### Requirement: 本地化防回归审计覆盖 CLI 与 TUI

仓库 SHALL 具备自动化审计，扫描 TUI 源码、CLI 源码与仓库自带命令元数据，在中文模式审计位置发现产品自有的硬编码英文、或在字典与文档之外发现硬编码中文时失败。白名单 MUST 只包含技术标识。

#### Scenario: CLI 引入硬编码英文
- **WHEN** 有改动（包括 upstream 同步）在 `packages/opencode/src/cli` 的用户可见位置引入未本地化的英文文案
- **THEN** 本地化审计测试 MUST 失败

#### Scenario: CLI 帮助缺少中文翻译
- **WHEN** `packages/opencode/src/cli` 中命令或参数的 `describe`/`description` 在中文模式下没有对应的字典翻译
- **THEN** 本地化审计测试 MUST 失败，URL 等技术标识除外

#### Scenario: 运行时输出的已知英文债务
- **WHEN** upstream 命令文件中运行时输出（`UI.error`、`prompts.*` 等）的硬编码英文条数与审计记录的已知债务基线不一致
- **THEN** 本地化审计测试 MUST 失败：条数增加时改用本地化文案，条数减少时同步下调基线；为控制 fork tax，基线内的既有条目不要求一次性翻译

#### Scenario: 字典之外出现硬编码中文
- **WHEN** CLI 源码中 zh/en 字典文件以外的代码（不含注释）出现中文
- **THEN** 本地化审计测试 MUST 失败

#### Scenario: 字典 key 不一致
- **WHEN** `zh` 与 `en` 字典的 key 集合不一致
- **THEN** 测试 MUST 失败
