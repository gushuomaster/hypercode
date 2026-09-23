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
    "product.error.unknown",
  ])
})

test("keeps the original provider error beside the Chinese explanation", () => {
  expect(formatTuiProductError({
    message: "Invalid API key",
    raw: "Invalid API key",
    textKey: "error.provider.auth_failed",
  }, "zh")).toBe("Provider 身份验证失败，请检查凭据后重试。\nInvalid API key")
})
