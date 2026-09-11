import { describe, expect, it } from "bun:test"
import { Deferred, Effect, Fiber, Layer } from "effect"
import { SkillExecutor } from "../../src/skill-runtime/executor"
import { SkillRuntime } from "../../src/skill-runtime/service"
import { SkillRuntimeAction } from "../../src/skill-runtime/action"
import { SkillRuntimeJournal } from "../../src/skill-runtime/journal"
import { SkillProtocol } from "../../src/skill-runtime/protocol"
import path from "node:path"
import { tmpdir } from "../fixture/fixture"

const action = (operationID: string, dependsOn: string[] = []): SkillProtocol.Action => ({
  operation_id: operationID,
  type: "llm.generate",
  depends_on: dependsOn,
  requirements: {},
  payload: { prompt: operationID },
})

const response = (
  readyActions: SkillProtocol.Action[],
  status: SkillProtocol.Response["status"] = "running",
  revision = 1,
): SkillProtocol.Response => ({
  protocol_version: "1.0",
  request_id: "mock",
  workflow_id: "workflow-1",
  revision,
  status,
  ready_actions: readyActions,
  artifacts: [],
  error: null,
})

const input: SkillExecutor.Input = {
  command: "start",
  skillName: "fixture",
  skillFingerprint: "a".repeat(64),
  skillRoot: "C:\\fixture",
  python: "python",
  entrypoint: "main.py",
  actions: ["llm.generate", "user.ask"],
  projectDirectory: process.cwd(),
  sessionID: "ses_fixture",
  payload: {},
  policy: { confirmedModels: [], order: [], cost: "free-only" },
  concurrency: 2,
}

function journalLayer() {
  const operations = new Map<string, SkillRuntimeJournal.Operation>()
  const key = (identity: SkillRuntimeJournal.OperationIdentity) => `${identity.skillFingerprint}/${identity.workflowID}/${identity.operationID}`
  return Layer.succeed(SkillRuntimeJournal.Service, SkillRuntimeJournal.Service.of({
    openExecution: (value) => Effect.succeed({ id: value.id, status: "pending" } as never),
    setExecutionStatus: (value) => Effect.succeed({ id: value.id, status: value.status } as never),
    admitOperation: (value) => Effect.sync(() => {
      const current = operations.get(key(value))
      if (current) return current
      const created = { executionID: value.executionID, actionType: value.actionType, status: "pending" as const, attempt: 0 }
      operations.set(key(value), created)
      return created
    }),
    startOperation: (value) => Effect.sync(() => {
      const current = operations.get(key(value))!
      const started = { ...current, status: "running" as const, attempt: current.attempt + 1 }
      operations.set(key(value), started)
      return started
    }),
    completeOperation: (value) => Effect.sync(() => {
      const current = operations.get(key(value))!
      if (current.result) return { operation: current, replayed: true }
      const completed = { ...current, status: value.status, result: value.result }
      operations.set(key(value), completed)
      return { operation: completed, replayed: false }
    }),
    getOperation: (value) => Effect.sync(() => operations.get(key(value))),
  }))
}

function run(
  runtime: SkillRuntime.Interface,
  actions: SkillRuntimeAction.Interface,
  runInput: SkillExecutor.Input = input,
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* SkillExecutor.Service).run(runInput)
    }).pipe(
      Effect.provide(SkillExecutor.layer),
      Effect.provide(Layer.succeed(SkillRuntime.Service, SkillRuntime.Service.of(runtime))),
      Effect.provide(Layer.succeed(SkillRuntimeAction.Service, SkillRuntimeAction.Service.of(actions))),
      Effect.provide(journalLayer()),
    ),
  )
}

function result(operationID: string, status: SkillRuntimeAction.Result["status"] = "succeeded"): SkillRuntimeAction.Result {
  return {
    operation_id: operationID,
    status,
    output: {},
    execution: { attempts: 1, elapsed_ms: 1, cost: { known: false } },
    error: status === "succeeded" ? null : { code: "cancelled", message: "cancelled" },
  }
}

describe("skill executor", () => {
  it("runs independent actions concurrently but defers same-batch dependencies", async () => {
    const first = action("first")
    const second = action("second")
    const dependent = action("dependent", ["first"])
    let submissions = 0
    const runtime: SkillRuntime.Interface = {
      invoke: (request) => Effect.succeed({
        response: request.request.command === "start"
          ? response([first, second, dependent])
          : request.request.payload.result && (request.request.payload.result as SkillRuntimeAction.Result).operation_id === "dependent"
            ? response([], "completed", 4)
            : response([dependent], "running", ++submissions + 1),
      }),
    }
    let active = 0
    let peak = 0
    const completed: string[] = []
    const actions: SkillRuntimeAction.Interface = {
      run: ({ action: current }) => Effect.gen(function* () {
        active++
        peak = Math.max(peak, active)
        yield* Effect.sleep("20 millis")
        active--
        completed.push(current.operation_id)
        return result(current.operation_id)
      }),
    }
    const output = await run(runtime, actions)
    expect(output.status).toBe("completed")
    expect(peak).toBe(2)
    expect(completed.slice(0, 2).toSorted()).toEqual(["first", "second"])
    expect(completed[2]).toBe("dependent")
  })

  it("replays a completed operation without invoking its provider twice", async () => {
    const repeated = action("repeated")
    let submissions = 0
    let calls = 0
    const output = await run(
      {
        invoke: (request) => Effect.succeed({ response: request.request.command === "start"
          ? response([repeated])
          : ++submissions === 1
            ? response([repeated], "running", 2)
            : response([], "completed", 3) }),
      },
      { run: ({ action: current }) => Effect.sync(() => (calls++, result(current.operation_id))) },
    )
    expect(output.status).toBe("completed")
    expect(calls).toBe(1)
    expect(submissions).toBe(2)
  })

  it("submits rejected questions as structured cancellation results", async () => {
    const question: SkillProtocol.Action = {
      ...action("question"),
      type: "user.ask",
      payload: { question: "Continue?", header: "Decision", options: [{ label: "Yes", description: "Continue" }] },
    }
    let submitted: Record<string, unknown> | undefined
    const output = await run(
      {
        invoke: (request) => Effect.sync(() => {
          if (request.request.command === "start") return { response: response([question]) }
          submitted = request.request.payload
          return { response: response([], "cancelled", 2) }
        }),
      },
      { run: ({ action: current }) => Effect.succeed(result(current.operation_id, "cancelled")) },
    )
    expect(output.status).toBe("cancelled")
    expect(submitted).toMatchObject({ result: { operation_id: "question", status: "cancelled" } })
  })

  it("keeps concurrent workflow runs isolated", async () => {
    const gate = await Effect.runPromise(Deferred.make<void>())
    let active = 0
    let peak = 0
    const runtime: SkillRuntime.Interface = {
      invoke: (request) => Effect.succeed({ response: request.request.command === "start"
        ? { ...response([action("one")]), workflow_id: String(request.request.payload.workflow) }
        : { ...response([], "completed", 2), workflow_id: request.request.workflow_id ?? null } }),
    }
    const actions: SkillRuntimeAction.Interface = {
      run: ({ action: current }) => Effect.gen(function* () {
        active++
        peak = Math.max(peak, active)
        if (active === 2) yield* Deferred.succeed(gate, undefined)
        yield* Deferred.await(gate)
        active--
        return result(current.operation_id)
      }),
    }
    const execute = (workflow: string) =>
      Effect.gen(function* () {
        return yield* (yield* SkillExecutor.Service).run({ ...input, payload: { workflow } })
      }).pipe(
        Effect.provide(SkillExecutor.layer),
        Effect.provide(Layer.succeed(SkillRuntime.Service, SkillRuntime.Service.of(runtime))),
        Effect.provide(Layer.succeed(SkillRuntimeAction.Service, SkillRuntimeAction.Service.of(actions))),
        Effect.provide(journalLayer()),
      )
    const [left, right] = await Effect.runPromise(Effect.all([execute("left"), execute("right")], { concurrency: 2 }))
    expect([left.workflowID, right.workflowID].toSorted()).toEqual(["left", "right"])
    expect(peak).toBe(2)
  })

  it("passes the project directory through without reading private skill state", async () => {
    await using project = await tmpdir()
    const privateState = path.join(project.path, "project-state.json")
    const contents = "private skill state that is intentionally not JSON"
    await Bun.write(privateState, contents)
    let receivedDirectory: string | undefined

    const output = await run(
      {
        invoke: (request) => Effect.sync(() => {
          receivedDirectory = request.request.project_directory
          return { response: response([], "completed") }
        }),
      },
      { run: () => Effect.die(new Error("terminal response should not run actions")) },
      { ...input, projectDirectory: project.path },
    )

    expect(output.status).toBe("completed")
    expect(receivedDirectory).toBe(project.path)
    expect(await Bun.file(privateState).text()).toBe(contents)
  })
})
