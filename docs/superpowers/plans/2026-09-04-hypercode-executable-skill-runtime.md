# HyperCode Executable Skill Runtime Implementation Plan

> **前置条件：** `2026-09-04-doubao-video-replica-skill-protocol.md` 已完成，真实 skill 的 `skill-runtime.json`、协议 schema 和最小 host simulator 纵向切片全部通过。契约稳定前禁止继续扩展 HyperCode 的视频复刻专用代码。

**目标：** 在 HyperCode 中实现通用 executable-skill 发现、信任、隔离运行时、协议执行、能力路由、Question、临时 artifact 与执行恢复，并删除或泛化当前视频复刻专用实现。

**架构：** 现有 `skill` 工具继续负责加载自然语言说明；新增通用 `skill_run` 工具驱动 executable skill。Location-scoped runtime 读取 manifest、校验指纹与权限、启动短生命周期入口并循环执行 ready actions。skill 业务状态留在项目中，HyperCode 只在数据库保存执行日志和临时 artifact 元数据。

**本机运行目录：** executable-skill Python 环境根目录使用 `D:\venv`，按 skill 名与受保护文件指纹分层；不得在 C 盘、skill 安装目录或项目目录内创建虚拟环境。实现必须保留可配置能力，但本轮验收以 `D:\venv` 为实际路径。

**设计依据：** `../specs/2026-09-04-executable-skill-workflow-boundary-design.md`

## 全局约束

- 不得在 HyperCode 中出现视频复刻阶段、批准句、segment 业务 schema、prompt、QC、Plus 导入或交付规则。
- 不得读写 `project-state.json` 或猜测任何 skill 私有字段。
- 不得硬编码 `doubao-video-replica` 名称、用户目录或内部脚本名；真实 skill 只出现在可选本机测试配置中。
- executable runtime 必须是 Location-scoped；不得将 skill 路径或状态放入进程全局单例。
- 使用 Effect、`FileSystem.FileSystem`、`ChildProcessSpawner.ChildProcessSpawner`、`HttpClient.HttpClient` 和现有服务边界。
- 不通过 legacy `SessionPrompt.loop(...)` 编排模型调用，不破坏 SessionV2 durable prompt admission 与单次 provider turn 约束。
- API key/OAuth token 只到 provider adapter 边界，不传给 skill 进程、Question、日志或 artifact metadata。
- 测试从 package 目录运行；类型检查只运行 `bun typecheck`，不得直接运行 `tsc`。
- 先添加通用替代能力和测试，再删除专用实现，避免中间提交无法验证。
- 当前无真实旧项目需要迁移，不实现 `project-state.json.hypercode` 兼容。

## Task 1：解析 executable manifest 并扩展通用 skill 元数据

**Files:**

- Create: `packages/opencode/src/skill/executable-manifest.ts`
- Modify: `packages/opencode/src/skill/index.ts`
- Modify: `packages/opencode/src/tool/skill.ts`
- Create: `packages/opencode/test/skill/executable-manifest.test.ts`
- Modify: `packages/opencode/test/skill/skill.test.ts`

**Produces:**

- 可选的 executable metadata，不影响没有 `skill-runtime.json` 的普通 skill。
- manifest schema、协议主版本、入口、runtime、action whitelist 和权限声明。
- 规范化 skill 根目录与受保护文件列表。

- [x] 先测试普通 skill 保持现有加载行为。
- [x] 测试合法 manifest 被发现但不执行。
- [x] 测试未知主版本、未知 action、绝对入口、`..`、盘符切换和符号链接逃逸被拒绝。
- [x] 测试 manifest 无效时自然语言 skill 仍可加载，但 executable metadata 带可操作错误，不静默执行。
- [x] `skill` 工具输出是否可执行、协议版本与来源，不泄漏完整本机目录给不需要的前端字段。

验证：

```bash
# packages/opencode
bun test test/skill/executable-manifest.test.ts test/skill/skill.test.ts
bun typecheck
```

## Task 2：实现来源指纹、信任和隔离 Python 环境

**Files:**

- Create: `packages/opencode/src/skill-runtime/fingerprint.ts`
- Create: `packages/opencode/src/skill-runtime/trust.ts`
- Create: `packages/opencode/src/skill-runtime/environment.ts`
- Create: `packages/opencode/test/skill-runtime/fingerprint.test.ts`
- Create: `packages/opencode/test/skill-runtime/trust.test.ts`
- Create: `packages/opencode/test/skill-runtime/environment.test.ts`

**Behavior:**

- 指纹覆盖 manifest、入口、requirements 和声明的受保护 skill 文件。
- 首次执行或指纹变化后使用现有权限/Question 生命周期取得确认。
- 环境位于 HyperCode 受管缓存，以 skill 指纹隔离。
- 安装只能使用 manifest 声明的 requirements，必须单独确认。
- 不写 skill 目录；不复用指纹不同的环境；失败环境不能标记 ready。

- [x] 测试只读发现不会触发安装或信任写入。
- [x] 测试相同指纹复用确认和环境。
- [x] 测试任一受保护文件变化触发重新确认和新环境。
- [x] 测试入口、requirements 和缓存路径均拒绝符号链接逃逸。
- [x] 测试安装日志过滤 token、认证 header 和敏感环境变量。
- [x] 测试取消安装后可安全重试，不留下可执行的半成品环境。

验证：

```bash
# packages/opencode
bun test test/skill-runtime/fingerprint.test.ts test/skill-runtime/trust.test.ts test/skill-runtime/environment.test.ts
bun typecheck
```

## Task 3：增加持久执行日志

**Files:**

- Create: `packages/core/src/skill/execution.sql.ts`
- Modify: `packages/core/src/database/schema.sql.ts`
- Add: generated migration under `packages/core/src/database/migration/`
- Create: `packages/opencode/src/skill-runtime/journal.ts`
- Create: `packages/opencode/test/skill-runtime/journal.test.ts`
- Add core schema/migration tests where existing conventions require

**Schema:**

- `skill_execution`：workflow、skill fingerprint、Location/Session 关联和当前执行状态。
- `skill_operation`：稳定 `operation_id`、action 类型、attempt、结果状态、时间、provider/model/cost 摘要和 result envelope。
- `skill_artifact`：受管路径引用、MIME、哈希、大小、生命周期和清理时间。

所有字段使用 snake_case。不得存储 prompt、完整图片内容、密钥或完整用户回答，除非现有 Session/Question 已作为其授权事实源；执行日志只保存恢复所需摘要和 skill result envelope。

- [x] 先写唯一键测试：`skill_fingerprint + workflow_id + operation_id`。
- [x] 测试 pending→running→terminal 的合法状态转移。
- [x] 测试 terminal result 不被不同结果覆盖。
- [x] 测试同一成功结果可被恢复流程读取并重放。
- [x] 测试 ambiguous provider crash 可持久化为 `uncertain`。
- [x] 使用仓库现有迁移流程生成并验证 migration。

验证：

```bash
# packages/core
bun run migration --name skill_execution
bun run migration --check
bun test
bun typecheck

# packages/opencode
bun test test/skill-runtime/journal.test.ts
bun typecheck
```

## Task 4：实现 JSON CLI 协议进程边界

**Files:**

- Create: `packages/opencode/src/skill-runtime/protocol.ts`
- Create: `packages/opencode/src/skill-runtime/process.ts`
- Create: `packages/opencode/src/skill-runtime/service.ts`
- Create: `packages/opencode/test/skill-runtime/protocol.test.ts`
- Create: `packages/opencode/test/skill-runtime/process.test.ts`
- Create: `packages/opencode/test/fixture/executable-skill/`

**Behavior:**

- stdin 写一个 JSON request，stdout 只接受一个 JSON response。
- stderr 作为诊断流，过滤后记录；stdout 混入日志视为协议错误。
- 入口使用隔离环境解释器，工作目录固定为 skill 根目录。
- 请求携带 request/workflow/revision；响应只按公共 envelope 解码。
- 进程超时、异常退出、取消和不支持版本映射为 typed errors。

- [x] fixture 提供合法响应、畸形 JSON、额外 stdout、stderr、超时、退出码和版本不匹配模式。
- [x] 测试进程环境不包含 provider key/OAuth token。
- [x] 测试 payload 大小、响应大小和诊断日志有明确上限。
- [x] 测试 Location 销毁会中断对应进程，不影响其他 Location。
- [x] 测试 stale revision 原样返回 skill 错误，不由 HyperCode重写业务状态。

验证：

```bash
# packages/opencode
bun test test/skill-runtime/protocol.test.ts test/skill-runtime/process.test.ts
bun typecheck
```

## Task 5：实现通用模型 capability router

**Files:**

- Create: `packages/opencode/src/capability/schema.ts`
- Create: `packages/opencode/src/capability/model-router.ts`
- Create: `packages/opencode/src/capability/model-health.ts`
- Create: `packages/opencode/src/capability/llm.ts`
- Create: `packages/opencode/test/capability/model-router.test.ts`
- Create: `packages/opencode/test/capability/llm.test.ts`

**Consumes:** action 的模态、结构化输出、工具、上下文、独立复核、质量/延迟等 capability requirements。

**Owns:** ModelsDev 筛选、用户排序、凭据可用性、健康探测、任务快照、免费优先、首次模型确认、付费确认和通用技术重试。

- [x] 测试 action 不提供 provider/model 时仍能确定性选择满足要求的候选。
- [x] 测试 skill 不能通过 payload 绕过用户的费用策略或凭据边界。
- [x] 测试独立复核不会选择被声明排除的主执行身份。
- [x] 测试 429/5xx/连接失败只执行有限技术重试并记录每次尝试。
- [x] 测试付费升级始终使用通用确认，不包含视频复刻文案。
- [x] LLM 调用使用现有 Location-scoped 服务，不桥接 legacy session loop，也不让 service layer 读取 `project-state.json`。

验证：

```bash
# packages/opencode
bun test test/capability/model-router.test.ts test/capability/llm.test.ts
bun typecheck
```

## Task 6：泛化图片生成并增加临时 artifact store

**Files:**

- Create: `packages/opencode/src/artifact/schema.ts`
- Create: `packages/opencode/src/artifact/store.ts`
- Refactor: `packages/opencode/src/image-generation/schema.ts`
- Refactor: `packages/opencode/src/image-generation/provider.ts`
- Refactor: `packages/opencode/src/image-generation/service.ts`
- Refactor: `packages/opencode/src/image-generation/path.ts`
- Refactor: `packages/opencode/src/tool/image-generate.ts`
- Update/Create: corresponding artifact and image-generation tests

**Required changes:**

- 将 `segmentID` 改为通用 `operationID`；移除视频分段命名和专用 guidance。
- provider 输出只能进入 HyperCode 受管 staging，不直接写 skill 项目目录。
- result 返回 `artifact_id`、受控读取引用、MIME、格式、哈希、大小、provider/model/attempt/cost。
- artifact 被 skill 确认导入后标记可清理；未确认 artifact 使用明确 TTL。

- [x] 保留当前格式嗅探、输入不覆盖、原子写入和秘密过滤测试。
- [x] 新增 artifact ID 不可猜测、读取授权、哈希、TTL 和清理幂等测试。
- [x] 测试 skill 不能借 artifact API 读取任意本机文件。
- [x] 测试图片 action requirements 由 capability router 选择模型，不使用视频专用池。
- [x] 若保留用户可直接调用的 `image_generate` 工具，它也必须返回通用 artifact，而不是项目业务文件。

验证：

```bash
# packages/opencode
bun test test/artifact test/image-generation test/tool/image-generate.test.ts
bun typecheck
```

## Task 7：调度 ready actions 并提供通用 `skill_run` 工具

**Files:**

- Create: `packages/opencode/src/skill-runtime/action.ts`
- Create: `packages/opencode/src/skill-runtime/executor.ts`
- Create: `packages/opencode/src/tool/skill-run.ts`
- Modify: `packages/opencode/src/tool/registry.ts`
- Create: `packages/opencode/test/skill-runtime/executor.test.ts`
- Create: `packages/opencode/test/tool/skill-run.test.ts`
- Retain/adjust: generic Question presentation backend and app tests

**Behavior:**

- `skill_run` 支持通用 `start/resume/status/cancel`，业务 input 作为受限 JSON 传给 skill。
- executor 调用协议入口，持久化 ready actions，按 `depends_on` 和返回批次调度。
- `llm.generate`、`image.generate` 和 `user.ask` 分别交给通用能力服务。
- Question 答案提交回 skill 校验；HyperCode 不判断批准句。
- `user.ask` 声明接受附件时，HyperCode 将用户文件转成受控临时 artifact 后再提交结果，不把本机任意路径直接交给 skill。
- 已完成 operation 从 journal 重放 result，不重新调用 provider。

- [x] 测试多个独立 ready actions 可按限额并发，不在同一批次或依赖未完成的 action 不并发。
- [x] 测试 skill 返回相同 operation 时复用 journal result。
- [x] 测试 Question reject/cancel 成为结构化 result 并交还 skill。
- [x] 测试 tool 输出只包含公共状态、presentation 和 artifact metadata。
- [x] 测试 executor 不读取 fixture 的私有 state 文件。
- [x] 测试两个不同 Location/workflow 可并行且状态隔离。

验证：

```bash
# packages/opencode
bun test test/skill-runtime/executor.test.ts test/tool/skill-run.test.ts test/question/presentation.test.ts
bun typecheck

# packages/app
bun test src/pages/session/composer/question-presentation.test.ts
bun typecheck
```

## Task 8：删除视频专用平台实现并泛化可复用代码

**Delete:**

- `packages/opencode/src/video-replica/**`
- `packages/opencode/src/tool/video-replica.ts`
- `packages/opencode/test/video-replica/**`
- `packages/opencode/test/tool/video-replica.test.ts`

**Modify:**

- `packages/opencode/src/tool/registry.ts`
- any generated SDK files affected by generic Question/tool API changes
- reports/docs that still claim HyperCode owns the video workflow

**Migration rules:**

- 仅将纯通用实现迁入 capability/artifact/skill-runtime 模块。
- 不通过改名保留 `approveStoryboard`、`acceptImage`、`compileDelivery`、segment parsing、QC prompt 或 Plus import 等领域函数。
- 不实现旧 `project-state.json.hypercode` 读取器。
- 删除前使用调用点搜索确认没有残留 import、service node、tool registry 或测试 fixture。

- [x] `rg` 验证 HyperCode 源码中不存在批准句和视频复刻阶段枚举。
- [x] `rg` 验证不存在对 `project-state.json` 视频业务字段的读写。
- [x] `rg` 验证 `doubao-video-replica` 只出现在历史文档或显式本机兼容测试配置中。
- [x] 运行受影响 package 的完整 typecheck 与 focused tests。

检查命令：

```bash
rg -n "批准分镜|approveStoryboard|acceptImage|compileDelivery|VideoReplica|video_replica|project-state.json" packages/opencode/src packages/app/src
```

## Task 9：SDK、恢复测试与真实 skill 本机纵向切片

**Files:**

- Modify generated SDK via `./packages/sdk/js/script/build.ts` only if public HTTP schemas changed
- Create: `packages/opencode/test/skill-runtime/recovery.test.ts`
- Create: opt-in local compatibility test/config following repository conventions
- Update: new design/plan status checkboxes or implementation report

- [x] 模拟协议错误/超时、provider 成功后 journal 提交中断，以及 journal 成功后 skill result 提交中断；artifact 导入由真实 skill 切片与其幂等测试覆盖。
- [x] 验证成功 result 重放、不确定结果显式化、取消持久化和无业务状态猜测。
- [x] 使用 fixture 跑完整自动纵向切片。
- [x] 显式启用本机测试，使用环境变量提供并发现真实 skill 路径，不硬编码 `C:\Users\28320`。
- [x] 跑通真实最小纵向切片：Question、LLM、图片 staging、skill 正式导入和重启恢复。
- [ ] 在最小切片稳定后，再逐步启用真实 provider 的多分段并发、双模型 QC 和付费兜底；本轮仅验证确定性本地替身与完整交付协议，不发起付费调用。
- [x] 本轮未修改公共 HTTP schema；已核对生成的 v2 SDK 包含现有 `QuestionPresentation`，生成文件与 `HEAD` 内容哈希一致，无需重新生成。

验证：

```bash
# packages/opencode
bun test test/skill-runtime test/capability test/artifact test/skill test/question
bun typecheck

# packages/app
bun test src/pages/session/composer/question-presentation.test.ts
bun typecheck

# packages/core
bun test
bun typecheck
```

## HyperCode 完成标准

- [x] 平台仅理解 executable-skill 公共协议和通用 actions。
- [x] 平台不读写视频复刻业务状态，不包含其 prompt、审批、QC 或交付规则。
- [x] manifest、信任、隔离环境、执行 journal 和 artifact store 均可供其他 skill 复用。
- [x] provider/model/费用策略由通用 capability router 统一执行。
- [x] 已持久化成功 result 在恢复时重放，不重复 provider 调用。
- [x] 旧视频专用模块、工具、service node 和复制业务测试已经删除。
- [x] fixture 自动测试和真实 skill 本机最小纵向切片均通过。
- [x] 所有相关 package 的 focused tests 与 `bun typecheck` 通过。
