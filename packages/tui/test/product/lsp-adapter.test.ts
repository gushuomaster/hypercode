import { test, expect } from "bun:test"
import { toProductLspStates } from "../../src/product/lsp-adapter"

test("projects TUI LSP statuses into the shared Product state", () => {
  expect(
    toProductLspStates([
      { id: "ts", name: "TypeScript", root: "/workspace", status: "connected" },
      { id: "rust", name: "Rust", root: "/workspace", status: "error" },
    ]),
  ).toEqual([
    {
      id: "rust",
      name: "Rust",
      root: "/workspace",
      availability: "error",
      severity: "error",
      diagnostic: { message: "LSP connection failed", textKey: "error.lsp.connection_failed" },
    },
    { id: "ts", name: "TypeScript", root: "/workspace", availability: "connected", severity: "none" },
  ])
})
