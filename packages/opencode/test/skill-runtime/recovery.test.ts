import { describe, expect, test } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { SkillRuntimeAction } from "../../src/skill-runtime/action"
import { SkillExecutor } from "../../src/skill-runtime/executor"
import { SkillRuntimeJournal } from "../../src/skill-runtime/journal"
import { SkillProtocol } from "../../src/skill-runtime/protocol"
import { SkillRuntime } from "../../src/skill-runtime/service"

const action: SkillProtocol.Action = {
  operation_id: "generate-1",
  type: "llm.generate",
  depends_on: [],
  requirements: {},
  payload: { prompt: "test" },
}

const response = (ready: SkillProtocol.Action[], status: SkillProtocol.Response["status"], revision: number): SkillProtocol.Response => ({
  protocol_version: "1.0",
  request_id: "request",
  workflow_id: "workflow-recovery",
  revision,
  status,
  ready_actions: ready,
  artifacts: [],
  error: null,
})

const baseInput: SkillExecutor.Input = {
  command: "start",
  skillName: "fixture",
  skillFingerprint: "b".repeat(64),
  skillRoot: "C:\\fixture",
  python: "python",
  entrypoint: "main.py",
  actions: ["llm.generate"],
  projectDirectory: process.cwd(),
  sessionID: "ses_recovery",
  payload: {},
  policy: { confirmedModels: [], order: [], cost: "free-only" },
}

const successfulResult = (): SkillRuntimeAction.Result => ({
  operation_id: action.operation_id,
  status: "succeeded",
  output: { text: "done" },
  execution: { provider: "test", model: "test", attempts: 1, elapsed_ms: 1, cost: { known: false } },
  error: null,
})

function journalLayer(options: { failCompleteOnce?: boolean } = {}) {
  let operation: SkillRuntimeJournal.Operation | undefined
  let failComplete = options.failCompleteOnce === true
  return Layer.succeed(SkillRuntimeJournal.Service, SkillRuntimeJournal.Service.of({
    openExecution: (value) => Effect.succeed({ id: value.id, status: "pending" } as never),
    setExecutionStatus: (value) => Effect.succeed({ id: value.id, status: value.status } as never),
    admitOperation: (value) => Effect.sync(() => {
      if (operation) return operation
      operation = { executionID: value.executionID, actionType: value.actionType, status: "pending", attempt: 0 }
      return operation
    }),
    startOperation: () => Effect.sync(() => {
      operation = { ...operation!, status: "running", attempt: operation!.attempt + 1 }
      return operation
    }),
    completeOperation: (value) => Effect.suspend(() => {
      if (failComplete) {
        failComplete = false
        return Effect.die(new Error("simulated journal boundary crash"))
      }
      if (operation?.result) return Effect.succeed({ operation, replayed: true as boolean })
      operation = { ...operation!, status: value.status, result: value.result }
      return Effect.succeed({ operation, replayed: false as boolean })
    }),
    getOperation: () => Effect.sync(() => operation),
  }))
}

function execute(
  input: SkillExecutor.Input,
  runtime: SkillRuntime.Interface,
  actions: SkillRuntimeAction.Interface,
  journal: Layer.Layer<SkillRuntimeJournal.Service>,
) {
  return Effect.gen(function* () {
    return yield* (yield* SkillExecutor.Service).run(input)
  }).pipe(
    Effect.provide(SkillExecutor.layer),
    Effect.provide(Layer.succeed(SkillRuntime.Service, SkillRuntime.Service.of(runtime))),
    Effect.provide(Layer.succeed(SkillRuntimeAction.Service, SkillRuntimeAction.Service.of(actions))),
    Effect.provide(journal),
  )
}

describe("skill executor recovery boundaries", () => {
  test("does not repeat a provider call whose journal commit was interrupted", async () => {
    const journal = journalLayer({ failCompleteOnce: true })
    let calls = 0
    let submitted: SkillRuntimeAction.Result | undefined
    const runtime: SkillRuntime.Interface = {
      invoke: (request) => {
        if (request.request.command === "submit_result") {
          submitted = request.request.payload.result as SkillRuntimeAction.Result
          return Effect.succeed({ response: response([], "completed", 2) })
        }
        return Effect.succeed({ response: response([action], "running", 1) })
      },
    }
    const actions: SkillRuntimeAction.Interface = {
      run: () => Effect.sync(() => {
        calls++
        return successfulResult()
      }),
    }

    const first = await Effect.runPromiseExit(execute(baseInput, runtime, actions, journal))
    expect(Exit.isFailure(first)).toBe(true)
    const recovered = await Effect.runPromise(execute(
      { ...baseInput, command: "resume", workflowID: "workflow-recovery" },
      runtime,
      actions,
      journal,
    ))

    expect(recovered.status).toBe("completed")
    expect(calls).toBe(1)
    expect(submitted?.status).toBe("uncertain")
    expect(submitted?.error).toMatchObject({ code: "interrupted-operation" })
  })

  test("replays a durable result when skill submission was interrupted", async () => {
    const journal = journalLayer()
    let calls = 0
    let submissions = 0
    const runtime: SkillRuntime.Interface = {
      invoke: (request) => {
        if (request.request.command !== "submit_result") {
          return Effect.succeed({ response: response([action], "running", 1) })
        }
        submissions++
        if (submissions === 1) return Effect.die(new Error("simulated submit boundary crash"))
        return Effect.succeed({ response: response([], "completed", 2) })
      },
    }
    const actions: SkillRuntimeAction.Interface = {
      run: () => Effect.sync(() => {
        calls++
        return successfulResult()
      }),
    }

    const first = await Effect.runPromiseExit(execute(baseInput, runtime, actions, journal))
    expect(Exit.isFailure(first)).toBe(true)
    const recovered = await Effect.runPromise(execute(
      { ...baseInput, command: "resume", workflowID: "workflow-recovery" },
      runtime,
      actions,
      journal,
    ))

    expect(recovered.status).toBe("completed")
    expect(calls).toBe(1)
    expect(submissions).toBe(2)
  })
})
