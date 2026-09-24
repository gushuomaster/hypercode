import { expect, test } from "bun:test"
import { toProductThemes } from "../../src/product/theme-adapter"

test("projects TUI themes into the shared Product catalog", () => {
  expect(toProductThemes({ z: {} as never, a: {} as never }, "a")).toEqual([
    { id: "a", kind: "theme", order: Number.MAX_SAFE_INTEGER, enabled: true, selected: true },
    { id: "z", kind: "theme", order: Number.MAX_SAFE_INTEGER, enabled: true, selected: false },
  ])
})
