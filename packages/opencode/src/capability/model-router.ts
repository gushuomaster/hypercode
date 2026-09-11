import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Provider } from "@/provider/provider"
import { Capability } from "./schema"
import { CapabilityModelHealth } from "./model-health"

export type Confirm = (confirmation: Capability.Confirmation) => Effect.Effect<boolean, unknown>

export interface Interface {
  readonly snapshot: (input: {
    readonly requirements: Capability.Requirements
    readonly policy: Capability.Policy
  }) => Effect.Effect<Capability.Snapshot>
  readonly select: (input: {
    readonly snapshot: Capability.Snapshot
    readonly policy: Capability.Policy
    readonly confirm: Confirm
  }) => Effect.Effect<Capability.Candidate, Capability.Error | unknown>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/CapabilityModelRouter") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const provider = yield* Provider.Service
    const health = yield* CapabilityModelHealth.Service
    return Service.of({
      snapshot: Effect.fn("CapabilityModelRouter.snapshot")(function* (input) {
        const providers = yield* provider.list()
        const candidates = yield* Effect.forEach(
          Object.values(providers).flatMap((item) =>
            Object.values(item.models).filter((model) => model.status === "active").map((model) => ({
              providerID: item.id,
              modelID: model.id,
              capabilities: {
                input: modalities(model.capabilities.input),
                output: modalities(model.capabilities.output),
                structuredOutput: model.capabilities.output.text,
                tools: model.capabilities.toolcall,
              },
              context: model.limit.context,
              cost: isFree(model.cost) ? "free" as const : "paid" as const,
              credentialAvailable: true,
              healthy: true,
              quality: "balanced" as const,
              latency: "interactive" as const,
            })),
          ),
          (candidate) => health.get(candidate).pipe(Effect.map((result) => ({ ...candidate, healthy: result.healthy }))),
        )
        return createSnapshot(input.requirements, candidates, input.policy)
      }),
      select: (input) => authorize(input.snapshot, input.policy, input.confirm),
    })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provideMerge(CapabilityModelHealth.layer),
  Layer.provide(Provider.defaultLayer),
)

export const node = LayerNode.make(layer, [Provider.node, CapabilityModelHealth.node])

export function createSnapshot(
  requirements: Capability.Requirements,
  candidates: ReadonlyArray<Capability.Candidate>,
  policy: Capability.Policy,
  now = new Date(),
): Capability.Snapshot {
  return {
    createdAt: now.toISOString(),
    requirements: {
      ...requirements,
      input: [...requirements.input],
      output: [...requirements.output],
      independentOf: [...requirements.independentOf],
      independentReview: requirements.independentReview,
      ...(requirements.requested ? { requested: { ...requirements.requested } } : {}),
    },
    candidates: rank(candidates.filter((candidate) => allowed(candidate, requirements, policy)), requirements, policy)
      .map((candidate) => ({
        ...candidate,
        capabilities: {
          ...candidate.capabilities,
          input: [...candidate.capabilities.input],
          output: [...candidate.capabilities.output],
        },
      })),
  }
}

export const authorize = Effect.fn("CapabilityModelRouter.authorize")(function* <E, R>(
  snapshot: Capability.Snapshot,
  policy: Capability.Policy,
  confirm: (confirmation: Capability.Confirmation) => Effect.Effect<boolean, E, R>,
) {
  const candidate = snapshot.candidates[0]
  if (!candidate) {
    return yield* new Capability.Error({ code: "model-unavailable", message: "No available model satisfies the capability requirements" })
  }
  const key = Capability.identity(candidate)
  if (!policy.confirmedModels.includes(key)) {
    const accepted = yield* confirm({
      kind: "model-first-use",
      title: "确认模型使用",
      message: `本任务首次使用模型 ${key}，是否允许？`,
      candidate,
    })
    if (!accepted) return yield* new Capability.Error({ code: "model-confirmation-rejected", message: "模型使用未获批准" })
  }
  if (candidate.cost === "paid") {
    const accepted = yield* confirm({
      kind: "paid-use",
      title: "确认付费模型",
      message: `是否允许使用付费模型 ${key}？Provider 可能会收取费用。`,
      candidate,
    })
      if (!accepted) return yield* new Capability.Error({ code: "paid-confirmation-rejected", message: "付费模型使用未获批准" })
  }
  return candidate
})

function allowed(candidate: Capability.Candidate, requirements: Capability.Requirements, policy: Capability.Policy) {
  const key = Capability.identity(candidate)
  if (!candidate.credentialAvailable || !candidate.healthy) return false
  if (policy.cost === "free-only" && candidate.cost !== "free") return false
  if (policy.allowedProviders && !policy.allowedProviders.includes(candidate.providerID)) return false
  if (policy.allowedModels && !policy.allowedModels.includes(key) && !policy.allowedModels.includes(candidate.modelID)) return false
  if (requirements.independentOf.includes(key)) return false
  if (requirements.input.some((item) => !candidate.capabilities.input.includes(item))) return false
  if (requirements.output.some((item) => !candidate.capabilities.output.includes(item))) return false
  if (requirements.structuredOutput && !candidate.capabilities.structuredOutput) return false
  if (requirements.tools && !candidate.capabilities.tools) return false
  return candidate.context >= requirements.minContext
}

function rank(
  candidates: ReadonlyArray<Capability.Candidate>,
  requirements: Capability.Requirements,
  policy: Capability.Policy,
) {
  const order = new Map(policy.order.map((item, index) => [item, index]))
  const requested = requirements.requested ? Capability.identity(requirements.requested) : undefined
  const rankOf = (candidate: Capability.Candidate) =>
    order.get(Capability.identity(candidate)) ?? order.get(candidate.modelID) ?? Number.MAX_SAFE_INTEGER
  return [...candidates].sort((left, right) =>
    (policy.cost === "allow-paid" ? 0 : left.cost === "free" ? -1 : 1) -
      (policy.cost === "allow-paid" ? 0 : right.cost === "free" ? -1 : 1) ||
    (requested === Capability.identity(left) ? 0 : 1) - (requested === Capability.identity(right) ? 0 : 1) ||
    rankOf(left) - rankOf(right) ||
    preference(left, requirements) - preference(right, requirements) ||
    Capability.identity(left).localeCompare(Capability.identity(right)),
  )
}

function preference(candidate: Capability.Candidate, requirements: Capability.Requirements) {
  const quality = requirements.quality === candidate.quality ? 0 : requirements.quality === "high" && candidate.quality === "fast" ? 2 : 1
  const latency = requirements.latency === candidate.latency ? 0 : 1
  return quality * 2 + latency
}

function modalities(input: { text: boolean; image: boolean; audio: boolean; video: boolean; pdf: boolean }) {
  return (["text", "image", "audio", "video", "pdf"] as const).filter((item) => input[item])
}

function isFree(cost: Provider.Model["cost"]) {
  if (cost.input !== 0 || cost.output !== 0 || cost.cache.read !== 0 || cost.cache.write !== 0) return false
  if (cost.tiers?.some((tier) => tier.input !== 0 || tier.output !== 0 || tier.cache.read !== 0 || tier.cache.write !== 0)) return false
  const over = cost.experimentalOver200K
  return !over || (over.input === 0 && over.output === 0 && over.cache.read === 0 && over.cache.write === 0)
}

export * as CapabilityModelRouter from "./model-router"
