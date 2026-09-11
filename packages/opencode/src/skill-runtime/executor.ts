import { createHash, randomUUID } from "crypto"
import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Capability } from "@/capability/schema"
import { SkillRuntimeAction } from "./action"
import { SkillRuntimeJournal } from "./journal"
import { SkillProtocol } from "./protocol"
import { SkillRuntime } from "./service"
import type { ExecutableManifest } from "@/skill/executable-manifest"
import { isRecord } from "@/util/record"
import path from "node:path"

export type Input = {
  readonly command: "start" | "resume" | "status" | "cancel"
  readonly skillName: string
  readonly skillFingerprint: string
  readonly skillRoot: string
  readonly python: string
  readonly entrypoint: string
  readonly actions: ReadonlyArray<ExecutableManifest.ActionType>
  readonly projectDirectory: string
  readonly sessionID: string
  readonly workspaceID?: string
  readonly workflowID?: string
  readonly expectedRevision?: number
  readonly payload: Record<string, unknown>
  readonly declaredInputs?: ReadonlySet<string>
  readonly policy: Capability.Policy
  readonly concurrency?: number
}

export type Presentation = {
  readonly operationID: string
  readonly question: string
  readonly header: string
  readonly options: ReadonlyArray<{ readonly label: string; readonly description: string }>
  readonly presentation?: Record<string, unknown>
}

export type Output = {
  readonly skill: string
  readonly workflowID?: string
  readonly revision?: number
  readonly status: SkillProtocol.Response["status"]
  readonly pendingActions: number
  readonly presentations: ReadonlyArray<Presentation>
  readonly artifacts: ReadonlyArray<Record<string, unknown>>
  readonly error?: Record<string, unknown>
}

export class Error extends Schema.TaggedErrorClass<Error>()("SkillExecutorError", {
  code: Schema.String,
  message: Schema.String,
}) {}

export interface Interface {
  readonly run: (input: Input) => Effect.Effect<Output, unknown>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SkillExecutor") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const runtime = yield* SkillRuntime.Service
    const journal = yield* SkillRuntimeJournal.Service
    const actions = yield* SkillRuntimeAction.Service

    const run = Effect.fn("SkillExecutor.run")(function* (input: Input) {
      validate(input)
      const first = yield* invoke(runtime, input, command(input.command), input.workflowID, input.expectedRevision, input.payload)
      let response = first.response
      if (!response.workflow_id) return publicOutput(input.skillName, response)
      const workflowID = response.workflow_id
      const executionID = executionIdentity(input.skillFingerprint, workflowID)
      const execution = yield* journal.openExecution({
        id: executionID,
        skillName: input.skillName,
        skillFingerprint: input.skillFingerprint,
        workflowID,
        sessionID: input.sessionID,
        locationDirectory: input.projectDirectory,
        workspaceID: input.workspaceID,
        ...(input.command === "start" ? { declaredInputs: collectDeclaredInputs(input.payload) } : {}),
      })
      const declaredInputs = new Set(execution.declared_inputs ?? [])

      if (input.command === "status" || input.command === "cancel" || terminal(response.status)) {
        yield* syncExecution(journal, executionID, response)
        return publicOutput(input.skillName, response)
      }

      for (let batch = 0; batch < 100; batch++) {
        if (terminal(response.status)) {
          yield* syncExecution(journal, executionID, response)
          return publicOutput(input.skillName, response)
        }
        if (!response.ready_actions.length) {
          yield* syncExecution(journal, executionID, response)
          return publicOutput(input.skillName, response)
        }
        yield* journal.setExecutionStatus({ id: executionID, status: "running", revision: response.revision ?? undefined })
        yield* Effect.forEach(
          response.ready_actions,
          (action) => journal.admitOperation({
            executionID,
            skillFingerprint: input.skillFingerprint,
            workflowID,
            operationID: action.operation_id,
            actionType: action.type,
          }),
          { discard: true },
        )

        const before = new Map<string, SkillRuntimeAction.Result>()
        for (const action of response.ready_actions) {
          for (const operationID of [action.operation_id, ...action.depends_on]) {
            const operation = yield* journal.getOperation(identity(input, workflowID, operationID))
            if (operation?.result && isResult(operation.result)) before.set(operationID, operation.result)
          }
        }
        const batchIDs = new Set(response.ready_actions.map((action) => action.operation_id))
        const eligible = [] as SkillProtocol.Action[]
        for (const action of response.ready_actions) {
          const operation = yield* journal.getOperation(identity(input, workflowID, action.operation_id))
          if (operation && operation.result && isResult(operation.result)) {
            eligible.push(action)
            continue
          }
          const dependencies = yield* Effect.forEach(action.depends_on, (operationID) =>
            journal.getOperation(identity(input, workflowID, operationID)),
          )
          const sameBatchDependency = action.depends_on.some((operationID) => batchIDs.has(operationID))
          if (!sameBatchDependency && dependencies.every((operation) => operation?.status === "succeeded")) eligible.push(action)
        }
        if (!eligible.length) {
          yield* journal.setExecutionStatus({ id: executionID, status: "waiting", revision: response.revision ?? undefined })
          return publicOutput(input.skillName, response)
        }

        const completed = yield* Effect.forEach(
          eligible,
          (action) => execute(actions, journal, { ...input, declaredInputs }, workflowID, action, before),
          { concurrency: Math.min(Math.max(input.concurrency ?? 4, 1), 16) },
        )
        for (const item of completed) {
          const successfulAnswer = item.action.type === "user.ask" && item.result.status === "succeeded"
          const payload = successfulAnswer
            ? { operation_id: item.action.operation_id, answer: firstAnswer(item.result) }
            : { result: item.result }
          response = (yield* invoke(
            runtime,
            input,
            successfulAnswer ? "submit_answer" : "submit_result",
            workflowID,
            response.revision ?? undefined,
            payload,
          )).response
        }
      }
      return yield* new Error({ code: "execution-limit", message: "Executable skill exceeded the scheduling limit" })
    })

    return Service.of({ run })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(SkillRuntime.defaultLayer),
  Layer.provide(SkillRuntimeJournal.defaultLayer),
  Layer.provide(SkillRuntimeAction.defaultLayer),
)

export const node = LayerNode.make(layer, [SkillRuntime.node, SkillRuntimeJournal.node, SkillRuntimeAction.node])

function execute(
  actions: SkillRuntimeAction.Interface,
  journal: SkillRuntimeJournal.Interface,
  input: Input,
  workflowID: string,
  action: SkillProtocol.Action,
  dependencyResults: ReadonlyMap<string, SkillRuntimeAction.Result>,
) {
  const operationIdentity = identity(input, workflowID, action.operation_id)
  return Effect.gen(function* () {
    const existing = yield* journal.getOperation(operationIdentity)
    if (existing?.result && isResult(existing.result)) return { action, result: existing.result, replayed: true }
    if (existing?.status === "running") {
      const result: SkillRuntimeAction.Result = {
        operation_id: action.operation_id,
        status: "uncertain",
        output: {},
        execution: { attempts: existing.attempt, elapsed_ms: 0, cost: { known: false } },
        error: { code: "interrupted-operation", message: "Operation outcome is uncertain after interruption" },
      }
      yield* journal.completeOperation({ ...operationIdentity, status: "uncertain", result })
      return { action, result, replayed: false }
    }
    yield* journal.startOperation(operationIdentity)
    const result = yield* actions.run({
      action,
      workflowID,
      sessionID: input.sessionID,
      projectDirectory: input.projectDirectory,
      declaredInputs: input.declaredInputs,
      policy: input.policy,
      dependencyResults,
    })
    const completed = yield* journal.completeOperation({
      ...operationIdentity,
      status: result.status,
      result,
      provider: result.execution.provider,
      model: result.execution.model,
      cost: result.execution.cost,
    })
    return { action, result: completed.operation.result && isResult(completed.operation.result) ? completed.operation.result : result, replayed: completed.replayed }
  })
}

function invoke(
  runtime: SkillRuntime.Interface,
  input: Input,
  protocolCommand: SkillProtocol.Command,
  workflowID: string | undefined,
  expectedRevision: number | undefined,
  payload: Record<string, unknown>,
) {
  return runtime.invoke({
    skillRoot: input.skillRoot,
    python: input.python,
    entrypoint: input.entrypoint,
    actions: input.actions,
    request: {
      protocol_version: "1.0",
      request_id: randomUUID(),
      command: protocolCommand,
      project_directory: input.projectDirectory,
      workflow_id: workflowID,
      expected_revision: expectedRevision,
      payload,
    },
  })
}

function syncExecution(journal: SkillRuntimeJournal.Interface, id: string, response: SkillProtocol.Response) {
  const status = response.status === "completed"
    ? "succeeded" as const
    : response.status === "failed"
      ? "failed" as const
      : response.status === "cancelled"
        ? "cancelled" as const
        : response.status
  return journal.setExecutionStatus({
    id,
    status,
    revision: response.revision ?? undefined,
    ...(terminal(response.status) ? { result: { artifacts: response.artifacts, error: response.error } } : {}),
  })
}

function publicOutput(skill: string, response: SkillProtocol.Response): Output {
  return {
    skill,
    ...(response.workflow_id ? { workflowID: response.workflow_id } : {}),
    ...(response.revision !== null ? { revision: response.revision } : {}),
    status: response.status,
    pendingActions: response.ready_actions.length,
    presentations: response.ready_actions.flatMap(presentation),
    artifacts: response.artifacts.map((artifact) => ({ ...artifact })),
    ...(response.error ? { error: { ...response.error } } : {}),
  }
}

function presentation(action: SkillProtocol.Action): Presentation[] {
  if (action.type !== "user.ask") return []
  const payload = action.payload
  if (
    typeof payload.question !== "string" ||
    typeof payload.header !== "string" ||
    !Array.isArray(payload.options) ||
    payload.options.some((option) => !isRecord(option) || typeof option.label !== "string" || typeof option.description !== "string")
  ) return []
  return [{
    operationID: action.operation_id,
    question: payload.question,
    header: payload.header,
    options: payload.options as Array<{ label: string; description: string }>,
    ...(isRecord(payload.presentation) ? { presentation: { ...payload.presentation } } : {}),
  }]
}

function firstAnswer(result: SkillRuntimeAction.Result) {
  const answers = result.output.answers
  if (!Array.isArray(answers) || !Array.isArray(answers[0]) || typeof answers[0][0] !== "string") return ""
  return answers[0][0]
}

function identity(input: Input, workflowID: string, operationID: string) {
  return { skillFingerprint: input.skillFingerprint, workflowID, operationID }
}

function executionIdentity(fingerprint: string, workflowID: string) {
  return `skx_${createHash("sha256").update(fingerprint).update("\0").update(workflowID).digest("hex").slice(0, 24)}`
}

function command(input: Input["command"]): SkillProtocol.Command {
  if (input === "resume") return "advance"
  return input
}

function terminal(status: SkillProtocol.Response["status"]) {
  return status === "completed" || status === "failed" || status === "cancelled"
}

function isResult(input: Record<string, unknown>): input is SkillRuntimeAction.Result {
  return (
    typeof input.operation_id === "string" &&
    ["succeeded", "failed", "cancelled", "uncertain"].includes(String(input.status)) &&
    isRecord(input.output) &&
    isRecord(input.execution) &&
    (input.error === null || isRecord(input.error))
  )
}

function collectDeclaredInputs(value: unknown): ReadonlyArray<string> {
  const found = new Set<string>()
  const visit = (item: unknown): void => {
    if (typeof item === "string") {
      if (path.isAbsolute(item) || path.win32.isAbsolute(item)) found.add(path.resolve(item))
      return
    }
    if (Array.isArray(item)) {
      item.forEach(visit)
      return
    }
    if (isRecord(item)) Object.values(item).forEach(visit)
  }
  visit(value)
  return [...found]
}

function validate(input: Input) {
  if (!input.skillName.trim() || !/^[a-f0-9]{64}$/.test(input.skillFingerprint)) {
    throw new Error({ code: "execution-input-invalid", message: "Executable skill identity is invalid" })
  }
  if ((input.command === "resume" || input.command === "status" || input.command === "cancel") && !input.workflowID) {
    throw new Error({ code: "workflow-required", message: `${input.command} requires a workflow ID` })
  }
}

export * as SkillExecutor from "./executor"
