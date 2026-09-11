import { FSUtil } from "@opencode-ai/core/fs-util"
import { createHash } from "crypto"
import { lstat } from "fs/promises"
import path from "path"
import { Effect, Schema } from "effect"
import { ExecutableManifest } from "@/skill/executable-manifest"

export const File = Schema.Struct({
  path: Schema.String,
  size: Schema.Number,
  sha256: Schema.String,
})
export type File = Schema.Schema.Type<typeof File>

export const Info = Schema.Struct({
  value: Schema.String,
  files: Schema.Array(File),
})
export type Info = Schema.Schema.Type<typeof Info>

export class Error extends Schema.TaggedErrorClass<Error>()("SkillFingerprintError", {
  code: Schema.String,
  message: Schema.String,
}) {}

export const calculate = Effect.fn("SkillFingerprint.calculate")(function* (
  root: string,
  manifest: ExecutableManifest.Manifest,
) {
  const fs = yield* FSUtil.Service
  const declared = new Set(["SKILL.md", "skill-runtime.json", manifest.entrypoint[1], ...manifest.runtime.requirements])
  const matched = yield* Effect.forEach(manifest.protected, (pattern) =>
    fs.glob(pattern, { cwd: root, absolute: true, include: "file", dot: true, symlink: false }).pipe(
      Effect.mapError(
        () => new Error({ code: "fingerprint-pattern-failed", message: `Protected pattern could not be read: ${pattern}` }),
      ),
    ),
  )
  matched.flat().forEach((file) => declared.add(path.relative(root, file).replaceAll("\\", "/")))

  const files = yield* Effect.forEach(
    Array.from(declared)
      .map((file) => file.replaceAll("\\", "/"))
      .toSorted(),
    (file) => inspect(root, file),
  )
  const hash = createHash("sha256")
  files.forEach((file) => hash.update(JSON.stringify(file)).update("\n"))
  return { value: hash.digest("hex"), files } satisfies Info
})

const inspect = Effect.fnUntraced(function* (root: string, relative: string) {
  if (path.isAbsolute(relative) || path.win32.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) {
    return yield* new Error({ code: "fingerprint-path-unsafe", message: `Protected path escapes the skill: ${relative}` })
  }
  const parts = relative.split(/[\\/]/).filter(Boolean)
  const candidates = parts.map((_, index) => path.join(root, ...parts.slice(0, index + 1)))
  const stats = yield* Effect.forEach(candidates, (candidate) =>
    Effect.tryPromise({
      try: () => lstat(candidate),
      catch: () => new Error({ code: "fingerprint-file-missing", message: `Protected file is unavailable: ${relative}` }),
    }),
  )
  if (stats.some((info) => info.isSymbolicLink())) {
    return yield* new Error({ code: "fingerprint-path-unsafe", message: `Protected path uses a symbolic link: ${relative}` })
  }
  if (!stats.at(-1)?.isFile()) {
    return yield* new Error({ code: "fingerprint-file-invalid", message: `Protected path is not a file: ${relative}` })
  }
  const fs = yield* FSUtil.Service
  const content = yield* fs.readFile(path.join(root, relative)).pipe(
    Effect.mapError(
      () => new Error({ code: "fingerprint-file-missing", message: `Protected file is unavailable: ${relative}` }),
    ),
  )
  return {
    path: relative.replaceAll("\\", "/"),
    size: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
  }
})

export * as SkillFingerprint from "./fingerprint"
