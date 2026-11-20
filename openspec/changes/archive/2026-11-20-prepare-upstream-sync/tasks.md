# Tasks

## 1. 仓库状态

- [x] 1.1 提交当前 openspec/trellis 迁移改动，确认 `git status` 干净（留到全部 change 完成后统一提交）
  - 2026-11-18 拆为两个提交：`a99a992b2`（Trellis/OpenSpec 迁移）、`467eb4d45`（产品代码与 change 收尾）；未跟踪的空任务目录 `.trellis/tasks/11-12-command-dispatch/` 不纳入
- [x] 1.2 经维护者确认后推送 `dev` 上未推送的 6 个提交，`git rev-list origin/dev..dev` 为空（待维护者确认）
  - 2026-11-18 维护者确认"提交并推送"；`dev` 快进到本 change 的提交后推送到 `origin`

## 2. 新基线

- [x] 2.1 运行 `scripts/sync-opencode-upstream.ps1 -Mode Measure -UpstreamCommit 193de13a88d62a6409c6d385831180f1def527dc`，确认结果与手算的 `218 / 149 / 62 / 1538` 一致或解释差异
  - `359960c7d` 实测 `218 / 149 / 62 / 1538`，与手算一致
  - 本轮暂存快照（`git commit-tree` 生成的临时提交，未移动分支）实测 `220 / 149 / 62 / 1538`：只多 2 个 upstream 仓库配置文件；授权门禁、`cli/main.ts`、`cli/text.ts` 为 HyperCode 新增文件，不计入。提交后需用 `-CurrentRef HEAD` 再测一次
- [x] 2.2 在三个 package 目录运行全量测试与 typecheck，记录失败身份（按类别），形成新的已知债务基线
  - 2026-11-18 扩大为五个包（product、core、tui、opencode、vscode）：typecheck 全部 PASS；失败逐条在 HEAD 与 pure upstream worktree 复跑归因，新回归 0（本轮引入的 3 个 VSCode `textKey` 断言失败已修复），已知失败签名写入基线文档"验证基线"
- [x] 2.3 更新基线文档：新 fork tax、已修复项（F-013、windows-validation-build 类型）、仍存在的债务（`run-real-doubao.ts`、`rebrand:check` 签名、Windows symlink EPERM 等），并在同步规范中引用新基线
  - 已完成：`reports/slimming/post-slimming-baseline.md` 顶部新增"2026-11-13 基线刷新"（fork tax、已修复与仍存在的债务、A/B 对照恢复）；`docs/规范/上游同步工作流总纲.md`"验证结论归因"引用该基线
  - 2.2 结果已填入"验证基线"小节
  - 提交后 `-CurrentRef HEAD` 实测 `221 / 149 / 62 / 1538`（比暂存快照多 1：`test/preload.ts`），已作为正式基线填回表格

## 3. 对照验证能力

- [x] 3.1 复现 Windows pure upstream worktree 的 Bun hardlink 失败，评估替代方案（复制安装、`--backend=copyfile`、Linux/WSL 执行对照），选定后在 1.18.30 pure upstream 上成功跑通一次 package 测试
  - 现有 worktree `.worktrees/upstream-1.18.30-audit`（`193de13a8`）。`--backend=copyfile` 避开了硬链接，但先暴露出第二个问题：`bunfig.toml` 的 `minimumReleaseAge` 让 bun 重新解析已锁定的 storybook，报 `No version matching "^10.2.13" ... (but package exists)`
  - 选定方案：`bun install --frozen-lockfile --backend=copyfile --minimum-release-age=0`，安装成功（husky 正常执行）；`packages/opencode` 下 `bun test --timeout 30000 test/config/config.test.ts` 108 pass
- [x] 3.2 把选定的对照方式写入 `docs/操作手册/上游同步操作流程.md`，如需则更新 `scripts/sync-opencode-upstream.ps1`
  - 新增第 7 步"对照验证"；同时修正第 1、2 步：补 `git remote add upstream`，合并目标改为明确的版本 tag，并说明 `upstream/dev` 已是 2.x
  - 脚本无需修改：`-Mode Prepare` 会校验拉取结果与 `-UpstreamCommit` 一致，不会误合并 `dev`

## 4. v1.19.x 影响评估

- [x] 4.1 添加 `upstream` remote 并 fetch tags，确认目标版本（最新 v1.19.x）的精确 SHA
  - v1.19.5 = `810c0eba1a`（2026-10-28）。另发现 upstream 自 2026-09-11 起并行维护 2.x 主线，最新 v2.2.7 = `fedc6f208a`（2026-11-10），`upstream/dev` 属于 2.x
- [x] 4.2 运行 `-Mode Plan` 生成三组 diff 与潜在冲突清单；人工标注触及 Product Default Review 与 Cross-Host Product Contract Review 的变更，以及 C-001/C-002/C-009/C-017 瘦身成果可能被回退的文件
  - `-Mode Plan` 只输出分支与 HEAD 信息，不生成 diff；改用 `git diff` 计算三组文件集合，并用 `git merge-tree --write-tree` 内存试合并得到真实冲突：v1.19.5 为 14 个，v2.2.7 为 208 个
- [x] 4.3 在 `docs/阶段记录/` 输出影响评估报告，给出建议的同步时机与风险，交维护者决策是否开启同步 change
  - `docs/阶段记录/专项_上游同步影响_20261113.md`：建议同步 v1.19.5，但须先定案更新检查与 OpenCode 2.0 推销的处理（5.1）；v2.2.7 单独立项

## Workflow follow-up

- 实际合并 upstream 作为独立 change 执行，遵循 `docs/规范/上游同步工作流总纲.md`。
