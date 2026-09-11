import { describe, expect } from "bun:test"
import { Database } from "@opencode-ai/core/database/database"
import { Effect, Layer } from "effect"
import { SkillRuntimeJournal } from "../../src/skill-runtime/journal"
import { testEffect } from "../lib/effect"

const database = Database.layerFromPath(":memory:")
const journal = SkillRuntimeJournal.layer.pipe(Layer.provide(database))
const it = testEffect(Layer.mergeAll(database, journal))
const fingerprint = "a".repeat(64)

const execution = {
  id: "execution-1",
  skillName: "example-skill",
  skillFingerprint: fingerprint,
  workflowID: "workflow-1",
  locationDirectory: process.cwd(),
}

const action = {
  executionID: execution.id,
  skillFingerprint: fingerprint,
  workflowID: execution.workflowID,
  operationID: "operation-1",
  actionType: "llm.generate",
}

describe("skill runtime journal", () => {
  it.effect("enforces the skill fingerprint, workflow, and operation uniqueness key", () =>
    Effect.gen(function* () {
      const service = yield* SkillRuntimeJournal.Service
      yield* service.openExecution(execution)
      const first = yield* service.admitOperation(action)
      const replay = yield* service.admitOperation(action)

      expect(first).toEqual(replay)
      expect(
        (yield* Effect.flip(service.admitOperation({ ...action, executionID: "execution-other" })))._tag,
      ).toBe("SkillJournalNotFoundError")
      expect(
        (yield* Effect.flip(service.admitOperation({ ...action, actionType: "image.generate" })))._tag,
      ).toBe("SkillJournalConflictError")
    }),
  )

  it.effect("persists declared inputs on the execution for later resumes", () =>
    Effect.gen(function* () {
      const service = yield* SkillRuntimeJournal.Service
      const opened = yield* service.openExecution({
        ...execution,
        declaredInputs: ["D:\\inputs\\product.png"],
      })
      const resumed = yield* service.openExecution(execution)

      expect(opened.declared_inputs).toEqual(["D:\\inputs\\product.png"])
      expect(resumed.declared_inputs).toEqual(["D:\\inputs\\product.png"])
    }),
  )

  it.effect("allows pending to running to terminal and rejects invalid transitions", () =>
    Effect.gen(function* () {
      const service = yield* SkillRuntimeJournal.Service
      yield* service.openExecution(execution)
      yield* service.admitOperation(action)
      expect((yield* service.startOperation(action)).attempt).toBe(1)
      expect((yield* Effect.flip(service.startOperation(action)))._tag).toBe("SkillJournalTransitionError")

      const completed = yield* service.completeOperation({
        ...action,
        status: "succeeded",
        result: { operation_id: action.operationID, output: { value: 1 } },
      })
      expect(completed.replayed).toBe(false)
      expect(completed.operation.status).toBe("succeeded")
    }),
  )

  it.effect("replays the same terminal result and never overwrites a conflicting result", () =>
    Effect.gen(function* () {
      const service = yield* SkillRuntimeJournal.Service
      yield* service.openExecution(execution)
      yield* service.admitOperation(action)
      yield* service.startOperation(action)
      yield* service.completeOperation({
        ...action,
        status: "succeeded",
        result: { output: { b: 2, a: 1 }, operation_id: action.operationID },
        provider: "provider",
        model: "model",
      })

      const replay = yield* service.completeOperation({
        ...action,
        status: "succeeded",
        result: { operation_id: action.operationID, output: { a: 1, b: 2 } },
        provider: "different-evidence-does-not-replace-terminal-row",
      })
      expect(replay.replayed).toBe(true)
      expect(replay.operation.provider).toBe("provider")
      expect(
        (yield* Effect.flip(
          service.completeOperation({
            ...action,
            status: "succeeded",
            result: { operation_id: action.operationID, output: { a: 99 } },
          }),
        ))._tag,
      ).toBe("SkillJournalConflictError")
      expect((yield* service.getOperation(action))?.result).toEqual({
        output: { b: 2, a: 1 },
        operation_id: action.operationID,
      })
    }),
  )

  it.effect("persists ambiguous provider outcomes as uncertain", () =>
    Effect.gen(function* () {
      const service = yield* SkillRuntimeJournal.Service
      yield* service.openExecution(execution)
      yield* service.admitOperation(action)
      yield* service.startOperation(action)
      yield* service.completeOperation({
        ...action,
        status: "uncertain",
        result: { operation_id: action.operationID, error: { code: "provider-outcome-unknown" } },
      })

      expect((yield* service.getOperation(action))?.status).toBe("uncertain")
    }),
  )
})
