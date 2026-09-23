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
    "product.error.unknown",
  ])
})

test("keeps the original provider error beside the Chinese explanation", () => {
  assert.equal(formatVsCodeProductError({
    message: "Invalid API key",
    raw: "Invalid API key",
    textKey: "error.provider.auth_failed",
  }, "zh"), "Provider 身份验证失败，请检查凭据后重试。\nInvalid API key")
})
