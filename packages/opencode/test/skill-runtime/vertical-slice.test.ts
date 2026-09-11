import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import path from "node:path"
import { SkillRuntimeAction } from "../../src/skill-runtime/action"
import { SkillExecutor } from "../../src/skill-runtime/executor"
import { SkillRuntimeJournal } from "../../src/skill-runtime/journal"
import { SkillRuntime } from "../../src/skill-runtime/service"
import { testEffect } from "../lib/effect"
import { tmpdirScoped } from "../fixture/fixture"

const fixture = path.resolve(import.meta.dir, "../fixture/executable-skill")
const it = testEffect(Layer.mergeAll(SkillRuntime.defaultLayer, CrossSpawnSpawner.defaultLayer))

function journalLayer() {
  const operations = new Map<string, SkillRuntimeJournal.Operation>()
  return Layer.succeed(SkillRuntimeJournal.Service, SkillRuntimeJournal.Service.of({
    openExecution: (value) => Effect.succeed({ id: value.id, status: "pending" } as never),
    setExecutionStatus: (value) => Effect.succeed({ id: value.id, status: value.status } as never),
    admitOperation: (value) => Effect.sync(() => {
      const current = operations.get(value.operationID)
      if (current) return current
      const created = { executionID: value.executionID, actionType: value.actionType, status: "pending" as const, attempt: 0 }
      operations.set(value.operationID, created)
      return created
    }),
    startOperation: (value) => Effect.sync(() => {
      const current = operations.get(value.operationID)!
      const started = { ...current, status: "running" as const, attempt: current.attempt + 1 }
      operations.set(value.operationID, started)
      return started
    }),
    completeOperation: (value) => Effect.sync(() => {
      const current = operations.get(value.operationID)!
      if (current.result) return { operation: current, replayed: true }
      const completed = { ...current, status: value.status, result: value.result }
      operations.set(value.operationID, completed)
      return { operation: completed, replayed: false }
    }),
    getOperation: (value) => Effect.sync(() => operations.get(value.operationID)),
  }))
}

describe("executable skill vertical slice", () => {
  it.live("runs Question, LLM, image, formal artifact, and private-state boundaries through the real process protocol", () =>
    Effect.gen(function* () {
      const project = yield* tmpdirScoped()
      const privateState = path.join(project, "project-state.json")
      yield* Effect.promise(() => Bun.write(privateState, "fixture-private-state"))
      const executed: string[] = []
      const actions = Layer.succeed(SkillRuntimeAction.Service, SkillRuntimeAction.Service.of({
        run: (input) => Effect.sync(() => {
          executed.push(input.action.operation_id)
          const output = input.action.type === "user.ask"
            ? { answers: [["Continue"]] }
            : input.action.type === "llm.generate"
              ? { value: "structured" }
              : { artifact: { artifact_id: "opaque", operation_id: input.action.operation_id } }
          return {
            operation_id: input.action.operation_id,
            status: "succeeded" as const,
            output,
            execution: { attempts: 1, elapsed_ms: 1, cost: { known: false } },
            error: null,
          }
        }),
      }))

      const output = yield* Effect.gen(function* () {
        return yield* (yield* SkillExecutor.Service).run({
          command: "start",
          skillName: "executable-fixture",
          skillFingerprint: "c".repeat(64),
          skillRoot: fixture,
          python: "python",
          entrypoint: "scripts/main.py",
          actions: ["llm.generate", "image.generate", "user.ask"],
          projectDirectory: project,
          sessionID: "ses_vertical",
          payload: { fixture_mode: "vertical_slice" },
          policy: { confirmedModels: [], order: [], cost: "free-only" },
        })
      }).pipe(
        Effect.provide(SkillExecutor.layer),
        Effect.provide(actions),
        Effect.provide(journalLayer()),
      )

      expect(output.status).toBe("completed")
      expect(output.workflowID).toBe("workflow-vertical")
      expect(output.artifacts).toEqual([{ kind: "fixture-delivery", path: "final/fixture.json" }])
      expect(executed).toEqual(["question-fixture", "llm-fixture", "image-fixture"])
      expect(yield* Effect.promise(() => Bun.file(privateState).text())).toBe("fixture-private-state")
    }),
  )
})
