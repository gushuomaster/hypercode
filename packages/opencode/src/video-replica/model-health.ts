export type HealthProbeResult = {
  healthy: boolean
  reason?: string
}

export type HealthProbe = (
  candidate: { providerID: string; modelID: string },
) => boolean | HealthProbeResult | Promise<boolean | HealthProbeResult>

export type HealthResult = {
  providerID: string
  modelID: string
  healthy: boolean
  reason?: string
}

export async function checkHealth(
  candidates: ReadonlyArray<{ providerID: string; modelID: string }>,
  probe?: HealthProbe,
): Promise<ReadonlyArray<HealthResult>> {
  if (!probe) return candidates.map((candidate) => ({ ...candidate, healthy: false }))
  return Promise.all(candidates.map(async (candidate) => {
    const result = await Promise.resolve().then(() => probe(candidate)).catch(() => false as const)
    if (typeof result === "boolean") return { ...candidate, healthy: result }
    return { ...candidate, ...result }
  }))
}

export function isHealthy(result: HealthResult | undefined) {
  return result?.healthy === true
}

export * as ModelHealth from "./model-health"
