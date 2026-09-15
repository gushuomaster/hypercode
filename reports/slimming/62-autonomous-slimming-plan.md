# HyperCode Autonomous Slimming Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for production changes and `superpowers:verification-before-completion` before final claims.

**Goal:** 在不改变 HyperCode 产品能力和 API schema 的前提下，处理当前唯一已证实的高收益低/中风险候选，并在收益递减点结束 slimming。

**Architecture:** 保留 OpenCode 各 HttpApi group 的 upstream 原始描述，在已经承担 legacy OpenAPI normalization 的 `public.ts` 边界统一完成 HyperCode 品牌转换。这样新增 upstream route 不需要在多个 group 文件重复打品牌补丁。

**Tech Stack:** TypeScript、Effect HttpApi/OpenApi、Bun test、Git diff metrics。

**Spec:** Autonomous Mission attachment and existing `reports/slimming/*` knowledge base.

## Global Constraints

- OpenCode baseline: `193de13a88d62a6409c6d385831180f1def527dc`.
- Preserve HyperCode branding, Chinese localization, config compatibility, offline delivery, auth/provider behavior, Session/TUI/VS Code product capability.
- Do not change schema, route identifiers, lifecycle, protocol, dependency topology, manifests, or `bun.lock`.
- One candidate, one validation boundary, one independent commit.

---

### Task 1: Recompute Current Fork Surface

**Files:** read-only Git/report evidence.

- [x] Confirm HEAD, dirty files, upstream baseline, and current `55` Core patch paths.
- [x] Review existing candidate, duplication, guardrail, and final Phase 5A/5B reports.
- [x] Reject C-007 and C-012 as current implementation candidates based on no-net-benefit / low-priority environment evidence.

### Task 2: Characterize OpenAPI Branding Boundary

**Files:**
- Create: `packages/opencode/test/server/httpapi-branding.test.ts`
- Modify: `packages/opencode/src/server/routes/instance/httpapi/public.ts`
- Restore upstream text in seven `packages/opencode/src/server/routes/instance/httpapi/groups/*.ts` files.

- [x] Add a failing generated-spec test proving legacy operation descriptions must not expose OpenCode branding.
- [x] Run the test and confirm it fails on existing uncentralized descriptions.
- [x] Add the minimal legacy-description transform in `public.ts`.
- [x] Restore group description literals to upstream text so those files leave the fork surface.
- [x] Run targeted HttpApi tests and compare generated API behavior.

### Task 3: Validate and Measure C-017

**Files:** C-017 files and reports only.

- [x] Run OpenCode typecheck and targeted server tests.
- [x] Confirm route/schema/component counts remain unchanged.
- [x] Recompute modified upstream files, Core patch paths, symbols, LOC, sources of truth, and import edges.
- [x] Accept only if Core patch paths decrease and complexity does not increase materially; otherwise revert C-017 only.
- [x] Create independent C-017 commit when accepted (`0cb49cfab`).

### Task 4: Close Autonomous Mission

**Files:**
- Create: `reports/slimming/autonomous-slimming-final-report.md`

- [x] Re-rank remaining candidates against current evidence.
- [x] Record accepted, rejected, frozen, and no-net-benefit work.
- [x] Run final verification and confirm manifests/lockfile content unchanged.
- [x] Stop at `STOP_AT_CURRENT_OPTIMUM` when only architectural, low-value, or environment-limited work remains.

## Outcome

- Result: `STOP_AT_CURRENT_OPTIMUM`.
- C-017 reduced modified upstream files by 7 and Core patch paths from 55 to 48 without changing routes, operation IDs, schemas, or V2 descriptions.
- Remaining candidates either have no net Fork Tax benefit, protect active compatibility/product behavior, require external runtime evidence, or cross a Frozen architecture boundary.
- Final reusable evidence is recorded in `autonomous-slimming-final-report.md`.
