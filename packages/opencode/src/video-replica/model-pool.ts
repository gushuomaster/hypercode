import type { ModelsDev } from "@opencode-ai/core/models-dev"
import { checkHealth, type HealthProbe } from "./model-health"

export type Candidate = {
  providerID: string
  modelID: string
  kind: "orchestration" | "image"
  requiresConfirmation: boolean
}

export type Snapshot = {
  createdAt: string
  orchestration: ReadonlyArray<Candidate>
  image: ReadonlyArray<Candidate>
}

export type ModelPoolConfig = {
  providers?: ReadonlyArray<string>
  providerAllowlist?: ReadonlyArray<string>
  confirmedModels?: ReadonlyArray<string>
  approvedModels?: ReadonlyArray<string>
  knownModels?: ReadonlyArray<string>
  modelOrder?: ReadonlyArray<string>
  orchestrationOrder?: ReadonlyArray<string>
  imageOrder?: ReadonlyArray<string>
  providerOrder?: ReadonlyArray<string>
  healthProbe?: HealthProbe
}

export type Exhausted = {
  exhausted: true
  pool: "orchestration" | "image"
  message: string
  attempted: ReadonlyArray<string>
  requiresConfirmation: boolean
  paidConfirmationRequired: boolean
}

export type FailoverDecision = {
  candidate?: Candidate
  skipped: ReadonlyArray<Candidate>
  requiresConfirmation: boolean
}

export type InitialDecision = FailoverDecision

export function discoverCandidates(
  catalog: Record<string, ModelsDev.Provider>,
  config: ModelPoolConfig,
): ReadonlyArray<Candidate> {
  const providerAllowlist = config.providers ?? config.providerAllowlist ?? []
  const providers = new Set(providerAllowlist)
  const confirmed = new Set([
    ...(config.confirmedModels ?? []),
    ...(config.approvedModels ?? []),
    ...(config.knownModels ?? []),
  ])
  const providerRank = new Map((config.providerOrder ?? providerAllowlist).map((id, index) => [id, index]))
  const candidates = Object.entries(catalog)
    .filter(([providerID]) => providers.has(providerID))
    .flatMap(([providerID, provider]) =>
      Object.values(provider.models).flatMap((model) => {
        const status = model.status as string | undefined
        if (status !== undefined && status !== "active") return []
        if (!isFreeCost(model.cost)) return []
        const input = model.modalities?.input
        const output = model.modalities?.output
        if (!input || !output) return []
        const supportsText = input.includes("text") && input.includes("image") && input.includes("video") && output.includes("text")
        const supportsImage = input.includes("text") && input.includes("image") && output.includes("image")
        if (!supportsText && !supportsImage) return []
        const kind: Candidate["kind"] = supportsText && model.tool_call ? "orchestration" : supportsImage ? "image" : "orchestration"
        if (kind === "orchestration" && (!supportsText || !model.tool_call)) return []
        return [{
          providerID,
          modelID: model.id,
          kind,
          requiresConfirmation: !confirmed.has(`${providerID}/${model.id}`),
        }]
      }),
    )
  const order = (kind: Candidate["kind"]) => {
    const modelOrder =
      kind === "orchestration"
        ? (config.orchestrationOrder ?? config.modelOrder)
        : (config.imageOrder ?? config.modelOrder ?? ["qwen/qwen-image-edit", "black-forest-labs/flux_1-kontext-dev"])
    const rank = new Map((modelOrder ?? []).map((id, index) => [id, index]))
    const modelRank = (candidate: Candidate) => rank.get(candidate.modelID) ?? rank.get(`${candidate.providerID}/${candidate.modelID}`) ?? Number.MAX_SAFE_INTEGER
    return (left: Candidate, right: Candidate) =>
      modelRank(left) - modelRank(right) ||
      (providerRank.get(left.providerID) ?? Number.MAX_SAFE_INTEGER) - (providerRank.get(right.providerID) ?? Number.MAX_SAFE_INTEGER) ||
      left.providerID.localeCompare(right.providerID) ||
      left.modelID.localeCompare(right.modelID)
  }
  return candidates.sort(
    (left, right) =>
      (left.kind === "orchestration" ? 0 : 1) - (right.kind === "orchestration" ? 0 : 1) ||
      order(left.kind)(left, right),
  )
}

export async function discover(
  catalog: Record<string, ModelsDev.Provider>,
  config: ModelPoolConfig,
): Promise<Snapshot> {
  const candidates = discoverCandidates(catalog, config)
  const health = await checkHealth(candidates, config.healthProbe)
  const healthy = candidates.filter((candidate) => health.find((item) => item.providerID === candidate.providerID && item.modelID === candidate.modelID)?.healthy)
  return freeze({
    orchestration: healthy.filter((candidate) => candidate.kind === "orchestration"),
    image: healthy.filter((candidate) => candidate.kind === "image"),
  })
}

export function freeze(pool: Pick<Snapshot, "orchestration" | "image">): Snapshot {
  return {
    createdAt: new Date().toISOString(),
    orchestration: pool.orchestration.map((candidate) => ({ ...candidate })),
    image: pool.image.map((candidate) => ({ ...candidate })),
  }
}

export function nextAfterFailure(snapshot: Snapshot, failed: Candidate): Candidate | undefined {
  return nextAfterFailureDecision(snapshot, failed).candidate
}

export function nextAfterFailureDecision(snapshot: Snapshot, failed: Candidate): FailoverDecision {
  const pool = failed.kind === "orchestration" ? snapshot.orchestration : snapshot.image
  const index = pool.findIndex((candidate) => candidate.providerID === failed.providerID && candidate.modelID === failed.modelID)
  if (index < 0) return { skipped: [], requiresConfirmation: false }
  const remaining = pool.slice(index + 1)
  const candidate = remaining.find((item) => !item.requiresConfirmation)
  const skipped = remaining.slice(0, candidate ? remaining.indexOf(candidate) : remaining.length).filter((item) => item.requiresConfirmation)
  return { candidate, skipped, requiresConfirmation: candidate === undefined && skipped.length > 0 }
}

export function initialDecision(snapshot: Snapshot, pool: "orchestration" | "image"): InitialDecision {
  const candidates = pool === "orchestration" ? snapshot.orchestration : snapshot.image
  const first = candidates[0]
  if (!first) return { candidate: undefined, skipped: [], requiresConfirmation: false }
  if (first.requiresConfirmation) return { candidate: undefined, skipped: [], requiresConfirmation: true }
  return { candidate: first, skipped: [], requiresConfirmation: false }
}

export function exhausted(pool: "orchestration" | "image", attempted: ReadonlyArray<string> = [], requiresConfirmation = true): Exhausted {
  return {
    exhausted: true,
    pool,
    attempted: [...attempted],
    requiresConfirmation,
    paidConfirmationRequired: true,
    message: `No healthy free ${pool} models remain; paid escalation requires confirmation`,
  }
}

function isFreeCost(cost: ModelsDev.Model["cost"]) {
  if (!cost || cost.input !== 0 || cost.output !== 0) return false
  if (cost.cache_read !== undefined && cost.cache_read !== 0) return false
  if (cost.cache_write !== undefined && cost.cache_write !== 0) return false
  if (cost.tiers?.some((tier) => tier.input !== 0 || tier.output !== 0 || (tier.cache_read !== undefined && tier.cache_read !== 0) || (tier.cache_write !== undefined && tier.cache_write !== 0))) return false
  const over = cost.context_over_200k
  return !(over && (over.input !== 0 || over.output !== 0 || (over.cache_read !== undefined && over.cache_read !== 0) || (over.cache_write !== undefined && over.cache_write !== 0)))
}

export * as ModelPool from "./model-pool"
