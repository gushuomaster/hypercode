import { FSUtil } from "@opencode-ai/core/fs-util"
import { randomUUID } from "crypto"
import { lstat } from "fs/promises"
import { homedir } from "os"
import path from "path"
import { Effect, Exit, Schema } from "effect"
import { ExecutableManifest } from "@/skill/executable-manifest"
import { isRecord } from "@/util/record"

export type CommandResult = {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export type CommandOptions = {
  readonly cwd: string
  readonly env: Readonly<Record<string, string>>
}

export type Runner = (
  command: ReadonlyArray<string>,
  options: CommandOptions,
) => Effect.Effect<CommandResult, unknown>

export type Options = {
  readonly root?: string
  readonly python?: string
  readonly platform?: NodeJS.Platform
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly run: Runner
}

export type PrepareInput = {
  readonly skill: string
  readonly skillRoot: string
  readonly fingerprint: string
  readonly manifest: ExecutableManifest.Manifest
  readonly installApproved: boolean
}

export type Info = {
  readonly root: string
  readonly python: string
  readonly reused: boolean
}

export class Error extends Schema.TaggedErrorClass<Error>()("SkillEnvironmentError", {
  code: Schema.String,
  message: Schema.String,
}) {}

export function defaultRoot(input?: {
  readonly platform?: NodeJS.Platform
  readonly env?: Readonly<Record<string, string | undefined>>
}) {
  const configured = input?.env?.OPENCODE_SKILL_VENV_ROOT?.trim() ?? process.env.OPENCODE_SKILL_VENV_ROOT?.trim()
  if (configured) return path.resolve(configured)
  if ((input?.platform ?? process.platform) === "win32") return "D:\\venv"
  return path.resolve(process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache"), "opencode", "venv")
}

export function make(options: Options) {
  const platform = options.platform ?? process.platform
  const root = path.resolve(options.root ?? defaultRoot({ platform, env: options.env }))
  const python = options.python ?? "python"
  const environment = processEnvironment(options.env ?? process.env)

  const prepare = Effect.fn("SkillEnvironment.prepare")(function* (input: PrepareInput) {
    validateInput(input)
    const fs = yield* FSUtil.Service
    const target = path.join(root, input.skill, input.fingerprint)
    const executable = interpreter(target, platform)
    if (yield* ready(target, executable, input)) return { root: target, python: executable, reused: true } satisfies Info
    if (!input.installApproved) {
      return yield* new Error({
        code: "environment-install-approval-required",
        message: "Creating the isolated Python environment requires separate approval",
      })
    }

    const parent = path.join(root, input.skill)
    yield* assertSafeAncestors(parent)
    yield* fs.makeDirectory(parent, { recursive: true }).pipe(
      Effect.mapError(() => new Error({ code: "environment-create-failed", message: "Runtime directory could not be created" })),
    )
    yield* assertDirectory(root, "runtime root")
    yield* assertDirectory(parent, "skill runtime directory")
    const staging = path.join(parent, `${input.fingerprint}.tmp-${randomUUID()}`)
    const provision = Effect.gen(function* () {
      yield* execute([python, "-m", "venv", staging], root, "environment-create-failed")
      yield* assertDirectory(staging, "staging environment")
      const stagingPython = interpreter(staging, platform)
      yield* assertFile(stagingPython, "environment interpreter")
      yield* Effect.forEach(
        input.manifest.runtime.requirements,
        (requirements) => {
          const source = path.join(input.skillRoot, requirements)
          return assertFile(source, "requirements").pipe(
            Effect.andThen(
              execute(
                [stagingPython, "-m", "pip", "install", "-r", source],
                input.skillRoot,
                "environment-install-failed",
              ),
            ),
          )
        },
        { discard: true },
      )
      yield* fs.writeJson(path.join(staging, "hypercode-environment.json"), {
        schema_version: 1,
        skill: input.skill,
        fingerprint: input.fingerprint,
        requirements: [...input.manifest.runtime.requirements],
        ready: true,
      }).pipe(
        Effect.mapError(
          () => new Error({ code: "environment-marker-write-failed", message: "Runtime marker could not be written" }),
        ),
      )
      yield* fs.rename(staging, target).pipe(
        Effect.mapError(() => new Error({ code: "environment-promote-failed", message: "Runtime environment could not be promoted" })),
      )
      return { root: target, python: executable, reused: false } satisfies Info
    })
    return yield* provision.pipe(
      Effect.onExit((exit) =>
        Exit.isSuccess(exit) ? Effect.void : fs.remove(staging, { recursive: true, force: true }).pipe(Effect.ignore),
      ),
    )
  })

  const execute = Effect.fnUntraced(function* (
    command: ReadonlyArray<string>,
    cwd: string,
    code: "environment-create-failed" | "environment-install-failed",
  ) {
    const result = yield* options.run(command, { cwd, env: environment }).pipe(
      Effect.mapError(
        (cause) =>
          new Error({
            code,
            message: redact(cause instanceof globalThis.Error ? cause.message : "Runtime command failed"),
          }),
      ),
    )
    if (result.exitCode === 0) return
    return yield* new Error({ code, message: redact(result.stderr || `Runtime command exited with ${result.exitCode}`) })
  })

  return { root, prepare }
}

const ready = Effect.fnUntraced(function* (target: string, executable: string, input: PrepareInput) {
  const fs = yield* FSUtil.Service
  const markerPath = path.join(target, "hypercode-environment.json")
  if (!(yield* fs.existsSafe(markerPath))) return false
  yield* assertDirectory(target, "runtime environment")
  yield* assertFile(executable, "environment interpreter")
  yield* assertFile(markerPath, "runtime marker")
  const marker = yield* fs.readJson(markerPath).pipe(
    Effect.mapError(() => new Error({ code: "environment-marker-invalid", message: "Runtime marker could not be read" })),
  )
  if (
    !isRecord(marker) ||
    marker.schema_version !== 1 ||
    marker.ready !== true ||
    marker.skill !== input.skill ||
    marker.fingerprint !== input.fingerprint
  ) {
    return yield* new Error({ code: "environment-marker-invalid", message: "Runtime marker does not match the skill" })
  }
  return true
})

function validateInput(input: PrepareInput) {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(input.skill) || !/^[a-f0-9]{64}$/.test(input.fingerprint)) {
    throw new Error({ code: "environment-input-invalid", message: "Skill environment identity is invalid" })
  }
  if (!path.isAbsolute(input.skillRoot)) {
    throw new Error({ code: "environment-input-invalid", message: "Skill root must be absolute" })
  }
}

function interpreter(root: string, platform: NodeJS.Platform) {
  return platform === "win32" ? path.join(root, "Scripts", "python.exe") : path.join(root, "bin", "python")
}

const assertDirectory = Effect.fnUntraced(function* (target: string, label: string) {
  yield* assertSafeAncestors(target)
  const info = yield* Effect.promise(() => lstat(target).catch(() => undefined))
  if (!info?.isDirectory() || info.isSymbolicLink()) {
    return yield* new Error({ code: "environment-path-unsafe", message: `${label} must be a real directory` })
  }
})

const assertFile = Effect.fnUntraced(function* (target: string, label: string) {
  yield* assertSafeAncestors(target)
  const info = yield* Effect.promise(() => lstat(target).catch(() => undefined))
  if (!info?.isFile() || info.isSymbolicLink()) {
    return yield* new Error({ code: "environment-path-unsafe", message: `${label} must be a regular file` })
  }
})

const assertSafeAncestors = Effect.fnUntraced(function* (target: string) {
  const resolved = path.resolve(target)
  const parsed = path.parse(resolved)
  const parts = resolved.slice(parsed.root.length).split(/[\\/]/).filter(Boolean)
  const candidates = parts.map((_, index) => path.join(parsed.root, ...parts.slice(0, index + 1)))
  const stats = yield* Effect.forEach(candidates, (candidate) => Effect.promise(() => lstat(candidate).catch(() => undefined)))
  if (stats.some((info) => info?.isSymbolicLink())) {
    return yield* new Error({ code: "environment-path-unsafe", message: "Runtime path must not use symbolic links" })
  }
})

export function processEnvironment(source: Readonly<Record<string, string | undefined>>) {
  return Object.fromEntries(
    ["PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP", "COMSPEC", "LANG", "LC_ALL"]
      .map((key) => [key, source[key]])
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
}

export function redact(value: string) {
  return value
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|oauth[_-]?token|secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .slice(0, 4096)
}

export * as SkillEnvironment from "./environment"
