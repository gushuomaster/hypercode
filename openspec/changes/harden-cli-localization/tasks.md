# Tasks

## 1. CLI 本地化审计

- [x] 1.1 参照 `packages/tui/test/i18n/hardcoded-copy.test.ts` 的扫描方式，新增 `packages/opencode/test/cli/localization-audit.test.ts`，覆盖 `packages/opencode/src/cli` 的用户可见位置与仓库自带命令元数据，白名单仅含技术标识；在 `packages/opencode` 下运行
  - 四条审计：① 命令与参数的 `describe`/`description` 在中文模式下必须能经 `cliText()` 查到翻译（插值 `${UI.product}` 按 HyperCode 展开，白名单只有 URL）；② 运行时输出（`UI.error`、`prompts.*`）的硬编码英文按文件冻结为已知债务基线，增减都会失败；③ 中文只允许出现在 `text.ts`、`yargs.ts`、`cmd/license.ts` 三个 zh/en 字典文件中；④ `.opencode/command/*.md` 必须带 `description_i18n` 且 zh 为中文
  - `cmd/run/demo.ts` 是 `run --demo` 的演示脚本，其中字符串是假数据，排除在外
  - 运行时英文债务共 124 条，集中在 upstream 命令文件（`mcp.ts` 60 条）；逐条翻译会让这些文件每次同步都冲突，因此只冻结不翻译
- [x] 1.2 修正审计发现的硬编码文案（CLI 源码走 locale 字典；`.opencode/command` 元数据使用 `description_i18n`，先评估 fork tax 再改）；审计测试通过
  - `text.ts`：`hypercode auth provider`（`auth login [url]` 的参数说明）原为原样映射，改为"HyperCode 认证服务地址"
  - `main.ts`：崩溃兜底提示 "Unexpected error" 改走 `cliText()`，新增中文"发生意外错误"；后面附带的原始错误信息保留原文
  - `.opencode/command` 8 个文件已全部带 `description_i18n`，无需修改
- [x] 1.3 运行 `bun test test/cli/locale.test.ts test/cli/help test/cli/run/localization.test.tsx test/cli/localization-audit.test.ts` 与 `bun typecheck`（`packages/opencode`），以及 `bun test test/i18n`（`packages/tui`），全部通过
  - opencode：11 pass（含 34 个帮助快照），typecheck 通过；tui `test/i18n`：10 pass
  - 必须带 `--timeout 30000`（包脚本 `bun run test` 已默认带）：`test/preload.ts` 的全局 `afterAll` 会冷加载 `app-runtime`，单独跑轻量测试文件时可能超过 bun 默认 5 秒的钩子超时

- [x] 1.4 修复：Windows 默认不设置 `LANG`，导致全新的中文 Windows 上 `--help` 显示英文（3.1 冒烟时发现）
  - `packages/tui/src/i18n/index.ts` 新增 `localeEnvironment()`，在 `LANG`/`LC_ALL`/`LANGUAGE` 都没有设置时，用 `Intl.DateTimeFormat().resolvedOptions().locale` 读取操作系统显示语言作为最后一级回退；`packages/opencode/src/cli/locale.ts` 改用它
  - `packages/tui/test/i18n/locale.test.ts` 新增系统语言回退用例；环境变量仍然优先
  - `packages/opencode/test/preload.ts`（upstream 文件，fork tax +1）固定 `LANG=en_US.UTF-8`，让 upstream 英文断言在中文主机上保持稳定；`test/cli` 378 pass
  - 使用说明书 12.6 第 3 条同步更新

## 2. 用户文档

- [ ] 2.1 在 `docs/用户指南/使用说明书.md`（或 1.18.30 升级说明 §3.1）补充语言优先级、`/language` 即时切换、外部来源标签说明；按文档描述在 TUI 中实际操作一遍确认一致
  - 文档已补：使用说明书新增 12.6 节，升级说明 3.1 增加优先级说明并指向 12.6；内容按源码核实（`context/language.tsx`、`i18n/index.ts` 的 `commandSourceLabel`、`cli/locale.ts`）
  - 待办：TUI 实际操作核对，留到最后统一验证

## 3. 冒烟

- [ ] 3.1 构建 Windows x64 验证版 EXE（`bun run build:windows-validation`），在中文与英文系统语言下分别运行 `--help`、`mcp --help`、`run --help` 与 TUI `/language`，记录结果与 EXE SHA256（留到最后统一验证）
  - 2026-11-18 自动部分已完成：EXE SHA256 `d4ae941375e96e1a0ec0dea984046297f22c12a4ddc7a18dd77374f6bc35dd53`。不设置 `LANG`、状态目录隔离时，`--help`、`mcp --help`、`run --help` 均为中文；设置 `LANG=en_US.UTF-8` 时为英文。yargs 内置的 `[aliases: …]`、`[default: …]`、`[choices: …]` 仍为英文（已知限制）
  - 待用户手测：TUI `/language`
