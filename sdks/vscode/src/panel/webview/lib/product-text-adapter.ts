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
  "skill.scope.project": "skill.scope.project",
  "skill.scope.global": "skill.scope.global",
  "skill.scope.builtin": "skill.scope.builtin",
  "skill.scope.external": "skill.scope.external",
  "error.provider.auth_failed": "product.error.provider.authFailed",
  "error.provider.request_failed": "product.error.provider.requestFailed",
  "error.mcp.authentication_required": "product.error.mcp.authenticationRequired",
  "error.mcp.client_registration_required": "product.error.mcp.clientRegistrationRequired",
  "error.mcp.connection_failed": "product.error.mcp.connectionFailed",
  "error.mcp.unsupported": "product.error.mcp.unsupported",
  "error.lsp.connection_failed": "product.error.lsp.connectionFailed",
  "error.session.not_found": "product.error.session.notFound",
  "error.session.unsupported": "product.error.session.unsupported",
  "error.session.permission_denied": "product.error.session.permissionDenied",
  "error.session.already_archived": "product.error.session.alreadyArchived",
  "error.session.already_shared": "product.error.session.alreadyShared",
  "error.session.invalid_title": "product.error.session.invalidTitle",
  "error.session.request_failed": "product.error.session.requestFailed",
  "error.session.unknown": "product.error.session.unknown",
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
