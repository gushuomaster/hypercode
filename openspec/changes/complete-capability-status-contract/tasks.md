# Tasks

## 1. Product 配置事实与摘要

- [x] 1.1 在 `packages/product` 新增原始配置事实输入类型，`deriveProductMcpSummary`/`deriveProductLspSummary`/`deriveProductFormatterSummary` 改为接收它；`capability.test.ts` 覆盖零条目 → `unconfigured`、全部禁用 → `disabled`、配置未知、混合启用；`bun test` 与 `bun typecheck`（`packages/product`）通过
- [x] 1.2 `text.ts` 新增 `status.mcp.unconfigured` 及未知/加载中 key；`text.test.ts` 通过

## 2. Product 单条目语义与 pending

- [x] 2.1 `ProductMcpState`/`ProductLspState`/`ProductFormatterState` 增加 `textKey`，由 Product 依 availability 选择；`mcp.test.ts`、`lsp.test.ts`、`formatter.test.ts` 覆盖每个 availability 的 textKey
- [x] 2.2 MCP 输入增加 `pending` 事实，Product 输出 `connecting`/pending 语义并收起冲突动作；`mcp.test.ts` 覆盖连接中、断开中、重连中

## 3. 共享 fixture

- [x] 3.1 新增 `packages/product/test/fixtures/capability-states.ts`：事实 → 期望结果表，及 TUI SDK 形态、VSCode snapshot 形态的原始输入构造器；覆盖 unconfigured、disabled、unknown、idle、healthy、degraded、failed、needs_auth、needs_client_registration、unsupported、pending

## 4. TUI 适配

- [x] 4.1 `capability-adapter.ts` 改为只归一化原始配置事实；footer、`dialog-status`、`dialog-mcp` 使用 Product 摘要与单条目 textKey，删除 `mcpStatusLabel` 中的 availability 判断；`packages/tui/src/i18n/{en,zh}.ts` 补齐新 key
- [x] 4.2 `capability-summary-parity.test.ts` 改为遍历共享 fixture；`dialog-mcp.test.ts` 覆盖 unconfigured 与 needs_client_registration 显示；`bun test test/product` 与 `bun typecheck`（`packages/tui`）通过

## 5. VSCode 适配

- [x] 5.1 `snapshot.ts` 与 `bridge/types.ts` 改为传原始配置事实；`App.tsx` 删除 `*States.length > 0` 兜底；`status-picker.tsx` 使用 Product textKey 与 severity；`sdks/vscode/src/i18n` 补齐新 key
- [x] 5.2 VSCode capability parity 测试改为遍历共享 fixture；`status-picker` 测试覆盖 unconfigured、needs_client_registration、pending；`bun run check-types`（`sdks/vscode`）通过

## 6. 负向 ownership 测试

- [x] 6.1 重写 `packages/tui/test/product/ownership-boundary.test.ts`：删除对 `availability === "failed" ||` 的正向要求，改为断言 Host 生产代码不含 availability 驱动的文案/色调选择与配置规则判断；运行通过
- [x] 6.2 同步重写 `sdks/vscode/src/product/ownership-boundary.test.ts`，覆盖 `*States.length > 0` 兜底与 status picker availability 链；运行通过

## 7. 集成验证与记录

- [x] 7.1 运行三包 typecheck、Product 全量测试、TUI/VSCode Product 相关测试与 VSCode 打包；全量失败按身份对比已知债务基线（TUI 243/4/1、VSCode 406/29/18），无新增
  - 2026-11-18：三包及 product、core typecheck PASS；Product 全量通过；TUI 278/4/1（4 个失败均为 HEAD 已有的过时断言或 Windows 路径）；VSCode 新增的 3 个 `textKey` 断言回归已修复，`status-picker.tsx` 4 处英文已本地化；VSIX 打包通过（SHA256 `65e92af8…`）。详见 `reports/slimming/post-slimming-baseline.md`"验证基线"
- [ ] 7.2 手工冒烟：无 MCP、全部禁用、连接失败、需要认证四种配置下，TUI 与 VSCode 的摘要与条目文案一致；记录 VSIX SHA256
- [ ] 7.3 在 `docs/阶段记录/` 新增本次 contract 收尾验证记录（命令、结果、失败身份对比、VSIX SHA256），并在记录中逐条核对 cross-host contract 的 Completion Criteria
