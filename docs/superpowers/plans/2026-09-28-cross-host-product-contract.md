# Cross-Host Product Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `packages/product` the enforceable owner of shared TUI/VSCode commands and capability-status semantics, then add synchronization gates that prevent Host drift.

**Architecture:** Core and Host adapters provide configuration, raw runtime facts and truthful capability support. Product owns the canonical shared command catalog, command resolution, individual capability meaning and aggregate summaries; TUI and VSCode bind Product action intent to their native APIs and render Product output.

**Tech Stack:** TypeScript, Bun tests, SolidJS/OpenTUI, React/VSCode Webview, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-28-cross-host-product-contract-design.md`

## Global Constraints

- Preserve the existing uncommitted VSCode session-selection changes; stage and commit only files belonging to the current task.
- `packages/product` must not import Host, SDK, VSCode, React, SolidJS or OpenTUI modules.
- Host-only behavior remains explicit and must not be emulated in Product.
- Product returns semantic IDs, actions, severities and text keys, never Host callbacks or visual colors.
- Tests run from package directories, never from the repository root.
- Use `bun typecheck` in `packages/product` and `packages/tui`; use `bun run check-types` in `sdks/vscode`.
- Preserve raw third-party diagnostics alongside localized Product text keys.
- Do not normalize unrelated line endings or generated files.

---

### Task 1: Product-Owned Shared Command Catalog

**Files:**
- Modify: `packages/product/src/command.ts`
- Modify: `packages/product/src/text.ts`
- Modify: `packages/product/src/index.ts`
- Create: `packages/product/test/fixtures/command-contract.ts`
- Modify: `packages/product/test/command.test.ts`

**Interfaces:**
- Consumes: Host capability declarations and dynamic command facts.
- Produces: `ProductCommandID`, `ProductCommandCapability`, `ProductCommandEntry`, `deriveProductCommandCatalog(input)`, and `resolveProductCommand(input)`.

- [ ] **Step 1: Write failing Product catalog tests**

Add fixtures with the canonical IDs and slash aliases from the spec, plus dynamic `command`, `mcp`, and `skill` entries. Assert that built-ins are Product-owned, aliases resolve to the same semantic ID, built-ins win collisions, and unavailable/unsupported entries retain reason keys.

```ts
expect(deriveProductCommandCatalog({
  capabilities: commandCapabilities,
  dynamic: [{ id: "dynamic:mcp", name: "mcp", title: "Remote MCP", source: "mcp" }],
}).find((entry) => entry.id === "mcp.list")).toMatchObject({
  name: "mcps",
  aliases: ["mcp"],
  scope: "shared",
  availability: "available",
})

expect(resolveProductCommand({
  value: "/model",
  catalog,
})).toEqual({ kind: "builtin", commandID: "model.list", arguments: "" })
```

- [ ] **Step 2: Run the Product command test and verify RED**

Run from `packages/product`:

```powershell
bun test test/command.test.ts
```

Expected: FAIL because the canonical catalog and resolver do not exist.

- [ ] **Step 3: Implement the Product command contract**

Replace the pass-through-only input with a structured catalog input while retaining a narrowly named `deriveDynamicProductCommands` compatibility helper if existing dynamic consumers need it during migration.

```ts
export type ProductCommandID =
  | "session.new" | "session.list" | "agent.list" | "model.list"
  | "variant.list" | "provider.connect" | "mcp.list" | "system.status"
  | "session.compact" | "session.undo" | "session.redo" | "skill.list"
  | "theme.list" | "help.show"

export type ProductCommandAvailability = "available" | "unavailable" | "unsupported"
export type ProductCommandScope = "shared" | "shared_surface_optional" | "host_only"

export type ProductCommandCapability = {
  id: ProductCommandID
  availability: ProductCommandAvailability
  reasonKey?: ProductTextKey
}

export function deriveProductCommandCatalog(input: {
  capabilities: ProductCommandCapability[]
  dynamic?: ProductCommandInput[]
}): ProductCommandEntry[]

export function resolveProductCommand(input: {
  value: string
  catalog: ProductCommandEntry[]
}):
  | { kind: "builtin"; commandID: ProductCommandID; arguments: string }
  | { kind: "dynamic"; name: string; arguments: string; source?: string }
  | undefined
```

Add semantic command-unavailable and command-unsupported text keys. Keep definitions data-only and deterministic.

- [ ] **Step 4: Run Product tests and typecheck**

Run from `packages/product`:

```powershell
bun test test/command.test.ts
bun typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the Product command contract**

```powershell
git add packages/product/src/command.ts packages/product/src/text.ts packages/product/src/index.ts packages/product/test/command.test.ts packages/product/test/fixtures/command-contract.ts
git commit -m "feat(product): own shared command catalog"
```

### Task 2: TUI Command Adapter and Slash Routing

**Files:**
- Modify: `packages/tui/src/product/command-adapter.ts`
- Modify: `packages/tui/src/keymap.tsx`
- Modify: `packages/tui/src/component/command-palette.tsx`
- Modify: `packages/tui/src/app.tsx`
- Modify: `packages/tui/src/routes/session/index.tsx`
- Modify: `packages/tui/src/component/prompt/index.tsx`
- Modify: `packages/tui/test/product/command-adapter.test.ts`
- Create: `packages/tui/test/product/command-contract-parity.test.ts`

**Interfaces:**
- Consumes: Task 1 `deriveProductCommandCatalog`, command fixtures and semantic IDs.
- Produces: `toTuiProductCommands(entries, context)` and TUI dispatch bindings keyed by `ProductCommandID`.

- [ ] **Step 1: Write failing TUI parity and dispatch tests**

Use the shared fixture and assert the TUI adapter produces the canonical shared names and aliases. Assert `mcp.list`, `system.status`, model/theme aliases and contextual undo/redo availability map to existing TUI commands.

```ts
expect(toTuiProductCommands(entries, context).map((entry) => entry.id)).toEqual(
  expectedSharedCommandIDs,
)
expect(toTuiCommandTarget("mcp.list")).toEqual({ command: "mcp.list" })
```

- [ ] **Step 2: Run focused TUI tests and verify RED**

Run from `packages/tui`:

```powershell
bun test test/product/command-adapter.test.ts test/product/command-contract-parity.test.ts
```

Expected: FAIL because TUI still derives slash entries directly from `slashName` fields.

- [ ] **Step 3: Adapt TUI registrations to Product IDs**

Make `useCommandSlashes` pass reachable command capabilities through Product and attach the existing `keymap.dispatchCommand` handler after projection. Remove Product-owned slash names and aliases from shared TUI command registrations; keep Host-only slash declarations local.

```ts
return toTuiProductCommands(entries(), context()).flatMap((entry) => {
  const target = bindings.get(entry.id)
  if (!target || entry.availability !== "available") return []
  return [{
    display: `/${entry.name}`,
    aliases: entry.aliases.map((alias) => `/${alias}`),
    description: translateProductCommand(entry),
    onSelect: () => keymap.dispatchCommand(target),
  }]
})
```

Use Product output in the command palette for shared entries while merging explicitly classified Host-only commands.

- [ ] **Step 4: Run TUI command tests and typecheck**

Run from `packages/tui`:

```powershell
bun test test/product/command-adapter.test.ts test/product/command-contract-parity.test.ts
bun typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the TUI command migration**

```powershell
git add packages/tui/src/product/command-adapter.ts packages/tui/src/keymap.tsx packages/tui/src/component/command-palette.tsx packages/tui/src/app.tsx packages/tui/src/routes/session/index.tsx packages/tui/src/component/prompt/index.tsx packages/tui/test/product/command-adapter.test.ts packages/tui/test/product/command-contract-parity.test.ts
git commit -m "refactor(tui): consume product command catalog"
```

### Task 3: VSCode Command Adapter, Resolution, and Missing Shared Entrypoints

**Files:**
- Modify: `sdks/vscode/src/product/command-adapter.ts`
- Modify: `sdks/vscode/src/product/command-adapter.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/composer-menu.ts`
- Modify: `sdks/vscode/src/panel/webview/app/composer-menu.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/composer-actions.ts`
- Modify: `sdks/vscode/src/panel/webview/app/composer-actions.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/App.tsx`
- Create: `sdks/vscode/src/panel/webview/app/status-picker.tsx`
- Create: `sdks/vscode/src/panel/webview/app/status-picker.test.tsx`
- Modify: `sdks/vscode/src/i18n/zh.ts`
- Modify: `sdks/vscode/src/i18n/en.ts`
- Create: `sdks/vscode/src/test/parity/command-contract-parity.test.ts`

**Interfaces:**
- Consumes: Task 1 Product catalog/resolver and shared fixtures.
- Produces: canonical VSCode autocomplete items, semantic action resolution, and visible `/mcps`, `/status`, `/connect`, `/variants`, `/help` entrypoints.

- [ ] **Step 1: Write failing VSCode catalog and action tests**

Assert the built-in menu comes from Product and contains the canonical shared vocabulary. Assert aliases resolve to the same semantic command and dynamic MCP business commands remain distinct.

```ts
assert.deepEqual(sharedItems.map((item) => item.label), [
  "agents", "compact", "connect", "help", "mcps", "models", "new",
  "redo", "sessions", "skills", "status", "themes", "undo", "variants",
])
assert.deepEqual(resolveComposerSlashAction("/mcp", catalog), {
  type: "builtin",
  commandID: "mcp.list",
})
```

Add component assertions that the status picker renders MCP-only and combined status modes with localized accessible labels.

- [ ] **Step 2: Run focused VSCode tests and verify RED**

Run from `sdks/vscode`:

```powershell
bun test src/product/command-adapter.test.ts src/panel/webview/app/composer-menu.test.ts src/panel/webview/app/composer-actions.test.ts src/panel/webview/app/status-picker.test.tsx src/test/parity/command-contract-parity.test.ts
```

Expected: FAIL because local actions remain hardcoded and the status picker does not exist.

- [ ] **Step 3: Replace the hardcoded slash array with Product output**

Build capability inputs from current session context, map Product entries to `ComposerAutocompleteItem`, and use `resolveProductCommand` for both typed submission and autocomplete acceptance.

```ts
const catalog = toVsCodeProductCommands({
  context: commandContext(state),
  dynamic: state.snapshot.commands,
})

const resolved = resolveProductCommand({ value: draft, catalog })
```

Keep Host-only `refresh` and `reset-agent` entries in a separately named adapter collection with `scope: "host_only"`.

- [ ] **Step 4: Bind missing shared entrypoints**

Map semantic commands as follows:

```ts
const builtinTargets: Record<ProductCommandID, ComposerBuiltinTarget> = {
  "session.new": "newSession",
  "session.list": "openSessionPicker",
  "agent.list": "openAgentPicker",
  "model.list": "openModelPicker",
  "variant.list": "openModelPicker",
  "provider.connect": "openModelPicker",
  "mcp.list": "openMcpStatus",
  "system.status": "openSystemStatus",
  "session.compact": "compactSession",
  "session.undo": "undoSession",
  "session.redo": "redoSession",
  "skill.list": "openSkillPicker",
  "theme.list": "openThemePicker",
  "help.show": "openCommandHelp",
}
```

Implement `StatusPicker` using existing Product state arrays. MCP mode lists MCP entries and recovery actions; system mode lists MCP, HyperCode Runtime LSP and formatter summaries. Help mode reuses the Product command catalog instead of defining another list.

- [ ] **Step 5: Run VSCode command tests and check types**

Run from `sdks/vscode`:

```powershell
bun test src/product/command-adapter.test.ts src/panel/webview/app/composer-menu.test.ts src/panel/webview/app/composer-actions.test.ts src/panel/webview/app/status-picker.test.tsx src/test/parity/command-contract-parity.test.ts
bun run check-types
```

Expected: PASS.

- [ ] **Step 6: Commit the VSCode command migration**

Stage only Task 3 files and commit:

```powershell
git add sdks/vscode/src/product/command-adapter.ts sdks/vscode/src/product/command-adapter.test.ts sdks/vscode/src/panel/webview/app/composer-menu.ts sdks/vscode/src/panel/webview/app/composer-menu.test.ts sdks/vscode/src/panel/webview/app/composer-actions.ts sdks/vscode/src/panel/webview/app/composer-actions.test.ts sdks/vscode/src/panel/webview/app/App.tsx sdks/vscode/src/panel/webview/app/status-picker.tsx sdks/vscode/src/panel/webview/app/status-picker.test.tsx sdks/vscode/src/i18n/zh.ts sdks/vscode/src/i18n/en.ts sdks/vscode/src/test/parity/command-contract-parity.test.ts
git commit -m "feat(vscode): consume shared product commands"
```

### Task 4: Product Capability State and Aggregate Summaries

**Files:**
- Modify: `packages/product/src/mcp.ts`
- Modify: `packages/product/src/lsp.ts`
- Modify: `packages/product/src/formatter.ts`
- Modify: `packages/product/src/text.ts`
- Create: `packages/product/src/capability.ts`
- Modify: `packages/product/src/index.ts`
- Modify: `packages/product/test/fixtures/mcp-states.ts`
- Create: `packages/product/test/fixtures/capability-states.ts`
- Modify: `packages/product/test/mcp.test.ts`
- Modify: `packages/product/test/lsp.test.ts`
- Modify: `packages/product/test/formatter.test.ts`
- Create: `packages/product/test/capability.test.ts`

**Interfaces:**
- Consumes: resolved configuration state, runtime statuses, supported actions and pending operations.
- Produces: `ProductCapabilitySummary`, `deriveProductMcpSummary`, `deriveProductLspSummary`, and `deriveProductFormatterSummary`.

- [ ] **Step 1: Write the failing capability state matrix**

Cover unconfigured, disabled, enabled-idle, connected, authentication required, registration required, mixed connected/failed, all failed and unsupported inputs.

```ts
expect(deriveProductLspSummary({ configured: true, states: [] })).toMatchObject({
  availability: "idle",
  severity: "none",
  textKey: "status.lsp.idle",
})

expect(deriveProductMcpSummary(mixedMcpInput)).toMatchObject({
  availability: "degraded",
  severity: "warning",
  activeCount: 1,
  failedCount: 1,
})
```

- [ ] **Step 2: Run capability tests and verify RED**

Run from `packages/product`:

```powershell
bun test test/mcp.test.ts test/lsp.test.ts test/formatter.test.ts test/capability.test.ts
```

Expected: FAIL because configuration-aware and aggregate states do not exist.

- [ ] **Step 3: Implement shared summary types and subsystem derivation**

```ts
export type ProductCapabilityAvailability =
  | "unconfigured" | "disabled" | "idle" | "healthy"
  | "needs_attention" | "degraded" | "failed" | "unsupported"

export type ProductCapabilitySummary = {
  availability: ProductCapabilityAvailability
  severity: "none" | "warning" | "error"
  configuredCount: number
  activeCount: number
  failedCount: number
  textKey: ProductTextKey
}
```

Extend MCP input with configuration/pending facts. Extend LSP derivation with a separate resolved `configured` input while retaining only real runtime instances in `states`. Implement formatter aggregation from real formatter configuration/status facts.

- [ ] **Step 4: Run Product capability tests and typecheck**

Run from `packages/product`:

```powershell
bun test test/mcp.test.ts test/lsp.test.ts test/formatter.test.ts test/capability.test.ts
bun typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Product capability summaries**

```powershell
git add packages/product/src packages/product/test
git commit -m "feat(product): own capability status summaries"
```

### Task 5: Configuration-Aware Host Status Adapters and Rendering

**Files:**
- Modify: `packages/tui/src/product/mcp-adapter.ts`
- Modify: `packages/tui/src/product/lsp-adapter.ts`
- Modify: `packages/tui/src/product/formatter-adapter.ts`
- Modify: `packages/tui/src/context/sync.tsx`
- Modify: `packages/tui/src/component/dialog-mcp.tsx`
- Modify: `packages/tui/src/component/dialog-status.tsx`
- Modify: `packages/tui/src/routes/session/footer.tsx`
- Modify: `packages/tui/src/i18n/zh.ts`
- Modify: `packages/tui/src/i18n/en.ts`
- Modify: `packages/tui/test/product/mcp-adapter.test.ts`
- Modify: `packages/tui/test/product/lsp-adapter.test.ts`
- Create: `packages/tui/test/product/capability-summary-parity.test.ts`
- Modify: `sdks/vscode/src/product/mcp-adapter.ts`
- Modify: `sdks/vscode/src/product/lsp-adapter.ts`
- Modify: `sdks/vscode/src/product/formatter-adapter.ts`
- Modify: `sdks/vscode/src/panel/provider/snapshot.ts`
- Modify: `sdks/vscode/src/panel/webview/app/state.ts`
- Modify: `sdks/vscode/src/panel/webview/lib/session-meta.ts`
- Modify: `sdks/vscode/src/panel/webview/lib/session-meta.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/composer-footer.tsx`
- Modify: `sdks/vscode/src/i18n/zh.ts`
- Modify: `sdks/vscode/src/i18n/en.ts`
- Modify: `sdks/vscode/src/product/mcp-adapter.test.ts`
- Modify: `sdks/vscode/src/product/lsp-adapter.test.ts`
- Create: `sdks/vscode/src/product/capability-summary-parity.test.ts`

**Interfaces:**
- Consumes: Task 4 configuration-aware Product derivation and shared capability fixtures.
- Produces: Host snapshots containing Product individual states and Product summaries; renderers consume summaries only.

- [ ] **Step 1: Write failing shared-fixture adapter tests**

Feed equivalent config and runtime facts through both adapters. Assert enabled-with-empty LSP is idle, explicit false is disabled, and mixed MCP is degraded in both Hosts.

```ts
expect(toTuiProductLsp(input)).toEqual(expectedLspProjection)
assert.deepEqual(toVsCodeProductLsp(input), expectedLspProjection)
```

- [ ] **Step 2: Run focused Host status tests and verify RED**

Run from each package:

```powershell
cd D:\project\hypercode\packages\tui
bun test test/product/mcp-adapter.test.ts test/product/lsp-adapter.test.ts test/product/capability-summary-parity.test.ts

cd D:\project\hypercode\sdks\vscode
bun test src/product/mcp-adapter.test.ts src/product/lsp-adapter.test.ts src/product/capability-summary-parity.test.ts src/panel/webview/lib/session-meta.test.ts
```

Expected: FAIL because adapters ignore resolved configuration and Hosts own aggregation.

- [ ] **Step 3: Pass resolved configuration into both adapters**

TUI already stores `config`; derive summaries whenever config or raw status changes. VSCode extends `configInfo` to return `lsp` and `mcp` configuration facts and includes Product summaries in the snapshot.

```ts
const lspProjection = toProductLsp({
  configured: config.lsp !== false,
  statuses,
})
```

Do not infer configured MCP servers from runtime errors when the config fact is available.

- [ ] **Step 4: Remove Host aggregate decisions and render Product summaries**

Delete VSCode `overallProductMcpStatus`, `overallProductLspStatus` and `overallProductFormatterStatus` policy branches or reduce them to direct severity-to-tone rendering. Replace TUI footer counts and error priority with Product summary fields.

Fix `DialogMcp.Status` so `failed`, `needs_auth` and `needs_client_registration` never render as disabled. Surface action failures through existing toast/error state instead of console-only output.

- [ ] **Step 5: Add localized status keys and visible-copy tests**

Add Chinese and English text for unconfigured, disabled, idle, healthy, degraded, authentication-required, registration-required, failed and unsupported states. Assert user-visible Chinese for the failure and idle cases.

- [ ] **Step 6: Run focused tests and both Host typechecks**

```powershell
cd D:\project\hypercode\packages\tui
bun test test/product/mcp-adapter.test.ts test/product/lsp-adapter.test.ts test/product/capability-summary-parity.test.ts
bun typecheck

cd D:\project\hypercode\sdks\vscode
bun test src/product/mcp-adapter.test.ts src/product/lsp-adapter.test.ts src/product/capability-summary-parity.test.ts src/panel/webview/lib/session-meta.test.ts
bun run check-types
```

Expected: PASS.

- [ ] **Step 7: Commit the Host status migration**

Stage only Task 5 files and commit:

```powershell
git add packages/tui/src/product packages/tui/src/context/sync.tsx packages/tui/src/component/dialog-mcp.tsx packages/tui/src/component/dialog-status.tsx packages/tui/src/routes/session/footer.tsx packages/tui/src/i18n/zh.ts packages/tui/src/i18n/en.ts packages/tui/test/product sdks/vscode/src/product sdks/vscode/src/panel/provider/snapshot.ts sdks/vscode/src/panel/webview/app/state.ts sdks/vscode/src/panel/webview/lib/session-meta.ts sdks/vscode/src/panel/webview/lib/session-meta.test.ts sdks/vscode/src/panel/webview/app/composer-footer.tsx sdks/vscode/src/i18n/zh.ts sdks/vscode/src/i18n/en.ts
git commit -m "fix(product): align cross-host capability status"
```

### Task 6: Ownership Audit and Regression Gate

**Files:**
- Create: `packages/product/test/fixtures/cross-host-contract.ts`
- Create: `packages/tui/test/product/ownership-boundary.test.ts`
- Create: `sdks/vscode/src/product/ownership-boundary.test.ts`
- Modify: any Product or Host module proven by the audit to duplicate ordering, availability, fallback, status priority or recovery semantics.

**Interfaces:**
- Consumes: Tasks 1-5 Product contracts and adapters.
- Produces: shared cross-host equivalence fixtures and focused negative-boundary checks.

- [ ] **Step 1: Inventory all first-party Product consumers**

Classify every Product adapter/reducer as `facts-only`, `render-only`, `host-only`, `compatibility`, or `duplicate-owner`. Record the classification as fixture metadata so the test names identify the owning rule.

- [ ] **Step 2: Write failing negative ownership tests**

The tests scan only named first-party integration files and reject known duplicate patterns such as hardcoded shared slash arrays, Host aggregate status functions and local default recovery switches.

```ts
expect(forbiddenOwners).toEqual([])
```

The test message must identify the semantic rule and intended Product owner; it must not be a broad keyword ban.

- [ ] **Step 3: Run boundary tests and verify RED where duplicate owners remain**

```powershell
cd D:\project\hypercode\packages\tui
bun test test/product/ownership-boundary.test.ts

cd D:\project\hypercode\sdks\vscode
bun test src/product/ownership-boundary.test.ts
```

- [ ] **Step 4: Remove each proven duplicate owner**

For every failure, move the semantic decision to Product or classify it explicitly as Host-only/compatibility. Do not delete raw protocol normalization, persistence migration or plugin compatibility.

- [ ] **Step 5: Run all Product-related suites**

```powershell
cd D:\project\hypercode\packages\product
bun test
bun typecheck

cd D:\project\hypercode\packages\tui
bun test test/product
bun typecheck

cd D:\project\hypercode\sdks\vscode
bun test src/product src/panel/webview/lib/session-meta.test.ts src/panel/webview/app/composer-menu.test.ts src/panel/webview/app/composer-actions.test.ts
bun run check-types
```

Expected: PASS.

- [ ] **Step 6: Commit the ownership gate**

```powershell
git add packages/product/test/fixtures/cross-host-contract.ts packages/tui/test/product/ownership-boundary.test.ts sdks/vscode/src/product/ownership-boundary.test.ts
git commit -m "test(product): prevent cross-host behavior drift"
```

### Task 7: Durable Synchronization Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-product-alignment-maintenance-baseline.md`
- Modify: `docs/规范/上游同步工作流总纲.md`
- Modify: `docs/规范/上游同步与品牌化规范.md`
- Modify: `docs/操作手册/上游同步操作流程.md`
- Modify: `docs/操作手册/构建与交付规范.md`

**Interfaces:**
- Consumes: implemented contract, real test names and verification commands from Tasks 1-6.
- Produces: durable `Cross-Host Product Contract Review` gate and packaged-artifact smoke checklist.

- [ ] **Step 1: Correct the old closure claim**

Mark the command and capability-summary portions of the 2026-09-24 baseline as superseded by the new contract. Preserve historical verification counts as historical evidence; do not rewrite them as current results.

- [ ] **Step 2: Add the synchronization review gate**

Require the sync report to list affected semantic IDs, fact/meaning/support/presentation classification, both Host capability declarations, shared-fixture results, and any new Host-only or unsupported rationale.

Use these terminal outcomes:

```text
CROSS_HOST_CONTRACT_PRESERVED
CROSS_HOST_CONTRACT_ADAPTED
NEEDS_HUMAN_DECISION
```

- [ ] **Step 3: Add operational commands and stop conditions**

Document the exact focused commands created by this plan. State that regex/source audits are supporting evidence only, and that missing shared-fixture evidence or unexplained Host divergence blocks merge-back.

- [ ] **Step 4: Add packaged-artifact smoke checks**

The build guide must require opening both packaged surfaces and checking canonical shared slash names, MCP failed-versus-disabled copy, LSP enabled-idle copy, and mixed-status severity. Keep architecture policy in the Product/sync documents.

- [ ] **Step 5: Validate documentation hygiene and commit**

```powershell
git diff --check -- docs
rg -n "Cross-Host Product Contract|CROSS_HOST_CONTRACT" docs
git add docs/superpowers/specs/2026-09-24-product-alignment-maintenance-baseline.md docs/规范/上游同步工作流总纲.md docs/规范/上游同步与品牌化规范.md docs/操作手册/上游同步操作流程.md docs/操作手册/构建与交付规范.md
git commit -m "docs: enforce cross-host product review"
```

Expected: no whitespace errors; all durable and operational documents reference the gate.

### Task 8: Final Verification and VSIX Packaging

**Files:**
- Update only tests or code directly responsible for new failures.
- Regenerate: `sdks/vscode/dist/hypercode.vsix`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified source tree, current VSIX and recorded pass/fail evidence.

- [ ] **Step 1: Run Product verification**

```powershell
cd D:\project\hypercode\packages\product
bun test
bun typecheck
```

- [ ] **Step 2: Run TUI verification**

```powershell
cd D:\project\hypercode\packages\tui
bun test test/product
bun typecheck
```

- [ ] **Step 3: Run VSCode focused and full verification**

```powershell
cd D:\project\hypercode\sdks\vscode
bun test src/product src/panel/webview/app/composer-menu.test.ts src/panel/webview/app/composer-actions.test.ts src/panel/webview/app/status-picker.test.tsx src/panel/webview/lib/session-meta.test.ts
bun run check-types
bun run package
bun test
```

Compare full-suite failure identities with the maintained Windows-path, CSS-animation, autocomplete-fixture and malformed-timeline known-debt categories. Any new failure blocks completion.

- [ ] **Step 4: Build and hash the VSIX**

```powershell
cd D:\project\hypercode\sdks\vscode
npx --yes @vscode/vsce package --no-git-tag-version --no-update-package-json --no-dependencies --skip-license -o dist/hypercode.vsix
Get-FileHash -Algorithm SHA256 dist/hypercode.vsix
```

Expected: `dist/hypercode.vsix` exists, contains the current extension build and has a reported SHA-256.

- [ ] **Step 5: Run repository diff hygiene and report evidence**

```powershell
cd D:\project\hypercode
git diff --check
git status --short
```

Report exact focused test counts, typecheck/package results, full-suite known failures, VSIX path/hash, documentation gate changes and any retained compatibility risk. Do not claim completion if a required check did not run.
