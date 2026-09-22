# HyperCode CLI/TUI 全局本地化设计

## 目标

统一 HyperCode 的主 TUI、`hypercode run --interactive` 精简界面和传统 CLI 帮助/错误输出，使中文与英文模式完整对等，消除产品内置文案的中英文混用，同时保留稳定命令标识、技术术语和外部内容原文。

## 范围

本次包含：

- `packages/tui` 的所有产品内置用户界面，包括模型、智能体、会话、权限、问题、Provider、状态、Diff、插件、导出、帮助、调试和崩溃页。
- `packages/opencode/src/cli/cmd/run` 的精简交互界面。
- `packages/opencode/src/cli` 与 `packages/opencode/src/index.ts` 的命令帮助、参数说明、交互提示和产品错误信息。
- 为双语命令描述所必需的 Config、Schema、Protocol 与生成代码。
- 仓库自带 `.opencode/command/*.md` 的中英文描述。
- `docs/用户指南/1.18.30升级说明.md` 中的语言规则、切换方式和验证说明。
- Windows x64 纯 CLI/TUI EXE 的重新构建。

本次不包含：

- `packages/app` 的桌面端或 Web App 界面。
- 自动翻译插件、MCP、Skill 或用户自定义内容。
- 修改命令名、参数名、模型 ID、Provider ID、协议字段或文件路径。

## 展示规则

中文模式必须翻译：

- 页面和对话框标题。
- 分类、标签、按钮、操作说明、空状态和搜索提示。
- 内置命令介绍、快捷键动作说明和状态文字。
- 产品自身产生的错误、警告、确认提示和成功提示。
- 内置智能体的显示名称与说明。

以下内容保留原文：

- `/commit`、`mcp add`、`--help` 等命令和参数标识。
- `build`、`plan` 等内部智能体 ID；中文界面仅将其显示名映射为“执行”和“规划”。
- 模型名、模型 ID、Provider 品牌名和 Provider ID。
- `MCP`、`LSP`、`API key`、`JSON`、`Shell`、`PDF`、URL、路径和快捷键等技术标识。
- 插件、MCP、Skill 和用户自定义命令提供的名称与介绍。
- 第三方错误原文；产品在其前后增加本地化上下文，但不删除诊断信息。

中文文案使用简洁自然的产品语言，不机械直译，不使用中英双语标题。例如 `No results found` 显示为“未找到结果”，`Permission required` 显示为“需要权限”。

## 语言选择

支持 `zh` 与 `en`，优先级为：

1. `tui.json` 中明确配置的 `language`。
2. TUI `/language` 保存到共享状态的用户选择。
3. 系统语言环境。

首次运行时，`zh*` 系统语言选择中文，其他系统语言选择英文。TUI 切换语言后，当前界面和已打开对话框立即更新；传统 CLI 在下一次执行时读取同一语言结果。

## 架构

### 共享语言核心

在 `packages/tui` 提供一个不依赖 Solid 或 OpenTUI 的纯语言模块，负责：

- `Locale` 类型与 `zh/en` 字典。
- 系统语言规范化。
- 带参数的类型安全翻译。
- 内置智能体显示名映射。
- 命令本地化描述选择。

现有 `LanguageProvider` 作为响应式适配层，维护当前 locale 信号，并调用共享翻译函数。非组件上下文继续通过全局 locale 读取翻译。

### CLI 启动

传统 CLI 在创建 Yargs 命令树之前解析 locale，再加载命令定义。命令描述、参数说明、Yargs 分区标题和产品错误均从 CLI 词典读取。精简交互界面复用相同 locale 和翻译入口。

语言解析只读取完成语言选择所需的 `tui.json` 与状态文件，不启动完整 TUI，不加载插件，也不连接服务端。

### 命令描述

旧配置继续支持：

```yaml
description: Commit and push Git changes
```

新增可选本地化描述：

```yaml
description: Commit and push Git changes
description_i18n:
  zh: 提交并推送 Git 更改
  en: Commit and push Git changes
```

Config、Command Schema 和 Protocol 保留 `description?: string`，新增可选 `description_i18n?: { zh?: string; en?: string }`。客户端显示顺序为：

1. 当前 locale 对应的 `description_i18n`。
2. 旧 `description`。
3. 无介绍。

插件、MCP、Skill 和旧配置不需要迁移。命令列表对外部条目显示本地化来源标签：“插件”“MCP”“Skill”或“自定义”；英文模式显示对应英文标签。

### 中英对等

中文和英文字典必须拥有完全相同的 key。免费模型名称和 ID 保持原文，人工简介、自动能力简介、分组名和 `Free/Favorite` 状态进入双语词典。英文模式不得出现产品硬编码中文，中文模式不得出现未列入白名单的产品硬编码英文。

## 错误处理

- 产品错误完全本地化。
- 第三方错误保留原始文本，并附加本地化上下文，例如“Provider 连接失败：401 Unauthorized”。
- 缺少本地化命令描述时回退旧 `description`，不抛错、不隐藏命令。
- 无效 locale 回退到系统语言识别结果。
- 无法读取语言配置或状态文件时静默回退到系统语言，不阻止 CLI 启动。

## 测试与防回归

新增或扩展以下测试：

- `zh/en` 字典 key 完全一致。
- 中文系统、英文系统和其他系统语言的首次识别结果。
- `tui.json > 已保存选择 > 系统语言` 的优先级。
- TUI 切换语言后翻译立即变化。
- 模型选择器的中英文标题、分组、免费状态和简介。
- 内置智能体 ID 不变，显示名按语言切换。
- 命令 `description_i18n` 解析、协议传输、回退和旧配置兼容。
- 主 TUI、精简交互界面和传统 CLI 的代表性中文/英文输出。
- 关键 UI 属性和文本节点的硬编码英文/中文扫描，并通过显式白名单放行技术标识。

测试必须从对应 package 目录执行。修改公开 Protocol 或 Server `HttpApi` 后，从 `packages/client` 执行 `bun run generate`，不直接编辑生成目录。

## 验收标准

- 中文模式下，产品内置 CLI/TUI 文案不再混用英文，白名单技术标识除外。
- 英文模式下，产品内置 CLI/TUI 文案不出现中文。
- `/commit` 等命令名不变，仓库自带命令介绍按语言切换。
- 外部内容保留作者原文，并带有本地化来源标签。
- `hypercode --help`、`hypercode mcp --help` 和 `hypercode run --help` 跟随同一语言设置。
- 主 TUI `/language` 切换立即生效。
- 相关 package 类型检查、定向测试和本地化扫描通过。
- 生成纯 CLI/TUI Windows x64 EXE：`packages/opencode/dist/hypercode-windows-x64/bin/hypercode.exe`。
- 升级说明记录本次行为与验证方式。
