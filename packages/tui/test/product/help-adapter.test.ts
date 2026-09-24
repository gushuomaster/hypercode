import { expect, test } from "bun:test"
import { toTuiProductHelpTopics } from "../../src/product/help-adapter"

test("exposes the TUI help topic through Product", () => {
  expect(toTuiProductHelpTopics()).toEqual([
    { id: "commands", titleKey: "dialog.help.title", descriptionKey: "dialog.help.message", order: Number.MAX_SAFE_INTEGER, availability: "available" },
  ])
})
