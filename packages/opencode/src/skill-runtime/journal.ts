import { Database } from "@opencode-ai/core/database/database"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import {
  SkillExecutionTable,
  SkillOperationTable,
  type SkillExecutionStatus,
  type SkillOperationStatus,
} from "@opencode-ai/core/skill/execution.sql"
import { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { createHash } from "crypto"
import { and, eq, sql } from "drizzle-orm"
import { Context, DateTime, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export type OperationIdentity = {
  readonly skillFingerprint: string
  readonly workflowID: string
  readonly operationID: string
}

export type Operation = {
  readonly executionID: string
  readonly actionType: string
  readonly status: SkillOperationStatus
  readonly attempt: number
  readonly result?: Record<string, unknown>
  readonly provider?: string
  readonly model?: string
  readonly cost?: Record<string, unknown>
}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()("SkillJournalConflictError", {
  message: Schema.String,
}) {}

export class TransitionError extends Schema.TaggedErrorClass<TransitionError>()("SkillJournalTransitionError", {
  from: Schema.String,
  to: Schema.String,
}) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("SkillJournalNotFoundError", {
  entity: Schema.String,
}) {}

export class ResultError extends Schema.TaggedErrorClass<ResultError>()("SkillJournalResultError", {
  message: Schema.String,
}) {}

export interface Interface {
  readonly openExecution: (input: {
    readonly id: string
    readonly skillName: string
    readonly skillFingerprint: string
    readonly workflowID: string
    readonly sessionID?: string
    readonly locationDirectory: string
    readonly workspaceID?: string
    readonly declaredInputs?: ReadonlyArray<string>
  }) => Effect.Effect<typeof SkillExecutionTable.$inferSelect, ConflictError>
  readonly setExecutionStatus: (input: {
    readonly id: string
    readonly status: SkillExecutionStatus
    readonly revision?: number
    readonly result?: Record<string, unknown>
  }) => Effect.Effect<typeof SkillExecutionTable.$inferSelect, NotFoundError | TransitionError>
  readonly admitOperation: (
    input: OperationIdentity & { readonly executionID: string; readonly actionType: string },
  ) => Effect.Effect<Operation, ConflictError | NotFoundError>
  readonly startOperation: (input: OperationIdentity) => Effect.Effect<Operation, NotFoundError | TransitionError>
  readonly completeOperation: (
    input: OperationIdentity & {
      readonly status: "succeeded" | "failed" | "cancelled" | "uncertain"
      readonly result: Record<string, unknown>
      readonly provider?: string
      readonly model?: string
      readonly cost?: Record<string, unknown>
    },
  ) => Effect.Effect<{ readonly operation: Operation; readonly replayed: boolean }, NotFoundError | TransitionError | ConflictError | ResultError>
  readonly getOperation: (input: OperationIdentity) => Effect.Effect<Operation | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SkillRuntimeJournal") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const getOperation = Effect.fn("SkillRuntimeJournal.getOperation")(function* (input: OperationIdentity) {
      const row = yield* db
        .select()
        .from(SkillOperationTable)
        .where(identity(input))
        .get()
        .pipe(Effect.orDie)
      return row ? operation(row) : undefined
    })

    const openExecution = Effect.fn("SkillRuntimeJournal.openExecution")(function* (input: {
      readonly id: string
      readonly skillName: string
      readonly skillFingerprint: string
      readonly workflowID: string
      readonly sessionID?: string
    readonly locationDirectory: string
    readonly workspaceID?: string
    readonly declaredInputs?: ReadonlyArray<string>
  }) {
      yield* db
        .insert(SkillExecutionTable)
        .values({
          id: input.id,
          skill_name: input.skillName,
          skill_fingerprint: input.skillFingerprint,
          workflow_id: input.workflowID,
          session_id: input.sessionID ? SessionSchema.ID.make(input.sessionID) : undefined,
          location_directory: input.locationDirectory,
          workspace_id: input.workspaceID ? WorkspaceV2.ID.make(input.workspaceID) : undefined,
          declared_inputs: input.declaredInputs ?? [],
        })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      const row = yield* db
        .select()
        .from(SkillExecutionTable)
        .where(
          and(
            eq(SkillExecutionTable.skill_fingerprint, input.skillFingerprint),
            eq(SkillExecutionTable.workflow_id, input.workflowID),
          ),
        )
        .get()
        .pipe(Effect.orDie)
      if (
        !row ||
        row.id !== input.id ||
        row.skill_name !== input.skillName ||
        row.location_directory !== input.locationDirectory ||
        (row.session_id ?? undefined) !== input.sessionID ||
        (row.workspace_id ?? undefined) !== input.workspaceID
        || (input.declaredInputs !== undefined && JSON.stringify(row.declared_inputs) !== JSON.stringify(input.declaredInputs))
      ) {
        return yield* new ConflictError({ message: "Execution identity conflicts with an existing workflow" })
      }
      return row
    })

    const setExecutionStatus = Effect.fn("SkillRuntimeJournal.setExecutionStatus")(function* (input: {
      readonly id: string
      readonly status: SkillExecutionStatus
      readonly revision?: number
      readonly result?: Record<string, unknown>
    }) {
      const current = yield* db
        .select()
        .from(SkillExecutionTable)
        .where(eq(SkillExecutionTable.id, input.id))
        .get()
        .pipe(Effect.orDie)
      if (!current) return yield* new NotFoundError({ entity: "execution" })
      if (!executionTransitions[current.status].includes(input.status)) {
        return yield* new TransitionError({ from: current.status, to: input.status })
      }
      const terminal = ["succeeded", "failed", "cancelled"].includes(input.status)
      return yield* db
        .update(SkillExecutionTable)
        .set({
          status: input.status,
          revision: input.revision ?? current.revision,
          result: input.result,
          time_completed: terminal ? (yield* DateTime.nowAsDate).getTime() : null,
        })
        .where(eq(SkillExecutionTable.id, input.id))
        .returning()
        .get()
        .pipe(Effect.orDie)
    })

    const admitOperation = Effect.fn("SkillRuntimeJournal.admitOperation")(function* (
      input: OperationIdentity & { readonly executionID: string; readonly actionType: string },
    ) {
      const execution = yield* db
        .select()
        .from(SkillExecutionTable)
        .where(eq(SkillExecutionTable.id, input.executionID))
        .get()
        .pipe(Effect.orDie)
      if (!execution) return yield* new NotFoundError({ entity: "execution" })
      if (
        execution.skill_fingerprint !== input.skillFingerprint ||
        execution.workflow_id !== input.workflowID
      ) {
        return yield* new ConflictError({ message: "Operation does not belong to the execution workflow" })
      }
      yield* db
        .insert(SkillOperationTable)
        .values({
          execution_id: input.executionID,
          skill_fingerprint: input.skillFingerprint,
          workflow_id: input.workflowID,
          operation_id: input.operationID,
          action_type: input.actionType,
        })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      const row = yield* db.select().from(SkillOperationTable).where(identity(input)).get().pipe(Effect.orDie)
      if (!row || row.execution_id !== input.executionID || row.action_type !== input.actionType) {
        return yield* new ConflictError({ message: "Operation identity conflicts with an existing action" })
      }
      return operation(row)
    })

    const startOperation = Effect.fn("SkillRuntimeJournal.startOperation")(function* (input: OperationIdentity) {
      const current = yield* getOperation(input)
      if (!current) return yield* new NotFoundError({ entity: "operation" })
      if (current.status !== "pending") return yield* new TransitionError({ from: current.status, to: "running" })
      const row = yield* db
        .update(SkillOperationTable)
        .set({ status: "running", attempt: sql`${SkillOperationTable.attempt} + 1` })
        .where(and(identity(input), eq(SkillOperationTable.status, "pending")))
        .returning()
        .get()
        .pipe(Effect.orDie)
      if (!row) return yield* new TransitionError({ from: "pending", to: "running" })
      return operation(row)
    })

    const completeOperation = Effect.fn("SkillRuntimeJournal.completeOperation")(function* (
      input: OperationIdentity & {
        readonly status: "succeeded" | "failed" | "cancelled" | "uncertain"
        readonly result: Record<string, unknown>
        readonly provider?: string
        readonly model?: string
        readonly cost?: Record<string, unknown>
      },
    ) {
      const resultHash = yield* hash(input.result)
      const current = yield* db.select().from(SkillOperationTable).where(identity(input)).get().pipe(Effect.orDie)
      if (!current) return yield* new NotFoundError({ entity: "operation" })
      if (terminal.has(current.status)) {
        if (current.status !== input.status || current.result_hash !== resultHash) {
          return yield* new ConflictError({ message: "Terminal operation result cannot be overwritten" })
        }
        return { operation: operation(current), replayed: true }
      }
      if (current.status !== "running") {
        return yield* new TransitionError({ from: current.status, to: input.status })
      }
      const row = yield* db
        .update(SkillOperationTable)
        .set({
          status: input.status,
          result: input.result,
          result_hash: resultHash,
          provider: input.provider,
          model: input.model,
          cost: input.cost,
          time_completed: (yield* DateTime.nowAsDate).getTime(),
        })
        .where(and(identity(input), eq(SkillOperationTable.status, "running")))
        .returning()
        .get()
        .pipe(Effect.orDie)
      if (!row) {
        const stored = yield* db.select().from(SkillOperationTable).where(identity(input)).get().pipe(Effect.orDie)
        if (stored?.status === input.status && stored.result_hash === resultHash) {
          return { operation: operation(stored), replayed: true }
        }
        return yield* new ConflictError({ message: "Operation completed concurrently with a different result" })
      }
      return { operation: operation(row), replayed: false }
    })

    return Service.of({ openExecution, setExecutionStatus, admitOperation, startOperation, completeOperation, getOperation })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))
export const node = LayerNode.make(layer, [Database.node])

const executionTransitions: Record<SkillExecutionStatus, ReadonlyArray<SkillExecutionStatus>> = {
  pending: ["pending", "running", "waiting", "succeeded", "cancelled", "failed"],
  running: ["running", "waiting", "succeeded", "failed", "cancelled"],
  waiting: ["waiting", "running", "succeeded", "failed", "cancelled"],
  succeeded: ["succeeded"],
  failed: ["failed"],
  cancelled: ["cancelled"],
}

const terminal = new Set<SkillOperationStatus>(["succeeded", "failed", "cancelled", "uncertain"])

function identity(input: OperationIdentity) {
  return and(
    eq(SkillOperationTable.skill_fingerprint, input.skillFingerprint),
    eq(SkillOperationTable.workflow_id, input.workflowID),
    eq(SkillOperationTable.operation_id, input.operationID),
  )!
}

function operation(row: typeof SkillOperationTable.$inferSelect): Operation {
  return {
    executionID: row.execution_id,
    actionType: row.action_type,
    status: row.status,
    attempt: row.attempt,
    result: row.result ?? undefined,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    cost: row.cost ?? undefined,
  }
}

const hash = Effect.fnUntraced(function* (value: Record<string, unknown>) {
  const encoded = yield* Effect.try({
    try: () => JSON.stringify(normalize(value)),
    catch: () => new ResultError({ message: "Operation result must be finite JSON" }),
  })
  if (encoded === undefined) return yield* new ResultError({ message: "Operation result must be JSON" })
  return createHash("sha256").update(encoded).digest("hex")
})

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new globalThis.Error("Non-finite number")
    return value
  }
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter((entry) => entry[1] !== undefined)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalize(item)]),
    )
  }
  throw new globalThis.Error("Unsupported JSON value")
}

export * as SkillRuntimeJournal from "./journal"
