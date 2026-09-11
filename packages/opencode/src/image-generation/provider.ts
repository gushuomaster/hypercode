import { Auth } from "@/auth"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer, Schema } from "effect"
import { ImageGeneration } from "./schema"

const OPENAI_BASE_URL = "https://api.openai.com/v1"
const CHATGPT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
const NVIDIA_HOSTED_BASE_URL = "https://ai.api.nvidia.com/v1"
const NVIDIA_FLUX_MODEL_SLUG = "black-forest-labs/flux.1-kontext-dev"
const NVIDIA_MODEL_SLUGS: Record<string, string> = {
  "black-forest-labs/flux_1-kontext-dev": NVIDIA_FLUX_MODEL_SLUG,
  [NVIDIA_FLUX_MODEL_SLUG]: NVIDIA_FLUX_MODEL_SLUG,
}

export type ReferenceImage = {
  filename: string
  bytes: Uint8Array
}

export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()("ImageGenerationProviderError", {
  provider: Schema.String,
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

type Fetch = (
  input: Parameters<typeof globalThis.fetch>[0],
  init?: Parameters<typeof globalThis.fetch>[1],
) => ReturnType<typeof globalThis.fetch>

export interface Interface {
  readonly generate: (input: {
    provider: ImageGeneration.Provider
    model: string
    prompt: string
    referenceImages: ReadonlyArray<ReferenceImage>
    width: number
    height: number
  }) => Effect.Effect<Output, ProviderError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ImageGenerationProvider") {}

type LayerOptions = {
  openaiBaseURL?: string
  chatgptBaseURL?: string
  nvidiaBaseURL?: string
  nvidiaQwenBaseURL?: string
  nvidiaAllowedHosts?: ReadonlyArray<string>
  fetch?: Fetch
}

export const layer = (options: LayerOptions = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const auth = yield* Auth.Service

      const generate = Effect.fn("ImageGenerationProvider.generate")(function* (input: {
        provider: ImageGeneration.Provider
        model: string
        prompt: string
        referenceImages: ReadonlyArray<ReferenceImage>
        width: number
        height: number
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
        if (input.provider !== "nvidia" && input.provider !== "openai") {
          return yield* new ProviderError({
            provider: input.provider,
            model: input.model,
            retryable: false,
            reason: "image provider is unsupported",
          })
        }
        const key = credential(stored) ?? process.env[input.provider === "nvidia" ? "NVIDIA_API_KEY" : "OPENAI_API_KEY"]
        if (!key)
          return yield* new ProviderError({
            provider: input.provider,
            model: input.model,
            retryable: false,
            reason: "credential is not configured",
          })

        const request = yield* input.provider === "nvidia"
          ? nvidiaRequest(
              { ...input, provider: "nvidia" },
              {
                ...options,
                nvidiaQwenBaseURL:
                  options.nvidiaQwenBaseURL ?? (stored?.type === "api" ? stored.metadata?.nimBaseURL : undefined),
              },
            )
          : Effect.succeed(
              stored?.type === "oauth" ? chatgptRequest(input, stored, options) : openaiRequest(input, options),
            )
        const response = yield* Effect.tryPromise({
          try: () =>
            (options.fetch ?? globalThis.fetch)(request.url, {
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
          try: () =>
            stored?.type === "oauth"
              ? new TextDecoder().decode(encoded)
              : (JSON.parse(new TextDecoder().decode(encoded)) as unknown),
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
          try: () =>
            stored?.type === "oauth"
              ? decodeChatGpt(body as string, input.provider, input.model, response.status)
              : decode(body, input.provider, input.model, response.status),
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
    width: number
    height: number
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

function chatgptRequest(
  input: {
    model: string
    prompt: string
    referenceImages: ReadonlyArray<ReferenceImage>
    width: number
    height: number
  },
  auth: Auth.Oauth,
  options: { chatgptBaseURL?: string },
): HttpRequest {
  const content = [
    { type: "input_text", text: input.prompt },
    ...input.referenceImages.flatMap((reference) => {
      const mimeType = imageMime(reference.bytes)
      return mimeType
        ? [
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${Buffer.from(reference.bytes).toString("base64")}`,
            },
          ]
        : []
    }),
  ]
  return {
    url: `${trimSlash(options.chatgptBaseURL ?? CHATGPT_CODEX_BASE_URL)}/responses`,
    headers: {
      "content-type": "application/json",
      originator: "opencode",
      ...(auth.accountId ? { "ChatGPT-Account-Id": auth.accountId } : {}),
    },
    body: JSON.stringify({
      model: "gpt-5.5",
      store: false,
      stream: true,
      input: [{ role: "user", content }],
      tools: [
        {
          type: "image_generation",
          model: "gpt-image-1",
          size: imageSize(input.width, input.height),
          quality: "low",
          output_format: "png",
        },
      ],
      tool_choice: { type: "image_generation" },
    }),
  }
}

function imageSize(width: number, height: number) {
  if (width === height) return "1024x1024"
  return width > height ? "1536x1024" : "1024x1536"
}

function nvidiaRequest(
  input: {
    provider: "nvidia"
    model: string
    prompt: string
    referenceImages: ReadonlyArray<ReferenceImage>
  },
  options: { nvidiaBaseURL?: string; nvidiaQwenBaseURL?: string; nvidiaAllowedHosts?: ReadonlyArray<string> },
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
    const baseURL = trustedNvidiaBaseURL(options.nvidiaQwenBaseURL, options.nvidiaAllowedHosts)
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
  const modelSlug = NVIDIA_MODEL_SLUGS[input.model]
  if (modelSlug === NVIDIA_FLUX_MODEL_SLUG) {
    return Effect.succeed({
      url: `${NVIDIA_HOSTED_BASE_URL}/genai/${modelSlug}`,
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

function trustedNvidiaBaseURL(value: string, allowedHosts: ReadonlyArray<string> = []) {
  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "")
    const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    const allowlisted = allowedHosts.some((allowed) => {
      const normalized = allowed.trim().toLowerCase()
      return normalized === hostname || normalized === parsed.host.toLowerCase()
    })
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return undefined
    if (!local && !allowlisted) return undefined
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return undefined
    const pathname = trimSlash(parsed.pathname)
    if (pathname === "" || pathname === "/v1") return `${parsed.origin}${pathname || "/v1"}`
    return undefined
  } catch {
    return undefined
  }
}

function decode(body: unknown, provider: ImageGeneration.Provider, model: string, status: number): Output {
  if (provider === "nvidia" && NVIDIA_MODEL_SLUGS[model] === NVIDIA_FLUX_MODEL_SLUG)
    return decodeNvidiaArtifact(body, provider, model, status)
  if (provider === "nvidia" && model === "qwen/qwen-image-edit") {
    if (!isRecord(body) || !Number.isInteger(body.created))
      throw new ProviderError({
        provider,
        model,
        status,
        retryable: false,
        reason: "provider response omitted created timestamp",
      })
  }
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

function decodeChatGpt(body: string, provider: ImageGeneration.Provider, model: string, status: number): Output {
  let encoded: string | undefined
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:") || line.slice(5).trim() === "[DONE]") continue
    let event: unknown
    try {
      event = JSON.parse(line.slice(5).trim()) as unknown
    } catch {
      continue
    }
    const found = findImageResult(event)
    if (found) encoded = found
  }
  if (!encoded)
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "ChatGPT response omitted image bytes",
    })
  const data = encoded.startsWith("data:") ? encoded.slice(encoded.indexOf(",") + 1) : encoded
  const bytes = Buffer.from(data, "base64")
  if (!bytes.length)
    throw new ProviderError({
      provider,
      model,
      status,
      retryable: false,
      reason: "ChatGPT response returned empty image bytes",
    })
  return { bytes, mimeType: detectMime(bytes, provider, model, status), cost: { known: false } }
}

function findImageResult(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  if (value.type === "image_generation_call" && typeof value.result === "string") return value.result
  for (const child of Object.values(value)) {
    const found = findImageResult(child)
    if (found) return found
  }
  return undefined
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
