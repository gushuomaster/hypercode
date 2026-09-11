import { FSUtil } from "@opencode-ai/core/fs-util"
import { lstat } from "fs/promises"
import path from "path"
import { Effect, Schema } from "effect"
import { isRecord } from "@/util/record"

export const ActionType = Schema.Literals(["llm.generate", "image.generate", "user.ask"])
export type ActionType = Schema.Schema.Type<typeof ActionType>

export const Manifest = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  protocol: Schema.String,
  entrypoint: Schema.Tuple([Schema.Literal("python"), Schema.String]),
  runtime: Schema.Struct({
    kind: Schema.Literal("python"),
    version: Schema.String,
    requirements: Schema.Array(Schema.String),
  }),
  actions: Schema.Array(ActionType),
  permissions: Schema.Struct({
    read: Schema.Array(Schema.String),
    write: Schema.Array(Schema.String),
    process: Schema.Array(Schema.String),
  }),
  protected: Schema.Array(Schema.String),
})
export type Manifest = Schema.Schema.Type<typeof Manifest>

export const Info = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ready"),
    protocol: Schema.String,
    actions: Schema.Array(ActionType),
  }),
  Schema.Struct({
    status: Schema.Literal("invalid"),
    error: Schema.Struct({ code: Schema.String, message: Schema.String }),
  }),
])
export type Info = Schema.Schema.Type<typeof Info>

export class Error extends Schema.TaggedErrorClass<Error>()("ExecutableManifestError", {
  code: Schema.String,
  message: Schema.String,
}) {}

export const load = Effect.fn("ExecutableManifest.load")(function* (root: string) {
  const fs = yield* FSUtil.Service
  const manifestPath = path.join(root, "skill-runtime.json")
  if (!(yield* fs.existsSafe(manifestPath))) return undefined
  const text = yield* fs.readFileString(manifestPath).pipe(
    Effect.mapError(() => new Error({ code: "manifest-unreadable", message: "skill-runtime.json cannot be read" })),
  )
  const value = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(text).pipe(
    Effect.mapError(() => new Error({ code: "manifest-invalid-json", message: "skill-runtime.json is not valid JSON" })),
  )
  const manifest = yield* Effect.try({
    try: () => parse(value),
    catch: (cause) =>
      cause instanceof Error
        ? cause
        : new Error({ code: "manifest-invalid", message: "skill-runtime.json is invalid" }),
  })
  yield* validateFile(root, "SKILL.md", "skill instructions")
  yield* validateFile(root, manifest.entrypoint[1], "entrypoint")
  yield* Effect.forEach(manifest.runtime.requirements, (item) => validateFile(root, item, "requirements"), {
    discard: true,
  })
  return manifest
})

export function summary(manifest: Manifest): Info {
  return { status: "ready", protocol: manifest.protocol, actions: [...manifest.actions] }
}

function parse(value: unknown): Manifest {
  if (!isRecord(value)) throw new Error({ code: "manifest-invalid", message: "Manifest must be an object" })
  const allowed = new Set(["schema_version", "protocol", "entrypoint", "runtime", "actions", "permissions", "protected"])
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error({ code: "manifest-unknown-field", message: "Manifest contains unknown fields" })
  }
  if (value.schema_version !== 1) {
    throw new Error({ code: "manifest-version-unsupported", message: "Manifest schema version is not supported" })
  }
  if (typeof value.protocol !== "string" || !/^executable-skill\/1(?:$|\.)/.test(value.protocol)) {
    throw new Error({ code: "protocol-version-unsupported", message: "Executable skill protocol major is not supported" })
  }
  if (
    !Array.isArray(value.entrypoint) ||
    value.entrypoint.length !== 2 ||
    value.entrypoint[0] !== "python" ||
    typeof value.entrypoint[1] !== "string"
  ) {
    throw new Error({ code: "manifest-entrypoint-invalid", message: "Entrypoint must name one Python script" })
  }
  if (!isRecord(value.runtime) || value.runtime.kind !== "python" || typeof value.runtime.version !== "string") {
    throw new Error({ code: "manifest-runtime-invalid", message: "Runtime must declare Python and a version" })
  }
  const requirements = strings(value.runtime.requirements, "Runtime requirements")
  const actions = strings(value.actions, "Manifest actions")
  if (actions.length === 0 || actions.some((item) => !["llm.generate", "image.generate", "user.ask"].includes(item))) {
    throw new Error({ code: "manifest-action-unsupported", message: "Manifest declares an unsupported action" })
  }
  if (new Set(actions).size !== actions.length) {
    throw new Error({ code: "manifest-action-duplicate", message: "Manifest actions must be unique" })
  }
  if (!isRecord(value.permissions)) {
    throw new Error({ code: "manifest-permissions-invalid", message: "Manifest permissions must be an object" })
  }
  const permissions = {
    read: strings(value.permissions.read, "Read permissions"),
    write: strings(value.permissions.write, "Write permissions"),
    process: strings(value.permissions.process, "Process permissions"),
  }
  const protectedFiles = value.protected === undefined ? [] : strings(value.protected, "Protected files")
  const declared = [value.entrypoint[1], ...requirements, ...protectedFiles]
  declared.forEach((item) => validateRelative(item))
  return {
    schemaVersion: 1,
    protocol: value.protocol,
    entrypoint: ["python", value.entrypoint[1]],
    runtime: { kind: "python", version: value.runtime.version, requirements },
    actions: actions as ActionType[],
    permissions,
    protected: protectedFiles,
  }
}

function strings(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error({ code: "manifest-invalid", message: `${label} must contain non-empty strings` })
  }
  return value as string[]
}

function validateRelative(value: string) {
  if (
    path.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.split(/[\\/]/).includes("..")
  ) {
    throw new Error({ code: "manifest-path-unsafe", message: "Manifest paths must stay inside the skill" })
  }
}

const validateFile = Effect.fnUntraced(function* (root: string, relative: string, label: string) {
  validateRelative(relative)
  const fs = yield* FSUtil.Service
  const rootReal = yield* fs.realPath(root).pipe(
    Effect.mapError(() => new Error({ code: "manifest-path-unsafe", message: "Skill root cannot be resolved" })),
  )
  const parts = relative.split(/[\\/]/).filter(Boolean)
  let cursor = root
  for (const part of parts) {
    cursor = path.join(cursor, part)
    const info = yield* Effect.tryPromise({
      try: () => lstat(cursor),
      catch: () => new Error({ code: "manifest-file-missing", message: `${label} does not exist` }),
    })
    if (info.isSymbolicLink()) {
      return yield* new Error({ code: "manifest-path-unsafe", message: `${label} must not use symbolic links` })
    }
  }
  const resolved = yield* fs.realPath(cursor).pipe(
    Effect.mapError(() => new Error({ code: "manifest-file-missing", message: `${label} cannot be resolved` })),
  )
  const within = path.relative(rootReal, resolved)
  if (within.startsWith("..") || path.isAbsolute(within)) {
    return yield* new Error({ code: "manifest-path-unsafe", message: `${label} escapes the skill root` })
  }
  if (!(yield* fs.isFile(resolved))) {
    return yield* new Error({ code: "manifest-file-missing", message: `${label} must be a file` })
  }
})

export * as ExecutableManifest from "./executable-manifest"
