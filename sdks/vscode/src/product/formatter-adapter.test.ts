import assert from "node:assert/strict"
import { test } from "node:test"
import { toProductFormatterStates } from "./formatter-adapter"

test("projects VS Code formatter statuses into shared Product state", () => {
  assert.deepEqual(toProductFormatterStates([{ name: "prettier", enabled: true, extensions: [".ts"] }]), [
    { name: "prettier", enabled: true, extensions: [".ts"], severity: "none" },
  ])
})
