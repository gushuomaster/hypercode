# Tasks

## 1. 产出审计矩阵

- [x] 1.1 枚举 TUI（`app.tsx`、`prompt/index.tsx`、`diff-viewer.tsx`、`routes/session/index.tsx` 及 keymap 注册）与 VSCode（`core/commands.ts`、`composer-menu.ts`、`package.json` contributes）的全部用户可见命令，产出矩阵初稿：语义 ID、两端入口、能力依赖、建议分类、理由；矩阵覆盖枚举结果中的每一条
- [x] 1.2 与维护者评审矩阵，确认 `shared` / `shared_surface_optional` / `host_only` 分类（重点：rename、share、unshare、language、export、fork、timeline）；评审结论写入矩阵文档
- [x] 1.3 在 `docs/操作手册/上游同步操作流程.md` 的 Product Contract Review 章节引用该矩阵，说明 upstream 新命令的分类步骤

## 2. Product 目录扩充

- [x] 2.1 在 `packages/product/src/command.ts` 加入矩阵确认的新共享命令（语义 ID、规范斜杠、别名、scope、文案 key），`command.test.ts` 覆盖新条目、别名与 `shared_surface_optional` 行为；`packages/product` 测试与 typecheck 通过
- [x] 2.2 更新 `packages/product/test/fixtures/command-contract.ts`，两端 `command-contract-parity` 测试通过

## 3. Host 显式声明

- [x] 3.1 TUI `command-adapter.ts` 改为只接受显式 host_only 声明集合，删除自动归类逻辑；为新共享命令补 `targets` 映射；`packages/tui/test/product/command-adapter.test.ts` 增加"未分类命令导致失败"用例并通过
- [x] 3.2 VSCode 把 `refresh`、`reset-agent` 迁入显式 host_only 声明集合，为新共享命令补 `VsCodeCommandTarget` 与执行绑定（复用 `fix-cross-host-command-dispatch` 的统一分发）；VSCode 测试与 `check-types` 通过

## 4. 上下文事实对齐

- [x] 4.1 在 Product 定义 `canUndo`/`canRedo`/`hasSession` 等事实的输入数据与推导规则，`context.test.ts` 覆盖；两端 adapter 改为上报原始数据；共享 fixture 断言等价会话状态下两端可用性一致（实现：`deriveProductCommandSessionContext` 在 `command.ts`，测试在 `command.test.ts`；VSCode 上报原始会话数据；TUI 仍按 keymap 可达性推导，已用 `session.undo` 的 `enabled` 条件对齐规则）

## 5. 集成验证

- [ ] 5.1 三包 typecheck、Product 与两端 Product 相关测试通过，失败按身份对比已知债务基线无新增；手工冒烟新共享命令在两端可用
  - 自动部分已完成（2026-11-18，见基线文档"验证基线"）；手工冒烟见 `docs/阶段记录/统一收尾冒烟清单_20261118.md` 第 2 节
  - 自动化部分已完成：三包 typecheck 通过；Product 100 pass；TUI product 62 pass；VSCode product/webview/parity 316 pass
  - VSCode 剩余 4 项失败为既有债务，与本 change 无关：`formatter-adapter`、`lsp-adapter`、`session-meta` 断言未跟进 Product 新增的 `textKey`；`timeline-render.test.tsx` 中文字符串乱码导致解析错误
  - 待办：手工冒烟 `/rename`、`/share`、`/unshare` 在 TUI 与 VSCode 可用，`/fork` 在 VSCode 不出现
