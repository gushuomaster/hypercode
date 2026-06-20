# HyperCode 自动 upstream sync 工作流指令

你现在负责执行 HyperCode 对 opencode upstream 的自动同步验证流程。

目标：

> 自动检测 opencode upstream 更新，隔离合并到 HyperCode 测试 worktree，判断 upstream 是否影响 HyperCode 自定义改动，能兼容的自动做最小适配，不能兼容的列为人工决策点，最后生成影响报告和测试 VSIX。

---

## 一、项目目标

HyperCode 是基于 opencode 的产品化分支。

核心要求：

1. 用户看到的产品必须是 HyperCode，而不是 opencode。
2. HyperCode 已经做过的品牌化、自定义功能、VS Code 扩展增强能力不能被 upstream 同步破坏。
3. opencode upstream 更新应该尽量吸收。
4. 如果 upstream 更新影响 HyperCode 自定义区，优先做最小兼容适配。
5. 如果无法兼容，或涉及产品取舍，必须停止并列为人工决策点。
6. 不允许污染正式 HyperCode 主线。
7. 不允许自动发布。
8. 不允许未经确认合入正式主线。

---

## 二、固定目录

正式 HyperCode 主目录：

```powershell
D:\project\hypercode-phase4
```

旧参考目录：

```powershell
D:\project\hypercode
```

隔离同步测试目录格式：

```powershell
D:\project\hypercode-upstream-sync-test-YYYYMMDD
```

除非明确要求，禁止修改：

```powershell
D:\project\hypercode-phase4
D:\project\hypercode
```

所有 upstream sync、merge、适配、构建、VSIX 生成，都必须在隔离 worktree 中进行。

---

## 三、禁止操作

没有明确人工确认前，不允许执行：

```powershell
git push
git merge 到正式主线
git rebase 正式主线
git tag
发布 marketplace
删除 archive tag
删除 archive branch
修改 D:\project\hypercode
```

在隔离 worktree 中，只有在全部自动门槛通过后，才允许创建本地验证提交。

本地验证提交允许条件：

1. 无未解决冲突
2. 产品化公开面检查通过
3. check-types 通过
4. package 通过
5. VSIX 生成成功
6. 影响报告已生成
7. 没有必须人工决策的阻塞项

即使创建了本地验证提交，也不得 push，不得合入正式主线。

---

## 四、自动同步流程

### 1. 读取正式主线状态

进入正式目录：

```powershell
cd D:\project\hypercode-phase4

git branch --show-current
git rev-parse HEAD
git status --short
git remote -v
```

要求：

* 当前正式目录不能有 tracked dirty changes。
* 如果有 tracked dirty changes，停止并报告。
* untracked 文件只记录，不清理。

记录当前正式 HyperCode commit，定义为：

```powershell
$ARCHIVE="<当前正式 HyperCode 封档 commit>"
```

---

### 2. 确认 opencode base

执行：

```powershell
git fetch upstream
git fetch origin
```

确认：

```powershell
$UPSTREAM_HEAD=(git rev-parse upstream/dev)
$OPENCODE_BASE=(git merge-base $ARCHIVE $UPSTREAM_HEAD)
```

记录：

```powershell
git show -s --format="%H%n%ci%n%s" $OPENCODE_BASE
git show -s --format="%H%n%ci%n%s" $ARCHIVE
git show -s --format="%H%n%ci%n%s" $UPSTREAM_HEAD
```

判断：

* 如果 `$OPENCODE_BASE == $UPSTREAM_HEAD`，说明 upstream 没有新更新，停止并输出“无需同步”。
* 如果 `$OPENCODE_BASE != $UPSTREAM_HEAD`，继续。

---

### 3. 创建隔离 worktree

生成日期：

```powershell
$DATE=(Get-Date -Format "yyyyMMdd")
$WORKTREE="D:\project\hypercode-upstream-sync-test-$DATE"
$BRANCH="test/upstream-sync-$DATE"
```

如果同名目录已存在，追加序号，例如：

```powershell
D:\project\hypercode-upstream-sync-test-YYYYMMDD-2
```

创建：

```powershell
git worktree add -b $BRANCH $WORKTREE $ARCHIVE
```

进入隔离 worktree：

```powershell
cd $WORKTREE
git branch --show-current
git rev-parse HEAD
```

确认：

```text
HEAD == ARCHIVE
```

---

### 4. 合并 upstream

执行：

```powershell
git merge --no-commit --no-ff $UPSTREAM_HEAD
```

如果有冲突，不要中止，先记录：

```powershell
git diff --diff-filter=U --name-only
```

冲突处理规则：

#### 4.1 upstream-only 文件

如果文件只属于 upstream 更新，不属于 HyperCode 自定义改动，优先接受 upstream。

#### 4.2 HyperCode-only 文件

如果文件只属于 HyperCode 自定义改动，保持 HyperCode。

#### 4.3 两边都改过的文件

如果文件同时属于：

```text
OPENCODE_BASE..ARCHIVE
OPENCODE_BASE..UPSTREAM_HEAD
```

定义为真实高风险文件。

处理规则：

```text
保留 HyperCode 产品化公开面
吸收 upstream 新逻辑
做最小兼容适配
不得删除 HyperCode 增强功能
不得把公开入口退回 opencode.*
```

如果无法判断，列为人工决策点，不要强行解决。

---

## 五、三组 diff 影响分析

固定变量：

```powershell
$H = git diff --name-only "$OPENCODE_BASE..$ARCHIVE" | Sort-Object -Unique
$U = git diff --name-only "$OPENCODE_BASE..$UPSTREAM_HEAD" | Sort-Object -Unique

$A1 = git diff --name-only $ARCHIVE
$A2 = git diff --cached --name-only $ARCHIVE
$A = @($A1 + $A2) | Sort-Object -Unique

$Overlap = $U | Where-Object { $_ -in $H }
$OnlyU = $U | Where-Object { $_ -notin $H }
$OnlyH = $H | Where-Object { $_ -notin $U }
$AdaptedOverlap = $Overlap | Where-Object { $_ -in $A }
$TouchedButNotAdapted = $Overlap | Where-Object { $_ -notin $A }
$AdaptedOutsideOverlap = $A | Where-Object { $_ -notin $Overlap }
```

输出数量：

```powershell
"HyperCode custom file count: $($H.Count)"
"Upstream update file count: $($U.Count)"
"Overlap H∩U count: $($Overlap.Count)"
"Current adaptation file count: $($A.Count)"
"Adapted overlap count: $($AdaptedOverlap.Count)"
"Touched but not adapted count: $($TouchedButNotAdapted.Count)"
"Adapted outside overlap count: $($AdaptedOutsideOverlap.Count)"
```

报告中必须说明：

```text
只有 H∩U 才能称为 upstream 真实影响了 HyperCode 自定义改动。
A - H∩U 不能自动解释为受影响文件，必须说明为什么改。
```

---

## 六、HyperCode 产品化保护规则

重点检查：

```text
sdks/vscode/package.json
sdks/vscode/README.md
sdks/vscode/src
packages/opencode
packages/tui
README.md
package.json
```

### 6.1 VS Code 扩展公开面规则

用户可见公开面必须 HyperCode 化。

必须检查：

```text
name
displayName
description
publisher
version
activationEvents
contributes.commands
contributes.configuration
contributes.viewsContainers
contributes.views
contributes.menus
contributes.keybindings
```

判断标准：

```text
公开 command 主入口必须是 hypercode.*
公开 configuration 主入口必须是 hypercode.*
Activity Bar / views / panels 必须保持 HyperCode
displayName / title / description 不应退回 opencode
公开 opencode.* command/configuration/view 不允许作为主入口
内部 dependencies/devDependencies/scripts/import 中的 opencode 技术名可以暂时保留，但必须记录为 INTERNAL_TECHNICAL_NAME_ONLY
```

执行扫描：

```powershell
rg -n '"command"\s*:\s*"opencode\.|"command"\s*:\s*"hypercode\.' sdks/vscode/package.json
rg -n 'opencode\.|hypercode\.' sdks/vscode/package.json
rg -n '"activationEvents"|"viewsContainers"|"views"|"configuration"|"commands"' sdks/vscode/package.json
```

判断只允许使用：

```text
PASS
FAIL
NEEDS_HUMAN_CONFIRMATION
INTERNAL_TECHNICAL_NAME_ONLY
UNCHANGED
```

### 6.2 version / publisher 策略

publisher：

```text
如果封档版本是 HyperCode 发布者，当前版本应保持。
如果退回 upstream 发布者，判定 FAIL。
如果变化但无法判断，NEEDS_HUMAN_CONFIRMATION。
```

version：

```text
测试 VSIX 可以暂时使用当前版本。
正式发布版本号不得自动决定。
如果 version 变化，标记 NEEDS_HUMAN_CONFIRMATION，但不阻塞工程验收。
```

---

## 七、自动工程验证

在隔离 worktree 执行：

```powershell
cd $WORKTREE

bun install
```

如果失败，停止并记录错误。

然后重点验证 VS Code 扩展：

```powershell
cd $WORKTREE\sdks\vscode

bun install
bun run check-types
bun run package
```

如果失败：

1. 判断是否是 upstream API/SDK 漂移导致。
2. 可以做最小兼容适配。
3. 不得删除 HyperCode 功能来换取通过。
4. 修复后重新运行。
5. 如果无法兼容，列为人工决策点。

---

## 八、生成测试 VSIX

在：

```powershell
cd $WORKTREE\sdks\vscode
```

优先检查是否已有 VSIX 脚本：

```powershell
Get-Content package.json
```

如果没有专用脚本，使用：

```powershell
bunx @vscode/vsce package
```

要求：

```text
只生成 .vsix
不发布
不提交
```

查找：

```powershell
Get-ChildItem -Recurse -Filter *.vsix
```

输出：

```text
VSIX 文件路径
VSIX 文件名
安装命令
```

安装命令格式：

```powershell
code --install-extension "<完整路径\文件名.vsix>" --force
```

---

## 九、证明 upstream 更新已融入隔离测试版本

不要只输出文件数量。必须找至少 3 个具体例子。

每个例子必须满足：

```text
OPENCODE_BASE 没有，或内容不同
HyperCode ARCHIVE 没有，或内容旧
UPSTREAM_HEAD 有
当前隔离测试 worktree 有
```

优先找：

```text
新增文件
新增 CLI 参数
新增配置字段
新增用户可见文案
新增 TUI 文案
新增 schema 字段
新增 package script
```

不要优先用 lockfile、hash、纯内部依赖。

### 9.1 找 upstream 新增文件

```powershell
$AddedByUpstream = git diff --name-status "$OPENCODE_BASE..$UPSTREAM_HEAD" |
  Where-Object { $_ -match '^A\s+' } |
  ForEach-Object { ($_ -split '\s+', 2)[1] }

$ExamplesAdded = @()

foreach ($p in $AddedByUpstream) {
  git cat-file -e "$ARCHIVE`:$p" 2>$null
  $existsInArchive = ($LASTEXITCODE -eq 0)

  if (-not $existsInArchive -and (Test-Path $p)) {
    $ExamplesAdded += $p
  }
}

$ExamplesAdded | Select-Object -First 20
```

### 9.2 找用户可见新增内容

```powershell
git diff "$OPENCODE_BASE..$UPSTREAM_HEAD" -- packages/opencode packages/tui sdks/vscode package.json README.md |
  rg -n "^\+.*(--|command|commands|config|configuration|title|label|description|help|usage|view|menu|activation|flag|setting|schema)"
```

对每个候选内容做四方验证：

```powershell
$needle="<具体字符串>"
$p="<文件路径>"

"OPENCODE_BASE contains?"
git show "$OPENCODE_BASE`:$p" 2>$null | Select-String -SimpleMatch $needle

"ARCHIVE contains?"
git show "$ARCHIVE`:$p" 2>$null | Select-String -SimpleMatch $needle

"UPSTREAM_HEAD contains?"
git show "$UPSTREAM_HEAD`:$p" 2>$null | Select-String -SimpleMatch $needle

"CURRENT worktree contains?"
Get-Content $p | Select-String -SimpleMatch $needle
```

输出表格：

```markdown
| 例子 | 类型 | 文件/入口 | OPENCODE_BASE | HyperCode ARCHIVE | UPSTREAM_HEAD | 当前测试 worktree | 结论 |
|---|---|---|---|---|---|---|---|
| 1 | upstream 新增文件 | xxx | 无 | 无 | 有 | 有 | 已融入 |
| 2 | upstream 新增用户可见内容 | xxx | 无 | 无 | 有 | 有 | 已融入 |
| 3 | upstream 新增配置/CLI/schema | xxx | 无 | 无 | 有 | 有 | 已融入 |
```

如果找不到用户可见例子，必须说明只找到内部例子，不能夸大。

---

## 十、自动生成报告

在隔离 worktree 中生成：

```text
docs/hypercode-upstream-sync-impact-YYYYMMDD.md
```

报告必须包含：

```markdown
# HyperCode upstream sync impact report - YYYY-MM-DD

## 1. 结论摘要

- 正式主线是否未受影响
- upstream 是否有更新
- 是否已在隔离 worktree 合并
- 是否触及 HyperCode 自定义改动
- 是否完成兼容适配
- 是否生成 VSIX
- 是否仍有人工决策点
- 是否可以认为正式主线已同步：否，正式主线未同步

## 2. 基线

- OPENCODE_BASE
- ARCHIVE
- UPSTREAM_HEAD
- test worktree
- test branch

## 3. 三组 diff 结果

- H 文件数
- U 文件数
- A 文件数
- H∩U 文件数
- H∩U 文件列表

## 4. 真实影响矩阵

| 文件 | HyperCode 自定义改动？ | upstream 触及？ | 当前适配修改？ | 影响类型 | 当前处理 | 是否需人工决策 |
|---|---|---|---|---|---|---|

影响类型只允许：

- 未影响
- 可自动吸收
- 需要最小兼容适配
- 必须人工决策

## 5. 当前适配文件说明

只说明当前 A 中真实改动过的文件。

## 6. HyperCode 产品化检查

- 是否存在公开 opencode.* command/configuration/view
- 是否保留 hypercode.* command/configuration
- 是否保留 HyperCode Activity Bar / views / panels
- publisher 检查
- version 检查
- 内部 opencode 技术名记录

## 7. 工程验证

- bun install
- bun run check-types
- bun run package
- VSIX 打包命令
- VSIX 文件路径
- VSIX 安装命令

## 8. upstream 融入证据

列出至少 3 个具体例子。

## 9. 人工验收清单

| 验收项 | 结果 | 备注 |
|---|---|---|
| VSIX 能否安装成功 | 未验证 | |
| Activity Bar 是否显示 HyperCode | 未验证 | |
| 命令面板是否能看到 hypercode.* 命令 | 未验证 | |
| hypercode.quickNewSession 是否能打开 Session Panel | 未验证 | |
| 未配置 CLI 时是否提示 hypercode.cliPath | 未验证 | |
| 配置 CLI 后 workspace runtime 是否能启动 | 未验证 | |
| Sessions 树是否能刷新/打开 | 未验证 | |
| Todo 视图是否可用 | 未验证 | |
| Modified Files 视图是否可用 | 未验证 | |
| Subagents 视图是否可用 | 未验证 | |
| Session Panel 是否能正常显示和交互 | 未验证 | |
| 是否没有退回旧终端启动器体验 | 未验证 | |
| 是否没有非预期 opencode 公开入口 | 未验证 | |

## 10. 结论边界

必须明确：

- 当前只是隔离测试版本
- 正式 HyperCode 主线未同步
- 构建通过不等于 VSIX 手工验收通过
- VSIX 手工验收通过后，才可以讨论正式合入
```

---

## 十一、自动提交规则

如果全部条件满足：

```text
无未解决冲突
产品化公开面 PASS 或仅 version NEEDS_HUMAN_CONFIRMATION
check-types 通过
package 通过
VSIX 生成成功
报告生成成功
至少 3 个 upstream 融入例子成立
没有必须人工决策的技术阻塞
```

则允许在隔离测试分支创建本地提交：

```powershell
git add <真实适配文件> docs/hypercode-upstream-sync-impact-YYYYMMDD.md
git commit -m "sync: validate HyperCode against latest opencode upstream"
```

提交前必须输出 staged 文件列表：

```powershell
git diff --cached --name-status
```

禁止提交：

```text
临时对比文件
无关下载文件
extensions.rar
extensions/
个人环境文件
```

提交后输出 commit hash。

注意：

```text
该提交只允许存在于隔离测试分支。
不得 push。
不得 merge 到正式主线。
```

如果存在必须人工决策点，不要提交，只输出阻塞清单。

---

## 十二、最终输出格式

最终输出：

```text
1. 当前分支
2. 当前 HEAD
3. MERGE_HEAD
4. OPENCODE_BASE
5. ARCHIVE
6. UPSTREAM_HEAD
7. H 文件数
8. U 文件数
9. H∩U 文件数
10. A 文件数
11. 是否有未解决冲突
12. 产品化公开面检查结果
13. check-types 是否通过
14. package 是否通过
15. VSIX 是否生成
16. VSIX 文件路径
17. VSIX 安装命令
18. upstream 融入例子数量
19. 是否存在必须人工决策点
20. 是否创建了隔离测试提交
21. 报告路径
22. 是否可以认为正式主线已同步：否，正式主线未同步
23. 下一步建议
```

---

## 十三、状态分类

最终状态只能是以下之一：

### READY_FOR_HUMAN_VSIX

表示：

```text
隔离同步完成
工程验证通过
VSIX 生成成功
产品化公开面未发现失败
等待人工安装 VSIX 验收
```

### NEEDS_HUMAN_DECISION

表示：

```text
出现产品取舍
出现无法自动兼容
出现公开面回退
出现构建无法自动修复
```

### NO_UPSTREAM_UPDATE

表示：

```text
upstream/dev 没有新更新
无需同步
```

### SYNC_FAILED

表示：

```text
合并、适配、构建、VSIX 生成或报告生成失败
且无法自动修复
```

---

## 十四、人工验收后正式合入流程

只有当人工明确回复：

```text
VSIX 手工验收通过，可以准备正式同步分支
```

才允许进入正式合入准备。

正式合入准备仍然不得直接改 dev/main。

应创建正式同步分支：

```powershell
cd D:\project\hypercode-phase4
git checkout feature/vscode-extension-integration
git checkout -b sync/opencode-upstream-YYYYMMDD
```

然后从隔离测试分支整理变更：

```text
优先 cherry-pick 隔离测试提交
或使用经过审核的 patch
```

重新运行：

```powershell
bun install
cd sdks\vscode
bun install
bun run check-types
bun run package
bunx @vscode/vsce package
```

确认通过后，只能提交到正式同步分支，不得直接合回主线，不得发布。

最终仍需人工确认后才可 merge。
