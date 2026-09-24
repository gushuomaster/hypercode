# HyperCode Skill Catalog Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 TUI 与 VSCode 建立共享的 Skill 来源、覆盖、分组和排序契约，并确保 Core 同名 Skill 的实际生效结果稳定。

**Architecture:** Core 只稳定 legacy Skill 的同名覆盖顺序；`packages/product` 根据 Skill location 与显式 workspace/home 边界派生 canonical catalog；TUI/VSCode adapter 消费同一投影并只负责本地化与渲染。保持现有 HTTP schema 与 generated client 不变。

**Tech Stack:** TypeScript, Effect, Bun test, Solid/OpenTUI, React/VSCode

**Spec:** `docs/superpowers/specs/2026-09-24-skill-catalog-alignment-design.md`

## Global Constraints

- 不修改 Protocol、Server `HttpApi` 或 generated client。
- 不通过 Host 私有路径判断重新实现 scope、fallback、排序或同名覆盖。
- 项目 Skill 优先于全局，内置最低；无法证明来源时标记 `external`。
- 不改变 Skill tool、权限、内容或 prompt 注入语义。
- 不做无关格式化、line-ending normalization 或 push。

---

### Task 1: Shared Product Skill Catalog

**Files:**
- Create: `packages/product/src/skill.ts`
- Create: `packages/product/test/skill.test.ts`
- Modify: `packages/product/src/index.ts`

**Interfaces:**
- Produces: `deriveProductSkillCatalog(input: ProductSkillCatalogInput): ProductSkillCatalog`
- Produces: `ProductSkillScope`, `ProductSkillItem`, `ProductSkillGroup`

- [ ] **Step 1: Write failing fixtures**

覆盖 Windows/POSIX workspace 边界、home、`<built-in>`、URL/unknown、同名 `project > global > external > builtin` 和组内名称排序。

- [ ] **Step 2: Verify RED**

Run: `Push-Location packages/product; bun test test/skill.test.ts; Pop-Location`

Expected: FAIL because `deriveProductSkillCatalog` does not exist.

- [ ] **Step 3: Implement the pure projection**

实现跨平台路径规范化、边界匹配、scope priority、name dedupe、`overrides` 和 group ordering；不导入 Node、Solid、React 或 Host API。

- [ ] **Step 4: Verify GREEN**

Run: `Push-Location packages/product; bun test test/skill.test.ts; bun typecheck; Pop-Location`

- [ ] **Step 5: Commit**

Commit: `feat(product): add shared skill catalog projection`

### Task 2: Deterministic Core Skill Precedence

**Files:**
- Modify: `packages/opencode/src/skill/index.ts`
- Modify: `packages/opencode/test/skill/skill.test.ts`

**Interfaces:**
- Consumes: existing `Skill.Info` and unchanged `app.skills` response.
- Produces: deterministic same-name winner matching `project > global > external > builtin`.

- [ ] **Step 1: Write a failing integration test**

在隔离 home 与 project 中创建同名 Skill，断言 `skill.get(name)` 和 `skill.all()` 返回项目 location/content；重复加载结果不依赖解析完成顺序。

- [ ] **Step 2: Verify RED**

Run from `packages/opencode`: `bun test test/skill/skill.test.ts --test-name-pattern "project skill overrides"`

- [ ] **Step 3: Stabilize discovery/load order**

为内部 discovered match 计算 scope priority 和规范化 location；按低到高顺序串行 `add`，保留 duplicate warning。不得改变公开 `Skill.Info` schema。

- [ ] **Step 4: Verify GREEN**

Run from `packages/opencode`: `bun test test/skill/skill.test.ts`

- [ ] **Step 5: Commit**

Commit: `fix(opencode): stabilize skill source precedence`

### Task 3: TUI Grouped Skill Picker

**Files:**
- Modify: `packages/tui/src/component/dialog-skill.tsx`
- Modify: `packages/tui/src/i18n/en.ts`
- Modify: `packages/tui/src/i18n/zh.ts`
- Create: `packages/tui/test/product/skill-adapter.test.ts`

**Interfaces:**
- Consumes: `deriveProductSkillCatalog`, TUI workspace/home paths and existing `app.skills` payload.
- Produces: `DialogSelectOption` categories from Product `textKey`; no Host sorting or source inference.

- [ ] **Step 1: Write failing adapter tests**

同一 fixture 断言分类为项目/全局/内置/外部，顺序稳定，并验证中文 category 文案。

- [ ] **Step 2: Verify RED**

Run from `packages/tui`: `bun test test/product/skill-adapter.test.ts`

- [ ] **Step 3: Adapt the dialog**

使用 `useTuiPaths()` 提供 `worktree/cwd/home`，将 Product item 映射为现有 option；删除统一 `Skill` category。

- [ ] **Step 4: Verify GREEN**

Run from `packages/tui`: `bun test test/product/skill-adapter.test.ts test/i18n/locale.test.ts; bun typecheck`

- [ ] **Step 5: Commit**

Commit: `refactor(tui): group skills by product scope`

### Task 4: VSCode Skill Picker Parity

**Files:**
- Modify: `sdks/vscode/src/bridge/types.ts`
- Modify: `sdks/vscode/src/core/skills.ts`
- Modify: `sdks/vscode/src/panel/webview/app/composer-menu.ts`
- Modify: `sdks/vscode/src/panel/webview/hooks/useComposerAutocomplete.ts`
- Modify: `sdks/vscode/src/panel/webview/app/App.tsx`
- Modify: `sdks/vscode/src/i18n/en.ts`
- Modify: `sdks/vscode/src/i18n/zh.ts`
- Modify: relevant existing tests

**Interfaces:**
- Consumes: shared Product Skill catalog and workspace directory/home boundary.
- Produces: serialized `scope/textKey` on `SkillCatalogEntry` and grouped/source-labelled dedicated Skill picker entries.

- [ ] **Step 1: Write failing loader/menu tests**

断言 extension host 投影 scope，webview 使用 canonical order，Skill popup 显示本地化来源且搜索结果保持 scope。

- [ ] **Step 2: Verify RED**

Run from `sdks/vscode`: `bun test src/core/skills.test.ts src/panel/webview/app/composer-menu.test.ts`

- [ ] **Step 3: Adapt loader and renderer**

extension host 使用 `os.homedir()` 与 workspaceDir 调用 Product；webview 只读 scope/textKey。为 autocomplete item 增加可选 category，Skill picker 在 category 变化处渲染分组标题。

- [ ] **Step 4: Verify GREEN**

Run from `sdks/vscode`: `bun test src/core/skills.test.ts src/panel/webview/app/composer-menu.test.ts; bun run check-types; bun run package`

- [ ] **Step 5: Commit**

Commit: `refactor(vscode): group skills by product scope`

### Task 5: Parity, Full Verification, and Windows Artifact

**Files:**
- Modify: `docs/阶段记录/2026-09-24-product-default-audit.md` only if a new maintenance note is required.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: verified TUI/VSCode parity and updated Windows validation executable.

- [ ] **Step 1: Run scoped suites**

Run Product full/typecheck, Core Skill suite, TUI Product/i18n/typecheck, VSCode focused/check-types/package.

- [ ] **Step 2: Run maintenance full suites**

Compare TUI and VSCode full failure identities with the existing known baseline; any new failure stops completion.

- [ ] **Step 3: Build and validate EXE**

Run from root: `bun run build:windows-validation`, followed by `hypercode.exe --help`, `--version`, size and SHA-256 checks.

- [ ] **Step 4: Final repository checks**

Run: `git diff --check`, `git status --short`, and verify no Protocol/HttpApi/generated-client diff.

## Self-Review

- Spec coverage: source classification, precedence, stable order, grouping, search, localization, parity and no-Protocol constraint are each assigned to a task.
- Placeholder scan: no deferred implementation step remains.
- Type consistency: Product owns `scope/textKey`; bridge may serialize those fields but Host does not derive them.

