import { expect, test } from "bun:test"
import { deriveProductLocaleState, normalizeProductLocale } from "../src/locale"

test("normalizes locale families and chooses a supported fallback", () => {
  expect(normalizeProductLocale("zh-CN")).toBe("zh")
  expect(normalizeProductLocale("fr-FR")).toBe("en")
  expect(deriveProductLocaleState({ requested: "fr-FR", available: ["zh-CN"] })).toEqual({
    locale: "zh",
    available: ["zh"],
  })
})
