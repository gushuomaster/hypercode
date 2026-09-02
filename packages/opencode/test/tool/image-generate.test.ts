import { describe, expect, test } from "bun:test"
import { Cause, Effect, Exit, Layer } from "effect"
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
    expect(output.metadata).toMatchObject(result)
    expect(JSON.stringify(output)).not.toContain("secret")
  })

  test("preserves generation errors as diagnosable failures", async () => {
    const failure = new ImageGenerationService.GenerationError({ segmentID: "seg-1", reason: "contract unavailable" })
    const exit = await Effect.runPromiseExit(execute({ generate: () => Effect.fail(failure) }))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(Cause.pretty(exit.cause)).toContain("contract unavailable")
  })
})
