import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { ArtifactStore } from "../../src/artifact/store"
import { ExecutableManifest } from "../../src/skill/executable-manifest"
import { SkillEnvironment } from "../../src/skill-runtime/environment"
import { SkillExecutor } from "../../src/skill-runtime/executor"
import { SkillFingerprint } from "../../src/skill-runtime/fingerprint"
import { SkillRuntimeAction } from "../../src/skill-runtime/action"
import { SkillRuntimeJournal } from "../../src/skill-runtime/journal"
import { SkillRuntime } from "../../src/skill-runtime/service"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import path from "node:path"
import { isRecord } from "../../src/util/record"
import { testEffect } from "../lib/effect"
import { tmpdirScoped } from "../fixture/fixture"

const configuredSkill = process.env.OPENCODE_TEST_EXECUTABLE_SKILL?.trim()
const runner = testEffect(Layer.mergeAll(
  SkillRuntime.defaultLayer,
  CrossSpawnSpawner.defaultLayer,
  FSUtil.defaultLayer,
))
const local = configuredSkill ? runner.live : runner.live.skip
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

function journalLayer() {
  const operations = new Map<string, SkillRuntimeJournal.Operation>()
  return Layer.succeed(SkillRuntimeJournal.Service, SkillRuntimeJournal.Service.of({
    openExecution: (value) => Effect.succeed({ id: value.id, status: "pending" } as never),
    setExecutionStatus: (value) => Effect.succeed({ id: value.id, status: value.status } as never),
    admitOperation: (value) => Effect.sync(() => {
      const current = operations.get(value.operationID)
      if (current) return current
      const created = { executionID: value.executionID, actionType: value.actionType, status: "pending" as const, attempt: 0 }
      operations.set(value.operationID, created)
      return created
    }),
    startOperation: (value) => Effect.sync(() => {
      const current = operations.get(value.operationID)!
      const started = { ...current, status: "running" as const, attempt: current.attempt + 1 }
      operations.set(value.operationID, started)
      return started
    }),
    completeOperation: (value) => Effect.sync(() => {
      const current = operations.get(value.operationID)!
      if (current.result) return { operation: current, replayed: true }
      const completed = { ...current, status: value.status, result: value.result }
      operations.set(value.operationID, completed)
      return { operation: completed, replayed: false }
    }),
    getOperation: (value) => Effect.sync(() => operations.get(value.operationID)),
  }))
}

function succeeded(operationID: string, output: Record<string, unknown>): SkillRuntimeAction.Result {
  return {
    operation_id: operationID,
    status: "succeeded",
    output,
    execution: { provider: "local-test", model: "deterministic", attempts: 1, elapsed_ms: 1, cost: { known: false } },
    error: null,
  }
}

describe("real executable skill compatibility", () => {
  local("runs the discovered skill through analysis, approval, staging, import, delivery, and status recovery", () =>
    Effect.gen(function* () {
      const skillRoot = path.resolve(configuredSkill!)
      const manifest = yield* ExecutableManifest.load(skillRoot)
      if (!manifest) return yield* Effect.die(new Error("configured skill has no executable manifest"))
      const fingerprint = yield* SkillFingerprint.calculate(skillRoot, manifest)
      const environment = yield* SkillEnvironment.make({ run: () => Effect.die("existing environment must be reused") })
        .prepare({
          skill: "doubao-video-replica",
          skillRoot,
          fingerprint: fingerprint.value,
          manifest,
          installApproved: false,
        })
      const root = yield* tmpdirScoped()
      const projectDirectory = path.join(root, "project")
      const referenceVideo = path.join(root, "reference.mp4")
      const productImage = path.join(root, "product.png")
      yield* Effect.promise(() => Bun.write(productImage, png))
      const ffmpeg = Bun.spawn([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=180x320:d=1",
        "-r", "10", "-pix_fmt", "yuv420p", "-y", referenceVideo,
      ], { stdout: "ignore", stderr: "pipe" })
      const ffmpegExit = yield* Effect.promise(() => ffmpeg.exited)
      if (ffmpegExit !== 0) return yield* Effect.die(new Error("ffmpeg could not create local compatibility input"))

      const artifacts = ArtifactStore.make({ root: path.join(root, "host-artifacts") })
      const executed: string[] = []
      const actions = Layer.succeed(SkillRuntimeAction.Service, SkillRuntimeAction.Service.of({
        run: (input) => Effect.gen(function* () {
          executed.push(input.action.operation_id)
          if (input.action.type === "user.ask") {
            const choice = input.action.operation_id === "visual-assets:select"
              ? "跟随参考视频"
              : "批准分镜，开始生成首帧图片。"
            return succeeded(input.action.operation_id, { answers: [[choice]] })
          }
          if (input.action.type === "image.generate") {
            const metadata = yield* artifacts.stage({
              workflowID: input.workflowID,
              operationID: input.action.operation_id,
              bytes: png,
              mimeType: "image/png",
            })
            const grant = yield* artifacts.grant({
              workflowID: input.workflowID,
              operationID: input.action.operation_id,
              artifactID: metadata.artifactID,
            })
            return succeeded(input.action.operation_id, {
              artifact: {
                artifact_id: metadata.artifactID,
                operation_id: input.action.operation_id,
                staging_directory: grant.stagingDirectory,
                relative_path: grant.relativePath,
                mime_type: metadata.mimeType,
                sha256: metadata.hash,
                size_bytes: metadata.size,
              },
            })
          }
          if (input.action.operation_id.startsWith("qc:")) {
            return succeeded(input.action.operation_id, { verdict: "accepted", hard_errors: [], notes: "local test" })
          }
          const context = isRecord(input.action.payload.context) ? input.action.payload.context : {}
          const evidence = Array.isArray(context.evidence_references)
            ? context.evidence_references.find((item) => isRecord(item) && typeof item.reference_id === "string")
            : undefined
          const manifestValue = isRecord(context.manifest) ? context.manifest : {}
          const referenceID = isRecord(evidence) && typeof evidence.reference_id === "string" ? evidence.reference_id : "evidence-1"
          const duration = typeof manifestValue.duration_seconds === "number" ? manifestValue.duration_seconds : 1
          return succeeded(input.action.operation_id, { segments: [{
            segment_id: "S01",
            source_start_seconds: 0,
            source_end_seconds: duration,
            start_reference: referenceID,
            action_state: { start: "产品静置", event: "展示产品", end: "产品静置" },
            visible_hands: [],
            scene: { area: "桌面", view: "正面" },
            camera: { shot: "近景", movement: "固定" },
            props: [],
            product_required: true,
            depends_on_segments: [],
          }] })
        }).pipe(Effect.orDie),
      }))
      const journal = journalLayer()
      const base = {
        skillName: "doubao-video-replica",
        skillFingerprint: fingerprint.value,
        skillRoot,
        python: environment.python,
        entrypoint: manifest.entrypoint[1],
        actions: manifest.actions,
        projectDirectory,
        sessionID: "ses_real_skill",
        policy: { confirmedModels: [], order: [], cost: "free-only" as const },
      }
      const run = (input: SkillExecutor.Input) => Effect.gen(function* () {
        return yield* (yield* SkillExecutor.Service).run(input)
      }).pipe(
        Effect.provide(SkillExecutor.layer),
        Effect.provide(actions),
        Effect.provide(journal),
      )
      const progressed = yield* run({
        ...base,
        command: "start",
        payload: { product_name: "测试产品", reference_video: referenceVideo, product_images: [productImage] },
      })
      const analyzed = yield* run({
        ...base,
        command: "resume",
        workflowID: progressed.workflowID,
        expectedRevision: progressed.revision,
        payload: {},
      })
      const generated = yield* run({
        ...base,
        command: "resume",
        workflowID: analyzed.workflowID,
        expectedRevision: analyzed.revision,
        payload: {},
      })
      const completed = yield* run({
        ...base,
        command: "resume",
        workflowID: generated.workflowID,
        expectedRevision: generated.revision,
        payload: {},
      })
      const recovered = yield* run({
        ...base,
        command: "status",
        workflowID: completed.workflowID,
        expectedRevision: completed.revision,
        payload: {},
      })

      expect(progressed.status).toBe("running")
      expect(analyzed.status).toBe("running")
      expect(generated.status).toBe("running")
      expect(completed.status).toBe("completed")
      expect(recovered.status).toBe("completed")
      expect(executed).toEqual([
        "visual-assets:select",
        "analysis:semantic-segments",
        "storyboard:approve",
        "image:S01:attempt-1",
        "qc:S01:attempt-1:review-1",
      ])
      expect(completed.artifacts.map((item) => item.path)).toEqual([
        "storyboards/S01-first-frame.png",
        "prompts/doubao-prompts.md",
        "final/delivery-manifest.json",
      ])
      expect(yield* Effect.promise(() => Bun.file(path.join(projectDirectory, "storyboards", "S01-first-frame.png")).exists())).toBe(true)
    }),
    120_000,
  )
})
