import { deriveProductLspStates, deriveProductLspSummary, type ProductCapabilitySummary, type ProductLspState } from "@opencode-ai/product"
import type { LspStatus } from "@opencode-ai/sdk/v2"

export function toProductLspStates(statuses: LspStatus[]): ProductLspState[] {
  return deriveProductLspStates(statuses.map((status) => ({
    id: status.id,
    name: status.name,
    root: status.root,
    status: status.status,
  })))
}

export function toProductLspSummary(input: { configured: boolean; statuses: LspStatus[] }): ProductCapabilitySummary {
  return deriveProductLspSummary({ configured: input.configured, states: toProductLspStates(input.statuses) })
}
