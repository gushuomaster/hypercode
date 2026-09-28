import type { ProductFormatterState } from "./formatter"
import type { ProductLspState } from "./lsp"
import type { ProductMcpState } from "./mcp"
import type { ProductTextKey } from "./text"

export type ProductCapabilityAvailability =
  | "unconfigured"
  | "disabled"
  | "idle"
  | "healthy"
  | "needs_attention"
  | "degraded"
  | "failed"
  | "unsupported"

export type ProductCapabilitySeverity = "none" | "warning" | "error"

export type ProductCapabilitySummary = {
  availability: ProductCapabilityAvailability
  severity: ProductCapabilitySeverity
  configuredCount: number
  activeCount: number
  failedCount: number
  textKey: Extract<ProductTextKey, `status.${string}`>
}

export function deriveProductMcpSummary(input: { configured: boolean; states: ProductMcpState[] }): ProductCapabilitySummary {
  const configuredCount = input.states.length
  const activeCount = input.states.filter((state) => state.availability === "connected").length
  const failedCount = input.states.filter((state) => state.severity === "error").length
  if (!input.configured) return summary("disabled", "none", configuredCount, activeCount, failedCount, "status.mcp.disabled")
  if (configuredCount === 0) return summary("idle", "none", configuredCount, activeCount, failedCount, "status.mcp.idle")
  if (failedCount === configuredCount) return summary("failed", "error", configuredCount, activeCount, failedCount, "status.mcp.failed")
  if (failedCount > 0) return summary("degraded", "warning", configuredCount, activeCount, failedCount, "status.mcp.degraded")
  if (activeCount === configuredCount) return summary("healthy", "none", configuredCount, activeCount, failedCount, "status.mcp.healthy")
  return summary("needs_attention", "warning", configuredCount, activeCount, failedCount, "status.mcp.needsAttention")
}

export function deriveProductLspSummary(input: { configured: boolean; states: ProductLspState[] }): ProductCapabilitySummary {
  const configuredCount = input.configured ? Math.max(1, input.states.length) : 0
  const activeCount = input.states.filter((state) => state.availability === "connected").length
  const failedCount = input.states.filter((state) => state.severity === "error").length
  if (!input.configured) return summary("disabled", "none", configuredCount, activeCount, failedCount, "status.lsp.disabled")
  if (input.states.length === 0) return summary("idle", "none", configuredCount, activeCount, failedCount, "status.lsp.idle")
  if (failedCount === input.states.length) return summary("failed", "error", configuredCount, activeCount, failedCount, "status.lsp.failed")
  if (failedCount > 0) return summary("degraded", "warning", configuredCount, activeCount, failedCount, "status.lsp.degraded")
  return summary("healthy", "none", configuredCount, activeCount, failedCount, "status.lsp.healthy")
}

export function deriveProductFormatterSummary(input: { configured: boolean; states: ProductFormatterState[] }): ProductCapabilitySummary {
  const configuredCount = input.states.length
  const activeCount = input.states.filter((state) => state.enabled).length
  const failedCount = input.states.filter((state) => state.severity === "warning").length
  if (!input.configured) return summary("disabled", "none", configuredCount, activeCount, failedCount, "status.formatter.disabled")
  if (configuredCount === 0) return summary("idle", "none", configuredCount, activeCount, failedCount, "status.formatter.idle")
  if (failedCount === configuredCount) return summary("failed", "error", configuredCount, activeCount, failedCount, "status.formatter.failed")
  if (failedCount > 0) return summary("degraded", "warning", configuredCount, activeCount, failedCount, "status.formatter.degraded")
  return summary("healthy", "none", configuredCount, activeCount, failedCount, "status.formatter.healthy")
}

function summary(
  availability: ProductCapabilityAvailability,
  severity: ProductCapabilitySeverity,
  configuredCount: number,
  activeCount: number,
  failedCount: number,
  textKey: Extract<ProductTextKey, `status.${string}`>,
): ProductCapabilitySummary {
  return { availability, severity, configuredCount, activeCount, failedCount, textKey }
}
