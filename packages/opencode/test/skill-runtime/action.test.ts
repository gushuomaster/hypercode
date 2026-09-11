import { Artifact } from "../../src/artifact/schema"
import { ArtifactStore } from "../../src/artifact/store"
import { CapabilityLLM } from "../../src/capability/llm"
import { CapabilityModelRouter } from "../../src/capability/model-router"
import { Capability } from "../../src/capability/schema"
import { ImageGenerationService } from "../../src/image-generation/service"
import { Question } from "../../src/question"
import { SkillRuntimeAction } from "../../src/skill-runtime/action"
import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import path from "node:path"
import { tmpdir } from "../fixture/fixture"

const candidate: Capability.Candidate = {
  providerID: "test",
  modelID: "multimodal",
  capabilities: { input: ["text", "image"], output: ["text", "image"], structuredOutput: true, tools: false },
  context: 100_000,
  cost: "free",
  credentialAvailable: true,
  healthy: true,
  quality: "high",
  latency: "interactive",
}

const routerLayer = Layer.mock(CapabilityModelRouter.Service, {
  snapshot: ({ requirements, policy }) => Effect.succeed({
    createdAt: new Date(0).toISOString(),
    requirements,
    candidates: policy.cost === "free-only" ? [candidate] : [candidate],
  }),
  select: () => Effect.succeed(candidate),
})
const questionLayer = Layer.mock(Question.Service, {})

function run(
  input: SkillRuntimeAction.Input,
  layers: {
    llm: Layer.Layer<CapabilityLLM.Service>
    images?: Layer.Layer<ImageGenerationService.Service>
    artifacts?: Layer.Layer<ArtifactStore.Service>
    question?: Layer.Layer<Question.Service>
    router?: Layer.Layer<CapabilityModelRouter.Service>
  },
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* SkillRuntimeAction.Service).run(input)
    }).pipe(
      Effect.provide(SkillRuntimeAction.layer),
      Effect.provide(layers.router ?? routerLayer),
      Effect.provide(layers.llm),
      Effect.provide(layers.images ?? Layer.mock(ImageGenerationService.Service, {})),
      Effect.provide(layers.artifacts ?? Layer.mock(ArtifactStore.Service, {})),
      Effect.provide(layers.question ?? questionLayer),
    ),
  )
}

const input = (projectDirectory: string): Omit<SkillRuntimeAction.Input, "action"> => ({
  workflowID: "workflow-1",
  sessionID: "ses_action",
  projectDirectory,
  policy: { confirmedModels: [], order: [], cost: "free-only" },
  dependencyResults: new Map(),
})

describe("skill runtime action adapter", () => {
  test("passes the complete authorized free image pool before any paid escalation", async () => {
    await using project = await tmpdir()
    const freeA = { ...candidate, providerID: "free-a", modelID: "image-a" }
    const freeB = { ...candidate, providerID: "free-b", modelID: "image-b" }
    const paid = { ...candidate, providerID: "paid", modelID: "gpt-image-1-mini", cost: "paid" as const }
    let receivedPool: ReadonlyArray<{ provider: string; model: string }> = []
    const router = Layer.mock(CapabilityModelRouter.Service, {
      snapshot: ({ requirements }) => Effect.succeed({
        createdAt: new Date(0).toISOString(),
        requirements,
        candidates: [freeA, freeB, paid],
      }),
      select: ({ snapshot }) => Effect.succeed(snapshot.candidates[0]),
    })
    const result = await run({
      ...input(project.path),
      policy: { confirmedModels: ["free-a/image-a", "free-b/image-b"], order: [], cost: "free-first" },
      action: {
        operation_id: "image-pool",
        type: "image.generate",
        depends_on: [],
        requirements: { output: ["image"], aspect_ratio: "9:16" },
        payload: { prompt: "Generate" },
      },
    }, {
      llm: Layer.mock(CapabilityLLM.Service, {}),
      images: Layer.mock(ImageGenerationService.Service, {
        generate: (request) => Effect.sync(() => {
          receivedPool = request.modelPool
          return {
            operationID: request.operationID,
            artifact: {
              artifactID: Artifact.ID.make("abcdefghijklmnopqrstuvwxyzABCDEF"),
              readRef: "artifact:test",
              mimeType: "image/png",
              hash: "a".repeat(64),
              size: 1,
              createdAt: new Date(0).toISOString(),
              expiresAt: new Date(1).toISOString(),
            },
            provider: "free-a",
            model: "image-a",
            attempts: 1,
            elapsedMs: 1,
            cost: { known: false },
          }
        }),
      }),
      artifacts: Layer.mock(ArtifactStore.Service, {
        grant: () => Effect.succeed({ stagingDirectory: "D:\\staging", relativePath: "image.png", metadata: {} as never }),
      }),
      router,
    })

    expect(result.status).toBe("succeeded")
    expect(receivedPool).toEqual([
      { provider: "free-a", model: "image-a" },
      { provider: "free-b", model: "image-b" },
    ])
  })

  test("asks before paid image fallback and does not call paid models when rejected", async () => {
    await using project = await tmpdir()
    const free = { ...candidate, providerID: "free", modelID: "image-free" }
    const paid = { ...candidate, providerID: "openai", modelID: "gpt-image-1-mini", cost: "paid" as const }
    const pools: Array<ReadonlyArray<{ provider: string; model: string }>> = []
    const questions: Question.Info[] = []
    const result = await run({
      ...input(project.path),
      policy: { confirmedModels: ["free/image-free"], order: [], cost: "free-first" },
      action: {
        operation_id: "image-paid-fallback",
        type: "image.generate",
        depends_on: [],
        requirements: { output: ["image"], aspect_ratio: "9:16" },
        payload: { prompt: "Generate" },
      },
    }, {
      llm: Layer.mock(CapabilityLLM.Service, {}),
      router: Layer.mock(CapabilityModelRouter.Service, {
        snapshot: ({ requirements }) => Effect.succeed({
          createdAt: new Date(0).toISOString(),
          requirements,
          candidates: [free, paid],
        }),
        select: ({ snapshot }) => Effect.succeed(snapshot.candidates[0]),
      }),
      images: Layer.mock(ImageGenerationService.Service, {
        generate: (request) => Effect.gen(function* () {
          pools.push(request.modelPool)
          return yield* new ImageGenerationService.GenerationError({
            operationID: request.operationID,
            reason: "free pool failed",
          })
        }),
      }),
      question: Layer.mock(Question.Service, {
        ask: ({ questions: inputQuestions }) => Effect.sync(() => {
          questions.push(...inputQuestions)
          return [["取消"]]
        }),
      }),
    })

    expect(result).toMatchObject({ status: "failed", error: { code: "paid-confirmation-rejected" } })
    expect(pools).toEqual([[{ provider: "free", model: "image-free" }]])
    expect(questions).toHaveLength(1)
    expect(questions[0]?.header).toBe("确认付费图片模型")
    expect(questions[0]?.presentation?.tone).toBe("payment")
  })

  test("loads role-labelled project and dependency artifact attachments without exposing arbitrary paths", async () => {
    await using project = await tmpdir()
    await using staging = await tmpdir()
    const evidence = path.join(project.path, "evidence.png")
    const generated = path.join(staging.path, "content")
    await Bun.write(evidence, "evidence")
    await Bun.write(generated, "candidate")
    const dependency: SkillRuntimeAction.Result = {
      operation_id: "image-1",
      status: "succeeded",
      output: { artifact: { staging_directory: staging.path, relative_path: "content", mime_type: "image/png" } },
      execution: { attempts: 1, elapsed_ms: 1, cost: { known: false } },
      error: null,
    }
    let received: CapabilityLLM.GenerateInput | undefined
    const result = await run({
      ...input(project.path),
      dependencyResults: new Map([["image-1", dependency]]),
      action: {
        operation_id: "qc-1",
        type: "llm.generate",
        depends_on: ["image-1"],
        requirements: { input_modalities: ["text", "image"], structured_output: true },
        payload: {
          prompt: "Review attachments",
          attachments: [
            { path: evidence, role: "source-evidence" },
            { path: generated, role: "candidate" },
          ],
          output_schema: { type: "object" },
        },
      },
    }, {
      llm: Layer.mock(CapabilityLLM.Service, {
        generate: (value) => Effect.sync(() => {
          received = value
          return { text: "{\"verdict\":\"accepted\"}", attempts: [] }
        }),
      }),
    })

    expect(result.status).toBe("succeeded")
    expect(received?.attachments?.map((item) => item.role)).toEqual(["source-evidence", "candidate"])
    expect(received?.attachments?.map((item) => new TextDecoder().decode(item.bytes))).toEqual(["evidence", "candidate"])
    expect(received?.attachments?.map((item) => item.mediaType)).toEqual(["image/png", "image/png"])
    expect((received as (CapabilityLLM.GenerateInput & { outputSchema?: unknown }) | undefined)?.outputSchema).toEqual({
      type: "object",
    })

    const rejected = await run({
      ...input(project.path),
      action: {
        operation_id: "qc-external",
        type: "llm.generate",
        depends_on: [],
        requirements: {},
        payload: { prompt: "Review", attachments: [{ path: generated, role: "untrusted" }] },
      },
    }, {
      llm: Layer.mock(CapabilityLLM.Service, {
        generate: () => Effect.die(new Error("untrusted attachment must not reach the provider")),
      }),
    })
    expect(rejected).toMatchObject({ status: "failed", error: { code: "attachment-invalid" } })
  })

  test("loads exact declared input attachments without exposing sibling files", async () => {
    await using project = await tmpdir()
    await using inputs = await tmpdir()
    const product = path.join(inputs.path, "product.png")
    const sibling = path.join(inputs.path, "private.png")
    await Bun.write(product, "product")
    await Bun.write(sibling, "private")
    let received: CapabilityLLM.GenerateInput | undefined
    const base = {
      ...input(project.path),
      declaredInputs: new Set([product]),
    }
    const result = await run({
      ...base,
      action: {
        operation_id: "qc-declared-input",
        type: "llm.generate",
        depends_on: [],
        requirements: {},
        payload: { prompt: "Review", attachments: [{ path: product, role: "product" }] },
      },
    }, {
      llm: Layer.mock(CapabilityLLM.Service, {
        generate: (value) => Effect.sync(() => {
          received = value
          return { text: "accepted", attempts: [] }
        }),
      }),
    })

    expect(result.status).toBe("succeeded")
    expect(received?.attachments?.map((item) => new TextDecoder().decode(item.bytes))).toEqual(["product"])

    const rejected = await run({
      ...base,
      action: {
        operation_id: "qc-undeclared-sibling",
        type: "llm.generate",
        depends_on: [],
        requirements: {},
        payload: { prompt: "Review", attachments: [{ path: sibling, role: "product" }] },
      },
    }, {
      llm: Layer.mock(CapabilityLLM.Service, {
        generate: () => Effect.die(new Error("undeclared sibling must not reach the provider")),
      }),
    })
    expect(rejected).toMatchObject({ status: "failed", error: { code: "attachment-invalid" } })
  })

  test("accepts generic reference records and returns an artifact without business fields", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, "reference")
    const artifactID = Artifact.ID.make("abcdefghijklmnopqrstuvwxyzABCDEF")
    let references: ReadonlyArray<string> = []
    const result = await run({
      ...input(project.path),
      action: {
        operation_id: "image-1",
        type: "image.generate",
        depends_on: [],
        requirements: { output: ["image"], aspect_ratio: "9:16" },
        payload: { prompt: "Generate", references: [{ path: reference, role: "product" }] },
      },
    }, {
      llm: Layer.mock(CapabilityLLM.Service, {}),
      images: Layer.mock(ImageGenerationService.Service, {
        generate: (request) => Effect.sync(() => {
          references = request.referenceImages
          return {
            operationID: request.operationID,
            artifact: {
              artifactID,
              readRef: `artifact:${artifactID}`,
              mimeType: "image/png",
              hash: "a".repeat(64),
              size: 128,
              createdAt: "2026-09-04T00:00:00.000Z",
              expiresAt: "2026-09-05T00:00:00.000Z",
            },
            provider: "test",
            model: "multimodal",
            attempts: 1,
            elapsedMs: 1,
            cost: { known: false },
          }
        }),
      }),
      artifacts: Layer.mock(ArtifactStore.Service, {
        grant: () => Effect.succeed({
          stagingDirectory: "D:\\staging\\opaque",
          relativePath: "content",
          metadata: {} as never,
        }),
      }),
    })

    expect(references).toEqual([reference])
    expect(result.output.artifact).toMatchObject({
      artifact_id: artifactID,
      operation_id: "image-1",
      staging_directory: "D:\\staging\\opaque",
      relative_path: "content",
    })
    expect(result.output.artifact).not.toHaveProperty("segment_id")
  })
})
