import { Effect, Option, Schema } from "effect"
import { Tool } from "./tool"
import { VideoReplica, type WorkflowInput } from "@/video-replica/service"
import { Skill } from "@/skill"
import { EffectBridge } from "@/effect/bridge"

export const Parameters = Schema.Struct({
  action: Schema.Literals([
    "start",
    "resume",
    "approve_storyboard",
    "generate",
    "accept_image",
    "import_plus_image",
    "compile_delivery",
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
})

type Params = Schema.Schema.Type<typeof Parameters>

export const VideoReplicaTool = Tool.define(
  "video_replica",
  Effect.gen(function* () {
    return {
      description: "Coordinate the read-only doubao-video-replica analysis and storyboard workflow.",
      parameters: Parameters,
      execute: (params: Params) =>
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
              ...(skillLocation && { skillLocation }),
            } satisfies WorkflowInput)
            const question = yield* Effect.promise(() => run.nextQuestion())
            return {
              title: `Video replica workflow ${run.workflowID}`,
              output: JSON.stringify({ workflowID: run.workflowID, question }),
              metadata: { status: "started", workflowID: run.workflowID },
            }
          }

          if (!params.workflowID) return yield* Effect.fail(new Error(`${params.action} requires workflowID`))
          if (params.action === "resume") {
            const run = yield* Effect.promise(() => service.value.resume(params.workflowID!, skillLocation))
            return {
              title: `Resumed video replica workflow ${run.workflowID}`,
              output: JSON.stringify({ workflowID: run.workflowID, phase: run.providerAttempts.length ? "in-progress" : "pending" }),
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
        }).pipe(
          Effect.catch((error) =>
            Effect.succeed({
              title: "Video replica workflow failed",
              output: error instanceof Error ? redactSecrets(error.message) : "Video replica workflow failed",
              metadata: { status: "error" as const, workflowID: params.workflowID ?? "unknown" },
            }),
          ),
        ),
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

function redactSecrets(message: string) {
  return message.replace(/((?:api[_-]?key|token|secret|authorization|bearer)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
}
