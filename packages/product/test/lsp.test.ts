import { describe, expect, test } from "bun:test"
import { deriveProductLspStates } from "../src/lsp"

describe("LSP product state", () => {
  test("projects severity, text keys and diagnostics with deterministic ordering", () => {
    const states = deriveProductLspStates([
      { id: "z", name: "TypeScript", root: "/workspace", status: "connected" },
      { id: "a", name: "Rust", root: "/workspace", status: "error", error: "server exited", raw: "Exit 1" },
    ])

    expect(states).toEqual([
      { id: "a", name: "Rust", root: "/workspace", availability: "error", severity: "error", textKey: "item.lsp.error", diagnostic: { message: "server exited", raw: "Exit 1", textKey: "error.lsp.connection_failed" } },
      { id: "z", name: "TypeScript", root: "/workspace", availability: "connected", severity: "none", textKey: "item.lsp.connected" },
    ])
  })
})
