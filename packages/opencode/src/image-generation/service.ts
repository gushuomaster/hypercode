import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import fs from "node:fs/promises"
import path from "node:path"
import { InstanceState } from "@/effect/instance-state"
import { ImageGeneration } from "./schema"
import { normalizeOutputPath } from "./path"
import { ImageGenerationProvider } from "./provider"

export class GenerationError extends Schema.TaggedErrorClass<GenerationError>()("ImageGenerationError", {
  segmentID: Schema.String,
  reason: Schema.String,
}) {
  override get message() {
    return `Image generation failed for segment ${this.segmentID}: ${this.reason}`
  }
}

export interface Interface {
  readonly generate: (request: ImageGeneration.Request) => Effect.Effect<ImageGeneration.Result, GenerationError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ImageGeneration") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const provider = yield* ImageGenerationProvider.Service

    const generate = Effect.fn("ImageGeneration.generate")(function* (request: ImageGeneration.Request) {
      const instance = yield* InstanceState.context
      const started = Date.now()
      const outputDirectory = yield* Effect.tryPromise({
        try: () => normalizeOutputPath(instance.directory, request.outputDirectory),
        catch: () => new GenerationError({ segmentID: request.segmentID, reason: "output directory is outside the selected project" }),
      })
      yield* Effect.tryPromise({
        try: () => fs.mkdir(outputDirectory, { recursive: true }),
        catch: () => new GenerationError({ segmentID: request.segmentID, reason: "output directory could not be created" }),
      })
      yield* Effect.tryPromise({
        try: () => normalizeOutputPath(instance.directory, outputDirectory),
        catch: () => new GenerationError({ segmentID: request.segmentID, reason: "output directory escaped through a symbolic link" }),
      })
      const safeReferences = yield* Effect.forEach(request.referenceImages, (reference) =>
        Effect.tryPromise({
          try: () => normalizeOutputPath(instance.directory, reference),
          catch: () => new GenerationError({ segmentID: request.segmentID, reason: "reference image is outside the selected project" }),
        }),
      )

      const attempts = yield* attemptModels(provider, { ...request, referenceImages: safeReferences }).pipe(
        Effect.mapError((reason) => new GenerationError({ segmentID: request.segmentID, reason })),
      )
      const extension = attempts.output.mimeType === "image/png" ? "png" : attempts.output.mimeType === "image/jpeg" ? "jpg" : "webp"
      const filename = `${sanitize(request.segmentID)}-${Date.now()}-${crypto.randomUUID()}.${extension}`
      const destination = yield* Effect.tryPromise({
        try: () => normalizeOutputPath(outputDirectory, filename),
        catch: () => new GenerationError({ segmentID: request.segmentID, reason: "generated file path is invalid" }),
      })
      if (safeReferences.includes(destination))
        return yield* new GenerationError({ segmentID: request.segmentID, reason: "generated file would overwrite a reference image" })
      const temporary = path.join(outputDirectory, `.${filename}.${crypto.randomUUID()}.tmp`)
      yield* Effect.tryPromise({
        try: async () => {
          await fs.writeFile(temporary, attempts.output.bytes, { flag: "wx" })
          await fs.rename(temporary, destination)
        },
        catch: () => new GenerationError({ segmentID: request.segmentID, reason: "generated image could not be persisted" }),
      }).pipe(Effect.ensuring(Effect.promise(() => fs.rm(temporary, { force: true }).catch(() => undefined))))

      return {
        segmentID: request.segmentID,
        filePath: destination,
        mimeType: attempts.output.mimeType,
        provider: attempts.provider,
        model: attempts.model,
        attempts: attempts.attempts,
        elapsedMs: Date.now() - started,
        cost: attempts.output.cost,
      }
    })

    return Service.of({ generate })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(ImageGenerationProvider.defaultLayer))

export const node = LayerNode.make(layer, [ImageGenerationProvider.node])

function attemptModels(provider: ImageGenerationProvider.Interface, request: ImageGeneration.Request) {
  if (!request.modelPool.length) return Effect.fail("model pool is empty")
  return Effect.gen(function* () {
    const failures: string[] = []
    for (const candidate of request.modelPool) {
      for (const attempts of [1, 2]) {
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
        if (result._tag === "Success") return { output: result.success, ...candidate, attempts }
        failures.push(`${candidate.provider}/${candidate.model}: ${result.failure.reason}`)
        if (!result.failure.retryable) break
      }
    }
    return yield* Effect.fail(failures.join("; "))
  })
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "segment"
}

export * as ImageGenerationService from "./service"
