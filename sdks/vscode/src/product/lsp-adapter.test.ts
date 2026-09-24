import assert from "node:assert/strict"
import { test } from "node:test"
import { toProductLspStates } from "./lsp-adapter"

test("projects VS Code LSP statuses into the shared Product state", () => {
  assert.deepEqual(toProductLspStates([
    { id: "ts", name: "TypeScript", root: "/workspace", status: "connected" },
    { id: "rust", name: "Rust", root: "/workspace", status: "error" },
  ]), [
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
