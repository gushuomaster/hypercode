export type HealthProbe = (candidate: { providerID: string; modelID: string }) => boolean | Promise<boolean>

export type HealthResult = {
  providerID: string
  modelID: string
  healthy: boolean
}

export async function checkHealth(
  candidates: ReadonlyArray<{ providerID: string; modelID: string }>,
  probe?: HealthProbe,
): Promise<ReadonlyArray<HealthResult>> {
  if (!probe) return candidates.map((candidate) => ({ ...candidate, healthy: false }))
  return Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      healthy: await Promise.resolve().then(() => probe(candidate)).catch(() => false),
    })),
  )
}

export function isHealthy(result: HealthResult | undefined) {
  return result?.healthy === true
}

export * as ModelHealth from "./model-health"
