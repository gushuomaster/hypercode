import { deriveProductLocaleState, type ProductLocaleState } from "@opencode-ai/product"

export function toVsCodeProductLocale(value?: string): ProductLocaleState {
  return deriveProductLocaleState({ requested: value })
}
