import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Output, streamText, type FilePart, type ImagePart, type TextPart } from "ai"
import { Provider } from "@/provider/provider"
import { Capability } from "./schema"
import { CapabilityModelHealth } from "./model-health"
import { isRecord } from "@/util/record"

export type Attempt = {
  readonly attempt: number
  readonly providerID: string
  readonly modelID: string
  readonly outcome: "success" | "retry" | "failed"
  readonly reason?: string
}

export type GenerateInput = {
  readonly candidate: Capability.Candidate
  readonly prompt: string
  readonly system?: string
  readonly outputSchema?: Record<string, unknown>
  readonly attachments?: ReadonlyArray<{
    readonly bytes: Uint8Array
    readonly mediaType: string
    readonly filename?: string
    readonly role?: string
  }>
  readonly abort?: AbortSignal
  readonly maxRetries?: number
  readonly onAttempt?: (attempt: Attempt) => void
}

export type GenerateResult = {
  readonly text: string
  readonly attempts: ReadonlyArray<Attempt>
}

export interface Interface {
  readonly generate: (input: GenerateInput) => Effect.Effect<GenerateResult, Error>
}

export class Error extends Schema.TaggedErrorClass<Error>()("CapabilityLLMError", {
  code: Schema.String,
  message: Schema.String,
  retryable: Schema.Boolean,
}) {}

export class Service extends Context.Service<Service, Interface>()("@opencode/CapabilityLLM") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const provider = yield* Provider.Service
    const health = yield* CapabilityModelHealth.Service
    return Service.of({
      generate: (input) =>
        retry({
          candidate: input.candidate,
          maxRetries: input.maxRetries,
          onAttempt: input.onAttempt,
          invoke: Effect.fnUntraced(function* () {
            const model = yield* provider.getModel(
              input.candidate.providerID as Parameters<typeof provider.getModel>[0],
              input.candidate.modelID as Parameters<typeof provider.getModel>[1],
            ).pipe(Effect.mapError((cause) => normalize(cause)))
            const language = yield* provider.getLanguage(model).pipe(Effect.mapError((cause) => normalize(cause)))
            const content: Array<TextPart | ImagePart | FilePart> = input.attachments?.flatMap((attachment) => [
              ...(attachment.role ? [{ type: "text" as const, text: `Attachment role: ${attachment.role}` }] : []),
              attachment.mediaType.startsWith("image/")
                ? { type: "image" as const, image: attachment.bytes, mediaType: attachment.mediaType }
                : {
                    type: "file" as const,
                    data: attachment.bytes,
                    mediaType: attachment.mediaType,
                    ...(attachment.filename ? { filename: attachment.filename } : {}),
                  },
            ]) ?? []
            const prompt = input.outputSchema
              ? `${input.prompt}\n\nOutput JSON schema:\n${JSON.stringify(input.outputSchema)}`
              : input.prompt
            const result = yield* Effect.tryPromise({
              try: () => streamText({
                model: language,
                system: input.system,
                abortSignal: input.abort,
                ...(input.outputSchema ? { output: Output.json() } : {}),
                ...(input.candidate.providerID === "openai"
                  ? { providerOptions: { openai: { store: false } } }
                  : {}),
                ...(content.length
                  ? { messages: [{ role: "user" as const, content: [{ type: "text", text: prompt }, ...content] }] }
                  : { prompt }),
              }).text,
              catch: normalize,
            })
            return result
          }),
        }).pipe(
          Effect.tap(() => health.succeed(input.candidate)),
          Effect.tapError((error) => health.fail({ ...input.candidate, reason: error.message, retryable: error.retryable })),
        ),
    })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provideMerge(CapabilityModelHealth.layer),
  Layer.provide(Provider.defaultLayer),
)

export const node = LayerNode.make(layer, [Provider.node, CapabilityModelHealth.node])

export const retry = Effect.fn("CapabilityLLM.retry")(function* <E, R>(input: {
  readonly candidate: Capability.Identity
  readonly maxRetries?: number
  readonly invoke: (attempt: number) => Effect.Effect<string, E, R>
  readonly onAttempt?: (attempt: Attempt) => void
}) {
  const attempts: Attempt[] = []
  const limit = Math.min(Math.max(input.maxRetries ?? 2, 0), 3) + 1
  for (let attempt = 1; attempt <= limit; attempt++) {
    const result = yield* Effect.result(input.invoke(attempt).pipe(Effect.mapError(normalize)))
    if (result._tag === "Success") {
      const record = entry(input.candidate, attempt, "success")
      attempts.push(record)
      input.onAttempt?.(record)
      return { text: result.success, attempts } satisfies GenerateResult
    }
    const retryable = result.failure.retryable && attempt < limit
    const record = entry(input.candidate, attempt, retryable ? "retry" : "failed", result.failure.message)
    attempts.push(record)
    input.onAttempt?.(record)
    if (!retryable) return yield* result.failure
  }
  return yield* new Error({ code: "provider-failed", message: "Provider request failed", retryable: false })
})

export function normalize(cause: unknown) {
  if (cause instanceof Error) return cause
  const status = isRecord(cause) && typeof cause.statusCode === "number"
    ? cause.statusCode
    : isRecord(cause) && typeof cause.status === "number"
      ? cause.status
      : undefined
  const code = isRecord(cause) && typeof cause.code === "string" ? cause.code : undefined
  const retryable = status === 429 || (status !== undefined && status >= 500 && status <= 599) ||
    code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENETUNREACH" ||
    cause instanceof TypeError
  const message = cause instanceof globalThis.Error ? cause.message : status ? `Provider returned HTTP ${status}` : "Provider request failed"
  return new Error({ code: retryable ? "provider-temporary-failure" : "provider-failure", message, retryable })
}

function entry(
  candidate: Capability.Identity,
  attempt: number,
  outcome: Attempt["outcome"],
  reason?: string,
): Attempt {
  return { attempt, ...candidate, outcome, ...(reason ? { reason } : {}) }
}

export * as CapabilityLLM from "./llm"
