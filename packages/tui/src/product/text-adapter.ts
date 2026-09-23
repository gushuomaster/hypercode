import type { ProductError, ProductTextKey } from "@opencode-ai/product"
import { t, type Locale } from "../i18n"
import type { Keys } from "../i18n/en"

const textKeys = {
  "model.section.favorites": "dialog.model.section.favorites",
  "model.section.recent": "dialog.model.section.recent",
  "model.section.configured": "dialog.model.section.configured",
  "model.section.current": "dialog.model.section.current",
  "model.section.free": "dialog.model.section.free",
  "model.no_match": "dialog.select.noResults",
  "interaction.permission.title": "permission.required",
  "interaction.question.pending": "question.category",
  "model.fallback.default": "product.model.fallback.default",
  "model.fallback.provider": "product.model.fallback.provider",
  "error.provider.auth_failed": "product.error.provider.authFailed",
  "error.provider.request_failed": "product.error.provider.requestFailed",
  "error.session.not_found": "product.error.session.notFound",
  "error.session.unsupported": "product.error.session.unsupported",
  "error.session.permission_denied": "product.error.session.permissionDenied",
  "error.session.already_archived": "product.error.session.alreadyArchived",
  "error.session.already_shared": "product.error.session.alreadyShared",
  "error.session.invalid_title": "product.error.session.invalidTitle",
  "error.session.request_failed": "product.error.session.requestFailed",
  "error.session.unknown": "product.error.session.unknown",
  "error.unknown": "product.error.unknown",
} as const satisfies Record<ProductTextKey, Keys>

export function toTuiTextKey(key: ProductTextKey): Keys {
  return textKeys[key]
}

export function formatTuiProductError(error: ProductError, locale?: Locale) {
  const explanation = t(toTuiTextKey(error.textKey ?? "error.unknown"), undefined, locale)
  if (!error.raw || error.raw === explanation) return explanation
  return `${explanation}\n${error.raw}`
}
