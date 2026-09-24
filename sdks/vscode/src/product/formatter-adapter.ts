import { deriveProductFormatterStates, type ProductFormatterState } from "@opencode-ai/product"
import type { FormatterStatus } from "../core/sdk"

export function toProductFormatterStates(statuses: FormatterStatus[]): ProductFormatterState[] {
  return deriveProductFormatterStates(statuses.map((status) => ({
    name: status.name,
    enabled: status.enabled,
    extensions: status.extensions,
  })))
}
