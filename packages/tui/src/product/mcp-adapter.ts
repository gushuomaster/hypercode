import { deriveProductMcpStates, type ProductMcpState, type ProductMcpStateInput } from "@opencode-ai/product"
import type { McpStatus } from "@opencode-ai/sdk/v2"

export function toProductMcpStates(statuses: Record<string, McpStatus>): ProductMcpState[] {
  return deriveProductMcpStates(Object.entries(statuses).map(([name, status]): ProductMcpStateInput => ({
    name,
    status: {
      status: status.status,
      ...("error" in status && status.error ? { error: status.error, raw: status.error } : {}),
    },
    hostActions: ["connect", "disconnect", "reconnect"],
  })))
}
