# Phase 9 Manual Replay Required

以下路径不能自动恢复，因为 preservation 内容与当前 `25390fa4d` 或 Frozen Area 重叠。当前只保留 stash，不执行 ours/theirs 选择。

## Required Manual Decisions

| Path | Source stash | Why manual | Suggested validation |
|---|---|---|---|
| `AGENTS.md` | `125c4541…` / `4c3f7690…` | integrated HEAD 同路径，用户指令可能变化 | 逐段合并后检查规则未丢失 |
| `packages/opencode/script/license.rar` | `125c4541…` / `4c3f7690…` | 用户删除与当前 artifact 冲突 | 确认发布/license 流程后再决定 |
| `packages/opencode/src.rar` | `125c4541…` / `4c3f7690…` | 用户删除与当前 artifact 冲突 | 确认源码归档用途后再决定 |
| `packages/opencode/src/session/processor.ts` | `3674c90…` | Session Frozen；删除 dual-write 可能改变语义 | Session V2 tests、typecheck、行为 A/B |
| `packages/opencode/test/config/config.test.ts` | `3674c90…` | 当前 HEAD typecheck 失败，测试 wiring 重叠 | `bun typecheck`、config tests |
| `packages/opencode/test/plugin/loader-shared.test.ts` | `3674c90…` | plugin wiring 重叠 | plugin loader tests |
| `packages/opencode/test/session/compaction.test.ts` | `3674c90…` | Session test wiring 重叠 | compaction tests |
| `packages/opencode/test/share/share-next.test.ts` | `3674c90…` | 测试变量修复重叠 | share-next test |
| `sdks/vscode/src/core/sdk.ts` | `3674c90…` | VS Code runtime Frozen；新增 error union 需协议证据 | SDK typecheck/package |
| `reports/**` | `4c3f7690…` / `3674c90…` | current HEAD 已跟踪同名文档 | 逐文件 diff，不做目录覆盖 |

## Safe Manual Recipe

```powershell
git diff --no-ext-diff 3674c90ad0b99c877a70348af05c28ef1c9985fb^1 3674c90ad0b99c877a70348af05c28ef1c9985fb -- packages/opencode/src/session/processor.ts
git diff --no-ext-diff 3674c90ad0b99c877a70348af05c28ef1c9985fb^1 3674c90ad0b99c877a70348af05c28ef1c9985fb -- packages/opencode/test/config/config.test.ts
```

对每个路径重复上述审阅；确认后再使用 `git restore --source=<stash>^2 -- <path>` 或手工编辑。不要执行整个 stash 的 `apply`。

## Protection Checks

手工回放后必须确认：

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/sync-opencode-upstream.ps1 -Mode Measure -UpstreamCommit 193de13a88d62a6409c6d385831180f1def527dc -CurrentRef HEAD -Json
git diff --check
```

Core patch paths 不得从 `48` 回升；不得重新引入 C-017 的七个 OpenAPI group patches、C-009 scattered branding、C-001 duplicate env aliases 或 C-002 duplicate bootstrap owner。
