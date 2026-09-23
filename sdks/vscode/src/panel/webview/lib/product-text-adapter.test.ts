import assert from "node:assert/strict"
import { test } from "node:test"
import { formatVsCodeProductError, toVsCodeTextKey } from "./product-text-adapter"

test("maps product text keys to VSCode translation keys", () => {
  assert.deepEqual([
    "model.section.favorites",
    "model.section.recent",
    "model.section.configured",
    "model.section.current",
    "model.section.free",
    "model.no_match",
    "interaction.permission.title",
    "interaction.question.pending",
    "model.fallback.default",
    "model.fallback.provider",
    "error.provider.auth_failed",
    "error.provider.request_failed",
    "error.session.not_found",
    "error.session.unsupported",
    "error.session.permission_denied",
    "error.session.already_archived",
    "error.session.already_shared",
    "error.session.invalid_title",
    "error.session.request_failed",
    "error.session.unknown",
    "error.unknown",
  ].map(toVsCodeTextKey), [
    "model.favorites",
    "model.recent",
    "model.configured",
    "model.current",
    "model.free",
    "model.noMatch",
    "permission.approvalNeeded",
    "question.kicker",
    "product.model.fallback.default",
    "product.model.fallback.provider",
    "product.error.provider.authFailed",
    "product.error.provider.requestFailed",
    "product.error.session.notFound",
    "product.error.session.unsupported",
    "product.error.session.permissionDenied",
    "product.error.session.alreadyArchived",
    "product.error.session.alreadyShared",
    "product.error.session.invalidTitle",
    "product.error.session.requestFailed",
    "product.error.session.unknown",
    "product.error.unknown",
  ])
})

test("keeps the raw mutation diagnostic beside the Chinese explanation", () => {
  assert.equal(formatVsCodeProductError({
    code: "permission_denied",
    message: "Forbidden",
    raw: "HTTP 403 Forbidden",
    textKey: "error.session.permission_denied",
  }, "zh"), "没有权限修改此会话。\nHTTP 403 Forbidden")
})

test("keeps the original provider error beside the Chinese explanation", () => {
  assert.equal(formatVsCodeProductError({
    message: "Invalid API key",
    raw: "Invalid API key",
    textKey: "error.provider.auth_failed",
  }, "zh"), "Provider 身份验证失败，请检查凭据后重试。\nInvalid API key")
})
