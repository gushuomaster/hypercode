import { Effect, Schema } from "effect"
import { Tool } from "./tool"
import { ImageGeneration } from "@/image-generation/schema"
import { ImageGenerationService } from "@/image-generation/service"

export const Parameters = Schema.Struct({
  operationID: Schema.String,
  prompt: Schema.String,
  referenceImages: Schema.Array(Schema.String),
  modelPool: Schema.Array(
    Schema.Struct({
      provider: Schema.String,
      model: Schema.String,
    }),
  ),
})

type Metadata =
  | {
      readonly status: "success"
      readonly operation_id: string
      readonly artifact_id: string
      readonly read_ref: string
      readonly mime_type: string
      readonly hash: string
      readonly size: number
      readonly provider: string
      readonly model: string
      readonly attempts: number
      readonly elapsed_ms: number
      readonly cost: ImageGeneration.Result["cost"]
      readonly truncated?: boolean
    }
  | { readonly status: "error"; readonly operation_id: string; readonly truncated?: boolean }

export const ImageGenerateTool = Tool.define(
  "image_generate",
  Effect.gen(function* () {
    const service = yield* ImageGenerationService.Service
    return {
      description: "Generate an image into HyperCode-managed temporary artifact storage.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx) =>
        Effect.gen(function* () {
          const result = yield* service.generate({
            workflowID: ctx.sessionID,
            operationID: params.operationID,
            prompt: params.prompt,
            referenceImages: params.referenceImages,
            modelPool: params.modelPool,
            width: 9,
            height: 16,
          })
          return {
            title: `Generated image artifact for ${result.operationID}`,
            output: `Image staged as artifact ${result.artifact.artifactID}.`,
            metadata: {
              status: "success" as const,
              operation_id: result.operationID,
              artifact_id: result.artifact.artifactID,
              read_ref: result.artifact.readRef,
              mime_type: result.artifact.mimeType,
              hash: result.artifact.hash,
              size: result.artifact.size,
              provider: result.provider,
              model: result.model,
              attempts: result.attempts,
              elapsed_ms: result.elapsedMs,
              cost: result.cost,
            } as Metadata,
            attachments: [],
          }
        }).pipe(
          Effect.catch(() =>
            Effect.succeed({
              title: `Image generation failed for ${params.operationID}`,
              output: `Image generation failed for operation ${params.operationID}.`,
              metadata: {
                status: "error" as const,
                operation_id: params.operationID,
              } as Metadata,
              attachments: [],
            }),
          ),
        ),
    }
  }),
)
