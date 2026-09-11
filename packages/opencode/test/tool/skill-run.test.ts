import { AppProcess } from "@opencode-ai/core/process"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import fs from "node:fs/promises"
import path from "node:path"
import { Agent } from "../../src/agent/agent"
import { InstanceRef } from "../../src/effect/instance-ref"
import { Question } from "../../src/question"
import { Skill } from "../../src/skill"
import { ExecutableManifest } from "../../src/skill/executable-manifest"
import { SkillExecutor } from "../../src/skill-runtime/executor"
import { SkillFingerprint } from "../../src/skill-runtime/fingerprint"
import { MessageID, SessionID } from "../../src/session/schema"
import { SkillRunTool } from "../../src/tool/skill-run"
import { Tool } from "../../src/tool/tool"
import { Truncate } from "../../src/tool/truncate"
import { tmpdir } from "../fixture/fixture"

const fixture = path.resolve(import.meta.dir, "../fixture/executable-skill")
const ctx: Tool.Context = {
  sessionID: SessionID.make("ses_skill-run"),
  messageID: MessageID.make("msg_skill-run"),
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const truncateLayer = Layer.mock(Truncate.Service, {
  output: (output: string) => Effect.succeed({ content: output, truncated: false }),
})
const agentLayer = Layer.mock(Agent.Service, { get: () => Effect.succeed({ name: "build" } as never) })

describe("tool.skill_run", () => {
  test("reuses the external environment and exposes only public workflow data", async () => {
    await using temporary = await tmpdir()
    const projectDirectory = path.join(temporary.path, "project")
    const runtimeRoot = path.join(temporary.path, "venv")
    const stateRoot = path.join(temporary.path, "state")
    await fs.mkdir(projectDirectory, { recursive: true })

    const manifest = await Effect.runPromise(
      ExecutableManifest.load(fixture).pipe(Effect.provide(FSUtil.defaultLayer)),
    )
    if (!manifest) throw new Error("fixture manifest missing")
    const fingerprint = await Effect.runPromise(
      SkillFingerprint.calculate(fixture, manifest).pipe(Effect.provide(FSUtil.defaultLayer)),
    )
    const environment = path.join(runtimeRoot, "executable-fixture", fingerprint.value)
    const python = process.platform === "win32"
      ? path.join(environment, "Scripts", "python.exe")
      : path.join(environment, "bin", "python")
    await fs.mkdir(path.dirname(python), { recursive: true })
    await Bun.write(python, "fixture")
    await Bun.write(path.join(environment, "hypercode-environment.json"), JSON.stringify({
      schema_version: 1,
      skill: "executable-fixture",
      fingerprint: fingerprint.value,
      requirements: [],
      ready: true,
    }))

    const previous = process.env.OPENCODE_SKILL_VENV_ROOT
    process.env.OPENCODE_SKILL_VENV_ROOT = runtimeRoot
    try {
      let received: SkillExecutor.Input | undefined
      let processCalls = 0
      let confirmation: Question.Info | undefined
      const output = await Effect.runPromise(
        Effect.gen(function* () {
          const tool = yield* Tool.init(yield* SkillRunTool)
          return yield* tool.execute({ skill: "executable-fixture", command: "start", input: { source: "reference.mp4" } }, ctx)
        }).pipe(
          Effect.provideService(InstanceRef, {
            directory: projectDirectory,
            worktree: projectDirectory,
            project: undefined as never,
          }),
          Effect.provide(Layer.mock(Skill.Service, {
            require: () => Effect.succeed({
              name: "executable-fixture",
              description: "fixture",
              location: path.join(fixture, "SKILL.md"),
              content: "",
              executable: ExecutableManifest.summary(manifest),
            }),
          })),
          Effect.provide(Layer.mock(AppProcess.Service, {
            run: () => Effect.sync(() => {
              processCalls++
              throw new Error("external environment should have been reused")
            }),
          })),
          Effect.provide(Layer.mock(SkillExecutor.Service, {
            run: (input) => Effect.sync(() => {
              received = input
              return {
                skill: input.skillName,
                workflowID: "workflow-public",
                revision: 2,
                status: "waiting" as const,
                pendingActions: 1,
                presentations: [{
                  operationID: "approve-1",
                  question: "Continue?",
                  header: "Approval",
                  options: [{ label: "Allow", description: "Continue." }],
                }],
                artifacts: [{ artifact_id: "artifact-public", mime_type: "image/png" }],
              }
            }),
          })),
          Effect.provide(Layer.mock(Question.Service, {
            ask: (input) => Effect.sync(() => {
              confirmation = input.questions[0]
              return [["允许"]]
            }),
          })),
          Effect.provide(Global.layerWith({ state: stateRoot })),
          Effect.provide(FSUtil.defaultLayer),
          Effect.provide(truncateLayer),
          Effect.provide(agentLayer),
        ),
      )

      expect(processCalls).toBe(0)
      expect(confirmation?.question).toContain("允许执行 executable skill")
      expect(confirmation?.header).toBe("信任 skill")
      expect(confirmation?.options.map((option) => option.label)).toEqual(["允许", "取消"])
      expect(received?.projectDirectory).toBe(projectDirectory)
      expect(received?.python).toBe(python)
      expect(received?.payload).toEqual({ source: "reference.mp4" })
      expect(output.metadata).toMatchObject({
        status: "success",
        skill: "executable-fixture",
        workflow_id: "workflow-public",
        revision: 2,
        workflow_status: "waiting",
        pending_actions: 1,
      })
      const publicOutput = JSON.stringify(output)
      expect(publicOutput).not.toContain(fixture)
      expect(publicOutput).not.toContain(runtimeRoot)
      expect(publicOutput).not.toContain(projectDirectory)
      expect(publicOutput).not.toContain("staging_directory")
      expect(publicOutput).not.toContain("project-state.json")
    } finally {
      if (previous === undefined) delete process.env.OPENCODE_SKILL_VENV_ROOT
      else process.env.OPENCODE_SKILL_VENV_ROOT = previous
    }
  })

  test("returns a safe result when the requested skill is not executable", async () => {
    await using temporary = await tmpdir()
    const output = await Effect.runPromise(
      Effect.gen(function* () {
        const tool = yield* Tool.init(yield* SkillRunTool)
        return yield* tool.execute({ skill: "instructions-only", command: "start" }, ctx)
      }).pipe(
        Effect.provideService(InstanceRef, {
          directory: temporary.path,
          worktree: temporary.path,
          project: undefined as never,
        }),
        Effect.provide(Layer.mock(Skill.Service, {
          require: () => Effect.succeed({
            name: "instructions-only",
            location: path.join(temporary.path, "SKILL.md"),
            content: "private instructions",
          }),
        })),
        Effect.provide(Layer.mock(AppProcess.Service, {})),
        Effect.provide(Layer.mock(SkillExecutor.Service, {})),
        Effect.provide(Layer.mock(Question.Service, {})),
        Effect.provide(Global.layerWith({ state: path.join(temporary.path, "state") })),
        Effect.provide(FSUtil.defaultLayer),
        Effect.provide(truncateLayer),
        Effect.provide(agentLayer),
      ),
    )

    expect(output).toEqual({
      title: "instructions-only: execution failed",
      output: "Executable skill instructions-only could not be run.",
      metadata: { status: "error", skill: "instructions-only", truncated: false },
      attachments: [],
    })
    expect(JSON.stringify(output)).not.toContain("private instructions")
    expect(JSON.stringify(output)).not.toContain(temporary.path)
  })
})
