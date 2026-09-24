import { test, expect } from "bun:test"
import { toProductLspStates } from "../../src/product/lsp-adapter"

test("projects TUI LSP statuses into the shared Product state", () => {
  expect(toProductLspStates([{ id: "ts", name: "TypeScript", root: "/workspace", status: "connected" }])).toEqual([
    { id: "ts", name: "TypeScript", root: "/workspace", availability: "connected", severity: "none" },
  ])
})
