# Design

## Context

- `sdks/vscode/src/product/command-adapter.ts` 已有 `ProductCommandID -> VsCodeCommandTarget` 的完整映射（`toVsCodeCommandTarget`），但没有任何调用方。
- `App.tsx` 中 `acceptComposerAutocomplete` 手写了 13 个 `commandID` 分支（缺 `help.show`）；回车提交处理手写了 7 个分支（`session.new`、`skill.list`、`agent.list`、`session.list`、`theme.list`、`mcp.list`、`system.status`），其余落到 `buildComposerHostMessage` 作为 prompt 发送。
- `composer-actions.ts` 的 `resolveComposerSlashAction` 对 `unavailable` 返回 `undefined`，与"未知命令"无法区分。
- TUI（`packages/tui/src/component/prompt/index.tsx`）对 `unavailable` 已通过 toast 显示 `reasonKey`，是 VSCode 应对齐的参照。
- `ComposerAutocompleteAction` 里仍保留 `slash-undo`、`slash-compact` 等旧 id 分支，与 `product:<id>` 分支并存。

## Goals / Non-Goals

**Goals:**
- VSCode 只保留一处 `VsCodeCommandTarget -> 执行` 的分发函数，两个入口共用。
- `VsCodeCommandTarget` 的 `Record` 类型保证新增 `ProductCommandID` 时编译期即发现缺失绑定。

**Non-Goals:**
- 不改 Product 目录、别名或可用性规则（属于 `audit-host-command-matrix`、`complete-capability-status-contract`）。
- 不改 `refresh`、`reset-agent` 等 host_only 命令的归类。
- 不改未知命令的行为（继续作为普通文本发送，与 TUI 一致）。

## Decisions

1. **以 `VsCodeCommandTarget` 为唯一分发键**：在 webview 内新增一个 `runCommandTarget(target)`（与 `App.tsx` 同文件或相邻模块），`acceptComposerAutocomplete` 的 builtin 分支和回车提交都改为 `runCommandTarget(toVsCodeCommandTarget(id))`。备选是在两个入口各自补齐分支——会再次漂移，放弃。
2. **`/help` 的 VSCode 绑定**：打开斜杠命令补全菜单（等价于在空 composer 输入 `/` 并展示全部 Product 目录条目及描述）。这复用现有 UI，不新增面板。备选是声明 `help.show` 为 `unsupported`——会让 `/help` 在 VSCode 永久不可用，与"共享"分类不符；备选二是新建帮助面板——成本高且不在本次范围。
3. **`unavailable` 处理**：`resolveComposerSlashAction` 返回带 `kind: "unavailable"` 与 `reasonKey` 的结果；回车提交时用现有错误提示区域（`state.error` 或等价 toast）显示本地化原因，并保留 draft 便于用户修改。
4. **旧 `slash-*` id 分支**：若补全菜单已全部改用 `product:<id>`，则删除旧分支；若仍有生产代码产生旧 id，则保留并改为委托到 `runCommandTarget`。以 grep 生产引用为准。
5. **TUI MCP 失败提示**：`dialog-mcp.tsx` 的 `catch` 与"无数据返回"分支改为 `toast.show`，文案使用新的本地化 key（中英文），原始错误保留在日志。

## Risks / Trade-offs

- [补全菜单本来会拦截回车，回车提交路径在实际使用中触发较少] → 仍需修复：用户粘贴命令或关闭补全后回车时会触发；以测试覆盖两个入口。
- [`/help` 打开补全菜单的语义较弱] → 在 Product 文案中保持 `help.show` 的描述为"查看可用命令"，未来如需完整帮助面板再单独提案。
- [删除旧 `slash-*` 分支可能影响尚未迁移的入口] → 删除前 grep 生产引用，保留期间统一委托。
