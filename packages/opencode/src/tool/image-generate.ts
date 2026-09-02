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
              segmentID: result.segmentID,
              filePath: result.filePath,
              mimeType: result.mimeType,
              provider: result.provider,
              model: result.model,
              attempts: result.attempts,
              elapsedMs: result.elapsedMs,
              cost: result.cost,
            },
            attachments: [
              {
                type: "file" as const,
                mime: result.mimeType,
                filename: result.filePath.split(/[\\/]/).at(-1),
                url: pathToFileURL(result.filePath).href,
              },
            ],
          }
        }).pipe(Effect.catch((error) => Effect.die(error))),
    }
  }),
)
