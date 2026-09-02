# HyperCode 功能点详细说明

> 适用对象：AI 应用工程、代码智能体、自动化测试、工程项目改造、CI/CD 辅助、代码仓库维护。  


---

## 1. HyperCode 的整体定位

HyperCode 不是普通聊天机器人，而是面向代码工程的智能体执行框架。

它主要解决的问题是：

```text
自然语言任务
    ↓
理解代码仓库
    ↓
制定计划
    ↓
读取/修改文件
    ↓
执行命令/测试
    ↓
总结结果
```

适合用在：

- 项目代码理解
- 自动化重构
- Bug 修复
- 测试执行
- 代码审查
- 文档生成
- GitHub/GitLab issue 处理
- CI/CD 辅助
- 自定义工程智能体搭建

---

## 2. 多入口使用能力

HyperCode 提供多种使用入口，适合不同工程场景。

| 入口 | 说明 | 适用场景 |
|---|---|---|
| TUI 终端界面 | 在命令行中运行 `HyperCode`，进入交互式终端界面 | 日常开发、项目分析、代码修改 |
| CLI 命令模式 | 使用 `HyperCode run "任务"` 执行一次性任务 | 自动化脚本、CI/CD、批处理 |
| Web 界面 | 使用 `HyperCode web` 启动本地 Web 页面 | 浏览器交互、可视化操作 |
| IDE 插件 | 支持 VS Code、Cursor、Windsurf、VSCodium 等 | 与编辑器上下文结合 |
| Server 模式 | 使用 `HyperCode serve` 启动 HTTP Server | 二次开发、接入自建智能体平台 |

### 2.1 TUI 终端界面

典型使用方式：

```bash
HyperCode
```

进入后可以直接输入：

```text
解释这个项目的结构
帮我找出测试失败的原因
重构这个模块
给这个功能补充单元测试
```

### 2.2 CLI 一次性任务

适合放进脚本或自动化流程：

```bash
HyperCode run "检查当前项目中失败的测试并给出修复建议"
```

可以用于：

- 自动代码审查
- CI 失败原因分析
- 自动生成 changelog
- 自动整理测试报告

### 2.3 Web / Server 模式

`HyperCode web` 适合浏览器使用。

`HyperCode serve` 更适合你做二次开发，例如：

```text
你的平台 / Web UI / 自动化系统
        ↓
调用 HyperCode Server API
        ↓
HyperCode 操作代码仓库
        ↓
返回结果
```

---

## 3. 代码库理解能力

HyperCode 可以读取项目文件、搜索代码、分析目录结构，并结合项目规则执行任务。

### 3.1 文件引用

可以用 `@` 引用文件：

```text
解释 @src/main.py 的执行逻辑
检查 @tests/test_api.py 为什么失败
根据 @docs/spec.md 实现功能
```

作用：

- 精确指定上下文
- 避免模型乱猜项目结构
- 提高代码分析准确性

---

### 3.2 项目初始化 `/init`

执行：

```text
/init
```

HyperCode 会扫描项目，并生成或更新 `AGENTS.md`。

`AGENTS.md` 通常记录：

```text
- 项目结构
- 构建命令
- 测试命令
- 代码风格
- 目录职责
- 注意事项
- Agent 执行约束
```

这类似于给智能体写项目说明书。

---

### 3.3 AGENTS.md 项目规则

`AGENTS.md` 是 HyperCode 的重要机制。

它可以约束 agent 的行为，例如：

```markdown
# Project Rules

## Build
使用 uv 管理 Python 环境。

## Test
运行测试时使用：

```bash
uv run pytest
```

## Constraints
- 禁止修改 data/raw 目录
- 所有新增函数必须有单元测试
- 所有输出文件写入 output 目录
```

对复杂项目非常关键。

尤其适合你的场景：

```text
- 测试技能规程
- ICD/Excel 自动检查
- 报告生成格式约束
```

---

### 3.4 搜索能力

HyperCode 内置代码搜索工具：

| 工具 | 作用 |
|---|---|
| `grep` | 搜索文件内容 |
| `glob` | 按文件路径模式查找文件 |
| `read` | 读取文件内容 |
| `lsp` | 使用语言服务器理解代码结构 |

例如：

```text
查找所有调用 calculate_signal 的地方
找出项目中所有 *.py 文件
分析这个类在哪里被继承
```

---

## 4. 代码修改与执行能力

HyperCode 的核心能力是：不仅能分析代码，还能直接修改代码并运行命令。

| 工具 | 功能 |
|---|---|
| `read` | 读取文件 |
| `edit` | 精确修改已有文件 |
| `write` | 新建或覆盖文件 |
| `apply_patch` | 应用 diff/patch |
| `bash` | 执行 shell 命令 |
| `todowrite` | 维护任务清单 |
| `webfetch` | 抓取网页内容 |
| `websearch` | 搜索网络信息 |
| `question` | 向用户提问确认 |

---

### 4.1 文件读取

用于理解代码：

```text
读取 src/test.py，解释每个函数的作用
```

---

### 4.2 文件修改

可以让它执行：

```text
把这个函数拆成三个更小的函数
修复这个测试失败
给这个模块添加类型注解
```

HyperCode 会直接修改项目文件。

---

### 4.3 执行命令

可以执行：

```bash
pytest
npm test
uv run pytest
git status
python scripts/check.py
```

适合做完整闭环：

```text
修改代码
    ↓
运行测试
    ↓
发现错误
    ↓
继续修复
    ↓
再次运行测试
    ↓
输出总结
```

---

### 4.4 任务清单

复杂任务中，HyperCode 可以维护 todo，例如：

```text
1. 分析现有模块
2. 找出输入输出字段
3. 编写新状态机
4. 增加单元测试
5. 运行测试
6. 生成报告
```

这使它更接近工程 agent，而不是一次性问答模型。

---

## 5. Plan / Build / Subagent 模式

HyperCode 支持不同类型的 agent。

| Agent | 作用 | 是否适合改代码 |
|---|---|---|
| Build | 默认主 agent，执行能力完整 | 是 |
| Plan | 规划分析模式 | 通常不直接改 |
| Explore | 只读项目探索 | 否 |
| Scout | 研究外部依赖或文档 | 否 |
| General | 通用复杂任务子 agent | 视配置而定 |
| Compaction / Summary / Title | 内部上下文维护 agent | 否 |

---

### 5.1 Build 模式

适合真正动手执行：

```text
实现这个功能
修复这个 bug
补充测试
重构这个模块
```

它通常可以：

```text
读文件 → 改文件 → 执行命令 → 跑测试 → 输出结果
```

---

### 5.2 Plan 模式

适合先分析方案：

```text
先不要改代码，分析这个模块应该怎么重构
```

适合用于：

- 技术方案设计
- 模块拆解
- 风险分析
- 改造路径设计
- 生成执行计划

---

### 5.3 Explore 模式

适合只读分析项目：

```text
帮我找出这个项目的数据流从哪里开始到哪里结束
```

适合：

- 新项目快速理解
- 找入口文件
- 找核心模块
- 找测试覆盖范围
- 找配置文件

---

### 5.4 Scout 模式

适合外部依赖研究：

```text
查看这个库的官方用法，判断我项目里是否调用错误
```

适合：

- 研究第三方库
- 查看依赖源码
- 对比官方文档
- 分析 API 变更

---

## 6. 多模型支持

HyperCode 支持多种模型供应商，不绑定某一家模型。

常见可接入方向：

```text
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- 本地模型
- 其他兼容供应商
```

可以做到：

| 功能 | 说明 |
|---|---|
| 多模型切换 | 不同任务选择不同模型 |
| 多供应商接入 | 避免被单一平台绑定 |
| 本地模型支持 | 可接入本地推理模型 |
| 按 agent 指定模型 | Plan、Build、Explore 可使用不同模型 |
| 成本控制 | 简单任务用便宜模型，复杂任务用强模型 |

---

### 6.1 模型选择策略

建议：

| 任务类型 | 推荐模型策略 |
|---|---|
| 简单搜索、解释 | 中低成本模型 |
| 复杂重构 | 强代码模型 |
| 长上下文分析 | 长上下文模型 |
| 测试失败定位 | 强推理模型 |
| 文档整理 | 中等模型即可 |
| 本地隐私项目 | 本地模型或私有部署模型 |

---

## 7. 权限与安全控制

HyperCode 可以控制 agent 的工具权限。

权限一般分为：

| 权限 | 含义 |
|---|---|
| `allow` | 允许直接执行 |
| `ask` | 执行前询问用户 |
| `deny` | 禁止执行 |

---

### 7.1 典型权限配置

示例：

```json
{
  "permission": {
    "*": "ask",
    "read": "allow",
    "grep": "allow",
    "glob": "allow",
    "edit": "ask",
    "write": "ask",
    "bash": {
      "*": "ask",
      "git status": "allow",
      "pytest *": "allow",
      "rm *": "deny",
      "del *": "deny"
    }
  }
}
```

---

### 7.2 为什么权限重要

因为 HyperCode 可以真实操作项目文件和命令行。

如果没有权限控制，可能出现：

```text
- 误删文件
- 覆盖重要配置
- 执行危险命令
- 修改不该修改的数据
- 在错误目录运行脚本
```

所以建议：

```text
读文件：allow
搜索：allow
测试命令：allow 或 ask
写文件：ask
删除命令：deny
网络访问：ask
部署命令：deny 或 ask
```

---

## 8. 自定义命令

HyperCode 支持自定义 slash command。

可以把常用任务固化为命令：

```text
/test
/review
/fix
/report
/check-icd
/backtest
```

---

### 8.1 示例：测试命令

```markdown
# /test

请执行以下步骤：

1. 读取项目测试说明。
2. 运行完整测试。
3. 如果测试失败，定位失败用例。
4. 分析失败原因。
5. 给出最小修复方案。
6. 修复后重新运行测试。
7. 输出测试总结。
```

以后只需要输入：

```text
/test
```

就可以复用这套流程。

---

### 8.2 适合你的自定义命令

结合你的项目，可以设计：

| 命令 | 用途 |
|---|---|
| `/bootstrap` | 初始化项目理解和事实库 |
| `/test` | 执行完整测试 |
| `/gate` | 执行质量门禁 |
| `/icd-check` | 检查 ICD Excel |
| `/report` | 生成测试/分析报告 |
| `/release-check` | 发布前检查 |

---

## 9. 自定义工具

HyperCode 支持自定义工具，让 LLM 调用你写的函数。

工具可以用 TypeScript/JavaScript 定义，但内部可以调用 Python、Shell、Node 等脚本。

---

### 9.1 自定义工具能做什么

适合封装：

```text
- 读取 Excel
- 检查 ICD 字段
- 解析 XML
- 运行 pytest
- 统计覆盖率
- 读取 CSV
- 解析日志
- 生成 Markdown 报告
- 调用内部 API
```

---

### 9.2 示例场景：ICD 检查工具

可以封装一个工具：

```text
check_icd_excel(file_path)
```

返回：

```json
{
  "missing_fields": [],
  "duplicated_fields": [],
  "type_mismatch": [],
  "summary": "pass"
}
```

然后 HyperCode 就能在自然语言任务中调用：

```text
检查这个 ICD Excel 是否满足规范，并输出报告。
```

---


## 10. Agent Skills

HyperCode 支持 Skills 机制。

Skill 通常是一个 `SKILL.md` 文件，用来描述一个可复用能力。

可以理解为：

```text
Skill = 专项任务说明书 + 执行流程 + 输入输出规范 + 约束条件
```

---

### 10.1 Skill 适合做什么

适合固化复杂流程：

```text
- Python 测试规程
- ICD 检查规程
- Excel 数据处理规程
- 回测验证规程
- 报告生成规程
- 数据分析规程
```

---


## 11. 插件系统

HyperCode 支持插件，用于扩展运行时行为。

插件可以做：

```text
- 注入环境变量
- 监听工具调用
- 增加安全检查
- 记录日志
- 自定义通知
- 修改上下文
- 对接内部系统
```

---

### 11.1 插件适合的场景

| 场景 | 插件用途 |
|---|---|
| 安全控制 | 禁止执行危险命令 |
| 日志审计 | 记录 agent 修改了哪些文件 |
| 项目约束 | 自动注入项目规则 |
| 通知系统 | 任务完成后发消息 |
| 内部平台 | 对接测试平台、缺陷系统、文档系统 |

---

## 12. MCP 外部工具集成

HyperCode 支持 MCP，即 Model Context Protocol。

MCP 可以把外部系统变成 agent 可调用工具。

---

### 12.1 可以接入的 MCP 类型

```text
- GitHub
- GitLab
- 数据库
- 文件系统
- 文档系统
- Sentry
- API 文档
- 搜索服务
- 内部测试平台
```

---

### 12.2 MCP 的价值

MCP 的核心价值是：

```text
让 agent 不只操作本地文件，还能操作外部系统。
```

例如：

```text
HyperCode
    ↓
读取 GitHub Issue
    ↓
分析本地代码
    ↓
修改代码
    ↓
运行测试
    ↓
提交 PR
```

---

### 12.3 MCP 使用注意点

不要随便接太多 MCP。

原因：

```text
- 会增加上下文 token
- 工具过多会降低选择准确性
- 可能带来权限风险
- 调试复杂度上升
```

建议只接真正需要的工具。

---

## 13. GitHub / GitLab 自动化

HyperCode 可以接入 GitHub/GitLab 工作流，用于自动处理 issue、PR 和 CI。

---

### 13.1 GitHub Issue 自动处理

例如在 issue 评论：

```text
/HyperCode 修复这个 bug，并补充测试
```

HyperCode 可以在 runner 里执行：

```text
读取 issue
    ↓
分析代码
    ↓
修改文件
    ↓
运行测试
    ↓
提交结果
```

---

### 13.2 PR Review

可用于：

```text
- 检查 PR 是否破坏测试
- 分析代码改动风险
- 给出重构建议
- 补充缺失测试
- 修改 PR 中的问题
```

---

### 13.3 CI 失败分析

适合自动化处理：

```text
CI 失败
    ↓
HyperCode 读取日志
    ↓
定位失败测试
    ↓
分析相关代码
    ↓
给出修复建议或直接修复
```

---

## 14. 会话管理能力

HyperCode 提供会话管理能力。

| 功能 | 说明 |
|---|---|
| `/sessions` | 查看历史会话 |
| `/compact` | 压缩上下文 |
| `/undo` | 撤销上一轮造成的文件变更 |
| `/redo` | 恢复被撤销的改动 |
| `/share` | 分享会话 |
| `stats` | 查看 token 和成本统计 |
| `export/import` | 导出或导入会话 |

---

### 14.1 Undo / Redo

`/undo` 很有用。

因为 HyperCode 会真实修改文件，所以需要撤销机制。

典型场景：

```text
agent 改错了
    ↓
/undo
    ↓
回到修改前状态
```

建议项目必须使用 Git 管理。

---

### 14.2 Compact

长会话容易导致上下文膨胀。

`/compact` 可以压缩历史上下文，保留核心信息。

适合：

```text
- 长时间重构
- 多轮测试修复
- 大型项目理解
- 长流程任务执行
```

---

## 15. 对工程项目的典型用法

### 15.1 新项目快速理解

```text
/init
分析这个项目的目录结构、核心模块、启动入口、测试方式。
```

输出：

```text
- 项目架构
- 核心模块职责
- 运行方式
- 测试方式
- 潜在风险
```

---

### 15.2 Bug 修复

```text
运行测试，找出失败原因，修复后重新运行测试。
```

执行链路：

```text
pytest
    ↓
读取失败日志
    ↓
定位代码
    ↓
修改代码
    ↓
再次 pytest
    ↓
总结
```

---

### 15.3 自动化测试闭环

适合你做测试 skill：

```text
读取需求
    ↓
读取源码
    ↓
读取测试规程
    ↓
生成测试用例
    ↓
执行测试
    ↓
收集覆盖率
    ↓
生成测试报告
    ↓
输出 gate 结论
```


---

## 16. HyperCode 适合做什么

适合：

```text
- 工程项目智能体
- 代码修改
- 自动化测试
- 重构
- 代码审查
- 文档生成
- 项目初始化理解
- CI/CD 辅助
- Issue/PR 自动处理
- 自定义工程工作流
```

---

## 17. HyperCode 不适合做什么

不太适合：

```text
- 单纯聊天
- 不需要操作代码的普通问答
- 高风险自动部署
- 无权限控制的生产环境操作
- 没有测试用例的自动大规模重构
- 强 GUI 操作任务
```

---


## 19. 推荐使用方式

### 19.1 个人开发

```text
HyperCode
    ↓
/init
    ↓
让它分析项目
    ↓
小步修改
    ↓
每次修改后运行测试
```

---

### 19.2 工程团队

建议配置：

```text
AGENTS.md
.HyperCode/commands/
.HyperCode/skills/
.HyperCode/plugins/
权限规则
CI 集成
```

---

### 19.3 你的项目推荐结构

可以这样设计：

```text
project/
├── AGENTS.md
├── .HyperCode/
│   ├── commands/
│   │   ├── test.md
│   │   ├── gate.md
│   │   └── icd-check.md
│   │   
│   ├── skills/
│   │   ├── defense-python-test/
│   │   │   └── SKILL.md
│   │   └── excel-icd-check/
│   │       └── SKILL.md
│   │   
│   │       
│   └── plugins/
├── src/
├── tests/
├── data/
├── output/
└── reports/
```

---

## 20. 总结

HyperCode 的核心功能点可以概括为：

```text
多入口使用
+ 多模型支持
+ 项目代码理解
+ 文件读写修改
+ 命令执行
+ 测试闭环
+ Plan / Build / Explore 多 agent 模式
+ 权限控制
+ 自定义命令
+ 自定义工具
+ Skills 机制
+ 插件系统
+ MCP 外部系统集成
+ GitHub/GitLab 自动化
+ 会话管理
```

对你来说，HyperCode 最适合的定位是：

```text
工程型 AI Agent 执行框架
```

它可以用于落地：

```text
- 自动化测试 agent
- ICD/Excel 检查 agent
- 项目代码维护 agent
- CI 失败修复 agent
- 文档/报告生成 agent
```

如果要真正用于复杂工程，建议重点做好四件事：

```text
1. 写好 AGENTS.md
2. 设计好 commands
3. 把复杂流程沉淀成 skills
4. 严格配置权限，尤其是 bash、write、delete 类操作
```

---
