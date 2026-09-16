# HyperCode Phase 10 — Manual Replay Decision

记录时间：2026-09-15（Asia/Shanghai）

## Result

`MANUAL_REPLAY_DECISIONS_COMPLETE`

本阶段只完成 stash 内容的逐项判定和后续回放计划。没有执行 `stash apply/pop`、`git restore`、`reset`、stash drop、Frozen Area 修改或 production replay。

## Baseline

- Branch：`dev`
- HEAD：`25390fa4d34da1acf315ceabcd027baf62de26bd`
- OpenCode upstream：`193de13a88d62a6409c6d385831180f1def527dc`（1.18.30）
- Preservation stash：
  - `125c4541d6270b7e911631d3a334bc7e834ee5c1`
  - `4c3f7690e2863188f7fa3e9c729060f3fcddd336`
  - `3674c90ad0b99c877a70348af05c28ef1c9985fb`
- Fork Tax：`140 / 92 / 48 / 798`

测量结果：

```json
{"upstreamCommit":"193de13a88d62a6409c6d385831180f1def527dc","currentRef":"HEAD","modifiedUpstreamFiles":140,"productionPaths":92,"corePatchPaths":48,"technicalSurface":798}
```

## Decision Summary

| Path | Source | Origin | Decision | Baseline impact | Frozen / C-series impact |
|---|---|---|---|---|---|
| `AGENTS.md` | `125c4541…` / `4c3f7690…` | 用户协作规则 | `KEEP_REPLAY`（仅缺失语义，禁止整文件覆盖） | 不影响 Fork Tax | 不触碰 Frozen；不影响 C-017/C-009/C-001/C-002 |
| `packages/opencode/script/license.rar` | `125c4541…` / `4c3f7690…` | 已完成的历史归档清理 | `OBSOLETE` | 当前 HEAD 已无此路径 | 不影响任何 C-series |
| `packages/opencode/src.rar` | `125c4541…` / `4c3f7690…` | 已完成的历史归档清理 | `OBSOLETE` | 当前 HEAD 已无此路径 | 不影响任何 C-series |
| `packages/opencode/src/session/processor.ts` | `3674c90…` | OpenCode 1.18.30 sync repair | `KEEP_REPLAY`（Frozen manual gate） | 路径计数保持 `140/92/48`；实施后 technical surface 预计 `798 → 792` | Session Frozen；不涉及 C-017/C-009/C-001/C-002 |
| `packages/opencode/test/config/config.test.ts` | `3674c90…` | Effect/LayerNode test wiring repair | `KEEP_REPLAY` | 路径已是 upstream-modified；四项 Fork Tax 不增加 | 非 production Frozen；保护 C-002 行为但不恢复 bootstrap duplicate owner |
| `packages/opencode/test/plugin/loader-shared.test.ts` | `3674c90…` | Plugin node test wiring repair | `KEEP_REPLAY` | 路径已是 upstream-modified；四项 Fork Tax 不增加 | Plugin test boundary；不修改 Plugin production architecture |
| `packages/opencode/test/session/compaction.test.ts` | `3674c90…` | SessionStatus test dependency repair | `KEEP_REPLAY` | 路径已是 upstream-modified；四项 Fork Tax 不增加 | Session test boundary；不修改 Session production behavior |
| `packages/opencode/test/share/share-next.test.ts` | `3674c90…` | 测试变量错误修复 | `KEEP_REPLAY` | 路径已是 upstream-modified；四项 Fork Tax 不增加 | 不触碰 Frozen；不影响 C-series |
| `sdks/vscode/src/core/sdk.ts` | `3674c90…` | VS Code protocol type parity repair | `KEEP_REPLAY`（Frozen manual gate） | HyperCode-only path；四项 Fork Tax 不增加 | VS Code runtime Frozen；不影响 C-017/C-009/C-001/C-002 |
| `reports/slimming/01-*.md` … `10-*.md` | `4c3f7690…^3` | 已集成的 Phase 0–2 报告 | `OBSOLETE` | 与 HEAD blob 完全一致 | 无代码影响 |
| 6 个已跟踪 Phase 5 报告 | `3674c90…` | 用户审计记录的后续补充 | `KEEP_REPLAY`（逐 hunk 合并） | 不影响 Fork Tax | 只更新历史证据，不改变 C-series 实现 |
| 26 个 HEAD 缺失报告 | `3674c90…^3` | 唯一的 Phase 4.5–5A 审计记录 | `KEEP_REPLAY`（逐文件恢复） | 不影响 Fork Tax | 只恢复证据链，不改变 C-series 实现 |

当前没有文件级 `OPTIONAL_REPLAY`。也没有证据支持把有效修复整体归为 `BLOCKED_BY_BASELINE`；但整文件覆盖 `AGENTS.md`、目录级覆盖 `reports/**`、自动恢复三个 Frozen 相关路径仍是 `BLOCKED_BY_BASELINE` 的操作方式。

## Item Analysis

### `AGENTS.md` — `KEEP_REPLAY`

stash 版本保存了用户明确添加的中文用户体验与本地化规则；当前 HEAD 没有这组语义，因此不能直接判为过期。另一方面，当前 HEAD 新增了 Protocol/HttpApi 生成要求、依赖方向、Effect generator 约束和更新后的 Session drain 语义，整文件采用 stash 版本会丢失这些较新规则。

回放边界：只人工合并 stash 中当前 HEAD 缺失且仍有效的中文用户体验规则；当前 HEAD 的全部新规则优先保留。禁止 `git restore --source=<stash> -- AGENTS.md` 和任何 ours/theirs 整文件选择。

### Historical archives — `OBSOLETE`

`packages/opencode/script/license.rar` 和 `packages/opencode/src.rar` 已不在当前 HEAD 中；stash 保存的也是删除状态。Phase 2 报告已经证明它们是无引用的历史快照，并完成安全删除。再次“回放删除”不会产生任何变更，因此无需处理。

### `packages/opencode/src/session/processor.ts` — `KEEP_REPLAY`

当前 HEAD 在 `step-start` 分支保留了 6 行 legacy V2 dual-write 逻辑，但 `mirrorAssistant` 和 `ensureV2AssistantMessage` 已不存在，当前 typecheck 因此出现未定义标识符和 Effect requirement 泄漏。OpenCode 1.18.30 upstream 同一分支已不包含 dual-write；stash 只删除这 6 行，属于未完整落地的 upstream sync repair，不是新的 slimming 或历史 workaround。

该文件属于 Session Frozen Area，禁止自动恢复。未来人工回放后，modified upstream files、production paths 和 core patch paths 仍应为 `140 / 92 / 48`；technical surface 预计因删除 6 行变为 `792`。这属于恢复 upstream-equivalent baseline，而不是增加 fork surface，但必须单独记录并验证 Session 行为。

### OpenCode tests — `KEEP_REPLAY`

- `test/config/config.test.ts`：移除重复 `Npm` import，补 `EffectFlock.node`，并把已删除的 `defaultLayer`/`infra` wiring 改为当前 `LayerNode.compile(...)` API。当前 typecheck 可复现对应错误。
- `test/plugin/loader-shared.test.ts`：从已删除的 `Plugin.layer`/`EventV2Bridge.defaultLayer` 改为 `Plugin.node` 的显式 node wiring。只改变测试装配，不改变 Plugin runtime。
- `test/session/compaction.test.ts`：向 compaction test graph 补入实际消费的 `SessionStatus.node`。只改变测试装配，不改变 Session runtime。
- `test/share/share-next.test.ts`：避免内部变量遮蔽，并从实际收集的 `createRequests` 过滤 POST 请求；当前 HEAD 的 `seen` 未定义错误可复现。

四项都是同步后的测试基础设施修复。它们不会增加 modified upstream file 或 Core patch path，因为四个路径当前已经相对 upstream 修改；它们也不会恢复 C-002 的 duplicate bootstrap owner。

### `sdks/vscode/src/core/sdk.ts` — `KEEP_REPLAY`

stash 只向本地 `MessageError` union 加入 `ContentFilterError`。该错误已存在于 `packages/schema/src/v1/session.ts`、`packages/sdk/openapi.json`、生成的 JavaScript SDK 和 OpenCode runtime，因此这是 VS Code 手写协议类型与现行协议的 parity repair，不是新功能。

该路径属于 VS Code runtime Frozen Area，但它是 HyperCode-only path，回放不改变四项 Fork Tax。仍须按单文件 type-only 修改处理，并用 VS Code `check-types`/package 验证；禁止借此重新生成或覆盖其他 VS Code runtime 文件。

## Reports Classification

### Already integrated — `OBSOLETE`

以下 10 个 stash blob 与当前 HEAD 完全一致，不需要回放：

```text
reports/slimming/01-fork-baseline.md
reports/slimming/02-hypercode-delta.md
reports/slimming/03-upstream-delta.md
reports/slimming/04-conflict-map.md
reports/slimming/05-feature-inventory.md
reports/slimming/06-phase1-summary.md
reports/slimming/07-pre-sync-candidates.md
reports/slimming/08-pre-sync-changes.md
reports/slimming/09-pre-sync-validation.md
reports/slimming/10-phase2-summary.md
```

### Tracked overlaps — `KEEP_REPLAY`

以下文件的 stash 版本包含当前 HEAD 缺失的最终 eligibility、C-002 commit、validation、fork reduction 和 Phase 5A completion 记录。只能逐 hunk 合并，不能使用 stash 版本覆盖整文件：

```text
reports/slimming/16-post-sync-slimming-candidates.md
reports/slimming/40-phase5a-execution-ledger.md
reports/slimming/41-phase5a-validation-results.md
reports/slimming/42-phase5a-fork-reduction.md
reports/slimming/43-phase5a-summary.md
reports/slimming/47-phase5a-c002-summary.md
```

### Missing unique evidence — `KEEP_REPLAY`

以下 26 个文件不存在于当前 HEAD；它们记录 validation recovery、guardrail、candidate decision 和 no-net-benefit/blocked 结论，并被当前已跟踪报告引用。恢复这些文件可修复审计链，不影响代码或 Fork Tax：

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

## Independent Replay Plans

这些计划只定义后续动作，本阶段未执行。

### R1 — Root instructions

1. 再次记录 HEAD、status 和三个 stash hash。
2. 对比 `AGENTS.md` 当前内容与 `125c4541…`，只列出 current HEAD 缺失的用户可见中文规则。
3. 使用人工段落级编辑合并；不接受整文件 checkout/restore。
4. 检查当前 HEAD 的 Protocol generation、dependency direction、Effect 和 Session 规则逐条仍存在。
5. 运行 `git diff --check`，单独提交或保留为独立 review unit。

### R2 — Session processor Frozen repair

1. 确认目标文件无新的用户 dirty change；若已 dirty，停止并重新三方比较。
2. 只人工应用 stash 中删除 `step-start` dual-write 的 6 行 hunk。
3. 从 `packages/opencode` 运行：

   ```powershell
   bun test test/session/processor-effect.test.ts test/session/prompt.test.ts test/session/compaction.test.ts
   bun typecheck
   ```

4. 将结果与 Phase 4/5 known-failure signature 对比；任何新 Session failure 立即撤销该独立 hunk。
5. 重新测量 Fork Tax；期望 `140 / 92 / 48 / 792`，并把 `-6` 归因为 upstream-equivalent sync repair。

### R3 — Test wiring repairs

每个文件作为独立 review unit，先确认无现存 dirty change，再人工应用对应 stash hunk：

```powershell
bun test test/config/config.test.ts
bun test test/plugin/loader-shared.test.ts
bun test test/session/compaction.test.ts
bun test test/share/share-next.test.ts
bun typecheck
```

命令均从 `packages/opencode` 执行。单文件 targeted test 出现新失败时只撤销该文件；完成四项后再运行 broad baseline comparison。禁止修改 production code、manifest 或 `bun.lock` 来让测试通过。

### R4 — VS Code protocol type parity

1. 确认 `sdks/vscode/src/core/sdk.ts` 无新的用户 dirty change。
2. 只人工加入 `ContentFilterError` type 和 `MessageError` union member；不覆盖文件其他内容。
3. 从 `sdks/vscode` 运行：

   ```powershell
   bun run check-types
   bun run package
   ```

4. 对比现有 VS Code known-failure signature；不修改生成 SDK、manifest、dependency 或 lockfile。
5. 重新测量 Fork Tax；期望四项保持 `140 / 92 / 48 / 798`（若 R2 已完成，则 technical surface 保持 `792`）。

### R5 — Slimming reports

1. 对 26 个 HEAD 缺失文件逐文件从 `3674c90…^3` 恢复；禁止目录级 restore。
2. 对 6 个 tracked overlap 只人工合并缺失章节；当前 HEAD 的后续 Phase 5B/optimum 结论优先。
3. 不处理 10 个与 HEAD 完全一致的 Phase 0–2 文件。
4. 检查所有报告引用的目标文件存在，并运行 `git diff --check`。
5. 报告恢复作为独立 docs review unit，不与 Frozen/code replay 混合。

## Protection Rules

- C-017：不得重新引入 7 个 OpenAPI branding upstream patches；Core patch paths 不得高于 `48`。
- C-009：不得恢复 scattered branding patch。
- C-001：不得恢复 duplicate env alias source。
- C-002：不得恢复 duplicate config bootstrap owner；`config.test.ts` 只恢复验证 wiring。
- 禁止整 stash `apply/pop`、stash drop、reset、force operation、manifest/lockfile 修改。
- 禁止覆盖当前 dirty 内容；任何目标路径出现新 dirty 状态时，停止该项并重新分类。

## Current Validation Evidence

- 当前 HEAD Fork Tax measure：`140 / 92 / 48 / 798`。
- `3674c90…` 只读 measure：`140 / 92 / 48 / 792`；唯一计数变化来自 Session processor 删除 6 行。
- 当前 `packages/opencode bun typecheck` 可复现 processor、config、plugin、compaction、share 的已知错误；当前工作树的 `run-real-doubao.ts` 还带有独立、非本任务错误，不能归因于本次 replay decision。
- OpenCode 1.18.30 upstream 的 `step-start` 不包含 legacy dual-write。
- `ContentFilterError` 已存在于 schema、OpenAPI、生成 SDK 和 runtime consumer。

## Final Recommendation

下一次执行应先恢复报告证据和非 Frozen test wiring，再分别审查 Session processor 与 VS Code type parity。`AGENTS.md` 只允许语义级人工合并。三个 preservation stash 在所有 KEEP_REPLAY 项完成、验证并形成独立提交前继续保留。
