import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { filterItems, type ComposerAutocompleteItem } from "./useComposerAutocomplete"

function slashItem(label: string, detail = label): ComposerAutocompleteItem {
  return {
    id: `slash:${label}`,
    label,
    detail,
    trigger: "slash",
    kind: "command",
  }
}

function skillItem(label: string, trigger: "skill" | "slash" = "skill"): ComposerAutocompleteItem {
  return {
    id: `skill:${label}`,
    label,
    detail: `${label} detail`,
    trigger,
    kind: "SKILL",
  }
}

describe("filterItems", () => {
  test("caps slash results to the top 50 matches for non-empty queries", () => {
    const items = Array.from({ length: 80 }, (_, index) => {
      const value = `arg-${String(index).padStart(2, "0")}`
      return slashItem(value, `argument ${index}`)
    })

    const result = filterItems(items, "slash", "ar")

    assert.equal(result.length, 50)
    assert.deepEqual(result.map((item) => item.label), items.slice(0, 50).map((item) => item.label))
    assert.ok(result.every((item) => Array.isArray(item.match?.label)))
  })

  test("includes skills in the dedicated skill picker even when they are also exposed in slash autocomplete", () => {
    const result = filterItems([
      skillItem("test", "slash"),
      skillItem("effect"),
      slashItem("skills"),
    ], "skill", "")

    assert.deepEqual(result.map((item) => item.label), ["effect", "test"])
  })
})
