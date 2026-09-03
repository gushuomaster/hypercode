import { Auth } from "@/auth"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer, Schema } from "effect"
import { ImageGeneration } from "./schema"

const OPENAI_BASE_URL = "https://api.openai.com/v1"
const NVIDIA_BASE_URL = "https://ai.api.nvidia.com/v1"

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

type HttpRequest = {
  url: string
  headers: Record<string, string>
  body: BodyInit
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

export const layer = (options: { openaiBaseURL?: string; nvidiaBaseURL?: string; nvidiaQwenBaseURL?: string } = {}) =>
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
        const key = credential(stored) ?? process.env[input.provider === "nvidia" ? "NVIDIA_API_KEY" : "OPENAI_API_KEY"]
        if (!key)
          return yield* new ProviderError({
            provider: input.provider,
            model: input.model,
            retryable: false,
            reason: "credential is not configured",
          })

        const request = yield* input.provider === "nvidia"
          ? nvidiaRequest({ ...input, provider: "nvidia" }, {
              ...options,
              nvidiaQwenBaseURL:
                options.nvidiaQwenBaseURL ?? (stored?.type === "api" ? stored.metadata?.nimBaseURL : undefined),
            })
          : Effect.succeed(openaiRequest(input, options))
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(request.url, {
              method: "POST",
              headers: { authorization: `Bearer ${key}`, ...request.headers },
              body: request.body,
            }),
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

function openaiRequest(
  input: {
    model: string
    prompt: string
    referenceImages: ReadonlyArray<ReferenceImage>
  },
  options: { openaiBaseURL?: string },
): HttpRequest {
  return {
    url: `${trimSlash(options.openaiBaseURL ?? OPENAI_BASE_URL)}${input.referenceImages.length ? "/images/edits" : "/images/generations"}`,
    headers: input.referenceImages.length ? {} : { "content-type": "application/json" },
    body: input.referenceImages.length
      ? editBody(input)
      : JSON.stringify({
          model: input.model,
          prompt: input.prompt,
          size: "1024x1536",
          output_format: "png",
        }),
  }
}

function nvidiaRequest(
  input: {
    provider: "nvidia"
    model: string
    prompt: string
    referenceImages: ReadonlyArray<ReferenceImage>
  },
  options: { nvidiaBaseURL?: string; nvidiaQwenBaseURL?: string },
): Effect.Effect<HttpRequest, ProviderError> {
  const reference = input.referenceImages[0]
  if (!reference)
    return Effect.fail(
      new ProviderError({
        provider: input.provider,
        model: input.model,
        retryable: false,
        reason: "NVIDIA image editing requires a reference image",
      }),
    )
  const mimeType = imageMime(reference.bytes)
  if (!mimeType)
    return Effect.fail(
      new ProviderError({
        provider: input.provider,
        model: input.model,
        retryable: false,
        reason: "reference image format is unsupported",
      }),
    )
  const image = `data:${mimeType};base64,${Buffer.from(reference.bytes).toString("base64")}`
  if (input.model === "qwen/qwen-image-edit") {
    if (!options.nvidiaQwenBaseURL)
      return Effect.fail(
        new ProviderError({
          provider: input.provider,
          model: input.model,
          retryable: false,
          reason: "NVIDIA Qwen NIM endpoint is not configured",
        }),
      )
    const baseURL = trustedNvidiaBaseURL(options.nvidiaQwenBaseURL)
    if (!baseURL)
      return Effect.fail(
        new ProviderError({
          provider: input.provider,
          model: input.model,
          retryable: false,
          reason: "NVIDIA Qwen NIM endpoint is not configured",
        }),
      )
    return Effect.succeed({
      url: `${baseURL}/images/edits`,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        image,
        n: 1,
        response_format: "b64_json",
        size: "864x1536",
      }),
    })
  }
  if (input.model === "black-forest-labs/flux_1-kontext-dev") {
    const baseURL = trustedNvidiaBaseURL(options.nvidiaBaseURL ?? NVIDIA_BASE_URL)
    if (!baseURL)
      return Effect.fail(
        new ProviderError({
          provider: input.provider,
          model: input.model,
          retryable: false,
          reason: "NVIDIA hosted endpoint is not configured",
        }),
      )
    return Effect.succeed({
      url: `${baseURL}/genai/black-forest-labs/flux.1-kontext-dev`,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        prompt: input.prompt,
        image,
        aspect_ratio: "match_input_image",
        steps: 30,
        cfg_scale: 3.5,
        seed: 0,
      }),
    })
  }
  return Effect.fail(
    new ProviderError({
      provider: input.provider,
      model: input.model,
      retryable: false,
      reason: "NVIDIA image model is unsupported",
    }),
  )
}

function credential(auth: Auth.Info | undefined) {
  if (!auth) return undefined
  if (auth.type === "oauth") return auth.access
  return auth.key
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function trustedNvidiaBaseURL(value: string) {
  try {
    const parsed = new URL(value)
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1"
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return undefined
    const pathname = trimSlash(parsed.pathname)
    if (pathname === "" || pathname === "/v1") return `${parsed.origin}${pathname || "/v1"}`
    return undefined
  } catch {
    return undefined
  }
}

function decode(body: unknown, provider: ImageGeneration.Provider, model: string, status: number): Output {
  if (provider === "nvidia" && model === "black-forest-labs/flux_1-kontext-dev")
    return decodeNvidiaArtifact(body, provider, model, status)
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

function decodeNvidiaArtifact(body: unknown, provider: "nvidia", model: string, status: number): Output {
  if (!isRecord(body) || !Array.isArray(body.artifacts) || !isRecord(body.artifacts[0]))
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "provider response omitted image artifacts",
    })
  const artifact = body.artifacts[0]
  if (artifact.finishReason !== "SUCCESS" || typeof artifact.base64 !== "string")
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "provider did not produce image bytes",
    })
  const bytes = Buffer.from(artifact.base64, "base64")
  if (!bytes.length)
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "provider returned empty image bytes",
    })
  return { bytes, mimeType: detectMime(bytes, provider, model, status), cost: { known: false } }
}

function detectMime(bytes: Uint8Array, provider: ImageGeneration.Provider, model: string, status: number) {
  const mimeType = imageMime(bytes)
  if (mimeType) return mimeType
  throw new ProviderError({
    provider,
    model,
    status,
    retryable: false,
    reason: "provider returned an unsupported image format",
  })
}

function imageMime(bytes: Uint8Array) {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png" as const
  if (bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return "image/jpeg" as const
  if (
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  )
    return "image/webp" as const
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export * as ImageGenerationProvider from "./provider"
