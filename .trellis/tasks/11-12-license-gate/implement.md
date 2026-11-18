# Implement

执行清单见 `openspec/changes/resolve-license-boundary/tasks.md`，按组顺序：

1. 签发工具 `script/license/sign.ts`、`issue.ts`（先做，测试与生产密钥都依赖它）
2. CLI `src/license/*`、`src/cli/cmd/license.ts` 与测试 → `packages/opencode` 跑 `bun test test/license` 与 `bun typecheck`
3. VSCode `src/license/*`、`core/workspace.ts`、i18n 与测试 → `sdks/vscode` 跑测试与 typecheck
4. 交付物边界扫描
5. 规范与用户文档

回滚点：每组完成后可独立 `git checkout` 回退；产品代码改动集中在 1–3 组。
