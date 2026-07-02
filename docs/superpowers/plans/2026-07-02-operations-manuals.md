# Operations Manuals Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the two documents under `docs/操作手册` so `上游同步操作流程.md` becomes the primary upstream sync SOP and `构建与交付规范.md` becomes the standalone build-and-delivery manual, with clearer structure, stronger execution guidance, and less duplication.

**Architecture:** Rewrite each manual around a single job to be done: one document for the full upstream sync flow, one document for build and artifact verification. Keep verified commands and technical boundaries intact, but reorganize them into execution-first sections with explicit pass/fail criteria and cross-references instead of duplicated detail.

**Tech Stack:** Markdown, PowerShell, Git

## Global Constraints

- 保留 `上游同步操作流程.md` 与 `构建与交付规范.md` 两篇文档的分工
- 重写两篇文档的内部结构，使其更像可执行 SOP 和交付检查单
- 将重复内容压缩到一处，另一处只保留必要引用或结果要求
- 允许适度调整内容口径与章节顺序，以提升实用性，但不凭空新增未验证流程
- sync 的主流程保留在 `上游同步操作流程.md`
- 品牌检查保留在 `上游同步操作流程.md`
- merge-back 所需的最终通过条件保留在 `上游同步操作流程.md`
- `bun install`、`bun run build --single`、`bun run package`、`vsce package`、CLI 冒烟、VSIX 打包与解包验收保留在 `构建与交付规范.md`
- 不改写 `规范` 目录下的原则文档
- 不新增未被验证过的工程流程
- 不重做 `阶段记录` 中的历史文档
- 不扩展到 `docs/README.md` 之外的全站导航体系
- 不建立单独的故障排查知识库

---

## File Structure

- Keep: `docs/superpowers/specs/2026-07-02-operations-manuals-design.md`
- Keep: `docs/superpowers/plans/2026-07-02-operations-manuals.md`
- Modify: `docs/操作手册/上游同步操作流程.md`
- Modify: `docs/操作手册/构建与交付规范.md`

### Task 1: Rewrite `上游同步操作流程.md` as the primary sync SOP

**Files:**
- Modify: `docs/操作手册/上游同步操作流程.md`
- Test: `docs/操作手册/上游同步操作流程.md`

**Interfaces:**
- Consumes: the current verified commands, conflict rules, rebrand checks, and merge-back gates already present in `docs/操作手册/上游同步操作流程.md`
- Produces: a sync-first manual with these section anchors: `目标与适用范围`, `前置条件`, `一次同步的标准顺序`, `冲突处理原则`, `rebrand 执行与停止条件`, `同步后的验证`, `merge-back 标准`, `绝对禁止事项`, `附：高风险文件与实用检查命令`

- [ ] **Step 1: Snapshot the current section structure**

```powershell
rg -n "^## " "docs/操作手册/上游同步操作流程.md"
```

Expected: output shows the older section order including `项目关系`, `同步前置条件`, `创建同步演练分支`, `合并上游`, `运行加固版 rebrand 脚本`, `品牌检查清单`, `类型检查与 EXE 构建`, `VSIX 构建前置条件`, `VSIX 验证`, `合并回归(merge-back)标准`, `绝对禁止事项`, and `当前已验证结论`.

- [ ] **Step 2: Replace the document with the new SOP structure**

Use `apply_patch` so the entire file content becomes:

```markdown
# HyperCode 上游同步操作流程

本文档是将 OpenCode 上游更新同步进 HyperCode 的主 SOP，面向实际执行同步工作的维护者。

## 目标与适用范围

本文档用于指导一次完整的 upstream sync，覆盖：

- 同步前检查
- 创建同步演练分支
- 合并 upstream
- 冲突处理
- rebrand
- 品牌检查
- 同步后的关键验证
- merge-back 判断

执行本流程时，默认仓库关系如下：

```txt
origin   = HyperCode 私有仓库
upstream = OpenCode 上游仓库
```

```txt
origin   https://github.com/gushuomaster/hypercode.git
upstream https://github.com/anomalyco/opencode.git
```

约束：

```txt
禁止向 upstream 推送。
upstream 推送必须始终处于禁用状态。
```

## 前置条件

在开始任何上游同步之前，先回到正式主线并确认工作区干净：

```powershell
cd D:\project\hypercode

git switch dev
git pull origin dev
git status --short --untracked-files=all
```

通过标准：

```txt
dev 必须干净
无 release 产物
无 dist
无 node_modules
无 .opencode.old
无未提交的源码改动
```

如果不满足以上条件，先清理现场，不要直接开始同步。

## 一次同步的标准顺序

### 1. 获取 upstream 最新状态并创建演练分支

务必先 fetch upstream，并以 upstream HEAD 对应分支作为唯一可信来源。

```powershell
cd D:\project\hypercode

git fetch upstream
git remote show upstream
git switch dev

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
git switch -c "sync-drill/opencode-upstream-$stamp"
```

当前已验证的 upstream 默认分支：

```txt
dev
```

### 2. 合并 upstream

```powershell
git merge upstream/dev
```

如果没有冲突，进入后续检查和 rebrand 阶段。

如果发生冲突，立即按下文的冲突处理原则逐个分析，不要直接中止。

### 3. 运行 rebrand 脚本

先执行 dry-run：

```powershell
cd D:\project\hypercode

node scripts/rebrand-opencode-to-hypercode.mjs --dry-run --report
```

优先关注以下标签：

```txt
protected
manual-check-required
patchable
```

只有当 dry-run 结果合理时，才允许执行写入：

```powershell
node scripts/rebrand-opencode-to-hypercode.mjs --write --report
```

### 4. 做品牌检查

merge 与 rebrand 完成后，检查以下用户可见品牌点：

```txt
CLI help 显示 HyperCode
CLI 副标题显示 AI coding agent
TUI 不显示 opencode 顶部 logo
TUI 不显示 OpenCode Zen
provider.id 仍为 opencode
provider 显示名为 HyperCode Zen
VSCode 扩展 name 为 hypercode
VSCode displayName 为 HyperCode
VSCode description 为 HyperCode for VS Code
VSCode 启动命令为 hypercode --port
VSIX 文件名为 hypercode.vsix
Windows dist 为 hypercode-windows-x64
exe 为 hypercode.exe
HYPERCODE_* 优先
OPENCODE_* 回退仍然可用
```

### 5. 完成同步后的关键验证

验证阶段至少应覆盖以下结果：

```txt
类型检查通过
CLI build --single 通过
EXE help/version 验证通过
VSIX 依赖准备完成
VSIX package 通过
VSIX 解包检查通过
```

详细构建与交付命令统一按 [构建与交付规范](构建与交付规范.md) 执行。

## 冲突处理原则

发生冲突时：

```txt
不要立即中止 (abort)。
不要推送。
先逐个分析每一个冲突文件。
```

冲突解决规则：

```txt
1. 保留上游的功能性改动
2. 保留 HyperCode 用户可见的品牌
3. 保留内部 opencode 兼容性
4. 不要修改 @opencode-ai/*
5. 不要重命名 packages/opencode
6. 不要改动 provider id = opencode
7. 不要移除 opencode CLI 兼容入口
8. 保留 OPENCODE_* 回退行为
```

## rebrand 执行与停止条件

dry-run 合理时才允许写入。

如果脚本计划修改以下内容，立即停止：

```txt
@opencode-ai/*
provider id
opencode.* command id
OPENCODE_* fallback
```

结论边界：

```txt
加固版 rebrand 脚本适合用于 dry-run 审计和低风险的用户可见补丁。
高风险的业务源码品牌点仍需人工检查 (manual-check-required)。
```

## 同步后的验证

### 品牌残留检查

实用搜索命令：

```powershell
rg -n "opencode --port|OpenCode Zen|opencode for VS Code|opencode\.vsix|opencode-windows|opencode\.exe|ghcr.io/anomalyco/opencode|docker run -it --rm ghcr.io/anomalyco/opencode" packages sdks README.md docs scripts .github
```

将匹配项分类为：

```txt
用户可见残留:必须修复
内部兼容项:允许保留
上游署名 (attribution):应当保留
发布生态 / 发布后项:单独跟踪
测试 / fixture 项:改动前先分类
```

### 构建与交付验证

按 [构建与交付规范](构建与交付规范.md) 执行以下验证：

- CLI 构建
- CLI 冒烟测试
- VSIX 依赖准备
- VSIX 打包
- VSIX 解包验收

只有以上步骤都通过，才允许进入 merge-back 判断。

## merge-back 标准

只有当以下所有条件都满足时，才考虑将同步分支 merge 回 `dev`：

```txt
所有冲突已解决
rebrand dry-run/write 没有误写内部项
bun turbo typecheck 通过
packages/opencode bun typecheck 通过
build --single 通过
exe help/version 通过
VSIX package 通过
品牌检查通过
手动 exe + VSIX 验收通过
```

在任何 merge-back 之前：

```powershell
git status --short --untracked-files=all
```

确认不存在：

```txt
node_modules
dist
release-artifacts
zip/exe/vsix/SHA
.opencode.old
```

## 绝对禁止事项

```txt
不要全局替换 opencode -> hypercode
不要修改 @opencode-ai/*
不要重命名 packages/opencode
不要改动 provider id
不要移除 opencode CLI 兼容入口
不要移除 OPENCODE_* 回退
不要移除 .opencode 回退
不要向 upstream 推送
不要 force push
不要把 sync-drill 分支直接提升为 release 分支
不要提交 node_modules / dist / release 产物
```

## 附：高风险文件与实用检查命令

以下文件在一次真实的上游同步演练中已经发生过冲突，应仔细审查：

```txt
packages/core/src/flag/flag.ts
packages/opencode/src/cli/logo.ts
packages/tui/src/app.tsx
packages/tui/src/attention.ts
packages/tui/src/routes/session/index.tsx
sdks/vscode/package.json
```

这些通常涉及：

```txt
CLI logo
TUI 用户可见品牌
flag/env 回退行为
VSCode 扩展元数据
```
```

- [ ] **Step 3: Verify the new SOP headings and cross-reference**

```powershell
rg -n "^## " "docs/操作手册/上游同步操作流程.md"
rg -n "构建与交付规范|merge-back|manual-check-required|绝对禁止事项" "docs/操作手册/上游同步操作流程.md"
```

Expected: the new section list matches the design, and the file now references `构建与交付规范.md` instead of duplicating the full build guide.

- [ ] **Step 4: Commit the SOP rewrite**

```bash
git add docs/操作手册/上游同步操作流程.md
git commit -m "docs(操作手册): rewrite upstream sync sop"
```

Expected: the commit contains only the `上游同步操作流程.md` rewrite.

### Task 2: Rewrite `构建与交付规范.md` as the standalone build manual

**Files:**
- Modify: `docs/操作手册/构建与交付规范.md`
- Test: `docs/操作手册/构建与交付规范.md`

**Interfaces:**
- Consumes: the build commands and artifact paths already present in `docs/操作手册/构建与交付规范.md`, plus the expectation from Task 1 that sync verification references this file for detailed build steps
- Produces: a standalone build manual with these section anchors: `目标与产物范围`, `构建前提`, `CLI 构建`, `CLI 冒烟与通过标准`, `VSIX 依赖准备`, `VSIX 打包`, `VSIX 验收`, `产物清单`, `兼容性保留项`, `常见失败信号`

- [ ] **Step 1: Snapshot the current section structure**

```powershell
rg -n "^## " "docs/操作手册/构建与交付规范.md"
```

Expected: output shows the older compact structure with `当前范围`, `暂不在范围内`, `CLI 构建`, `CLI 产物`, `CLI 冒烟测试`, `VSIX 构建`, `VSIX 产物`, and `为兼容性保留`.

- [ ] **Step 2: Replace the document with the new build-and-delivery structure**

Use `apply_patch` so the entire file content becomes:

```markdown
# HyperCode 构建与交付规范

本文档用于指导 HyperCode 的 CLI 与 VSIX 构建、冒烟验证和产物验收。

## 目标与产物范围

当前纳入本手册范围的产物：

- Windows CLI 二进制
- VSCode VSIX

当前不在本手册范围内：

- npm
- Homebrew
- AUR
- Nix
- 源码安装分发
- Marketplace 自动化重写

## 构建前提

执行构建前，先确认：

```txt
仓库处于可工作的源码状态
不把旧的 dist / release 产物当作本次构建结果
需要构建 VSIX 时，明确 sdks/vscode 不属于根 workspace
```

VSIX 特别说明：

```txt
不要假定根目录的 bun install 会准备好 VSCode 扩展依赖。
在打包 VSIX 之前，必须先进入 sdks/vscode 单独安装依赖。
```

## CLI 构建

执行：

```powershell
cd D:\project\hypercode\packages\opencode
bun run build --single
```

如果这一步失败，不继续做 CLI 产物验收。

## CLI 冒烟与通过标准

回到仓库根目录验证生成的 EXE：

```powershell
cd D:\project\hypercode

.\packages\opencode\dist\hypercode-windows-x64\bin\hypercode.exe --help
.\packages\opencode\dist\hypercode-windows-x64\bin\hypercode.exe --version
```

通过标准：

```txt
--help 必须显示 HyperCode
--version 必须成功
dist 目录必须为 hypercode-windows-x64
exe 文件必须为 hypercode.exe
```

## VSIX 依赖准备

先安装 `sdks/vscode` 自身依赖：

```powershell
cd D:\project\hypercode\sdks\vscode
bun install
```

如果跳过这一步，常见失败信号包括：

```txt
Cannot find module 'vscode'
Cannot find name 'setTimeout'
Cannot find name 'fetch'
```

## VSIX 打包

在 `sdks/vscode` 下执行：

```powershell
cd D:\project\hypercode\sdks\vscode

bun run package
npx --yes @vscode/vsce package `
  --no-git-tag-version `
  --no-update-package-json `
  --no-dependencies `
  --skip-license `
  -o dist/hypercode.vsix
```

如果打包命令失败，不继续做 VSIX 验收。

## VSIX 验收

解包并检查打包好的 VSIX：

```powershell
Remove-Item -Recurse -Force D:\test\hypercode-vsix-inspect -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force D:\test\hypercode-vsix-inspect

Copy-Item `
  .\sdks\vscode\dist\hypercode.vsix `
  D:\test\hypercode-vsix-inspect\hypercode.zip `
  -Force

Expand-Archive `
  D:\test\hypercode-vsix-inspect\hypercode.zip `
  -DestinationPath D:\test\hypercode-vsix-inspect\unzipped `
  -Force
```

搜索解包后的用户可见残留：

```powershell
rg -n "opencode --port|opencode for VS Code|""title"".*opencode|""category"".*opencode" D:\test\hypercode-vsix-inspect\unzipped
```

通过标准：

```txt
不得存在 opencode --port
不得存在用户可见的 opencode for VS Code
内部 opencode.* command id 可以保留
```

## 产物清单

CLI 产物：

- `packages/opencode/dist/hypercode-windows-x64/bin/hypercode.exe`
- 发布用的 zip/tar 产物名使用 `hypercode-*`

VSIX 产物：

- `sdks/vscode/dist/hypercode.vsix`

## 兼容性保留项

以下内容属于兼容性保留，不应在本手册覆盖的构建交付过程中被顺手改掉：

- `opencode` CLI 别名
- `@opencode-ai/*` 包名
- `packages/opencode` 目录名
- 上游同步脚本与署名归属

## 常见失败信号

遇到以下情况时，视为本轮构建或交付验收未通过：

```txt
CLI build --single 失败
hypercode.exe --help / --version 失败
sdks/vscode 未先 bun install 就开始打包
vsce package 失败
VSIX 解包后仍存在用户可见的 opencode 残留
产物名称不是 hypercode-windows-x64 / hypercode.exe / hypercode.vsix
```
```

- [ ] **Step 3: Verify the new build manual headings and pass/fail sections**

```powershell
rg -n "^## " "docs/操作手册/构建与交付规范.md"
rg -n "通过标准|常见失败信号|VSIX 依赖准备|兼容性保留项" "docs/操作手册/构建与交付规范.md"
```

Expected: the file now contains the new execution-first sections and explicitly documents both pass criteria and failure signals.

- [ ] **Step 4: Commit the build manual rewrite**

```bash
git add docs/操作手册/构建与交付规范.md
git commit -m "docs(操作手册): rewrite build and delivery manual"
```

Expected: the commit contains only the `构建与交付规范.md` rewrite.

### Task 3: Dedupe the two manuals and verify their boundary

**Files:**
- Modify: `docs/操作手册/上游同步操作流程.md`
- Modify: `docs/操作手册/构建与交付规范.md`
- Test: `docs/操作手册/上游同步操作流程.md`, `docs/操作手册/构建与交付规范.md`

**Interfaces:**
- Consumes: the rewritten SOP from Task 1 and the rewritten build manual from Task 2
- Produces: a pair of manuals where sync flow lives in one file, detailed build commands live in the other file, and both documents reference each other only where needed

- [ ] **Step 1: Check the manuals for duplicated build detail**

```powershell
rg -n "bun run build --single|bun install|@vscode/vsce package|hypercode\.vsix|hypercode-windows-x64" "docs/操作手册/上游同步操作流程.md" "docs/操作手册/构建与交付规范.md"
```

Expected: detailed build and packaging commands appear in `构建与交付规范.md`; `上游同步操作流程.md` should keep only final validation requirements and the link to the build manual.

- [ ] **Step 2: Check the manuals for boundary keywords**

```powershell
rg -n "品牌检查|merge-back|绝对禁止事项|构建与交付规范" "docs/操作手册/上游同步操作流程.md"
rg -n "CLI 冒烟与通过标准|VSIX 验收|兼容性保留项|常见失败信号" "docs/操作手册/构建与交付规范.md"
```

Expected: the sync SOP owns brand checks and merge-back gates; the build manual owns smoke tests, packaging validation, compatibility preservation, and failure signals.

- [ ] **Step 3: Run the final manual inventory check**

```powershell
rg -n "^## " "docs/操作手册/上游同步操作流程.md" "docs/操作手册/构建与交付规范.md"
git diff -- "docs/操作手册/上游同步操作流程.md" "docs/操作手册/构建与交付规范.md"
git status --short docs/操作手册
```

Expected: both manuals show the new structures from the spec, the diff is limited to the two manual files, and Git status reflects only the intended documentation edits.

- [ ] **Step 4: Commit the final dedupe pass**

```bash
git add docs/操作手册/上游同步操作流程.md docs/操作手册/构建与交付规范.md
git commit -m "docs(操作手册): finalize manual boundaries"
```

Expected: Git records the final cleanup pass without staging unrelated workspace changes.
