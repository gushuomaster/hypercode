import { Auth } from "@/auth"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer, Schema } from "effect"
import { ImageGeneration } from "./schema"

const OPENAI_BASE_URL = "https://api.openai.com/v1"

export type ReferenceImage = {
  filename: string
  bytes: Uint8Array
}

export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()("ImageGenerationProviderError", {
  provider: Schema.Union([Schema.Literal("nvidia"), Schema.Literal("openai")]),
  model: Schema.String,
  status: Schema.optional(Schema.Number),
  retryable: Schema.Boolean,
  reason: Schema.String,
}) {
  override get message() {
    return `Image generation failed for ${this.provider}/${this.model}: ${this.reason}`
  }
}

export type Output = {
  bytes: Uint8Array
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  cost: { amount?: number; currency?: string; known: boolean }
}

export interface Interface {
  readonly generate: (input: {
    provider: ImageGeneration.Provider
    model: string
    prompt: string
    referenceImages: ReadonlyArray<ReferenceImage>
    width: 9
    height: 16
  }) => Effect.Effect<Output, ProviderError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ImageGenerationProvider") {}

export const layer = (options: { openaiBaseURL?: string } = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const auth = yield* Auth.Service

      const generate = Effect.fn("ImageGenerationProvider.generate")(function* (input: {
        provider: ImageGeneration.Provider
        model: string
        prompt: string
        referenceImages: ReadonlyArray<ReferenceImage>
        width: 9
        height: 16
      }) {
        if (input.provider === "nvidia")
          return yield* new ProviderError({
            provider: input.provider,
            model: input.model,
            retryable: false,
            reason: "NVIDIA image generation contract unavailable",
          })

        const stored = yield* auth.get(input.provider).pipe(
          Effect.mapError(
            () =>
              new ProviderError({
                provider: input.provider,
                model: input.model,
                retryable: false,
                reason: "credential lookup failed",
              }),
          ),
        )
        const key = credential(stored) ?? process.env.OPENAI_API_KEY
        if (!key)
          return yield* new ProviderError({
            provider: input.provider,
            model: input.model,
            retryable: false,
            reason: "credential is not configured",
          })

        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(
              `${trimSlash(options.openaiBaseURL ?? OPENAI_BASE_URL)}${input.referenceImages.length ? "/images/edits" : "/images/generations"}`,
              {
                method: "POST",
                headers: input.referenceImages.length
                  ? { authorization: `Bearer ${key}` }
                  : { authorization: `Bearer ${key}`, "content-type": "application/json" },
                body: input.referenceImages.length
                  ? editBody(input)
                  : JSON.stringify({
                      model: input.model,
                      prompt: input.prompt,
                      size: "1024x1536",
                      output_format: "png",
                    }),
              },
            ),
          catch: () =>
            new ProviderError({
              provider: input.provider,
              model: input.model,
              retryable: true,
              reason: "request failed",
            }),
        })
        if (!response.ok)
          return yield* new ProviderError({
            provider: input.provider,
            model: input.model,
            status: response.status,
            retryable: response.status === 408 || response.status === 429 || response.status >= 500,
            reason: `provider returned HTTP ${response.status}`,
          })

        const encoded = yield* Effect.tryPromise({
          try: () => response.arrayBuffer(),
          catch: () =>
            new ProviderError({
              provider: input.provider,
              model: input.model,
              status: response.status,
              retryable: true,
              reason: "provider response body was interrupted",
            }),
        })
        const body = yield* Effect.try({
          try: () => JSON.parse(new TextDecoder().decode(encoded)) as unknown,
          catch: () =>
            new ProviderError({
              provider: input.provider,
              model: input.model,
              status: response.status,
              retryable: false,
              reason: "provider returned invalid JSON",
            }),
        })
        return yield* Effect.try({
          try: () => decode(body, input.provider, input.model, response.status),
          catch: (cause) =>
            cause instanceof ProviderError
              ? cause
              : new ProviderError({
                  provider: input.provider,
                  model: input.model,
                  status: response.status,
                  retryable: false,
                  reason: "provider response could not be decoded",
                }),
        })
      })

      return Service.of({ generate })
    }),
  )

export const defaultLayer = layer().pipe(Layer.provide(Auth.defaultLayer))

export const node = LayerNode.make(layer(), [Auth.node])

function editBody(input: { model: string; prompt: string; referenceImages: ReadonlyArray<ReferenceImage> }) {
  const form = new FormData()
  form.set("model", input.model)
  form.set("prompt", input.prompt)
  form.set("size", "1024x1536")
  form.set("output_format", "png")
  input.referenceImages
    .slice(0, 1)
    .forEach((file) =>
      form.append(
        "image",
        new Blob([
          file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer,
        ]),
        file.filename,
      ),
    )
  return form
}

function credential(auth: Auth.Info | undefined) {
  if (!auth) return undefined
  if (auth.type === "oauth") return auth.access
  return auth.key
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function decode(body: unknown, provider: ImageGeneration.Provider, model: string, status: number): Output {
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.data[0]))
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "provider response omitted image data",
    })
  const image = body.data[0]
  if (typeof image.b64_json !== "string")
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "provider response omitted image bytes",
    })
  const bytes = Buffer.from(image.b64_json, "base64")
  if (!bytes.length)
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "provider returned empty image bytes",
    })
  const usage = isRecord(body.usage) ? body.usage : undefined
  const amount = usage && typeof usage.cost === "number" ? usage.cost : undefined
  const currency = usage && typeof usage.currency === "string" ? usage.currency : undefined
  return {
    bytes,
    mimeType: detectMime(bytes, provider, model, status),
    cost: amount === undefined ? { known: false } : { amount, currency, known: true },
  }
}

function detectMime(bytes: Uint8Array, provider: ImageGeneration.Provider, model: string, status: number) {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png" as const
  if (bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return "image/jpeg" as const
  if (
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  )
    return "image/webp" as const
  throw new ProviderError({
    provider,
    model,
    status,
    retryable: false,
    reason: "provider returned an unsupported image format",
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export * as ImageGenerationProvider from "./provider"
