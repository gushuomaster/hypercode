import { Global } from "@opencode-ai/core/global"
import { createHash, randomBytes } from "crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Artifact } from "./schema"
import { isRecord } from "@/util/record"

export type StageInput = Artifact.Owner & {
  readonly bytes: Uint8Array
  readonly mimeType: string
  readonly source?: Artifact.Source
  readonly ttlMs?: number
}

export interface Interface {
  readonly stage: (input: StageInput) => Effect.Effect<Artifact.Metadata, Artifact.Error>
  readonly read: (input: Artifact.Owner & { readonly artifactID: Artifact.ID }) => Effect.Effect<Uint8Array, Artifact.Error>
  readonly grant: (input: Artifact.Owner & { readonly artifactID: Artifact.ID }) => Effect.Effect<{
    readonly stagingDirectory: string
    readonly relativePath: string
    readonly metadata: Artifact.Metadata
  }, Artifact.Error>
  readonly imported: (input: Artifact.Owner & { readonly artifactID: Artifact.ID }) => Effect.Effect<void, Artifact.Error>
  readonly cleanup: (now?: number) => Effect.Effect<number, Artifact.Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ArtifactStore") {}

export const layer = (options: { readonly root?: string; readonly ttlMs?: number } = {}) =>
  Layer.sync(Service, () => Service.of(make(options)))

export const defaultLayer = layer()
export const node = LayerNode.make(layer(), [])

export function make(options: { readonly root?: string; readonly ttlMs?: number } = {}): Interface {
  const root = path.resolve(options.root ?? path.join(Global.Path.data, "artifacts"))
  const ttl = options.ttlMs ?? 24 * 60 * 60_000

  const stage = Effect.fn("ArtifactStore.stage")(function* (input: StageInput) {
    validateOwner(input)
    if (!input.bytes.length || !input.mimeType.trim()) {
      return yield* new Artifact.Error({ code: "artifact-input-invalid", message: "Artifact content is invalid" })
    }
    const artifactID = Artifact.ID.make(randomBytes(24).toString("base64url"))
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + Math.max(1, input.ttlMs ?? ttl))
    const record: Stored = {
      schema_version: 1,
      artifact_id: artifactID,
      owner: { workflow_id: input.workflowID, operation_id: input.operationID },
      mime_type: input.mimeType,
      hash: createHash("sha256").update(input.bytes).digest("hex"),
      size: input.bytes.byteLength,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      imported: false,
      ...(input.source ? { source: input.source } : {}),
    }
    yield* io(async () => {
      await assertSafeRoot(root)
      await fs.mkdir(root, { recursive: true })
      await assertSafeRoot(root)
      const directory = dataDirectory(root, artifactID)
      await fs.mkdir(directory)
      const temporary = path.join(directory, `.content.${process.pid}.tmp`)
      const data = dataPath(root, artifactID)
      const metadata = metadataPath(root, artifactID)
      const handle = await fs.open(temporary, "wx")
      try {
        await handle.writeFile(input.bytes)
        await handle.sync()
      } finally {
        await handle.close()
      }
      try {
        await fs.rename(temporary, data)
        await writeRecord(metadata, record)
      } catch (cause) {
        await Promise.all([
          fs.rm(temporary, { force: true }),
          fs.rm(directory, { recursive: true, force: true }),
          fs.rm(metadata, { force: true }),
        ])
        throw cause
      }
    }, "artifact-stage-failed", "Artifact could not be staged")
    return publicMetadata(record)
  })

  const read = Effect.fn("ArtifactStore.read")(function* (input: Artifact.Owner & { readonly artifactID: Artifact.ID }) {
    validateOwner(input)
    validateID(input.artifactID)
    const record = yield* load(root, input.artifactID)
    authorize(record, input)
    if (record.imported || Date.parse(record.expires_at) <= Date.now()) {
      return yield* new Artifact.Error({ code: "artifact-unavailable", message: "Artifact is no longer available" })
    }
    const bytes = yield* io(
      () => fs.readFile(dataPath(root, input.artifactID)),
      "artifact-read-failed",
      "Artifact bytes could not be read",
    )
    if (bytes.byteLength !== record.size || createHash("sha256").update(bytes).digest("hex") !== record.hash) {
      return yield* new Artifact.Error({ code: "artifact-integrity-failed", message: "Artifact integrity check failed" })
    }
    return bytes
  })

  const imported = Effect.fn("ArtifactStore.imported")(function* (
    input: Artifact.Owner & { readonly artifactID: Artifact.ID },
  ) {
    validateOwner(input)
    validateID(input.artifactID)
    const record = yield* load(root, input.artifactID)
    authorize(record, input)
    if (record.imported) return
    yield* io(
      () => writeRecord(metadataPath(root, input.artifactID), { ...record, imported: true }),
      "artifact-write-failed",
      "Artifact state could not be updated",
    )
  })

  const grant = Effect.fn("ArtifactStore.grant")(function* (
    input: Artifact.Owner & { readonly artifactID: Artifact.ID },
  ) {
    validateOwner(input)
    validateID(input.artifactID)
    const record = yield* load(root, input.artifactID)
    authorize(record, input)
    if (record.imported || Date.parse(record.expires_at) <= Date.now()) {
      return yield* new Artifact.Error({ code: "artifact-unavailable", message: "Artifact is no longer available" })
    }
    yield* read(input)
    return {
      stagingDirectory: dataDirectory(root, input.artifactID),
      relativePath: "content",
      metadata: publicMetadata(record),
    }
  })

  const cleanup = Effect.fn("ArtifactStore.cleanup")(function* (now = Date.now()) {
    const removed = yield* io(async () => {
      await fs.mkdir(root, { recursive: true })
      await assertSafeRoot(root)
      const names = await fs.readdir(root)
      const records = await Promise.all(
        names.filter((name) => name.endsWith(".json")).map(async (name) => {
          const artifactID = name.slice(0, -5)
          try {
            validateID(artifactID)
            const record = parse(await fs.readFile(path.join(root, name), "utf8"))
            if (!record.imported && Date.parse(record.expires_at) > now) return false
            await Promise.all([
              fs.rm(dataDirectory(root, Artifact.ID.make(artifactID)), { recursive: true, force: true }),
              fs.rm(path.join(root, name), { force: true }),
            ])
            return true
          } catch {
            return false
          }
        }),
      )
      return records.filter(Boolean).length
    }, "artifact-cleanup-failed", "Artifact cleanup failed")
    return removed
  })

  return { stage, read, grant, imported, cleanup }
}

type Stored = {
  readonly schema_version: 1
  readonly artifact_id: Artifact.ID
  readonly owner: { readonly workflow_id: string; readonly operation_id: string }
  readonly mime_type: string
  readonly hash: string
  readonly size: number
  readonly created_at: string
  readonly expires_at: string
  readonly imported: boolean
  readonly source?: Artifact.Source
}

function publicMetadata(record: Stored): Artifact.Metadata {
  return {
    artifactID: record.artifact_id,
    readRef: `artifact:${record.artifact_id}`,
    mimeType: record.mime_type,
    hash: record.hash,
    size: record.size,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    ...(record.source ? { source: record.source } : {}),
  }
}

const load = Effect.fnUntraced(function* (root: string, artifactID: Artifact.ID) {
  const value = yield* io(
    () => fs.readFile(metadataPath(root, artifactID), "utf8"),
    "artifact-not-found",
    "Artifact does not exist",
  )
  return yield* Effect.try({
    try: () => parse(value),
    catch: () => new Artifact.Error({ code: "artifact-metadata-invalid", message: "Artifact metadata is invalid" }),
  })
})

function parse(value: string): Stored {
  const input: unknown = JSON.parse(value)
  if (
    !isRecord(input) ||
    input.schema_version !== 1 ||
    typeof input.artifact_id !== "string" ||
    !isRecord(input.owner) ||
    typeof input.owner.workflow_id !== "string" ||
    typeof input.owner.operation_id !== "string" ||
    typeof input.mime_type !== "string" ||
    typeof input.hash !== "string" ||
    typeof input.size !== "number" ||
    typeof input.created_at !== "string" ||
    typeof input.expires_at !== "string" ||
    typeof input.imported !== "boolean"
  ) {
    throw new globalThis.Error("invalid metadata")
  }
  validateID(input.artifact_id)
  return input as Stored
}

function validateOwner(owner: Artifact.Owner) {
  if (!owner.workflowID.trim() || !owner.operationID.trim()) {
    throw new Artifact.Error({ code: "artifact-owner-invalid", message: "Artifact owner is invalid" })
  }
}

function validateID(artifactID: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(artifactID)) {
    throw new Artifact.Error({ code: "artifact-id-invalid", message: "Artifact ID is invalid" })
  }
}

function authorize(record: Stored, owner: Artifact.Owner) {
  if (record.owner.workflow_id !== owner.workflowID || record.owner.operation_id !== owner.operationID) {
    throw new Artifact.Error({ code: "artifact-access-denied", message: "Artifact access is denied" })
  }
}

function dataPath(root: string, artifactID: Artifact.ID) {
  return path.join(dataDirectory(root, artifactID), "content")
}

function dataDirectory(root: string, artifactID: Artifact.ID) {
  return path.join(root, artifactID)
}

function metadataPath(root: string, artifactID: Artifact.ID) {
  return path.join(root, `${artifactID}.json`)
}

async function writeRecord(target: string, record: Stored) {
  const temporary = `${target}.${process.pid}.tmp`
  await fs.writeFile(temporary, JSON.stringify(record))
  await fs.rename(temporary, target)
}

async function assertSafeRoot(root: string) {
  const parsed = path.parse(root)
  const parts = root.slice(parsed.root.length).split(/[\\/]/).filter(Boolean)
  const stats = await Promise.all(parts.map((_, index) => fs.lstat(path.join(parsed.root, ...parts.slice(0, index + 1))).catch(() => undefined)))
  if (stats.some((stat) => stat?.isSymbolicLink())) throw new globalThis.Error("artifact root uses a symbolic link")
}

function io<A>(run: () => Promise<A>, code: string, message: string) {
  return Effect.tryPromise({
    try: run,
    catch: () => new Artifact.Error({ code, message }),
  })
}

export * as ArtifactStore from "./store"
