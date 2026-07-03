# HyperCode 相对 OpenCode 的特色改动总览

## 文档目的与边界

本文是放在 `docs/` 根目录下的长期总览，目的是让新维护者和现有维护者都能快速看清 HyperCode 相对 OpenCode 的长期差异。

它回答的是“HyperCode 目前哪些改动最值得长期保留、为什么要保留、维护时应该优先看哪里”，而不是逐次记录某个提交、某次验证或某次同步现场。

本文负责稳定地概括产品面、公开面和维护边界；具体执行步骤、同步流程、历史取证和阶段结果分别由 `docs/规范`、`docs/操作手册`、`docs/阶段记录` 承担。

## 一页看懂的特色摘要

- HyperCode 把用户可见公开面收口为 HyperCode 品牌，而不是只做局部文案替换。
- HyperCode 把原本较轻的 VS Code 入口扩展为完整的集成式扩展，包含 Activity Bar、Sessions、Todo、Modified Files、Subagents 和 Session Panel。
- HyperCode 建立了 `hypercode.*` 命令与配置体系，同时保留必要的内部兼容项，避免破坏 upstream 兼容性。
- HyperCode 采用 workspace runtime 启动模型和完整的会话工作流，而不是停留在旧终端启动器叙事。
- HyperCode 在产品定位上不把 license 门禁作为公开面的一部分，但维护时仍要把授权相关入口和路径当作需要人工确认的保留/回退边界。
- HyperCode 不是“把所有 `opencode` 字样都删掉”，而是保留必要的兼容字段、历史路径和内部命名，让 upstream sync 能持续进行。

## 特色改动明细

### 1. 品牌化公开面

HyperCode 的核心变化之一，是把用户实际看见的产品公开面统一为 HyperCode，而不是只在少数位置做表层替换。

这一层通常包括：

- CLI 和 TUI 的用户可见名称、帮助文案和启动叙事
- VS Code 扩展的 `name`、`displayName`、`description`
- 面向外部的 README、产品介绍和界面文案

这意味着 HyperCode 的品牌化目标是“公开面一致”，不是“源码里完全没有 OpenCode 字样”。内部实现、依赖名和兼容字段可以继续保留，只要不会让用户看到退回旧品牌的公开面。

### 2. 增强版 VS Code 扩展

HyperCode 的 VS Code 扩展已经不是一个轻量入口，而是完整的集成式工作区扩展。

长期上应该把它理解为一个带有明确产品面的扩展集合，至少包含：

- Activity Bar 容器
- Sessions 树
- Todo、Modified Files、Subagents 视图
- Session Webview Panel
- 完整的扩展 README 产品叙事

这部分之所以重要，是因为它直接决定用户在 VS Code 里看到的是 HyperCode 的工作流，而不是传统终端启动器的附属入口。

### 3. `hypercode.*` 命令与配置体系

HyperCode 已经建立了自己的公开命令与公开配置入口。

维护时应长期记住两条线：

- 公开 command 主入口应保持 `hypercode.*`
- 公开 configuration 主入口应保持 `hypercode.*`

其中像 `hypercode.cliPath`、`hypercode.httpProxy` 这类配置，不只是技术实现细节，而是 HyperCode 公开面的一部分。它们表达的是产品如何连接本地 CLI、代理和工作区运行时，因此不应被回退成旧的公开命名体系。

### 4. workspace runtime 与会话工作流

HyperCode 的另一个长期特征，是把工作区启动、会话承载和扩展内交互串成一条完整工作流。

这一层的关键点不是某个单独命令，而是整体运行模型：

- 按工作区启动 runtime
- 会话相关入口在扩展内形成闭环
- 用户从工作区进入、查看、恢复、管理会话时，看到的是统一的 HyperCode 工作流

这也是 HyperCode 和“旧终端启动器叙事”最本质的差异之一。后者强调单点启动，前者强调工作区内的完整协作面。

### 5. license 边界与保留项

HyperCode 的长期产品方向，是不把 license 门禁作为公开面叙事的一部分；但这不等于可以直接假设仓库里已经没有任何授权相关入口或文件。

这条边界的含义是：

- 不恢复 `hypercode.openLicenseFile`
- 不恢复 `packages/opencode/src/license/*` 与 `sdks/vscode/src/license/*`
- 不恢复启动前授权阻断
- 不恢复授权测试

因此，后续同步 upstream 时，如果相关区域再次出现在公开流程里并形成真正的授权门禁，就应被视为需要人工确认的回退信号；如果只是仓库内部仍保留相关实现或入口，也应按兼容与保留边界谨慎处理，而不是简单当作“已清理干净”的既成事实。

### 6. 兼容保留策略

HyperCode 的特色不是“把一切都机械改名”，而是“公开面品牌化，内部兼容保留”。

长期应该保留或谨慎处理的内容包括：

- `@opencode-ai/*` 包名与依赖命名
- `packages/opencode` 目录名
- 兼容字段与部分历史路径
- 上游同步需要保留的内部标识、协议名和技术约定

这些保留项的价值在于稳定构建、减少 upstream sync 风险、维持历史兼容性。只要它们不暴露成用户可见的旧品牌公开面，就不应为了“看起来更整齐”而机械删除。

## 维护视角的长期保留点

- 公开命令、公开配置、扩展元数据、Activity Bar、views 和 panels 必须保持 HyperCode 公开面。
- `@opencode-ai/*`、`packages/opencode`、兼容字段和部分历史路径不应机械替换。
- `sdks/vscode/package.json`、`sdks/vscode/README.md`、`sdks/vscode/src/*`、`packages/opencode/src/cli/*`、`packages/opencode/src/config/*` 是优先检查区。
- 如果公开入口退回 `opencode.*`、README 退回旧终端启动器叙事、license 入口重新出现，就说明特色改动正在回退。
- 维护时不要把“内部仍有 `opencode`”误判为问题本身，真正需要警惕的是用户可见公开面是否回退。

## 如何配合现有文档使用

- 看长期规则与禁止事项：[docs/规范](规范/)
- 看执行步骤与验收命令：[docs/操作手册](操作手册/)
- 看某次历史取证与验证现场：[docs/阶段记录](阶段记录/)
- 看 HyperCode 相对 OpenCode 的长期特色总览：本文
