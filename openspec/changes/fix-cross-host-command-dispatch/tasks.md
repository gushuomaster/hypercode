# Tasks

## 1. VSCode 统一命令分发

- [x] 1.1 新增 `runProductCommand(commandID, handlers)`（`command-dispatch.ts`），`handlers` 为 `Record<VsCodeCommandTarget, () => void>`，覆盖 `VsCodeCommandTarget` 全部取值（含 `openCommandHelp`），新增 target 而无 handler 时编译失败；`bunx tsc --noEmit`（`sdks/vscode`）通过
- [x] 1.2 `acceptComposerAutocomplete` 的 builtin 分支改为调用 `runProductCommand(toVsCodeCommandTarget(id))`，删除手写的 13 个分支；补全菜单选中各共享命令的现有测试通过
- [x] 1.3 回车提交路径对 `kind: "builtin"` 统一调用 `runProductCommand`，删除手写的 7 个分支；新增测试：14 个共享命令回车后均不调用 `buildComposerHostMessage`
- [x] 1.4 实现 `openCommandHelp`：打开斜杠命令补全菜单并展示全部 Product 目录条目；新增测试覆盖 `/help` 回车与补全选中
- [x] 1.5 grep 旧 `slash-*` 补全 id 的生产引用，无引用则删除对应 `ComposerAutocompleteAction` 分支，有引用则改为委托 `runProductCommand`；`composer-actions.test.ts` 更新并通过

## 2. 区分不可用与未知命令

- [x] 2.1 `resolveComposerSlashAction` 返回 `unavailable` 结果（含 `availability` 与 `reasonKey`）；单测覆盖 available / unavailable / unsupported / unknown 四种输入
- [x] 2.2 回车提交遇到 `unavailable` 时不发送 prompt、保留 draft，并显示本地化原因（无 `reasonKey` 时使用 `product.command.unsupported` 对应文案）；新增中英文文案（如需要），测试断言中文文案出现
- [x] 2.3 未知命令保持作为普通文本发送；测试锁定该行为

## 3. TUI MCP 操作失败可见

- [x] 3.1 `packages/tui/src/component/dialog-mcp.tsx` 的失败与"无数据返回"分支改为 `toast.show` 本地化错误并保留原始诊断；在 `packages/tui/src/i18n/{en,zh}.ts` 增加文案；`packages/tui/test/product/dialog-mcp.test.ts` 增加失败场景并通过

## 4. 回归保护

- [x] 4.1 新增跨宿主测试：对 Product 目录中每个 VSCode 声明支持的共享命令，断言 `toVsCodeCommandTarget` 有值且 `runProductCommand` 有对应处理；在 `sdks/vscode/src/test/parity/` 下运行通过
- [x] 4.2 同类断言覆盖 TUI：每个共享命令的 `target` 在 keymap 中已注册；`packages/tui` 下运行通过

## 5. 集成验证

- [x] 5.1 运行 `packages/product`、`packages/tui`、`sdks/vscode` 的 typecheck 与 Product 相关测试，失败项与已知债务基线逐条对比，无新增
- [x] 5.2 重新打包 VSIX（`bun run package` 加 `vsce package`，783451 字节）；SHA256：`213b7e48ce6b988a530ea55a59c0e9cb4d3a6f1eadd2fc9e168de8509d0f1bd9`；已解包确认包含统一分发与不可用原因文案
- [ ] 5.3 手工冒烟（需在 VS Code 中安装上述 VSIX 实际操作）：回车提交 `/models`、`/compact`、`/undo`、`/help` 行为正确，不可用命令显示中文原因
