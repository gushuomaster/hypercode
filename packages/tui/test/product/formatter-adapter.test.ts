import { expect, test } from "bun:test"
import { toProductFormatterStates } from "../../src/product/formatter-adapter"

test("projects TUI formatter statuses into shared Product state", () => {
  expect(toProductFormatterStates([{ name: "prettier", enabled: true, extensions: [".ts"] }])).toEqual([
    { name: "prettier", enabled: true, extensions: [".ts"], severity: "none" },
  ])
})
