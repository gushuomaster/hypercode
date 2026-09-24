import { deriveProductLocaleState, type ProductLocaleState } from "@opencode-ai/product"

export function toProductLocale(value?: string): ProductLocaleState {
  return deriveProductLocaleState({ requested: value })
}
