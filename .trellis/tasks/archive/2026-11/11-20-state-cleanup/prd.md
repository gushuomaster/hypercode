# 收尾清理：归档已完成的 change 与过时任务

## Goal

清理 v1.19.6 同步后遗留的过时状态，让 `openspec/changes/` 与 `.trellis/tasks/` 只保留真正未完成的工作。不改动产品代码。

## Requirements

1. 归档 OpenSpec change `prepare-upstream-sync`（tasks 10/10，无 spec delta），归档目录为 `openspec/changes/archive/2026-11-20-prepare-upstream-sync/`。
2. 处理 Trellis 任务 `11-12-command-dispatch`：该任务 11-12 创建后从未规划（PRD 全为 TBD、jsonl 为空、从未进入 git），实际工作已按 OpenSpec change `fix-cross-host-command-dispatch` 在 `467eb4d452` 中实施（13/14，剩 5.3 手工冒烟）。在 PRD 中注明这一事实，然后用 `task.py archive` 归档。OpenSpec change 保持不动。
3. 处理 Trellis 任务 `11-12-license-gate`：先按其 PRD 验收条件复核，全部满足后归档任务。OpenSpec change `resolve-license-boundary` 保留，第 6 组（实机验收、客户重签、归档 change）由维护者执行。
   - `packages/opencode`：`bun test test/license` 通过，`bun typecheck` 通过
   - `sdks/vscode`：license 相关测试通过，`bun typecheck` 通过
   - 源码中不出现 `hyper-aicode-secret-2024`；git 跟踪文件中没有私钥 PEM
4. 复核不通过时停下汇报，不归档 license-gate 任务。

### license-gate 复核结果（2026-11-20，Bun 1.3.14）

- `packages/opencode`：`bun test test/license` 25 pass / 0 fail（3 个文件）；`bun typecheck` 通过
- `sdks/vscode`：`bun run check-types` 通过；`src/test/license.test.ts` 直接 `bun test` 时报 `Cannot find package 'vscode'`（基线已登记的环境性失败），改用系统临时目录里的 `vscode` 模块桩 preload 跑完 5 个用例，5 pass / 0 fail（桩用完即删，未提交）
- `git grep hyper-aicode-secret-2024`（排除 openspec/docs/.trellis）无结果；git 跟踪文件中没有 `PRIVATE KEY` 块，也没有 `*.pem`
- 结论：验收条件全部满足

## Acceptance Criteria

- [x] `openspec/changes/prepare-upstream-sync` 已移入 archive
- [x] `11-12-command-dispatch` 已归档，PRD 注明工作去向
- [x] license-gate 验收命令结果已记录；通过则任务已归档
- [x] `task.py list` 只剩本任务（完成后本任务也归档）
- [x] 改动以一个 `chore` 提交落地（是否推送由维护者决定）

## Out of Scope

- 各 change 的手工冒烟 / VSIX / EXE 验证（下一步统一执行）
- license 第 6 组
