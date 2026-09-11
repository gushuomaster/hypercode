import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import fs from "node:fs/promises"
import path from "node:path"
import { InstanceState } from "@/effect/instance-state"
import { ArtifactStore } from "@/artifact/store"
import { ImageGeneration } from "./schema"
import { normalizeProjectPath } from "./path"
import { ImageGenerationProvider } from "./provider"

type PreparedRequest = Omit<ImageGeneration.Request, "referenceImages"> & {
  readonly referenceImages: ReadonlyArray<ImageGenerationProvider.ReferenceImage>
}

export class GenerationError extends Schema.TaggedErrorClass<GenerationError>()("ImageGenerationError", {
  operationID: Schema.String,
  reason: Schema.String,
  attempts: Schema.optional(Schema.Number),
  failures: Schema.optional(
    Schema.Array(
      Schema.Struct({
        provider: Schema.String,
        model: Schema.String,
        status: Schema.optional(Schema.Number),
        attempts: Schema.Number,
        retryable: Schema.Boolean,
        reason: Schema.String,
      }),
    ),
  ),
}) {
  override get message() {
    return `Image generation failed for operation ${this.operationID}: ${this.reason}`
  }
}

export interface Interface {
  readonly generate: (request: ImageGeneration.Request) => Effect.Effect<ImageGeneration.Result, GenerationError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ImageGeneration") {}

export const layer = () =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const provider = yield* ImageGenerationProvider.Service
      const artifacts = yield* ArtifactStore.Service

      const generate = Effect.fn("ImageGeneration.generate")(function* (request: ImageGeneration.Request) {
        validate(request)
        const instance = yield* InstanceState.context
        const started = Date.now()
        const projectRoot = yield* Effect.tryPromise({
          try: () => fs.realpath(instance.directory),
          catch: () => new GenerationError({ operationID: request.operationID, reason: "selected project directory is unavailable" }),
        })
        const references = yield* Effect.forEach(request.referenceImages, (reference) =>
          Effect.tryPromise({
            try: () => freezeReference(projectRoot, reference),
            catch: () =>
              new GenerationError({
                operationID: request.operationID,
                reason: "reference image is unavailable or outside the selected project",
              }),
          }),
        )
        const attempt = yield* attemptModels(provider, { ...request, referenceImages: references }).pipe(
          Effect.mapError(
            (failure) =>
              new GenerationError({
                operationID: request.operationID,
                reason: failure.reason,
                attempts: failure.attempts,
                failures: failure.failures,
              }),
          ),
        )
        const artifact = yield* artifacts.stage({
          workflowID: request.workflowID,
          operationID: request.operationID,
          bytes: attempt.output.bytes,
          mimeType: attempt.output.mimeType,
          source: {
            provider: attempt.provider,
            model: attempt.model,
            attempts: attempt.attempts,
            cost: attempt.output.cost,
          },
        }).pipe(
          Effect.mapError(() => new GenerationError({ operationID: request.operationID, reason: "generated image could not be staged" })),
        )
        return {
          operationID: request.operationID,
          artifact,
          provider: attempt.provider,
          model: attempt.model,
          attempts: attempt.attempts,
          elapsedMs: Date.now() - started,
          cost: attempt.output.cost,
        }
      })

      return Service.of({ generate })
    }),
  )

export const defaultLayer = layer().pipe(
  Layer.provideMerge(ArtifactStore.defaultLayer),
  Layer.provide(ImageGenerationProvider.defaultLayer),
)

export const node = LayerNode.make(layer(), [ImageGenerationProvider.node, ArtifactStore.node])

function attemptModels(provider: ImageGenerationProvider.Interface, request: PreparedRequest) {
  if (!request.modelPool.length) {
    return Effect.fail({ reason: "model pool is empty", failures: [], attempts: 0 } satisfies AttemptFailureSummary)
  }
  return Effect.gen(function* () {
    const failures: AttemptFailure[] = []
    let totalAttempts = 0
    for (const candidate of request.modelPool) {
      let modelAttempts = 0
      for (const attempt of [1, 2]) {
        modelAttempts = attempt
        totalAttempts++
        const result = yield* Effect.result(
          provider.generate({
            provider: candidate.provider,
            model: candidate.model,
            prompt: request.prompt,
            referenceImages: request.referenceImages,
            width: request.width,
            height: request.height,
          }),
        )
        if (result._tag === "Success") return { output: result.success, ...candidate, attempts: totalAttempts }
        failures.push({
          provider: result.failure.provider,
          model: result.failure.model,
          status: result.failure.status,
          attempts: modelAttempts,
          retryable: result.failure.retryable,
          reason: result.failure.reason,
        })
        if (!result.failure.retryable) break
      }
    }
    return yield* Effect.fail({
      reason: failures.map((failure) => `${failure.provider}/${failure.model}: ${failure.reason}`).join("; "),
      failures,
      attempts: totalAttempts,
    } satisfies AttemptFailureSummary)
  })
}

type AttemptFailure = {
  readonly provider: string
  readonly model: string
  readonly status?: number
  readonly attempts: number
  readonly retryable: boolean
  readonly reason: string
}

type AttemptFailureSummary = {
  readonly reason: string
  readonly failures: ReadonlyArray<AttemptFailure>
  readonly attempts: number
}

function validate(request: ImageGeneration.Request) {
  if (!request.workflowID.trim() || !request.operationID.trim() || !request.prompt.trim()) {
    throw new GenerationError({ operationID: request.operationID, reason: "generation request is invalid" })
  }
  if (!Number.isFinite(request.width) || request.width <= 0 || !Number.isFinite(request.height) || request.height <= 0) {
    throw new GenerationError({ operationID: request.operationID, reason: "generation dimensions are invalid" })
  }
}

async function freezeReference(projectRoot: string, reference: string) {
  const file = await normalizeProjectPath(projectRoot, reference)
  const handle = await fs.open(file, "r")
  try {
    const opened = await handle.stat()
    const current = await fs.stat(await normalizeProjectPath(projectRoot, file))
    if (!opened.isFile() || opened.dev !== current.dev || opened.ino !== current.ino) throw new Error("reference changed")
    return { filename: path.basename(file), bytes: await handle.readFile() }
  } finally {
    await handle.close()
  }
}

export * as ImageGenerationService from "./service"
