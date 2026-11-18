# 测试与验证

## 在哪里运行

- 不能从仓库根目录运行测试：根 `package.json` 的 `test` 脚本会直接报错退出。进入对应包目录运行。
- 类型检查在包目录运行，不直接调用 `tsc`。

| 位置 | 测试 | 类型检查 |
|---|---|---|
| `packages/product` | `bun test` | `bun typecheck` |
| `packages/tui` | `bun test --timeout 30000 --only-failures` | `bun typecheck` |
| `packages/opencode` | `bun test --timeout 30000 --only-failures` | `bun typecheck` |
| `sdks/vscode` | `bun run test`（`vscode-test`） | `bun run check-types` |

`sdks/vscode/src` 下用 `node:test` 写的测试（例如 `src/product/*.test.ts`）在本分支的验证中是在 `sdks/vscode` 目录用 `bun test <文件>` 单独运行的。

## 编写测试

- 尽量不用 mock，不使用 `globalThis.*`，除非没有别的办法。
- 测试真实实现，不要把被测逻辑复制进测试。
- 共享规则在 `packages/product` 里要有测试；两个 Host 的输入形态不同时，再加基于共享 fixture 的 adapter 对等测试（Product 侧 fixture 在 `packages/product/test/fixtures`，两端对等测试见 `*-parity.test.ts`）。

## 修改 Product 契约后的验证

1. 运行聚焦的基线测试：Product 全量，以及 TUI、VSCode 里与 Product 相关的测试。
2. Product、TUI、VSCode 三个包的类型检查全部通过。
3. VSCode 打包通过：在 `sdks/vscode` 运行 `bun run package`，它依次执行 `check-types`、`lint` 和生产构建。
4. 运行 `git diff --check`。

## 解读全量测试结果

- 全量测试有已知债务，不能只比较通过数量。按失败用例的身份和类别对比已知债务基线，确认没有新增。
- 已知债务基线的记录位置：`openspec/changes/complete-capability-status-contract/tasks.md` 第 7.1 条。
- 结论 `NO_NEW_PRODUCT_ALIGNMENT_REGRESSION` 表示没有新增回归，不代表仓库全部测试为绿。

## 常见错误

- 在仓库根目录运行测试或 `tsc`。
- 新增共享行为只写了一端的测试，没有写 Product 测试和对等测试。
- 看到 VSCode 测试失败就归为旧债务。先对比失败用例的身份，再下结论。
