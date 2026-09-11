import { AppProcess } from "@opencode-ai/core/process"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import path from "path"
import { Effect, Schema } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { Skill } from "@/skill"
import { ExecutableManifest } from "@/skill/executable-manifest"
import { SkillEnvironment } from "@/skill-runtime/environment"
import { SkillExecutor } from "@/skill-runtime/executor"
import { SkillFingerprint } from "@/skill-runtime/fingerprint"
import { SkillTrust } from "@/skill-runtime/trust"
import { Question } from "@/question"
import { InstanceState } from "@/effect/instance-state"
import { SessionID } from "@/session/schema"
import { Tool } from "./tool"

export const Parameters = Schema.Struct({
  skill: Schema.String,
  command: Schema.Literals(["start", "resume", "status", "cancel"]),
  workflowID: Schema.optional(Schema.String),
  expectedRevision: Schema.optional(Schema.Number),
  input: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})

type Metadata = {
  readonly status: "success" | "error"
  readonly skill: string
  readonly workflow_id?: string
  readonly revision?: number
  readonly workflow_status?: string
  readonly pending_actions?: number
  readonly presentations?: ReadonlyArray<SkillExecutor.Presentation>
  readonly artifacts?: ReadonlyArray<Record<string, unknown>>
  readonly error?: Record<string, unknown>
  readonly truncated?: boolean
}

export const SkillRunTool = Tool.define(
  "skill_run",
  Effect.gen(function* () {
    const skills = yield* Skill.Service
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const appProcess = yield* AppProcess.Service
    const executor = yield* SkillExecutor.Service
    const question = yield* Question.Service

    return {
      description: "Start, resume, inspect, or cancel a trusted executable skill workflow.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const skill = yield* skills.require(params.skill)
          if (skill.executable?.status !== "ready") {
            return yield* new SkillExecutor.Error({ code: "skill-not-executable", message: "Skill is not executable" })
          }
          const skillRoot = path.dirname(skill.location)
          const manifest = yield* ExecutableManifest.load(skillRoot).pipe(
            Effect.provideService(FSUtil.Service, fs),
          )
          if (!manifest) {
            return yield* new SkillExecutor.Error({ code: "manifest-missing", message: "Executable manifest is missing" })
          }
          const fingerprint = yield* SkillFingerprint.calculate(skillRoot, manifest).pipe(
            Effect.provideService(FSUtil.Service, fs),
          )
          const trustRoot = path.join(global.state, "skill-runtime")
          yield* SkillTrust.ensure(trustRoot, { skill: skill.name, fingerprint: fingerprint.value }, "execute", () =>
            confirm(question, ctx.sessionID, {
              question: `允许执行 executable skill ${skill.name} 吗？指纹：${fingerprint.value.slice(0, 12)}`,
              header: "信任 skill",
              tone: "warning",
            }),
          ).pipe(Effect.provideService(FSUtil.Service, fs))

          const environment = SkillEnvironment.make({
            run: (command, options) =>
              appProcess.run(
                ChildProcess.make(command[0]!, command.slice(1), {
                  cwd: options.cwd,
                  env: options.env,
                  extendEnv: false,
                }),
              ).pipe(
                Effect.map((result) => ({
                  exitCode: result.exitCode,
                  stdout: result.stdout.toString("utf8"),
                  stderr: result.stderr.toString("utf8"),
                })),
              ),
          })
          const prepared = yield* Effect.result(environment.prepare({
            skill: skill.name,
            skillRoot,
            fingerprint: fingerprint.value,
            manifest,
            installApproved: false,
          }).pipe(Effect.provideService(FSUtil.Service, fs)))
          const runtime = yield* (prepared._tag === "Success"
            ? Effect.succeed(prepared.success)
            : prepared.failure.code === "environment-install-approval-required"
              ? SkillTrust.ensure(trustRoot, { skill: skill.name, fingerprint: fingerprint.value }, "install", () =>
                  confirm(question, ctx.sessionID, {
                    question: `要为 ${skill.name} 创建隔离的 Python 运行环境吗？`,
                    header: "安装运行环境",
                    tone: "warning",
                  }),
                ).pipe(
                  Effect.provideService(FSUtil.Service, fs),
                  Effect.andThen(environment.prepare({
                    skill: skill.name,
                    skillRoot,
                    fingerprint: fingerprint.value,
                    manifest,
                    installApproved: true,
                  }).pipe(Effect.provideService(FSUtil.Service, fs))),
                )
              : Effect.fail(prepared.failure))

          const output = yield* executor.run({
            command: params.command,
            skillName: skill.name,
            skillFingerprint: fingerprint.value,
            skillRoot,
            python: runtime.python,
            entrypoint: manifest.entrypoint[1],
            actions: manifest.actions,
            projectDirectory: instance.directory,
            sessionID: ctx.sessionID,
            workflowID: params.workflowID,
            expectedRevision: params.expectedRevision,
            payload: params.input ?? {},
            policy: { confirmedModels: [], order: [], cost: "free-first" },
          })
          return {
            title: `${skill.name}: ${output.status}`,
            output: output.workflowID
              ? `Executable skill ${skill.name} is ${output.status} (workflow ${output.workflowID}).`
              : `Executable skill ${skill.name} returned ${output.status}.`,
            metadata: {
              status: "success" as const,
              skill: output.skill,
              workflow_id: output.workflowID,
              revision: output.revision,
              workflow_status: output.status,
              pending_actions: output.pendingActions,
              presentations: output.presentations,
              artifacts: output.artifacts,
              error: output.error,
            } as Metadata,
            attachments: [],
          }
        }).pipe(
          Effect.catch(() => Effect.succeed({
            title: `${params.skill}: execution failed`,
            output: `Executable skill ${params.skill} could not be run.`,
            metadata: { status: "error" as const, skill: params.skill } as Metadata,
            attachments: [],
          })),
        ),
    }
  }),
)

function confirm(
  question: Question.Interface,
  sessionID: string,
  input: { readonly question: string; readonly header: string; readonly tone: "warning" | "payment" },
) {
  return question.ask({
    sessionID: SessionID.make(sessionID),
    questions: [{
      question: input.question,
      header: input.header,
      options: [
        { label: "允许", description: "批准此操作。" },
        { label: "取消", description: "不要继续。" },
      ],
      custom: false,
      presentation: { tone: input.tone },
    }],
  }).pipe(
    Effect.map((answers) => answers[0]?.includes("允许") === true),
    Effect.catchTag("QuestionRejectedError", () => Effect.succeed(false)),
  )
}
