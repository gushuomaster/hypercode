# Phase 3B-1 MCP Product Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 MCP 的状态、可用性、严重级别、恢复动作和错误语义统一投影到 `packages/product`，并由 TUI/VSCode adapter 消费同一份 Product 状态。

**Architecture:** Core/SDK 继续拥有 MCP runtime、连接和认证；Product 只拥有纯数据 projection 与 host-neutral action；TUI 与 VSCode 负责把 Product action 映射为各自现有的 connect/disconnect/reconnect/authenticate 宿主调用。原始 MCP status/error 保留在 Product diagnostic 中，避免丢失第三方诊断。

**Tech Stack:** TypeScript、Bun test、Solid TUI、React VSCode webview。

**Spec:** 用户提供的 Phase 3B — MCP / LSP / Formatter Product Alignment 续作说明。

## Global Constraints

- 不修改 Protocol、Server HttpApi 或 generated client。
- 不把 MCP runtime、SDK、credential、连接对象搬入 `packages/product`。
- 不进入 LSP、Formatter、Theme、Language、Help 或 Command capability。
- 保持现有 MCP host action/event 格式和中文翻译加载器。
- 不做无关格式化、line-ending normalization、reset、stash、drop 或 push。
- Product canonical state 不得被 legacy/deferred host state 反向覆盖。

### Task 1: Product MCP contract

**Files:**
- Create: `packages/product/src/mcp.ts`
- Modify: `packages/product/src/action.ts`, `packages/product/src/text.ts`, `packages/product/src/index.ts`
- Test: `packages/product/test/mcp.test.ts`, `packages/product/test/fixtures/mcp-states.ts`

**Interfaces:**
- `deriveProductMcpState(input): ProductMcpState`
- `deriveProductMcpStates(inputs): ProductMcpState[]`
- `deriveProductMcpAction(state): ProductAction | undefined`

- [x] Write failing tests for status projection, severity, action, deterministic ordering, raw diagnostics, and unsupported host capability.
- [x] Run `bun test test/mcp.test.ts` and confirm the new API fails.
- [x] Implement the pure Product MCP types and projection.
- [x] Run Product MCP tests and `bun typecheck`.

### Task 2: TUI MCP adapter

**Files:**
- Create: `packages/tui/src/product/mcp-adapter.ts`, `packages/tui/test/product/mcp-adapter.test.ts`
- Modify: `packages/tui/src/context/sync.tsx`, `packages/tui/src/component/dialog-mcp.tsx`, `packages/tui/src/context/local.tsx`

**Interfaces:**
- `toProductMcpStates(statuses): ProductMcpState[]`
- `toTuiProductAction(action): TuiProductAction`

- [x] Add failing adapter parity tests using the shared MCP fixture.
- [x] Run the focused TUI tests and confirm failure.
- [x] Add the `mcp_product` sync projection and consume it in the MCP dialog without changing SDK calls.
- [x] Map Product actions to existing TUI MCP operations and run focused tests/typecheck.

### Task 3: VSCode MCP adapter

**Files:**
- Create: `sdks/vscode/src/product/mcp-adapter.ts`, `sdks/vscode/src/product/mcp-adapter.test.ts`
- Modify: `sdks/vscode/src/panel/provider/snapshot.ts`, `sdks/vscode/src/panel/webview/app/state.ts`, `sdks/vscode/src/panel/webview/lib/session-meta.ts`, `sdks/vscode/src/panel/webview/app/App.tsx`, `sdks/vscode/src/panel/webview/lib/product-action-adapter.ts`

**Interfaces:**
- `toProductMcpStates(statuses): ProductMcpState[]`
- `toVsCodeProductAction(action): VsCodeProductActionTarget`

- [x] Add failing adapter and session-meta tests for equivalent TUI/VSCode projections.
- [x] Run focused VSCode tests and confirm failure.
- [x] Add `mcpStates` to the snapshot projection and replace local severity/action derivation with Product state.
- [x] Map Product MCP actions to existing `mcpAction` host messages and run focused tests/typecheck/package.

### Task 4: Parity verification

- [x] Run Product full tests and typecheck.
- [x] Run TUI MCP/product tests and typecheck.
- [x] Run VSCode MCP/webview tests, check-types, and package.
- [x] Run `git diff --check`, inspect scope, and report known baseline failures without repairing unrelated tests.
- [x] Commit the verified MCP phase with a conventional commit message.
