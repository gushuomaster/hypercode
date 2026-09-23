import { expect, test } from "bun:test"
import type { ProductTextKey } from "@opencode-ai/product"
import { formatTuiProductError, toTuiTextKey } from "../../src/product/text-adapter"

test("maps product text keys to TUI translation keys", () => {
  const keys: ProductTextKey[] = [
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
  ]
  expect(keys.map(toTuiTextKey)).toEqual([
    "dialog.model.section.favorites",
    "dialog.model.section.recent",
    "dialog.model.section.configured",
    "dialog.model.section.current",
    "dialog.model.section.free",
    "dialog.select.noResults",
    "permission.required",
    "question.category",
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
  expect(formatTuiProductError({
    code: "permission_denied",
    message: "Forbidden",
    raw: "HTTP 403 Forbidden",
    textKey: "error.session.permission_denied",
  }, "zh")).toBe("没有权限修改此会话。\nHTTP 403 Forbidden")
})

test("keeps the original provider error beside the Chinese explanation", () => {
  expect(formatTuiProductError({
    message: "Invalid API key",
    raw: "Invalid API key",
    textKey: "error.provider.auth_failed",
  }, "zh")).toBe("Provider 身份验证失败，请检查凭据后重试。\nInvalid API key")
})
