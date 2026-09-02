import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import fs from "node:fs/promises"
import path from "node:path"
import { InstanceState } from "@/effect/instance-state"
import { ImageGeneration } from "./schema"
import { normalizeOutputPath } from "./path"
import { ImageGenerationProvider } from "./provider"

type PreparedRequest = Omit<ImageGeneration.Request, "referenceImages"> & {
  referenceImages: ReadonlyArray<ImageGenerationProvider.ReferenceImage>
}

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

type Options = {
  filename?: (request: ImageGeneration.Request) => string
  persist?: (source: string, destination: string) => Promise<void>
}

export const layer = (options: Options = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const provider = yield* ImageGenerationProvider.Service

      const generate = Effect.fn("ImageGeneration.generate")(function* (request: ImageGeneration.Request) {
        const instance = yield* InstanceState.context
        const started = Date.now()
        const projectRoot = yield* Effect.tryPromise({
          try: () => fs.realpath(instance.directory),
          catch: () =>
            new GenerationError({ segmentID: request.segmentID, reason: "selected project directory is unavailable" }),
        })
        const outputDirectory = yield* Effect.tryPromise({
          try: () => normalizeOutputPath(projectRoot, request.outputDirectory),
          catch: () =>
            new GenerationError({
              segmentID: request.segmentID,
              reason: "output directory is outside the selected project",
            }),
        })
        yield* Effect.tryPromise({
          try: () => fs.mkdir(outputDirectory, { recursive: true }),
          catch: () =>
            new GenerationError({ segmentID: request.segmentID, reason: "output directory could not be created" }),
        })
        yield* Effect.tryPromise({
          try: () => normalizeOutputPath(projectRoot, outputDirectory),
          catch: () =>
            new GenerationError({
              segmentID: request.segmentID,
              reason: "output directory escaped through a symbolic link",
            }),
        })
        const safeReferences = yield* Effect.forEach(request.referenceImages.slice(0, 1), (reference) =>
          Effect.tryPromise({
            try: () => freezeReference(projectRoot, reference),
            catch: () =>
              new GenerationError({
                segmentID: request.segmentID,
                reason: "reference image is unavailable or outside the selected project",
              }),
          }),
        )

        const attempts = yield* attemptModels(provider, { ...request, referenceImages: safeReferences }).pipe(
          Effect.mapError((reason) => new GenerationError({ segmentID: request.segmentID, reason })),
        )
        const extension =
          attempts.output.mimeType === "image/png" ? "png" : attempts.output.mimeType === "image/jpeg" ? "jpg" : "webp"
        const filename =
          options.filename?.(request) ??
          `${sanitize(request.segmentID)}-${Date.now()}-${crypto.randomUUID()}.${extension}`
        const destination = yield* Effect.tryPromise({
          try: () => normalizeOutputPath(projectRoot, path.join(outputDirectory, filename)),
          catch: () => new GenerationError({ segmentID: request.segmentID, reason: "generated file path is invalid" }),
        })
        if (
          yield* Effect.promise(() =>
            fs
              .lstat(destination)
              .then(() => true)
              .catch(() => false),
          )
        )
          return yield* new GenerationError({
            segmentID: request.segmentID,
            reason: "generated image destination already exists",
          })
        const temporary = path.join(outputDirectory, `.${filename}.${crypto.randomUUID()}.tmp`)
        let temporaryIdentity: { dev: number; ino: number } | undefined
        yield* Effect.tryPromise({
          try: async () => {
            const currentOutput = await normalizeOutputPath(projectRoot, outputDirectory)
            if ((await fs.realpath(currentOutput)) !== (await fs.realpath(outputDirectory)))
              throw new Error("output directory changed")
            await fs.writeFile(temporary, attempts.output.bytes, { flag: "wx" })
            const written = await fs.stat(temporary)
            temporaryIdentity = { dev: written.dev, ino: written.ino }
            const checkedOutput = await normalizeOutputPath(projectRoot, outputDirectory)
            if ((await fs.realpath(checkedOutput)) !== currentOutput) throw new Error("output directory changed")
            await (options.persist ?? fs.link)(temporary, destination)
          },
          catch: () =>
            new GenerationError({ segmentID: request.segmentID, reason: "generated image could not be persisted" }),
        }).pipe(Effect.ensuring(Effect.promise(() => cleanupTemporary(projectRoot, temporary, temporaryIdentity))))

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

export const defaultLayer = layer().pipe(Layer.provide(ImageGenerationProvider.defaultLayer))

export const node = LayerNode.make(layer(), [ImageGenerationProvider.node])

function attemptModels(provider: ImageGenerationProvider.Interface, request: PreparedRequest) {
  if (!request.modelPool.length) return Effect.fail("model pool is empty")
  return Effect.gen(function* () {
    const failures: string[] = []
    let totalAttempts = 0
    for (const candidate of request.modelPool) {
      for (const attempt of [1, 2]) {
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

async function freezeReference(projectRoot: string, reference: string) {
  const file = await normalizeOutputPath(projectRoot, reference)
  const handle = await fs.open(file, "r")
  try {
    const opened = await handle.stat()
    const current = await fs.stat(await normalizeOutputPath(projectRoot, file))
    if (!opened.isFile() || opened.dev !== current.dev || opened.ino !== current.ino)
      throw new Error("reference changed")
    return { filename: path.basename(file), bytes: await handle.readFile() }
  } finally {
    await handle.close()
  }
}

async function cleanupTemporary(
  projectRoot: string,
  temporary: string,
  identity: { dev: number; ino: number } | undefined,
) {
  if (!identity) return
  const current = await normalizeOutputPath(projectRoot, temporary)
    .then((file) => fs.stat(file).then((stat) => ({ file, stat })))
    .catch(() => undefined)
  if (!current || current.stat.dev !== identity.dev || current.stat.ino !== identity.ino) return
  await fs.rm(current.file, { force: true })
}

export * as ImageGenerationService from "./service"
