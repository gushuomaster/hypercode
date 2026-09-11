# Executable Skill Workflow Boundary Design

## 状态

- 日期：2026-09-04
- 状态：已确认，作为后续实现的唯一架构依据
- 取代：`2026-09-02-video-replica-workflow-design.md`
- 后续计划：
  - `../plans/2026-09-04-doubao-video-replica-skill-protocol.md`
  - `../plans/2026-09-04-hypercode-executable-skill-runtime.md`

## 结论

`doubao-video-replica` 是视频复刻业务产品，HyperCode 是通用能力执行平台。

系统不应存在一个由双方共同维护的“视频复刻状态机”。它必须拆成两个正交且各有唯一所有者的状态机：

1. skill 独占业务状态机，包括阶段、业务门禁、分段依赖、质量判定、正式产物和交付条件。
2. HyperCode 独占执行状态机，包括外部进程、模型/provider 调用、通用 Question、技术重试、取消、临时产物和执行日志。

双方只通过版本化、机器可读的 executable-skill 协议交互。HyperCode 不读取或猜测 skill 的内部状态字段，不把视频复刻枚举、批准句、提示词或质量规则编译进平台代码。

## 问题背景

旧设计虽然声明外部 skill 的脚本和 `project-state.json` 是业务真值，却同时在 HyperCode 中新增了完整的 `video-replica` 服务。当前实现已经出现以下职责重叠：

- `packages/opencode/src/video-replica/service.ts` 解析和验证语义分段、维护审批与恢复、构造图片 prompt、执行 QC、处理 Plus 导入并判断交付条件。
- `packages/opencode/src/video-replica/skill-bridge.ts` 了解多个内部 Python 脚本的名称、参数和输出格式。
- `packages/opencode/src/video-replica/model-pool.ts` 把视频复刻的成本与模型策略固化成专用平台模块。
- HyperCode 直接读写外部 `project-state.json` 的 `hypercode` 命名空间。

与此同时，skill 自身已经定义动态语义分段、审批门禁、资产映射、生成依赖、质量重试、状态更新、提示词和交付编译规则。两边继续演进会产生双重事实源、恢复歧义和版本耦合。

当前没有必须迁移的真实 HyperCode 视频复刻项目。因此旧的 `project-state.json.hypercode` 格式视为原型数据，不提供兼容或迁移代码。

## 目标

- 给 skill 与 HyperCode 建立可由测试验证的职责边界。
- 让 skill 在 Codex、HyperCode 或其他实现同一协议的宿主中保持业务一致。
- 让 HyperCode 的模型、图片、Question、运行时、信任和恢复能力可被其他 executable skills 复用。
- 保持一个业务事实源和一个执行事实源，避免跨边界共同写状态。
- 先用最小完整纵向切片验证协议，再恢复多分段并发、双模型 QC、付费兜底和完整交付。

## 非目标

- 不把所有自然语言 skills 都变成可执行工作流。
- 不为尚未出现的 skills 设计任意扩展点或通用 shell 编排系统。
- 不在 HyperCode 中实现视频复刻专用页面、阶段枚举、prompt、QC 或交付编译。
- 不承诺外部 provider 在崩溃边界上的严格 exactly-once；协议只提供可审计的幂等和不确定结果处理。
- 不保留旧 HyperCode 视频复刻原型状态的向后兼容。
- 不在本轮建立独立的 skill Git 仓库；当前个人 skill 目录作为工作副本，已有外部备份负责回滚。

## 职责矩阵

| 能力 | skill | HyperCode |
|---|---|---|
| 视频分析、语义分段和资产匹配规则 | 唯一所有者 | 不理解业务内容 |
| 业务阶段、审批门禁、恢复点和终止条件 | 唯一所有者 | 只执行并回传动作 |
| prompt、参考材料、输出 schema 和验收规则 | 唯一所有者 | 按声明调用能力 |
| 已就绪动作、依赖图和业务并发许可 | 唯一所有者 | 仅并行执行明确独立的动作 |
| provider、模型、凭据、健康探测和成本策略 | 声明能力需求 | 唯一所有者 |
| Question 的问题内容、答案规则和展示数据 | 唯一所有者 | 通用展示、回答、拒绝和恢复 |
| 图片/模型调用的技术重试和取消 | 接收最终结构化结果 | 唯一所有者 |
| 临时生成产物 | 通过 artifact 引用读取 | 唯一所有者 |
| 项目内正式产物、命名、验收和 `project-state.json` | 唯一所有者 | 禁止直接写入 |
| 业务指标和最终报告 | 唯一所有者 | 回传通用执行指标 |
| 进程、调用、费用和技术错误日志 | 消费必要摘要 | 唯一所有者 |
| skill 发现、指纹、信任和隔离运行环境 | 提供声明 | 唯一所有者 |

## 两个状态机

### skill 业务状态机

skill 负责持久化业务状态，至少包括：

- `workflow_id`、业务 schema 版本和单调递增 `revision`；
- 当前业务阶段和允许的下一步；
- 分段、视觉资产、依赖关系和冻结版本；
- 待完成与已完成的 `operation_id`；
- 审批、QC、强制接受、失败和取消等业务决定；
- 正式图片、提示词、报告和交付完成条件；
- 视频分析、审批等待、生成波次、QC 和交付等业务指标。

`project-state.json` 只能由 skill 的领域代码原子写入。HyperCode 不再增加或维护 `hypercode` 命名空间。

### HyperCode 执行状态机

HyperCode 负责持久化执行日志，至少包括：

- skill 名称、来源、指纹和协议版本；
- `workflow_id`、`operation_id` 和关联 Session；
- 动作类型、开始/完成时间、尝试次数和最终执行状态；
- provider、model、已知费用、技术错误和取消原因；
- 临时 `artifact_id`、MIME、哈希、大小和清理状态；
- 已取得的信任、依赖安装确认和付费确认引用。

执行日志属于 HyperCode 数据库或受管状态，不写入 skill 项目目录。业务是否可以继续始终由 skill 回答。

## Executable skill 声明

保留标准 `SKILL.md` 作为自然语言说明，并在 skill 根目录新增 `skill-runtime.json`。第一版声明示例：

```json
{
  "schema_version": 1,
  "protocol": "executable-skill/1",
  "entrypoint": ["python", "scripts/workflow_protocol.py"],
  "runtime": {
    "kind": "python",
    "version": ">=3.11",
    "requirements": ["requirements-visual-assets.txt"]
  },
  "actions": ["llm.generate", "image.generate", "user.ask"],
  "permissions": {
    "read": ["skill", "project", "declared-inputs"],
    "write": ["project"],
    "process": ["ffmpeg", "ffprobe"]
  }
}
```

约束：

- manifest、入口和 requirements 路径必须位于解析后的 skill 根目录内，拒绝 `..`、盘符切换和符号链接逃逸。
- `entrypoint` 只描述统一入口；HyperCode 不发现或调用 skill 内部其他脚本。
- `actions` 是受控白名单，第一版不提供 `shell.run` 或任意工具调用。
- HyperCode 不把凭据或 provider token 传给 skill 进程。
- manifest 不替代 `SKILL.md`；没有 manifest 的普通 skill 仍可被现有 `skill` 工具读取，但不可由 executable-skill 运行时执行。

## 协议

### 传输

- HyperCode 启动一次短生命周期入口进程。
- 请求以单个 UTF-8 JSON 对象写入 stdin。
- 成功或业务失败都在 stdout 返回单个符合 schema 的 UTF-8 JSON 对象。
- stdout 不允许混入日志；诊断日志写入 stderr，并经过 HyperCode 的秘密信息过滤。
- 第一版不要求流式进度。长时间本地分析由 HyperCode 展示通用“运行中”状态；以后可通过协议次版本协商进度事件。

### 请求 envelope

```json
{
  "protocol_version": "1.0",
  "request_id": "uuid",
  "command": "start | advance | submit_result | submit_answer | cancel | status",
  "project_directory": "absolute-path",
  "workflow_id": "optional-id",
  "expected_revision": 7,
  "payload": {}
}
```

- `request_id` 只标识一次协议调用。
- `workflow_id` 标识 skill 业务实例。
- `expected_revision` 提供乐观并发控制；过期请求必须被 skill 拒绝，不允许覆盖较新状态。
- `payload` 的业务 schema 由 skill 版本拥有；HyperCode 只做大小、安全路径和 JSON 边界校验。

### 响应 envelope

```json
{
  "protocol_version": "1.0",
  "workflow_id": "workflow-id",
  "revision": 8,
  "status": "running | waiting | completed | failed | cancelled",
  "ready_actions": [],
  "artifacts": [],
  "error": null
}
```

- skill 每次先原子提交业务状态，再返回与该 `revision` 一致的响应。
- 相同业务 revision 上未收到结果的动作必须返回相同 `operation_id`。
- HyperCode 不根据 `status` 之外的 skill 私有字段推断阶段。
- 不支持的协议主版本直接失败；次版本和可选能力通过 manifest/响应中的 `capabilities` 协商。

### 动作 envelope

```json
{
  "operation_id": "stable-id",
  "type": "llm.generate",
  "depends_on": [],
  "requirements": {},
  "payload": {}
}
```

- `operation_id` 在业务工作流内稳定且唯一。
- `depends_on` 由 skill 生成。HyperCode 只能并行执行依赖均已完成、且同时出现在 `ready_actions` 中的动作。
- `requirements` 描述通用能力，不包含固定 provider 凭据。
- `payload` 包含 skill 拥有的 prompt、输入、输出 schema、参考图角色和验收所需上下文。

第一版动作类型仅包括：

- `llm.generate`：结构化文本/多模态模型调用；
- `image.generate`：生成或编辑图片并返回临时 artifact；
- `user.ask`：通过通用 Question 展示和收集答案。

skill 的 `init_project.py`、`inspect_video.py`、资产脚本和 `delivery_compiler.py` 继续是内部实现，由统一入口调用，不暴露为协议动作。

### 动作结果

```json
{
  "operation_id": "stable-id",
  "status": "succeeded | failed | cancelled | uncertain",
  "output": {},
  "execution": {
    "provider": "optional-provider",
    "model": "optional-model",
    "attempts": 1,
    "elapsed_ms": 1234,
    "cost": { "known": false },
    "artifacts": []
  },
  "error": null
}
```

HyperCode 只保证同一个已持久化成功结果不会主动再次调用 provider。若进程在 provider 成功与执行日志提交之间崩溃，结果标为 `uncertain`；只有 skill 的后续动作或用户决定可以消解该状态。provider 支持幂等键时使用 `operation_id` 派生键，但不虚构 exactly-once 保证。

## 通用能力路由

skill 声明模型能力需求，例如：

- 输入模态和上下文大小；
- 结构化输出或工具调用能力；
- 图片参考编辑、目标比例和格式；
- 是否要求与主模型独立的复核模型；
- 质量等级或延迟约束。

HyperCode 根据用户配置、凭据、ModelsDev 目录、健康状态和全局成本策略选择 provider/model。免费优先、同级切换、首次模型确认和付费确认都属于 HyperCode 通用策略。skill 不硬编码账号凭据，也不把某个 provider 名称当作业务阶段。

HyperCode 把实际 provider、model、费用和最终结果回传；skill 决定业务上接受、复核、换方案、暂停或终止。

## Question 与 UI

`user.ask` 由 skill 提供：

- 标题、问题、选项和答案校验规则；
- 图片、事实、警告、成本说明等声明式 presentation；
- 是否接受用户附件，以及允许的 MIME、数量和大小；附件由 HyperCode 先转成通用临时 artifact，再作为回答结果返回；
- 与 `operation_id` 关联的业务语义。

HyperCode 的 Question 只负责通用展示、回答、拒绝和恢复。UI 不包含“分镜”“首帧”“Plus 导入”等枚举或按钮。批准句是否精确匹配由 skill 在 `submit_answer` 时判断。

## 临时与正式产物

1. HyperCode 将 provider 返回内容写入受管临时目录。
2. 写入后校验 MIME、实际格式、大小和哈希，生成不可猜测的 `artifact_id`。
3. 动作结果只返回 artifact 元数据和受控读取引用，不允许 skill 任意访问 HyperCode 缓存。
4. skill 校验业务归属后，将临时产物原子导入项目目录，决定正式文件名并更新 `project-state.json`。
5. skill 确认已导入后，HyperCode 将临时 artifact 标为可清理。

HyperCode 不把图片直接命名为某个视频分段的正式首帧，也不标记“已验收”。

## 信任与运行环境

- HyperCode 可以自动发现 `SKILL.md` 和 `skill-runtime.json` 元数据。
- 首次执行、manifest/入口/依赖或受指纹保护文件发生变化后，必须展示来源、指纹、权限和依赖并重新确认。
- Python 环境位于可配置的外部虚拟环境根目录，以 skill 指纹隔离；禁止写入 skill 安装目录。本机部署根目录固定为 `D:\venv`，不得回退到 C 盘缓存。
- 依赖安装需要独立用户确认，且只能使用 manifest 声明的 requirements。
- 外部 skill 进程只获得完成动作所需的项目和输入路径，不获得 provider 密钥。
- 当前直接修改个人 skill 安装目录；修改前后记录指纹，并运行 skill 自身测试。独立源码仓库不属于本轮要求。

## 失败、取消与恢复

- HyperCode 对 429、5xx、连接失败等执行错误应用有限、通用、可配置的技术重试。
- 技术重试耗尽后，HyperCode 提交 `failed` 结果；是否更换业务方案由 skill 决定。
- 用户取消时，HyperCode 中断活动进程/provider 调用，持久化 `cancelled` 执行结果，再通知 skill 提交业务状态。
- 启动或恢复时，HyperCode 先读取自己的执行日志，再以 `status/advance` 查询 skill；双方通过 `workflow_id`、`operation_id` 和 `revision` 对账。
- HyperCode 已有成功结果而 skill 尚未确认时，重放结果而不是重做调用。
- skill 声称动作完成但 HyperCode 无日志时，以 skill 业务状态为准，不倒退业务；记录审计告警。
- 任何不一致都不得通过猜测私有状态字段修复。

## 指标

HyperCode 记录：

- 外部进程、模型和图片调用耗时；
- provider/model、技术尝试次数、费用和执行状态；
- Question 等待、取消和临时 artifact 生命周期。

skill 记录：

- 资产入库、视频分析、审批准备和资产匹配；
- 业务生成波次、QC、验收、强制接受和交付；
- 用户等待与业务主动耗时；
- 最终性能报告所需的领域计算。

最终视频复刻报告由 skill 从业务状态和 HyperCode 回传的执行指标编译。

## 当前代码处置

### 保留

- `.codex/skills` 通用发现逻辑及测试。
- Question 的通用 presentation schema、API/SDK 传输和 UI 渲染，验证其不含视频复刻枚举后保留。
- Auth、ModelsDev、Location-scoped LLM、权限和通用进程设施。

### 泛化后保留

- `image-generation` 的 provider adapter、安全格式校验和原子暂存能力；移除 `segmentID`、项目内命名和视频专用 guidance。
- 模型健康探测和候选筛选；迁移为通用 capability router，移除视频复刻专用池与阶段状态。
- provider 调用指标；迁移为通用执行日志字段。

### 从 HyperCode 删除

- `packages/opencode/src/video-replica/` 全部领域服务、schema、桥接、指标和 Plus 导入实现。
- `packages/opencode/src/tool/video-replica.ts` 及 registry 中的视频专用服务节点。
- HyperCode 对 `project-state.json` 的业务解析、写入、恢复和兼容代码。
- 视频专用批准句、prompt、分段校验、QC、依赖链、交付编译和测试复制品。

### 替代实现

- 增加通用 executable-skill manifest 解析、信任、运行时、协议执行器、能力调度、执行日志与 artifact staging。
- 增加最小假 skill fixture 验证协议；真实 `doubao-video-replica` 仅作为本机可选兼容测试。

## 测试边界

skill 测试负责：

- 所有视频复刻状态转移和业务门禁；
- prompt/schema 构造、分段依赖、QC、正式 artifact 导入；
- `project-state.json` 的原子性、revision、幂等和恢复；
- 协议 envelope 与业务 action/result 的契约。

HyperCode 测试负责：

- manifest 安全解析、来源指纹、信任和隔离环境；
- 协议主版本拒绝、进程 JSON 边界和错误处理；
- 通用动作路由、模型/费用策略、Question 和 artifact staging；
- 执行日志、结果重放、取消和崩溃恢复；
- 确认平台代码与 fixture 不包含视频复刻业务规则。

本机兼容测试负责：

- 当前安装的真实 skill 能被发现和确认；
- 最小纵向切片能从初始化运行到正式图片导入并恢复；
- 该测试显式启用，不依赖固定用户路径，不进入普通 CI。

## 交付顺序

1. 标记旧设计和旧计划为已取代，冻结视频专用 HyperCode 扩展。
2. 直接在个人 skill 工作副本中实现 manifest、统一协议和领域状态机。
3. 用 skill 自身测试跑通最小业务纵向切片。
4. 在 HyperCode 中实现通用 executable-skill runtime 和三种动作能力。
5. 使用最小假 skill 完成平台自动测试。
6. 删除/泛化当前 HyperCode 视频专用实现。
7. 用真实 skill 完成本机纵向切片。
8. 再恢复多分段并发、双模型 QC、付费兜底和完整交付验收。

## 验收标准

1. `project-state.json` 不再包含 HyperCode 写入的业务命名空间。
2. HyperCode 源码中没有视频复刻阶段、批准句、prompt、QC 或交付规则。
3. HyperCode 只通过统一入口和版本化 JSON envelope 与 executable skill 交互。
4. skill 独立运行时能决定所有业务下一步，并能在重启后从自身状态恢复。
5. provider 成功结果可从 HyperCode 日志重放，不能因普通恢复重复调用。
6. 模型、图片、Question、artifact、信任和运行时能力不引用 `doubao-video-replica`。
7. 最小纵向切片完成一次 Question、一次模型调用、一次图片生成、正式导入和恢复。
8. 旧原型状态无兼容代码，且历史文档明确标记为已取代。
