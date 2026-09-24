import assert from "node:assert/strict"
import { test } from "node:test"
import { toVsCodeProductThemes } from "./theme-adapter"

test("projects VS Code panel themes through Product", () => {
  const entries = toVsCodeProductThemes("codex", "orchid")
  assert.equal(entries.find((entry) => entry.id === "codex")?.selected, true)
  assert.equal(entries.find((entry) => entry.id === "orchid")?.selected, true)
  assert.deepEqual(entries.slice(0, 3).map((entry) => entry.id), ["classic", "codex", "claude"])
})
