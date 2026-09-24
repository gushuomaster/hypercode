import { expect, test } from "bun:test"
import { toTuiProductCommands } from "../../src/product/command-adapter"

test("projects TUI palette commands through Product", () => {
  expect(toTuiProductCommands([
    { id: "z", name: "z", title: "Zed" },
    { id: "a", name: "a", title: "Alpha" },
  ]).map((entry) => entry.id)).toEqual(["a", "z"])
})
