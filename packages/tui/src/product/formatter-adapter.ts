import { deriveProductFormatterStates, deriveProductFormatterSummary, type ProductCapabilityConfigInput, type ProductCapabilitySummary, type ProductFormatterState } from "@opencode-ai/product"
import type { FormatterStatus } from "@opencode-ai/sdk/v2"

export function toProductFormatterStates(statuses: FormatterStatus[]): ProductFormatterState[] {
  return deriveProductFormatterStates(statuses.map((status) => ({
    name: status.name,
    enabled: status.enabled,
    extensions: status.extensions,
  })))
}

export function toProductFormatterSummary(input: { config: ProductCapabilityConfigInput; statuses: FormatterStatus[] }): ProductCapabilitySummary {
  return deriveProductFormatterSummary({ config: input.config, states: toProductFormatterStates(input.statuses) })
}
