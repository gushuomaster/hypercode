# Phase 9 Preservation Stash Inventory

记录时间：2026-09-15（Asia/Shanghai）

本清单来自 `git diff --name-status <stash>^1 <stash>` 与 untracked parent 的只读检查。没有执行 `git stash apply/pop`。

## Classification Rules

- `MUST_REPLAY`：用户工作或当前验证必需，但若路径重叠仍须人工回放。
- `OPTIONAL_REPLAY`：文档、报告或开发便利内容，默认不回放。
- `OBSOLETE`：生成物、历史 workaround 或当前 HEAD 已覆盖内容。
- `CONFLICT_WITH_BASELINE`：会触碰 slimming/Frozen Area、依赖约束或当前 HEAD 同一路径，禁止自动恢复。

## Stash `125c4541d6270b7e911631d3a334bc7e834ee5c1`

这是主 `dev` 残留 tracked snapshot，没有 untracked parent。

| File | Classification | Decision |
|---|---|---|
| `AGENTS.md` | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 用户指令文件与 integrated HEAD 同路径，人工三方合并 |
| `packages/opencode/script/license.rar` | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 用户删除与当前 tracked artifact 冲突，人工确认是否保留删除 |
| `packages/opencode/src.rar` | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 用户删除与当前 tracked artifact 冲突，人工确认是否保留删除 |

## Stash `4c3f7690e2863188f7fa3e9c729060f3fcddd336`

Tracked parent 与上一个 stash 相同；untracked parent 共 `1657` 项：

| File or pattern | Count | Classification | Decision |
|---|---:|---|---|
| `AGENTS.md` | 1 | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 与 `125c4541…` 重复，人工合并 |
| `packages/opencode/script/license.rar` | 1 | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 与 `125c4541…` 重复，人工确认 |
| `packages/opencode/src.rar` | 1 | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 与 `125c4541…` 重复，人工确认 |
| `packages/opencode/script/run-real-doubao.ts` | 1 | `MUST_REPLAY` | 已恢复；当前目标不存在同路径 |
| `reports/slimming/01-fork-baseline.md` … `10-phase2-summary.md` | 10 | `OPTIONAL_REPLAY` + `CONFLICT_WITH_BASELINE` | 当前 HEAD 已跟踪同名报告，禁止覆盖 |
| `sdks/vscode/.vscode-test/**` | 1646 | `OBSOLETE` | 生成的 VS Code runtime/cache；保留原地，不加入 Git |

## Stash `3674c90ad0b99c877a70348af05c28ef1c9985fb`

### Tracked Files

| File | Classification | Decision |
|---|---|---|
| `packages/opencode/src/session/processor.ts` | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 删除 V2 dual-write 逻辑会改变 Session Frozen 行为，人工审查 |
| `packages/opencode/test/config/config.test.ts` | `MUST_REPLAY` | 适配 `LayerNode`/Effect API，当前 clean HEAD typecheck 失败；人工回放 |
| `packages/opencode/test/plugin/loader-shared.test.ts` | `MUST_REPLAY` | 适配 plugin node 测试 wiring，人工回放 |
| `packages/opencode/test/session/compaction.test.ts` | `MUST_REPLAY` | 补 `SessionStatus.node` 测试依赖，人工回放 |
| `packages/opencode/test/share/share-next.test.ts` | `MUST_REPLAY` | 修复 `seen`/`createRequests` 变量错误，人工回放 |
| `sdks/vscode/src/core/sdk.ts` | `MUST_REPLAY` + `CONFLICT_WITH_BASELINE` | 新增 `ContentFilterError`，属于 VS Code runtime Frozen Area，人工审查 |
| `reports/slimming/16-post-sync-slimming-candidates.md` | `OPTIONAL_REPLAY` + `CONFLICT_WITH_BASELINE` | 当前 HEAD 已跟踪，人工比较报告内容 |
| `reports/slimming/40-phase5a-execution-ledger.md` | `OPTIONAL_REPLAY` + `CONFLICT_WITH_BASELINE` | 当前 HEAD 已跟踪，人工比较报告内容 |
| `reports/slimming/41-phase5a-validation-results.md` | `OPTIONAL_REPLAY` + `CONFLICT_WITH_BASELINE` | 当前 HEAD 已跟踪，人工比较报告内容 |
| `reports/slimming/42-phase5a-fork-reduction.md` | `OPTIONAL_REPLAY` + `CONFLICT_WITH_BASELINE` | 当前 HEAD 已跟踪，人工比较报告内容 |
| `reports/slimming/43-phase5a-summary.md` | `OPTIONAL_REPLAY` + `CONFLICT_WITH_BASELINE` | 当前 HEAD 已跟踪，人工比较报告内容 |
| `reports/slimming/47-phase5a-c002-summary.md` | `OPTIONAL_REPLAY` + `CONFLICT_WITH_BASELINE` | 当前 HEAD 已跟踪，人工比较报告内容 |

### Untracked Files

以下 `26` 个报告为 optional replay；当前 integrated HEAD 已包含同一 slimming 文档树或后续 baseline，禁止目录级恢复：

```text
reports/slimming/21-phase4.5-validation-recovery.md
reports/slimming/22-validation-failure-ledger.md
reports/slimming/23-validation-attribution-matrix.md
reports/slimming/24-phase4.6-sync-repairs.md
reports/slimming/25-validation-trust-map.md
reports/slimming/26-phase4.6-summary.md
reports/slimming/27-static-phase5-ranking.md
reports/slimming/28-symbol-level-fork-surface.md
reports/slimming/29-static-duplication-and-dead-code.md
reports/slimming/30-extension-extraction-feasibility.md
reports/slimming/31-phase4.7-summary.md
reports/slimming/32-validation-blocker-ledger.md
reports/slimming/33-phase5-guardrails.md
reports/slimming/34-area-validation-gates.md
reports/slimming/35-phase4.8-summary.md
reports/slimming/36-phase4.8-sync-repairs.md
reports/slimming/37-phase5-validation-baseline.md
reports/slimming/38-phase5a-allowlist.md
reports/slimming/39-phase4-final-gate-review.md
reports/slimming/46-c002-fresh-home-validation.md
reports/slimming/48-phase5a-remaining-ranking.md
reports/slimming/49-phase5a-c005-summary.md
reports/slimming/50-c008-preflight.md
reports/slimming/51-phase5a-c007-summary.md
reports/slimming/52-phase5a-final-summary.md
reports/slimming/53-phase5a-c012-summary.md
```

## Replay Summary

- Automatic replay：仅 `packages/opencode/script/run-real-doubao.ts`，目标路径此前不存在。
- Kept in place：`sdks/vscode/.vscode-test/`，生成物且不被 branch 跟踪。
- Manual replay：`AGENTS.md`、两个 `.rar` 删除、Session processor、5 个 OpenCode tests、VS Code SDK、全部 overlapping reports。
- Obsolete：`.vscode-test` 生成缓存；不建议纳入提交。
- No stash was dropped or applied。
