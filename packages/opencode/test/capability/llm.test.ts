import { describe, expect, it } from "bun:test"
import type { LanguageModelV3, LanguageModelV3CallOptions } from "@ai-sdk/provider"
import { Effect, Layer } from "effect"
import { CapabilityLLM } from "../../src/capability/llm"
import { CapabilityModelHealth } from "../../src/capability/model-health"
import { Provider } from "../../src/provider/provider"

const candidate = { providerID: "provider", modelID: "model" }

describe("capability llm", () => {
  it("disables provider storage for OpenAI OAuth-compatible responses", async () => {
    let request: LanguageModelV3CallOptions | undefined
    const language: LanguageModelV3 = {
      specificationVersion: "v3",
      provider: "openai.responses",
      modelId: "gpt-5.5",
      supportedUrls: {},
      doGenerate: () => Promise.reject(new Error("non-streaming transport is not supported")),
      doStream: (options) => {
        request = options
        return Promise.resolve({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] })
              controller.enqueue({ type: "text-start", id: "text-1" })
              controller.enqueue({ type: "text-delta", id: "text-1", delta: "ok" })
              controller.enqueue({ type: "text-end", id: "text-1" })
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
              })
              controller.close()
            },
          }),
        })
      },
    }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* CapabilityLLM.Service).generate({
          candidate: {
            providerID: "openai",
            modelID: "gpt-5.5",
            capabilities: { input: ["text"], output: ["text"], structuredOutput: true, tools: true },
            context: 400_000,
            cost: "free",
            credentialAvailable: true,
            healthy: true,
            quality: "balanced",
            latency: "interactive",
          },
          prompt: "Reply with exactly OK",
        })
      }).pipe(
        Effect.provide(CapabilityLLM.layer),
        Effect.provide(Layer.merge(
          Layer.mock(Provider.Service, {
            getModel: () => Effect.succeed({} as never),
            getLanguage: () => Effect.succeed(language),
          }),
          CapabilityModelHealth.layer,
        )),
      ),
    )

    expect(result.text).toBe("ok")
    expect(request?.providerOptions).toEqual({ openai: { store: false } })
  })

  it("uses streaming transport required by ChatGPT Codex responses", async () => {
    let streamed = false
    const language: LanguageModelV3 = {
      specificationVersion: "v3",
      provider: "openai.responses",
      modelId: "gpt-5.5",
      supportedUrls: {},
      doGenerate: () => Promise.reject(new Error("non-streaming transport is not supported")),
      doStream: () => {
        streamed = true
        return Promise.resolve({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] })
              controller.enqueue({ type: "text-start", id: "text-1" })
              controller.enqueue({ type: "text-delta", id: "text-1", delta: "ok" })
              controller.enqueue({ type: "text-end", id: "text-1" })
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
              })
              controller.close()
            },
          }),
        })
      },
    }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* CapabilityLLM.Service).generate({
          candidate: {
            providerID: "openai",
            modelID: "gpt-5.5",
            capabilities: { input: ["text"], output: ["text"], structuredOutput: true, tools: true },
            context: 400_000,
            cost: "free",
            credentialAvailable: true,
            healthy: true,
            quality: "balanced",
            latency: "interactive",
          },
          prompt: "Reply with exactly OK",
        })
      }).pipe(
        Effect.provide(CapabilityLLM.layer),
        Effect.provide(Layer.merge(
          Layer.mock(Provider.Service, {
            getModel: () => Effect.succeed({} as never),
            getLanguage: () => Effect.succeed(language),
          }),
          CapabilityModelHealth.layer,
        )),
      ),
    )

    expect(streamed).toBe(true)
    expect(result.text).toBe("ok")
  })

  it("supplies the requested JSON schema to the model", async () => {
    let request: LanguageModelV3CallOptions | undefined
    const language: LanguageModelV3 = {
      specificationVersion: "v3",
      provider: "openai.responses",
      modelId: "gpt-5.5",
      supportedUrls: {},
      doGenerate: () => Promise.reject(new Error("non-streaming transport is not supported")),
      doStream: (options) => {
        request = options
        return Promise.resolve({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] })
              controller.enqueue({ type: "text-start", id: "text-1" })
              controller.enqueue({ type: "text-delta", id: "text-1", delta: "{\"segments\":[]}" })
              controller.enqueue({ type: "text-end", id: "text-1" })
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
              })
              controller.close()
            },
          }),
        })
      },
    }
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* (yield* CapabilityLLM.Service).generate({
          candidate: {
            providerID: "openai",
            modelID: "gpt-5.5",
            capabilities: { input: ["text"], output: ["text"], structuredOutput: true, tools: true },
            context: 400_000,
            cost: "free",
            credentialAvailable: true,
            healthy: true,
            quality: "balanced",
            latency: "interactive",
          },
          prompt: "Analyze evidence",
          outputSchema: {
            type: "object",
            required: ["segments"],
            properties: { segments: { type: "array" } },
          },
        })
      }).pipe(
        Effect.provide(CapabilityLLM.layer),
        Effect.provide(Layer.merge(
          Layer.mock(Provider.Service, {
            getModel: () => Effect.succeed({} as never),
            getLanguage: () => Effect.succeed(language),
          }),
          CapabilityModelHealth.layer,
        )),
      ),
    )

    const text = request?.prompt.flatMap((message) =>
      message.role === "user"
        ? message.content.flatMap((part) => part.type === "text" ? [part.text] : [])
        : [],
    ).join("\n")
    expect(request?.responseFormat).toEqual({ type: "json" })
    expect(text).toContain("Output JSON schema:")
    expect(text).toContain('"required":["segments"]')
  })

  it("retries only bounded temporary failures and records every attempt", async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const observed: CapabilityLLM.Attempt[] = []
      const result = yield* CapabilityLLM.retry({
        candidate,
        maxRetries: 2,
        invoke: (attempt) => attempt < 3 ? Effect.fail({ statusCode: attempt === 1 ? 429 : 503 }) : Effect.succeed("ok"),
        onAttempt: (attempt) => observed.push(attempt),
      })
      expect(result.text).toBe("ok")
      expect(result.attempts.map((attempt) => attempt.outcome)).toEqual(["retry", "retry", "success"])
      expect(observed).toEqual(result.attempts)
    }))
  })

  it("does not retry non-transient provider errors", async () => {
    await Effect.runPromise(Effect.gen(function* () {
      let calls = 0
      const error = yield* Effect.flip(CapabilityLLM.retry({
        candidate,
        maxRetries: 3,
        invoke: () => Effect.sync(() => calls++).pipe(Effect.andThen(Effect.fail({ statusCode: 400 }))),
      }))
      expect(calls).toBe(1)
      expect(error.retryable).toBe(false)
      expect(error.code).toBe("provider-failure")
    }))
  })

  it("caps retry policy and treats connectivity failures as transient", async () => {
    await Effect.runPromise(Effect.gen(function* () {
      let calls = 0
      const error = yield* Effect.flip(CapabilityLLM.retry({
        candidate,
        maxRetries: 99,
        invoke: () => Effect.sync(() => calls++).pipe(Effect.andThen(Effect.fail({ code: "ECONNRESET" }))),
      }))
      expect(calls).toBe(4)
      expect(error.retryable).toBe(true)
    }))
  })
})
