# HyperCode CLI/TUI Global Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all HyperCode-owned CLI and TUI copy switch cleanly between Simplified Chinese and English while preserving stable technical identifiers and external author content.

**Architecture:** A pure locale module in `@opencode-ai/tui` owns locale normalization, typed dictionaries, interpolation, and localized command-description selection. The reactive TUI language context adapts that core, while the OpenCode CLI initializes the same global locale before dynamically loading its command tree. Command configuration and protocol retain the legacy description string and add an optional locale map.

**Tech Stack:** TypeScript, Bun, SolidJS, OpenTUI, Effect Schema/HttpApi, Yargs

**Spec:** `docs/superpowers/specs/2026-09-18-cli-localization-design.md`

## Global Constraints

- Modify CLI/TUI only; do not modify `packages/app` UI files.
- Preserve command names, flags, model/provider IDs, paths, URLs, shortcuts, and protocol identifiers.
- Keep `MCP`, `LSP`, `API key`, `JSON`, `Shell`, and similar technical terms through an explicit allowlist.
- Locale precedence is `tui.json` > saved KV language > environment.
- Detect `zh*` as Chinese and every other system locale as English.
- Keep third-party error text and add localized HyperCode context.
- Keep legacy `description?: string`; add optional `description_i18n?: { zh?: string; en?: string }`.
- Do not create Git commits unless the user explicitly requests them.
- Run tests and type checks from package directories, never from repository root.

---

### Task 1: Pure Locale Core

**Files:**
- Create: `packages/tui/src/i18n/index.ts`
- Modify: `packages/tui/src/i18n/en.ts`
- Modify: `packages/tui/src/i18n/zh.ts`
- Modify: `packages/tui/src/context/language.tsx`
- Modify: `packages/tui/package.json`
- Create: `packages/tui/test/i18n/locale.test.ts`

**Interfaces:**
- Produces: `Locale`, `LOCALES`, `normalizeLocale(value, environment?)`, `setLocale(locale)`, `getLocale()`, `t(key, params?, locale?)`, and `localizedDescription(command, locale?)` from `@opencode-ai/tui/i18n`.
- Consumes: existing `dict` exports from `en.ts` and `zh.ts`.

- [x] **Step 1: Write failing locale-core tests**

```ts
import { describe, expect, test } from "bun:test"
import { normalizeLocale, setLocale, t } from "../../src/i18n"
import { dict as en } from "../../src/i18n/en"
import { dict as zh } from "../../src/i18n/zh"

describe("locale core", () => {
  test("keeps dictionary keys aligned", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  test("detects only Chinese environments as Chinese", () => {
    expect(normalizeLocale(undefined, { LANG: "zh_CN.UTF-8" })).toBe("zh")
    expect(normalizeLocale(undefined, { LANG: "ja_JP.UTF-8" })).toBe("en")
    expect(normalizeLocale(undefined, { LANG: "en_US.UTF-8" })).toBe("en")
  })

  test("switches translations without recreating the translator", () => {
    setLocale("zh")
    expect(t("dialog.select.search")).toBe("搜索")
    setLocale("en")
    expect(t("dialog.select.search")).toBe("Search")
  })
})
```

- [x] **Step 2: Run the test and verify RED**

Run from `packages/tui`: `bun test test/i18n/locale.test.ts`

Expected: FAIL because `src/i18n/index.ts` and the new translation keys do not exist.

- [x] **Step 3: Implement the pure locale API**

```ts
export type Locale = "en" | "zh"
export const LOCALES = ["zh", "en"] as const

export function normalizeLocale(value: unknown, environment = process.env): Locale {
  if (value === "en" || value === "zh") return value
  const detected = environment.LANG || environment.LC_ALL || environment.LANGUAGE || ""
  return detected.toLowerCase().startsWith("zh") ? "zh" : "en"
}
```

Move the module-level locale signal/translator boundary out of the Solid context, keep the context as the KV/config adapter, and export the pure subpath in `packages/tui/package.json`.

- [x] **Step 4: Run locale tests and TUI typecheck**

Run from `packages/tui`:

```powershell
bun test test/i18n/locale.test.ts
bun typecheck
```

Expected: PASS.

### Task 2: Shared Locale Resolution at CLI Startup

**Files:**
- Create: `packages/opencode/src/cli/locale.ts`
- Create: `packages/opencode/src/cli/main.ts`
- Modify: `packages/opencode/src/index.ts`
- Modify: `packages/opencode/src/cli/cmd/tui.ts`
- Create: `packages/opencode/test/cli/locale.test.ts`

**Interfaces:**
- Produces: `resolveCliLocale({ directory, configFiles, stateFile, environment })` and `initializeCliLocale(directory)`.
- Consumes: `setLocale` and `normalizeLocale` from `@opencode-ai/tui/i18n`.

- [x] **Step 1: Write failing precedence tests**

```ts
test("uses config before saved state and environment", async () => {
  expect(
    await resolveCliLocale({
      directory,
      configFiles: [configWith({ language: "en" })],
      stateFile: kvWith({ language: "zh" }),
      environment: { LANG: "zh_CN.UTF-8" },
    }),
  ).toBe("en")
})
```

Cover config, KV, environment, invalid values, missing files, JSONC comments, and nearest-project config precedence.

- [x] **Step 2: Run the test and verify RED**

Run from `packages/opencode`: `bun test test/cli/locale.test.ts`

Expected: FAIL because `resolveCliLocale` does not exist.

- [x] **Step 3: Implement lightweight locale loading**

Read only language fields from applicable `tui.json`/`tui.jsonc` files and `Global.Path.state/kv.json`. Do not initialize plugins, servers, or the TUI runtime. Return the system-derived locale on all read/parse failures.

- [x] **Step 4: Split CLI bootstrap from command-tree construction**

Keep `packages/opencode/src/index.ts` as the build entry:

```ts
import { initializeCliLocale } from "./cli/locale"

await initializeCliLocale(process.cwd())
await import("./cli/main")
```

Move the current Yargs construction to `packages/opencode/src/cli/main.ts` so command modules evaluate only after locale initialization.

- [x] **Step 5: Verify locale tests and typecheck**

Run from `packages/opencode`:

```powershell
bun test test/cli/locale.test.ts
bun typecheck
```

Expected: PASS.

### Task 3: Model, Agent, and Shared Dialog Localization

**Files:**
- Modify: `packages/tui/src/component/dialog-model.tsx`
- Modify: `packages/tui/src/component/dialog-agent.tsx`
- Modify: `packages/tui/src/ui/dialog-select.tsx`
- Modify: `packages/tui/src/ui/dialog-prompt.tsx`
- Modify: `packages/tui/src/component/command-palette.tsx`
- Modify: `packages/tui/src/component/prompt/index.tsx`
- Modify: `packages/tui/test/cli/cmd/tui/model-options.test.ts`
- Create: `packages/tui/test/i18n/shared-ui-copy.test.ts`

**Interfaces:**
- Produces: localized model section data and `agentDisplayName(name, locale?)`.
- Consumes: `t`/`useLanguage` from the shared locale layer.

- [x] **Step 1: Replace language-specific model tests with bilingual failing tests**

```ts
test("localizes model sections without changing their semantic IDs", () => {
  expect(modelSections(input, "zh").map((item) => item.label)).toEqual(["收藏", "最近使用", "已配置", "当前模型"])
  expect(modelSections(input, "en").map((item) => item.label)).toEqual([
    "Favorites",
    "Recent",
    "Configured",
    "Current model",
  ])
})

test("localizes generated free-model capabilities", () => {
  expect(freeModelDescription(info, "zh")).toContain("支持文本、图片、视频输入")
  expect(freeModelDescription(info, "en")).toContain("Supports text, image, and video input")
})
```

- [x] **Step 2: Run focused tests and verify RED**

Run from `packages/tui`: `bun test test/cli/cmd/tui/model-options.test.ts test/i18n/shared-ui-copy.test.ts`

Expected: FAIL on current hardcoded labels and missing locale parameters.

- [x] **Step 3: Localize shared selectors and built-in agent display names**

Move `Select model`, `Search`, `No results found`, `Free`, `Favorite`, section names, model descriptions, dialog action names, `Build/Plan`, `Shell`, and shared dialog keybinding descriptions into dictionaries. Keep model/provider names and internal agent IDs unchanged.

- [x] **Step 4: Verify focused tests and typecheck**

Run from `packages/tui`:

```powershell
bun test test/cli/cmd/tui/model-options.test.ts test/i18n/shared-ui-copy.test.ts
bun typecheck
```

Expected: PASS.

### Task 4: Command Description Localization and Source Labels

**Files:**
- Modify: `packages/core/src/v1/config/command.ts`
- Modify: `packages/core/src/config/command.ts`
- Modify: `packages/schema/src/command.ts`
- Modify: `packages/opencode/src/command/index.ts`
- Modify: `packages/tui/src/component/prompt/autocomplete.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/footer.command.tsx`
- Modify: `.opencode/command/ai-deps.md`
- Modify: `.opencode/command/changelog.md`
- Modify: `.opencode/command/commit.md`
- Modify: `.opencode/command/issues.md`
- Modify: `.opencode/command/learn.md`
- Modify: `.opencode/command/rmslop.md`
- Modify: `.opencode/command/spellcheck.md`
- Modify: `.opencode/command/translate.md`
- Modify: `packages/core/test/config/command.test.ts`
- Modify: `packages/core/test/command.test.ts`
- Create: `packages/tui/test/i18n/command-description.test.ts`
- Regenerate: `packages/client/src/generated/**`
- Regenerate: `packages/client/src/generated-effect/**`

**Interfaces:**
- Produces: `description_i18n?: { zh?: string; en?: string }` through config, schema, command endpoints, and generated clients.
- Consumes: `localizedDescription` from the shared locale core.

- [x] **Step 1: Write failing config/schema compatibility tests**

```ts
test("loads localized descriptions while preserving the legacy fallback", async () => {
  const command = await loadCommand(`---
description: Commit changes
description_i18n:
  zh: 提交更改
  en: Commit changes
---
prompt`)
  expect(command.description).toBe("Commit changes")
  expect(command.description_i18n).toEqual({ zh: "提交更改", en: "Commit changes" })
})
```

Also assert that an existing file with only `description` decodes unchanged.

- [x] **Step 2: Run config tests and verify RED**

Run from `packages/core`: `bun test test/config/command.test.ts test/command.test.ts`

Expected: FAIL because the new field is rejected or dropped.

- [x] **Step 3: Implement schema and command propagation**

Add the optional locale map without changing the legacy field. Built-in `/init` and `/review` commands provide both locales. MCP/Skill descriptions remain external strings.

- [x] **Step 4: Add localized repository command metadata**

Each `.opencode/command/*.md` file keeps a concise English `description`, adds both `zh` and `en` under `description_i18n`, and does not change its filename or command name.

- [x] **Step 5: Localize display and source labels**

TUI and mini command menus select the localized description and show localized source metadata for `command`, `mcp`, and `skill`. A user/project command uses “自定义”/`Custom` unless it carries localized metadata.

- [x] **Step 6: Regenerate clients and verify**

Run from `packages/client`: `bun run generate`

Then run from `packages/core`, `packages/schema`, `packages/protocol`, `packages/client`, `packages/tui`, and `packages/opencode` as applicable:

```powershell
bun typecheck
```

Expected: PASS with generated types containing `description_i18n`.

### Task 5: Complete Main TUI Localization

**Files:**
- Modify: `packages/tui/src/app.tsx`
- Modify: `packages/tui/src/component/dialog-console-org.tsx`
- Modify: `packages/tui/src/component/dialog-debug.tsx`
- Modify: `packages/tui/src/component/dialog-mcp.tsx`
- Modify: `packages/tui/src/component/dialog-move-session.tsx`
- Modify: `packages/tui/src/component/dialog-provider.tsx`
- Modify: `packages/tui/src/component/dialog-session-delete-failed.tsx`
- Modify: `packages/tui/src/component/dialog-session-list.tsx`
- Modify: `packages/tui/src/component/dialog-session-rename.tsx`
- Modify: `packages/tui/src/component/dialog-skill.tsx`
- Modify: `packages/tui/src/component/dialog-status.tsx`
- Modify: `packages/tui/src/component/dialog-stash.tsx`
- Modify: `packages/tui/src/component/dialog-theme-list.tsx`
- Modify: `packages/tui/src/component/dialog-variant.tsx`
- Modify: `packages/tui/src/component/dialog-workspace-create.tsx`
- Modify: `packages/tui/src/component/dialog-workspace-list.tsx`
- Modify: `packages/tui/src/component/dialog-workspace-unavailable.tsx`
- Modify: `packages/tui/src/component/error-component.tsx`
- Modify: `packages/tui/src/ui/dialog-alert.tsx`
- Modify: `packages/tui/src/ui/dialog-confirm.tsx`
- Modify: `packages/tui/src/ui/dialog-export-options.tsx`
- Modify: `packages/tui/src/ui/dialog-help.tsx`
- Modify: `packages/tui/src/ui/toast.tsx`
- Create: `packages/tui/test/i18n/hardcoded-copy.test.ts`

**Interfaces:**
- Consumes: dictionary keys through `useLanguage().t` in components and `translate`/`t` in non-component command registrations.

- [x] **Step 1: Write a failing hardcoded-copy audit**

The test parses `packages/tui/src/**/*.{ts,tsx}` and reports English literals in JSX text plus `title`, `description`, `placeholder`, `message`, `category`, `pending`, `complete`, and `footer` properties. The allowlist contains only approved technical identifiers and proper nouns.

```ts
expect(violations).toEqual([])
```

- [x] **Step 2: Run the audit and capture RED**

Run from `packages/tui`: `bun test test/i18n/hardcoded-copy.test.ts`

Expected: FAIL with current dialog, status, export, provider, debug, and error-page strings.

- [x] **Step 3: Move all reported product copy into paired dictionaries**

Use translation keys grouped by feature (`dialog.provider.*`, `dialog.status.*`, `dialog.export.*`, `error.*`). Keep external provider descriptions and third-party errors untouched; wrap them with localized product context where shown.

- [x] **Step 4: Re-run audit and component tests**

Run from `packages/tui`:

```powershell
bun test test/i18n/hardcoded-copy.test.ts test/cli/tui/diff-viewer.test.tsx test/cli/tui/dialog-prompt.test.tsx
bun typecheck
```

Expected: PASS.

### Task 6: Session, Permission, Diff, and Plugin Localization

**Files:**
- Modify: `packages/tui/src/routes/session/index.tsx`
- Modify: `packages/tui/src/routes/session/permission.tsx`
- Modify: `packages/tui/src/routes/session/question.tsx`
- Modify: `packages/tui/src/routes/session/sidebar.tsx`
- Modify: `packages/tui/src/routes/session/footer.tsx`
- Modify: `packages/tui/src/routes/session/subagent-footer.tsx`
- Modify: `packages/tui/src/routes/session/dialog-message.tsx`
- Modify: `packages/tui/src/routes/session/dialog-subagent.tsx`
- Modify: `packages/tui/src/routes/session/dialog-fork-from-timeline.tsx`
- Modify: `packages/tui/src/routes/session/dialog-timeline.tsx`
- Modify: `packages/tui/src/feature-plugins/system/diff-viewer.tsx`
- Modify: `packages/tui/src/feature-plugins/system/diff-viewer-file-tree.tsx`
- Modify: `packages/tui/src/feature-plugins/system/plugins.tsx`
- Modify: `packages/tui/src/feature-plugins/system/which-key.tsx`
- Modify: `packages/tui/src/feature-plugins/sidebar/context.tsx`
- Modify: `packages/tui/src/feature-plugins/sidebar/files.tsx`
- Modify: `packages/tui/src/feature-plugins/sidebar/footer.tsx`
- Modify: `packages/tui/src/feature-plugins/sidebar/mcp.tsx`
- Modify: `packages/tui/src/feature-plugins/sidebar/todo.tsx`
- Modify: `packages/tui/src/feature-plugins/home/tips-view.tsx`

**Interfaces:**
- Consumes: feature-grouped translation keys and the approved technical-term allowlist.

- [x] **Step 1: Extend the hardcoded-copy test with session/plugin fixtures**

Add assertions that dynamic tool labels use localized templates while preserving `WebFetch`, `Glob`, `Grep`, paths, URLs, and raw third-party details.

- [x] **Step 2: Run the audit and verify the remaining RED set**

Run from `packages/tui`: `bun test test/i18n/hardcoded-copy.test.ts`

Expected: FAIL only in the files listed by this task.

- [x] **Step 3: Localize every reported product-owned string**

Cover command titles/categories, toasts, permission actions, question controls, queue/interruption states, tool progress, sidebars, Diff source/actions/help, plugin install/status, and crash recovery.

- [x] **Step 4: Verify TUI localization and behavior**

Run from `packages/tui`:

```powershell
bun test test/i18n test/cli/tui/diff-viewer.test.tsx test/cli/tui/diff-viewer-file-tree.test.tsx
bun typecheck
```

Expected: PASS and zero unapproved hardcoded product copy.

### Task 7: Mini Interactive Interface Localization

**Files:**
- Modify: `packages/opencode/src/cli/cmd/run/footer.command.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/footer.permission.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/footer.prompt.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/footer.question.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/footer.subagent.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/footer.view.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/permission.shared.ts`
- Modify: `packages/opencode/src/cli/cmd/run/scrollback.writer.tsx`
- Modify: `packages/opencode/src/cli/cmd/run/subagent-data.ts`
- Modify: `packages/opencode/src/cli/cmd/run/tool.ts`
- Create: `packages/opencode/test/cli/run/localization.test.ts`

**Interfaces:**
- Consumes: `t`, `getLocale`, `localizedDescription`, and source-label helpers from `@opencode-ai/tui/i18n`.

- [x] **Step 1: Write failing bilingual mini-interface tests**

Assert representative Chinese/English command menu, permission, question, queue, subagent, and tool labels without changing technical identifiers.

- [x] **Step 2: Run focused tests and verify RED**

Run from `packages/opencode`: `bun test test/cli/run/localization.test.ts`

- [x] **Step 3: Replace mini-interface hardcoded copy with shared translations**

Keep state values and tool IDs unchanged. Localize only their rendered titles, descriptions, placeholders, progress text, and errors.

- [x] **Step 4: Verify mini-interface tests and typecheck**

Run from `packages/opencode`:

```powershell
bun test test/cli/run/localization.test.ts test/cli/run/footer.view.test.tsx test/cli/run/permission.shared.test.ts
bun typecheck
```

Expected: PASS.

### Task 8: Traditional CLI Help and Prompt Localization

**Files:**
- Modify: `packages/opencode/src/cli/main.ts`
- Modify: `packages/opencode/src/cli/network.ts`
- Modify: `packages/opencode/src/cli/cmd/account.ts`
- Modify: `packages/opencode/src/cli/cmd/acp.ts`
- Modify: `packages/opencode/src/cli/cmd/agent.ts`
- Modify: `packages/opencode/src/cli/cmd/attach.ts`
- Modify: `packages/opencode/src/cli/cmd/db.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/agent.handler.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/agent.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/config.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/file.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/index.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/lsp.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/ripgrep.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/scrap.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/skill.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/snapshot.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/startup.ts`
- Modify: `packages/opencode/src/cli/cmd/debug/v2.ts`
- Modify: `packages/opencode/src/cli/cmd/export.ts`
- Modify: `packages/opencode/src/cli/cmd/github.ts`
- Modify: `packages/opencode/src/cli/cmd/import.ts`
- Modify: `packages/opencode/src/cli/cmd/license.ts`
- Modify: `packages/opencode/src/cli/cmd/mcp.ts`
- Modify: `packages/opencode/src/cli/cmd/models.ts`
- Modify: `packages/opencode/src/cli/cmd/plug.ts`
- Modify: `packages/opencode/src/cli/cmd/pr.ts`
- Modify: `packages/opencode/src/cli/cmd/providers.ts`
- Modify: `packages/opencode/src/cli/cmd/run.ts`
- Modify: `packages/opencode/src/cli/cmd/serve.ts`
- Modify: `packages/opencode/src/cli/cmd/session.ts`
- Modify: `packages/opencode/src/cli/cmd/stats.ts`
- Modify: `packages/opencode/src/cli/cmd/tui.ts`
- Modify: `packages/opencode/src/cli/cmd/uninstall.ts`
- Modify: `packages/opencode/src/cli/cmd/upgrade.ts`
- Modify: `packages/opencode/src/cli/cmd/web.ts`
- Modify: `packages/opencode/test/cli/help/help-snapshots.test.ts`
- Regenerate: `packages/opencode/test/cli/help/__snapshots__/help-snapshots.test.ts.snap`
- Create: `packages/opencode/test/cli/help/localization.test.ts`

**Interfaces:**
- Consumes: shared `t` and initialized global locale.

- [x] **Step 1: Write failing Chinese/English help tests**

Spawn representative commands with isolated `tui.json` files and assert:

```ts
expect(zh.stderr).toContain("管理 MCP（模型上下文协议）服务器")
expect(zh.stderr).toContain("显示帮助")
expect(zh.stderr).toContain("hypercode mcp add [name]")
expect(en.stderr).toContain("manage MCP (Model Context Protocol) servers")
```

- [x] **Step 2: Run tests and verify RED**

Run from `packages/opencode`: `bun test test/cli/help/localization.test.ts`

- [x] **Step 3: Localize Yargs framework strings and every command definition**

Translate command descriptions, positional/option descriptions, prompts, confirmation labels, and product errors. Configure Yargs headings such as `Commands`, `Positionals`, and `Options` from the current locale. Keep command syntax and flags unchanged.

- [x] **Step 4: Update help snapshots for both locales**

Make the existing broad snapshot suite explicit about English locale and add focused Chinese snapshots, preventing host-language-dependent output.

- [x] **Step 5: Verify CLI help and typecheck**

Run from `packages/opencode`:

```powershell
bun test test/cli/help/localization.test.ts test/cli/help/help-snapshots.test.ts
bun typecheck
```

Expected: PASS.

### Task 9: Global Copy Audit, Documentation, and EXE

**Files:**
- Create: `packages/opencode/test/cli/localization-audit.test.ts`
- Modify: `docs/用户指南/1.18.30升级说明.md`
- Modify: `docs/后续修改清单.md`

**Interfaces:**
- Consumes: all localized surfaces and allowlists from earlier tasks.
- Produces: final source audit and the Windows x64 validation executable.

- [x] **Step 1: Add the final CLI/TUI source audit**

Scan `packages/tui/src`, `packages/opencode/src/cli`, and repository-owned command metadata. Assert no product-owned hardcoded English appears in audited UI positions and no hardcoded Chinese appears outside locale dictionaries/documentation. Keep a reviewed allowlist for technical identifiers only.

- [x] **Step 2: Run all localization tests**

Run from `packages/tui`:

```powershell
bun test test/i18n test/cli/cmd/tui/model-options.test.ts
bun typecheck
```

Run from `packages/opencode`:

```powershell
bun test test/cli/locale.test.ts test/cli/help test/cli/run/localization.test.ts test/cli/localization-audit.test.ts
bun typecheck
```

- [x] **Step 3: Update user documentation**

Document locale precedence, immediate `/language` switching, translated built-in command descriptions, preserved technical identifiers, external-source labels, and the CLI help behavior. Remove or close the corresponding localization item in `docs/后续修改清单.md` only after all tests pass.

- [x] **Step 4: Run generated-code and diff checks**

From the relevant package directories, run required type checks. From repository root run only non-test inspection commands:

```powershell
git diff --check
git status --short
```

- [x] **Step 5: Build the pure CLI/TUI Windows executable**

Run from `packages/opencode`:

```powershell
cd D:\project\hypercode
bun run build:windows-validation
```

Expected output: `packages/opencode/dist/hypercode-windows-x64/bin/hypercode.exe`.

- [x] **Step 6: Smoke-test both locales and record the hash**

Run the built executable with isolated Chinese and English locale configuration for:

```powershell
hypercode.exe --help
hypercode.exe mcp --help
hypercode.exe run --help
```

Confirm command syntax remains unchanged, descriptions switch languages, then compute SHA256 with `Get-FileHash`.
