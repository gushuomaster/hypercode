# Session Product Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move shared session list and switch behavior into `packages/product` while preserving host-specific TUI and VSCode rendering.

**Architecture:** `packages/product/src/session.ts` owns session summaries, ordering, selection fallback, switch validation, and per-session canonical snapshot retention. TUI and VSCode adapters normalize host session records; renderers consume the shared projection and dispatch shared `ProductAction` intents.

**Tech Stack:** TypeScript, Bun tests, Solid/OpenTUI adapters, React/VSCode adapters.

**Spec:** `C:/Users/28320/.codex/attachments/65cca6b2-1f89-47ae-977a-738c1ce1c014/pasted-text.txt`

## Global Constraints

- Preserve the dirty worktree and do not commit or push.
- Do not modify Protocol, HttpApi, generated clients, or Phase 3 features.
- Keep `packages/product` free of UI, DOM, VS Code, and Node host dependencies.
- Preserve Core retry as unavailable.
- Avoid line-ending normalization and unrelated formatting.

### Task 1: Shared Session Product Model

**Files:**
- Create: `packages/product/src/session.ts`
- Modify: `packages/product/src/action.ts`
- Modify: `packages/product/src/snapshot.ts`
- Modify: `packages/product/src/index.ts`
- Test: `packages/product/test/session.test.ts`
- Test: `packages/product/test/fixtures/session-list.ts`

- [x] Write failing tests for list ordering, deduplication, fallback, filtering, lifecycle state, switch validation, partial hydration, and A → B → A snapshot isolation.
- [x] Run `bun test test/session.test.ts` from `packages/product` and verify the tests fail for missing APIs.
- [x] Implement the minimal shared session projection, snapshot store, partial hydration, and `ProductAction` session intents.
- [x] Run the focused tests and full Product tests/typecheck.

### Task 2: TUI Session Adapter and Production Use

**Files:**
- Create: `packages/tui/src/product/session-list-adapter.ts`
- Create: `packages/tui/test/product/session-list-adapter.test.ts`
- Modify: `packages/tui/src/component/dialog-session-list.tsx`
- Modify: `packages/tui/src/context/local.tsx`
- Modify: `packages/tui/src/app.tsx`
- Modify: `packages/tui/src/product/action-adapter.ts`

- [x] Write failing adapter/action parity tests using the shared session fixture.
- [x] Map TUI raw sessions/statuses into the shared session input.
- [x] Replace TUI recency, search, title fallback, status, and switch intent branches with shared Product calls.
- [x] Run TUI session/product tests and `bun typecheck`.

### Task 3: VSCode Session Adapter and Switch Isolation

**Files:**
- Modify: `sdks/vscode/src/product/session.ts`
- Modify: `sdks/vscode/src/panel/webview/lib/product-session-adapter.ts`
- Modify: `sdks/vscode/src/panel/webview/lib/product-session-adapter.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/session-picker.tsx`
- Modify: `sdks/vscode/src/panel/webview/app/session-picker.test.tsx`
- Modify: `sdks/vscode/src/panel/webview/app/state.ts`
- Modify: `sdks/vscode/src/panel/webview/hooks/useHostMessages.ts`
- Modify: `sdks/vscode/src/panel/webview/hooks/useHostMessages.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/App.tsx`
- Modify: `sdks/vscode/src/panel/webview/lib/product-action-adapter.ts`

- [x] Write failing parity, ProductAction, bootstrap/snapshot isolation, and A → B → A restoration tests.
- [x] Replace picker projection with shared session semantics.
- [x] Store canonical snapshots per session and treat snapshot payloads without `product` as partial hydration.
- [x] Route switch actions through `ProductAction` and keep the existing VS Code command adapter.
- [x] Run VSCode session/product tests, check-types, and package.

### Task 4: Closure and Validation

**Files:**
- Modify only files required by validation failures caused by Tasks 1–3.

- [x] Verify Phase 1 duplicate-rule ownership and Product dependency boundaries.
- [x] Run Product, TUI, VSCode related suites, package, and `git diff --check`.
- [x] Run the VSCode full suite and compare failures with the 563/16/1 baseline.
- [x] Report ownership matrix, transitional fields, commit split, remaining Phase 2C/2D debt, and Git status.
