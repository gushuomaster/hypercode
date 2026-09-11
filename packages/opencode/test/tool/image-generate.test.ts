import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Artifact } from "../../src/artifact/schema"
import { ImageGenerationService } from "../../src/image-generation/service"
import { MessageID, SessionID } from "../../src/session/schema"
import { ImageGenerateTool } from "../../src/tool/image-generate"
import { Tool } from "../../src/tool/tool"
import { Truncate } from "../../src/tool/truncate"

const artifactID = Artifact.ID.make("abcdefghijklmnopqrstuvwxyzABCDEF")
const result = {
  operationID: "operation-1",
  artifact: {
    artifactID,
    readRef: `artifact:${artifactID}`,
    mimeType: "image/png",
    hash: "a".repeat(64),
    size: 128,
    createdAt: "2026-09-04T00:00:00.000Z",
    expiresAt: "2026-09-05T00:00:00.000Z",
  },
  provider: "openai",
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
        operationID: "operation-1",
        prompt: "test",
        referenceImages: [],
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
  test("returns artifact metadata without a local path or attachment", async () => {
    const output = await Effect.runPromise(execute({ generate: () => Effect.succeed(result) }))
    expect(output.attachments).toEqual([])
    expect(output.metadata).toMatchObject({
      status: "success",
      operation_id: "operation-1",
      artifact_id: artifactID,
      read_ref: `artifact:${artifactID}`,
      mime_type: "image/png",
      hash: "a".repeat(64),
      size: 128,
      provider: "openai",
      model: "gpt-image-1-mini",
    })
    expect(JSON.stringify(output)).not.toContain("file:")
    expect(JSON.stringify(output)).not.toContain("secret")
  })

  test("returns generation errors as safe structured tool results", async () => {
    const failure = new ImageGenerationService.GenerationError({
      operationID: "operation-1",
      reason: "credential secret prompt image-bytes",
    })
    const output = await Effect.runPromise(execute({ generate: () => Effect.fail(failure) }))
    expect(output).toEqual({
      title: "Image generation failed for operation-1",
      output: "Image generation failed for operation operation-1.",
      metadata: { status: "error", operation_id: "operation-1", truncated: false },
      attachments: [],
    })
    expect(JSON.stringify(output)).not.toContain("credential secret")
    expect(JSON.stringify(output)).not.toContain("image-bytes")
  })
})
