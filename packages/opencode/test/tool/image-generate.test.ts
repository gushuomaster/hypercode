import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import path from "node:path"
import { Agent } from "../../src/agent/agent"
import { ImageGenerationService } from "../../src/image-generation/service"
import { MessageID, SessionID } from "../../src/session/schema"
import { ImageGenerateTool } from "../../src/tool/image-generate"
import { Tool } from "../../src/tool/tool"
import { Truncate } from "../../src/tool/truncate"

const result = {
  segmentID: "seg-1",
  filePath: path.resolve("generated", "seg-1.png"),
  mimeType: "image/png" as const,
  provider: "openai" as const,
  model: "gpt-image-1-mini",
  attempts: 1,
  elapsedMs: 12,
  cost: { known: false },
}

const truncateLayer = Layer.mock(Truncate.Service, {
  output: (output: string) => Effect.succeed({ content: output, truncated: false }),
})
const agentLayer = Layer.mock(Agent.Service, { get: () => Effect.succeed({ name: "build" } as never) })
const ctx = {
  sessionID: SessionID.make("ses_image-generate"),
  messageID: MessageID.make("msg_image-generate"),
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

function execute(service: ImageGenerationService.Interface) {
  return Effect.gen(function* () {
    const tool = yield* Tool.init(yield* ImageGenerateTool)
    return yield* tool.execute(
      {
        segmentID: "seg-1",
        prompt: "test",
        referenceImages: [],
        outputDirectory: "generated",
        modelPool: [{ provider: "openai", model: "gpt-image-1-mini" }],
      },
      ctx,
    )
  }).pipe(
    Effect.provide(Layer.succeed(ImageGenerationService.Service, ImageGenerationService.Service.of(service))),
    Effect.provide(truncateLayer),
    Effect.provide(agentLayer),
  )
}

describe("tool.image_generate", () => {
  test("returns a local attachment and metadata without secrets", async () => {
    const output = await Effect.runPromise(execute({ generate: () => Effect.succeed(result) }))
    expect(output.attachments).toEqual([
      { type: "file", mime: "image/png", filename: "seg-1.png", url: Bun.pathToFileURL(result.filePath).href },
    ])
    expect(output.metadata).toMatchObject({ status: "success", ...result })
    expect(JSON.stringify(output)).not.toContain("secret")
  })

  test("returns generation errors as safe structured tool results", async () => {
    const failure = new ImageGenerationService.GenerationError({
      segmentID: "seg-1",
      reason: "credential secret prompt image-bytes",
    })
    const output = await Effect.runPromise(execute({ generate: () => Effect.fail(failure) }))
    expect(output).toEqual({
      title: "Image generation failed for seg-1",
      output: "Image generation failed for segment seg-1.",
      metadata: { status: "error", segmentID: "seg-1", truncated: false },
      attachments: [],
    })
    expect(JSON.stringify(output)).not.toContain("credential secret")
    expect(JSON.stringify(output)).not.toContain("prompt")
    expect(JSON.stringify(output)).not.toContain("image-bytes")
  })

  test("returns safe configuration guidance for an unavailable Qwen NIM endpoint", async () => {
    const failure = Object.assign(
      new ImageGenerationService.GenerationError({ segmentID: "seg-1", reason: "internal provider details" }),
      { guidance: "Configure a trusted NVIDIA Qwen NIM endpoint before retrying." },
    )
    const output = await Effect.runPromise(execute({ generate: () => Effect.fail(failure) }))
    expect(output).toMatchObject({
      output: "Configure a trusted NVIDIA Qwen NIM endpoint before retrying.",
      metadata: {
        status: "error",
        segmentID: "seg-1",
        guidance: "Configure a trusted NVIDIA Qwen NIM endpoint before retrying.",
      },
      attachments: [],
    })
    expect(JSON.stringify(output)).not.toContain("internal provider details")
  })

  test("does not expose arbitrary generation guidance", async () => {
    const failure = Object.assign(
      new ImageGenerationService.GenerationError({ segmentID: "seg-1", reason: "internal" }),
      { guidance: "secret prompt and credentials" },
    )
    const output = await Effect.runPromise(execute({ generate: () => Effect.fail(failure) }))
    expect(output.metadata).toEqual({ status: "error", segmentID: "seg-1", truncated: false })
    expect(output.output).toBe("Image generation failed for segment seg-1.")
    expect(JSON.stringify(output)).not.toContain("secret prompt")
  })
})
