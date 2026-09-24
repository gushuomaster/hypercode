# Phase 3C/3D Product Capability Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 locale、theme、command 和 help 的跨宿主产品规则统一投影到 `packages/product`，由 TUI/VSCode adapter 消费。

**Architecture:** Product 只处理纯数据 projection、规范化、排序、fallback 和 capability reason。TUI/VSCode 保留翻译加载、主题资产、配置 API、键盘/鼠标交互和实际 command dispatch。

**Tech Stack:** TypeScript、Bun test、Solid TUI、React VSCode webview。

**Spec:** `docs/superpowers/specs/2026-09-23-phase-3c-3d-product-capabilities-design.md`

## Global Constraints

- 不修改 Protocol、Server `HttpApi` 或 generated client。
- 不把翻译字典、OpenTUI/VS Code runtime、主题资产或 command 执行搬入 Product。
- 宿主缺少能力时返回 `unsupported`，不虚构实现。
- 保持现有持久化字段、配置 key、command message 和宿主 UI 布局。
- 不做无关格式化、line-ending normalization、reset、stash、drop 或 push。

---

### Task 1: Product locale and theme contracts

**Files:**
- Create: `packages/product/src/locale.ts`
- Create: `packages/product/src/theme.ts`
- Modify: `packages/product/src/index.ts`
- Test: `packages/product/test/locale.test.ts`, `packages/product/test/theme.test.ts`

**Interfaces:**
- `normalizeProductLocale(value?: string): ProductLocale`
- `deriveProductLocaleState(input): ProductLocaleState`
- `deriveProductThemeCatalog(inputs): ProductThemeEntry[]`
- `deriveProductThemeSelection(input): ProductThemeSelection`

- [ ] Write failing tests for locale fallback, theme deduplication, deterministic order, and selection fallback.
- [ ] Run the focused Product tests and observe the expected missing-contract failures.
- [ ] Implement pure locale/theme projection without UI or host imports.
- [ ] Run focused Product tests and `bun typecheck` from `packages/product`.

### Task 2: TUI locale/theme adapters

**Files:**
- Create: `packages/tui/src/product/locale-adapter.ts`, `packages/tui/src/product/theme-adapter.ts`
- Create: `packages/tui/test/product/locale-adapter.test.ts`, `packages/tui/test/product/theme-adapter.test.ts`
- Modify: `packages/tui/src/context/language.tsx`, `packages/tui/src/component/dialog-theme-list.tsx`

**Interfaces:**
- `toProductLocale(value?: string): ProductLocaleState`
- `toProductThemes(themes, selected): ProductThemeEntry[]`

- [ ] Add adapter parity tests using locale/theme fixtures.
- [ ] Replace local locale normalization and theme list sorting with Product adapters.
- [ ] Preserve OpenTUI theme application, preview rollback, and key/value persistence.
- [ ] Run TUI focused tests and `bun typecheck`.

### Task 3: VSCode locale/theme adapters

**Files:**
- Create: `sdks/vscode/src/product/locale-adapter.ts`, `sdks/vscode/src/product/theme-adapter.ts`
- Create: `sdks/vscode/src/product/locale-adapter.test.ts`, `sdks/vscode/src/product/theme-adapter.test.ts`
- Modify: `sdks/vscode/src/i18n/index.ts`, `sdks/vscode/src/panel/webview/app/theme-picker.tsx`

**Interfaces:**
- `toVsCodeProductLocale(value?: string): ProductLocaleState`
- `toVsCodeProductThemes(theme, colorScheme): ProductThemeEntry[]`

- [ ] Add adapter tests for equivalent locale/theme inputs and invalid persisted values.
- [ ] Build picker items from Product theme entries without changing labels or VS Code messages.
- [ ] Preserve existing configuration normalization and webview rendering behavior.
- [ ] Run VSCode theme/i18n focused tests, `bun run check-types`, and `bun run package`.

### Task 4: Product command and help contracts

**Files:**
- Create: `packages/product/src/command.ts`, `packages/product/src/help.ts`
- Modify: `packages/product/src/index.ts`
- Test: `packages/product/test/command.test.ts`, `packages/product/test/help.test.ts`

**Interfaces:**
- `deriveProductCommandCatalog(inputs): ProductCommandEntry[]`
- `deriveProductHelpCatalog(inputs): ProductHelpEntry[]`

- [ ] Write tests for hidden filtering, name normalization, deduplication, deterministic order, and unsupported help topics.
- [ ] Implement pure command/help projections and explicit capability reasons.
- [ ] Run Product full tests and typecheck.

### Task 5: Host command/help adapters

**Files:**
- Create: `packages/tui/src/product/command-adapter.ts`, `packages/tui/src/product/help-adapter.ts`
- Create: `sdks/vscode/src/product/command-adapter.ts`, `sdks/vscode/src/product/help-adapter.ts`
- Create corresponding adapter tests.
- Modify: `packages/tui/src/component/command-palette.tsx`, `packages/tui/src/ui/dialog-help.tsx`, `sdks/vscode/src/panel/webview/app/composer-menu.ts`, and related state helpers.

**Interfaces:**
- `toTuiProductCommands(entries): ProductCommandEntry[]`
- `toVsCodeProductCommands(entries): ProductCommandEntry[]`
- `toProductHelpTopics(host): ProductHelpEntry[]`

- [ ] Add cross-host fixtures proving shared sorting/visibility semantics.
- [ ] Feed TUI palette and VSCode slash command builders through Product catalogs.
- [ ] Keep command execution in the host and report unavailable help as `unsupported`.
- [ ] Run TUI/VSCode focused suites and typechecks.

### Task 6: Full validation and commits

- [ ] Run Product full tests/typecheck.
- [ ] Run TUI related tests/typecheck.
- [ ] Run VSCode related tests/check-types/package and record full-suite baseline failures without fixing unrelated tests.
- [ ] Run `git diff --check` and inspect Protocol/HttpApi/generated-client scope.
- [ ] Commit Phase 3C and Phase 3D at the smallest independently verifiable boundaries.
