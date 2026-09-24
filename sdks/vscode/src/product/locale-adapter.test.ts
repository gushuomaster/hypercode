import assert from "node:assert/strict"
import { test } from "node:test"
import { toVsCodeProductLocale } from "./locale-adapter"

test("normalizes VS Code locale through Product", () => {
  assert.deepEqual(toVsCodeProductLocale("zh-TW"), { locale: "zh", available: ["en", "zh"] })
})
