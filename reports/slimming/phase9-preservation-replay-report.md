# HyperCode Phase 9 — Preservation Replay Report

执行时间：2026-09-15（Asia/Shanghai）

## Final Status

`PARTIAL_REPLAY_WITH_MANUAL_ITEMS`

用户有效脚本已恢复；与当前 baseline 或 Frozen Area 重叠的内容没有自动覆盖，全部保留在可恢复 stash 和人工清单中。没有创建新的 slimming candidate，也没有修改 upstream patch。

## Current HEAD

- Branch：`dev`
- HEAD：`25390fa4d34da1acf315ceabcd027baf62de26bd`
- `dev` 相对 `origin/dev`：ahead `1672`
- Merge state：无 `MERGE_HEAD`
- Unmerged paths：`0`

## Preservation Stashes

| Stash | Source | Inventory |
|---|---|---|
| `125c4541d6270b7e911631d3a334bc7e834ee5c1` | residual `dev` tracked dirty | `AGENTS.md`、两个 `.rar` 删除 |
| `4c3f7690e2863188f7fa3e9c729060f3fcddd336` | primary `dev` snapshot | tracked dirty、`run-real`、10 个旧报告、1657 untracked（含 VS Code 生成物） |
| `3674c90ad0b99c877a70348af05c28ef1c9985fb` | slimming worktree dirty | Session processor、5 个测试、VS Code SDK、Phase 4/5 报告 |

三份对象均为有效 commit；本阶段没有 `stash apply/pop`、stash drop、reset 或 clean。

## Replayed Files

| File | Source | Reason | Validation |
|---|---|---|---|
| `packages/opencode/script/run-real-doubao.ts` | `4c3f7690…^3` | 用户脚本；当前 HEAD 不含且无同路径覆盖 | 当前 blob `ee8c1e258a0d8648319d3ce3ee0a8bd15de1e9d4` 与 stash blob 相同；typecheck 仍受其依赖缺失影响，未修改脚本 |

## Skipped / Obsolete

| File or pattern | Classification | Reason |
|---|---|---|
| `sdks/vscode/.vscode-test/**` | `OBSOLETE` | 生成的 VS Code runtime/cache，不属于产品源代码；当前目录保留 932 个文件，stash 保留完整 1646 个副本 |
| `reports/slimming/01-10*.md` | `OPTIONAL_REPLAY` + overlap | 当前 HEAD 已跟踪同名报告，目录级恢复会覆盖 baseline |
| `reports/slimming/21-53*.md` | `OPTIONAL_REPLAY` + overlap | 历史 Phase 4/5 报告，留在 stash 等人工比较 |

## Manual Merge Required

以下均未自动恢复：

- `AGENTS.md`：用户指令与 integrated HEAD 同路径。
- `packages/opencode/script/license.rar`、`packages/opencode/src.rar`：用户删除与当前 tracked artifact 冲突。
- `packages/opencode/src/session/processor.ts`：Session Frozen；stash 删除 V2 dual-write 逻辑，可能改变行为。
- `packages/opencode/test/config/config.test.ts`、`test/plugin/loader-shared.test.ts`、`test/session/compaction.test.ts`、`test/share/share-next.test.ts`：用户测试 wiring/错误修复与当前 HEAD 重叠，须逐文件回放。
- `sdks/vscode/src/core/sdk.ts`：VS Code runtime Frozen；新增 `ContentFilterError` 需要协议证据。
- 所有 stash 中的 `reports/**`：当前 HEAD 已含 slimming 文档树，禁止自动覆盖。

详细路径、来源和人工命令见 `reports/slimming/manual-replay-required.md`。

## Classification Summary

- `MUST_REPLAY`：`run-real`、AGENTS、两个 artifact 删除、Session/test/VS Code SDK 用户修改；其中重叠项转人工。
- `OPTIONAL_REPLAY`：Phase 4/5 历史报告；全部转人工比较。
- `OBSOLETE`：`.vscode-test` 生成目录；不加入 Git。
- `CONFLICT_WITH_BASELINE`：AGENTS、artifact 删除、Session processor、VS Code SDK、所有 overlapping reports。

## Validation

### Passed

- OpenAPI branding、Public OpenAPI、query schema drift、SDK 定向组：`32 pass / 0 fail`。
- Phase 8 sync script behavior test：`1 pass / 0 fail`。
- PowerShell parser：`0` errors。
- `git diff --check`：exit `0`。
- Frozen/offline dependency recovery：成功；`bun.lock` 与 `packages/opencode/package.json` hash 未变化。
- Merge integrity：无 merge state、无 unmerged path。

### Warnings

- clean committed HEAD `bun typecheck`：`28 errors / 5 paths`，涉及 Session processor 与 4 组测试；这些修复均在 `3674c90…`，本阶段不自动回放。
- `rebrand:check --dry-run --report`：baseline signature 为 `2 blocked / 1 planned / 2 manual`；未运行 `--write`。
- 当前 `.vscode-test` 工作树副本少于 stash 完整副本，但已按生成物 obsolete 处理；完整备份仍可从 `4c3f7690…^3` 取回。

## Fork Tax Before / After Replay

用户内容没有写入 committed HEAD，因此提交级 Fork Tax 保持不变：

| Metric | Before replay | After replay | Explanation |
|---|---:|---:|---|
| Modified upstream files | 140 | 140 | `run-real` 为 untracked；重叠内容未写回 |
| Production paths | 92 | 92 | 无 production replay |
| Core patch paths | 48 | 48 | 未恢复 Session/VS Code Frozen 修改 |
| Technical surface | 798 | 798 | 计数基于 upstream `193de13a…` 与 committed HEAD |
| Modified symbols | ≈70 | ≈70 | 无 committed source 变化 |
| Duplicate maintenance points | 42 eliminated | 42 eliminated | C-009/C-001/C-002/C-017 未回退 |

## Slimming Protection

- C-017：7 个 OpenAPI branding upstream patches 未重新引入；Core patch paths 保持 `48`。
- C-009：未恢复 scattered branding patch。
- C-001：未恢复 duplicate env alias source。
- C-002：未恢复 duplicate config bootstrap owner。

## Final Recommendation

当前停止在 `PARTIAL_REPLAY_WITH_MANUAL_ITEMS`。保留三份 stash 和人工清单，先由用户逐项决定 AGENTS/artifact、Session/test、VS Code SDK 与历史报告的回放；在这些决定完成前，不要删除 stash、不要把 `.vscode-test` 纳入提交，也不要提升 validation 为 PASS。
