import { Effect, Option, Schema } from "effect"
import { Tool } from "./tool"
import { VideoReplica, APPROVAL_PHRASE, type VisualAssetSelection, type WorkflowInput } from "@/video-replica/service"
import { Skill } from "@/skill"
import { EffectBridge } from "@/effect/bridge"
import { Question } from "@/question"

export const Parameters = Schema.Struct({
  action: Schema.Literals([
    "start",
    "resume",
    "approve_storyboard",
    "generate",
    "accept_image",
    "import_plus_image",
    "compile_delivery",
    "select_visual_assets",
    "list_visual_assets",
    "list_packs",
    "confirm_models",
  ]),
  workflowID: Schema.optional(Schema.String),
  referenceVideo: Schema.optional(Schema.String),
  productImages: Schema.optional(Schema.Array(Schema.String)),
  outputDirectory: Schema.optional(Schema.String),
  productName: Schema.optional(Schema.String),
  segmentIDs: Schema.optional(Schema.Array(Schema.String)),
  segmentID: Schema.optional(Schema.String),
  decision: Schema.optional(Schema.String),
  filePath: Schema.optional(Schema.String),
  answer: Schema.optional(Schema.String),
  visualAssetMode: Schema.optional(Schema.Literals(["follow-source", "existing-pack", "create-pack"])),
  packID: Schema.optional(Schema.String),
  packVersion: Schema.optional(Schema.Number),
  assetRoot: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  layersPath: Schema.optional(Schema.String),
  propsPath: Schema.optional(Schema.String),
  globalOperationsPath: Schema.optional(Schema.String),
  negativeRulesPath: Schema.optional(Schema.String),
  followSourceLayers: Schema.optional(Schema.Array(Schema.String)),
})

type Params = Schema.Schema.Type<typeof Parameters>

export const VideoReplicaTool = Tool.define<typeof Parameters, { status: string; workflowID: string }, Question.Service>(
  "video_replica",
  Effect.gen(function* () {
    const questionService = yield* Question.Service
    return {
      description: "Coordinate the read-only doubao-video-replica analysis and storyboard workflow.",
      parameters: Parameters,
      execute: (params: Params, ctx) =>
        Effect.gen(function* () {
          const service = yield* Effect.serviceOption(VideoReplica.Service)
          if (Option.isNone(service)) return yield* Effect.fail(new Error("VideoReplica service is unavailable"))
          const skillLocation = yield* resolveSkillLocation()

          if (params.action === "start") {
            if (!params.referenceVideo || !params.outputDirectory)
              return yield* Effect.fail(new Error("start requires referenceVideo and outputDirectory"))
            const run = service.value.start({
              referenceVideo: params.referenceVideo,
              productImages: params.productImages ?? [],
              outputDirectory: params.outputDirectory,
              productName: params.productName,
              sessionID: ctx.sessionID,
              ...(skillLocation && { skillLocation }),
            } satisfies WorkflowInput)
            const question = yield* Effect.promise(() => run.nextQuestion())
            if (question.questions[0]?.header === "视觉资产") {
              const answers = yield* questionService.ask({
                sessionID: ctx.sessionID,
                questions: question.questions,
                ...(ctx.callID && { tool: { messageID: ctx.messageID, callID: ctx.callID } }),
              })
              const choice = answers[0]?.[0]
              if (choice === "跟随参考视频") {
                yield* Effect.promise(() => run.selectVisualAssets({ mode: "follow-source" }))
                const approval = yield* Effect.promise(() => run.nextQuestion())
                return {
                  title: `Video replica workflow ${run.workflowID}`,
                  output: JSON.stringify({ workflowID: run.workflowID, question: approval }),
                  metadata: { status: "awaiting-approval", workflowID: run.workflowID },
                }
              }
              return {
                title: `Video replica workflow ${run.workflowID}`,
                output: JSON.stringify({ workflowID: run.workflowID, selection: choice, nextAction: "select_visual_assets" }),
                metadata: { status: "selection-required", workflowID: run.workflowID },
              }
            }
            return {
              title: `Video replica workflow ${run.workflowID}`,
              output: JSON.stringify({ workflowID: run.workflowID, question }),
              metadata: { status: "started", workflowID: run.workflowID },
            }
          }

          if (!params.workflowID) return yield* Effect.fail(new Error(`${params.action} requires workflowID`))
          if (params.action === "resume") {
            const run = yield* Effect.promise(() => service.value.resume(params.workflowID!, skillLocation))
            const pending = yield* Effect.promise(() => run.nextQuestion())
            const pendingQuestion = pending.questions[0]
            if (pendingQuestion && pendingQuestion.header !== "继续工作流") {
              const answers = yield* questionService.ask({
                sessionID: ctx.sessionID,
                questions: pending.questions,
                ...(ctx.callID && { tool: { messageID: ctx.messageID, callID: ctx.callID } }),
              })
              const answer = answers[0]?.[0]
              if (pendingQuestion.header === "视觉资产") {
                if (answer === "跟随参考视频") {
                  const selected = yield* Effect.promise(() => run.selectVisualAssets({ mode: "follow-source" }))
                  const question = yield* Effect.promise(() => selected.nextQuestion())
                  return {
                    title: `Resumed video replica workflow ${selected.workflowID}`,
                    output: JSON.stringify({ workflowID: selected.workflowID, question }),
                    metadata: { status: "awaiting-approval", workflowID: selected.workflowID },
                  }
                }
                return {
                  title: `Resumed video replica workflow ${run.workflowID}`,
                  output: JSON.stringify({
                    workflowID: run.workflowID,
                    selection: answer,
                    nextAction: "select_visual_assets",
                    question: pending,
                  }),
                  metadata: { status: "selection-required", workflowID: run.workflowID },
                }
              }
              if (pendingQuestion.header === "确认图片模型" && answer === "确认使用") {
                const confirmed = yield* Effect.promise(() => run.confirmModels(answer))
                const question = yield* Effect.promise(() => confirmed.nextQuestion())
                return {
                  title: `Resumed video replica workflow ${confirmed.workflowID}`,
                  output: JSON.stringify({ workflowID: confirmed.workflowID, question }),
                  metadata: { status: "resumed", workflowID: confirmed.workflowID },
                }
              }
              if (pendingQuestion.options.some((option) => option.label === APPROVAL_PHRASE) && answer === APPROVAL_PHRASE) {
                const approved = yield* Effect.promise(() => run.approveStoryboard(run.segmentIDs, answer))
                const question = yield* Effect.promise(() => approved.nextQuestion())
                return {
                  title: `Resumed video replica workflow ${approved.workflowID}`,
                  output: JSON.stringify({ workflowID: approved.workflowID, question }),
                  metadata: { status: "resumed", workflowID: approved.workflowID },
                }
              }
            }
            return {
              title: `Resumed video replica workflow ${run.workflowID}`,
              output: JSON.stringify({ workflowID: run.workflowID, phase: run.providerAttempts.length ? "in-progress" : "pending", question: pending }),
              metadata: { status: "resumed", workflowID: run.workflowID },
            }
          }

          if (params.action === "approve_storyboard") {
            const run = yield* Effect.promise(() =>
              service.value.approveStoryboard(params.workflowID!, params.segmentIDs ?? [], params.answer),
            )
            return {
              title: "Storyboard approved",
              output: JSON.stringify({ workflowID: run.workflowID, segmentIDs: run.segmentIDs }),
              metadata: { status: "approved", workflowID: run.workflowID },
            }
          }

          if (params.action === "select_visual_assets") {
            if (!params.visualAssetMode) return yield* Effect.fail(new Error("select_visual_assets requires visualAssetMode"))
            const selection: VisualAssetSelection =
              params.visualAssetMode === "existing-pack"
                ? { mode: "existing-pack", packID: params.packID ?? "", packVersion: params.packVersion ?? 0 }
                : {
                    mode: params.visualAssetMode,
                    ...(params.assetRoot && { assetRoot: params.assetRoot }),
                    ...(params.packID && { packID: params.packID }),
                    ...(params.name && { name: params.name }),
                    ...(params.layersPath && { layersPath: params.layersPath }),
                    ...(params.propsPath && { propsPath: params.propsPath }),
                    ...(params.globalOperationsPath && { globalOperationsPath: params.globalOperationsPath }),
                    ...(params.negativeRulesPath && { negativeRulesPath: params.negativeRulesPath }),
                    ...(params.followSourceLayers && { followSourceLayers: params.followSourceLayers }),
                  }
            const run = yield* Effect.promise(() => service.value.selectVisualAssets(params.workflowID!, selection))
            const question = yield* Effect.promise(() => run.nextQuestion())
            return {
              title: "Visual assets selected",
              output: JSON.stringify({ workflowID: run.workflowID, question }),
              metadata: { status: "awaiting-approval", workflowID: run.workflowID },
            }
          }

          if (params.action === "list_visual_assets" || params.action === "list_packs") {
            const run = yield* Effect.promise(() => service.value.resume(params.workflowID!, skillLocation))
            const packs = yield* Effect.promise(() => run.listVisualAssetPacks())
            return {
              title: "Available visual asset packs",
              output: JSON.stringify({ workflowID: run.workflowID, packs }),
              metadata: { status: "packs-listed", workflowID: run.workflowID },
            }
          }

          if (params.action === "confirm_models") {
            const run = yield* Effect.promise(() => service.value.resume(params.workflowID!, skillLocation))
            const confirmed = yield* Effect.promise(() => service.value.confirmModels(run.workflowID, params.answer ?? ""))
            const question = yield* Effect.promise(() => confirmed.nextQuestion())
            return {
              title: "Image models confirmed",
              output: JSON.stringify({ workflowID: confirmed.workflowID, question }),
              metadata: { status: "confirmed", workflowID: confirmed.workflowID },
            }
          }

          if (params.action === "generate") {
            const run = yield* Effect.promise(() => service.value.resume(params.workflowID!))
            const result = yield* Effect.promise(() => run.generate())
            return {
              title: "Video replica first-frame generation",
              output: JSON.stringify(result),
              metadata: { status: result.failed.length ? "partial" : "generated", workflowID: run.workflowID },
            }
          }

          if (params.action === "accept_image") {
            if (!params.segmentID || !params.decision)
              return yield* Effect.fail(new Error("accept_image requires segmentID and decision"))
            const run = yield* Effect.promise(() =>
              service.value.acceptImage(params.workflowID!, params.segmentID!, params.decision!),
            )
            return {
              title: "First frame decision recorded",
              output: JSON.stringify({ workflowID: run.workflowID, segmentID: params.segmentID, decision: params.decision }),
              metadata: { status: "recorded", workflowID: run.workflowID },
            }
          }

          if (params.action === "import_plus_image") {
            if (!params.filePath) return yield* Effect.fail(new Error("import_plus_image requires filePath"))
            const result = yield* Effect.promise(() => service.value.importPlusImage(params.workflowID!, params.filePath!))
            return {
              title: "Plus image match proposed",
              output: JSON.stringify(result),
              metadata: { status: "confirmation-required", workflowID: result.workflowID },
            }
          }

          const result = yield* Effect.promise(() => service.value.compileDelivery(params.workflowID!))
          return {
            title: "Video replica delivery compiled",
            output: JSON.stringify(result),
            metadata: { status: "compiled", workflowID: result.workflowID },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

function resolveSkillLocation() {
  return Effect.gen(function* () {
    const skill = yield* Effect.serviceOption(Skill.Service)
    if (Option.isNone(skill)) return undefined
    const bridge = yield* EffectBridge.make()
    const info = yield* Effect.promise(() => bridge.promise(skill.value.require("doubao-video-replica")))
    return info.location
  })
}
