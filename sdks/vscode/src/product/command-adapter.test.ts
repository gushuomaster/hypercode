import assert from "node:assert/strict"
import { test } from "node:test"
import { toVsCodeProductCommands } from "./command-adapter"

test("projects VS Code server commands through Product", () => {
  assert.deepEqual(toVsCodeProductCommands([
    { id: "z", name: "z", title: "Zed" },
    { id: "a", name: "a", title: "Alpha" },
  ]).map((entry) => entry.id), ["a", "z"])
})
