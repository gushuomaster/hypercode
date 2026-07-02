# Docs Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `docs/` into `规范` / `操作手册` / `阶段记录`, move historical report files into the new `阶段记录` bucket, and refresh `docs/README.md` so maintainers can navigate the new structure.

**Architecture:** Keep the existing long-lived rules in `规范` and executable SOPs in `操作手册`, then merge the current `报告` and `归档` content into a single `阶段记录` directory for dated project progress and evidence. Leave `docs/superpowers` untouched as implementation metadata, not maintainer-facing project documentation.

**Tech Stack:** Markdown, PowerShell, Git

## Global Constraints

- 先调整目录结构和索引，再决定是否统一重命名
- 移动文件时不改写正文结论，避免把历史记录误改成当前规范
- 若某篇文档同时具有“结论”和“规则”属性，以文档主要用途为准
- `品牌化审计基线` 视为阶段性判断，不作为长期规范保留
- `品牌化完成报告` 视为阶段性结果，不单独保留 `报告` 目录
- 不重写各篇文档正文
- 不补充新的上游同步结论
- 不建立更细的 ADR、RFC 或知识库体系
- 不调整仓库根目录面向外部用户的 README 结构

---

## File Structure

- Keep: `docs/规范/上游同步工作流总纲.md`
- Keep: `docs/规范/上游同步与品牌化规范.md`
- Keep: `docs/操作手册/上游同步操作流程.md`
- Keep: `docs/操作手册/构建与交付规范.md`
- Keep: `docs/superpowers/specs/2026-07-02-docs-organization-design.md`
- Keep: `docs/superpowers/plans/2026-07-02-docs-organization.md`
- Create: `docs/阶段记录/`
- Move: `docs/报告/品牌化审计基线.md` -> `docs/阶段记录/品牌化审计基线.md`
- Move: `docs/报告/品牌化完成报告.md` -> `docs/阶段记录/品牌化完成报告.md`
- Move: `docs/归档/阶段性汇报_20260616.md` -> `docs/阶段记录/阶段性汇报_20260616.md`
- Move: `docs/归档/上游同步影响报告_20260611.md` -> `docs/阶段记录/上游同步影响报告_20260611.md`
- Modify: `docs/README.md`
- Delete: `docs/报告/`
- Delete: `docs/归档/`

### Task 1: Merge historical docs into `阶段记录`

**Files:**
- Create: `docs/阶段记录/`
- Modify: `docs/报告/品牌化审计基线.md` -> `docs/阶段记录/品牌化审计基线.md`
- Modify: `docs/报告/品牌化完成报告.md` -> `docs/阶段记录/品牌化完成报告.md`
- Modify: `docs/归档/阶段性汇报_20260616.md` -> `docs/阶段记录/阶段性汇报_20260616.md`
- Modify: `docs/归档/上游同步影响报告_20260611.md` -> `docs/阶段记录/上游同步影响报告_20260611.md`
- Test: `rg --files docs`

**Interfaces:**
- Consumes: existing maintainer-facing docs currently split across `docs/报告/` and `docs/归档/`
- Produces: a single directory contract where phase-specific records live under `docs/阶段记录/<filename>.md`

- [ ] **Step 1: Capture the pre-move docs inventory**

```powershell
rg --files docs
```

Expected: output still includes `docs/报告/*.md`, `docs/归档/*.md`, `docs/README.md`, and `docs/superpowers/*`.

- [ ] **Step 2: Create the new `阶段记录` directory**

```powershell
New-Item -ItemType Directory -Path 'docs/阶段记录' -Force
```

Expected: PowerShell prints the created directory or reuses the existing one without error.

- [ ] **Step 3: Move the historical docs without editing their contents**

```powershell
Move-Item -LiteralPath 'docs/报告/品牌化审计基线.md' -Destination 'docs/阶段记录/品牌化审计基线.md'
Move-Item -LiteralPath 'docs/报告/品牌化完成报告.md' -Destination 'docs/阶段记录/品牌化完成报告.md'
Move-Item -LiteralPath 'docs/归档/阶段性汇报_20260616.md' -Destination 'docs/阶段记录/阶段性汇报_20260616.md'
Move-Item -LiteralPath 'docs/归档/上游同步影响报告_20260611.md' -Destination 'docs/阶段记录/上游同步影响报告_20260611.md'
```

Expected: all four commands complete with no overwrite prompt and no content changes.

- [ ] **Step 4: Verify the new directory layout**

```powershell
rg --files docs/阶段记录
Get-ChildItem 'docs' -Directory | Select-Object -ExpandProperty Name
```

Expected: `docs/阶段记录` contains the four moved Markdown files, and `docs/superpowers` is still present alongside `规范`, `操作手册`, `报告`, `归档`, and `阶段记录`.

- [ ] **Step 5: Commit the directory merge**

```bash
git add docs/阶段记录 docs/报告 docs/归档
git commit -m "docs: merge records into stage tracking"
```

Expected: Git records the file moves without unrelated files staged.

### Task 2: Rewrite `docs/README.md` for the three-bucket structure

**Files:**
- Modify: `docs/README.md:1-45`
- Test: `docs/README.md`

**Interfaces:**
- Consumes: the new `docs/阶段记录/*.md` paths from Task 1
- Produces: a maintainer-facing index that links only to `规范`, `操作手册`, and `阶段记录`

- [ ] **Step 1: Replace the old four-category README with the new navigation copy**

```markdown
# HyperCode 文档索引

本目录收录 HyperCode（基于 OpenCode 的品牌化 fork）面向维护者与接手人的工程文档。

## 先看什么

- 想理解长期有效的规则、边界和禁止事项，先看 [规范](规范/)
- 想执行一次上游同步、构建或交付流程，先看 [操作手册](操作手册/)
- 想回溯项目推进过程、阶段结论和关键证据，查看 [阶段记录](阶段记录/)

## 📐 规范

长期有效的原则与判断依据，回答“什么能做、什么不能做、为什么这样做”。

- [上游同步工作流总纲](规范/上游同步工作流总纲.md) — 自动 upstream sync 的完整闭环：读状态 → 隔离 worktree → 合并上游 → 三组 diff 影响分析 → 报告 → 人工决策。
- [上游同步与品牌化规范](规范/上游同步与品牌化规范.md) — 差异维护原则、可脚本化边界、禁止被上游恢复的项、高风险冲突文件清单。

## 🛠 操作手册

当前可直接执行的步骤、命令与检查项。

- [上游同步操作流程](操作手册/上游同步操作流程.md) — upstream 同步 SOP：同步前检查 → merge → 冲突处理 → rebrand → 构建 → VSIX 验收。
- [构建与交付规范](操作手册/构建与交付规范.md) — CLI 二进制与 VSIX 的构建命令、smoke test、产物命名约定。

## 🗂 阶段记录

带日期背景的阶段结论、项目进展和证明材料。新增记录优先使用 `主题_YYYYMMDD.md` 命名，避免覆盖旧结论。

- [品牌化审计基线](阶段记录/品牌化审计基线.md) — 品牌化前的基线审计：opencode 引用按风险分级（A/B/C），用于说明全局替换边界。
- [品牌化完成报告](阶段记录/品牌化完成报告.md) — 品牌化阶段完成情况：已覆盖范围、保留的 OpenCode 引用及理由。
- [阶段性汇报_20260616](阶段记录/阶段性汇报_20260616.md) — 2026-06-16 项目进度快照：CI 闭环状态、下一步优先级。
- [上游同步影响报告_20260611](阶段记录/上游同步影响报告_20260611.md) — 2026-06-11 一次隔离 worktree 同步验证的结果：三组 diff 数据、24 个真实受影响文件、VSIX 验收结果。

---

## 阅读路径

| 我要做的事 | 看这些 |
| --- | --- |
| 第一次接手 upstream sync | 先读 [工作流总纲](规范/上游同步工作流总纲.md)，再读 [同步与品牌化规范](规范/上游同步与品牌化规范.md) |
| 执行一次 upstream sync | 按 [上游同步操作流程](操作手册/上游同步操作流程.md) 执行，冲突时查 [同步与品牌化规范](规范/上游同步与品牌化规范.md) |
| 构建 CLI / VSIX | [构建与交付规范](操作手册/构建与交付规范.md) |
| 回溯品牌化阶段结论 | [品牌化审计基线](阶段记录/品牌化审计基线.md) + [品牌化完成报告](阶段记录/品牌化完成报告.md) |
| 回溯某次同步或阶段进展 | [阶段记录](阶段记录/) 下带日期的文档 |
```

Write the file with `apply_patch` so the entire `docs/README.md` content matches the block above.

- [ ] **Step 2: Verify the new links and wording**

```powershell
rg -n "报告|归档|阶段记录|先看什么|阅读路径" docs/README.md
```

Expected: the README contains `阶段记录`, `先看什么`, and `阅读路径`, and no links remain to `报告/` or `归档/`.

- [ ] **Step 3: Commit the README rewrite**

```bash
git add docs/README.md
git commit -m "docs: refresh docs index"
```

Expected: Git records only the README navigation update.

### Task 3: Remove the obsolete empty folders and run final verification

**Files:**
- Modify: `docs/报告/` (remove empty directory)
- Modify: `docs/归档/` (remove empty directory)
- Test: `rg --files docs`, `git status --short`

**Interfaces:**
- Consumes: the completed file moves from Task 1 and README links from Task 2
- Produces: the final maintainer-facing docs structure with no stale top-level buckets

- [ ] **Step 1: Confirm both legacy directories are empty**

```powershell
Get-ChildItem 'docs/报告' -Force
Get-ChildItem 'docs/归档' -Force
```

Expected: both commands print no child files.

- [ ] **Step 2: Remove the empty legacy directories**

```powershell
Remove-Item -LiteralPath 'docs/报告'
Remove-Item -LiteralPath 'docs/归档'
```

Expected: both directories are removed without touching `docs/superpowers`, `docs/规范`, `docs/操作手册`, or `docs/阶段记录`.

- [ ] **Step 3: Run the final docs inventory check**

```powershell
rg --files docs
Get-ChildItem 'docs' -Directory | Select-Object -ExpandProperty Name
git status --short docs
```

Expected: the docs tree shows `规范`, `操作手册`, `阶段记录`, and `superpowers`; all moved files now live under `docs/阶段记录`; Git shows the expected renames plus the README update.

- [ ] **Step 4: Commit the cleanup**

```bash
git add docs
git commit -m "docs: finalize docs structure cleanup"
```

Expected: Git records the empty-directory removal and leaves unrelated workspace changes unstaged.
