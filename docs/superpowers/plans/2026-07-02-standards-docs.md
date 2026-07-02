# Standards Docs Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the two documents under `docs/规范` so `上游同步工作流总纲.md` becomes a workflow-level rules document and `上游同步与品牌化规范.md` becomes a difference-maintenance rules document, while removing time-sensitive facts from the norms layer.

**Architecture:** Keep both files, but rewrite them around long-lived rules instead of historical runtime context. The workflow spec will define stages, status, stop conditions, and outputs; the difference-maintenance spec will define preservation rules, forbidden regressions, risk surfaces, and review boundaries. Historical hashes, stats, and one-off scans are removed or downgraded so `规范` remains stable and `阶段记录` remains the home for dated evidence.

**Tech Stack:** Markdown, PowerShell, Git

## Global Constraints

- 保留 `上游同步工作流总纲.md` 与 `上游同步与品牌化规范.md` 两篇文档
- 重新定义两篇文档的职责
- 重排章节结构，使其更像长期有效的规则文档
- 把不稳定的路径、commit、hash、统计数字和历史扫描结果从“规范”中降级为“阶段记录”信息
- `上游同步工作流总纲.md` 负责流程制度、状态、输出、停止条件和正式合入边界
- `上游同步与品牌化规范.md` 负责差异维护原则、保留项、禁止恢复项、高风险冲突面和判断边界
- 不重写 `操作手册` 目录的内容
- 不重做 `阶段记录` 文档的正文
- 不建立新的 ADR / RFC 体系
- 不引入新的同步策略或新的工程流程
- 不补做当前仓库的历史审计数据

---

## File Structure

- Keep: `docs/superpowers/specs/2026-07-02-standards-docs-design.md`
- Keep: `docs/superpowers/plans/2026-07-02-standards-docs.md`
- Modify: `docs/规范/上游同步工作流总纲.md`
- Modify: `docs/规范/上游同步与品牌化规范.md`

### Task 1: Rewrite `上游同步工作流总纲.md` as the workflow-level norm

**Files:**
- Modify: `docs/规范/上游同步工作流总纲.md`
- Test: `docs/规范/上游同步工作流总纲.md`

**Interfaces:**
- Consumes: the existing workflow logic, status model, report requirements, and isolation rules already present in `docs/规范/上游同步工作流总纲.md`
- Produces: a workflow-level norm with these section anchors: `文档目的与边界`, `核心原则`, `隔离执行原则`, `标准工作流阶段`, `影响分析口径`, `自动化停止条件`, `输出物要求`, `状态分类`, `正式合入边界`

- [ ] **Step 1: Snapshot the current section structure**

```powershell
rg -n "^## " "docs/规范/上游同步工作流总纲.md"
```

Expected: output shows the older numbered sections including `项目目标`, `固定目录`, `禁止操作`, `自动同步流程`, `三组 diff 影响分析`, `HyperCode 产品化保护规则`, `自动工程验证`, `生成测试 VSIX`, `证明 upstream 更新已融入隔离测试版本`, `自动生成报告`, `自动提交规则`, `最终输出格式`, `状态分类`, and `人工验收后正式合入流程`.

- [ ] **Step 2: Replace the document with the new workflow-level structure**

Use `apply_patch` so the entire file content becomes:

```markdown
# HyperCode 上游同步工作流总纲

## 文档目的与边界

本文档定义 HyperCode 执行 upstream sync 时的长期有效工作流规则。

它负责说明：

- upstream sync 为什么必须隔离执行
- 自动化可以推进到什么程度
- 哪些情况必须停下来交给人工判断
- 应输出哪些结果、状态和报告
- 何时允许讨论正式合入

它不负责：

- 充当一次具体同步任务的执行剧本
- 固定某个时间点的目录、路径、commit 或 hash
- 替代 `docs/操作手册/上游同步操作流程.md` 中的具体执行步骤

## 核心原则

HyperCode 执行 upstream sync 时，长期适用以下原则：

1. 用户看到的产品必须保持 HyperCode，而不是 opencode。
2. HyperCode 已有的品牌化、自定义功能和扩展增强能力不能被 upstream 覆盖掉。
3. upstream 更新应尽量吸收，但只能做最小兼容适配。
4. 无法自动兼容或涉及产品取舍时，必须停止并列为人工决策点。
5. 不允许污染正式主线。
6. 不允许自动发布。
7. 不允许在未完成人工验收前宣称正式主线已同步。

## 隔离执行原则

所有 upstream sync、merge、适配、构建、报告生成和测试产物输出，都必须在隔离环境中执行。

隔离执行的长期要求：

```txt
必须先记录正式主线状态
必须以正式主线为起点创建隔离 worktree 或等价隔离环境
必须在隔离环境中完成合并、适配、验证和报告
未经过门槛检查前，不允许生成本地验证提交
即使生成了本地验证提交，也不得 push，不得直接合入正式主线
```

在没有明确人工确认前，不允许执行：

```txt
git push
合入正式主线
rebase 正式主线
git tag
自动发布
删除正式归档或历史分支
```

## 标准工作流阶段

一次 upstream sync 的标准阶段如下：

1. 读取正式主线状态
2. 记录 upstream head 与共同基线
3. 创建隔离环境
4. 合并 upstream
5. 做最小兼容适配
6. 执行产品化检查和工程验证
7. 生成测试产物与影响报告
8. 根据结果进入状态分类
9. 人工验收通过后，再讨论正式合入准备

对自动化而言，这些阶段的目标分别是：

- 先建立可追溯基线
- 再判断 upstream 是否真的触及 HyperCode 自定义区
- 最后输出可供人工决策的证据，而不是直接完成正式同步

## 影响分析口径

工作流中必须区分三类变化：

- HyperCode 自定义改动
- upstream 更新
- 当前隔离测试分支中的适配改动

长期有效的判断口径：

```txt
只有同时属于 HyperCode 自定义改动和 upstream 更新交集的文件，才算 upstream 真实影响了 HyperCode 自定义区。
当前适配改动不能自动等同于“真实受影响文件”。
任何适配都必须说明它是在处理交集冲突，还是在处理构建、公开面或兼容性问题。
```

如果工作流要输出影响结论，必须明确区分：

- 未影响
- 可自动吸收
- 需要最小兼容适配
- 必须人工决策

## 自动化停止条件

出现以下情况时，自动化必须停止并转为人工判断：

```txt
无法判断冲突应该保留哪一侧
需要在产品能力之间做取舍
公开入口或产品化公开面出现回退
构建或打包失败且无法通过最小兼容适配修复
需要删除 HyperCode 增强功能才能换取通过
存在未解决冲突
```

如果停止，输出应是阻塞清单和当前证据，而不是继续强行推进。

## 输出物要求

一次合格的隔离同步验证应至少输出以下内容：

- 正式主线、upstream head、共同基线的记录
- 影响分析结果
- 当前适配文件说明
- 产品化公开面检查结果
- 工程验证结果
- 测试产物信息
- upstream 融入证据
- 人工验收清单
- 结论边界说明

如果需要产出报告，报告应回答这些问题：

- upstream 是否有更新
- 是否已在隔离环境合并
- 是否触及 HyperCode 自定义改动
- 是否完成兼容适配
- 是否生成测试产物
- 是否仍有人工决策点
- 是否可以认为正式主线已同步：否，正式主线未同步

## 状态分类

最终状态只能属于以下之一：

### READY_FOR_HUMAN_VSIX

表示：

```txt
隔离同步完成
工程验证通过
测试产物生成成功
产品化公开面未发现失败
等待人工安装与验收
```

### NEEDS_HUMAN_DECISION

表示：

```txt
出现产品取舍
出现无法自动兼容
出现公开面回退
出现构建无法自动修复
```

### NO_UPSTREAM_UPDATE

表示：

```txt
upstream 没有新更新
无需同步
```

### SYNC_FAILED

表示：

```txt
合并、适配、构建、测试产物生成或报告生成失败
且无法自动修复
```

## 正式合入边界

只有当人工明确确认测试产物验收通过时，才允许进入正式合入准备阶段。

正式合入前必须满足：

```txt
隔离同步验证已完成
产品化公开面通过
工程验证通过
测试产物可用
人工验收通过
正式主线尚未被自动改动
```

正式合入准备仍然应发生在独立同步分支，而不是直接改动正式主线。

结论边界：

```txt
隔离测试版本通过，不等于正式主线已同步。
构建通过，不等于手工验收通过。
只有手工验收通过后，才可以讨论正式合入。
```
```

- [ ] **Step 3: Verify the new workflow headings and removed runtime-heavy context**

```powershell
rg -n "^## " "docs/规范/上游同步工作流总纲.md"
rg -n "hypercode-phase4|你现在负责执行|当前正式 HyperCode 封档 commit|状态分类|正式合入边界" "docs/规范/上游同步工作流总纲.md"
```

Expected: the file contains the new workflow-level headings; old task-instruction phrasing and hardcoded runtime paths no longer appear; `状态分类` and `正式合入边界` remain.

- [ ] **Step 4: Commit the workflow norm rewrite**

```bash
git add docs/规范/上游同步工作流总纲.md
git commit -m "docs(规范): rewrite workflow standards"
```

Expected: the commit contains only the `上游同步工作流总纲.md` rewrite.

### Task 2: Rewrite `上游同步与品牌化规范.md` as the difference-maintenance norm

**Files:**
- Modify: `docs/规范/上游同步与品牌化规范.md`
- Test: `docs/规范/上游同步与品牌化规范.md`

**Interfaces:**
- Consumes: the current preservation rules, forbidden regressions, risk files, and automation-vs-human boundary already present in `docs/规范/上游同步与品牌化规范.md`
- Produces: a difference-maintenance norm with these section anchors: `文档目的与边界`, `差异维护原则`, `必须保留的 HyperCode 特性`, `禁止被 upstream 恢复的内容`, `高风险冲突面`, `品牌化与兼容性判断规则`, `可脚本化与人工边界`, `同步后检查项`, `文档使用方式`

- [ ] **Step 1: Snapshot the current section structure**

```powershell
rg -n "^## " "docs/规范/上游同步与品牌化规范.md"
```

Expected: output shows the older numbered structure including `文档目的`, `基线信息`, `当前差异总览`, `差异分组说明`, `差异处理矩阵`, `可脚本化与人工处理边界`, `当前已确认的 HyperCode 自定义提交`, `必须保留的 HyperCode 特色`, `不允许被 upstream 恢复的内容`, `高风险冲突文件`, `后续同步 opencode 的推荐流程`, `同步后的检查命令`, and `文档边界`.

- [ ] **Step 2: Replace the document with the new difference-maintenance structure**

Use `apply_patch` so the entire file content becomes:

```markdown
# HyperCode 上游同步与品牌化规范

## 文档目的与边界

本文档定义 HyperCode 相对 opencode 的差异维护边界，以及 upstream sync 时必须遵守的品牌化与兼容性判断规则。

它负责说明：

- 哪些 HyperCode 特性必须保留
- 哪些内容禁止被 upstream 恢复
- 哪些区域是高风险冲突面
- 哪些检查适合脚本做，哪些必须人工判断

它不负责：

- 固定某次基线 commit、branch、hash 或 diff 统计
- 替代 `docs/操作手册/上游同步操作流程.md` 中的执行步骤
- 充当某次历史扫描或某次历史验证报告

## 差异维护原则

后续维护 HyperCode 与 opencode 差异时，长期遵守以下原则：

1. 用户可见品牌面必须保持 HyperCode。
2. HyperCode 的产品增强层优先保留，不允许被 upstream 默认行为整块覆盖。
3. 内部兼容性标识、第三方依赖名、协议文本和历史兼容字段不能机械替换。
4. 上游改动应尽量吸收，但只能做最小兼容适配。
5. 同名高风险文件一旦两边都改过，必须人工合并。
6. 脚本可以帮助发现和重放，但不能替代产品判断。

## 必须保留的 HyperCode 特性

未来同步 upstream 时，以下内容默认属于必须保留的 HyperCode 特性：

- `hypercode.*` 命令体系
- `hypercode.cliPath`
- `hypercode.httpProxy`
- 增强版 VS Code 扩展
- Activity Bar 容器
- Sessions 树
- Todo / Modified Files / Subagents / Session 视图
- Session Webview Panel
- workspace runtime 启动模型
- 无 license 门禁的通用版行为
- `sdks/vscode/README.md` 中完整 HyperCode 集成描述

如果 upstream 改动触及这些区域，默认优先保留 HyperCode 现有产品能力。

## 禁止被 upstream 恢复的内容

以下内容属于明确禁止恢复项：

- `hypercode.openLicenseFile`
- `src/license/*`
- 启动前 license 授权阻断
- 授权测试
- README 中以旧终端启动器为中心的描述
- 公开入口退回 `opencode.*` 旧命名

这些内容不是“可选差异”，而是反回归边界。

## 高风险冲突面

以下区域在未来 upstream sync 时默认视为高风险冲突面：

- 根级品牌与元数据：`README.md`、`package.json`
- CLI 与配置边界：`packages/opencode/src/cli/*`、`packages/opencode/src/config/*`
- TUI 用户可见区域：`packages/tui/src/*`
- VS Code 扩展公开面：`sdks/vscode/package.json`、`sdks/vscode/README.md`
- VS Code 扩展产品层：`sdks/vscode/src/*`
- VS Code 扩展构建层：`sdks/vscode/esbuild.js`、`sdks/vscode/tsconfig.json`、`sdks/vscode/.vscodeignore`
- 依赖与锁文件：`bun.lock`、`sdks/vscode/bun.lock`

如果 upstream 与 HyperCode 同时改到这些区域，必须人工三方比对，不允许整块覆盖。

## 品牌化与兼容性判断规则

### 用户可见品牌面

以下内容必须保持 HyperCode 化：

- 用户可见品牌名
- 扩展 displayName / title / description
- Activity Bar / views / panels 的产品命名
- 对外命令主入口
- 对外配置主入口

### 公开入口与内部技术名

判断规则：

```txt
公开 command 主入口必须是 hypercode.*
公开 configuration 主入口必须是 hypercode.*
内部技术名、依赖名、兼容字段和部分历史路径可以保留 opencode，但必须有明确理由
不能机械把所有 opencode 命中都当成问题
```

### 构建与依赖

判断规则：

```txt
锁文件由包管理器再生成，不手工品牌化
构建脚本和打包入口若与 upstream 同名冲突，必须人工合并
不能为了通过构建删除 HyperCode 产品能力
```

## 可脚本化与人工边界

### 可以脚本化的内容

- 品牌残留扫描
- 禁止恢复项扫描
- 公开命令与配置命名扫描
- 构建命令执行与结果检查
- 测试产物是否生成

### 必须人工处理的内容

- 同名文件冲突合并
- 产品能力是否应保留或取舍
- UI 和交互体验是否符合预期
- README 是否仍准确表达产品叙事
- 兼容字段、第三方名词和协议文本是否应保留
- “构建通过但功能不可用”的问题判断

### 使用原则

```txt
脚本负责发现问题、统计差异、辅助重放和执行构建
人工负责判断差异含义、处理冲突、验收产品行为
任何基于单次扫描得出的结论，都不应直接写成长期规范事实
```

## 同步后检查项

一次 upstream sync 之后，至少应检查以下类型的问题：

### 品牌残留检查

- 用户可见文案是否退回 opencode
- 对外命令和设置名是否退回旧命名
- 扩展描述和产品叙事是否退回旧终端启动器口径

### 禁止恢复项检查

- 是否重新出现授权入口
- 是否重新出现授权阻断
- 是否重新出现授权测试

### 扩展公开面检查

- `hypercode.*` 命令是否仍可见
- `hypercode.cliPath` / `hypercode.httpProxy` 是否仍保留
- Activity Bar / Sessions / Todo / Modified Files / Subagents / Session Panel 是否仍存在

### 构建与交付检查

- 扩展构建是否通过
- 打包是否通过
- 产物是否生成

详细命令和具体验收步骤统一按 `docs/操作手册` 中的文档执行。

## 文档使用方式

使用这份文档时，应遵守以下分工：

- 要理解流程制度、状态和输出要求，查看 [上游同步工作流总纲](上游同步工作流总纲.md)
- 要执行具体同步步骤，查看 [上游同步操作流程](../操作手册/上游同步操作流程.md)
- 要执行构建与产物验收，查看 [构建与交付规范](../操作手册/构建与交付规范.md)
- 要查看某次具体基线、某次 diff、某次历史扫描或验证证据，应查看 `阶段记录`
```

- [ ] **Step 3: Verify the new maintenance headings and removed time-sensitive facts**

```powershell
rg -n "^## " "docs/规范/上游同步与品牌化规范.md"
rg -n "b4067cf|0050134d|752a64e|feature/vscode-extension-integration|BASE..HEAD|阶段记录|docs/操作手册" "docs/规范/上游同步与品牌化规范.md"
```

Expected: the file contains the new maintenance-level headings; historical hashes, old branch facts, and `BASE..HEAD` evidence language are gone; links to `阶段记录` and `docs/操作手册` remain.

- [ ] **Step 4: Commit the maintenance norm rewrite**

```bash
git add docs/规范/上游同步与品牌化规范.md
git commit -m "docs(规范): rewrite maintenance standards"
```

Expected: the commit contains only the `上游同步与品牌化规范.md` rewrite.

### Task 3: Verify the boundary between `规范`, `操作手册`, and `阶段记录`

**Files:**
- Modify: `docs/规范/上游同步工作流总纲.md`
- Modify: `docs/规范/上游同步与品牌化规范.md`
- Test: `docs/规范/上游同步工作流总纲.md`, `docs/规范/上游同步与品牌化规范.md`

**Interfaces:**
- Consumes: the rewritten workflow norm from Task 1 and the rewritten maintenance norm from Task 2
- Produces: a pair of standards docs that clearly defer execution steps to `docs/操作手册` and historical evidence to `阶段记录`

- [ ] **Step 1: Check the standards docs for stale runtime-heavy facts**

```powershell
rg -n "hypercode-phase4|hypercode-upstream-sync-test|feature/vscode-extension-integration|b4067cf|0050134d|752a64e|313|50004|581" "docs/规范/上游同步工作流总纲.md" "docs/规范/上游同步与品牌化规范.md"
```

Expected: no output. The standards docs should no longer embed hardcoded paths, branch names, hashes, or dated diff statistics.

- [ ] **Step 2: Check the standards docs for correct cross-boundary references**

```powershell
rg -n "操作手册|上游同步操作流程|构建与交付规范|阶段记录" "docs/规范/上游同步工作流总纲.md" "docs/规范/上游同步与品牌化规范.md"
```

Expected: `上游同步与品牌化规范.md` points readers to `操作手册` and `阶段记录`; `上游同步工作流总纲.md` stays focused on rules and does not expand into a command-by-command manual.

- [ ] **Step 3: Run the final standards inventory check**

```powershell
rg -n "^## " "docs/规范/上游同步工作流总纲.md" "docs/规范/上游同步与品牌化规范.md"
git diff -- "docs/规范/上游同步工作流总纲.md" "docs/规范/上游同步与品牌化规范.md"
git status --short docs/规范
```

Expected: both standards docs show the new structures from the spec, the diff is limited to the two standards files, and Git status reflects only the intended documentation edits.

- [ ] **Step 4: Commit the final boundary pass**

```bash
git add docs/规范/上游同步工作流总纲.md docs/规范/上游同步与品牌化规范.md
git commit -m "docs(规范): finalize standards boundaries"
```

Expected: Git records the final standards cleanup without staging unrelated workspace changes.
