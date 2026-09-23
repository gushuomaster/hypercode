import type { ProductError, ProductTextKey } from "@opencode-ai/product"
import { t, type Locale, type TranslationKey } from "../../../i18n"

const textKeys = {
  "model.section.favorites": "model.favorites",
  "model.section.recent": "model.recent",
  "model.section.configured": "model.configured",
  "model.section.current": "model.current",
  "model.section.free": "model.free",
  "model.no_match": "model.noMatch",
  "interaction.permission.title": "permission.approvalNeeded",
  "interaction.question.pending": "question.kicker",
  "model.fallback.default": "product.model.fallback.default",
  "model.fallback.provider": "product.model.fallback.provider",
  "error.provider.auth_failed": "product.error.provider.authFailed",
  "error.provider.request_failed": "product.error.provider.requestFailed",
  "error.unknown": "product.error.unknown",
} as const satisfies Record<ProductTextKey, TranslationKey>

export function toVsCodeTextKey(key: ProductTextKey): TranslationKey {
  return textKeys[key]
}

export function formatVsCodeProductError(error: ProductError, locale?: Locale) {
  const explanation = t(toVsCodeTextKey(error.textKey ?? "error.unknown"), undefined, locale)
  if (!error.raw || error.raw === explanation) return explanation
  return `${explanation}\n${error.raw}`
}
