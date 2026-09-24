import { expect, test } from "bun:test"
import { deriveProductCommandCatalog } from "../src/command"

test("filters hidden commands, deduplicates IDs, and sorts deterministically", () => {
  expect(deriveProductCommandCatalog([
    { id: "z", name: "z", title: "Zed", category: "tools" },
    { id: "hidden", name: "hidden", title: "Hidden", hidden: true },
    { id: "a", name: "a", title: "Alpha", category: "tools" },
    { id: "z", name: "z", title: "Duplicate", category: "tools" },
  ])).toEqual([
    { id: "a", name: "a", title: "Alpha", category: "tools", availability: "available" },
    { id: "z", name: "z", title: "Zed", category: "tools", availability: "available" },
  ])
})
