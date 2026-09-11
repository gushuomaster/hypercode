import { Schema } from "effect"
import { isRecord } from "@/util/record"

export const Modality = Schema.Literals(["text", "image", "audio", "video", "pdf"])
export type Modality = typeof Modality.Type

export const Quality = Schema.Literals(["fast", "balanced", "high"])
export type Quality = typeof Quality.Type

export const Latency = Schema.Literals(["interactive", "batch"])
export type Latency = typeof Latency.Type

export type Identity = {
  readonly providerID: string
  readonly modelID: string
}

export type Requirements = {
  readonly input: ReadonlyArray<Modality>
  readonly output: ReadonlyArray<Modality>
  readonly structuredOutput: boolean
  readonly tools: boolean
  readonly minContext: number
  readonly independentOf: ReadonlyArray<string>
  readonly quality: Quality
  readonly latency: Latency
  readonly independentReview: boolean
  readonly requested?: Identity
}

export type Candidate = Identity & {
  readonly capabilities: {
    readonly input: ReadonlyArray<Modality>
    readonly output: ReadonlyArray<Modality>
    readonly structuredOutput: boolean
    readonly tools: boolean
  }
  readonly context: number
  readonly cost: "free" | "paid"
  readonly credentialAvailable: boolean
  readonly healthy: boolean
  readonly quality: Quality
  readonly latency: Latency
}

export type Policy = {
  readonly allowedProviders?: ReadonlyArray<string>
  readonly allowedModels?: ReadonlyArray<string>
  readonly confirmedModels: ReadonlyArray<string>
  readonly order: ReadonlyArray<string>
  readonly cost: "free-only" | "free-first" | "allow-paid"
}

export type Snapshot = {
  readonly createdAt: string
  readonly requirements: Requirements
  readonly candidates: ReadonlyArray<Candidate>
}

export type Confirmation = {
  readonly kind: "model-first-use" | "paid-use"
  readonly title: string
  readonly message: string
  readonly candidate: Identity
}

export class Error extends Schema.TaggedErrorClass<Error>()("CapabilityError", {
  code: Schema.String,
  message: Schema.String,
}) {}

const modalities = new Set<Modality>(["text", "image", "audio", "video", "pdf"])
const qualities = new Set<Quality>(["fast", "balanced", "high"])
const latencies = new Set<Latency>(["interactive", "batch"])
const fields = new Set([
  "input",
  "input_modalities",
  "output",
  "output_modalities",
  "structured_output",
  "tools",
  "min_context",
  "independent_of",
  "independent_review",
  "reference_editing",
  "aspect_ratio",
  "output_mime_types",
  "quality",
  "latency",
  "provider",
  "model",
])

export function decodeRequirements(input: unknown): Requirements {
  if (!isRecord(input) || Object.keys(input).some((field) => !fields.has(field))) {
    throw new Error({ code: "requirements-invalid", message: "Capability requirements contain unsupported fields" })
  }
  const inputModalities = decodeModalities(input.input ?? input.input_modalities ?? ["text"], "input")
  const outputModalities = decodeModalities(input.output ?? input.output_modalities ?? ["text"], "output")
  if (input.structured_output !== undefined && typeof input.structured_output !== "boolean") invalid("structured_output")
  if (input.tools !== undefined && typeof input.tools !== "boolean") invalid("tools")
  if (input.min_context !== undefined && (!Number.isInteger(input.min_context) || Number(input.min_context) < 0)) {
    invalid("min_context")
  }
  if (
    input.independent_of !== undefined &&
    (!Array.isArray(input.independent_of) || input.independent_of.some((item) => typeof item !== "string" || !item))
  ) {
    invalid("independent_of")
  }
  if (input.independent_review !== undefined && typeof input.independent_review !== "boolean") invalid("independent_review")
  if (input.reference_editing !== undefined && typeof input.reference_editing !== "boolean") invalid("reference_editing")
  if (input.aspect_ratio !== undefined && (typeof input.aspect_ratio !== "string" || !/^\d+:\d+$/.test(input.aspect_ratio))) {
    invalid("aspect_ratio")
  }
  if (
    input.output_mime_types !== undefined &&
    (!Array.isArray(input.output_mime_types) || input.output_mime_types.some((item) => typeof item !== "string" || !item))
  ) {
    invalid("output_mime_types")
  }
  if (input.quality !== undefined && (typeof input.quality !== "string" || !qualities.has(input.quality as Quality))) {
    invalid("quality")
  }
  if (input.latency !== undefined && (typeof input.latency !== "string" || !latencies.has(input.latency as Latency))) {
    invalid("latency")
  }
  if (input.provider !== undefined && (typeof input.provider !== "string" || !input.provider)) invalid("provider")
  if (input.model !== undefined && (typeof input.model !== "string" || !input.model)) invalid("model")
  if ((input.provider === undefined) !== (input.model === undefined)) {
    throw new Error({ code: "requirements-invalid", message: "provider and model must be requested together" })
  }
  return {
    input: inputModalities,
    output: outputModalities,
    structuredOutput: input.structured_output ?? false,
    tools: input.tools ?? false,
    minContext: Number(input.min_context ?? 0),
    independentOf: input.independent_of ? [...input.independent_of] as string[] : [],
    quality: (input.quality as Quality | undefined) ?? "balanced",
    latency: (input.latency as Latency | undefined) ?? "interactive",
    independentReview: input.independent_review ?? false,
    ...(typeof input.provider === "string" && typeof input.model === "string"
      ? { requested: { providerID: input.provider, modelID: input.model } }
      : {}),
  }
}

export function identity(input: Identity) {
  return `${input.providerID}/${input.modelID}`
}

function decodeModalities(input: unknown, field: string) {
  if (
    !Array.isArray(input) ||
    input.length === 0 ||
    input.some((item) => typeof item !== "string" || !modalities.has(item as Modality))
  ) {
    invalid(field)
  }
  return [...new Set(input)] as Modality[]
}

function invalid(field: string): never {
  throw new Error({ code: "requirements-invalid", message: `Capability requirement ${field} is invalid` })
}

export * as Capability from "./schema"
