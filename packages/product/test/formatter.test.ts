import { expect, test } from "bun:test"
import { deriveProductFormatterStates } from "../src/formatter"

test("projects formatter enabled state, text keys and deterministic extensions", () => {
  expect(deriveProductFormatterStates([
    { name: "z", enabled: true, extensions: [".ts", ".ts", " js "] },
    { name: "a", enabled: false },
  ])).toEqual([
    { name: "a", enabled: false, extensions: [], severity: "warning", textKey: "item.formatter.disabled" },
    { name: "z", enabled: true, extensions: [".ts", "js"], severity: "none", textKey: "item.formatter.enabled" },
  ])
})
