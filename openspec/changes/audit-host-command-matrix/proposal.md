# Proposal

## Why

Cross-host contract 要求现有命令按"真实能力依赖"逐条分类为 `shared`、`shared_surface_optional` 或 `host_only`，上游同步门禁也要求按语义 ID 审查。但这份审计矩阵从未产出：TUI adapter 把所有不在 Product 目录中的已注册命令自动归为 `host_only`，`shared_surface_optional` 在代码中从未被使用；VSCode 的 `refresh`、`reset-agent` 直接写在 `composer-menu.ts`。结果是 rename/share/unshare（两端都有）和 language（VSCode 有对应 locale 能力）被错误地视为 TUI 独有，下次 upstream 同步时无法判断命令变化属于哪类。

此外两端计算命令可用性的上下文事实算法不同：TUI 的 `canUndo` 按 keybinding 是否可达判断，VSCode 按是否存在 user message 判断，同一会话状态可能得到不同的可用性。

## What Changes

- 产出命令审计矩阵文档，逐条列出 TUI 与 VSCode 的全部用户可见命令（含 `workspaces`、`org`、`debug`、`exit`、`language`、`editor`、`warp`、`move`、`diff`、`share`、`rename`、`timeline`、`fork`、`unshare`、`timestamps`、`thinking`、`copy`、`export`、`refresh`、`reset-agent`），记录语义 ID、分类、能力依赖与理由。
- 依据矩阵把应共享的命令纳入 Product 目录（预计 `session.rename`、`session.share`、`session.unshare`、`locale.switch` 等），使用 `shared` 或 `shared_surface_optional`。
- Host adapter 不再把未分类命令自动归为 `host_only`；`host_only` 命令必须在 Host 的显式声明集合中出现，未声明命令触发测试失败。
- VSCode 的 `refresh`、`reset-agent` 迁入显式 host_only 声明集合。
- 统一 `canUndo`/`canRedo`/`hasSession` 等上下文事实的定义，由 Product 规定事实语义，Host 只上报原始事实。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `cross-host-product-contract`：新增"每个用户可见命令必须显式分类，Host 不得自动归类为 host_only"与"命令上下文事实语义由 Product 定义"的要求。

## Impact

- 新文档：`docs/规范/` 或 `openspec/specs/cross-host-product-contract/` 附属的命令审计矩阵
- `packages/product/src/command.ts` 及测试、`packages/product/test/fixtures/command-contract.ts`
- `packages/tui/src/product/command-adapter.ts`、`packages/tui/src/keymap.tsx`、`app.tsx`、`routes/session/index.tsx`
- `sdks/vscode/src/product/command-adapter.ts`、`panel/webview/app/composer-menu.ts`
- `docs/操作手册/上游同步操作流程.md` 的 Product Contract Review 章节（引用矩阵）
- 依赖 `fix-cross-host-command-dispatch` 先完成（统一分发后再扩充共享命令）
