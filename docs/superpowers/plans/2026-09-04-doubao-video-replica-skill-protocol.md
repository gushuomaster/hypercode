# Doubao Video Replica Skill Protocol Implementation Plan

> **实施状态（2026-09-04）：** 已完成。Task 0–7 的协议、状态机、图片 DAG、QC、正式导入、恢复、交付、文档和最小纵向切片均已实现；验证与指纹见 `../reports/2026-09-04-doubao-video-replica-skill-fingerprints.md`。

> **实施范围：** 仅修改 `C:\Users\28320\.codex\skills\doubao-video-replica`。不得在本计划中修改 HyperCode。该目录没有独立 Git 仓库，现有外部备份负责回滚；每次实施前后必须记录受保护文件指纹并运行完整 skill 测试。

**目标：** 让 `doubao-video-replica` 成为视频复刻业务状态、阶段流转、审批门禁、生成依赖、QC、正式产物和交付的唯一所有者，并通过版本化 JSON CLI 向 HyperCode 等宿主请求通用能力。

**架构：** 保留 `SKILL.md` 的自然语言使用方式，新增 `skill-runtime.json` 和单一 `workflow_protocol.py` 入口。自然语言工作流与机器入口共享同一套 Python 领域状态机。入口在每次调用中读取请求、原子推进 `project-state.json`，返回稳定的 ready actions；宿主执行 `llm.generate`、`image.generate` 或 `user.ask` 后再提交结果。

**设计依据：** `../specs/2026-09-04-executable-skill-workflow-boundary-design.md`

## 全局约束

- `project-state.json` 是唯一业务事实源，只能由 skill 代码写入。
- 不创建或维护 `hypercode` 业务命名空间。
- 不让宿主调用 `init_project.py`、`inspect_video.py`、视觉资产脚本或 `delivery_compiler.py`；这些都是统一入口的内部实现。
- 不在 skill 中解析 provider 凭据、选择具体账号或实现付费确认。
- 不把 API key、OAuth token、完整请求头或不必要的本机路径写入状态、stdout 或错误。
- 所有状态提交使用临时文件、校验和原子替换；失败不得留下部分状态。
- 每个 `operation_id` 在 workflow 内稳定且唯一；未收到结果时重复查询必须返回同一动作。
- 第一版只声明 `llm.generate`、`image.generate`、`user.ask`，不声明任意 shell 动作。
- 现有业务规则、审批句、动态分段、资产匹配、QC 和交付要求必须保持在 skill 测试中。
- Python 测试从 skill 根目录运行：`python -m unittest discover -s tests -p "test_*.py"`。

## Task 0：冻结基线并确认现有测试

**Files:**

- Read only: `<skill-root>/SKILL.md`
- Read only: `<skill-root>/references/**`
- Read only: `<skill-root>/scripts/**`
- Read only: `<skill-root>/tests/**`
- Record outside project state: manifest/SKILL/scripts/requirements 的 SHA-256 清单

- [ ] 记录 `SKILL.md`、`requirements-visual-assets.txt` 和 `scripts/**/*.py` 的路径、大小与 SHA-256。
- [ ] 从 skill 根目录运行完整测试并保存失败基线。
- [ ] 确认备份可用；不得通过删除或覆盖备份验证。
- [ ] 记录当前 `project-state.json` schema 版本及现有 v3→v4 迁移测试。

验证命令：

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

预期：现有测试全部通过；若存在已知失败，必须先记录，不能把它误归因于协议改造。

## Task 1：增加 executable skill manifest 和协议 schema

**Files:**

- Create: `<skill-root>/skill-runtime.json`
- Create: `<skill-root>/scripts/workflow_protocol.py`
- Create: `<skill-root>/scripts/workflow_contract.py`
- Create: `<skill-root>/tests/test_workflow_protocol.py`

**Produces:**

- `skill-runtime.json`：声明 `executable-skill/1`、Python 入口、requirements、动作白名单和权限需求。
- 请求/响应、action/result、artifact、presentation 与 error 的集中 schema 校验。
- `workflow_protocol.py`：stdin 单 JSON、stdout 单 JSON、日志只写 stderr 的入口边界。

- [ ] 先写 manifest 与协议解析失败测试：未知主版本、未知 command、缺字段、额外 stdout、非法 action、过大 payload。
- [ ] 写路径安全测试：入口和 requirements 不能通过 `..`、盘符切换或符号链接离开 skill 根目录。
- [ ] 实现最小 `status` command，只返回协议版本、capabilities 和“项目不存在”结构化错误。
- [ ] 将异常映射为稳定 error code，不在 message/details 中泄漏环境变量或凭据形态字符串。
- [ ] 验证 stdout 可直接 `json.loads`，stderr 内容不会污染协议。

聚焦验证：

```powershell
python -m unittest discover -s tests -p "test_workflow_protocol.py"
```

## Task 2：建立 skill 独占的领域状态机

**Files:**

- Create: `<skill-root>/scripts/workflow_state.py`
- Modify: `<skill-root>/scripts/init_project.py`
- Modify: `<skill-root>/scripts/visual_asset_project.py`
- Modify: `<skill-root>/scripts/generation_pipeline.py`
- Modify: `<skill-root>/scripts/delivery_compiler.py`
- Create: `<skill-root>/tests/test_workflow_state.py`
- Modify: existing state-transition tests as needed

**State requirements:**

- 顶层 schema 版本升级并提供已有 v4 数据的 skill 内部迁移。
- 增加 skill 自有 `workflow` 结构：`workflow_id`、`revision`、`status`、`phase`、pending/completed operations、业务错误与取消状态。
- 保留视频、segments、visual assets、review、generation、delivery 和 metrics 等领域数据，不创建宿主命名空间。

- [ ] 写失败测试：过期 `expected_revision`、非法阶段转移、重复 result、跨 workflow operation、部分文件提交。
- [ ] 实现单调 revision 与原子 compare-and-commit。
- [ ] 将分散在脚本中的业务门禁整理为领域转移函数；CLI 脚本与协议入口必须调用同一函数。
- [ ] 确保重复提交完全相同的动作结果幂等；冲突结果返回稳定错误。
- [ ] 验证自然语言/旧 CLI 路径仍通过共享状态代码工作。

聚焦验证：

```powershell
python -m unittest discover -s tests -p "test_workflow_state.py"
python -m unittest discover -s tests -p "test_workflow_scripts.py"
python -m unittest discover -s tests -p "test_visual_asset_project.py"
```

## Task 3：实现初始化、分析和分镜审批动作

**Files:**

- Modify: `<skill-root>/scripts/workflow_protocol.py`
- Modify: `<skill-root>/scripts/workflow_state.py`
- Modify: `<skill-root>/scripts/init_project.py`
- Modify: `<skill-root>/scripts/inspect_video.py` only through reusable callable boundaries
- Modify: `<skill-root>/scripts/configure_visual_assets.py`
- Modify: `<skill-root>/scripts/match_visual_assets.py`
- Modify: `<skill-root>/scripts/delivery_compiler.py`
- Create: `<skill-root>/tests/test_workflow_protocol_storyboard.py`

**Behavior:**

- `start` 校验输入并初始化项目。
- 内部确定性步骤直接调用共享 Python API，不把内部脚本名返回宿主。
- 需要模型语义处理时返回 `llm.generate`，由 skill 提供 prompt、输入、输出 schema 与业务验收规则。
- 完整分镜准备后返回 `user.ask`，批准句及答案验证仍由 skill 拥有。

- [ ] 测试视觉资产入口在视频分析前出现。
- [ ] 测试媒体/FFmpeg/FFprobe 错误停止且不猜测。
- [ ] 测试 LLM result 不符合 schema 时由 skill 返回后续业务动作或失败，不由宿主解释 segments。
- [ ] 测试审批前不返回任何 `image.generate`。
- [ ] 测试只有精确批准句才能冻结资产、分段和依赖图。
- [ ] 测试重复 `advance/status` 返回相同 pending operation。

聚焦验证：

```powershell
python -m unittest discover -s tests -p "test_workflow_protocol_storyboard.py"
python -m unittest discover -s tests -p "test_workflow_scripts.py"
python -m unittest discover -s tests -p "test_visual_asset_end_to_end.py"
```

## Task 4：实现图片动作、DAG 调度、QC 与正式导入

**Files:**

- Modify: `<skill-root>/scripts/workflow_protocol.py`
- Modify: `<skill-root>/scripts/workflow_state.py`
- Modify: `<skill-root>/scripts/generation_pipeline.py`
- Create: `<skill-root>/scripts/artifact_import.py`
- Create: `<skill-root>/tests/test_workflow_protocol_generation.py`
- Create: `<skill-root>/tests/test_artifact_import.py`

**Behavior:**

- skill 为每段构造最小参考集、prompt、能力 requirements 和依赖。
- 只把依赖已完成的动作放入 `ready_actions`；可同时返回多个互相独立的动作。
- HyperCode 返回临时 artifact 后，skill 校验 operation 归属、MIME、格式、哈希和业务对应关系，再原子导入正式项目目录。
- QC prompt、输出 schema、硬错误、二次复核、质量重试和用户强制接受全部属于 skill。

- [ ] 测试分段编号相邻不会自动产生依赖。
- [ ] 测试未就绪 action 不会提前返回。
- [ ] 测试同一波次单段失败不撤销其他成功结果。
- [ ] 测试 artifact 路径逃逸、哈希不符、MIME 欺骗和重复导入被拒绝。
- [ ] 测试正式文件命名、验收状态和项目写入只发生在 skill 内。
- [ ] 测试每图最多一次业务质量重试，技术尝试次数只作为宿主元数据记录。
- [ ] 测试不确定 QC 才请求独立复核能力。

聚焦验证：

```powershell
python -m unittest discover -s tests -p "test_workflow_protocol_generation.py"
python -m unittest discover -s tests -p "test_artifact_import.py"
python -m unittest discover -s tests -p "test_generation_pipeline.py"
```

## Task 5：实现恢复、失败、取消和不确定结果

**Files:**

- Modify: `<skill-root>/scripts/workflow_protocol.py`
- Modify: `<skill-root>/scripts/workflow_state.py`
- Create: `<skill-root>/tests/test_workflow_protocol_recovery.py`

- [ ] 测试进程退出后 `status/advance` 从 `project-state.json` 恢复同一 pending action。
- [ ] 测试宿主重放成功 result 不重复更新指标或正式产物。
- [ ] 测试同一 `operation_id` 的冲突 result 被拒绝。
- [ ] 测试 `failed`、`cancelled` 和 `uncertain` 分别触发显式业务决定。
- [ ] 测试取消先持久化业务状态，再返回取消完成。
- [ ] 测试 free/paid、provider 或模型失败不会被 skill 当成固定 provider 状态机；skill 只消费通用执行结果。
- [ ] 测试 revision 冲突永远不通过“最后写入获胜”覆盖。

聚焦验证：

```powershell
python -m unittest discover -s tests -p "test_workflow_protocol_recovery.py"
```

## Task 6：交付、指标与自然语言工作流共用领域代码

**Files:**

- Modify: `<skill-root>/scripts/delivery_compiler.py`
- Modify: `<skill-root>/scripts/workflow_metrics.py`
- Modify: `<skill-root>/SKILL.md`
- Modify: `<skill-root>/references/workflow.md`
- Modify: `<skill-root>/references/templates.md`
- Create: `<skill-root>/references/executable-protocol.md`
- Modify: relevant delivery/metrics tests

- [ ] 最终交付只从 skill 的结构化业务状态编译。
- [ ] 宿主回传的 provider/model/cost/elapsed/attempts 只作为执行证据进入业务指标，不变成阶段所有权。
- [ ] 保持 ASMR 固定声音硬规则与最终提示词无固定时长约束。
- [ ] `SKILL.md` 同时说明自然语言入口和 executable host 入口，但不复制状态转移实现。
- [ ] 文档列出协议版本、支持 actions、错误码、恢复语义和 artifact 导入要求。
- [ ] 验证旧 CLI 使用路径与协议路径生成相同的审批和交付语义。

聚焦验证：

```powershell
python -m unittest discover -s tests -p "test_delivery_compiler.py"
python -m unittest discover -s tests -p "test_workflow_metrics.py"
python -m unittest discover -s tests -p "test_workflow_scripts.py"
```

## Task 7：完成最小纵向切片与完整回归

最小纵向切片必须真实覆盖：

1. 初始化项目；
2. 返回并提交一个 `user.ask`；
3. 返回并提交一个 `llm.generate`；
4. 返回并提交一个 `image.generate` artifact；
5. skill 导入正式图片并更新状态；
6. 进程重启后恢复同一 workflow；
7. 编译最小交付。

- [ ] 增加 host simulator 测试，不依赖 HyperCode 代码或 provider 网络。
- [ ] simulator 只按协议执行，不导入视频复刻内部模块。
- [ ] 在每个协议边界退出一次，验证恢复与无重复业务动作。
- [ ] 运行完整测试。
- [ ] 重新记录 manifest、SKILL、scripts、requirements 的 SHA-256 并与基线一起保存。
- [ ] 确认未修改或删除现有外部备份。

完整验证：

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

## Skill 完成标准

- [ ] `project-state.json` 不包含宿主业务命名空间。
- [ ] 所有业务阶段、审批和恢复都能仅凭 skill 状态决定。
- [ ] 宿主只需理解协议 envelope 和三种通用 action。
- [ ] 重复查询与结果重放幂等，revision 冲突可审计。
- [ ] 正式 artifact 只能由 skill 导入和验收。
- [ ] 自然语言与机器入口共享领域代码。
- [ ] 完整 skill 测试通过后，才允许开始 HyperCode 实施计划。
