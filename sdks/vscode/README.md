# HyperCode VS Code 扩展

HyperCode 的 VS Code 集成，提供工作区会话树、会话面板、快捷提问，以及 Todo、Modified Files、Subagents 等侧栏视图。

## 运行环境

扩展会为每个受管工作区文件夹在对应主机上启动 `hypercode serve`。

- 将 `hypercode` 安装到 `PATH`；或
- 将 `hypercode.cliPath` 设置为可执行文件的绝对路径。

如需让运行时通过代理访问网络，可配置 `hypercode.httpProxy`。

## 主要功能

- Activity Bar 工作区与会话导航
- 包含消息时间线、思考内容、工具调用、Diff 和图片预览的会话面板
- 从当前编辑器、当前文件或资源管理器选中文件快速创建会话
- 会话搜索、标签过滤、分享、归档和面板内切换
- Todo、Modified Files、Subagents 和会话详情侧栏

## 语言规则

- 扩展跟随 VS Code 的显示语言；所有 `zh*` 语言代码使用简体中文，其余语言使用英文。
- 修改 VS Code 显示语言后，需要重载窗口才能让扩展宿主和已打开的 Webview 使用新语言。
- 命令 ID、设置 key、路径、URL、快捷键、Provider/Model ID、Agent、Skill、MCP 名称及第三方原始错误保持原文。
- `package.nls.json` 是英文默认词典；`package.nls.zh-cn.json` 与 `package.nls.zh-tw.json` 均提供相同的简体中文文案。

## 开发

1. 使用 `code sdks/vscode` 单独打开扩展目录，不要从仓库根目录启动扩展调试。
2. 在 `sdks/vscode` 中运行 `bun install`。
3. 按 `F5` 启动 Extension Development Host。

常用验证命令：

```powershell
bun test --preload ./src/test/preload-vscode.ts ./src
bun run check-types
bun run package
```

监听 Webview 与扩展 bundle：

```powershell
node esbuild.js --watch
```

## 构建 VSIX

先运行 `bun run package`，再在当前目录生成安装包：

```powershell
npx --yes @vscode/vsce package --no-git-tag-version --no-update-package-json --no-dependencies --skip-license -o dist/hypercode.vsix
```

本地安装可以在 VS Code 中运行“扩展: 从 VSIX 安装...”，选择 `dist/hypercode.vsix`。构建命令只生成安装包，不会自动安装或发布到 Marketplace。
