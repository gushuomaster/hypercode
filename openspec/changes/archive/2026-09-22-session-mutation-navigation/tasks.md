# Session Mutation and Subagent Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commit the validated Phase 1 through Phase 2B product-alignment baseline, then make session mutation and subagent navigation canonical Product behavior shared by the TUI and VSCode hosts.

**Architecture:** Extend `ProductSessionState` with minimal mutable session projections and mutation lifecycle state, and add a pure relationship graph projection for subagent navigation. TUI and VSCode store and render the returned Product state while adapters execute existing SDK, Memento, clipboard, command, and navigation facilities.

**Tech Stack:** TypeScript, Bun tests, Solid/OpenTUI, React/VSCode webview, VS Code extension host, esbuild.

**Spec:** `docs/superpowers/specs/2026-09-22-session-mutation-navigation-design.md`

## Global Constraints

- Do not modify Protocol or Server `HttpApi`.
- Do not edit or regenerate generated clients.
- Do not enter Phase 3 provider, MCP, LSP, formatter, theme, language, help, or command-palette work.
- Do not reset, stash, clean, rebase, push, or discard existing worktree changes.
- Do not normalize line endings or perform unrelated formatting.
- Keep `packages/product` free of React, Solid, OpenTUI, VS Code API, DOM runtime, and host-specific Node runtime dependencies.
- Keep complete Core sessions, messages, parts, permission payloads, question payloads, retry details, and protocol payloads outside Product.
- Use confirmation-after-host mutation semantics; do not implement optimistic canonical updates.
- TUI archive and tags remain explicitly unsupported unless an existing real capability is found.
- Compare final results with the Part A baseline and distinguish known baseline failures from new regressions.

---

### Task 1: Close and Commit the Existing Product Alignment Baseline

**Files:**
- Audit: all current tracked and untracked changes
- Commit: `packages/product/**`, `bun.lock`, `packages/tui/package.json`
- Commit: existing TUI Product adapters, integrations, translations, and tests
- Commit: existing VSCode Product adapters, integrations, translations, build configuration, and tests
- Commit: `docs/superpowers/plans/2026-09-22-session-product-ownership.md`

**Interfaces:**
- Consumes: existing Phase 1, Phase 2A, and Phase 2B dirty worktree
- Produces: clean dependency-safe commits and `HYPERCODE_PRODUCT_ALIGNMENT_BASELINE`

- [x] **Step 1: Run the negative ownership audit**

Search the current diff for model sorting/grouping/deduplication, free-model selection, fallback order, composer fallback, variant fallback, pending-interaction priority, session list projection, switch validation, retry/abort/error semantics, and host copies of Product rules. Classify each match as `SHARED_SINGLE_SOURCE`, `HOST_SPECIFIC_VALID`, `TRANSITIONAL_LEGACY`, or `DUPLICATE_BUG`.

Run from the repository root:

```bash
git status --short --branch -uall
git diff --stat
git diff --check
rg -n "sort|group|dedup|free|fallback|recent|default|provider|variant|permission|question|retry|abort|session.*switch|switch.*session" packages/product packages/tui/src sdks/vscode/src
```

Expected: no Protocol, `HttpApi`, generated client, unrelated dependency upgrade, Phase 3, or unexplained user change appears in the diff; any `DUPLICATE_BUG` is fixed before staging.

- [x] **Step 2: Verify Product boundaries**

```bash
rg -n "from [\"'](react|solid-js|@opentui|vscode)|document\.|window\.|HTMLElement|Node\." packages/product
git diff --name-only | rg "generated|protocol|http-api|HttpApi"
```

Expected: both commands return no prohibited Product dependency or restricted-path change.

- [x] **Step 3: Run the fresh pre-commit baseline validation**

```bash
cd packages/product && bun test && bun typecheck
cd ../tui && bun test test/product test/cli/cmd/tui/model-options.test.ts && bun typecheck
cd ../../sdks/vscode && bun test src/panel/provider/actions.test.ts src/panel/provider/controller.test.ts src/panel/shared/session-reducer.test.ts src/panel/webview/app/composer-footer.test.tsx src/panel/webview/app/composer-running-state.test.ts src/panel/webview/app/model-picker.test.ts src/panel/webview/app/session-picker.test.tsx src/panel/webview/app/state.test.ts src/panel/webview/hooks/useHostMessages.test.ts src/panel/webview/lib/product-action-adapter.test.ts src/panel/webview/lib/product-adapter.test.ts src/panel/webview/lib/product-session-adapter.test.ts src/panel/webview/lib/product-text-adapter.test.ts src/panel/webview/lib/session-meta.test.ts
bun run check-types
bun run package
cd ../.. && git diff --check
```

Expected: Product remains at least `32 pass / 0 fail`, TUI related remains at least `29 pass / 0 fail`, VSCode related remains at least `139 pass / 0 fail`, typechecks and package exit zero.

- [x] **Step 4: Stage and verify the Product foundation commit**

Stage all `packages/product/**`, `bun.lock`, and the TUI workspace dependency in `packages/tui/package.json`. Inspect `git diff --cached --name-only`, `git diff --cached --stat`, and `git diff --cached --check`. If a Product file contains inseparable Phase 2A/2B session ownership, keep it in this commit because Product must remain internally complete.

- [x] **Step 5: Commit the Product foundation**

```bash
git commit -m "feat(product): add shared product behavior contract"
```

- [x] **Step 6: Stage, verify, and commit TUI integration**

Stage only existing TUI production and test changes, excluding `packages/tui/package.json` already committed. Run the focused TUI suite and `bun typecheck` against the staged tree, then commit:

```bash
git commit -m "refactor(tui): consume shared product behavior"
```

- [x] **Step 7: Stage, verify, and commit VSCode integration**

Stage only existing `sdks/vscode/**` changes. Run the related VSCode suite, `bun run check-types`, and `bun run package`, then commit:

```bash
git commit -m "refactor(vscode): consume shared product behavior"
```

- [x] **Step 8: Commit remaining implementation documentation**

Stage the existing Phase 2A/2B plan and this implementation plan if dependency-safe commits left them untracked. Verify staged paths contain documentation only, then commit:

```bash
git commit -m "docs: record product alignment implementation"
```

- [x] **Step 9: Record the Part A baseline**

Capture `git rev-parse HEAD`, test counts, VSCode full-suite results, package result, typecheck results, and restricted-path checks in the execution notes. Run the full VSCode test suite and classify the known Windows path, CSS/theme animation, autocomplete fixture, and timeline encoding failures separately from new regressions.

---

### Task 2: Add the Product Session Mutation State Machine

**Files:**
- Create: `packages/product/src/session-mutation.ts`
- Create: `packages/product/test/session-mutation.test.ts`
- Create: `packages/product/test/fixtures/session-mutations.ts`
- Modify: `packages/product/src/action.ts`
- Modify: `packages/product/src/session.ts`
- Modify: `packages/product/src/text.ts`
- Modify: `packages/product/src/index.ts`

**Interfaces:**
- Consumes: `ProductAction`, `ProductError`, `ProductSessionState`
- Produces:
  - `ProductSessionMutationKind`
  - `ProductMutableSession`
  - `ProductSessionMutationCapabilities`
  - `ProductSessionMutationStatus`
  - `hydrateProductMutableSessions(state, sessions)`
  - `deriveProductSessionMutationAvailability(state, action)`
  - `beginProductSessionMutation(state, action)`
  - `completeProductSessionMutation(state, result)`
  - `failProductSessionMutation(state, failure)`

- [ ] **Step 1: Write failing Product action and lifecycle tests**

Add actions with these exact shapes:

```ts
type ProductSessionMutationAction =
  | { type: "session.rename"; sessionID: string; title: string }
  | { type: "session.archive"; sessionID: string }
  | { type: "session.share"; sessionID: string }
  | { type: "session.unshare"; sessionID: string }
  | { type: "session.tag.add"; sessionID: string; tag: string }
  | { type: "session.tag.remove"; sessionID: string; tag: string }
```

Test rename success/failure, archive success/unavailable/repeated, share success/failure/unshare, tag add/duplicate/remove/missing, unsupported capability, pending duplicate prevention, canonical preservation during pending/failure, and raw diagnostic retention.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd packages/product && bun test test/session-mutation.test.ts
```

Expected: fail because the mutation module and actions do not exist.

- [ ] **Step 3: Implement minimal canonical types and hydration**

Use this minimal Product-owned projection:

```ts
type ProductMutableSession = {
  id: string
  title: string
  archivedAt?: number
  shareURL?: string
  tags: string[]
  available: boolean
  capabilities: ProductSessionMutationCapabilities
}

type ProductSessionMutationStatus =
  | { state: "idle" }
  | { state: "pending"; action: ProductSessionMutationAction }
  | { state: "success"; action: ProductSessionMutationAction }
  | { state: "error"; action: ProductSessionMutationAction; error: ProductError }
```

Extend `ProductSessionState` with `sessions` and `mutations`, preserving existing snapshot and switch behavior. Hydration normalizes titles and tags and never stores raw Core session objects.

- [ ] **Step 4: Implement availability and mutation reduction**

Availability returns `{ available: true }` or `{ available: false, reason }`. Begin changes only lifecycle state. Complete applies one confirmed result to canonical fields. Failure changes only lifecycle state and error, leaving the canonical session object equal to its pre-request value.

- [ ] **Step 5: Add shared mutation error text keys**

Extend `ProductTextKey` with keys for `not_found`, `unsupported`, `unavailable`, `already_archived`, `already_shared`, `invalid_title`, `permission_denied`, and `request_failed`. Add a pure classifier that retains `raw` and does not invent Server error types.

- [ ] **Step 6: Run Product GREEN validation**

```bash
cd packages/product && bun test test/session-mutation.test.ts && bun test && bun typecheck
```

Expected: focused and full Product suites pass, typecheck exits zero.

---

### Task 3: Integrate Session Mutations into TUI

**Files:**
- Create: `packages/tui/src/product/session-mutation-adapter.ts`
- Create: `packages/tui/test/product/session-mutation-adapter.test.ts`
- Modify: `packages/tui/src/context/sync.tsx`
- Modify: `packages/tui/src/component/dialog-session-rename.tsx`
- Modify: `packages/tui/src/routes/session/index.tsx`
- Modify: `packages/tui/src/product/action-adapter.ts`
- Modify: `packages/tui/src/i18n/en.ts`
- Modify: `packages/tui/src/i18n/zh.ts`

**Interfaces:**
- Consumes: Product mutation actions, availability, begin/complete/fail reducers
- Produces: `toTuiSessionMutationTarget(action, session)` and TUI mutation execution results

- [ ] **Step 1: Write failing TUI adapter parity tests**

Use the shared Product fixtures to verify rename/share/unshare targets, normalized success/failure events, and explicit `{ kind: "unsupported" }` results for archive and tags. Verify unsupported paths do not call an SDK function.

- [ ] **Step 2: Run TUI mutation tests and verify RED**

```bash
cd packages/tui && bun test test/product/session-mutation-adapter.test.ts
```

- [ ] **Step 3: Implement the TUI mutation adapter**

Map only execution details:

```ts
type TuiSessionMutationTarget =
  | { kind: "session.update"; input: { sessionID: string; title?: string } }
  | { kind: "session.share"; input: { sessionID: string } }
  | { kind: "session.unshare"; input: { sessionID: string } }
  | { kind: "unsupported"; action: "session.archive" | "session.tag.add" | "session.tag.remove" }
  | { kind: "unavailable"; reason: ProductSessionMutationUnavailableReason }
```

The adapter must call Product availability rather than rechecking title/share/tag rules.

- [ ] **Step 4: Store Product mutation state in `SyncProvider`**

Add one Product session state value and narrow update functions to the sync context. Hydrate minimal mutable fields from `store.session`; preserve the existing per-session execution snapshots in `store.product`. Do not place SDK response objects in Product state.

- [ ] **Step 5: Route rename, share, and unshare through Product**

Replace direct mutation calls in `DialogSessionRename` and the session command list with begin → host call → complete/fail. Pending disables the same Product action. Success uses the confirmed title or share URL; failure uses the shared semantic error and raw diagnostic for the TUI toast.

- [ ] **Step 6: Run TUI GREEN validation**

```bash
cd packages/tui && bun test test/product test/cli/cmd/tui/model-options.test.ts && bun typecheck
```

Expected: all related tests and typecheck pass.

---

### Task 4: Integrate Session Mutations into VSCode

**Files:**
- Create: `sdks/vscode/src/product/session-mutation.ts`
- Create: `sdks/vscode/src/panel/webview/lib/product-session-mutation-adapter.ts`
- Create: `sdks/vscode/src/panel/webview/lib/product-session-mutation-adapter.test.ts`
- Modify: `sdks/vscode/src/core/commands.ts`
- Modify: `sdks/vscode/src/core/session-tags.ts`
- Modify: `sdks/vscode/src/bridge/types.ts`
- Modify: `sdks/vscode/src/panel/provider/controller.ts`
- Modify: `sdks/vscode/src/panel/provider/controller.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/state.ts`
- Modify: `sdks/vscode/src/panel/webview/hooks/useHostMessages.ts`
- Modify: `sdks/vscode/src/panel/webview/hooks/useHostMessages.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/session-picker.tsx`
- Modify: `sdks/vscode/src/test/commands.test.ts`
- Modify: `sdks/vscode/src/test/session-capability-commands.test.ts`

**Interfaces:**
- Consumes: Product mutation state machine and shared fixtures
- Produces: Product-normalized VSCode execution targets and `sessionMutation` HostMessages carrying begin/success/failure results

- [ ] **Step 1: Write failing VSCode parity and bridge tests**

Verify the same supported actions and normalized host results produce the same Product state as TUI. Verify tags persist through `SessionTagStore`, duplicate/missing tags are rejected by Product, and provider/controller messages carry Product mutation results without Protocol changes.

- [ ] **Step 2: Run focused VSCode tests and verify RED**

```bash
cd sdks/vscode && bun test src/panel/webview/lib/product-session-mutation-adapter.test.ts src/test/commands.test.ts src/test/session-capability-commands.test.ts src/panel/provider/controller.test.ts src/panel/webview/hooks/useHostMessages.test.ts
```

- [ ] **Step 3: Implement the VSCode adapter and bridge event**

Map SDK `session.update/share/unshare`, `SessionTagStore.setTags`, clipboard, refresh, and notifications to Product begin/success/failure. Add only extension-internal bridge types; do not modify Protocol or generated clients.

- [ ] **Step 4: Replace command-local mutation rules**

Keep prompts and confirmation dialogs in VSCode, but use Product for normalized title/tag validation, capability availability, repeated-action handling, pending state, canonical success, and error classification. `parseSessionTagsInput` may remain as host input parsing only if final normalization is performed by Product.

- [ ] **Step 5: Store and render Product mutation state**

Extend `AppState.productSessions` hydration and `dispatchHostMessage` to reduce mutation lifecycle events. Session picker action availability and pending indicators consume Product state; they do not recreate shared conditions.

- [ ] **Step 6: Run VSCode GREEN validation**

```bash
cd sdks/vscode && bun test src/panel/webview/lib/product-session-mutation-adapter.test.ts src/test/commands.test.ts src/test/session-capability-commands.test.ts src/panel/provider/controller.test.ts src/panel/webview/hooks/useHostMessages.test.ts
bun run check-types
bun run package
```

Expected: focused tests, typecheck, and package pass.

- [ ] **Step 7: Commit Phase 2C**

Stage Product, TUI, and VSCode mutation files only. Verify staged diff and focused suites, then commit:

```bash
git commit -m "feat(product): unify session mutation behavior"
```

---

### Task 5: Add Product Subagent Navigation Projection

**Files:**
- Create: `packages/product/src/session-navigation.ts`
- Create: `packages/product/test/session-navigation.test.ts`
- Create: `packages/product/test/fixtures/session-navigation.ts`
- Modify: `packages/product/src/action.ts`
- Modify: `packages/product/src/index.ts`

**Interfaces:**
- Consumes: minimal session relationship inputs
- Produces:
  - `ProductSessionNavigationInput`
  - `ProductSessionNavigation`
  - `deriveProductSessionNavigation(input)`
  - `resolveProductSessionNavigation(projection, action)`

- [ ] **Step 1: Write failing navigation tests**

Cover no child, single child, multiple children, active-child preference, deterministic first-child fallback, parent, previous/next sibling wrapping, explicit child selection, missing child, removed child, archived child, unavailable child, current child, A → child → parent, and A → child1 → parent → child2.

- [ ] **Step 2: Run focused Product navigation test and verify RED**

```bash
cd packages/product && bun test test/session-navigation.test.ts
```

- [ ] **Step 3: Implement the minimal relationship projection**

Use this input boundary:

```ts
type ProductSessionNavigationNode = {
  id: string
  parentID?: string
  title?: string
  archivedAt?: number
  available?: boolean
  order?: number
}
```

Sort valid nodes by `order`, then ID. Prefer a valid active-child candidate; otherwise choose the first valid direct child. Return explicit availability reasons for missing current, parent, child, sibling, removed, archived, and unavailable targets.

- [ ] **Step 4: Add shared navigation actions and resolver**

Use actions that make the target decision Product-owned:

```ts
type ProductSubagentAction =
  | { type: "subagent.open"; sessionID: string }
  | { type: "subagent.back"; sessionID: string }
  | { type: "subagent.sibling"; sessionID: string; direction: "previous" | "next" }
  | { type: "subagent.select"; sessionID: string; targetSessionID: string }
```

The resolver returns `{ available: true, sessionID }` or `{ available: false, reason }`; hosts must not add fallback.

 - [x] **Step 5: Run Product GREEN validation**

```bash
cd packages/product && bun test test/session-navigation.test.ts && bun test && bun typecheck
```

---

### Task 6: Replace TUI and VSCode Navigation Rules

**Files:**
- Create: `packages/tui/src/product/session-navigation-adapter.ts`
- Create: `packages/tui/test/product/session-navigation-adapter.test.ts`
- Modify: `packages/tui/src/routes/session/index.tsx`
- Create: `sdks/vscode/src/panel/webview/lib/product-session-navigation-adapter.ts`
- Create: `sdks/vscode/src/panel/webview/lib/product-session-navigation-adapter.test.ts`
- Modify: `sdks/vscode/src/panel/provider/navigation.ts`
- Modify: `sdks/vscode/src/panel/provider/navigation.test.ts`
- Modify: `sdks/vscode/src/panel/provider/snapshot.ts`
- Modify: `sdks/vscode/src/panel/webview/app/session-navigation.ts`
- Modify: `sdks/vscode/src/panel/webview/app/session-navigation.test.ts`
- Modify: `sdks/vscode/src/panel/webview/app/App.tsx`

**Interfaces:**
- Consumes: Product navigation projection and resolver
- Produces: identical Product targets for equivalent TUI and VSCode relationship graphs

- [x] **Step 1: Write failing cross-host navigation parity tests**

Use the shared Product navigation fixture in both adapter suites. Assert equivalent graphs produce the same default child, parent, previous, next, explicit selection, and unavailable reason.

- [x] **Step 2: Run both adapter tests and verify RED**

```bash
cd packages/tui && bun test test/product/session-navigation-adapter.test.ts
cd ../../sdks/vscode && bun test src/panel/webview/lib/product-session-navigation-adapter.test.ts src/panel/provider/navigation.test.ts src/panel/webview/app/session-navigation.test.ts
```

- [x] **Step 3: Replace TUI local navigation rules**

Remove `moveFirstChild` and `moveChild` target selection. Build the minimal graph from current sync sessions, ask Product to resolve each command, and call existing TUI navigation only for an available Product result. Preserve keybindings, dialog guards, retry alerts, and OpenTUI presentation.

- [x] **Step 4: Replace VSCode provider and webview fallback**

Make provider navigation metadata a Product projection. Replace `activeChildSessionId` and direct `navigation.prev/parent/next` fallback with shared actions and exact Product targets. Preserve `navigateSession` bridge execution, tree expansion, breadcrumbs, mouse behavior, and keyboard bindings.

- [x] **Step 5: Run host GREEN validation**

```bash
cd packages/tui && bun test test/product && bun typecheck
cd ../../sdks/vscode && bun test src/panel/webview/lib/product-session-navigation-adapter.test.ts src/panel/provider/navigation.test.ts src/panel/webview/app/session-navigation.test.ts src/panel/webview/app/state.test.ts src/panel/webview/hooks/useHostMessages.test.ts
bun run check-types
bun run package
```

- [x] **Step 6: Commit Phase 2D**

Stage Product, TUI, and VSCode navigation files only. Verify the staged diff and focused suites, then commit:

```bash
git commit -m "feat(product): unify subagent navigation behavior"
```

---

### Task 7: Final Ownership Audit and Regression Validation

**Files:**
- Modify only files required to fix regressions introduced by Tasks 2 through 6

**Interfaces:**
- Consumes: Part A baseline and committed Phase 2C/2D implementation
- Produces: final test comparison and clean scoped worktree status

- [ ] **Step 1: Repeat the negative duplicate audit**

Search for local mutation availability, title/tag normalization, pending/recovery rules, active-child selection, sibling wraparound, and missing-target fallback. Classify remaining matches and remove only `DUPLICATE_BUG` instances.

- [ ] **Step 2: Run full Product validation**

```bash
cd packages/product && bun test && bun typecheck
```

- [ ] **Step 3: Run related TUI validation**

```bash
cd packages/tui && bun test test/product test/cli/cmd/tui/model-options.test.ts && bun typecheck
```

- [ ] **Step 4: Run related VSCode validation and package**

```bash
cd sdks/vscode && bun test src/panel/provider src/panel/shared/session-reducer.test.ts src/panel/webview/app src/panel/webview/hooks src/panel/webview/lib src/test/commands.test.ts src/test/session-capability-commands.test.ts
bun run check-types
bun run package
```

- [ ] **Step 5: Run the VSCode full suite and compare baseline**

```bash
cd sdks/vscode && bun test
```

Record pass, known fail, known error, and new regression counts. Stop and report `PARTIAL` if a new regression cannot be fixed within Phase 2C/2D scope.

- [ ] **Step 6: Verify restricted paths and diff integrity**

```bash
cd ../..
git diff --check
git status --short --branch -uall
git diff HEAD~2 --name-only | rg "generated|protocol|http-api|HttpApi"
```

Expected: `git diff --check` exits zero and restricted-path search returns no matches.

- [ ] **Step 7: Produce the final report**

Report audit classifications, commits and hashes, Part A baseline, Phase 2C/2D design and actions, capability behavior, lifecycle/error semantics, cross-host parity, removed duplicate logic, transitional raw fields, validation counts, baseline comparison, restricted-path result, files changed, remaining Phase 3 debt, and final Git status.

## Execution Record

- Part A baseline: `3b4ea32677c6b73ea32b7183ecd499441ab4a976`
- Phase 2C: `335b34ff6` (`feat(product): unify session mutation behavior`)
- Phase 2D: `66f152525` (`feat(product): unify subagent navigation behavior`) plus `nav` projection follow-up in `navigation.ts`.
- Product final focused suite: 41 pass; typecheck pass.
- TUI final related suite: 26 pass; typecheck pass.
- VSCode final related suite: 60 pass; `check-types` pass; VSIX package pass.
- VSCode full suite: 578 pass / 16 known fail / 1 known error; baseline was 568 / 16 / 1, so new regression count is 0.
- No Protocol, HttpApi, generated client, or Phase 3 files changed.
