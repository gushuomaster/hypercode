# Video Replica Workflow Implementation Plan

> **状态：已于 2026-09-04 被取代，禁止继续执行本文任务。** 本计划把视频复刻业务状态机继续实现到了 HyperCode 中，违背了重新确认的职责边界。替代计划为 [`2026-09-04-doubao-video-replica-skill-protocol.md`](./2026-09-04-doubao-video-replica-skill-protocol.md) 与 [`2026-09-04-hypercode-executable-skill-runtime.md`](./2026-09-04-hypercode-executable-skill-runtime.md)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows 桌面版 HyperCode 中接入只读的个人 `doubao-video-replica` skill，完成视频分析、分镜审批、免费模型优先的首帧生成、严格质检、Plus 人工回传和最终豆包交付编译。

**Architecture:** 后端以 Location-scoped 服务拆分 skill 发现兼容层、图片生成 adapter、模型池、视频复刻工作流和质检/交付编译；Question 服务承载所有人工确认，桌面端只负责通用展示 `presentation` 数据。外部 skill 的脚本和 `project-state.json` 保持唯一业务事实源，HyperCode 只写入 `hypercode` 集成命名空间并通过公开脚本参数桥接。

**Tech Stack:** TypeScript, Effect, Bun, existing `ModelsDev`, `Auth`, `Question`, HTTP API/SDK, SolidJS desktop app, Windows process and filesystem APIs.

**Spec:** `docs/superpowers/specs/2026-09-02-video-replica-workflow-design.md`

## Global Constraints

- 首版仅支持 Windows 桌面应用和当前电脑，不对外分发或修改个人 skill。
- 外部 `C:\Users\28320\.codex\skills\doubao-video-replica` 及 ZIP、缓存、资产库只读；skill 改进必须另开任务、分支、计划和提交。
- 自动识别参考视频与替换产品图，也支持显式调用；首次选择输出目录，状态保存在项目目录。
- 超过 60 秒的视频拆为不超过 60 秒章节；最终只交付已验收首帧、逐段豆包提示词、状态和性能报告。
- 免费编排模型和免费图片模型优先；免费模型可同级自动切换并通知用户；升级 ChatGPT Plus 或任何付费图片模型前必须人工确认。
- 模型目录只使用现有 `ModelsDev`，候选必须 provider 在白名单、`status === active`、输入支持 `text/image/video`、支持工具调用、输入/输出成本为 0，并通过最小结构化输出与工具健康检查；任务启动时冻结池快照。
- 图片池固定优先 `qwen/qwen-image-edit`、`black-forest-labs/flux_1-kontext-dev`；每段每波只生成一张 9:16 图片，默认并发 4，429/5xx/会话错误降并发并逐步恢复，技术错误最多重试一次。
- 所有输出先写同目录临时文件，校验 MIME/格式后原子改名；不得覆盖原始视频或产品图，路径拒绝 `..`、盘符切换和符号链接逃逸。
- 凭据优先 HyperCode Auth/Account，环境变量仅兜底；明文 key 不进入状态、日志、前端或工具输出。
- 缺 Python 依赖先请求用户确认再创建隔离虚拟环境；缺 skill、FFmpeg/FFprobe、媒体不可读或时间戳不可靠时停止并报告，不猜测继续。
- Question 继续使用现有阻塞/回复/拒绝生命周期；所有付费确认、新模型首次使用、依赖安装和最终图片验收均为独立问题。
- 测试从 package 目录运行；类型检查使用 `bun typecheck`，禁止从仓库根运行测试或直接调用 `tsc`。

---

### Task 1: Codex 个人 Skill 发现兼容层

**Files:**
- Modify: `packages/opencode/src/skill/index.ts`
- Test: `packages/opencode/test/skill/skill.test.ts`
- Modify: `packages/opencode/src/effect/runtime-flags.ts` only if a new explicit disable flag is required by existing flag conventions

**Interfaces:**
- Consumes: `Global.home`, `FSUtil`, `Config`, `RuntimeFlags.disableExternalSkills`, existing `Skill.Info` parsing and duplicate precedence.
- Produces: `Skill.Service.all/get/require/dirs/available` entries for `<home>/.codex/skills/**/SKILL.md`; no file copying or script execution.

- [ ] **Step 1: Write the failing tests**

```ts
it.live("discovers Codex personal skills from ~/.codex/skills", () =>
  Effect.gen(function* () {
    const skillDir = path.join(tmp.path, ".codex", "skills", "codex-test")
    yield* Effect.promise(() => fs.mkdir(skillDir, { recursive: true }))
    yield* Effect.promise(() => fs.writeFile(path.join(skillDir, "SKILL.md"), "---\nname: codex-test\ndescription: personal\n---\nbody"))
    const skill = yield* Skill.Service
    const item = (yield* skill.all()).find((entry) => entry.name === "codex-test")
    expect(item?.location).toContain(path.join(".codex", "skills", "codex-test", "SKILL.md"))
  }).pipe(Effect.provide(testLayer)))

it.live("does not discover Codex skills when external skills are disabled", () =>
  Effect.gen(function* () {
    const skill = yield* Skill.Service
    expect((yield* skill.all()).some((entry) => entry.name === "codex-test")).toBe(false)
  }).pipe(Effect.provide(disabledExternalSkillsLayer)))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/skill/skill.test.ts -t "Codex personal skills"` from `packages/opencode`.
Expected: FAIL because `~/.codex/skills` is not scanned.

- [ ] **Step 3: Implement the minimal discovery change**

Add a `.codex` external directory constant to the existing global external scan list, retaining `disableExternalSkills`, `disableClaudeCodeSkills`, duplicate warning, and path precedence. Do not add hard-coded `C:\Users\28320` paths; use `global.home`.

- [ ] **Step 4: Run tests and typecheck**

Run: `bun test test/skill/skill.test.ts -t "Codex"` and `bun typecheck` from `packages/opencode`.
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/skill/index.ts packages/opencode/test/skill/skill.test.ts packages/opencode/src/effect/runtime-flags.ts
git commit -m "feat(opencode): discover personal Codex skills"
```

### Task 2: 图片生成 Adapter 与安全落盘

**Files:**
- Create: `packages/opencode/src/image-generation/schema.ts`
- Create: `packages/opencode/src/image-generation/provider.ts`
- Create: `packages/opencode/src/image-generation/service.ts`
- Create: `packages/opencode/src/image-generation/path.ts`
- Create: `packages/opencode/src/tool/image-generate.ts`
- Modify: `packages/opencode/src/tool/registry.ts`
- Test: `packages/opencode/test/image-generation/service.test.ts`
- Test: `packages/opencode/test/image-generation/path.test.ts`

**Interfaces:**
- Consumes: `Auth.Service`, environment variables `NVIDIA_API_KEY`/`OPENAI_API_KEY`, `Session` tool context, segment id/prompt/reference image paths/output directory.
- Produces: `ImageGeneration.Request`, `ImageGeneration.Result`, `ImageGeneration.Service.generate(request)`, and an `image_generate` tool that returns attachment metadata without secrets.

Define these stable types in `schema.ts`:

```ts
export type Request = {
  segmentID: string
  prompt: string
  referenceImages: ReadonlyArray<string>
  outputDirectory: string
  modelPool: ReadonlyArray<{ provider: "nvidia" | "openai"; model: string }>
  width: 9
  height: 16
}
export type Result = {
  segmentID: string
  filePath: string
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  provider: "nvidia" | "openai"
  model: string
  attempts: number
  elapsedMs: number
  cost: { amount?: number; currency?: string; known: boolean }
}
```

- [ ] **Step 1: Write failing adapter and path tests**

```ts
it("rejects output paths outside the selected project directory", async () => {
  await expect(normalizeOutputPath("C:\\work\\project", "..\\escape.png")).rejects.toThrow()
})

it("writes a successful response atomically and never overwrites inputs", async () => {
  const result = await service.generate({ segmentID: "seg-1", prompt: "test", referenceImages: [reference], outputDirectory, modelPool, width: 9, height: 16 })
  expect(result.filePath).toMatch(/seg-1.*\.(png|jpe?g|webp)$/)
  expect(await Bun.file(result.filePath).exists()).toBe(true)
  expect(await Bun.file(reference).text()).toBe(referenceBytes)
})
```

- [ ] **Step 2: Run focused tests to confirm failure**

Run: `bun test test/image-generation/path.test.ts test/image-generation/service.test.ts` from `packages/opencode`.
Expected: FAIL because the modules and service are absent.

- [ ] **Step 3: Implement provider adapters and safe persistence**

Implement OpenAI-compatible NVIDIA image-edit requests with only the minimum reference images, an OpenAI Images request for `gpt-image-1-mini`, credential lookup Auth then environment, status/cost metadata, one technical retry, temporary-file validation, atomic rename, and confinement to the chosen output directory. Never include request headers, keys, or image bytes in logs/tool output.

- [ ] **Step 4: Register tool and run tests/typecheck**

Register `image_generate` in `packages/opencode/src/tool/registry.ts`. Run `bun test test/image-generation` and `bun typecheck` from `packages/opencode`; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/image-generation packages/opencode/src/tool/image-generate.ts packages/opencode/src/tool/registry.ts packages/opencode/test/image-generation
git commit -m "feat(opencode): add safe image generation service"
```

### Task 3: 编排/图片模型池筛选、冻结与故障转移

**Files:**
- Create: `packages/opencode/src/video-replica/model-pool.ts`
- Create: `packages/opencode/src/video-replica/model-health.ts`
- Test: `packages/opencode/test/video-replica/model-pool.test.ts`

**Interfaces:**
- Consumes: `ModelsDev.Service.get()`, provider allowlist/configuration, adapter health probe.
- Produces: `ModelPool.Candidate`, `ModelPool.Snapshot`, `ModelPool.discover()`, `ModelPool.freeze()`, `ModelPool.nextAfterFailure()`, `ModelPool.exhausted()`.

Use these shapes:

```ts
export type Candidate = { providerID: string; modelID: string; kind: "orchestration" | "image"; requiresConfirmation: boolean }
export type Snapshot = { createdAt: string; orchestration: ReadonlyArray<Candidate>; image: ReadonlyArray<Candidate> }
```

- [ ] **Step 1: Write failing filtering/failover tests**

```ts
it("filters deprecated, paid, modality-incompatible models and marks new models pending confirmation", () => {
  expect(discoverCandidates(catalog, config)).toEqual([{ providerID: "nvidia", modelID: "muse-spark-1.2-contributor-free", kind: "orchestration", requiresConfirmation: true }])
})

it("freezes a task snapshot and switches only within the same pool", () => {
  const snapshot = freeze(pool)
  expect(nextAfterFailure(snapshot, snapshot.orchestration[0])).toEqual(snapshot.orchestration[1])
  expect(nextAfterFailure(snapshot, snapshot.orchestration.at(-1)!)).toBeUndefined()
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test test/video-replica/model-pool.test.ts` from `packages/opencode`.
Expected: FAIL because pool functions are not implemented.

- [ ] **Step 3: Implement discovery, health, confirmation and exhaustion**

Apply the exact global filters, deterministic user-configured ordering, health-check results, pending-confirmation state, task-start snapshot, same-tier automatic switching with chat notification hooks, and explicit exhaustion result that blocks Plus escalation until Question confirmation.

- [ ] **Step 4: Run tests/typecheck and commit**

Run `bun test test/video-replica/model-pool.test.ts` and `bun typecheck` from `packages/opencode`; expected PASS.

```bash
git add packages/opencode/src/video-replica/model-pool.ts packages/opencode/src/video-replica/model-health.ts packages/opencode/test/video-replica/model-pool.test.ts
git commit -m "feat(opencode): add frozen model pools and failover"
```

### Task 4: Question 展示协议、HTTP API 与桌面确认 UI

**Files:**
- Modify: `packages/opencode/src/question/schema.ts`
- Modify: `packages/opencode/src/question/index.ts` only where serialization preserves existing lifecycle
- Modify: `packages/opencode/src/server/routes/instance/httpapi/groups/question.ts`
- Modify: generated SDK via `./packages/sdk/js/script/build.ts`
- Modify: `packages/app/src/pages/session/composer/session-question-dock.tsx`
- Create: `packages/app/src/pages/session/composer/question-presentation.ts`
- Test: `packages/opencode/test/question/presentation.test.ts`
- Test: `packages/app/src/pages/session/composer/question-presentation.test.ts`

**Interfaces:**
- Consumes: existing `Question.Info/Request/Reply`, image attachment URLs, model/cost/risk facts.
- Produces: optional `presentation: { images?: ReadonlyArray<{ url: string; alt: string }>; facts?: ReadonlyArray<{ label: string; value: string }>; tone?: "normal" | "warning" | "payment" }` on `Question.Info`, preserved by HTTP/SDK, rendered by the existing dock.

- [ ] **Step 1: Write failing schema, serialization and renderer tests**

```ts
it("accepts presentation fields without breaking legacy questions", () => {
  expect(Schema.decodeUnknownSync(Question.Info)({ question: "ok", header: "h", options: [], presentation: { tone: "warning", facts: [{ label: "segment", value: "seg-1" }] } })).toMatchObject({ presentation: { tone: "warning" } })
})

it("maps presentation facts and thumbnails to stable render data", () => {
  expect(toPresentationView(request.questions[0])).toEqual(expect.objectContaining({ tone: "payment", facts: expect.any(Array), images: expect.any(Array) }))
})
```

- [ ] **Step 2: Run focused tests to confirm failure**

Run `bun test test/question/presentation.test.ts` from `packages/opencode` and `bun test src/pages/session/composer/question-presentation.test.ts` from `packages/app`; expected FAIL until schema/view adapter exists.

- [ ] **Step 3: Implement optional presentation contract and UI**

Keep all existing question answer/reject behavior and legacy payload compatibility. Render facts, cost, risk tone, segment number and clickable thumbnails using the existing image preview component; do not embed video-replica enums in generic UI.

- [ ] **Step 4: Regenerate SDK and verify**

Run `./packages/sdk/js/script/build.ts`, focused tests, and `bun typecheck` from both `packages/opencode` and `packages/app`; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/question packages/opencode/src/server/routes/instance/httpapi/groups/question.ts packages/app/src/pages/session/composer packages/sdk
git commit -m "feat(question): add review presentation data"
```

### Task 5: VideoReplica 工作流协调、状态检查点与 skill 脚本桥接

**Files:**
- Create: `packages/opencode/src/video-replica/schema.ts`
- Create: `packages/opencode/src/video-replica/paths.ts`
- Create: `packages/opencode/src/video-replica/skill-bridge.ts`
- Create: `packages/opencode/src/video-replica/service.ts`
- Create: `packages/opencode/src/tool/video-replica.ts`
- Modify: `packages/opencode/src/tool/registry.ts`
- Test: `packages/opencode/test/video-replica/service.test.ts`
- Test: `packages/opencode/test/video-replica/skill-bridge.test.ts`

**Interfaces:**
- Consumes: `Skill.Service.require("doubao-video-replica")`, `Question.Service`, `ModelPool`, `ImageGeneration.Service`, Windows `python`/`ffmpeg`/`ffprobe`, selected output directory.
- Produces: `VideoReplica.Service.start(input)`, `resume(workflowID)`, `approveStoryboard(workflowID, segmentIDs)`, `acceptImage(workflowID, segmentID, decision)`, `importPlusImage(workflowID, filePath)`, and `compileDelivery(workflowID)`.

Define checkpoint state in `schema.ts` exactly under the external state file's `hypercode` namespace:

```ts
export type Checkpoint = { phase: "analysis" | "approval" | "generation" | "qc" | "delivery"; segment_ids: ReadonlyArray<string>; pending_action: string | null }
export type HypercodeState = { schema_version: 1; workflow_id: string; chapter: number; orchestration_pool: ReadonlyArray<string>; image_pool: ReadonlyArray<string>; approved_models: ReadonlyArray<string>; checkpoint: Checkpoint; approvals: ReadonlyArray<{ segment_id: string; decision: string; at: string }>; provider_attempts: ReadonlyArray<{ provider: string; model: string; status: string; at: string }> }
```

- [ ] **Step 1: Write failing end-to-end service tests**

```ts
it("stops before generation until the exact storyboard approval answer is received", async () => {
  const run = service.start({ referenceVideo, productImages, outputDirectory })
  expect(await run.nextQuestion()).toMatchObject({ questions: [{ header: "批准分镜" }] })
  await expect(run.generate()).rejects.toThrow("批准分镜，开始生成首帧图片")
})

it("resumes from the persisted checkpoint without repeating completed paid work", async () => {
  const state = await readState(outputDirectory)
  const resumed = await service.resume(state.workflow_id)
  expect(resumed.providerAttempts).not.toContainEqual(expect.objectContaining({ status: "repeat" }))
})
```

- [ ] **Step 2: Run tests to verify failure**

Run `bun test test/video-replica/service.test.ts test/video-replica/skill-bridge.test.ts` from `packages/opencode`; expected FAIL because workflow service is absent.

- [ ] **Step 3: Implement guarded workflow and script bridge**

Validate Windows and tool paths, ask for output directory and dependency installation confirmation, invoke only the skill's documented `init_project.py`, `inspect_video.py`, visual-asset scripts and `delivery_compiler.py`, split long videos into <=60-second chapters, persist atomic `project-state.json` updates, expose the exact storyboard approval text, and delegate image generation/QC to Tasks 2/3/6. Reject missing skill/dependencies/media and unsafe paths with typed actionable errors.

- [ ] **Step 4: Register tool, run tests/typecheck and commit**

Run focused tests and `bun typecheck` from `packages/opencode`; expected PASS.

```bash
git add packages/opencode/src/video-replica packages/opencode/src/tool/video-replica.ts packages/opencode/src/tool/registry.ts packages/opencode/test/video-replica
git commit -m "feat(opencode): orchestrate video replica workflow"
```

### Task 6: 严格质检、Plus 人工回传与最终交付编译

**Files:**
- Create: `packages/opencode/src/video-replica/qc.ts`
- Create: `packages/opencode/src/video-replica/plus-import.ts`
- Create: `packages/opencode/src/video-replica/delivery.ts`
- Test: `packages/opencode/test/video-replica/qc.test.ts`
- Test: `packages/opencode/test/video-replica/plus-import.test.ts`
- Test: `packages/opencode/test/video-replica/delivery.test.ts`

**Interfaces:**
- Consumes: approved segment data, product reference images, generated image files, free orchestration model, second free model, `Question.Service`, external skill state and delivery compiler.
- Produces: `QcResult`, `Qc.evaluate()`, `Qc.retryOnce()`, `PlusImport.matchAndPropose()`, `Delivery.compile()` with accepted images, per-segment Doubao prompts, status and performance report.

- [ ] **Step 1: Write failing QC/import/delivery tests**

```ts
it("fails hard on a visible product logo or interface mismatch", () => {
  expect(qcResult({ logo: "mismatch", shape: "match", interfaces: "match" }).status).toBe("failed")
})

it("allows exactly one quality retry and records a forced acceptance risk", () => {
  expect(retryOnce({ segmentID: "seg-1", attempts: 1 }).attempts).toBe(2)
  expect(forceAccept({ segmentID: "seg-1", risk: "logo mismatch" }).decision).toBe("force-accepted")
})

it("requires user confirmation after Plus upload matching", () => {
  expect(matchAndPropose([{ name: "seg-2-plus.png" }])[0].requiresConfirmation).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify failure**

Run `bun test test/video-replica/qc.test.ts test/video-replica/plus-import.test.ts test/video-replica/delivery.test.ts` from `packages/opencode`; expected FAIL because these modules are absent.

- [ ] **Step 3: Implement strict QC, bounded retries, and manual Plus path**

Require checks for text/logo, shape/proportion/interfaces/components, color/material, pose/composition/9:16, watermark/subtitle/duplicate-product/artifacts. Invoke the second free model only when the primary conclusion is uncertain; retry each image at most once; preserve old rejected versions; show warning and persist timestamp/reason for force acceptance. Generate Plus prompt/reference bundles only, match uploaded files by optional segment id plus visual evidence, and require a separate Question confirmation.

- [ ] **Step 4: Compile final delivery and verify**

Call the external `delivery_compiler.py` with accepted images and state, verify output contains only accepted frames, per-segment Doubao prompts, status and performance report, and never invokes Doubao or edits video/audio. Run focused tests and `bun typecheck` from `packages/opencode`.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode/src/video-replica/qc.ts packages/opencode/src/video-replica/plus-import.ts packages/opencode/src/video-replica/delivery.ts packages/opencode/test/video-replica
git commit -m "feat(opencode): add strict frame QC and delivery"
```

## Self-Review Checklist

- [ ] Scan this plan for unresolved placeholders, vague instructions, and undefined function names.
- [ ] Confirm every produced interface is consumed by a later task with identical field names and types.
- [ ] Confirm all design requirements map to Tasks 1–6: Windows-only checks, read-only skill boundary, model discovery/freeze/failover, payment/new-model/dependency/image approvals, atomic output, strict QC, Plus upload confirmation, checkpoint resume, and final delivery scope.
- [ ] After implementation, run `bun test` only from `packages/opencode`/`packages/app`, then `bun typecheck`; do not claim completion without command output.
