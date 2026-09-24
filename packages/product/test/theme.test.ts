import { expect, test } from "bun:test"
import { deriveProductThemeCatalog, deriveProductThemeSelection } from "../src/theme"

test("deduplicates and deterministically orders theme entries", () => {
  const entries = deriveProductThemeCatalog([
    { id: "codex", kind: "theme", order: 2 },
    { id: "classic", kind: "theme", order: 1 },
    { id: "codex", kind: "theme", order: 4 },
    { id: "night", kind: "color", order: 1 },
  ], { theme: "missing", color: "night" })

  expect(entries).toEqual([
    { id: "classic", kind: "theme", order: 1, enabled: true, selected: false },
    { id: "codex", kind: "theme", order: 2, enabled: true, selected: false },
    { id: "night", kind: "color", order: 1, enabled: true, selected: true },
  ])
})

test("falls back to the first enabled entry for each theme kind", () => {
  expect(deriveProductThemeSelection({
    entries: [
      { id: "codex", kind: "theme", order: 2, enabled: true },
      { id: "classic", kind: "theme", order: 1, enabled: true },
      { id: "default", kind: "color", order: 1, enabled: false },
    ],
    selection: { theme: "removed", color: "default" },
  })).toEqual({ theme: "classic", color: undefined })
})
