export type HealthProbeResult = {
  healthy: boolean
  reason?: string
  status?: number
}

export type HealthProbe = (
  candidate: { providerID: string; modelID: string },
) => boolean | HealthProbeResult | Promise<boolean | HealthProbeResult>

export type HealthResult = {
  providerID: string
  modelID: string
  healthy: boolean
  reason?: string
  status?: number
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

export async function probeEndpoint(url: string, options: { fetch?: typeof globalThis.fetch; timeoutMs?: number } = {}) {
  let endpoint: URL
  try {
    endpoint = new URL(url)
  } catch {
    return { healthy: false, reason: "provider endpoint URL is invalid" }
  }
  const hostname = endpoint.hostname.toLowerCase()
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && local))
    return { healthy: false, reason: "provider endpoint must use HTTPS" }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
    return { healthy: false, reason: "provider endpoint URL contains unsafe credentials or query data" }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 2500)
  try {
    const response = await (options.fetch ?? globalThis.fetch)(endpoint, {
      method: "HEAD",
      redirect: "error",
      signal: controller.signal,
    })
    const healthy = response.status < 500 && response.status !== 429
    return {
      healthy,
      status: response.status,
      reason: healthy ? "provider endpoint is reachable" : `provider endpoint returned HTTP ${response.status}`,
    }
  } catch {
    return { healthy: false, reason: "provider endpoint request failed" }
  } finally {
    clearTimeout(timeout)
  }
}

export * as ModelHealth from "./model-health"
