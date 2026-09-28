import { deriveProductFormatterStates, deriveProductFormatterSummary, type ProductCapabilitySummary, type ProductFormatterState } from "@opencode-ai/product"
import type { FormatterStatus } from "@opencode-ai/sdk/v2"

export function toProductFormatterStates(statuses: FormatterStatus[]): ProductFormatterState[] {
  return deriveProductFormatterStates(statuses.map((status) => ({
    name: status.name,
    enabled: status.enabled,
    extensions: status.extensions,
  })))
}

export function toProductFormatterSummary(input: { configured: boolean; statuses: FormatterStatus[] }): ProductCapabilitySummary {
  return deriveProductFormatterSummary({ configured: input.configured, states: toProductFormatterStates(input.statuses) })
}
