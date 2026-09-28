import { deriveProductMcpStates, deriveProductMcpSummary, type ProductCapabilitySummary, type ProductMcpState, type ProductMcpStateInput } from "@opencode-ai/product"
import type { McpStatus } from "../core/sdk"

export function toProductMcpStates(statuses: Record<string, McpStatus>): ProductMcpState[] {
  return deriveProductMcpStates(Object.entries(statuses).map(([name, status]): ProductMcpStateInput => ({
    name,
    status: {
      status: status.status,
      ...("error" in status && status.error ? { error: status.error, raw: status.error } : {}),
    },
    hostActions: ["connect", "disconnect", "reconnect", "authenticate"],
  })))
}

export function toProductMcpSummary(input: { configured: boolean; statuses: Record<string, McpStatus> }): ProductCapabilitySummary {
  return deriveProductMcpSummary({ configured: input.configured, states: toProductMcpStates(input.statuses) })
}
