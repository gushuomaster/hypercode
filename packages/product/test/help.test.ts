import { expect, test } from "bun:test"
import { deriveProductHelpCatalog } from "../src/help"

test("keeps deterministic help topics and explicit unsupported capability", () => {
  expect(deriveProductHelpCatalog([
    { id: "commands", titleKey: "help.commands", order: 2 },
    { id: "shortcuts", titleKey: "help.shortcuts", order: 1, availability: "unsupported" },
    { id: "commands", titleKey: "duplicate", order: 0 },
  ])).toEqual([
    { id: "shortcuts", titleKey: "help.shortcuts", order: 1, availability: "unsupported" },
    { id: "commands", titleKey: "help.commands", order: 2, availability: "available" },
  ])
})
