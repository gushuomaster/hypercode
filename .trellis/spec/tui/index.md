# TUI 层

适用于 `packages/tui`。TUI 是 Product 的 Host 之一，只负责 render、input、focus、scroll、keyboard 与 mouse，以及 editor 与 terminal 能力上报。共享产品行为的所有权规则见 `../product/ownership-and-command-catalog.md`，Host 适配与边界测试见 `../product/host-adapters.md`。

## 文档索引

| 文档 | 内容 |
|---|---|
| [localization.md](./localization.md) | 文案本地化、语言选择与防英文回退测试 |

## 目录结构

| 目录 | 职责 |
|---|---|
| `src/product/` | 对接 `@opencode-ai/product` 的 adapter，一个主题一个 `*-adapter.ts` |
| `src/i18n/` | `en.ts`、`zh.ts` 文案表与 `index.ts` 中的 `t()` |
| `src/component/` | 对话框与通用组件，文件名多为 `dialog-*.tsx` |
| `src/routes/` | 路由：`home`、`session` |
| `src/feature-plugins/` | 内置的功能插件（侧栏、diff 查看器、home 等） |
| `src/plugin/` | 插件运行时相关代码 |
| `test/product/` | adapter、对等测试与所有权边界测试 |
| `test/i18n/` | 本地化测试 |

## 运行与验证

在 `packages/tui` 目录下：

- 测试：`bun test --timeout 30000 --only-failures`
- 类型检查：`bun typecheck`

不要在仓库根目录运行。详见 `../general/testing-and-verification.md`。

## 命令与 keymap

- TUI 命令通过 `@opencode-ai/product` 的命令目录投影出来，Product 命令 ID 到 TUI 命令名的映射在 `src/product/command-adapter.ts` 的 `targets` 中。
- 共享 slash 名不能写死在 `app.tsx` 里，边界测试 `test/product/ownership-boundary.test.ts` 会检查。
- 命令是否可用（`enabled`）要与 Product 的规则一致。例如 `session.undo` 的可用性要对应"撤销点之前仍有 user 消息"。

## 常见错误

- 在对话框或状态组件里直接判断 `availability === "failed"` 等原始状态来决定文案或颜色，应当使用 Product 给出的 `textKey` 与严重程度。
- 按宿主手里有几条 MCP、LSP、formatter 状态来决定显示摘要还是列表。
- 为共享命令新增 slash 名而不经过 Product 命令目录。
