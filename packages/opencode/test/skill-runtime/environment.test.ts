import { describe, expect } from "bun:test"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import path from "path"
import { Deferred, Effect, Fiber, Layer } from "effect"
import { ExecutableManifest } from "../../src/skill/executable-manifest"
import { SkillEnvironment } from "../../src/skill-runtime/environment"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(FSUtil.defaultLayer, CrossSpawnSpawner.defaultLayer))
const fingerprint = "a".repeat(64)
const manifest = {
  schemaVersion: 1,
  protocol: "executable-skill/1",
  entrypoint: ["python", "scripts/main.py"],
  runtime: { kind: "python", version: ">=3.11", requirements: ["requirements.txt"] },
  actions: ["user.ask"],
  permissions: { read: ["skill", "project"], write: ["project"], process: ["python"] },
  protected: [],
} satisfies ExecutableManifest.Manifest

describe("skill runtime environment", () => {
  it.effect("defaults Windows environments to D:\\venv and allows configuration", () =>
    Effect.sync(() => {
      expect(SkillEnvironment.defaultRoot({ platform: "win32", env: {} })).toBe("D:\\venv")
      expect(
        SkillEnvironment.defaultRoot({ platform: "win32", env: { OPENCODE_SKILL_VENV_ROOT: "E:\\runtime" } }),
      ).toBe("E:\\runtime")
    }),
  )

  it.live("does not create anything before installation approval", () =>
    Effect.gen(function* () {
      const parent = yield* tmpdirScoped()
      const skillRoot = path.join(parent, "skill")
      const runtimeRoot = path.join(parent, "runtime")
      yield* (yield* FSUtil.Service).makeDirectory(skillRoot, { recursive: true })
      const calls: ReadonlyArray<string>[] = []
      const environment = SkillEnvironment.make({
        root: runtimeRoot,
        platform: "win32",
        run: (command) => Effect.sync(() => (calls.push(command), { exitCode: 0, stdout: "", stderr: "" })),
      })

      expect(
        (yield* Effect.flip(
          environment.prepare({ skill: "example", skillRoot, fingerprint, manifest, installApproved: false }),
        )).code,
      ).toBe("environment-install-approval-required")
      expect(calls).toEqual([])
      expect(yield* (yield* FSUtil.Service).existsSafe(runtimeRoot)).toBe(false)
    }),
  )

  it.live("creates and reuses one environment per fingerprint without leaking secrets", () =>
    Effect.gen(function* () {
      const parent = yield* tmpdirScoped()
      const skillRoot = path.join(parent, "skill")
      const runtimeRoot = path.join(parent, "runtime")
      const fs = yield* FSUtil.Service
      yield* fs.makeDirectory(skillRoot, { recursive: true })
      yield* fs.writeFileString(path.join(skillRoot, "requirements.txt"), "pillow")
      const calls: Array<{ command: ReadonlyArray<string>; options: SkillEnvironment.CommandOptions }> = []
      const environment = SkillEnvironment.make({
        root: runtimeRoot,
        platform: "win32",
        env: { PATH: "tools", OPENAI_API_KEY: "secret", OAUTH_TOKEN: "secret" },
        run: (command, options) =>
          Effect.gen(function* () {
            calls.push({ command, options })
            if (command[1] === "-m" && command[2] === "venv") {
              yield* fs.makeDirectory(path.join(command[3]!, "Scripts"), { recursive: true })
              yield* fs.writeFileString(path.join(command[3]!, "Scripts", "python.exe"), "python")
            }
            return { exitCode: 0, stdout: "", stderr: "" }
          }),
      })
      const input = { skill: "example", skillRoot, fingerprint, manifest, installApproved: true }

      const first = yield* environment.prepare(input)
      const second = yield* environment.prepare(input)

      expect(first.root).toBe(path.join(runtimeRoot, "example", fingerprint))
      expect(first.reused).toBe(false)
      expect(second.reused).toBe(true)
      expect(calls.length).toBe(2)
      expect(calls[1].command[0]).toBe(path.join(calls[0].command[3]!, "Scripts", "python.exe"))
      expect(calls[1].command.slice(1)).toEqual([
        "-m",
        "pip",
        "install",
        "-r",
        path.join(skillRoot, "requirements.txt"),
      ])
      expect(calls.every((call) => !JSON.stringify(call.options.env).includes("secret"))).toBe(true)
    }),
  )

  it.live("uses a new directory after fingerprint changes", () =>
    Effect.gen(function* () {
      const parent = yield* tmpdirScoped()
      const skillRoot = path.join(parent, "skill")
      const fs = yield* FSUtil.Service
      yield* fs.makeDirectory(skillRoot, { recursive: true })
      yield* fs.writeFileString(path.join(skillRoot, "requirements.txt"), "")
      const environment = SkillEnvironment.make({
        root: path.join(parent, "runtime"),
        platform: "win32",
        run: (command) =>
          Effect.gen(function* () {
            if (command[2] === "venv") {
              yield* fs.makeDirectory(path.join(command[3]!, "Scripts"), { recursive: true })
              yield* fs.writeFileString(path.join(command[3]!, "Scripts", "python.exe"), "python")
            }
            return { exitCode: 0, stdout: "", stderr: "" }
          }),
      })

      const first = yield* environment.prepare({ skill: "example", skillRoot, fingerprint, manifest, installApproved: true })
      const second = yield* environment.prepare({
        skill: "example",
        skillRoot,
        fingerprint: "b".repeat(64),
        manifest,
        installApproved: true,
      })
      expect(second.root).not.toBe(first.root)
    }),
  )

  it.live("removes a failed staging environment and redacts diagnostics", () =>
    Effect.gen(function* () {
      const parent = yield* tmpdirScoped()
      const skillRoot = path.join(parent, "skill")
      const runtimeRoot = path.join(parent, "runtime")
      const fs = yield* FSUtil.Service
      yield* fs.makeDirectory(skillRoot, { recursive: true })
      yield* fs.writeFileString(path.join(skillRoot, "requirements.txt"), "")
      const environment = SkillEnvironment.make({
        root: runtimeRoot,
        platform: "win32",
        run: (command) =>
          Effect.gen(function* () {
            yield* fs.makeDirectory(path.join(command[3]!, "Scripts"), { recursive: true })
            yield* fs.writeFileString(path.join(command[3]!, "Scripts", "python.exe"), "python")
            return { exitCode: 1, stdout: "", stderr: "Authorization: Bearer top-secret" }
          }),
      })

      const error = yield* Effect.flip(
        environment.prepare({ skill: "example", skillRoot, fingerprint, manifest, installApproved: true }),
      )
      expect(error.message).not.toContain("top-secret")
      expect(yield* fs.existsSafe(path.join(runtimeRoot, "example", fingerprint))).toBe(false)
      expect((yield* fs.readDirectory(path.join(runtimeRoot, "example"))).length).toBe(0)
    }),
  )

  it.live("rejects a symbolic-link runtime root", () =>
    Effect.gen(function* () {
      const parent = yield* tmpdirScoped()
      const skillRoot = path.join(parent, "skill")
      const outside = path.join(parent, "outside")
      const runtimeRoot = path.join(parent, "runtime")
      const fs = yield* FSUtil.Service
      yield* fs.makeDirectory(skillRoot, { recursive: true })
      yield* fs.writeFileString(path.join(skillRoot, "requirements.txt"), "")
      yield* fs.makeDirectory(outside, { recursive: true })
      const linked = yield* Effect.promise(async () => {
        try {
          await import("fs/promises").then((module) => module.symlink(outside, runtimeRoot, "junction"))
          return true
        } catch {
          return false
        }
      })
      if (!linked) return
      const environment = SkillEnvironment.make({
        root: runtimeRoot,
        platform: "win32",
        run: () => Effect.succeed({ exitCode: 0, stdout: "", stderr: "" }),
      })

      expect(
        (yield* Effect.flip(
          environment.prepare({ skill: "example", skillRoot, fingerprint, manifest, installApproved: true }),
        )).code,
      ).toBe("environment-path-unsafe")
    }),
  )

  it.live("cleans an interrupted installation so a retry can succeed", () =>
    Effect.gen(function* () {
      const parent = yield* tmpdirScoped()
      const skillRoot = path.join(parent, "skill")
      const runtimeRoot = path.join(parent, "runtime")
      const fs = yield* FSUtil.Service
      yield* fs.makeDirectory(skillRoot, { recursive: true })
      yield* fs.writeFileString(path.join(skillRoot, "requirements.txt"), "")
      const started = yield* Deferred.make<void>()
      const interrupted = SkillEnvironment.make({
        root: runtimeRoot,
        platform: "win32",
        run: (command) =>
          Effect.gen(function* () {
            yield* fs.makeDirectory(path.join(command[3]!, "Scripts"), { recursive: true })
            yield* fs.writeFileString(path.join(command[3]!, "Scripts", "python.exe"), "python")
            yield* Deferred.succeed(started, undefined)
          }).pipe(Effect.andThen(Effect.never)),
      })
      const input = { skill: "example", skillRoot, fingerprint, manifest, installApproved: true }
      const fiber = yield* interrupted.prepare(input).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      expect((yield* fs.readDirectory(path.join(runtimeRoot, "example"))).length).toBe(0)

      const retry = SkillEnvironment.make({
        root: runtimeRoot,
        platform: "win32",
        run: (command) =>
          Effect.gen(function* () {
            if (command[2] === "venv") {
              yield* fs.makeDirectory(path.join(command[3]!, "Scripts"), { recursive: true })
              yield* fs.writeFileString(path.join(command[3]!, "Scripts", "python.exe"), "python")
            }
            return { exitCode: 0, stdout: "", stderr: "" }
          }),
      })
      expect((yield* retry.prepare(input)).reused).toBe(false)
    }),
  )
})
