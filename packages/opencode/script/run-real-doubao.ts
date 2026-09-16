import { Effect, Layer } from "effect"
import path from "node:path"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { InstanceRef } from "../src/effect/instance-ref"
import { ExecutableManifest } from "../src/skill/executable-manifest"
import { SkillEnvironment } from "../src/skill-runtime/environment"
import { SkillExecutor } from "../src/skill-runtime/executor"
import { SkillFingerprint } from "../src/skill-runtime/fingerprint"
import { SkillRuntimeJournal } from "../src/skill-runtime/journal"
import { Question } from "../src/question"

const skillRoot = "C:\\Users\\28320\\.codex\\skills\\doubao-video-replica"
const inputDirectory = "D:\\gs\\yuanyuan\\demo\\小推车置物架"
const projectDirectory = argument("--project-directory", path.join(inputDirectory, "HyperCode真实流程测试-2"))
const maxSteps = Number(argument("--max-steps", "200"))
const sessionID = "ses_real_doubao_20260910"

const originalFetch = globalThis.fetch
globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await originalFetch(input, init)
  const url = input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url
  if (!url.includes("chatgpt.com/backend-api/codex/responses") || response.ok) return response
  const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {}
  const messages = Array.isArray(body.input) ? body.input : []
  const content = messages.flatMap((message) =>
    typeof message === "object" && message !== null && Array.isArray((message as { content?: unknown }).content)
      ? (message as { content: Array<{ type?: unknown }> }).content
      : [],
  )
  console.error(JSON.stringify({
    codexFailure: {
      status: response.status,
      store: body.store,
      stream: body.stream,
      inputItems: messages.length,
      contentTypes: content.map((item) => item.type),
      detail: (await response.clone().text()).slice(0, 1000),
    },
  }))
  return response
}, { preconnect: originalFetch.preconnect })

function argument(name: string, fallback: string) {
  const index = Bun.argv.indexOf(name)
  return index >= 0 && Bun.argv[index + 1] ? Bun.argv[index + 1] : fallback
}

function journalLayer() {
  const operations = new Map<string, SkillRuntimeJournal.Operation>()
  let execution: Record<string, unknown> | undefined
  return Layer.succeed(
    SkillRuntimeJournal.Service,
    SkillRuntimeJournal.Service.of({
      openExecution: (value) =>
        Effect.sync(() => {
          if (execution) return execution as never
          execution = {
            id: value.id,
            skill_name: value.skillName,
            skill_fingerprint: value.skillFingerprint,
            workflow_id: value.workflowID,
            session_id: value.sessionID,
            location_directory: value.locationDirectory,
            workspace_id: value.workspaceID,
            declared_inputs: value.declaredInputs ?? [],
            status: "pending",
          }
          return execution as never
        }),
      setExecutionStatus: (value) =>
        Effect.sync(() => {
          if (execution) execution = { ...execution, status: value.status, revision: value.revision, result: value.result }
          return (execution ?? { id: value.id, status: value.status }) as never
        }),
      admitOperation: (value) =>
        Effect.sync(() => {
          const current = operations.get(value.operationID)
          if (current) return current
          const created = {
            executionID: value.executionID,
            actionType: value.actionType,
            status: "pending" as const,
            attempt: 0,
          }
          operations.set(value.operationID, created)
          return created
        }),
      startOperation: (value) =>
        Effect.sync(() => {
          const current = operations.get(value.operationID)!
          const started = { ...current, status: "running" as const, attempt: current.attempt + 1 }
          operations.set(value.operationID, started)
          return started
        }),
      completeOperation: (value) =>
        Effect.sync(() => {
          const current = operations.get(value.operationID)!
          if (current.result) return { operation: current, replayed: true }
          const completed = { ...current, status: value.status, result: value.result }
          operations.set(value.operationID, completed)
          return { operation: completed, replayed: false }
        }),
      getOperation: (value) => Effect.sync(() => operations.get(value.operationID)),
    }),
  )
}

const program = Effect.gen(function* () {
  const manifest = yield* ExecutableManifest.load(skillRoot)
  if (!manifest) throw new Error("doubao-video-replica 缺少 executable manifest")
  const fingerprint = yield* SkillFingerprint.calculate(skillRoot, manifest)
  const environment = yield* SkillEnvironment.make({
    run: (command, options) =>
      Effect.tryPromise({
        try: async () => {
          const process = Bun.spawn([...command], {
            cwd: options.cwd,
            env: { ...options.env },
            stdout: "pipe",
            stderr: "pipe",
          })
          return {
            exitCode: await process.exited,
            stdout: await new Response(process.stdout).text(),
            stderr: await new Response(process.stderr).text(),
          }
        },
        catch: (error) => error,
      }),
  }).prepare({
    skill: "doubao-video-replica",
    skillRoot,
    fingerprint: fingerprint.value,
    manifest,
    installApproved: true,
  })
  const executor = yield* SkillExecutor.Service
  const base = {
    skillName: "doubao-video-replica",
    skillFingerprint: fingerprint.value,
    skillRoot,
    python: environment.python,
    entrypoint: manifest.entrypoint[1],
    actions: manifest.actions,
    projectDirectory,
    sessionID,
    policy: {
      confirmedModels: [],
      order: ["openai/gpt-5.5-image", "openai/gpt-5.5"],
      cost: "free-only" as const,
      allowedProviders: ["openai"],
    },
    concurrency: 1,
  }
  const stateFile = Bun.file(path.join(projectDirectory, "project-state.json"))
  const state = (yield* Effect.promise(() => stateFile.exists()))
    ? ((yield* Effect.promise(() => stateFile.json())) as {
        workflow: { workflow_id: string; revision: number }
      })
    : undefined
  let output = yield* executor.run(
    state
      ? {
          ...base,
          command: "resume",
          workflowID: state.workflow.workflow_id,
          expectedRevision: state.workflow.revision,
          payload: {},
        }
      : {
          ...base,
          command: "start",
          payload: {
            product_name: "小推车置物架",
            reference_video: path.join(inputDirectory, "小推车置物架.mp4"),
            product_images: [
              path.join(inputDirectory, "小推车置物架", "小推车置物架——正视图.png"),
              path.join(inputDirectory, "小推车置物架", "小推车置物架——侧视图.png"),
              path.join(inputDirectory, "小推车置物架", "小推车置物架——俯视图.png"),
              path.join(inputDirectory, "小推车置物架", "小推车置物架——细节图.png"),
            ],
          },
        },
  )
  print("start", output)
  for (let index = 0; index < maxSteps && output.status === "running"; index++) {
    output = yield* executor.run({
      ...base,
      command: "resume",
      workflowID: output.workflowID,
      expectedRevision: output.revision,
      payload: {},
    })
    print(`resume-${index + 1}`, output)
  }
  if (output.workflowID) {
    const status = yield* executor.run({
      ...base,
      command: "status",
      workflowID: output.workflowID,
      expectedRevision: output.revision,
      payload: {},
    })
    print("status", status)
  }
})

function answer(question: Question.Info | undefined): Question.Answer {
  if (!question) return ["取消"]
  const approval = question.options.find((option) => option.label.includes("批准分镜"))
  if (approval) return [approval.label]
  const allow = question.options.find((option) => option.label.includes("允许") || option.label.includes("确认"))
  return [allow?.label ?? question.options[0]?.label ?? "取消"]
}

function print(step: string, output: SkillExecutor.Output) {
  console.log(
    JSON.stringify({
      step,
      status: output.status,
      workflowID: output.workflowID,
      revision: output.revision,
      pendingActions: output.pendingActions,
      presentations: output.presentations.map((item) => ({ operationID: item.operationID, header: item.header })),
      artifacts: output.artifacts,
      error: output.error,
    }),
  )
}

const questionLayer = Layer.succeed(
  Question.Service,
  Question.Service.of({
    ask: (input) => Effect.succeed([answer(input.questions[0])]),
    reply: () => Effect.void,
    reject: () => Effect.void,
    list: () => Effect.succeed([]),
  }),
)
const executorLayer = LayerNode.buildLayer(SkillExecutor.node, {
  replacements: [
    LayerNode.replace(Question.node, questionLayer),
    LayerNode.replace(SkillRuntimeJournal.node, journalLayer()),
  ],
})
const runnable = program.pipe(
  Effect.provide(executorLayer),
  Effect.provide(FSUtil.defaultLayer),
  Effect.provideService(InstanceRef, {
    directory: projectDirectory,
    worktree: projectDirectory,
    project: undefined as never,
  }),
) as Effect.Effect<void, unknown, never>

Effect.runPromise(runnable).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
