import { deriveProductMcpStates, deriveProductMcpSummary, type ProductCapabilityConfigInput, type ProductCapabilitySummary, type ProductMcpActionName, type ProductMcpState, type ProductMcpStateInput } from "@opencode-ai/product"
import type { McpStatus } from "@opencode-ai/sdk/v2"

// `pending` reports only the raw fact that a host action is running for a server; Product decides what that means.
export function toProductMcpStates(statuses: Record<string, McpStatus>, pending: Record<string, ProductMcpActionName> = {}): ProductMcpState[] {
  return deriveProductMcpStates(Object.entries(statuses).map(([name, status]): ProductMcpStateInput => ({
    name,
    status: {
      status: status.status,
      ...("error" in status && status.error ? { error: status.error, raw: status.error } : {}),
    },
    hostActions: ["connect", "disconnect", "reconnect"],
    ...(pending[name] ? { pending: pending[name] } : {}),
  })))
}

export function toProductMcpSummary(input: { config: ProductCapabilityConfigInput; statuses: Record<string, McpStatus>; pending?: Record<string, ProductMcpActionName> }): ProductCapabilitySummary {
  return deriveProductMcpSummary({ config: input.config, states: toProductMcpStates(input.statuses, input.pending) })
}
