import { expect, test } from "bun:test"
import { toProductLocale } from "../../src/product/locale-adapter"

test("normalizes TUI locale through Product", () => {
  expect(toProductLocale("zh-Hans")).toEqual({ locale: "zh", available: ["en", "zh"] })
})
