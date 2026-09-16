# HyperCode Phase 11 — Selective Replay Execution

执行时间：2026-09-16（Asia/Shanghai）

## Result

`SUCCESSFUL_SELECTIVE_REPLAY_WITH_WARNINGS`

Phase 10 批准的 `KEEP_REPLAY` 项已按单文件或精确文档 allowlist 回放。没有执行 `git stash pop`、`git stash drop`、`reset`、force operation、manifest/lockfile 修改或目录级覆盖。

当前修改尚未提交，因此 `HEAD` 保持：

```text
25390fa4d34da1acf315ceabcd027baf62de26bd
```

三个 preservation stash 均保留：

```text
125c4541d6270b7e911631d3a334bc7e834ee5c1
4c3f7690e2863188f7fa3e9c729060f3fcddd336
3674c90ad0b99c877a70348af05c28ef1c9985fb
```

## Replay Ledger

| File / group | Source stash | Reason | Validation | Fork Tax impact |
|---|---|---|---|---|
| `AGENTS.md` | `125c4541…` / `4c3f7690…` | 恢复用户新增的中文用户体验与本地化规则，同时保留当前 Protocol、dependency、Effect、Session 规则 | `git diff --check`；逐条确认当前规则仍存在 | 无 |
| 26 个缺失的 Phase 4.5–5A reports | `3674c90…^3` | 恢复唯一 validation、guardrail、ranking 和 candidate 审计证据 | 26/26 working blob 与 stash blob 一致 | 无 |
| 6 个重叠 Phase 5 reports | `3674c90…` | 合并当前 HEAD 缺失的 C-002、Phase 5A completion 和 validation 章节 | 6/6 working blob 与批准 stash 版本一致 | 无 |
| `packages/opencode/test/config/config.test.ts` | `3674c90…` | 修复 Effect/LayerNode test wiring | RED：0 pass / 1 fail / 1 error；GREEN：118 pass / 0 fail | 路径计数不变 |
| `packages/opencode/test/plugin/loader-shared.test.ts` | `3674c90…` | 用 `Plugin.node` 替换已移除的 `Plugin.layer` test wiring | RED：28 pass / 1 fail；GREEN：29 pass / 0 fail | 路径计数不变 |
| `packages/opencode/test/session/compaction.test.ts` | `3674c90…` | 向 test graph 补入 `SessionStatus.node` | RED：54 pass / 1 skip / 1 fail；GREEN：55 pass / 1 skip / 0 fail | 路径计数不变 |
| `packages/opencode/test/share/share-next.test.ts` | `3674c90…` | 修复 `seen` 未定义和局部变量遮蔽 | RED：6 pass / 1 fail；GREEN：7 pass / 0 fail | 路径计数不变 |
| `packages/opencode/src/session/processor.ts` | `3674c90…` | 删除已失去定义的 legacy V2 dual-write；与 OpenCode 1.18.30 upstream 对齐 | RED：processor 4 pass / 13 fail；GREEN：17 pass / 0 fail；Session 组合 117 pass / 15 skip / 0 fail | `140 / 92 / 48` 不变；technical surface `798 → 792` |
| `sdks/vscode/src/core/sdk.ts` | `3674c90…` | 将现有协议中的 `ContentFilterError` 加入 VS Code 手写类型 union | RED：`check-types` 3 errors；GREEN：`check-types` PASS；`package` PASS | 无；HyperCode-only path |

## AGENTS Merge

只在当前文件顶部新增用户体验规则，没有用 stash 整文件覆盖：

- 用户可见文案默认简体中文；
- UI、CLI、TUI、帮助、权限、状态、错误、skill 与 workflow 均适用；
- 第三方英文错误保留原文并提供中文解释；
- 用户可见流程测试覆盖关键中文文案。

以下当前规则已确认保留：

- Protocol / Server `HttpApi` 生成要求；
- Schema、Core、Protocol、Client、Server dependency direction；
- Effect generator service binding 规则；
- 当前 Session drain、queue、continuation 和 ownership 语义。

## Reports Replay

### Restored missing reports

恢复 `21`–`39`、`46`、`48`–`53` 共 26 个缺失文件。使用精确路径 allowlist；没有执行 `reports/**` 目录级 restore。

### Merged tracked reports

以下 6 个文件只应用批准差异：

```text
reports/slimming/16-post-sync-slimming-candidates.md
reports/slimming/40-phase5a-execution-ledger.md
reports/slimming/41-phase5a-validation-results.md
reports/slimming/42-phase5a-fork-reduction.md
reports/slimming/43-phase5a-summary.md
reports/slimming/47-phase5a-c002-summary.md
```

## Frozen Area Decisions

### Session

`processor.ts` 的 stash diff 仅删除 6 行 dangling dual-write。`mirrorAssistant` 与 `ensureV2AssistantMessage` 在当前实现中不存在，导致 provider stream 在 `step-start` 后被内部错误路径终止。OpenCode 1.18.30 upstream 已不包含这段 dual-write。

该变更属于 upstream sync repair / 明确缺陷修复，不是 Frozen Area 架构重构：

- 没有新增 Session abstraction；
- 没有改变 Session ownership、delivery 或 runner architecture；
- 没有增加 modified upstream files、production paths 或 Core patch paths；
- technical surface 减少 6 行；
- processor 定向测试由 13 fail 恢复为 0 fail。

因此不构成突破 Frozen Area。

### VS Code

`sdk.ts` diff 仅新增 `ContentFilterError` type 和 `MessageError` union member。该错误已存在于 schema、OpenAPI、生成 SDK 和 OpenCode runtime consumer。

该变更是 type-only compatibility repair：

- 没有协议 schema 变更；
- 没有 runtime control flow；
- 没有 architecture change；
- 没有生成 SDK、manifest、dependency 或 lockfile 修改。

因此不构成突破 Frozen Area。

## Validation

### Targeted

```text
config:             118 pass / 0 fail
plugin loader:       29 pass / 0 fail
compaction:           55 pass / 1 skip / 0 fail
share-next:            7 pass / 0 fail
processor:            17 pass / 0 fail
Session combined:    117 pass / 15 skip / 0 fail
VS Code check-types: PASS
VS Code package:     PASS
```

### OpenCode typecheck

Phase 11 目标路径的 type errors 已全部消失。`bun typecheck` 仍失败于：

- `packages/opencode/script/run-real-doubao.ts`：Phase 9 已恢复的独立用户脚本依赖不存在或 API 已漂移；
- `test/config/config.test.ts:284`：既有 F-013（`Option<never>` 与 `string | undefined`）。

本阶段没有修改这些独立问题来换取 typecheck 通过。

### Broad regression

```text
3610 pass
58 skip
1 todo
8 fail
```

失败归因：

- 6 个 Windows symlink privilege / `EPERM`：既有环境签名；
- 1 个 CLI help snapshot：既有 snapshot spacing 签名；
- 1 个 `restore messages in sequential order` aggregate timeout：隔离重跑 `1 pass / 0 fail`，归为时序 flake。

Phase 11 replay 新增可归因 regression：`0`。

### Integrity

- `git diff --check`：PASS；仅有 Git 的 LF→CRLF working-copy warning。
- `bun.lock` blob：`d1a30094ccd5e607f14859313b2e8ee951577441`，未变化。
- `packages/opencode/package.json` blob：`3f72ba0dc1dc275d53dd63eebfa5294440297147`，未变化。
- 6 个 replay code/test blobs 与 `3674c90…` 完全一致。
- stash 数量和 hash 未变化。

## Fork Tax Before / After

当前 replay code/test blobs 与已测量的 preservation ref `3674c90…` 完全一致；AGENTS、reports 与 HyperCode-only VS Code path不进入四项 upstream measure。

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Modified upstream files | 140 | 140 | 0 |
| Production paths | 92 | 92 | 0 |
| Core patch paths | 48 | 48 | 0 |
| Technical surface | 798 | 792 | -6 |

Technical surface 的 `-6` 全部来自删除 OpenCode 1.18.30 upstream 已移除的 dangling Session dual-write，不是删除 HyperCode 产品能力。

## Slimming Protection

- C-017：没有修改 OpenAPI/SDK branding paths；7 个 upstream branding patches 未重新引入。
- C-009：没有恢复 scattered branding patch。
- C-001：没有修改 env alias sources。
- C-002：没有修改 config bootstrap production owner；只恢复 config test wiring 与历史报告。
- Core patch paths 保持 `48`。

## Final State

`SUCCESSFUL_SELECTIVE_REPLAY_WITH_WARNINGS`

必要历史用户修改已恢复，Slimming baseline 未回退，新增可归因 regression 为 0。warning 仅保留既有 Windows/snapshot baseline、aggregate timing flake，以及 Phase 9 用户脚本和 F-013 导致的 package typecheck 非绿状态。所有 preservation stash 继续保留，未自动提交或删除。
