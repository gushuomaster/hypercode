# Proposal

## Why

Cross-host contract（`openspec/changes/archive/2026-09-28-cross-host-product-contract/`）让 Product 拥有了共享命令目录，但 VSCode 的执行绑定没有跟上：在 `sdks/vscode/src/panel/webview/app/App.tsx` 中，"补全菜单选中"和"输入后回车"是两张手写的分发表，覆盖范围不一致。结果是用户在 VSCode 输入 `/models`、`/variants`、`/connect`、`/compact`、`/undo`、`/redo`、`/help` 并回车时，命令被当作普通 prompt 发给模型；`/help` 在任何路径下都没有处理。已知但不可用的命令也会被静默当作文本发送，而 TUI 会提示原因。TUI 侧 MCP 启停失败只写 `console.error`，用户看不到。

这些都是用户直接可感知的缺陷，且违反 `cross-host-product-contract` 中"动作执行返回 intent""操作失败对用户可见"的要求。

## What Changes

- VSCode 两条斜杠命令入口（补全选中、回车提交）统一走同一张由 `ProductCommandID` 驱动的分发表，覆盖全部 14 个共享内置命令。
- 为 VSCode 提供 `/help`（`help.show`）的执行绑定。
- VSCode 回车提交解析到 `unavailable` 时，不发送 prompt，改为显示 Product 提供的本地化原因（与 TUI 行为一致）；未知命令保持现有行为（作为普通文本发送）。
- TUI MCP 启停与状态刷新失败时，以 toast 形式向用户显示本地化错误，同时保留原始诊断。
- 新增回归测试：每个共享命令在每个声明支持它的 Host 中都有执行绑定。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `cross-host-product-contract`：新增"共享命令在声明支持的 Host 中必须具备完整执行绑定"的要求，覆盖所有输入入口。

## Impact

- `sdks/vscode/src/panel/webview/app/App.tsx`（`acceptComposerAutocomplete` 与提交处理）、`composer-actions.ts`、`sdks/vscode/src/product/command-adapter.ts`
- `packages/tui/src/component/dialog-mcp.tsx`
- VSCode 与 TUI 的 i18n 文案（如需新增错误 key）
- 测试：`sdks/vscode/src/test/parity/`、`sdks/vscode/src/panel/webview/app/*.test.ts`、`packages/tui/test/product/`
- 需要重新打包 VSIX 做手工冒烟
