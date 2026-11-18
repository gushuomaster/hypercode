import { expect, test } from "bun:test"
import { productCommandIDs } from "@opencode-ai/product"
import { CommandMap } from "../../src/config/keybind"
import { toTuiCommandTarget } from "../../src/product/command-adapter"

const registered = new Set<string>(Object.values(CommandMap))

test("every shared Product command maps to a command target registered in the TUI keymap", () => {
  const missing = productCommandIDs.filter((id) => !registered.has(toTuiCommandTarget(id)))
  expect(missing).toEqual([])
})

test("shared Product commands never share a TUI target", () => {
  const targets = productCommandIDs.map((id) => toTuiCommandTarget(id))
  expect(new Set(targets).size).toBe(targets.length)
})
