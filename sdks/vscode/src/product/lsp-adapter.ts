import { deriveProductLspStates, deriveProductLspSummary, type ProductCapabilityConfigInput, type ProductCapabilitySummary, type ProductLspState } from "@opencode-ai/product"
import type { LspStatus } from "../core/sdk"

export function toProductLspStates(statuses: LspStatus[]): ProductLspState[] {
  return deriveProductLspStates(statuses.map((status) => ({
    id: status.id,
    name: status.name,
    root: status.root,
    status: status.status,
  })))
}

export function toProductLspSummary(input: { config: ProductCapabilityConfigInput; statuses: LspStatus[] }): ProductCapabilitySummary {
  return deriveProductLspSummary({ config: input.config, states: toProductLspStates(input.statuses) })
}
