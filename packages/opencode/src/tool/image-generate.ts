import { Effect, Schema } from "effect"
import { Tool } from "./tool"
import { ImageGeneration } from "@/image-generation/schema"
import { ImageGenerationService } from "@/image-generation/service"
import { pathToFileURL } from "node:url"

export const Parameters = Schema.Struct({
  segmentID: Schema.String,
  prompt: Schema.String,
  referenceImages: Schema.Array(Schema.String),
  outputDirectory: Schema.String,
  modelPool: Schema.Array(
    Schema.Struct({
      provider: Schema.Union([Schema.Literal("nvidia"), Schema.Literal("openai")]),
      model: Schema.String,
    }),
  ),
})

type Metadata = (
  | ({ status: "success" } & ImageGeneration.Result)
  | { status: "error"; segmentID: string; guidance?: string }
) & { truncated?: boolean }

const QWEN_GUIDANCE = "Configure a trusted NVIDIA Qwen NIM endpoint before retrying."

export const ImageGenerateTool = Tool.define(
  "image_generate",
  Effect.gen(function* () {
    const service = yield* ImageGenerationService.Service
    return {
      description: "Generate a portrait 9:16 image from a prompt and optional reference image.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>) =>
        Effect.gen(function* () {
          const result = yield* service.generate({
            ...params,
            width: 9,
            height: 16,
          } as ImageGeneration.Request)
          return {
            title: `Generated image for ${result.segmentID}`,
            output: `Image generated successfully: ${result.filePath}`,
            metadata: {
              status: "success" as const,
              segmentID: result.segmentID,
              filePath: result.filePath,
              mimeType: result.mimeType,
              provider: result.provider,
              model: result.model,
              attempts: result.attempts,
              elapsedMs: result.elapsedMs,
              cost: result.cost,
            } as Metadata,
            attachments: [
              {
                type: "file" as const,
                mime: result.mimeType,
                filename: result.filePath.split(/[\\/]/).at(-1),
                url: pathToFileURL(result.filePath).href,
              },
            ],
          }
        }).pipe(
          Effect.catch((error) =>
            Effect.succeed(
              (() => {
                const guidance =
                  error instanceof ImageGenerationService.GenerationError && error.guidance === QWEN_GUIDANCE
                    ? error.guidance
                    : undefined
                return {
                  title: `Image generation failed for ${params.segmentID}`,
                  output: guidance ?? `Image generation failed for segment ${params.segmentID}.`,
                  metadata: {
                    status: "error" as const,
                    segmentID: params.segmentID,
                    ...(guidance && { guidance }),
                  } as Metadata,
                  attachments: [],
                }
              })(),
            ),
          ),
        ),
    }
  }),
)
