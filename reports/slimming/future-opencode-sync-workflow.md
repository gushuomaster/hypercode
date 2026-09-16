# HyperCode Future OpenCode Sync Workflow

本流程用于将未来 OpenCode 版本同步到 HyperCode。目标是保留产品能力、让冲突可归因、让 Fork Tax 可比较；它不是新的 Fork Slimming 流程。

## 0. Preconditions

- 从默认分支 `dev` 开始。
- 分支名不含斜杠，最多三个连字符分隔单词，例如 `opencode-sync-1190`。
- 不运行 `git reset --hard`、`git clean -fd`、force push 或自动 ours/theirs 冲突裁决。
- 不在仓库根目录运行测试；类型检查和测试必须从对应 package 目录执行。
- 未建立 preservation stash 前禁止同步。

## 1. Preserve Current Work

分别检查所有相关 worktree：

```powershell
git worktree list --porcelain
git status --short --branch
git rev-parse HEAD
git diff --stat
git stash push --include-untracked -m "preserve: before OpenCode sync <version>"
git rev-parse 'stash@{0}'
git stash show --stat --include-untracked 'stash@{0}'
```

记录 stash hash、原 HEAD、tracked diff summary、untracked count。重叠路径只保留在 stash，禁止自动覆盖新 upstream 内容。

## 2. Pin Exact Upstream

可信 upstream：

```text
https://github.com/anomalyco/opencode.git
```

先只读查询目标 ref：

```powershell
git ls-remote https://github.com/anomalyco/opencode.git refs/heads/dev
```

在 sync ledger 中记录：

- repository URL
- target branch/tag
- exact commit SHA
- package version
- commit date/message
- pre-sync HyperCode HEAD

不得只记录 `dev`、`latest` 或版本字符串而省略精确 SHA。

## 3. Dry-Run Plan

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/sync-opencode-upstream.ps1 `
  -Mode Plan `
  -UpstreamVersion <version> `
  -UpstreamCommit <exact-sha>
```

确认当前 branch、HEAD、dirty 状态、上游 URL/ref、目标 commit 与生成的 sync branch。`Plan` 不 fetch、不创建分支、不 merge。

## 4. Prepare Sync Branch

只有工作树干净时执行：

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/sync-opencode-upstream.ps1 `
  -Mode Prepare `
  -UpstreamVersion <version> `
  -UpstreamRef dev `
  -UpstreamCommit <exact-sha> `
  -BaselineRef <pre-sync-hypercode-sha>
```

`Prepare` 会：

1. 将目标 ref fetch 到 `refs/audit/opencode-<version>`；
2. 拒绝 resolved commit 与指定 SHA 不一致的目标；
3. 从 baseline 创建 `opencode-sync-<version>`；
4. 使用 `--no-ff --no-commit` 建立明确 merge boundary；
5. 有冲突时停止，绝不自动裁决；
6. 无冲突时仍保持未提交，等待人工检查和 merge commit。

Rollback boundary 是 `<pre-sync-hypercode-sha>`。可额外创建符合命名规则的本地保护分支，例如：

```powershell
git branch pre-opencode-1190 <pre-sync-hypercode-sha>
```

## 5. Conflict Ledger

每个冲突路径必须记录：

| File | Upstream change | HyperCode behavior | Decision | Evidence | Risk | Validation |
|---|---|---|---|---|---|---|

决策值只允许：

- `TAKE_UPSTREAM`
- `KEEP_HYPERCODE`
- `MANUAL_MERGE`
- `DEFER_BLOCKED`

以下区域默认 Frozen，冲突必须逐文件语义裁决：Session、Provider lifecycle、Plugin architecture、TUI、VS Code runtime。

## 6. Rebrand Boundary

冲突全部解决后运行：

```powershell
node scripts/rebrand-opencode-to-hypercode.mjs --dry-run
node scripts/rebrand-opencode-to-hypercode.mjs --write
git diff --check
```

`--write` 的结果必须人工审查。禁止用全局字符串替换覆盖配置名、协议字段、provider/model ID、route、schema 或 compatibility aliases。

冲突与 upstream merge 内容审查完成后，先创建 `chore(opencode): sync upstream <version>` merge commit；再把 rebrand 结果作为独立 commit。`Validate` 和 Fork Tax 测量针对已提交的 `HEAD` 执行，避免把 pre-merge baseline 误当成同步结果。

## 7. Package Validation

先运行高风险定向验证，再运行 broad regression。示例：

```powershell
Set-Location packages/opencode
bun test test/server/httpapi-branding.test.ts test/server/httpapi-public-openapi.test.ts test/server/httpapi-query-schema-drift.test.ts test/server/httpapi-sdk.test.ts
bun typecheck
bun test --timeout 30000 --only-failures
```

根据 touched paths，从对应 package 追加：

```powershell
Set-Location packages/tui
bun typecheck
bun test

Set-Location ../../sdks/vscode
bun run check-types
bun run package
```

运行脚本级验证：

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/sync-opencode-upstream.ps1 `
  -Mode Validate `
  -UpstreamCommit <exact-sha> `
  -CurrentRef HEAD
```

`-RunPackageValidation` 会追加 OpenCode 定向测试和 `bun typecheck`。若输出与 baseline 中的 known failure signature 一致，记录为 baseline warning；任何新签名必须归因，不能直接标记 PASS。

当前 post-slimming rebrand warning signature 记录在 `post-slimming-baseline.md`。未来同步应使用 `node scripts/rebrand-opencode-to-hypercode.mjs --dry-run --report` 对比 blocked IDs、planned files 和 manual checks；签名增加或变化即阻塞集成，禁止直接执行 `--write` 消除报告。

## 8. Fork Tax Measurement

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/sync-opencode-upstream.ps1 `
  -Mode Measure `
  -UpstreamCommit <exact-sha> `
  -CurrentRef HEAD `
  -Json
```

每次记录：

- modified upstream files
- production paths
- core patch paths
- technical surface
- modified symbols（静态近似，另行审计）

新版本的 Fork Tax 只能与同一计数规则的旧 baseline 比较。

## 9. Commit Order

建议保持以下独立 rollback commits：

1. `chore(opencode): sync upstream <version>`
2. `fix(sync): restore HyperCode compatibility`
3. `chore(opencode): apply HyperCode branding`
4. `test(opencode): update sync regression coverage`
5. `docs: record OpenCode <version> baseline`

不要 squash 冲突修复、产品差异、测试和 baseline 文档。脚本不 push、不删除分支、不创建 PR。

## 10. Final Gate

最终报告必须包含：

- pre-sync / upstream / final SHA
- ancestry 与 merge boundary
- preservation stash hashes
- unresolved manual replay paths
- conflict ledger result
- targeted/broad validation result
- known failure comparison
- dependency/lockfile attribution
- before/after Fork Tax
- Frozen Area review
- rollback commands and independent commits

只有以下条件全部满足才允许集成回 `dev`：

1. 无 unmerged path 或 merge state；
2. 所有冲突有 ledger 与验证；
3. HyperCode KEEP/FROZEN 能力保留；
4. 新失败全部完成归因；
5. Fork Tax 使用固定规则复算；
6. 用户 dirty changes 仍有可恢复引用。
