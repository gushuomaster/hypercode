import { ArtifactStore } from "@/artifact/store"
import { CapabilityLLM } from "@/capability/llm"
import { CapabilityModelRouter } from "@/capability/model-router"
import { Capability } from "@/capability/schema"
import { ImageGenerationService } from "@/image-generation/service"
import { ImageGenerationProvider } from "@/image-generation/provider"
import { ImageGeneration } from "@/image-generation/schema"
import { Question } from "@/question"
import { SessionID } from "@/session/schema"
import { isRecord } from "@/util/record"
import fs from "node:fs/promises"
import path from "node:path"
import { lookup } from "mime-types"
import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SkillProtocol } from "./protocol"

export type Result = {
  readonly operation_id: string
  readonly status: "succeeded" | "failed" | "cancelled" | "uncertain"
  readonly output: Record<string, unknown>
  readonly execution: {
    readonly provider?: string
    readonly model?: string
    readonly attempts: number
    readonly elapsed_ms: number
    readonly cost: Record<string, unknown>
  }
  readonly error: Record<string, unknown> | null
}

export type Input = {
  readonly action: SkillProtocol.Action
  readonly workflowID: string
  readonly sessionID: string
  readonly projectDirectory: string
  readonly declaredInputs?: ReadonlySet<string>
  readonly policy: Capability.Policy
  readonly dependencyResults: ReadonlyMap<string, Result>
}

export interface Interface {
  readonly run: (input: Input) => Effect.Effect<Result>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SkillRuntimeAction") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const router = yield* CapabilityModelRouter.Service
    const llm = yield* CapabilityLLM.Service
    const images = yield* ImageGenerationService.Service
    const artifacts = yield* ArtifactStore.Service
    const question = yield* Question.Service

    const ask = (sessionID: string, info: Question.Info) =>
      question.ask({ sessionID: SessionID.make(sessionID), questions: [info] })

    const confirm = (sessionID: string, confirmation: Capability.Confirmation) =>
      ask(sessionID, {
        question: confirmation.message,
        header: confirmation.title,
        options: [
          { label: "允许", description: "允许本次任务使用此模型。" },
          { label: "取消", description: "不使用此模型。" },
        ],
        custom: false,
        presentation: {
          tone: confirmation.kind === "paid-use" ? "payment" : "normal",
          facts: [{ label: "Model", value: Capability.identity(confirmation.candidate) }],
        },
      }).pipe(
        Effect.map((answers) => answers[0]?.includes("允许") === true),
        Effect.catchTag("QuestionRejectedError", () => Effect.succeed(false)),
      )

    const run = Effect.fn("SkillRuntimeAction.run")(function* (input: Input) {
      const started = Date.now()
      if (input.action.type === "user.ask") {
        const decoded = yield* Effect.result(decodeQuestion(input.action.payload))
        if (decoded._tag === "Failure") return failed(input.action.operation_id, started, "question-invalid")
        const answers = yield* Effect.result(ask(input.sessionID, decoded.success))
        if (answers._tag === "Failure") return cancelled(input.action.operation_id, started, "question-rejected")
        return success(input.action.operation_id, started, { answers: answers.success.map((answer) => [...answer]) })
      }

      const decoded = yield* Effect.result(decodeCapabilities(input.action))
      if (decoded._tag === "Failure") return failed(input.action.operation_id, started, "requirements-invalid")
      const requirements = decoded.success
      const excluded = requirements.independentReview
        ? input.action.depends_on.flatMap((operationID) => {
            const result = input.dependencyResults.get(operationID)
            const provider = result?.execution.provider
            const model = result?.execution.model
            return provider && model ? [`${provider}/${model}`] : []
          })
        : []
      const resolved = { ...requirements, independentOf: [...requirements.independentOf, ...excluded] }
      const snapshot = yield* router.snapshot({ requirements: resolved, policy: input.policy })

      if (input.action.type === "llm.generate") {
        const selected = yield* router.select({
          snapshot,
          policy: input.policy,
          confirm: (confirmation) => confirm(input.sessionID, confirmation),
        }).pipe(
          Effect.mapError((error) => error instanceof globalThis.Error ? error : new globalThis.Error("Model selection failed")),
          Effect.result,
        )
        if (selected._tag === "Failure") return failed(input.action.operation_id, started, "model-unavailable")
        const payload = input.action.payload
        const prompt = typeof payload.prompt === "string" ? payload.prompt : ""
        if (!prompt) return failed(input.action.operation_id, started, "prompt-invalid")
        const context = payload.context === undefined ? "" : `\n\nContext:\n${JSON.stringify(payload.context)}`
        const attachments = yield* Effect.result(loadAttachments(payload.attachments, input))
        if (attachments._tag === "Failure") return failed(input.action.operation_id, started, attachments.failure.code)
        const generated = yield* Effect.result(llm.generate({
          candidate: selected.success,
          prompt: `${prompt}${context}`,
          system: typeof payload.system === "string" ? payload.system : undefined,
          ...(isRecord(payload.output_schema) ? { outputSchema: payload.output_schema } : {}),
          attachments: attachments.success,
        }))
        if (generated._tag === "Failure") return failed(input.action.operation_id, started, generated.failure.code)
        const output = decodeLLMOutput(generated.success.text, payload.output_schema)
        if (output._tag === "invalid") return failed(input.action.operation_id, started, "structured-output-invalid")
        return {
          operation_id: input.action.operation_id,
          status: "succeeded",
          output: output.value,
          execution: {
            provider: selected.success.providerID,
            model: selected.success.modelID,
            attempts: generated.success.attempts.length,
            elapsed_ms: Date.now() - started,
            cost: { known: false },
          },
          error: null,
        } satisfies Result
      }

      const payload = input.action.payload
      const prompt = typeof payload.prompt === "string" ? payload.prompt : ""
      const references = Array.isArray(payload.references)
        ? payload.references.flatMap((item) =>
            typeof item === "string" ? [item] : isRecord(item) && typeof item.path === "string" ? [item.path] : [],
          )
        : []
      if (!prompt) return failed(input.action.operation_id, started, "prompt-invalid")
      const free = yield* authorizeFreePool(snapshot, input.policy, input.sessionID, router, confirm)
      const freeResult = free.length
        ? yield* generateImages(images, {
            workflowID: input.workflowID,
            operationID: input.action.operation_id,
            prompt,
            referenceImages: references,
            modelPool: free.map((candidate) => ({ provider: candidate.providerID, model: candidate.modelID })),
            ...dimensions(input.action.requirements),
          })
        : ({ _tag: "Unavailable" as const })
      const generated = freeResult._tag === "Success"
        ? freeResult
        : yield* paidFallback({
            snapshot,
            policy: input.policy,
            sessionID: input.sessionID,
            operationID: input.action.operation_id,
            workflowID: input.workflowID,
            prompt,
            references,
            dimensions: dimensions(input.action.requirements),
            images,
            ask,
          })
      if (generated._tag === "Rejected") return failed(input.action.operation_id, started, "paid-confirmation-rejected")
      if (generated._tag === "Unavailable") return failed(input.action.operation_id, started, "image-generation-failed")
      const grant = yield* artifacts.grant({
        workflowID: input.workflowID,
        operationID: input.action.operation_id,
        artifactID: generated.success.artifact.artifactID,
      }).pipe(Effect.result)
      if (grant._tag === "Failure") return failed(input.action.operation_id, started, "artifact-unavailable")
      return {
        operation_id: input.action.operation_id,
        status: "succeeded",
        output: {
          artifact: {
            artifact_id: generated.success.artifact.artifactID,
            operation_id: input.action.operation_id,
            staging_directory: grant.success.stagingDirectory,
            relative_path: grant.success.relativePath,
            mime_type: generated.success.artifact.mimeType,
            sha256: generated.success.artifact.hash,
            size_bytes: generated.success.artifact.size,
          },
        },
        execution: {
          provider: generated.success.provider,
          model: generated.success.model,
          attempts: generated.success.attempts,
          elapsed_ms: generated.success.elapsedMs,
          cost: generated.success.cost,
        },
        error: null,
      } satisfies Result
    })

    return Service.of({ run })
  }),
)

const imageDependencies = Layer.merge(ImageGenerationProvider.defaultLayer, ArtifactStore.defaultLayer)
const imageLayer = ImageGenerationService.layer().pipe(Layer.provide(imageDependencies))
const dependencies = Layer.mergeAll(
  ArtifactStore.defaultLayer,
  CapabilityModelRouter.defaultLayer,
  CapabilityLLM.defaultLayer,
  Question.defaultLayer,
  imageLayer,
)
export const defaultLayer = layer.pipe(Layer.provide(dependencies))

export const node = LayerNode.make(layer, [
  ArtifactStore.node,
  CapabilityModelRouter.node,
  CapabilityLLM.node,
  Question.node,
  ImageGenerationService.node,
])

function decodeCapabilities(action: SkillProtocol.Action) {
  return Effect.try({
    try: () => Capability.decodeRequirements({
      ...action.requirements,
      ...(action.type === "image.generate" &&
        action.requirements.output === undefined &&
        action.requirements.output_modalities === undefined
        ? { output: ["image"] }
        : {}),
    }),
    catch: () => new Capability.Error({ code: "requirements-invalid", message: "Action requirements are invalid" }),
  })
}

function decodeQuestion(payload: Record<string, unknown>) {
  const value = {
    question: [payload.question, payload.body_markdown].filter((item): item is string => typeof item === "string").join("\n\n"),
    header: payload.header,
    options: payload.options,
    custom: payload.custom,
    presentation: payload.presentation,
  }
  return Schema.decodeUnknownEffect(Question.Info)(value).pipe(
    Effect.mapError(() => new Capability.Error({ code: "question-invalid", message: "Question action payload is invalid" })),
  )
}

function decodeLLMOutput(text: string, outputSchema: unknown): { readonly _tag: "valid"; readonly value: Record<string, unknown> } | { readonly _tag: "invalid" } {
  if (outputSchema === undefined) return { _tag: "valid", value: { text } }
  try {
    const value: unknown = JSON.parse(text)
    return isRecord(value) ? { _tag: "valid", value } : { _tag: "invalid" }
  } catch {
    return { _tag: "invalid" }
  }
}

function dimensions(requirements: Record<string, unknown>) {
  if (typeof requirements.aspect_ratio !== "string") return { width: 1, height: 1 }
  const [width, height] = requirements.aspect_ratio.split(":").map(Number)
  return width && height ? { width, height } : { width: 1, height: 1 }
}

function authorizeFreePool(
  snapshot: Capability.Snapshot,
  policy: Capability.Policy,
  sessionID: string,
  router: CapabilityModelRouter.Interface,
  confirm: (sessionID: string, confirmation: Capability.Confirmation) => Effect.Effect<boolean, unknown>,
) {
  const candidates = snapshot.candidates.filter((candidate) => candidate.cost === "free")
  return Effect.forEach(candidates, (candidate) =>
    router.select({
      snapshot: { ...snapshot, candidates: [candidate] },
      policy: { ...policy, cost: "free-only" },
      confirm: (confirmation) => confirm(sessionID, confirmation),
    }).pipe(Effect.result, Effect.map((result) => result._tag === "Success" ? [result.success] : [])),
  ).pipe(Effect.map((items) => items.flat()))
}

function paidFallback(input: {
  snapshot: Capability.Snapshot
  policy: Capability.Policy
  sessionID: string
  operationID: string
  workflowID: string
  prompt: string
  references: ReadonlyArray<string>
  dimensions: { width: number; height: number }
  images: ImageGenerationService.Interface
  ask: (sessionID: string, info: Question.Info) => Effect.Effect<ReadonlyArray<Question.Answer>, Question.RejectedError>
}): Effect.Effect<ImageAttempt> {
  const paid = input.snapshot.candidates.filter((candidate) => candidate.cost === "paid")
  if (input.policy.cost === "free-only" || !paid.length) {
    return Effect.succeed({ _tag: "Unavailable" as const })
  }
  return Effect.gen(function* () {
    const answer = yield* Effect.result(input.ask(input.sessionID, {
      question: `免费图片模型均不可用。是否使用付费图片模型？${paid.map(Capability.identity).join("、")}`,
      header: "确认付费图片模型",
      options: [
        { label: "确认使用", description: "允许付费图片生成，可能产生 provider 费用。" },
        { label: "取消", description: "保持暂停，不调用付费模型。" },
      ],
      custom: false,
      presentation: {
        tone: "payment",
        facts: [{ label: "付费模型", value: paid.map(Capability.identity).join(", ") }],
      },
    }))
    if (answer._tag === "Failure" || !answer.success[0]?.includes("确认使用")) {
      return { _tag: "Rejected" as const }
    }
    return yield* generateImages(input.images, {
      workflowID: input.workflowID,
      operationID: input.operationID,
      prompt: input.prompt,
      referenceImages: input.references,
      modelPool: paid.map((candidate) => ({ provider: candidate.providerID, model: candidate.modelID })),
      ...input.dimensions,
    })
  })
}

type ImageAttempt =
  | { readonly _tag: "Success"; readonly success: ImageGeneration.Result }
  | { readonly _tag: "Rejected" }
  | { readonly _tag: "Unavailable" }

function generateImages(images: ImageGenerationService.Interface, request: ImageGeneration.Request): Effect.Effect<ImageAttempt> {
  return Effect.map(Effect.result(images.generate(request)), (result) =>
    result._tag === "Success"
      ? { _tag: "Success" as const, success: result.success }
      : { _tag: "Unavailable" as const },
  )
}

function loadAttachments(value: unknown, input: Input) {
  if (!Array.isArray(value)) return Effect.succeed([])
  const declared = value.slice(0, 10).flatMap((item) =>
    isRecord(item) && typeof item.path === "string"
      ? [{ path: item.path, role: typeof item.role === "string" ? item.role : undefined }]
      : [],
  )
  const stagedMediaTypes = new Map<string, string>()
  for (const result of input.dependencyResults.values()) {
    const artifact = isRecord(result.output.artifact) ? result.output.artifact : undefined
    if (!artifact || typeof artifact.staging_directory !== "string" || typeof artifact.relative_path !== "string") continue
    const stagedPath = path.resolve(artifact.staging_directory, artifact.relative_path)
    if (typeof artifact.mime_type === "string" && artifact.mime_type.trim()) stagedMediaTypes.set(stagedPath, artifact.mime_type)
    else stagedMediaTypes.set(stagedPath, "application/octet-stream")
  }
  const staged = new Set(stagedMediaTypes.keys())
  return Effect.forEach(declared, (attachment) => Effect.tryPromise({
    try: async () => {
      const file = await fs.realpath(attachment.path)
      const project = await fs.realpath(input.projectDirectory)
      const relative = path.relative(project, file)
      const declared = input.declaredInputs?.has(path.resolve(attachment.path)) === true
      if ((relative.startsWith("..") || path.isAbsolute(relative)) && !staged.has(file) && !declared) throw new Error("attachment outside allowed roots")
      const stat = await fs.lstat(file)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 25 * 1024 * 1024) throw new Error("attachment is invalid")
      return {
        bytes: await fs.readFile(file),
        mediaType: (stagedMediaTypes.get(file) ?? lookup(file)) || "application/octet-stream",
        filename: path.basename(file),
        role: attachment.role,
      }
    },
    catch: () => new Capability.Error({ code: "attachment-invalid", message: "Action attachment is unavailable or outside allowed roots" }),
  }))
}

function success(operationID: string, started: number, output: Record<string, unknown>): Result {
  return {
    operation_id: operationID,
    status: "succeeded",
    output,
    execution: { attempts: 1, elapsed_ms: Date.now() - started, cost: { known: false } },
    error: null,
  }
}

function failed(operationID: string, started: number, code: string): Result {
  return {
    operation_id: operationID,
    status: "failed",
    output: {},
    execution: { attempts: 1, elapsed_ms: Date.now() - started, cost: { known: false } },
    error: { code, message: "Action execution failed" },
  }
}

function cancelled(operationID: string, started: number, code: string): Result {
  return {
    operation_id: operationID,
    status: "cancelled",
    output: { outcome: "rejected" },
    execution: { attempts: 0, elapsed_ms: Date.now() - started, cost: { known: false } },
    error: { code, message: "The user dismissed the question" },
  }
}

export * as SkillRuntimeAction from "./action"
