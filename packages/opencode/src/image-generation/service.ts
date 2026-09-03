import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import fs from "node:fs/promises"
import type { FileHandle } from "node:fs/promises"
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
  guidance: Schema.optional(Schema.String),
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
  stem?: (request: ImageGeneration.Request) => string
}

type Identity = { dev: number; ino: number }

type ReservedFile = {
  filePath: string
  handle: FileHandle
  identity: Identity
  keep: boolean
}

type ReservedOutput = {
  projectDirectory: string
  projectRoot: string
  projectIdentity: Identity
  outputDirectory: string
  outputRealPath: string
  outputIdentity: Identity
  files: ReservedFile[]
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
        const stem = options.stem?.(request) ?? `${sanitize(request.segmentID)}-${Date.now()}-${crypto.randomUUID()}`
        const reserved = yield* Effect.tryPromise({
          try: () =>
            reserveOutput(instance.directory, projectRoot, outputDirectory, stem),
          catch: (error) =>
            new GenerationError({
              segmentID: request.segmentID,
              reason: isAlreadyExists(error)
                ? "generated image destination already exists"
                : "generated file path is invalid",
            }),
        })

        return yield* Effect.gen(function* () {
          const attempts = yield* attemptModels(provider, { ...request, referenceImages: safeReferences }).pipe(
            Effect.mapError(
              (reason) =>
                new GenerationError({
                  segmentID: request.segmentID,
                  reason,
                  ...(reason.includes("NVIDIA Qwen NIM endpoint is not configured") && {
                    guidance: "Configure a trusted NVIDIA Qwen NIM endpoint before retrying.",
                  }),
                }),
            ),
          )
          const extension =
            attempts.output.mimeType === "image/png"
              ? "png"
              : attempts.output.mimeType === "image/jpeg"
                ? "jpg"
                : "webp"
          const destination = yield* Effect.tryPromise({
            try: () => normalizeOutputPath(projectRoot, path.join(outputDirectory, `${stem}.${extension}`)),
            catch: () =>
              new GenerationError({ segmentID: request.segmentID, reason: "generated file path is invalid" }),
          })
          yield* Effect.tryPromise({
            try: () => persistOutput(reserved, destination, attempts.output.bytes),
            catch: () =>
              new GenerationError({ segmentID: request.segmentID, reason: "generated image could not be persisted" }),
          })

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
        }).pipe(Effect.ensuring(Effect.promise(() => releaseOutput(reserved))))
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

async function reserveOutput(projectDirectory: string, projectRoot: string, outputDirectory: string, stem: string) {
  if (!stem || path.basename(stem) !== stem) throw new Error("invalid filename stem")
  const project = await fs.stat(projectRoot)
  const outputRealPath = await fs.realpath(outputDirectory)
  const output = await fs.stat(outputRealPath)
  const reserved: ReservedOutput = {
    projectDirectory,
    projectRoot,
    projectIdentity: identity(project),
    outputDirectory,
    outputRealPath,
    outputIdentity: identity(output),
    files: [],
  }
  try {
    for (const extension of ["png", "jpg", "webp"]) {
      const filePath = await normalizeOutputPath(projectRoot, path.join(outputDirectory, `${stem}.${extension}`))
      const existing = await fs.lstat(filePath).catch((error) => {
        if (isNotFound(error)) return undefined
        throw error
      })
      if (existing) throw Object.assign(new Error("destination already exists"), { code: "EEXIST" })
    }
    const temporaryPath = await normalizeOutputPath(
      projectRoot,
      path.join(outputDirectory, `.${sanitize(stem)}.${crypto.randomUUID()}.tmp`),
    )
    const handle = await fs.open(temporaryPath, "wx")
    const opened = await handle.stat()
    const current = await fs.lstat(temporaryPath)
    if (!opened.isFile() || !sameIdentity(identity(opened), identity(current))) {
      await handle.close()
      throw new Error("reserved file changed")
    }
    reserved.files.push({ filePath: temporaryPath, handle, identity: identity(opened), keep: false })
    await verifyOutput(reserved)
    return reserved
  } catch (error) {
    await releaseOutput(reserved)
    throw error
  }
}

async function persistOutput(reserved: ReservedOutput, destination: string, bytes: Uint8Array) {
  const temporary = reserved.files[0]
  if (!temporary) throw new Error("temporary output reservation is unavailable")
  await verifyOutput(reserved, temporary)
  await temporary.handle.writeFile(bytes)
  await temporary.handle.sync()
  await verifyOutput(reserved, temporary)
  await fs.link(temporary.filePath, destination)
  const published = await fs.lstat(destination)
  if (!published.isFile() || !sameIdentity(identity(published), temporary.identity))
    throw new Error("published output changed")
  await fs.rm(temporary.filePath, { force: true })
}

async function verifyOutput(reserved: ReservedOutput, selected?: ReservedFile) {
  const projectRoot = await fs.realpath(reserved.projectDirectory)
  const project = await fs.stat(projectRoot)
  if (!samePath(projectRoot, reserved.projectRoot) || !sameIdentity(identity(project), reserved.projectIdentity))
    throw new Error("project directory changed")
  const outputRealPath = await fs.realpath(reserved.outputDirectory)
  const output = await fs.stat(outputRealPath)
  if (
    !samePath(outputRealPath, reserved.outputRealPath) ||
    !sameIdentity(identity(output), reserved.outputIdentity) ||
    !(await normalizeOutputPath(reserved.projectRoot, reserved.outputDirectory))
  )
    throw new Error("output directory changed")
  if (!selected) return
  const current = await fs.lstat(selected.filePath)
  const opened = await selected.handle.stat()
  if (
    !current.isFile() ||
    !sameIdentity(identity(current), selected.identity) ||
    !sameIdentity(identity(opened), selected.identity)
  )
    throw new Error("reserved file changed")
}

async function releaseOutput(reserved: ReservedOutput) {
  for (const file of reserved.files) {
    if (!file.keep) {
      const safe = await verifyCleanupPath(reserved, file)
      if (safe) await fs.rm(file.filePath, { force: true }).catch(() => undefined)
    }
    await file.handle.close().catch(() => undefined)
  }
}

async function verifyCleanupPath(reserved: ReservedOutput, file: ReservedFile) {
  const validParent = await verifyOutput(reserved)
    .then(() => true)
    .catch(() => false)
  if (!validParent) return false
  return fs
    .lstat(file.filePath)
    .then((current) => current.isFile() && sameIdentity(identity(current), file.identity))
    .catch(() => false)
}

function identity(stat: { dev: number; ino: number }) {
  return { dev: stat.dev, ino: stat.ino }
}

function sameIdentity(left: Identity, right: Identity) {
  return left.dev === right.dev && left.ino === right.ino
}

function samePath(left: string, right: string) {
  return path.relative(left, right) === "" && path.relative(right, left) === ""
}

function isAlreadyExists(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST"
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

export * as ImageGenerationService from "./service"
