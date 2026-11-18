# VSCode 扩展层

适用于 `sdks/vscode`。VSCode 扩展是 Product 的 Host 之一，只负责渲染、宿主 API、持久化、SDK 与 protocol 归一化、input 与 editor 能力上报。共享产品行为的所有权规则见 `../product/ownership-and-command-catalog.md`，Host 适配与边界测试见 `../product/host-adapters.md`。

## 目录与分层

| 目录 | 职责 |
|---|---|
| `src/extension.ts` | 扩展入口 |
| `src/core/` | 扩展宿主侧能力：`server.ts`（每个工作区一个 `hypercode serve`）、`sdk.ts`、`commands.ts`（注册 `hypercode.*` 命令）、`settings.ts`、`status-bar.ts` 等 |
| `src/bridge/` | 扩展侧与 webview 之间的消息类型（`types.ts`）和宿主实现（`host.ts`） |
| `src/panel/provider/` | 会话面板的扩展侧状态：`snapshot.ts`、`reducer.ts`、`actions.ts`、`mutations.ts`、`navigation.ts`、`restore-state.ts` |
| `src/panel/webview/` | 会话面板的 React 界面；`app/` 放组件与 composer 逻辑，`lib/` 放 `product-*-adapter.ts` 等 webview 侧适配 |
| `src/product/` | 扩展侧对接 `@opencode-ai/product` 的 adapter 与所有权边界测试 |
| `src/sidebar/` | 侧栏视图（Sessions、Subagents 等） |
| `src/license/` | license 状态与命令，调用 CLI 的 `license status --json` |
| `src/i18n/` | `en.ts`、`zh.ts` 文案表与 `t()` |
| `src/test/` | 扩展级测试，含 `parity/` 对等测试 |

## 运行与验证

在 `sdks/vscode` 目录下：

- 类型检查：`bun run check-types`
- 扩展测试：`bun run test`（`vscode-test`）
- 打包：`bun run package`，依次执行 `check-types`、`lint` 与生产构建
- `src/product/*.test.ts` 等用 `node:test` 写的文件，本分支的验证中是单独用 `bun test <文件>` 运行的

## 斜杠命令分发

参考 `src/panel/webview/app/command-dispatch.ts`。

- 共享命令只有一条执行路径：补全菜单选中和回车提交都调用 `runProductCommand`，不要再为某一入口单独写分发表。
- `VsCodeCommandHandlers` 是 `Record<VsCodeCommandTarget, () => void>`，新增 target 却没有 handler 会编译失败。
- 回车提交由 `planComposerSubmit` 决定结果：解析为内置命令就执行；解析为 `unavailable` 就不发送，显示 Product 给出的本地化原因；动态命令和未知文本按原路径发送。
- 宿主不支持的命令在命令目录输入的 `supported` 里声明为 `false`（例如 `session.fork`），不要写一个什么都不做的 handler 来假装支持。

## 文案本地化

- `src/i18n/en.ts` 导出 `EN`，`zh.ts` 导出 `ZH`，`TranslationKey` 是 `keyof typeof EN`。新增 key 要两份同时补。
- `t(key, params?, language?)` 用 `{name}` 形式的占位符替换参数。
- 语言由 `normalizeLocale` 调用 Product 的 `toVsCodeProductLocale` 推导，不要在扩展或 webview 里自己判断语言。
- Product 的 `ProductTextKey` 在 `src/panel/webview/lib/product-text-adapter.ts` 映射到 VSCode 的文案 key。Product 新增 key 后要补映射，否则类型检查失败。
- 命令描述用 `localizedCommandDescription`：优先 `description_i18n[language]`，否则回退原始 `description`。
- 防文案回退的测试有两个：
  - `src/test/visible-copy-localization.test.ts`：用 TypeScript AST 扫描源码，要求中文文案、JSX 文本、`aria-label`/`placeholder`/`title` 等可见属性，以及 `showInformationMessage` 等 VS Code 弹窗文案都放进文案表，不能写在源码里。`HyperCode`、`MCP`、`LSP` 等技术名词在允许列表里。
  - `src/test/manifest-localization.test.ts`：检查 `package.nls.json`、`package.nls.zh-cn.json`、`package.nls.zh-tw.json` 的 key 一致，并且 `zh-tw` 与 `zh-cn` 相同。修改 `package.json` 贡献点文案时三份要同步。

## 品牌与扩展标识

- 公开入口保持 `hypercode.*`（命令、配置项、视图 ID），见 `docs/规范/上游同步与品牌化规范.md`。
- 扩展 ID 由 `package.json` 的 `publisher` 与 `name` 组成。`src/core/settings.ts` 打开设置页时用 `@ext:<publisher>.hypercode` 搜索，修改 `publisher` 时这里必须同步。

## 常见错误

- 在 `App.tsx` 或 `composer-menu.ts` 里为共享命令另写一份分发或菜单条目。
- 用 `mcpStates.length > 0` 之类的宿主状态数量推断"是否已配置"。
- 在 `status-picker.tsx`、`session-meta.ts` 里按原始 availability 选择文案或颜色。
- 把 webview 侧的显示需求塞进扩展侧 `snapshot.ts` 变成配置规则。
